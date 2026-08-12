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
$reportesCols = [
    'nombre_negocio' => 'VARCHAR(255) DEFAULT NULL',
    'id_usuario' => 'INT NULL',
    'nombre_usuario' => 'VARCHAR(255) DEFAULT NULL',
    'email_usuario' => 'VARCHAR(255) DEFAULT NULL',
    'rol_usuario' => "VARCHAR(50) DEFAULT 'admin'",
    'tipo' => "VARCHAR(50) DEFAULT 'Reporte de Error'"
];
foreach ($reportesCols as $col => $tipo) {
    try { $pdo->query("SELECT $col FROM reportes_error LIMIT 1"); } 
    catch(Exception $e) { $pdo->exec("ALTER TABLE reportes_error ADD COLUMN $col $tipo"); }
}

// Asegurar tabla mensajes_soporte
try {
    $pdo->query("SELECT 1 FROM mensajes_soporte LIMIT 1");
} catch (Exception $e) {
    $pdo->exec("CREATE TABLE mensajes_soporte (
        id INT AUTO_INCREMENT PRIMARY KEY,
        id_reporte INT NOT NULL,
        id_negocio INT NOT NULL,
        emisor VARCHAR(20) NOT NULL DEFAULT 'admin',
        nombre_emisor VARCHAR(255) DEFAULT 'Soporte Agendatina',
        mensaje TEXT NOT NULL,
        fecha DATETIME DEFAULT CURRENT_TIMESTAMP
    )");
}

