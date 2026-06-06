<?php
require_once __DIR__ . '/backend/conexion.php';
try {
    $stmt = $pdo->query("SELECT id, nombre_completo, email FROM usuarios");
    $usuarios = $stmt->fetchAll();
    echo json_encode($usuarios, JSON_PRETTY_PRINT);
} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
?>
