<?php
session_start();
header('Content-Type: application/json; charset=utf-8');

if (!isset($_SESSION['id_negocio'])) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'No autorizado.']);
    exit;
}

require_once __DIR__ . '/conexion.php';

try {
    $nuevo_token = bin2hex(random_bytes(16)); // Genera una llave segura aleatoria
    $stmt = $pdo->prepare("UPDATE negocios SET token_seguridad = :token WHERE id = :id");
    $stmt->execute(['token' => $nuevo_token, 'id' => $_SESSION['id_negocio']]);
    
    echo json_encode(['success' => true]);
} catch (PDOException $e) {
    echo json_encode(['success' => false, 'error' => 'Error de base de datos al regenerar los enlaces.']);
}
