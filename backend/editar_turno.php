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
$notas = trim($_POST['notas'] ?? '');

if (empty($id)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Falta el ID del turno.']);
    exit;
}

require_once __DIR__ . '/conexion.php';

try {
    // Obtener el estado y fecha/hora actual del turno en la base de datos
    $stmtCheck = $pdo->prepare("SELECT fecha, hora, estado FROM turnos WHERE id = :id AND id_negocio = :id_negocio LIMIT 1");
    $stmtCheck->execute(['id' => $id, 'id_negocio' => $id_negocio]);
    $currentTurno = $stmtCheck->fetch();

    if (!$currentTurno) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Turno no encontrado.']);
        exit;
    }

    $now = new DateTime();
    $turnoDateTime = new DateTime($currentTurno['fecha'] . ' ' . $currentTurno['hora']);
    $isPast = $turnoDateTime < $now;

    if ($isPast) {
        // Solo actualizar notas
        $stmtUpdate = $pdo->prepare("UPDATE turnos SET notas = :notas WHERE id = :id AND id_negocio = :id_negocio");
        $stmtUpdate->execute([
            'notas' => $notas,
            'id' => $id,
            'id_negocio' => $id_negocio
        ]);
    } else {
        // Validar campos obligatorios para futuros turnos
        if (empty($nombre) || empty($celular) || empty($fecha) || empty($hora) || empty($servicio)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Faltan datos obligatorios.']);
            exit;
        }

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
            id_servicio = :id_servicio,
            notas = :notas
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
            'notas' => $notas,
            'id' => $id,
            'id_negocio' => $id_negocio
        ]);
    }

    echo json_encode(['success' => true]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error de base de datos al modificar: ' . $e->getMessage()]);
}
?>
