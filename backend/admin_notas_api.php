<?php
session_start();
header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/conexion.php';
require_once __DIR__ . '/admin_auth.php';

// Asegurar que la tabla admin_notas existe
try {
    $pdo->exec("CREATE TABLE IF NOT EXISTS `admin_notas` (
        `id` INT AUTO_INCREMENT PRIMARY KEY,
        `id_negocio` INT NOT NULL,
        `nota` TEXT NOT NULL,
        `fecha` DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX (id_negocio)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");
} catch (Exception $e) {}

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    try {
        $stmt = $pdo->query("
            SELECT an.id, an.id_negocio, n.nombre_fantasia AS nombre_negocio, n.ruta, an.nota, an.fecha
            FROM admin_notas an
            LEFT JOIN negocios n ON an.id_negocio = n.id
            ORDER BY an.fecha DESC
        ");
        $notas = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode([
            'success' => true,
            'data' => $notas
        ]);
    } catch (Exception $e) {
        echo json_encode(['success' => false, 'error' => 'Error al cargar notas: ' . $e->getMessage()]);
    }

} elseif ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true) ?: $_POST;
    $id_negocio = (int)($input['id_negocio'] ?? 0);
    $nota = trim($input['nota'] ?? '');

    if ($id_negocio <= 0 || empty($nota)) {
        echo json_encode(['success' => false, 'error' => 'Negocio y texto de la nota requeridos.']);
        exit;
    }

    try {
        $stmt = $pdo->prepare("INSERT INTO admin_notas (id_negocio, nota, fecha) VALUES (:id_negocio, :nota, NOW())");
        $stmt->execute(['id_negocio' => $id_negocio, 'nota' => $nota]);

        echo json_encode(['success' => true, 'message' => 'Nota administrativa guardada con éxito.']);
    } catch (Exception $e) {
        echo json_encode(['success' => false, 'error' => 'Error al guardar nota: ' . $e->getMessage()]);
    }

} elseif ($method === 'DELETE') {
    $input = json_decode(file_get_contents('php://input'), true) ?: $_GET;
    $id = (int)($input['id'] ?? 0);

    if ($id <= 0) {
        echo json_encode(['success' => false, 'error' => 'ID de nota inválido.']);
        exit;
    }

    try {
        $stmt = $pdo->prepare("DELETE FROM admin_notas WHERE id = ?");
        $stmt->execute([$id]);

        echo json_encode(['success' => true, 'message' => 'Nota eliminada con éxito.']);
    } catch (Exception $e) {
        echo json_encode(['success' => false, 'error' => 'Error al eliminar nota: ' . $e->getMessage()]);
    }
}
?>
