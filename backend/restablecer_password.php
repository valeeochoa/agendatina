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
    // Verificar que el token exista y no haya expirado
    $stmt = $pdo->prepare("SELECT id, email FROM usuarios WHERE reset_token = :token AND reset_token_expire > NOW() LIMIT 1");
    $stmt->execute(['token' => $token]);
    $user = $stmt->fetch();

    if (!$user) {
        echo json_encode(['success' => false, 'error' => 'El enlace ha expirado o no es válido. Por favor, solicita uno nuevo.']);
        exit;
    }
    
    // Asegurar que la columna tenga suficiente tamaño para el hash (60 chars)
    try { $pdo->exec("ALTER TABLE usuarios MODIFY password VARCHAR(255)"); } catch(Exception $e) {}

    $hash = password_hash($password, PASSWORD_DEFAULT);
    // Actualizamos TODOS los registros con el mismo email para evitar que el login use una clave vieja de cuentas clonadas
    $update = $pdo->prepare("UPDATE usuarios SET password = :pass, reset_token = NULL, reset_token_expire = NULL WHERE email = :email");
    $update->execute(['pass' => $hash, 'email' => $user['email']]);

    echo json_encode(['success' => true]);
} catch (Exception $e) {
    echo json_encode(['success' => false, 'error' => 'Error del servidor al restablecer contraseña.']);
}
?>