<?php
session_start();
header('Content-Type: application/json; charset=utf-8');

if (!isset($_SESSION['id_negocio'])) {
    echo json_encode([]);
    exit;
}

// Liberar la sesión para no bloquear otras peticiones AJAX (Mejora drástica de velocidad)
session_write_close();

require_once __DIR__ . '/conexion.php';

try {
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
        'estado' => "VARCHAR(50) DEFAULT 'pendiente'"
    ];

    foreach ($columnas as $columna => $tipo) {
        try { $pdo->query("SELECT $columna FROM turnos LIMIT 1"); } 
        catch (Exception $e) { $pdo->exec("ALTER TABLE turnos ADD COLUMN $columna $tipo"); }
    }

    $historial = isset($_GET['historial']) && $_GET['historial'] === '1';
    
    $profesional_filter = "";
    if (isset($_SESSION['rol_en_local']) && $_SESSION['rol_en_local'] === 'profesional') {
        // Restricción: Si entra el profesional, la base de datos SOLO entrega sus turnos
        $profesional_filter = " AND profesional = :mi_nombre ";
    }

    if ($historial) {
        // Sin límite de fecha para exportar el historial completo a Excel
        $sql = "SELECT id, cliente_nombre, nombre, apellido, cliente_celular, celular, fecha, hora, servicio, profesional, estado 
                FROM turnos 
                WHERE id_negocio = :id_negocio $profesional_filter
                ORDER BY fecha DESC, hora ASC";
        $stmt = $pdo->prepare($sql);
        $params = ['id_negocio' => $_SESSION['id_negocio']];
        if ($profesional_filter) $params['mi_nombre'] = $_SESSION['nombre_completo'];
        $stmt->execute($params);
    } else {
        // Ventana de tiempo (60 días) para vista normal de agenda
        $min_fecha = date('Y-m-d', strtotime('-60 days'));
        $sql = "SELECT id, cliente_nombre, nombre, apellido, cliente_celular, celular, fecha, hora, servicio, profesional, estado 
                FROM turnos 
                WHERE id_negocio = :id_negocio AND fecha >= :min_fecha $profesional_filter
                ORDER BY fecha DESC, hora ASC";
        $stmt = $pdo->prepare($sql);
        $params = ['id_negocio' => $_SESSION['id_negocio'], 'min_fecha' => $min_fecha];
        if ($profesional_filter) $params['mi_nombre'] = $_SESSION['nombre_completo'];
        $stmt->execute($params);
    }
    
    $turnos = $stmt->fetchAll();
    
    echo json_encode($turnos);

} catch (PDOException $e) {
    http_response_code(500);
    die(json_encode(['success' => false, 'error' => 'Error al obtener la agenda: ' . $e->getMessage()]));
}
?>