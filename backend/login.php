<?php
require_once __DIR__ . '/conexion.php';
header('Content-Type: application/json; charset=utf-8');

// Por defecto, asegurarnos de que no esté en modo demo al intentar iniciar sesión real
unset($_SESSION['is_demo']);
unset($_SESSION['demo_negocio_id']);
unset($_SESSION['ruta_negocio']);
if (isset($_COOKIE['agendatina_demo'])) {
    setcookie('agendatina_demo', '', time() - 3600, '/');
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
            session_write_close();
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
        try { $pdo->exec("ALTER TABLE personal_negocio ADD COLUMN permisos TEXT NULL"); } catch(Throwable $e) {}
        try { $pdo->exec("ALTER TABLE usuarios ADD COLUMN debe_cambiar_pass TINYINT DEFAULT 0"); } catch(Throwable $e) {}

        // 1. Verificar si la cuenta requiere establecer contraseña por primera vez (aislado de forma segura)
        try {
            $stmtCheckFirst = $pdo->prepare("SELECT id, nombre_completo, email, debe_cambiar_pass FROM usuarios WHERE email = :email LIMIT 1");
            $stmtCheckFirst->execute(['email' => $email]);
            $firstUser = $stmtCheckFirst->fetch(PDO::FETCH_ASSOC);

            if ($firstUser && (int)($firstUser['debe_cambiar_pass'] ?? 0) === 1) {
                echo json_encode([
                    'success' => false,
                    'require_first_password' => true,
                    'email' => $email,
                    'nombre' => $firstUser['nombre_completo'],
                    'message' => 'Es tu primer inicio de sesión. Por favor establece tu contraseña de acceso.'
                ]);
                exit;
            }
        } catch (Throwable $eFirst) {}

        $sql = "SELECT u.id, u.nombre_completo, u.password, pn.id_negocio, pn.rol_en_local, pn.permisos, n.plan, n.nombre_fantasia 
                FROM usuarios u
                LEFT JOIN personal_negocio pn ON u.id = pn.id_usuario
                LEFT JOIN negocios n ON pn.id_negocio = n.id
                WHERE u.email = :email ORDER BY u.id DESC";
                
        $stmt = $pdo->prepare($sql);
        $stmt->execute(['email' => $email]);
        $users = $stmt->fetchAll(PDO::FETCH_ASSOC);

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

        // Consultar todos los negocios vinculados a este usuario (sin GROUP BY para máxima compatibilidad con SQL Mode)
        $allBiz = [];
        try {
            $stmtBiz = $pdo->prepare("
                SELECT pn.id_negocio, pn.rol_en_local, pn.permisos, n.nombre_fantasia, n.plan, cw.url_logo AS logo
                FROM personal_negocio pn
                JOIN negocios n ON pn.id_negocio = n.id
                LEFT JOIN configuracion_web cw ON n.id = cw.id_negocio
                WHERE pn.id_usuario = :user_id
                ORDER BY (pn.rol_en_local = 'admin') DESC, pn.id_negocio ASC
            ");
            $stmtBiz->execute(['user_id' => $validUser['id']]);
            $allBiz = $stmtBiz->fetchAll(PDO::FETCH_ASSOC) ?: [];
        } catch (Throwable $eBiz) {
            $allBiz = [];
        }

        if (count($allBiz) > 1) {
            // Usuario en MÚLTIPLES NEGOCIOS: Solicitar selección en el frontend
            $_SESSION['pending_user_id'] = $validUser['id'];
            $_SESSION['nombre_completo'] = $validUser['nombre_completo'];

            echo json_encode([
                'success' => true,
                'multiple_businesses' => true,
                'user_id' => $validUser['id'],
                'nombre' => $validUser['nombre_completo'],
                'businesses' => array_map(function($b) {
                    return [
                        'id_negocio' => (int)$b['id_negocio'],
                        'nombre' => $b['nombre_fantasia'] ?: 'Mi Negocio',
                        'rol' => $b['rol_en_local'],
                        'plan' => $b['plan'] ?: 'Plan Simple',
                        'logo' => $b['logo'] ?? null
                    ];
                }, $allBiz)
            ]);
            exit;
        } else {
            // Un solo negocio o por defecto
            $bizTarget = $allBiz[0] ?? $validUser;
            
            $_SESSION['user_id'] = $validUser['id']; 
            $_SESSION['nombre_completo'] = $validUser['nombre_completo'];
            $_SESSION['rol_en_local'] = $bizTarget['rol_en_local'] ?? 'admin';
            $_SESSION['id_negocio'] = (int)($bizTarget['id_negocio'] ?? $validUser['id_negocio']);
            $_SESSION['plan'] = $bizTarget['plan'] ?? $validUser['plan'];

            $defaultProfPerms = ['agenda' => 1, 'ver_todos_turnos' => 1, 'web' => 0, 'servicios' => 0, 'estadisticas' => 0, 'equipo' => 0];
            $defaultAdminPerms = ['agenda' => 1, 'ver_todos_turnos' => 1, 'web' => 1, 'servicios' => 1, 'estadisticas' => 1, 'equipo' => 1];

            if ($_SESSION['rol_en_local'] === 'admin') {
                $_SESSION['permisos'] = $defaultAdminPerms;
            } else {
                $parsedPerms = !empty($bizTarget['permisos']) ? json_decode($bizTarget['permisos'], true) : null;
                $_SESSION['permisos'] = is_array($parsedPerms) ? array_merge($defaultProfPerms, $parsedPerms) : $defaultProfPerms;
            }
            
            session_write_close();
            echo json_encode(['success' => true, 'plan' => $_SESSION['plan']]);
            exit;
        }

    } catch (Throwable $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Error en la base de datos: ' . $e->getMessage()]);
        exit;
    }
}
http_response_code(405);
echo json_encode(['success' => false, 'error' => 'Método no permitido.']);
?>