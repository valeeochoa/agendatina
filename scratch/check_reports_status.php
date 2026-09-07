<?php
require_once __DIR__ . '/../backend/conexion.php';
$stmt = $pdo->query("SELECT id, nombre_negocio, modulo, descripcion, estado, fecha, fecha_resuelto FROM reportes_error ORDER BY id DESC LIMIT 20");
$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
echo json_encode($rows, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
