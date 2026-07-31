<?php
session_start();
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/conexion.php';

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'error' => 'No autorizado. Inicia sesión.']);
    exit;
}

$id_usuario = $_SESSION['user_id'];
$data = json_decode(file_get_contents('php://input'), true) ?: $_POST;
$codigo = trim($data['codigo'] ?? '');

if (empty($codigo)) {
    echo json_encode(['success' => false, 'error' => 'Por favor ingresa el código de 6 dígitos.']);
    exit;
}

try {
    $stmt = $pdo->prepare("SELECT codigo_verificacion, verificacion_expira, email_verificado FROM usuarios WHERE id = ?");
    $stmt->execute([$id_usuario]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user) {
        echo json_encode(['success' => false, 'error' => 'Usuario no encontrado.']);
        exit;
    }

    if ((int)$user['email_verificado'] === 1) {
        echo json_encode(['success' => true, 'message' => 'Tu cuenta ya se encuentra verificada.']);
        exit;
    }

    if (trim($user['codigo_verificacion']) !== $codigo) {
        echo json_encode(['success' => false, 'error' => 'El código ingresado es incorrecto.']);
        exit;
    }

    if ($user['verificacion_expira'] && strtotime($user['verificacion_expira']) < time()) {
        echo json_encode(['success' => false, 'error' => 'El código ha expirado (validez de 15 minutos). Solicita uno nuevo.']);
        exit;
    }

    $update = $pdo->prepare("UPDATE usuarios SET email_verificado = 1, codigo_verificacion = NULL, verificacion_expira = NULL WHERE id = ?");
    $update->execute([$id_usuario]);

    echo json_encode(['success' => true, 'message' => '¡Cuenta verificada con éxito!']);
} catch (Exception $e) {
    echo json_encode(['success' => false, 'error' => 'Error al verificar: ' . $e->getMessage()]);
}
?>
