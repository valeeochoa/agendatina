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

    // 2. MIGRACIÓN: Asegurar que todas las columnas que vamos a leer existan en la tabla vieja
    $columnas = [
        'cliente_nombre' => 'VARCHAR(255) DEFAULT NULL',
        'cliente_celular' => 'VARCHAR(255) DEFAULT NULL',
        'nombre' => 'VARCHAR(255) DEFAULT NULL',
        'apellido' => 'VARCHAR(255) DEFAULT NULL',
        'celular' => 'VARCHAR(255) DEFAULT NULL',
        'profesional' => "VARCHAR(255) DEFAULT 'Cualquiera (Sin preferencia)'",
        'estado' => "VARCHAR(50) DEFAULT 'pendiente'",
        'asistio' => 'TINYINT DEFAULT 0'
    ];

    foreach ($columnas as $columna => $tipo) {
        try { $pdo->query("SELECT $columna FROM turnos LIMIT 1"); } 
        catch (Exception $e) { $pdo->exec("ALTER TABLE turnos ADD COLUMN $columna $tipo"); }
    }

    $historial = isset($_GET['historial']) && $_GET['historial'] === '1';
    
    $profesional_filter = "";
    if (isset($_SESSION['rol_en_local']) && $_SESSION['rol_en_local'] === 'profesional') {
        $permisos = $_SESSION['permisos'] ?? null;
        $verTodos = true;
        if (is_array($permisos) && isset($permisos['ver_todos_turnos'])) {
            $verTodos = !empty($permisos['ver_todos_turnos']);
        } elseif (is_string($permisos)) {
            $parsedP = json_decode($permisos, true);
            if (is_array($parsedP) && isset($parsedP['ver_todos_turnos'])) {
                $verTodos = !empty($parsedP['ver_todos_turnos']);
            }
        }

        // Si el admin deshabilitó la opción de ver los turnos de todo el equipo, solo muestra sus turnos
        if (!$verTodos) {
            $profesional_filter = " AND (profesional = :mi_nombre OR profesional LIKE :mi_nombre_like) ";
        }
    }

    if ($historial) {
        // Sin límite de fecha para exportar el historial completo a Excel
        $sql = "SELECT id, cliente_nombre, nombre, apellido, cliente_celular, celular, fecha, hora, servicio, profesional, estado, asistio, notas, fecha_eliminado, metodo_pago, precio 
                FROM turnos 
                WHERE id_negocio = :id_negocio $profesional_filter
                ORDER BY fecha DESC, hora ASC";
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
        $sql = "SELECT id, cliente_nombre, nombre, apellido, cliente_celular, celular, fecha, hora, servicio, profesional, estado, asistio, notas, fecha_eliminado, metodo_pago, precio 
                FROM turnos 
                WHERE id_negocio = :id_negocio 
                AND (fecha >= :min_fecha OR estado IN ('eliminado', 'cancelado'))
                $profesional_filter
                ORDER BY fecha DESC, hora ASC";
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
    http_response_code(500);
    die(json_encode(['success' => false, 'error' => 'Error al obtener la agenda: ' . $e->getMessage()]));
}
?>