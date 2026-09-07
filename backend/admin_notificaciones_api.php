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

// Asegurar id_reporte en notificaciones_admin
try { $pdo->query("SELECT id_reporte FROM notificaciones_admin LIMIT 1"); } 
catch(Exception $e) { $pdo->exec("ALTER TABLE notificaciones_admin ADD COLUMN id_reporte INT NULL"); }

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

        // Auto-sincronización: Marcar leídas las notificaciones correspondientes a reportes ya resueltos o eliminados
        try {
            $pdo->exec("UPDATE notificaciones_admin na 
                        INNER JOIN reportes_error r ON (na.id_reporte = r.id OR (na.mensaje IS NOT NULL AND na.mensaje != '' AND na.mensaje = r.descripcion)) 
                        SET na.leida = 1 
                        WHERE r.estado IN ('resuelto', 'eliminado') AND (na.leida = 0 OR na.leida IS NULL)");
        } catch(Exception $eSync) {}

        $stmt = $pdo->query("
            SELECT n.id, n.id_reporte, n.segmento, n.mensaje, n.id_negocio, n.nombre_negocio, n.id_usuario, n.nombre_usuario, n.email_usuario, n.rol_usuario, n.fecha, n.leida, neg.nombre_fantasia, neg.ruta 
            FROM notificaciones_admin n
            LEFT JOIN negocios neg ON n.id_negocio = neg.id
            ORDER BY n.fecha DESC
            LIMIT 100
        ");
        $notifs = $stmt->fetchAll(PDO::FETCH_ASSOC);

        foreach ($notifs as &$nItem) {
            $nItem['leida'] = (int)($nItem['leida'] ?? 0);
            if (empty($nItem['id_reporte']) && !empty($nItem['id_negocio'])) {
                $stmtFind = $pdo->prepare("SELECT id FROM reportes_error WHERE id_negocio = ? ORDER BY id DESC LIMIT 1");
                $stmtFind->execute([$nItem['id_negocio']]);
                $foundId = $stmtFind->fetchColumn();
                if ($foundId) {
                    $nItem['id_reporte'] = (int)$foundId;
                }
            }
        }
        unset($nItem);

        // 1. Notificaciones no leídas totales
        $unreadTotal = 0;
        foreach ($notifs as $n) {
            if (empty($n['leida']) || $n['leida'] == 0) $unreadTotal++;
        }

        // 2. Reportes de Error pendientes reales en reportes_error
        $stmtRep = $pdo->query("SELECT COUNT(*) FROM reportes_error WHERE estado = 'pendiente' AND (tipo IS NULL OR tipo = '' OR tipo = 'Reporte de Error')");
        $repCount = (int)($stmtRep ? $stmtRep->fetchColumn() : 0);
        
        // Contar notificaciones de error sólo si el reporte subyacente no está resuelto ni eliminado
        $stmtNotifErr = $pdo->query("
            SELECT COUNT(*) 
            FROM notificaciones_admin na
            LEFT JOIN reportes_error r ON (na.id_reporte = r.id OR (na.mensaje IS NOT NULL AND na.mensaje != '' AND na.mensaje = r.descripcion))
            WHERE (na.leida = 0 OR na.leida IS NULL) 
              AND (na.segmento IS NULL OR (
                  na.segmento NOT LIKE '%Sugerencia%'
                  AND na.segmento NOT LIKE '%Mejora%'
                  AND na.segmento NOT LIKE '%Nuevo Registro%'
                  AND na.segmento NOT LIKE '%Nuevo Profesional%'
                  AND na.segmento NOT LIKE '%Registro%'
                  AND na.segmento NOT LIKE '%Comprobante%'
                  AND na.segmento NOT LIKE '%Seguridad%'
                  AND na.segmento NOT LIKE '%Enlace Web%'
              ))
              AND (na.mensaje IS NULL OR (
                  na.mensaje NOT LIKE '%Nuevo emprendedor registrado%'
                  AND na.mensaje NOT LIKE '%Nuevo profesional registrado%'
              ))
              AND (r.estado IS NULL OR r.estado = 'pendiente')
        ");
        $notifErrCount = (int)($stmtNotifErr ? $stmtNotifErr->fetchColumn() : 0);
        $reportesCount = max($repCount, $notifErrCount);

        // 3. Sugerencias / Mejoras
        $stmtMej = $pdo->query("
            SELECT COUNT(*) 
            FROM notificaciones_admin na
            LEFT JOIN reportes_error r ON (na.id_reporte = r.id OR (na.mensaje IS NOT NULL AND na.mensaje != '' AND na.mensaje = r.descripcion))
            WHERE (na.leida = 0 OR na.leida IS NULL) 
              AND (na.segmento LIKE '%Sugerencia%' OR na.segmento LIKE '%Mejora%')
              AND (r.estado IS NULL OR r.estado = 'pendiente')
        ");
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
            // Obtener notificación para sincronizar reporte de error si corresponde
            $stmtN = $pdo->prepare("SELECT id_reporte, mensaje FROM notificaciones_admin WHERE id = ?");
            $stmtN->execute([$id]);
            $notifData = $stmtN->fetch(PDO::FETCH_ASSOC);

            $stmt = $pdo->prepare("UPDATE notificaciones_admin SET leida = 1 WHERE id = ?");
            $stmt->execute([$id]);

            if ($notifData) {
                $idRep = (int)($notifData['id_reporte'] ?? 0);
                $msg = trim($notifData['mensaje'] ?? '');
                if ($idRep > 0) {
                    $pdo->prepare("UPDATE reportes_error SET estado = 'resuelto', fecha_resuelto = NOW() WHERE id = ? AND estado = 'pendiente'")->execute([$idRep]);
                } elseif (!empty($msg)) {
                    $pdo->prepare("UPDATE reportes_error SET estado = 'resuelto', fecha_resuelto = NOW() WHERE descripcion = ? AND estado = 'pendiente'")->execute([$msg]);
                }
            }

            echo json_encode(['success' => true]);

        } elseif ($action === 'mark_unread' && $id > 0) {
            $stmt = $pdo->prepare("UPDATE notificaciones_admin SET leida = 0 WHERE id = ?");
            $stmt->execute([$id]);
            echo json_encode(['success' => true]);

        } elseif ($action === 'toggle_read' && $id > 0) {
            $stmtN = $pdo->prepare("SELECT leida FROM notificaciones_admin WHERE id = ?");
            $stmtN->execute([$id]);
            $curr = (int)($stmtN->fetchColumn() ?: 0);
            $newVal = ($curr === 1) ? 0 : 1;

            $stmt = $pdo->prepare("UPDATE notificaciones_admin SET leida = ? WHERE id = ?");
            $stmt->execute([$newVal, $id]);
            echo json_encode(['success' => true, 'leida' => $newVal]);

        } elseif ($action === 'mark_all_read') {
            $pdo->exec("UPDATE notificaciones_admin SET leida = 1");
            try {
                $pdo->exec("UPDATE reportes_error SET estado = 'resuelto', fecha_resuelto = NOW() WHERE estado = 'pendiente'");
            } catch(Exception $eS) {}
            echo json_encode(['success' => true]);

        } elseif ($action === 'delete' && $id > 0) {
            // Sincronización: Al eliminar la notificación, también marcar como eliminado el reporte en reportes_error
            $stmtN = $pdo->prepare("SELECT id_reporte, mensaje FROM notificaciones_admin WHERE id = ?");
            $stmtN->execute([$id]);
            $notifData = $stmtN->fetch(PDO::FETCH_ASSOC);

            if ($notifData) {
                $idRep = (int)($notifData['id_reporte'] ?? 0);
                $msg = trim($notifData['mensaje'] ?? '');

                try {
                    $pdo->exec("ALTER TABLE reportes_error ADD COLUMN fecha_eliminado DATETIME DEFAULT NULL");
                } catch(Exception $eCol) {}

                if ($idRep > 0) {
                    $pdo->prepare("UPDATE reportes_error SET estado = 'eliminado', fecha_eliminado = NOW() WHERE id = ?")->execute([$idRep]);
                }
                if (!empty($msg)) {
                    $pdo->prepare("UPDATE reportes_error SET estado = 'eliminado', fecha_eliminado = NOW() WHERE descripcion = ?")->execute([$msg]);
                }
            }

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
