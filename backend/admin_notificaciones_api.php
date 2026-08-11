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
        // Auto-reparación: Corregir prefijo de notificaciones creadas anteriormente como Sugerencia para módulos de error
        try {
            $pdo->exec("UPDATE notificaciones_admin 
                        SET segmento = REPLACE(segmento, 'Sugerencia / Mejora:', 'Reporte de Error:') 
                        WHERE segmento LIKE 'Sugerencia / Mejora:%' 
                        AND (segmento LIKE '%Calendario%' OR segmento LIKE '%Agenda%' OR segmento LIKE '%Ajustes%' OR segmento LIKE '%Equipo%' OR segmento LIKE '%Editor%' OR segmento LIKE '%Servicios%')");
        } catch(Exception $eFixN) {}

        $stmt = $pdo->query("
            SELECT n.id, n.segmento, n.mensaje, n.id_negocio, n.nombre_negocio, n.id_usuario, n.nombre_usuario, n.email_usuario, n.rol_usuario, n.fecha, n.leida, neg.nombre_fantasia, neg.ruta 
            FROM notificaciones_admin n
            LEFT JOIN negocios neg ON n.id_negocio = neg.id
            ORDER BY n.fecha DESC
            LIMIT 100
        ");
        $notifs = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // 1. Notificaciones no leídas totales
        $unreadTotal = 0;
        foreach ($notifs as $n) {
            if (empty($n['leida'])) $unreadTotal++;
        }

        // 2. Reportes de Error pendientes
        $stmtRep = $pdo->query("SELECT COUNT(*) FROM reportes_error WHERE estado = 'pendiente' AND (tipo IS NULL OR tipo = '' OR tipo = 'Reporte de Error')");
        $repCount = (int)($stmtRep ? $stmtRep->fetchColumn() : 0);
        
        $stmtNotifErr = $pdo->query("SELECT COUNT(*) FROM notificaciones_admin WHERE leida = 0 AND (segmento LIKE '%Error%' OR segmento LIKE '%Bug%' OR segmento LIKE '%Calendario%' OR segmento LIKE '%Agenda%' OR segmento LIKE '%Ajustes%' OR segmento LIKE '%Equipo%' OR segmento LIKE '%Editor%' OR segmento LIKE '%Servicios%')");
        $notifErrCount = (int)($stmtNotifErr ? $stmtNotifErr->fetchColumn() : 0);
        $reportesCount = max($repCount, $notifErrCount);

        // 3. Sugerencias / Mejoras
        $stmtMej = $pdo->query("SELECT COUNT(*) FROM notificaciones_admin WHERE leida = 0 AND (segmento LIKE '%Sugerencia%' OR segmento LIKE '%Mejora%')");
        $mejorasCount = (int)($stmtMej ? $stmtMej->fetchColumn() : 0);

        // 4. Comprobantes de pago pendientes de revisión
        $stmtComp = $pdo->query("SELECT COUNT(*) FROM negocios WHERE estado_pago = 'pendiente_revision'");
        $comprobantesCount = (int)($stmtComp ? $stmtComp->fetchColumn() : 0);

        // 5. Tareas pendientes
        $tareasCount = 0;
        try {
            $stmtTar = $pdo->query("SELECT COUNT(*) FROM admin_tareas WHERE completada = 0");
            $tareasCount = (int)($stmtTar ? $stmtTar->fetchColumn() : 0);
        } catch(Exception $eT) {}

        echo json_encode([
            'success' => true,
            'unread_count' => $unreadTotal,
            'counts' => [
                'reportes' => $reportesCount,
                'mejoras' => $mejorasCount,
                'comprobantes' => $comprobantesCount,
                'tareas' => $tareasCount,
                'notificaciones' => $unreadTotal
            ],
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
