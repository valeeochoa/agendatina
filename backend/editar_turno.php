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
$asistio = isset($_POST['asistio']) ? (int)$_POST['asistio'] : 0;

if (empty($id)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Falta el ID del turno.']);
    exit;
}

require_once __DIR__ . '/conexion.php';

try {
    // Auto-migración asistio
    try { $pdo->query("SELECT asistio FROM turnos LIMIT 1"); } 
    catch(Exception $e) { $pdo->exec("ALTER TABLE turnos ADD COLUMN asistio TINYINT DEFAULT 0"); }

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
        // En el historial actualizar notas y asistencia
        $stmtUpdate = $pdo->prepare("UPDATE turnos SET notas = :notas, asistio = :asistio WHERE id = :id AND id_negocio = :id_negocio");
        $stmtUpdate->execute([
            'notas' => $notas,
            'asistio' => $asistio,
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
        $stmtServ = $pdo->prepare("SELECT id, duracion_minutos, capacidad FROM servicios WHERE id_negocio = :id_negocio AND nombre_servicio = :servicio LIMIT 1");
        $stmtServ->execute(['id_negocio' => $id_negocio, 'servicio' => $servicio]);
        $servRow = $stmtServ->fetch();
        $id_servicio = $servRow ? $servRow['id'] : null;
        $duracion = $servRow && !empty($servRow['duracion_minutos']) ? (int)$servRow['duracion_minutos'] : 30;
        $capacidad_nuevo = $servRow && !empty($servRow['capacidad']) ? (int)$servRow['capacidad'] : 1;

        // Validar anticolisiones si los turnos simultáneos están desactivados
        $stmtC = $pdo->prepare("SELECT turnos_simultaneos FROM configuracion_web WHERE id_negocio = ?");
        $stmtC->execute([$id_negocio]);
        $conf = $stmtC->fetch(PDO::FETCH_ASSOC);
        $simultaneos = $conf ? $conf['turnos_simultaneos'] : 'no';

        if ($simultaneos !== 'si') {
            $stmtCheckOverlap = $pdo->prepare("
                SELECT t.hora, s.duracion_minutos, t.id_servicio 
                FROM turnos t 
                LEFT JOIN servicios s ON t.id_servicio = s.id 
                WHERE t.id_negocio = :id_negocio 
                AND t.fecha = :fecha 
                AND t.id != :id 
                AND (t.profesional = :profesional OR t.profesional = 'Cualquiera (Sin preferencia)' OR :profesional = 'Cualquiera (Sin preferencia)') 
                AND t.estado IN ('pendiente', 'confirmado', 'bloqueado')
            ");
            $stmtCheckOverlap->execute([
                'id_negocio' => $id_negocio,
                'fecha' => $fecha,
                'id' => $id,
                'profesional' => $profesional
            ]);
            $turnosDia = $stmtCheckOverlap->fetchAll(PDO::FETCH_ASSOC);

            $nuevoInicio = strtotime("$fecha $hora:00");
            $nuevoFin = $nuevoInicio + ($duracion * 60);

            $choque = false;
            $cuposOcupados = 0;

            foreach ($turnosDia as $td) {
                $dur_existente = !empty($td['duracion_minutos']) ? (int)$td['duracion_minutos'] : 30;
                $tInicio = strtotime("$fecha {$td['hora']}:00");
                $tFin = $tInicio + ($dur_existente * 60);

                if ($nuevoInicio < $tFin && $nuevoFin > $tInicio) {
                    if ($td['id_servicio'] == $id_servicio && $tInicio == $nuevoInicio && $capacidad_nuevo > 1) {
                        $cuposOcupados++;
                    } else {
                        $choque = true;
                        break;
                    }
                }
            }

            if ($choque || $cuposOcupados >= $capacidad_nuevo) {
                http_response_code(409);
                echo json_encode(['success' => false, 'error' => 'No se puede guardar el cambio. El nuevo horario se superpone con otro turno existente o los cupos están llenos.']);
                exit;
            }
        }

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
            asistio = :asistio,
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
            'asistio' => $asistio,
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
