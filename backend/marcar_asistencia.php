<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/conexion.php';

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

$id_negocio = $_SESSION['id_negocio'] ?? null;
if (!$id_negocio) {
    echo json_encode(['success' => false, 'error' => 'Sesión no válida o expirable']);
    exit;
}

try {
    // Auto-migración columna asistio
    try { $pdo->query("SELECT asistio FROM turnos LIMIT 1"); } 
    catch(Exception $e) { $pdo->exec("ALTER TABLE turnos ADD COLUMN asistio TINYINT DEFAULT 0"); }

    $data = json_decode(file_get_contents('php://input'), true);
    if (!$data || !isset($data['id_turno'])) {
        echo json_encode(['success' => false, 'error' => 'Datos inválidos']);
        exit;
    }

    $id_turno = (int)$data['id_turno'];
    $asistio = isset($data['asistio']) ? ((int)$data['asistio'] === 1 ? 1 : 0) : 1;

    $stmt = $pdo->prepare("UPDATE turnos SET asistio = :asistio WHERE id = :id AND id_negocio = :id_negocio");
    $stmt->execute(['asistio' => $asistio, 'id' => $id_turno, 'id_negocio' => $id_negocio]);

    echo json_encode([
        'success' => true,
        'id_turno' => $id_turno,
        'asistio' => $asistio,
        'mensaje' => $asistio === 1 ? 'Asistencia registrada correctamente' : 'Marcar como no asistió'
    ]);
} catch (Exception $e) {
    error_log("Error en marcar_asistencia.php: " . $e->getMessage());
    echo json_encode(['success' => false, 'error' => 'No se pudo actualizar la asistencia del turno.']);
}
?>
