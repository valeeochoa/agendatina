<?php
session_start();
header('Content-Type: application/json; charset=utf-8');

if (!isset($_SESSION['user_id']) || !isset($_SESSION['id_negocio'])) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Acceso no autorizado. Inicia sesión.']);
    exit;
}

$id_negocio = $_SESSION['id_negocio'];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $id = $_POST['id'] ?? '';

    if (empty($id)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'ID no proporcionado']);
        exit;
    }

    require_once __DIR__ . '/conexion.php';

    try {
        // 1. Obtener datos completos del turno a confirmar
        $stmtGet = $pdo->prepare("SELECT id, id_servicio, cliente_nombre, nombre, apellido, cliente_celular, celular, fecha, hora, servicio, profesional, estado FROM turnos WHERE id = :id AND id_negocio = :id_negocio LIMIT 1");
        $stmtGet->execute(['id' => $id, 'id_negocio' => $id_negocio]);
        $turno = $stmtGet->fetch(PDO::FETCH_ASSOC);

        if (!$turno) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'No se encontró una solicitud con ese ID.']);
            exit;
        }

        // 2. Actualizamos el estado de la solicitud a 'confirmado'
        $stmt = $pdo->prepare("UPDATE turnos SET estado = 'confirmado' WHERE id = :id AND id_negocio = :id_negocio");
        $stmt->execute(['id' => $id, 'id_negocio' => $id_negocio]);

        $nombreC = $turno['cliente_nombre'] ?: trim(($turno['nombre'] ?? '') . ' ' . ($turno['apellido'] ?? ''));
        $celularC = $turno['cliente_celular'] ?: ($turno['celular'] ?? '');
        $horaNorm = substr(trim((string)($turno['hora'] ?? '')), 0, 5);
        $profTurno = trim((string)($turno['profesional'] ?? ''));

        // 3. Verificar capacidad del servicio y detectar otros turnos pendientes en el mismo día y horario
        $capacidad = 1;
        try {
            if (!empty($turno['id_servicio'])) {
                $stmtCap = $pdo->prepare("SELECT COALESCE(cupo_maximo, capacidad, 1) AS cap FROM servicios WHERE id = :sid AND id_negocio = :id_negocio LIMIT 1");
                $stmtCap->execute(['sid' => $turno['id_servicio'], 'id_negocio' => $id_negocio]);
            } else {
                $stmtCap = $pdo->prepare("SELECT COALESCE(cupo_maximo, capacidad, 1) AS cap FROM servicios WHERE id_negocio = :id_negocio AND LOWER(TRIM(nombre_servicio)) = LOWER(TRIM(:sname)) LIMIT 1");
                $stmtCap->execute(['id_negocio' => $id_negocio, 'sname' => (string)($turno['servicio'] ?? '')]);
            }
            $rowCap = $stmtCap->fetch(PDO::FETCH_ASSOC);
            if ($rowCap && intval($rowCap['cap']) > 1) {
                $capacidad = intval($rowCap['cap']);
            }
        } catch (Exception $eCap) {
            $capacidad = 1;
        }

        $isAnyProf = ($profTurno === '' || strcasecmp($profTurno, 'Cualquiera (Sin preferencia)') === 0);

        // Contar cuántos turnos confirmados existen ahora en esa fecha y hora
        $stmtConf = $pdo->prepare("SELECT id, profesional, servicio FROM turnos WHERE id_negocio = :id_negocio AND fecha = :fecha AND LEFT(TRIM(hora), 5) = :hora AND estado IN ('confirmado', 'atendido')");
        $stmtConf->execute(['id_negocio' => $id_negocio, 'fecha' => $turno['fecha'], 'hora' => $horaNorm]);
        $confirmadosSlot = $stmtConf->fetchAll(PDO::FETCH_ASSOC);

        $confirmadosMismoRecurso = 0;
        foreach ($confirmadosSlot as $cRow) {
            $cProf = trim((string)($cRow['profesional'] ?? ''));
            $cIsAny = ($cProf === '' || strcasecmp($cProf, 'Cualquiera (Sin preferencia)') === 0);
            if ($isAnyProf || $cIsAny || strcasecmp($cProf, $profTurno) === 0) {
                $confirmadosMismoRecurso++;
            }
        }

        $otrosRechazados = [];
        if ($confirmadosMismoRecurso >= $capacidad) {
            // Buscar otros turnos pendientes que compiten por el mismo día y horario, ordenados por quién reservó primero (FIFO)
            $stmtComp = $pdo->prepare("SELECT id, cliente_nombre, nombre, apellido, cliente_celular, celular, fecha, hora, servicio, profesional, created_at
                                       FROM turnos
                                       WHERE id_negocio = :id_negocio
                                         AND fecha = :fecha
                                         AND LEFT(TRIM(hora), 5) = :hora
                                         AND estado = 'pendiente'
                                         AND id != :id
                                       ORDER BY COALESCE(created_at, '1970-01-01 00:00:00') ASC, id ASC");
            $stmtComp->execute([
                'id_negocio' => $id_negocio,
                'fecha' => $turno['fecha'],
                'hora' => $horaNorm,
                'id' => $id
            ]);
            $competidores = $stmtComp->fetchAll(PDO::FETCH_ASSOC);

            $idsRechazar = [];
            foreach ($competidores as $comp) {
                $compProf = trim((string)($comp['profesional'] ?? ''));
                $compIsAny = ($compProf === '' || strcasecmp($compProf, 'Cualquiera (Sin preferencia)') === 0);
                if ($isAnyProf || $compIsAny || strcasecmp($compProf, $profTurno) === 0) {
                    $idsRechazar[] = intval($comp['id']);
                    $otrosRechazados[] = [
                        'id' => intval($comp['id']),
                        'nombre' => $comp['cliente_nombre'] ?: trim(($comp['nombre'] ?? '') . ' ' . ($comp['apellido'] ?? '')),
                        'celular' => $comp['cliente_celular'] ?: ($comp['celular'] ?? ''),
                        'fecha' => $comp['fecha'],
                        'hora' => $comp['hora'],
                        'servicio' => $comp['servicio'],
                        'profesional' => $comp['profesional'] ?? ''
                    ];
                }
            }

            if (!empty($idsRechazar)) {
                $placeholders = implode(',', array_fill(0, count($idsRechazar), '?'));
                $paramsUpd = array_merge($idsRechazar, [$id_negocio]);
                try {
                    $pdo->prepare("UPDATE turnos SET estado = 'eliminado', fecha_eliminado = NOW() WHERE id IN ($placeholders) AND id_negocio = ?")->execute($paramsUpd);
                } catch (Exception $eRej) {
                    // Fallback si no existe columna fecha_eliminado
                    $pdo->prepare("UPDATE turnos SET estado = 'eliminado' WHERE id IN ($placeholders) AND id_negocio = ?")->execute($paramsUpd);
                }
            }
        }

        echo json_encode([
            'success' => true,
            'turno' => [
                'id' => intval($turno['id']),
                'nombre' => $nombreC,
                'celular' => $celularC,
                'fecha' => $turno['fecha'],
                'hora' => $turno['hora'],
                'servicio' => $turno['servicio'],
                'profesional' => $profTurno
            ],
            'otros_pendientes_rechazados' => $otrosRechazados
        ]);
        exit;

    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Error de base de datos al confirmar: ' . $e->getMessage()]);
        exit;
    }
}
http_response_code(405);
echo json_encode(['success' => false, 'error' => 'Método no permitido.']);
?>