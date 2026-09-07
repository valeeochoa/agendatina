<?php
require_once __DIR__ . '/../backend/conexion.php';

try {
    $stmt = $pdo->query("SELECT id, nombre_fantasia, ruta, subdominio FROM negocios");
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo "Total negocios: " . count($rows) . "\n";
    print_r($rows);
} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
