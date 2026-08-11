<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/conexion.php';

try {
    // Asegurar que la tabla y columnas existan sin sobreescribir valores del Superadmin
    $pdo->exec("CREATE TABLE IF NOT EXISTS configuracion_global (
        id INT PRIMARY KEY DEFAULT 1,
        precio_basico DECIMAL(10,2) DEFAULT 8889,
        precio_intermedio DECIMAL(10,2) DEFAULT 11111,
        precio_premium DECIMAL(10,2) DEFAULT 16667
    )"); 
    $pdo->exec("INSERT IGNORE INTO configuracion_global (id, precio_basico, precio_intermedio, precio_premium) VALUES (1, 8889, 11111, 16667)");
    
    try { $pdo->query("SELECT descuento_porcentaje FROM configuracion_global LIMIT 1"); } 
    catch(Exception $e) { $pdo->exec("ALTER TABLE configuracion_global ADD COLUMN descuento_porcentaje INT DEFAULT 10"); }
    
    try { $pdo->query("SELECT descuento_hasta FROM configuracion_global LIMIT 1"); } 
    catch(Exception $e) { $pdo->exec("ALTER TABLE configuracion_global ADD COLUMN descuento_hasta DATETIME DEFAULT NULL"); }

    $stmt = $pdo->query("SELECT precio_basico, precio_intermedio, precio_premium, descuento_porcentaje, descuento_hasta FROM configuracion_global WHERE id = 1");
    $precios = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$precios) {
        $precios = [
            'precio_basico' => 8889,
            'precio_intermedio' => 11111,
            'precio_premium' => 16667,
            'descuento_porcentaje' => 10,
            'descuento_hasta' => null
        ];
    }
    echo json_encode(['success' => true, 'data' => $precios]);
} catch(Exception $e) {
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>