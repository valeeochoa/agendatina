<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/conexion.php';

try { $pdo->query("SELECT descuento_porcentaje FROM configuracion_global LIMIT 1"); } 
catch(Exception $e) { 
    $pdo->exec("CREATE TABLE IF NOT EXISTS configuracion_global (
        id INT PRIMARY KEY DEFAULT 1,
        precio_basico DECIMAL(10,2) DEFAULT 13288,
        precio_intermedio DECIMAL(10,2) DEFAULT 20563,
        precio_premium DECIMAL(10,2) DEFAULT 28188
    )"); 
    $pdo->exec("INSERT IGNORE INTO configuracion_global (id) VALUES (1)");
    $pdo->exec("ALTER TABLE configuracion_global ADD COLUMN descuento_porcentaje INT DEFAULT 20");
    $pdo->exec("ALTER TABLE configuracion_global ADD COLUMN descuento_hasta DATETIME DEFAULT NULL");
    
    $pdo->exec("UPDATE configuracion_global SET precio_basico = 13288, precio_intermedio = 20563, precio_premium = 28188 WHERE id = 1 AND precio_basico <= 10630");
}

try {
    $stmt = $pdo->query("SELECT precio_basico, precio_intermedio, precio_premium, descuento_porcentaje, descuento_hasta FROM configuracion_global WHERE id = 1");
    $precios = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$precios) $precios = ['precio_basico' => 13288, 'precio_intermedio' => 20563, 'precio_premium' => 28188, 'descuento_porcentaje' => 20, 'descuento_hasta' => null];
    echo json_encode(['success' => true, 'data' => $precios]);
} catch(Exception $e) {
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>