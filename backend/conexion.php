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
        $publicFiles = ['/login.php', '/registrarse.php', '/admin_auth.php', '/crear_usuario.php', '/enviar_turno.php', '/enviar_contacto.php', '/restablecer_password.php', '/recuperar_password.php'];
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
// 5. Configuración de conexión desde variables de entorno
$host = $_ENV['DB_HOST'] ?? 'localhost';
$dbname = $_ENV['DB_NAME'] ?? 'c2771918_tina';
$username = $_ENV['DB_USER'] ?? 'root';
$password = $_ENV['DB_PASS'] ?? '';

$originalUser = $username;
$originalPass = $password;

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
if ((isset($_SESSION['is_demo']) && $_SESSION['is_demo'] === true) || $is_demo_public || (isset($_SESSION['ruta_negocio']) && $_SESSION['ruta_negocio'] === 'demo')) {
    $_SESSION['is_demo'] = true;
    $dbname = strpos($dbname, '_d') === false ? $dbname . '_d' : $dbname; 
    
    // Detectar si estamos en un servidor local (desarrollo) para no pisar credenciales locales
    $isLocalServer = false;
    if (isset($_SERVER['HTTP_HOST'])) {
        if (strpos($_SERVER['HTTP_HOST'], 'localhost') !== false || strpos($_SERVER['HTTP_HOST'], '127.0.0.1') !== false) {
            $isLocalServer = true;
        }
    } else {
        if (($host === 'localhost' || $host === '127.0.0.1')) {
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
    // Si es la base de datos sandbox/demo y falló, intentar auto-crearla o usar fallback a la BD principal
    if (strpos($dbname, '_d') !== false) {
        // Intento 1: Crear BD sandbox usando credenciales Demo o Principales
        try {
            $uTry = $username;
            $pTry = $password;
            $pdo = new PDO("mysql:host=$host;charset=utf8mb4", $uTry, $pTry);
            $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
            $pdo->exec("CREATE DATABASE IF NOT EXISTS `$dbname` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
            $pdo->exec("USE `$dbname` ");
            $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
        } catch (Throwable $eCreate1) {
            // Intento 2: Crear BD sandbox usando credenciales Principales
            try {
                $pdo = new PDO("mysql:host=$host;charset=utf8mb4", $originalUser, $originalPass);
                $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
                $pdo->exec("CREATE DATABASE IF NOT EXISTS `$dbname` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
                $pdo->exec("USE `$dbname` ");
                $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
            } catch (Throwable $eCreate2) {
                // Intento 3: Conectar a BD Demo existente usando credenciales Principales
                try {
                    $pdo = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8mb4", $originalUser, $originalPass);
                    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
                    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
                } catch (Throwable $eDemoOrig) {
                    // Intento 4: Fallback absoluto a la BD Principal utilizando credenciales Principales
                    try {
                        $mainDb = str_replace('_d', '', $dbname);
                        $pdo = new PDO("mysql:host=$host;dbname=$mainDb;charset=utf8mb4", $originalUser, $originalPass);
                        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
                        $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
                    } catch (Throwable $eMain) {
                        error_log('Error al acceder a base de datos demo: ' . $e->getMessage());
                        if (isset($_SERVER['SCRIPT_NAME']) && strpos($_SERVER['SCRIPT_NAME'], 'demo.php') !== false) {
                            throw new PDOException("Error de conexión a la base de datos Demo ('$dbname'): " . $e->getMessage());
                        }
                        header('Content-Type: application/json');
                        die(json_encode([
                            'success' => false,
                            'error' => "Error de conexión al Demo. Asegúrate de haber creado la base de datos '$dbname' en tu panel de control y de haber VINCULADO a tu usuario MySQL a ella con todos los permisos."
                        ]));
                    }
                }
            }
        }
    } else {
        // Registrar el error en el log del servidor para depuración
        error_log('Error de conexión a la BD: ' . $e->getMessage());
        // Retornar un mensaje genérico al cliente para evitar revelar detalles de la infraestructura
        header('Content-Type: application/json');
        die(json_encode(['success' => false, 'error' => 'Error de conexión a la base de datos. Por favor, intenta más tarde.']));
    }
}

// AUTO-MIGRACIÓN AUTOMÁTICA DE TABLAS Y COLUMNAS EN PRODUCCIÓN Y LOCAL
if (isset($pdo)) {
    // 1. Columnas en turnos
    try { $pdo->query("SELECT notas FROM turnos LIMIT 1"); } catch (Throwable $e) { try { $pdo->exec("ALTER TABLE turnos ADD COLUMN notas TEXT DEFAULT NULL"); } catch (Throwable $ex) {} }
    try { $pdo->query("SELECT fecha_eliminado FROM turnos LIMIT 1"); } catch (Throwable $e) { try { $pdo->exec("ALTER TABLE turnos ADD COLUMN fecha_eliminado DATETIME DEFAULT NULL"); } catch (Throwable $ex) {} }

    // 2. Columnas en configuracion_web
    try { $pdo->query("SELECT limite_eliminacion_dias FROM configuracion_web LIMIT 1"); } catch (Throwable $e) { try { $pdo->exec("ALTER TABLE configuracion_web ADD COLUMN limite_eliminacion_dias INT DEFAULT 30"); } catch (Throwable $ex) {} }
    try { $pdo->query("SELECT hora_apertura FROM configuracion_web LIMIT 1"); } catch (Throwable $e) { try { $pdo->exec("ALTER TABLE configuracion_web ADD COLUMN hora_apertura VARCHAR(5) DEFAULT '09:00'"); } catch (Throwable $ex) {} }
    try { $pdo->query("SELECT hora_cierre FROM configuracion_web LIMIT 1"); } catch (Throwable $e) { try { $pdo->exec("ALTER TABLE configuracion_web ADD COLUMN hora_cierre VARCHAR(5) DEFAULT '19:00'"); } catch (Throwable $ex) {} }
    try { $pdo->query("SELECT dias_trabajo FROM configuracion_web LIMIT 1"); } catch (Throwable $e) { try { $pdo->exec("ALTER TABLE configuracion_web ADD COLUMN dias_trabajo VARCHAR(50) DEFAULT '1,2,3,4,5,6'"); } catch (Throwable $ex) {} }

    // 3. Tabla comprobantes_pago
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
    } catch (Throwable $ex) {}

    // 4. Tabla configuracion_global y columnas
    try {
        $pdo->exec("CREATE TABLE IF NOT EXISTS `configuracion_global` (
          `id` INT PRIMARY KEY DEFAULT 1,
          `precio_basico` DECIMAL(10,2) NOT NULL DEFAULT 8889.00,
          `precio_intermedio` DECIMAL(10,2) NOT NULL DEFAULT 11111.00,
          `precio_premium` DECIMAL(10,2) NOT NULL DEFAULT 16667.00,
          `descuento_porcentaje` INT NOT NULL DEFAULT 10,
          `descuento_hasta` DATETIME DEFAULT NULL,
          `dias_prueba_defecto` INT NOT NULL DEFAULT 30
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");
        $pdo->exec("INSERT IGNORE INTO `configuracion_global` (`id`, `precio_basico`, `precio_intermedio`, `precio_premium`, `descuento_porcentaje`, `descuento_hasta`, `dias_prueba_defecto`) VALUES (1, 8889.00, 11111.00, 16667.00, 10, NULL, 30);");
    } catch (Throwable $ex) {}

    try { $pdo->query("SELECT dias_prueba_defecto FROM configuracion_global LIMIT 1"); } catch (Throwable $e) { try { $pdo->exec("ALTER TABLE configuracion_global ADD COLUMN dias_prueba_defecto INT NOT NULL DEFAULT 30"); } catch (Throwable $ex) {} }

    // 5. Tabla notificaciones_admin
    try {
        $pdo->exec("CREATE TABLE IF NOT EXISTS `notificaciones_admin` (
          `id` INT AUTO_INCREMENT PRIMARY KEY,
          `segmento` VARCHAR(100) NOT NULL,
          `mensaje` TEXT NOT NULL,
          `id_negocio` INT NULL,
          `fecha` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          `leida` BOOLEAN DEFAULT FALSE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");
    } catch (Throwable $ex) {}

    // 6. Tabla admin_notas
    try {
        $pdo->exec("CREATE TABLE IF NOT EXISTS `admin_notas` (
          `id` INT AUTO_INCREMENT PRIMARY KEY,
          `id_negocio` INT NOT NULL UNIQUE,
          `nota` TEXT NOT NULL,
          `fecha_actualizacion` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");
    } catch (Throwable $ex) {}

    // 7. Tabla login_attempts
    try {
        $pdo->exec("CREATE TABLE IF NOT EXISTS `login_attempts` (
          `id` INT AUTO_INCREMENT PRIMARY KEY,
          `ip_address` VARCHAR(45) NOT NULL UNIQUE,
          `intentos` INT NOT NULL DEFAULT 1,
          `ultimo_intento` DATETIME NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");
    } catch (Throwable $ex) {}
}
?>