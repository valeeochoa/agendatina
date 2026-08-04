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

// Asegurar tabla notificaciones_admin
try { $pdo->query("SELECT 1 FROM notificaciones_admin LIMIT 1"); } 
catch(Exception $e) { 
    $pdo->exec("CREATE TABLE notificaciones_admin (
        id INT AUTO_INCREMENT PRIMARY KEY, 
        segmento VARCHAR(100), 
        mensaje TEXT, 
        id_negocio INT NULL,
        fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
        leida BOOLEAN DEFAULT FALSE
    )"); 
}

// Asegurar columnas de notificaciones_admin
$cols = [
    'nombre_negocio' => 'VARCHAR(255) DEFAULT NULL',
    'id_usuario' => 'INT NULL',
    'nombre_usuario' => 'VARCHAR(255) DEFAULT NULL',
    'email_usuario' => 'VARCHAR(255) DEFAULT NULL',
    'rol_usuario' => "VARCHAR(50) DEFAULT 'admin'"
];
foreach ($cols as $col => $tipo) {
    try { $pdo->query("SELECT $col FROM notificaciones_admin LIMIT 1"); } 
    catch(Exception $e) { $pdo->exec("ALTER TABLE notificaciones_admin ADD COLUMN $col $tipo"); }
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    try {
        $stmt = $pdo->query("
            SELECT n.id, n.segmento, n.mensaje, n.id_negocio, n.nombre_negocio, n.id_usuario, n.nombre_usuario, n.email_usuario, n.rol_usuario, n.fecha, n.leida, neg.nombre_fantasia, neg.ruta 
            FROM notificaciones_admin n
            LEFT JOIN negocios neg ON n.id_negocio = neg.id
            ORDER BY n.fecha DESC
            LIMIT 100
        ");
        $notifs = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $unreadCount = 0;
        foreach ($notifs as $n) {
            if (!$n['leida']) $unreadCount++;
        }

        echo json_encode([
            'success' => true,
            'unread_count' => $unreadCount,
            'data' => $notifs
        ]);
    } catch (Exception $e) {
        echo json_encode(['success' => false, 'error' => 'Error al cargar notificaciones: ' . $e->getMessage()]);
    }

} elseif ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true) ?: $_POST;
    $action = $input['action'] ?? '';
    $id = (int)($input['id'] ?? 0);

    try {
        if ($action === 'mark_read' && $id > 0) {
            $stmt = $pdo->prepare("UPDATE notificaciones_admin SET leida = 1 WHERE id = ?");
            $stmt->execute([$id]);
            echo json_encode(['success' => true]);

        } elseif ($action === 'mark_all_read') {
            $pdo->exec("UPDATE notificaciones_admin SET leida = 1");
            echo json_encode(['success' => true]);

        } elseif ($action === 'delete' && $id > 0) {
            $stmt = $pdo->prepare("DELETE FROM notificaciones_admin WHERE id = ?");
            $stmt->execute([$id]);
            echo json_encode(['success' => true]);

        } else {
            echo json_encode(['success' => false, 'error' => 'Acción no válida.']);
        }
    } catch (Exception $e) {
        echo json_encode(['success' => false, 'error' => 'Error al procesar: ' . $e->getMessage()]);
    }
}
?>
