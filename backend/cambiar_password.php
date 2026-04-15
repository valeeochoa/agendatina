<?php
session_start();
header('Content-Type: application/json; charset=utf-8');

// 0. Verificar que el usuario esté logueado
if (!isset($_SESSION['user_id'])) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Acceso no autorizado. Inicia sesión.']);
    exit;
}

// 1. Solo permitir método POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método no permitido.']);
    exit;
}

// 2. Incluir conexión a la BD
require_once __DIR__ . '/conexion.php';

// 3. Obtener los datos enviados por el formulario
$current_password = $_POST['current_password'] ?? '';
$new_password = $_POST['new_password'] ?? '';
$confirm_password = $_POST['confirm_password'] ?? '';
$userId = $_SESSION['user_id'];

// 4. Validaciones básicas
if (empty($current_password) || empty($new_password) || empty($confirm_password)) {
    echo json_encode(['success' => false, 'error' => 'Todos los campos son obligatorios.']);
    exit;
}

if ($new_password !== $confirm_password) {
    echo json_encode(['success' => false, 'error' => 'Las nuevas contraseñas no coinciden.']);
    exit;
}

try {
    // 5. Obtener el hash de la contraseña actual del usuario desde la BD
    $stmt = $pdo->prepare("SELECT password FROM usuarios WHERE id = :id");
    $stmt->execute(['id' => $userId]);
    $user = $stmt->fetch();

    if (!$user) {
        echo json_encode(['success' => false, 'error' => 'El usuario no existe.']);
        exit;
    }

    // 6. Verificar que la contraseña actual ingresada coincida con el hash guardado
    if (!password_verify($current_password, $user['password'])) {
        echo json_encode(['success' => false, 'error' => 'La contraseña actual es incorrecta.']);
        exit;
    }

    // 7. Encriptar y guardar la nueva contraseña en la BD
    $new_password_hash = password_hash($new_password, PASSWORD_DEFAULT);
    $stmt = $pdo->prepare("UPDATE usuarios SET password = :password WHERE id = :id");
    $stmt->execute(['password' => $new_password_hash, 'id' => $userId]);

    echo json_encode(['success' => true]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error en la base de datos: ' . $e->getMessage()]);
}
?>