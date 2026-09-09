<?php
// Test script to run backend/perfil.php as a simulated logged-in user or check for any errors/warnings
session_start();

// Find a valid user and business from DB
require_once __DIR__ . '/../backend/conexion.php';

$stmt = $pdo->query("SELECT u.id as user_id, pn.id_negocio, u.nombre_completo, n.nombre_fantasia, n.ruta, pn.rol_en_local 
                     FROM usuarios u 
                     JOIN personal_negocio pn ON u.id = pn.id_usuario 
                     JOIN negocios n ON pn.id_negocio = n.id 
                     LIMIT 1");
$row = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$row) {
    echo "NO USER FOUND IN DB\n";
    exit;
}

echo "Testing with user_id=" . $row['user_id'] . " id_negocio=" . $row['id_negocio'] . "\n";

$_SESSION['user_id'] = $row['user_id'];
$_SESSION['id_negocio'] = $row['id_negocio'];
$_SESSION['nombre_completo'] = $row['nombre_completo'];
$_SESSION['nombre_negocio'] = $row['nombre_fantasia'];
$_SESSION['ruta_negocio'] = $row['ruta'];
$_SESSION['rol_en_local'] = $row['rol_en_local'];

// Obtenemos el output de backend/perfil.php
ob_start();
$_SERVER['REQUEST_METHOD'] = 'GET';
include __DIR__ . '/../backend/perfil.php';
$output = ob_get_clean();

echo "RAW OUTPUT LENGTH: " . strlen($output) . "\n";
echo "RAW OUTPUT START:\n" . substr($output, 0, 300) . "\n";

$json = json_decode($output, true);
if ($json === null) {
    echo "JSON DECODE ERROR: " . json_last_error_msg() . "\n";
    echo "FULL OUTPUT:\n" . $output . "\n";
} else {
    echo "JSON DECODE SUCCESS:\n";
    print_r($json);
}
