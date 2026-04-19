<?php
session_start();
header('Content-Type: application/json; charset=utf-8');

if (!isset($_SESSION['user_id']) || !isset($_SESSION['id_negocio'])) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'No autorizado']);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $id = $_POST['id'] ?? '';
    $id_negocio = $_SESSION['id_negocio'];

    if (empty($id)) {
        echo json_encode(['success' => false, 'error' => 'ID no proporcionado']);
        exit;
    }

    require_once __DIR__ . '/conexion.php';

    try {
        $stmt = $pdo->prepare("DELETE FROM turnos WHERE id = :id AND id_negocio = :id_negocio");
        $stmt->execute(['id' => $id, 'id_negocio' => $id_negocio]);
        echo json_encode(['success' => true]);
    } catch (PDOException $e) {
        echo json_encode(['success' => false, 'error' => 'Error al eliminar: ' . $e->getMessage()]);
    }
}
?>