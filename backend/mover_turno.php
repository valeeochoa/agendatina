<?php
session_start();
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/conexion.php';

if (!isset($_SESSION['id_negocio'])) {
    echo json_encode(['success' => false, 'error' => 'No autorizado']);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $id_turno = $_POST['id_turno'] ?? null;
    $nueva_fecha = $_POST['nueva_fecha'] ?? null;
    $nueva_hora = $_POST['nueva_hora'] ?? null;
    $id_negocio = $_SESSION['id_negocio'];

    if (!$id_turno || !$nueva_fecha) {
        echo json_encode(['success' => false, 'error' => 'Datos incompletos']);
        exit;
    }

    try {
        // Obtener el turno actual
        $stmt = $pdo->prepare("SELECT hora, profesional, id_servicio FROM turnos WHERE id = ? AND id_negocio = ?");
        $stmt->execute([$id_turno, $id_negocio]);
        $turno = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$turno) {
            echo json_encode(['success' => false, 'error' => 'Turno no encontrado']);
            exit;
        }

        $hora = $turno['hora'];
        $hora_final = $nueva_hora ? $nueva_hora : $hora;
        $profesional = $turno['profesional'];
        $id_servicio = $turno['id_servicio'];

        // Obtener duración del servicio para validar superposiciones
        $duracion = 30;
        if ($id_servicio) {
            $stmtS = $pdo->prepare("SELECT duracion_minutos FROM servicios WHERE id = ?");
            $stmtS->execute([$id_servicio]);
            $serv = $stmtS->fetch(PDO::FETCH_ASSOC);
            if ($serv && !empty($serv['duracion_minutos'])) {
                $duracion = (int)$serv['duracion_minutos'];
            }
        }

        // Chequear configuración de turnos simultáneos
        $stmtC = $pdo->prepare("SELECT turnos_simultaneos FROM configuracion_web WHERE id_negocio = ?");
        $stmtC->execute([$id_negocio]);
        $conf = $stmtC->fetch(PDO::FETCH_ASSOC);
        $simultaneos = $conf ? $conf['turnos_simultaneos'] : 'no';

        if ($simultaneos !== 'si') {
            // Lógica anticolisiones
            $stmtCheck = $pdo->prepare("SELECT t.hora, s.duracion_minutos FROM turnos t LEFT JOIN servicios s ON t.id_servicio = s.id WHERE t.id_negocio = ? AND t.fecha = ? AND t.id != ? AND (t.profesional = ? OR t.profesional = 'Cualquiera (Sin preferencia)' OR ? = 'Cualquiera (Sin preferencia)') AND t.estado IN ('pendiente', 'confirmado', 'bloqueado')");
            $stmtCheck->execute([$id_negocio, $nueva_fecha, $id_turno, $profesional, $profesional]);
            $turnosDia = $stmtCheck->fetchAll(PDO::FETCH_ASSOC);

            $nuevoInicio = strtotime("$nueva_fecha $hora_final:00");
            $nuevoFin = $nuevoInicio + ($duracion * 60);

            foreach ($turnosDia as $td) {
                $dur_existente = !empty($td['duracion_minutos']) ? (int)$td['duracion_minutos'] : 30;
                $tInicio = strtotime("$nueva_fecha {$td['hora']}:00");
                $tFin = $tInicio + ($dur_existente * 60);

                if ($nuevoInicio < $tFin && $nuevoFin > $tInicio) {
                    echo json_encode(['success' => false, 'error' => 'No puedes moverlo aquí. El horario choca con otro turno en la nueva fecha.']);
                    exit;
                }
            }
        }

        $pdo->prepare("UPDATE turnos SET fecha = ?, hora = ? WHERE id = ? AND id_negocio = ?")->execute([$nueva_fecha, $hora_final, $id_turno, $id_negocio]);
        echo json_encode(['success' => true]);
    } catch (Exception $e) { echo json_encode(['success' => false, 'error' => 'Error al mover el turno: ' . $e->getMessage()]); }
}
?>