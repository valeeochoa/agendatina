<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/conexion.php';

try {
    // Asegurar que la tabla y columnas existan sin sobreescribir valores del Superadmin
    $pdo->exec("CREATE TABLE IF NOT EXISTS configuracion_global (
        id INT PRIMARY KEY DEFAULT 1,
        precio_basico DECIMAL(10,2) DEFAULT 8889,
        precio_intermedio DECIMAL(10,2) DEFAULT 11111,
        precio_premium DECIMAL(10,2) DEFAULT 35000
    )"); 
    $pdo->exec("INSERT IGNORE INTO configuracion_global (id, precio_basico, precio_intermedio, precio_premium) VALUES (1, 8889, 11111, 35000)");
    
    try { $pdo->query("SELECT descuento_porcentaje FROM configuracion_global LIMIT 1"); } 
    catch(Exception $e) { $pdo->exec("ALTER TABLE configuracion_global ADD COLUMN descuento_porcentaje INT DEFAULT 10"); }
    
    try { $pdo->query("SELECT descuento_hasta FROM configuracion_global LIMIT 1"); } 
    catch(Exception $e) { $pdo->exec("ALTER TABLE configuracion_global ADD COLUMN descuento_hasta DATETIME DEFAULT NULL"); }

    try { $pdo->query("SELECT dias_prueba_defecto FROM configuracion_global LIMIT 1"); } 
    catch(Exception $e) { try { $pdo->exec("ALTER TABLE configuracion_global ADD COLUMN dias_prueba_defecto INT NOT NULL DEFAULT 30"); } catch(Exception $ex) {} }

    try { $pdo->query("SELECT alumnos_incluidos_premium FROM configuracion_global LIMIT 1"); }
    catch(Exception $e) {
        try { $pdo->exec("ALTER TABLE configuracion_global ADD COLUMN alumnos_incluidos_premium INT NOT NULL DEFAULT 100"); } catch(Exception $ex) {}
        // Migración única de precio_premium anterior (16667) al nuevo esquema ($35.000 base con 100 alumnos incluidos)
        try { $pdo->exec("UPDATE configuracion_global SET precio_premium = 35000 WHERE ROUND(precio_premium) = 16667"); } catch(Exception $ex) {}
    }

    try { $pdo->query("SELECT precio_alumno_extra_premium FROM configuracion_global LIMIT 1"); }
    catch(Exception $e) { try { $pdo->exec("ALTER TABLE configuracion_global ADD COLUMN precio_alumno_extra_premium DECIMAL(10,2) NOT NULL DEFAULT 1000"); } catch(Exception $ex) {} }

    try { $pdo->query("SELECT prem_desc_100_200 FROM configuracion_global LIMIT 1"); }
    catch(Exception $e) {
        try { $pdo->exec("ALTER TABLE configuracion_global ADD COLUMN prem_desc_100_200 INT NOT NULL DEFAULT 20"); } catch(Exception $ex) {}
        try { $pdo->exec("ALTER TABLE configuracion_global ADD COLUMN prem_desc_300_400 INT NOT NULL DEFAULT 30"); } catch(Exception $ex) {}
        try { $pdo->exec("ALTER TABLE configuracion_global ADD COLUMN prem_desc_400_500 INT NOT NULL DEFAULT 40"); } catch(Exception $ex) {}
        try { $pdo->exec("ALTER TABLE configuracion_global ADD COLUMN prem_desc_500_600 INT NOT NULL DEFAULT 50"); } catch(Exception $ex) {}
        // Migración única de precio_alumno_extra_premium anterior (700) a 1000 con descuentos progresivos
        try { $pdo->exec("UPDATE configuracion_global SET precio_alumno_extra_premium = 1000 WHERE ROUND(precio_alumno_extra_premium) = 700"); } catch(Exception $ex) {}
    }

    $stmt = $pdo->query("SELECT precio_basico, precio_intermedio, precio_premium, descuento_porcentaje, descuento_hasta, COALESCE(dias_prueba_defecto, 30) AS dias_prueba_defecto, COALESCE(alumnos_incluidos_premium, 100) AS alumnos_incluidos_premium, COALESCE(precio_alumno_extra_premium, 1000) AS precio_alumno_extra_premium, COALESCE(prem_desc_100_200, 20) AS prem_desc_100_200, COALESCE(prem_desc_300_400, 30) AS prem_desc_300_400, COALESCE(prem_desc_400_500, 40) AS prem_desc_400_500, COALESCE(prem_desc_500_600, 50) AS prem_desc_500_600 FROM configuracion_global ORDER BY id ASC LIMIT 1");
    $precios = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$precios) {
        $precios = [
            'precio_basico' => 8889.0,
            'precio_intermedio' => 11111.0,
            'precio_premium' => 35000.0,
            'alumnos_incluidos_premium' => 100,
            'precio_alumno_extra_premium' => 1000.0,
            'prem_desc_100_200' => 20,
            'prem_desc_300_400' => 30,
            'prem_desc_400_500' => 40,
            'prem_desc_500_600' => 50,
            'descuento_porcentaje' => 10,
            'descuento_hasta' => null,
            'dias_prueba_defecto' => 30
        ];
    } else {
        $precios['precio_basico'] = (float)$precios['precio_basico'];
        $precios['precio_intermedio'] = (float)$precios['precio_intermedio'];
        $precios['precio_premium'] = (float)$precios['precio_premium'];
        $precios['alumnos_incluidos_premium'] = !empty($precios['alumnos_incluidos_premium']) ? (int)$precios['alumnos_incluidos_premium'] : 100;
        $precios['precio_alumno_extra_premium'] = !empty($precios['precio_alumno_extra_premium']) ? (float)$precios['precio_alumno_extra_premium'] : 1000.0;
        $precios['prem_desc_100_200'] = min(50, max(0, (int)($precios['prem_desc_100_200'] ?? 20)));
        $precios['prem_desc_300_400'] = min(50, max(0, (int)($precios['prem_desc_300_400'] ?? 30)));
        $precios['prem_desc_400_500'] = min(50, max(0, (int)($precios['prem_desc_400_500'] ?? 40)));
        $precios['prem_desc_500_600'] = min(50, max(0, (int)($precios['prem_desc_500_600'] ?? 50)));
        $precios['descuento_porcentaje'] = isset($precios['descuento_porcentaje']) ? (int)$precios['descuento_porcentaje'] : 0;
        $precios['dias_prueba_defecto'] = !empty($precios['dias_prueba_defecto']) ? (int)$precios['dias_prueba_defecto'] : 30;

        if (!empty($precios['descuento_hasta'])) {
            $expTime = strtotime($precios['descuento_hasta']);
            if ($expTime && $expTime < time()) {
                $precios['descuento_porcentaje'] = 0;
                $precios['descuento_expirado'] = true;
            }
        }
    }
    echo json_encode(['success' => true, 'data' => $precios]);
} catch(Exception $e) {
    error_log("Error en obtener_precios.php: " . $e->getMessage());
    echo json_encode([
        'success' => true,
        'data' => [
            'precio_basico' => 8889.0,
            'precio_intermedio' => 11111.0,
            'precio_premium' => 35000.0,
            'alumnos_incluidos_premium' => 100,
            'precio_alumno_extra_premium' => 1000.0,
            'prem_desc_100_200' => 20,
            'prem_desc_300_400' => 30,
            'prem_desc_400_500' => 40,
            'prem_desc_500_600' => 50,
            'descuento_porcentaje' => 10,
            'descuento_hasta' => null,
            'dias_prueba_defecto' => 30
        ]
    ]);
}
?>
