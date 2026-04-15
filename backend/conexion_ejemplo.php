<?php
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// Configuración de conexión (Valores por defecto en XAMPP)
$host = 'localhost';
$dbname = 'c2771918_tina';

// Detectar si un cliente público está visitando la URL de la Demo o interactuando con ella
$is_demo_public = false;
if (isset($_GET['n']) && strtolower($_GET['n']) === 'demo') {
    $is_demo_public = true;
} elseif (isset($_POST['negocio']) && strtolower($_POST['negocio']) === 'demo') {
    $is_demo_public = true;
} elseif (isset($_POST['ruta']) && strtolower($_POST['ruta']) === 'demo') {
    $is_demo_public = true;
}

// MODO SANDBOX: Conectar a BD clonada si es el Admin de Demo o la vista pública
if ((isset($_SESSION['is_demo']) && $_SESSION['is_demo'] === true) || $is_demo_public) {
    $dbname = 'c2771918_tina_d'; 
}

$username = 'c2771918';
$password = ''; // En XAMPP, el usuario root no tiene contraseña por defecto

try {
    // Establecer la conexión usando PDO
    $pdo = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8mb4", $username, $password);
    
    // Configurar PDO para que lance excepciones si ocurre un error
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    // Retornar siempre los resultados como un array asociativo
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    
} catch (PDOException $e) {
    // Si hay un error de conexión, frenar la ejecución y devolver un mensaje en JSON
    die(json_encode(['success' => false, 'error' => 'Error de conexión a la base de datos: ' . $e->getMessage()]));
}
?>