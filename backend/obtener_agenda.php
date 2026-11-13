<?php
session_start();
header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/conexion.php';

if (!isset($_SESSION['id_negocio'])) {
    if ((isset($_SESSION['is_demo']) && $_SESSION['is_demo'] === true) || (isset($_GET['n']) && strtolower($_GET['n']) === 'demo')) {
        try {
            $stmtDemo = $pdo->query("SELECT id FROM negocios WHERE ruta = 'demo' OR subdominio = 'demo' LIMIT 1");
            if ($stmtDemo) {
                $demoId = $stmtDemo->fetchColumn();
                if ($demoId) $_SESSION['id_negocio'] = $demoId;
            }
        } catch (Exception $eDemo) {}
    }
}

if (!isset($_SESSION['id_negocio'])) {
    echo json_encode([]);
    exit;
}

if (isset($_SESSION['is_demo']) && $_SESSION['is_demo'] === true && !empty($_SESSION['id_negocio'])) {
    require_once __DIR__ . '/helpers/demo_helper.php';
    asegurarDatosDemo($pdo, $_SESSION['id_negocio']);
}

// Liberar la sesión para no bloquear otras peticiones AJAX (Mejora drástica de velocidad)
session_write_close();

try {
    // 0. Auto-eliminación de turnos antiguos según el límite configurado
    try {
        $stmtLimit = $pdo->prepare("SELECT limite_eliminacion_dias FROM configuracion_web WHERE id_negocio = :id LIMIT 1");
        $stmtLimit->execute(['id' => $_SESSION['id_negocio']]);
        $limitVal = $stmtLimit->fetchColumn();
        if ($limitVal && (int)$limitVal > 0) {
            $cutoff = date('Y-m-d H:i:s', strtotime('-' . (int)$limitVal . ' days'));
            $stmtDel = $pdo->prepare("DELETE FROM turnos WHERE id_negocio = :id AND fecha_eliminado IS NOT NULL AND fecha_eliminado < :cutoff AND estado IN ('eliminado', 'cancelado')");
            $stmtDel->execute(['id' => $_SESSION['id_negocio'], 'cutoff' => $cutoff]);
        }
    } catch (Exception $delEx) {
        error_log("Error during auto-deletion cleanup: " . $delEx->getMessage());
    }

    // 1. MIGRACIÓN: Crear índice compuesto si no existe (Optimización extrema de lectura)
    try { $pdo->exec("ALTER TABLE turnos ADD INDEX idx_negocio_fecha (id_negocio, fecha)"); } 
    catch (Exception $e) { /* El índice ya existe, continuamos silenciosamente */ }

    // Asegurar columna tipo_servicio en tabla servicios para joins seguros
    try { $pdo->query("SELECT tipo_servicio FROM servicios LIMIT 1"); } 
    catch(Exception $e) { try { $pdo->exec("ALTER TABLE servicios ADD COLUMN tipo_servicio VARCHAR(30) DEFAULT 'calendario'"); } catch(Exception $ex) {} }

    // 2. MIGRACIÓN: Asegurar que todas las columnas que vamos a leer existan en la tabla vieja
    $columnas = [
        'cliente_nombre' => 'VARCHAR(255) DEFAULT NULL',
        'cliente_celular' => 'VARCHAR(255) DEFAULT NULL',
        'nombre' => 'VARCHAR(255) DEFAULT NULL',
        'apellido' => 'VARCHAR(255) DEFAULT NULL',
        'celular' => 'VARCHAR(255) DEFAULT NULL',
        'profesional' => "VARCHAR(255) DEFAULT 'Cualquiera (Sin preferencia)'",
        'estado' => "VARCHAR(50) DEFAULT 'pendiente'",
        'asistio' => 'TINYINT DEFAULT 0',
        'no_asistio' => 'TINYINT DEFAULT 0',
        'created_at' => 'DATETIME DEFAULT CURRENT_TIMESTAMP'
    ];

    foreach ($columnas as $columna => $tipo) {
        try { $pdo->query("SELECT $columna FROM turnos LIMIT 1"); } 
        catch (Exception $e) { try { $pdo->exec("ALTER TABLE turnos ADD COLUMN $columna $tipo"); } catch(Exception $ex) {} }
    }

    // Auto-liberar turnos pendientes de confirmación tras 1 hora (3600 seg) si son con seña / transferencia
    try {
        $pdo->exec("UPDATE turnos 
            SET estado = 'cancelado', notas = CONCAT(COALESCE(notas, ''), ' [Auto-liberado por falta de confirmación de seña en 1 hora]') 
            WHERE estado = 'pendiente' 
              AND (metodo_pago LIKE '%transferencia%' OR metodo_pago LIKE '%seña%')
              AND created_at IS NOT NULL 
              AND created_at < DATE_SUB(NOW(), INTERVAL 1 HOUR)");
    } catch (Exception $eAutoLib) {}

    $historial = isset($_GET['historial']) && $_GET['historial'] === '1';
    
    $profesional_filter = "";
    $isProf = (isset($_SESSION['rol_en_local']) && $_SESSION['rol_en_local'] === 'profesional');
    if (!$isProf && isset($_SESSION['user_id']) && isset($_SESSION['id_negocio'])) {
        try {
            $stmtPn = $pdo->prepare("SELECT rol_en_local, permisos FROM personal_negocio WHERE id_negocio = ? AND id_usuario = ? LIMIT 1");
            $stmtPn->execute([$_SESSION['id_negocio'], $_SESSION['user_id']]);
            $pnRow = $stmtPn->fetch(PDO::FETCH_ASSOC);
            if ($pnRow) {
                $_SESSION['rol_en_local'] = $pnRow['rol_en_local'];
                $isProf = ($pnRow['rol_en_local'] === 'profesional');
                if (!empty($pnRow['permisos'])) {
                    $_SESSION['permisos'] = json_decode($pnRow['permisos'], true);
                }
            }
        } catch (Exception $ePn) {}
    }

    if (empty($_SESSION['nombre_completo']) && isset($_SESSION['user_id'])) {
        try {
            $stmtU = $pdo->prepare("SELECT nombre_completo FROM usuarios WHERE id = ?");
            $stmtU->execute([$_SESSION['user_id']]);
            $uName = $stmtU->fetchColumn();
            if ($uName) $_SESSION['nombre_completo'] = $uName;
        } catch (Exception $eU) {}
    }

    if ($isProf) {
        $permisos = $_SESSION['permisos'] ?? null;
        if (is_string($permisos)) {
            $permisos = json_decode($permisos, true) ?: [];
        }

        // Si el admin deshabilitó el acceso a la agenda, retornar vacío
        if (is_array($permisos) && isset($permisos['agenda']) && empty($permisos['agenda'])) {
            echo json_encode([]);
            exit;
        }

        $verTodos = true;
        if (is_array($permisos) && isset($permisos['ver_todos_turnos'])) {
            $verTodos = !empty($permisos['ver_todos_turnos']);
        }

        // Si el admin deshabilitó la opción de ver los turnos de todo el equipo, solo muestra sus turnos
        if (!$verTodos && !empty($_SESSION['nombre_completo'])) {
            $profesional_filter = " AND (LOWER(TRIM(t.profesional)) = LOWER(TRIM(:mi_nombre)) OR t.profesional LIKE :mi_nombre_like) ";
        }
    }

    if ($historial) {
        // Sin límite de fecha para exportar el historial completo a Excel
        $sql = "SELECT t.id, t.id_servicio, t.cliente_nombre, t.nombre, t.apellido, t.cliente_celular, t.celular, t.fecha, t.hora, t.servicio, t.profesional, t.estado, t.asistio, t.no_asistio, t.notas, t.fecha_eliminado, t.metodo_pago, t.precio, t.created_at,
                       GREATEST(0, 3600 - TIMESTAMPDIFF(SECOND, COALESCE(t.created_at, NOW()), NOW())) AS segundos_restantes_sena,
                       COALESCE(s.cupo_maximo, s.capacidad, 1) AS cupo_maximo,
                       COALESCE(s.tipo_servicio, 'calendario') AS tipo_servicio,
                       COALESCE(s.icono, '') AS servicio_icono,
                       s.imagen1 AS servicio_imagen
                FROM turnos t
                LEFT JOIN servicios s ON (t.id_servicio = s.id OR (t.id_negocio = s.id_negocio AND LOWER(TRIM(t.servicio)) = LOWER(TRIM(s.nombre_servicio))))
                WHERE t.id_negocio = :id_negocio $profesional_filter
                ORDER BY t.fecha DESC, t.hora ASC";
        $stmt = $pdo->prepare($sql);
        $params = ['id_negocio' => $_SESSION['id_negocio']];
        if ($profesional_filter) {
            $params['mi_nombre'] = $_SESSION['nombre_completo'];
            $params['mi_nombre_like'] = '%' . $_SESSION['nombre_completo'] . '%';
        }
        $stmt->execute($params);
    } else {
        // Ventana de tiempo (60 días) para vista normal de agenda
        $min_fecha = date('Y-m-d', strtotime('-60 days'));
        $sql = "SELECT t.id, t.id_servicio, t.cliente_nombre, t.nombre, t.apellido, t.cliente_celular, t.celular, t.fecha, t.hora, t.servicio, t.profesional, t.estado, t.asistio, t.no_asistio, t.notas, t.fecha_eliminado, t.metodo_pago, t.precio, t.created_at,
                       GREATEST(0, 3600 - TIMESTAMPDIFF(SECOND, COALESCE(t.created_at, NOW()), NOW())) AS segundos_restantes_sena,
                       COALESCE(s.cupo_maximo, s.capacidad, 1) AS cupo_maximo,
                       COALESCE(s.tipo_servicio, 'calendario') AS tipo_servicio,
                       COALESCE(s.icono, '') AS servicio_icono,
                       s.imagen1 AS servicio_imagen
                FROM turnos t
                LEFT JOIN servicios s ON (t.id_servicio = s.id OR (t.id_negocio = s.id_negocio AND LOWER(TRIM(t.servicio)) = LOWER(TRIM(s.nombre_servicio))))
                WHERE t.id_negocio = :id_negocio 
                AND (t.fecha >= :min_fecha OR t.estado IN ('eliminado', 'cancelado'))
                $profesional_filter
                ORDER BY t.fecha DESC, t.hora ASC";
        $stmt = $pdo->prepare($sql);
        $params = ['id_negocio' => $_SESSION['id_negocio'], 'min_fecha' => $min_fecha];
        if ($profesional_filter) {
            $params['mi_nombre'] = $_SESSION['nombre_completo'];
            $params['mi_nombre_like'] = '%' . $_SESSION['nombre_completo'] . '%';
        }
        $stmt->execute($params);
    }
    
    $turnos = $stmt->fetchAll();
    
    echo json_encode($turnos);

} catch (PDOException $e) {
    error_log("Error al obtener la agenda: " . $e->getMessage());
    http_response_code(500);
    die(json_encode(['success' => false, 'error' => 'No se pudo cargar la agenda de turnos. Por favor intenta de nuevo.']));
}
?>