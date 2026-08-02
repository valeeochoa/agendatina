<?php
session_start();
header('Content-Type: application/json; charset=utf-8');

// Seguridad: Verificar sesión de SuperAdmin
if (!isset($_SESSION['admin_logged_in']) && !isset($_SESSION['is_superadmin'])) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Acceso denegado. Se requiere sesión de SuperAdmin.']);
    exit;
}

require_once __DIR__ . '/conexion.php';

// Asegurar tabla reportes_error
try {
    $pdo->query("SELECT 1 FROM reportes_error LIMIT 1");
} catch (Exception $e) {
    $pdo->exec("CREATE TABLE reportes_error (
        id INT AUTO_INCREMENT PRIMARY KEY,
        id_negocio INT NULL,
        nombre_negocio VARCHAR(255) DEFAULT NULL,
        id_usuario INT NULL,
        nombre_usuario VARCHAR(255) DEFAULT NULL,
        email_usuario VARCHAR(255) DEFAULT NULL,
        modulo VARCHAR(100) DEFAULT 'General',
        descripcion TEXT,
        estado VARCHAR(50) DEFAULT 'pendiente',
        fecha DATETIME DEFAULT CURRENT_TIMESTAMP
    )");
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    try {
        $stmt = $pdo->query("
            SELECT r.id, r.id_negocio, r.nombre_negocio, r.nombre_usuario, r.email_usuario, r.modulo, r.descripcion, r.estado, r.fecha, n.ruta
            FROM reportes_error r
            LEFT JOIN negocios n ON r.id_negocio = n.id
            WHERE r.estado != 'eliminado'
            ORDER BY r.fecha DESC
        ");
        $reportes = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $pendientes = 0;
        foreach ($reportes as $rep) {
            if ($rep['estado'] === 'pendiente') $pendientes++;
        }

        echo json_encode([
            'success' => true,
            'pendientes_count' => $pendientes,
            'data' => $reportes
        ]);
    } catch (Exception $e) {
        echo json_encode(['success' => false, 'error' => 'Error al cargar reportes: ' . $e->getMessage()]);
    }

} elseif ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true) ?: $_POST;
    $action = $input['action'] ?? '';
    $id = (int)($input['id'] ?? 0);

    try {
        if ($action === 'resolver' && $id > 0) {
            $stmt = $pdo->prepare("UPDATE reportes_error SET estado = 'resuelto' WHERE id = ?");
            $stmt->execute([$id]);
            echo json_encode(['success' => true, 'message' => 'Reporte marcado como resuelto.']);

        } elseif ($action === 'eliminar' && $id > 0) {
            $stmt = $pdo->prepare("UPDATE reportes_error SET estado = 'eliminado' WHERE id = ?");
            $stmt->execute([$id]);
            echo json_encode(['success' => true, 'message' => 'Reporte descartado.']);

        } else {
            echo json_encode(['success' => false, 'error' => 'Acción no reconocida.']);
        }
    } catch (Exception $e) {
        echo json_encode(['success' => false, 'error' => 'Error en operación: ' . $e->getMessage()]);
    }
}
?>
