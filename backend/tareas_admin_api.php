<?php
session_start();
header('Content-Type: application/json; charset=utf-8');

if (!isset($_SESSION['is_superadmin']) || $_SESSION['is_superadmin'] !== true) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Acceso denegado. Se requiere cuenta de Super Admin.']);
    exit;
}

require_once __DIR__ . '/conexion.php';

// Auto-crear tabla de tareas administrativas
try {
    $pdo->exec("CREATE TABLE IF NOT EXISTS `admin_tareas` (
        `id` INT AUTO_INCREMENT PRIMARY KEY,
        `tarea` TEXT NOT NULL,
        `estado` VARCHAR(20) DEFAULT 'pendiente',
        `fecha_creacion` DATETIME DEFAULT CURRENT_TIMESTAMP,
        `fecha_cumplimiento` DATETIME DEFAULT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    // Limpieza automática de tareas completadas hace más de 30 días
    $pdo->exec("DELETE FROM admin_tareas WHERE estado = 'completada' AND fecha_cumplimiento IS NOT NULL AND DATEDIFF(NOW(), fecha_cumplimiento) > 30");
} catch(Exception $e) {}

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    try {
        $stmt = $pdo->query("SELECT id, tarea, estado, fecha_creacion, fecha_cumplimiento FROM admin_tareas ORDER BY estado ASC, fecha_creacion DESC");
        $tareas = $stmt ? $stmt->fetchAll(PDO::FETCH_ASSOC) : [];
        echo json_encode(['success' => true, 'data' => $tareas]);
    } catch(Exception $e) {
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
    exit;
}

if ($method === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true) ?: $_POST;
    $tarea = trim($data['tarea'] ?? '');

    if (empty($tarea)) {
        echo json_encode(['success' => false, 'error' => 'El texto de la tarea no puede estar vacío.']);
        exit;
    }

    try {
        $stmt = $pdo->prepare("INSERT INTO admin_tareas (tarea, estado, fecha_creacion) VALUES (?, 'pendiente', NOW())");
        $stmt->execute([$tarea]);
        echo json_encode(['success' => true, 'id' => $pdo->lastInsertId()]);
    } catch(Exception $e) {
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
    exit;
}

if ($method === 'PUT') {
    $data = json_decode(file_get_contents('php://input'), true);
    $id = (int)($data['id'] ?? 0);
    $estado = trim($data['estado'] ?? 'pendiente');

    if (!$id) {
        echo json_encode(['success' => false, 'error' => 'Falta el ID de la tarea.']);
        exit;
    }

    try {
        if ($estado === 'completada') {
            $stmt = $pdo->prepare("UPDATE admin_tareas SET estado = 'completada', fecha_cumplimiento = NOW() WHERE id = ?");
        } else {
            $stmt = $pdo->prepare("UPDATE admin_tareas SET estado = 'pendiente', fecha_cumplimiento = NULL WHERE id = ?");
        }
        $stmt->execute([$id]);
        echo json_encode(['success' => true]);
    } catch(Exception $e) {
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
    exit;
}

if ($method === 'DELETE') {
    $id = (int)($_GET['id'] ?? 0);
    if (!$id) {
        $data = json_decode(file_get_contents('php://input'), true);
        $id = (int)($data['id'] ?? 0);
    }

    if (!$id) {
        echo json_encode(['success' => false, 'error' => 'ID de tarea no proporcionado.']);
        exit;
    }

    try {
        $stmt = $pdo->prepare("DELETE FROM admin_tareas WHERE id = ?");
        $stmt->execute([$id]);
        echo json_encode(['success' => true]);
    } catch(Exception $e) {
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
    exit;
}
?>
