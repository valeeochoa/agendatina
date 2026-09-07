<?php
require_once __DIR__ . '/../backend/conexion.php';
$stmt = $pdo->query('SELECT * FROM configuracion_global WHERE id = 1');
echo json_encode($stmt->fetch(PDO::FETCH_ASSOC));