// Asegurar id_reporte en notificaciones
try { $pdo->query("SELECT id_reporte FROM notificaciones LIMIT 1"); } 
catch(Exception $e) { $pdo->exec("ALTER TABLE notificaciones ADD COLUMN id_reporte INT NULL"); }

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    if (isset($_GET['action']) && $_GET['action'] === 'obtener_mensajes' && !empty($_GET['id_reporte'])) {
        $idRep = (int)$_GET['id_reporte'];
        $stmtM = $pdo->prepare("SELECT * FROM mensajes_soporte WHERE id_reporte = ? ORDER BY fecha ASC");
        $stmtM->execute([$idRep]);
        $msgs = $stmtM->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode(['success' => true, 'data' => $msgs]);
        exit;
    }

    try {
        // Auto-reparación: Corregir tipo para reportes cuyos módulos no son sugerencias/mejoras
        try {
            $pdo->exec("UPDATE reportes_error SET tipo = 'Reporte de Error' WHERE modulo NOT LIKE '%Sugerencia%' AND modulo NOT LIKE '%Mejora%' AND (tipo IS NULL OR tipo = '' OR tipo = 'Sugerencia / Mejora')");
        } catch(Exception $eFix) {}

        $stmt = $pdo->query("
            SELECT r.id, r.id_negocio, r.nombre_negocio, r.id_usuario, r.nombre_usuario, r.email_usuario, r.rol_usuario, r.tipo, r.modulo, r.descripcion, COALESCE(r.estado, 'pendiente') AS estado, r.fecha, n.ruta
            FROM reportes_error r
            LEFT JOIN negocios n ON r.id_negocio = n.id
            WHERE r.estado != 'eliminado'
            ORDER BY r.fecha DESC
        ");
        $reportes = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // También incluir notificaciones de notificaciones_admin (solo reportes de error o sugerencias enviadas)
        try {
            $stmtNotif = $pdo->query("
                SELECT id, id_negocio, nombre_negocio, id_usuario, nombre_usuario, email_usuario, rol_usuario, 
                       CASE 
                           WHEN segmento LIKE '%Error%' OR segmento LIKE '%Bug%' THEN 'Reporte de Error'
                           ELSE 'Sugerencia / Mejora'
                       END AS tipo, 
                       segmento AS modulo, mensaje AS descripcion, 'pendiente' AS estado, fecha
                FROM notificaciones_admin
                WHERE (segmento LIKE '%Error%' OR segmento LIKE '%Bug%' OR segmento LIKE '%Sugerencia%' OR segmento LIKE '%Mejora%' OR segmento LIKE '%Soporte%')
                  AND segmento NOT LIKE '%Nuevo Profesional%'
                  AND segmento NOT LIKE '%Seguridad%'
                  AND segmento NOT LIKE '%Enlace Web%'
                ORDER BY fecha DESC
            ");
            $notifItems = $stmtNotif->fetchAll(PDO::FETCH_ASSOC);
            foreach ($notifItems as $ni) {
                $exists = false;
                foreach ($reportes as $r) {
                    if (trim($r['descripcion']) === trim($ni['descripcion'])) {
                        $exists = true;
                        break;
                    }
                }
                if (!$exists) {
                    $reportes[] = $ni;
                }
            }
        } catch (Exception $eN) {}

        $pendientes = 0;
        foreach ($reportes as $rep) {
            $isMejora = ($rep['tipo'] && (strpos($rep['tipo'], 'Mejora') !== false || strpos($rep['tipo'], 'Sugerencia') !== false)) ||
                        ($rep['modulo'] && (strpos($rep['modulo'], 'Mejora') !== false || strpos($rep['modulo'], 'Sugerencia') !== false));
            if (!$isMejora && ($rep['estado'] ?? 'pendiente') === 'pendiente') {
                $pendientes++;
            }
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
    $nuevo_estado = trim($input['estado'] ?? '');

    try {
        if ($action === 'responder' && $id > 0) {
            $mensaje = trim($input['mensaje'] ?? '');
            $nuevo_estado = trim($input['estado'] ?? 'resuelto');
            if (empty($nuevo_estado)) $nuevo_estado = 'resuelto';

            // Obtener datos del reporte
            $stmtGet = $pdo->prepare("SELECT id_negocio, nombre_negocio, modulo, descripcion FROM reportes_error WHERE id = ?");
            $stmtGet->execute([$id]);
            $rep = $stmtGet->fetch(PDO::FETCH_ASSOC);

            if ($rep) {
                $idNegocio = $rep['id_negocio'];
                
                // Actualizar estado del reporte
                $pdo->prepare("UPDATE reportes_error SET estado = ? WHERE id = ?")->execute([$nuevo_estado, $id]);

                // Marcar leída notificación de admin
                try {
                    if ($rep['descripcion']) {
                        $pdo->prepare("UPDATE notificaciones_admin SET leida = 1 WHERE mensaje = ? OR id = ?")->execute([$rep['descripcion'], $id]);
                    }
                } catch(Exception $eS) {}

                // Guardar mensaje en el hilo mensajes_soporte
                if (!empty($mensaje)) {
                    $pdo->prepare("INSERT INTO mensajes_soporte (id_reporte, id_negocio, emisor, nombre_emisor, mensaje) VALUES (?, ?, 'admin', 'Soporte Agendatina', ?)")
                        ->execute([$id, $idNegocio, $mensaje]);

                    // Notificar al negocio en notificaciones
                    $tituloNotif = ($nuevo_estado === 'resuelto') ? "💬 Soporte Agendatina: Reporte #{$id} Resuelto" : "💬 Soporte Agendatina: Respuesta sobre Reporte #{$id}";
                    $pdo->prepare("INSERT INTO notificaciones (id_negocio, titulo, mensaje, id_reporte) VALUES (?, ?, ?, ?)")
                        ->execute([$idNegocio, $tituloNotif, $mensaje, $id]);
                }

                echo json_encode(['success' => true, 'message' => 'Respuesta enviada y estado actualizado correctamente.']);
            } else {
                echo json_encode(['success' => false, 'error' => 'No se encontró el reporte especificado.']);
            }
            exit;

        } elseif ($action === 'resolver' && $id > 0) {
            $stmt = $pdo->prepare("UPDATE reportes_error SET estado = 'resuelto' WHERE id = ?");
            $stmt->execute([$id]);
            try {
                $stmtGet = $pdo->prepare("SELECT descripcion FROM reportes_error WHERE id = ?");
                $stmtGet->execute([$id]);
                $desc = $stmtGet->fetchColumn();
                if ($desc) {
                    $pdo->prepare("UPDATE notificaciones_admin SET leida = 1 WHERE mensaje = ? OR id = ?")->execute([$desc, $id]);
                } else {
                    $pdo->prepare("UPDATE notificaciones_admin SET leida = 1 WHERE id = ?")->execute([$id]);
                }
            } catch(Exception $eS) {}
            echo json_encode(['success' => true, 'message' => 'Reporte marcado como resuelto.']);

        } elseif ($action === 'marcar_pendiente' && $id > 0) {
            $stmt = $pdo->prepare("UPDATE reportes_error SET estado = 'pendiente' WHERE id = ?");
            $stmt->execute([$id]);
            try {
                $stmtGet = $pdo->prepare("SELECT descripcion FROM reportes_error WHERE id = ?");
                $stmtGet->execute([$id]);
                $desc = $stmtGet->fetchColumn();
                if ($desc) {
                    $pdo->prepare("UPDATE notificaciones_admin SET leida = 0 WHERE mensaje = ? OR id = ?")->execute([$desc, $id]);
                }
            } catch(Exception $eS) {}
            echo json_encode(['success' => true, 'message' => 'Reporte marcado como pendiente.']);

        } elseif ($action === 'cambiar_estado' && $id > 0 && !empty($nuevo_estado)) {
            $stmt = $pdo->prepare("UPDATE reportes_error SET estado = ? WHERE id = ?");
            $stmt->execute([$nuevo_estado, $id]);
            echo json_encode(['success' => true, 'message' => 'Estado actualizado a ' . $nuevo_estado]);

        } elseif ($action === 'eliminar' && $id > 0) {
            $stmt = $pdo->prepare("UPDATE reportes_error SET estado = 'eliminado' WHERE id = ?");
            $stmt->execute([$id]);
            try {
                $stmtGet = $pdo->prepare("SELECT descripcion FROM reportes_error WHERE id = ?");
                $stmtGet->execute([$id]);
                $desc = $stmtGet->fetchColumn();
                if ($desc) {
                    $pdo->prepare("UPDATE notificaciones_admin SET leida = 1 WHERE mensaje = ? OR id = ?")->execute([$desc, $id]);
                } else {
                    $pdo->prepare("UPDATE notificaciones_admin SET leida = 1 WHERE id = ?")->execute([$id]);
                }
            } catch(Exception $eS) {}
            echo json_encode(['success' => true, 'message' => 'Reporte descartado.']);

        } else {
            echo json_encode(['success' => false, 'error' => 'Acción no reconocida.']);
        }
    } catch (Exception $e) {
        echo json_encode(['success' => false, 'error' => 'Error en operación: ' . $e->getMessage()]);
    }
}
?>
