<?php
session_start();
header('Content-Type: application/json; charset=utf-8');

// Seguridad: Verificar sesión de SuperAdmin
if ((!isset($_SESSION['is_superadmin']) || $_SESSION['is_superadmin'] !== true) && (!isset($_SESSION['admin_logged_in']) || $_SESSION['admin_logged_in'] !== true)) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Acceso denegado. Se requiere sesión de SuperAdmin.']);
    exit;
}

require_once __DIR__ . '/conexion.php';

// Asegurar columna fecha_eliminado en la tabla negocios
try { $pdo->query("SELECT fecha_eliminado FROM negocios LIMIT 1"); } 
catch(Exception $e) { $pdo->exec("ALTER TABLE negocios ADD COLUMN fecha_eliminado DATETIME DEFAULT NULL"); }

// Asegurar tabla notificaciones_admin o reportes si aplica
try { $pdo->query("SELECT fecha_eliminado FROM notificaciones_admin LIMIT 1"); } 
catch(Exception $e) { $pdo->exec("ALTER TABLE notificaciones_admin ADD COLUMN fecha_eliminado DATETIME DEFAULT NULL"); }

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    try {
        // 1. Empresas eliminadas
        $stmtEmpresas = $pdo->query("
            SELECT n.id, n.nombre_fantasia, n.ruta, n.plan, n.estado_pago, n.fecha_alta, n.fecha_eliminado, u.email, u.nombre_completo 
            FROM negocios n 
            LEFT JOIN personal_negocio pn ON n.id = pn.id_negocio AND pn.rol_en_local = 'admin'
            LEFT JOIN usuarios u ON pn.id_usuario = u.id
            WHERE n.estado_pago = 'eliminado' OR n.fecha_eliminado IS NOT NULL
            ORDER BY n.fecha_eliminado DESC
        ");
        $empresasEliminadas = $stmtEmpresas->fetchAll(PDO::FETCH_ASSOC);

        // 2. Reportes de error eliminados
        $reportesEliminados = [];
        try {
            $stmtRep = $pdo->query("
                SELECT id, modulo, descripcion, cliente_email, estado, fecha 
                FROM reportes_error 
                WHERE estado = 'eliminado' 
                ORDER BY fecha DESC
            ");
            $reportesEliminados = $stmtRep->fetchAll(PDO::FETCH_ASSOC);
        } catch(Exception $eRep) {}

        // 3. Comprobantes archivados / rechazados
        $comprobantesEliminados = [];
        try {
            $stmtComp = $pdo->query("
                SELECT id, nombre_fantasia, ruta, plan, comprobante, estado_pago, fecha_alta 
                FROM negocios 
                WHERE estado_pago = 'rechazado'
            ");
            $comprobantesEliminados = $stmtComp->fetchAll(PDO::FETCH_ASSOC);
        } catch(Exception $eComp) {}

        echo json_encode([
            'success' => true,
            'empresas' => $empresasEliminadas,
            'reportes' => $reportesEliminados,
            'comprobantes' => $comprobantesEliminados
        ]);
    } catch (Exception $e) {
        echo json_encode(['success' => false, 'error' => 'Error al cargar la papelera: ' . $e->getMessage()]);
    }

} elseif ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true) ?: $_POST;
    $action = $input['action'] ?? '';
    $id = (int)($input['id'] ?? 0);

    try {
        if ($action === 'delete_empresa' && $id > 0) {
            $stmt = $pdo->prepare("UPDATE negocios SET estado_pago = 'eliminado', fecha_eliminado = NOW() WHERE id = ?");
            $stmt->execute([$id]);
            echo json_encode(['success' => true, 'message' => 'Empresa enviada a la papelera general.']);

        } elseif ($action === 'restore_empresa' && $id > 0) {
            $stmt = $pdo->prepare("UPDATE negocios SET estado_pago = 'prueba', fecha_eliminado = NULL WHERE id = ?");
            $stmt->execute([$id]);
            echo json_encode(['success' => true, 'message' => 'Empresa restaurada exitosamente.']);

        } elseif ($action === 'purge_empresa' && $id > 0) {
            // Eliminar registros asociados en cascada
            $pdo->prepare("DELETE FROM turnos WHERE id_negocio = ?")->execute([$id]);
            $pdo->prepare("DELETE FROM servicios WHERE id_negocio = ?")->execute([$id]);
            $pdo->prepare("DELETE FROM configuracion_web WHERE id_negocio = ?")->execute([$id]);
            $pdo->prepare("DELETE FROM personal_negocio WHERE id_negocio = ?")->execute([$id]);
            $pdo->prepare("DELETE FROM negocios WHERE id = ?")->execute([$id]);
            echo json_encode(['success' => true, 'message' => 'Empresa eliminada definitivamente.']);

        } elseif ($action === 'restore_reporte' && $id > 0) {
            $pdo->prepare("UPDATE reportes_error SET estado = 'pendiente' WHERE id = ?")->execute([$id]);
            echo json_encode(['success' => true, 'message' => 'Reporte restaurado a pendiente.']);

        } elseif ($action === 'purge_reporte' && $id > 0) {
            $pdo->prepare("DELETE FROM reportes_error WHERE id = ?")->execute([$id]);
            echo json_encode(['success' => true, 'message' => 'Reporte eliminado definitivamente.']);

        } elseif ($action === 'empty_all_trash') {
            // Eliminar todas las empresas en estado eliminado
            $stmtElim = $pdo->query("SELECT id FROM negocios WHERE estado_pago = 'eliminado'");
            $ids = $stmtElim->fetchAll(PDO::FETCH_COLUMN);
            foreach ($ids as $nId) {
                $pdo->prepare("DELETE FROM turnos WHERE id_negocio = ?")->execute([$nId]);
                $pdo->prepare("DELETE FROM servicios WHERE id_negocio = ?")->execute([$nId]);
                $pdo->prepare("DELETE FROM configuracion_web WHERE id_negocio = ?")->execute([$nId]);
                $pdo->prepare("DELETE FROM personal_negocio WHERE id_negocio = ?")->execute([$nId]);
                $pdo->prepare("DELETE FROM negocios WHERE id = ?")->execute([$nId]);
            }
            try { $pdo->exec("DELETE FROM reportes_error WHERE estado = 'eliminado'"); } catch(Exception $e) {}

            echo json_encode(['success' => true, 'message' => 'Papelera General vaciada por completo.']);
        } else {
            echo json_encode(['success' => false, 'error' => 'Acción no reconocida.']);
        }
    } catch (Exception $e) {
        echo json_encode(['success' => false, 'error' => 'Error en operación: ' . $e->getMessage()]);
    }
}
?>
