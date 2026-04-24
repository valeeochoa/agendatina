<?php
session_start();
header('Content-Type: application/json; charset=utf-8');

if (!isset($_SESSION['id_negocio'])) {
    echo json_encode([]);
    exit;
}

// Liberar la sesión para no bloquear otras peticiones AJAX (Mejora drástica de velocidad)
session_write_close();

require_once __DIR__ . '/conexion.php';

try {
    // Filtrar los turnos por el negocio del usuario logueado
    $stmt = $pdo->prepare("SELECT * FROM turnos WHERE id_negocio = :id_negocio ORDER BY fecha DESC, hora ASC");
    $stmt->execute(['id_negocio' => $_SESSION['id_negocio']]);
    $turnos = $stmt->fetchAll();
    
    echo json_encode($turnos);

} catch (PDOException $e) {
    http_response_code(500);
    die(json_encode(['success' => false, 'error' => 'Error al obtener la agenda: ' . $e->getMessage()]));
}
?>