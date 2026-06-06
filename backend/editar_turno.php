<?php
session_start();
header('Content-Type: application/json; charset=utf-8');

// Solo para admins
if (!isset($_SESSION['user_id']) || !isset($_SESSION['id_negocio'])) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Acceso no autorizado.']);
    exit;
}

$id_negocio = $_SESSION['id_negocio'];

// Solo POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método no permitido.']);
    exit;
}

$id = $_POST['id'] ?? '';
$nombre = trim($_POST['nombre'] ?? '');
$apellido = trim($_POST['apellido'] ?? '');
$celular = trim($_POST['celular'] ?? '');
$fecha = $_POST['fecha'] ?? '';
$hora = $_POST['hora'] ?? '';
$servicio = trim($_POST['servicio'] ?? '');
$profesional = trim($_POST['profesional'] ?? 'Cualquiera (Sin preferencia)');

if (empty($id) || empty($nombre) || empty($celular) || empty($fecha) || empty($hora) || empty($servicio)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Faltan datos obligatorios.']);
    exit;
}

require_once __DIR__ . '/conexion.php';

try {
    $cliente_nombre = trim($nombre . ' ' . $apellido);

    // Encontrar el ID del servicio para que se sincronice
    $stmtServ = $pdo->prepare("SELECT id FROM servicios WHERE id_negocio = :id_negocio AND nombre_servicio = :servicio LIMIT 1");
    $stmtServ->execute(['id_negocio' => $id_negocio, 'servicio' => $servicio]);
    $servRow = $stmtServ->fetch();
    $id_servicio = $servRow ? $servRow['id'] : null;

    $stmtUpdate = $pdo->prepare("UPDATE turnos SET 
        cliente_nombre = :cliente_nombre, 
        nombre = :nombre, 
        apellido = :apellido, 
        cliente_celular = :cliente_celular, 
        celular = :celular, 
        fecha = :fecha, 
        hora = :hora, 
        servicio = :servicio, 
        profesional = :profesional, 
        id_servicio = :id_servicio 
        WHERE id = :id AND id_negocio = :id_negocio");

    $stmtUpdate->execute([
        'cliente_nombre' => $cliente_nombre,
        'nombre' => $nombre,
        'apellido' => $apellido,
        'cliente_celular' => $celular,
        'celular' => $celular,
        'fecha' => $fecha,
        'hora' => $hora,
        'servicio' => $servicio,
        'profesional' => $profesional,
        'id_servicio' => $id_servicio,
        'id' => $id,
        'id_negocio' => $id_negocio
    ]);

    if ($stmtUpdate->rowCount() >= 0) {
        echo json_encode(['success' => true]);
    } else {
        echo json_encode(['success' => false, 'error' => 'No se realizaron cambios o el turno no pertenece a este negocio.']);
    }
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error de base de datos al modificar: ' . $e->getMessage()]);
}
?>
