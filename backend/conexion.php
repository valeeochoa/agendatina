<?php
// Configurar políticas de seguridad de cookies de sesión
if (session_status() === PHP_SESSION_NONE) {
    ini_set('session.cookie_httponly', 1);
    ini_set('session.use_only_cookies', 1);
    $isSecure = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on';
    ini_set('session.cookie_secure', $isSecure ? 1 : 0);
    session_start();
}

// 1. Cargar variables de entorno
require_once __DIR__ . '/dotenv.php';

// 2. Autoloader de clases helper
spl_autoload_register(function ($className) {
    $file = __DIR__ . '/helpers/' . $className . '.php';
    if (file_exists($file)) {
        require_once $file;
    }
});

// 3. Inicializar CSRF y sincronizar cookies
CSRF::init();

// 4. Middleware de validación CSRF automatizado
$requestMethod = $_SERVER['REQUEST_METHOD'] ?? '';
if ($requestMethod !== 'GET' && $requestMethod !== 'HEAD' && $requestMethod !== 'OPTIONS' && $requestMethod !== '') {
    if (isset($_SESSION['user_id'])) {
        $requestUri = $_SERVER['SCRIPT_NAME'] ?? '';
        $isPublic = false;
        $publicFiles = ['/login.php', '/admin_auth.php', '/crear_usuario.php', '/enviar_turno.php', '/enviar_contacto.php', '/restablecer_password.php', '/recuperar_password.php'];
        foreach ($publicFiles as $pf) {
            if (strpos($requestUri, $pf) !== false) {
                $isPublic = true;
                break;
            }
        }

        if (!$isPublic) {
            $csrfToken = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? $_POST['csrf_token'] ?? '';
            if (!CSRF::verify($csrfToken)) {
                http_response_code(403);
                die(json_encode(['success' => false, 'error' => 'Petición no autorizada (CSRF Token inválido o ausente).']));
            }
        }
    }
}

// 5. Configuración de conexión desde variables de entorno
$host = $_ENV['DB_HOST'] ?? 'localhost';
$dbname = $_ENV['DB_NAME'] ?? 'c2771918_tina';
$username = $_ENV['DB_USER'] ?? 'root';
$password = $_ENV['DB_PASS'] ?? '';

// Detectar si un cliente público está visitando la URL de la Demo o interactuando con ella
$is_demo_public = false;
if (isset($_GET['n']) && strtolower($_GET['n']) === 'demo') {
    $is_demo_public = true;
} elseif (isset($_POST['negocio']) && strtolower($_POST['negocio']) === 'demo') {
    $is_demo_public = true;
} elseif (isset($_POST['ruta']) && strtolower($_POST['ruta']) === 'demo') {
    $is_demo_public = true;
}

// MODO SANDBOX: Conectar a BD clonada si es el Admin de Demo o la vista pública
if ((isset($_SESSION['is_demo']) && $_SESSION['is_demo'] === true) || $is_demo_public) {
    $dbname = strpos($dbname, '_d') === false ? $dbname . '_d' : $dbname; 
    
    // Detectar si estamos en un servidor local (desarrollo) para no pisar credenciales locales
    $isLocalServer = false;
    if (isset($_SERVER['HTTP_HOST'])) {
        if (strpos($_SERVER['HTTP_HOST'], 'localhost') !== false || strpos($_SERVER['HTTP_HOST'], '127.0.0.1') !== false) {
            $isLocalServer = true;
        }
    } else {
        if (($host === 'localhost' || $host === '127.0.0.1') && $username === 'root') {
            $isLocalServer = true;
        }
    }
    
    // Si no es un servidor local y existen credenciales específicas para la demo en el entorno, utilizarlas
    if (!$isLocalServer) {
        if (isset($_ENV['DB_DEMO_USER']) && !empty($_ENV['DB_DEMO_USER'])) {
            $username = $_ENV['DB_DEMO_USER'];
        }
        if (isset($_ENV['DB_DEMO_PASS']) && !empty($_ENV['DB_DEMO_PASS'])) {
            $password = $_ENV['DB_DEMO_PASS'];
        }
    }
}

