<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/conexion.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'error' => 'Método no permitido.']);
    exit;
}

$id_turno = $_POST['id'] ?? '';
$ruta_negocio = $_POST['n'] ?? '';
$profesional = $_POST['p'] ?? '';
$token = $_POST['token'] ?? '';

if (!$id_turno || !$ruta_negocio || !$profesional || !$token) {
    echo json_encode(['success' => false, 'error' => 'Datos incompletos o enlace inválido.']);
    exit;
}

try {
    // 1. Obtener ID del Negocio
    $stmtNeg = $pdo->prepare("SELECT id FROM negocios WHERE ruta = :ruta LIMIT 1");
    $stmtNeg->execute(['ruta' => $ruta_negocio]);
    $negocio = $stmtNeg->fetch();

    if (!$negocio) {
        echo json_encode(['success' => false, 'error' => 'Negocio no encontrado.']);
        exit;
    }

    // 2. Validar que el turno exista, no esté cancelado y pertenezca a ese profesional
    $stmtTurno = $pdo->prepare("SELECT id FROM turnos WHERE id = :id AND id_negocio = :id_neg AND profesional = :prof AND estado != 'cancelado'");
    $stmtTurno->execute([
        'id' => $id_turno, 
        'id_neg' => $negocio['id'], 
        'prof' => $profesional
    ]);
    
    if (!$stmtTurno->fetch()) {
        echo json_encode(['success' => false, 'error' => 'Turno no encontrado o no tienes permiso para cancelarlo.']);
        exit;
    }

    // 3. Cancelar / Eliminar el turno
    $stmtDel = $pdo->prepare("DELETE FROM turnos WHERE id = :id");
    $stmtDel->execute(['id' => $id_turno]);

    echo json_encode(['success' => true]);
} catch (Exception $e) {
    echo json_encode(['success' => false, 'error' => 'Error interno del servidor al procesar la cancelación.']);
}
?>