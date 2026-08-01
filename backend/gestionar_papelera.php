<?php
session_start();
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/conexion.php';

if (!isset($_SESSION['id_negocio'])) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Acceso no autorizado.']);
    exit;
}

$id_negocio = $_SESSION['id_negocio'];
$method = $_SERVER['REQUEST_METHOD'];

// Asegurar columnas de papelera
try { $pdo->query("SELECT fecha_eliminado FROM turnos LIMIT 1"); } 
catch(Exception $e) { $pdo->exec("ALTER TABLE turnos ADD COLUMN fecha_eliminado DATETIME DEFAULT NULL"); }

if ($method === 'GET') {
    // Obtener todos los turnos en la papelera
    try {
        $stmt = $pdo->prepare("
            SELECT id, cliente_nombre, nombre, apellido, cliente_celular, celular, fecha, hora, servicio, profesional, estado, fecha_eliminado 
            FROM turnos 
            WHERE id_negocio = :id AND (estado IN ('cancelado', 'eliminado') OR fecha_eliminado IS NOT NULL)
            ORDER BY fecha_eliminado DESC
        ");
        $stmt->execute(['id' => $id_negocio]);
        $trash = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode(['success' => true, 'data' => $trash]);
    } catch (Exception $e) {
        echo json_encode(['success' => false, 'error' => 'Error al obtener la papelera.']);
    }
} elseif ($method === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true) ?: $_POST;
    $action = $data['action'] ?? '';
    $id = (int)($data['id'] ?? 0);

    try {
        if ($action === 'move_to_trash' && $id > 0) {
            $stmt = $pdo->prepare("UPDATE turnos SET estado = 'cancelado', fecha_eliminado = NOW() WHERE id = :id AND id_negocio = :id_n");
            $stmt->execute(['id' => $id, 'id_n' => $id_negocio]);
            echo json_encode(['success' => true, 'message' => 'Turno movido a la papelera.']);

        } elseif ($action === 'restore' && $id > 0) {
            $stmt = $pdo->prepare("UPDATE turnos SET estado = 'confirmado', fecha_eliminado = NULL WHERE id = :id AND id_negocio = :id_n");
            $stmt->execute(['id' => $id, 'id_n' => $id_negocio]);
            echo json_encode(['success' => true, 'message' => 'Turno restaurado con éxito.']);

        } elseif ($action === 'delete_permanent' && $id > 0) {
            $stmt = $pdo->prepare("DELETE FROM turnos WHERE id = :id AND id_negocio = :id_n");
            $stmt->execute(['id' => $id, 'id_n' => $id_negocio]);
            echo json_encode(['success' => true, 'message' => 'Turno eliminado permanentemente.']);

        } elseif ($action === 'empty_trash') {
            $stmt = $pdo->prepare("DELETE FROM turnos WHERE id_negocio = :id_n AND (estado IN ('cancelado', 'eliminado') OR fecha_eliminado IS NOT NULL)");
            $stmt->execute(['id_n' => $id_negocio]);
            echo json_encode(['success' => true, 'message' => 'Papelera vaciada por completo.']);

        } else {
            echo json_encode(['success' => false, 'error' => 'Acción no válida.']);
        }
    } catch (Exception $e) {
        echo json_encode(['success' => false, 'error' => 'Error al procesar la papelera: ' . $e->getMessage()]);
    }
}
?>
