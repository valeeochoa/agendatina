<?php
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método no permitido.']);
    exit;
}

$token = trim($_POST['token'] ?? '');
$password = trim($_POST['password'] ?? '');

if (empty($token) || empty($password)) {
    echo json_encode(['success' => false, 'error' => 'Datos incompletos.']);
    exit;
}

if (strlen($password) < 6 || strlen($password) > 14) {
    echo json_encode(['success' => false, 'error' => 'La contraseña debe tener entre 6 y 14 caracteres.']);
    exit;
}

require_once __DIR__ . '/conexion.php';

try {
    $hash = password_hash($password, PASSWORD_DEFAULT);

    // 1. Verificar primero si el token pertenece a un alumno/cliente (en clientes_negocio)
    try {
        $stmtClient = $pdo->prepare("SELECT id, email FROM clientes_negocio WHERE reset_token = :token AND reset_token_expire > NOW() LIMIT 1");
        $stmtClient->execute(['token' => $token]);
        $client = $stmtClient->fetch();

        if ($client) {
            $updateClient = $pdo->prepare("UPDATE clientes_negocio SET password = :pass, reset_token = NULL, reset_token_expire = NULL WHERE LOWER(TRIM(email)) = :email");
            $updateClient->execute(['pass' => $hash, 'email' => strtolower(trim($client['email']))]);

            echo json_encode([
                'success' => true, 
                'user_type' => 'cliente', 
                'redirect' => 'alumno.html', 
                'message' => '¡Contraseña del Portal de Alumno actualizada con éxito! Redirigiendo...'
            ]);
            exit;
        }
    } catch (\Throwable $eClient) {}

    // 2. Si no es un cliente, verificar si pertenece a un usuario/comercio (en usuarios)
    $stmtUser = $pdo->prepare("SELECT id, email FROM usuarios WHERE reset_token = :token AND reset_token_expire > NOW() LIMIT 1");
    $stmtUser->execute(['token' => $token]);
    $user = $stmtUser->fetch();

    if ($user) {
        try { $pdo->exec("ALTER TABLE usuarios MODIFY password VARCHAR(255)"); } catch(\Throwable $e) {}

        $updateUser = $pdo->prepare("UPDATE usuarios SET password = :pass, reset_token = NULL, reset_token_expire = NULL WHERE LOWER(TRIM(email)) = :email");
        $updateUser->execute(['pass' => $hash, 'email' => strtolower(trim($user['email']))]);

        echo json_encode([
            'success' => true, 
            'user_type' => 'usuario', 
            'redirect' => 'login.html', 
            'message' => '¡Contraseña restablecida con éxito! Redirigiendo al inicio de sesión...'
        ]);
        exit;
    }

    echo json_encode(['success' => false, 'error' => 'El enlace ha expirado (validez de 10 minutos) o no es válido. Por favor solicita uno nuevo.']);
    exit;

} catch (\Throwable $e) {
    echo json_encode(['success' => false, 'error' => 'Error del servidor al restablecer contraseña: ' . $e->getMessage()]);
}