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

    try {
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
            echo json_encode(['success' => false, 'error' => 'Correo electrónico o contraseña incorrectos.']);
            exit;
        }

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