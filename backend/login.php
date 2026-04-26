<?php
session_start();
header('Content-Type: application/json; charset=utf-8');

// Por defecto, asegurarnos de que no esté en modo demo al intentar iniciar sesión real
if (isset($_SESSION['is_demo'])) {
    unset($_SESSION['is_demo']);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $email = trim($_POST['username'] ?? '');
    $input_password = trim($_POST['password'] ?? '');

    if (empty($email) || empty($input_password)) {
        echo json_encode(['success' => false, 'error' => 'Por favor, completa todos los campos.']);
        exit;
    }

    // INTERCEPTOR PARA EL MODO DEMO (Simulador aislado)
    if ($email === 'demo@agendatina.site') {
        $_SESSION['is_demo'] = true; 
        require_once __DIR__ . '/conexion.php';
        
        $stmt = $pdo->prepare("SELECT u.id, u.nombre_completo, pn.id_negocio, pn.rol_en_local, n.plan 
                               FROM usuarios u
                               LEFT JOIN personal_negocio pn ON u.id = pn.id_usuario
                               LEFT JOIN negocios n ON pn.id_negocio = n.id
                               WHERE u.email = :email ORDER BY u.id DESC LIMIT 1");
        $stmt->execute(['email' => $email]);
        $validUser = $stmt->fetch();
        
        if ($validUser) {
            $_SESSION['user_id'] = $validUser['id']; 
            $_SESSION['nombre_completo'] = $validUser['nombre_completo'];
            $_SESSION['rol_en_local'] = $validUser['rol_en_local'];
            $_SESSION['id_negocio'] = $validUser['id_negocio'];
            $_SESSION['plan'] = $validUser['plan'];
            echo json_encode(['success' => true, 'plan' => $validUser['plan']]);
        } else {
            echo json_encode(['success' => false, 'error' => 'La cuenta demo no está inicializada. Usa el botón Pruébalo Ahora.']);
        }
        exit;
    }

    // Conectar a la base de datos solo si es un inicio de sesión real
    require_once __DIR__ . '/conexion.php';

    // =========================================================================
    // RATE LIMITING (Prevención de Fuerza Bruta)
    // =========================================================================
    $ip_address = $_SERVER['REMOTE_ADDR'];
    $max_attempts = 5;  // Máximo de intentos permitidos
    $lockout_time = 15; // Minutos de bloqueo si se supera el límite

    try {
        // 1. Crear tabla de intentos si no existe
        try { $pdo->query("SELECT 1 FROM login_attempts LIMIT 1"); } 
        catch(Exception $e) { 
            $pdo->exec("CREATE TABLE login_attempts (id INT AUTO_INCREMENT PRIMARY KEY, ip_address VARCHAR(45) NOT NULL, intentos INT DEFAULT 1, ultimo_intento DATETIME, UNIQUE KEY (ip_address))"); 
        }

        // 2. Limpiar bloqueos expirados (más antiguos que $lockout_time)
        $pdo->exec("DELETE FROM login_attempts WHERE ultimo_intento < NOW() - INTERVAL $lockout_time MINUTE");

        // 3. Verificar si la IP actual está bloqueada
        $stmtCheck = $pdo->prepare("SELECT intentos FROM login_attempts WHERE ip_address = :ip");
        $stmtCheck->execute(['ip' => $ip_address]);
        $attemptData = $stmtCheck->fetch();

        if ($attemptData && $attemptData['intentos'] >= $max_attempts) {
            http_response_code(429); // Código HTTP 429: Too Many Requests
            echo json_encode(['success' => false, 'error' => "Demasiados intentos fallidos. Por seguridad, intenta de nuevo en $lockout_time minutos."]);
            exit;
        }

        // Buscamos TODOS los usuarios que coincidan con ese email
        $sql = "SELECT u.id, u.nombre_completo, u.password, pn.id_negocio, pn.rol_en_local, n.plan 
                FROM usuarios u
                LEFT JOIN personal_negocio pn ON u.id = pn.id_usuario
                LEFT JOIN negocios n ON pn.id_negocio = n.id
                WHERE u.email = :email ORDER BY u.id DESC";
                
        $stmt = $pdo->prepare($sql);
        $stmt->execute(['email' => $email]);
        $users = $stmt->fetchAll();

        if (empty($users)) {
            // Registrar intento fallido
            $stmtFail = $pdo->prepare("INSERT INTO login_attempts (ip_address, intentos, ultimo_intento) VALUES (:ip, 1, NOW()) ON DUPLICATE KEY UPDATE intentos = intentos + 1, ultimo_intento = NOW()");
            $stmtFail->execute(['ip' => $ip_address]);
            echo json_encode(['success' => false, 'error' => 'Correo electrónico o contraseña incorrectos.']);
            exit;
        }
        
        $validUser = null;
        foreach ($users as $u) {
            if (password_verify($input_password, $u['password'])) {
                $validUser = $u;
                break;
            }
        }

        if (!$validUser) {
            // Registrar intento fallido
            $stmtFail = $pdo->prepare("INSERT INTO login_attempts (ip_address, intentos, ultimo_intento) VALUES (:ip, 1, NOW()) ON DUPLICATE KEY UPDATE intentos = intentos + 1, ultimo_intento = NOW()");
            $stmtFail->execute(['ip' => $ip_address]);
            echo json_encode(['success' => false, 'error' => 'Correo electrónico o contraseña incorrectos.']);
            exit;
        }

        // Reseteamos los intentos si el login es exitoso
        $pdo->prepare("DELETE FROM login_attempts WHERE ip_address = :ip")->execute(['ip' => $ip_address]);

        // Credenciales correctas: Creamos la sesión
        $_SESSION['user_id'] = $validUser['id']; 
        $_SESSION['nombre_completo'] = $validUser['nombre_completo'];
        $_SESSION['rol_en_local'] = $validUser['rol_en_local'];
        $_SESSION['id_negocio'] = $validUser['id_negocio']; // Clave para aislar la información
        $_SESSION['plan'] = $validUser['plan']; // Guardamos el plan en sesión
        
        echo json_encode(['success' => true, 'plan' => $validUser['plan']]);
        exit;

    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Error en la base de datos: ' . $e->getMessage()]);
        exit;
    }
}
http_response_code(405);
echo json_encode(['success' => false, 'error' => 'Método no permitido.']);
?>