try {
    // Establecer la conexión usando PDO
    $pdo = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8mb4", $username, $password);
    
    // Configurar PDO para que lance excepciones si ocurre un error
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    // Retornar siempre los resultados como un array asociativo
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    
} catch (PDOException $e) {
    // Si es la base de datos sandbox/demo y falló, lanzar error limpio sin intentar CREATE DATABASE
    if (strpos($dbname, '_d') !== false) {
        error_log('Error al acceder a base de datos demo: ' . $e->getMessage());
        header('Content-Type: application/json');
        die(json_encode([
            'success' => false,
            'error' => "Error de conexión al Demo. Asegúrate de haber creado la base de datos '$dbname' en tu panel de control y de haber VINCULADO a tu usuario MySQL a ella con todos los permisos."
        ]));
    } else {
        // Registrar el error en el log del servidor para depuración
        error_log('Error de conexión a la BD: ' . $e->getMessage());
        // Retornar un mensaje genérico al cliente para evitar revelar detalles de la infraestructura
        header('Content-Type: application/json');
        die(json_encode(['success' => false, 'error' => 'Error de conexión a la base de datos. Por favor, intenta más tarde.']));
    }
}

if (isset($pdo)) {
    try {
        $pdo->query("SELECT notas FROM turnos LIMIT 1");
    } catch (Exception $ex) {
        try {
            $pdo->exec("ALTER TABLE turnos ADD COLUMN notas TEXT DEFAULT NULL");
        } catch (Exception $alterEx) {
            error_log("Error al agregar columna notas a turnos: " . $alterEx->getMessage());
        }
    }
}

// Asegurar que fecha_eliminado exista en turnos
if (isset($pdo)) {
    try {
        $pdo->query("SELECT fecha_eliminado FROM turnos LIMIT 1");
    } catch (Exception $ex) {
        try {
            $pdo->exec("ALTER TABLE turnos ADD COLUMN fecha_eliminado DATETIME DEFAULT NULL");
        } catch (Exception $alterEx) {
            error_log("Error al agregar columna fecha_eliminado a turnos: " . $alterEx->getMessage());
        }
    }
}

// Inicializar esquema si es la BD demo y está vacía
if (isset($pdo) && strpos($dbname, '_d') !== false) {
    $tableExists = false;
    try {
        $pdo->query("SELECT 1 FROM negocios LIMIT 1");
        $tableExists = true;
    } catch (Exception $ex) {
        $tableExists = false;
    }
    
    if (!$tableExists) {
        // Importar schema.sql
        $schemaFile = dirname(__DIR__) . '/schema.sql';
        if (file_exists($schemaFile)) {
            $schema = file_get_contents($schemaFile);
            $schema = preg_replace('/^\s*--.*$/m', '', $schema);
            $queries = array_filter(array_map('trim', explode(';', $schema)));
            foreach ($queries as $q) {
                if (!empty($q)) {
                    try { $pdo->exec($q); } catch (Exception $e) {}
                }
            }
        }
    }
}

// Asegurar que la columna limite_eliminacion_dias exista en configuracion_web
if (isset($pdo)) {
    try {
        $pdo->query("SELECT limite_eliminacion_dias FROM configuracion_web LIMIT 1");
    } catch (Exception $migrEx) {
        try {
            $pdo->exec("ALTER TABLE configuracion_web ADD COLUMN limite_eliminacion_dias INT DEFAULT 0");
        } catch (Exception $alterEx) {
            error_log("No se pudo añadir la columna limite_eliminacion_dias: " . $alterEx->getMessage());
        }
    }
}

// Asegurar que la tabla comprobantes_pago exista siempre
if (isset($pdo)) {
    try {
        $pdo->query("SELECT id FROM comprobantes_pago LIMIT 1");
    } catch (Exception $ex) {
        try {
            $pdo->exec("CREATE TABLE IF NOT EXISTS `comprobantes_pago` (
              `id` INT AUTO_INCREMENT PRIMARY KEY,
              `id_negocio` INT NOT NULL,
              `monto` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
              `plan` VARCHAR(100) DEFAULT NULL,
              `archivo_path` VARCHAR(255) NOT NULL,
              `nombre_archivo` VARCHAR(255) NOT NULL,
              `fecha_pago` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
              `estado` VARCHAR(50) DEFAULT 'aprobado',
              `notas` TEXT DEFAULT NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");
        } catch (Exception $alterEx) {
            error_log("Error al crear tabla comprobantes_pago: " . $alterEx->getMessage());
        }
    }
}
?>