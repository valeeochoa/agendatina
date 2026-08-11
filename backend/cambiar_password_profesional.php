<?php
// backend/cambiar_password_profesional.php
session_start();
header('Content-Type: application/json; charset=utf-8');

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'error' => 'Sesión no iniciada']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
$nuevaPassword = trim($input['nueva_password'] ?? '');

if (strlen($nuevaPassword) < 6) {
    echo json_encode(['success' => false, 'error' => 'La contraseña debe tener al menos 6 caracteres']);
    exit;
}

require_once __DIR__ . '/conexion.php';

try {
    $id_usuario = (int)$_SESSION['user_id'];
    $hash = password_hash($nuevaPassword, PASSWORD_BCRYPT);
    
    // Auto-migración columna debe_cambiar_pass
    try { $pdo->query("SELECT debe_cambiar_pass FROM usuarios LIMIT 1"); } 
    catch(Exception $e) { try { $pdo->exec("ALTER TABLE usuarios ADD COLUMN debe_cambiar_pass TINYINT DEFAULT 0"); } catch(Exception $e2) {} }

    $stmt = $pdo->prepare("UPDATE usuarios SET password = :hash, debe_cambiar_pass = 0 WHERE id = :id");
    $stmt->execute(['hash' => $hash, 'id' => $id_usuario]);

    $_SESSION['must_change_password'] = false;

    echo json_encode(['success' => true, 'mensaje' => 'Contraseña actualizada exitosamente']);
} catch(Exception $ex) {
    echo json_encode(['success' => false, 'error' => 'Error en base de datos: ' . $ex->getMessage()]);
}
