<?php
session_start();
header('Content-Type: application/json; charset=utf-8');

// Verificar sesión de admin/propietario
if (!isset($_SESSION['user_id']) || !isset($_SESSION['id_negocio'])) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Acceso no autorizado. Inicia sesión.']);
    exit;
}

$id_negocio = $_SESSION['id_negocio'];

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método no permitido.']);
    exit;
}

$id = $_POST['id'] ?? '';

if (empty($id)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'ID no proporcionado.']);
    exit;
}

require_once __DIR__ . '/conexion.php';

try {
    // Actualizar el estado a 'eliminado' (para que aparezca en la Papelera)
    // y registrar la fecha de eliminación. Verificar que pertenezca al negocio.
    $stmt = $pdo->prepare(
        "UPDATE turnos SET estado = 'eliminado', fecha_eliminado = NOW() 
         WHERE id = :id AND id_negocio = :id_negocio"
    );
    $stmt->execute(['id' => $id, 'id_negocio' => $id_negocio]);

    if ($stmt->rowCount() > 0) {
        echo json_encode(['success' => true]);
    } else {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'No se encontró el turno o no tienes permiso para eliminarlo.']);
    }
    exit;

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error de base de datos: ' . $e->getMessage()]);
    exit;
}