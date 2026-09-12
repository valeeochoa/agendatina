<?php
session_start();
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/conexion.php';

$ruta = $_GET['n'] ?? '';
$profesional = $_GET['p'] ?? '';

$id_negocio = null;

if (empty($ruta)) {
    // Si no viene la ruta por URL, intenta usar la sesión del administrador
    if (isset($_SESSION['id_negocio'])) {
        $id_negocio = $_SESSION['id_negocio'];
    } else {
        echo json_encode([]); exit;
    }
} else {
    $stmtNegocio = $pdo->prepare("SELECT id FROM negocios WHERE ruta = :ruta LIMIT 1");
    $stmtNegocio->execute(['ruta' => $ruta]);
    $negocio = $stmtNegocio->fetch();
    if (!$negocio) { echo json_encode([]); exit; }
    $id_negocio = $negocio['id'];
}

// Liberar el archivo de sesión para que el dashboard no se quede colgado
session_write_close();

try {
    $ocupados = [];

   // Obtener configuración web del negocio (horarios, días laborables, etc.)
    $stmtConf = $pdo->prepare("SELECT hora_apertura, hora_cierre, dias_trabajo, horarios_detallados_json, intervalo_turnos, primer_dia_semana FROM configuracion_web WHERE id_negocio = :id_negocio LIMIT 1");
    $stmtConf->execute(['id_negocio' => $id_negocio]);
    $conf = $stmtConf->fetch(PDO::FETCH_ASSOC);

    if ($conf) {
        $ocupados['_config'] = [
            'hora_apertura' => $conf['hora_apertura'] ?? '09:00',
            'hora_cierre' => $conf['hora_cierre'] ?? '18:00',
            'dias_trabajo' => $conf['dias_trabajo'] ?? '1,2,3,4,5,6',
            'horarios_detallados_json' => $conf['horarios_detallados_json'] ?? '{}',
            'intervalo_turnos' => $conf['intervalo_turnos'] ?? '30',
            'primer_dia_semana' => (int)($conf['primer_dia_semana'] ?? 1)
        ];
    }
    
    $intervaloRaw = $conf && isset($conf['intervalo_turnos']) && is_numeric($conf['intervalo_turnos']) ? (int)$conf['intervalo_turnos'] : 30;
    $intervalo = $intervaloRaw > 0 ? $intervaloRaw : 30;

    // 1. Días bloqueados completos (Manuales)
    $stmtBloqueos = $pdo->prepare("SELECT fecha, profesional FROM dias_bloqueados WHERE id_negocio = :id_negocio");
    $stmtBloqueos->execute(['id_negocio' => $id_negocio]);
    foreach ($stmtBloqueos->fetchAll() as $b) {
        $f = $b['fecha'];
        if (!isset($ocupados[$f])) $ocupados[$f] = [];
        if (empty($b['profesional'])) { $ocupados[$f][] = 'blocked_day'; } 
        else if ($b['profesional'] === $profesional) { $ocupados[$f][] = 'blocked_day_prof'; }
    }

    // 2. Turnos Ocupados (Calculando su duración y cupos por servicio)
    $sqlTurnos = "SELECT t.fecha, t.hora, COALESCE(s.duracion_minutos, 30) as duracion, t.id_servicio, COALESCE(s.cupo_maximo, s.capacidad, 1) as cupo_maximo, t.profesional 
                  FROM turnos t 
                  LEFT JOIN servicios s ON t.id_servicio = s.id 
                  WHERE t.id_negocio = :id_negocio AND t.estado IN ('pendiente', 'confirmado', 'bloqueado')";
    $params = ['id_negocio' => $id_negocio];

    if (!empty($profesional) && $profesional !== 'Cualquiera (Sin preferencia)' && $profesional !== 'Cualquiera' && $profesional !== 'columnas') {
        $sqlTurnos .= " AND (t.profesional = :profesional OR t.profesional = 'Cualquiera (Sin preferencia)' OR t.profesional IS NULL OR t.profesional = '')";
        $params['profesional'] = $profesional;
    }

    $stmtTurnos = $pdo->prepare($sqlTurnos);
    $stmtTurnos->execute($params);

    $conteoTurnosPorSlot = [];
    $maxCupoPorSlot = [];
    $ocupados['_details'] = [];

    // Usar intervalos finos de 15 minutos para cubrir exactamente el tiempo ocupado por la atención
    $sliceStep = 15;

    foreach ($stmtTurnos->fetchAll() as $t) {
        $f = $t['fecha'];
        if (!isset($ocupados[$f])) $ocupados[$f] = [];
        if (!isset($ocupados['_details'][$f])) $ocupados['_details'][$f] = [];
        
        $tsStart = strtotime($t['hora']);
        $duracionMin = max(15, (int)$t['duracion']);
        $tsEnd = $tsStart + ($duracionMin * 60);
        
        $hStart = date('H:i', $tsStart);
        $hEnd = date('H:i', $tsEnd);
        $cupo = max(1, (int)$t['cupo_maximo']);
        $prof = $t['profesional'] ?? '';

        list($startH, $startM) = explode(':', $hStart);
        list($endH, $endM) = explode(':', $hEnd);
        $startMins = ((int)$startH * 60) + (int)$startM;
        $endMins = ((int)$endH * 60) + (int)$endM;

        $ocupados['_details'][$f][] = [
            'start' => $hStart,
            'end' => $hEnd,
            'startMins' => $startMins,
            'endMins' => $endMins,
            'duracion' => $duracionMin,
            'cupo_maximo' => $cupo,
            'profesional' => $prof,
            'id_servicio' => $t['id_servicio'] ?? null
        ];

        // Guardar conteo exacto por servicio y hora para el calendario de clases
        if (!isset($ocupados['_counts'])) $ocupados['_counts'] = [];
        if (!isset($ocupados['_counts_hora'])) $ocupados['_counts_hora'] = [];

        $servId = (int)($t['id_servicio'] ?? 0);
        $keyServSlot = $f . '_' . $servId . '_' . $hStart;
        $keyHoraSlot = $f . '_' . $hStart;

        if (!isset($ocupados['_counts'][$keyServSlot])) $ocupados['_counts'][$keyServSlot] = 0;
        $ocupados['_counts'][$keyServSlot]++;

        if (!isset($ocupados['_counts_hora'][$keyHoraSlot])) $ocupados['_counts_hora'][$keyHoraSlot] = 0;
        $ocupados['_counts_hora'][$keyHoraSlot]++;
        
        // Agregar los cortes de tiempo ocupados durante la atención (sin incluir la hora de finalización exacta)
        for ($subMins = $startMins; $subMins < $endMins; $subMins += $sliceStep) {
            $curH = str_pad((string)floor($subMins / 60), 2, '0', STR_PAD_LEFT);
            $curM = str_pad((string)($subMins % 60), 2, '0', STR_PAD_LEFT);
            $slotHora = "{$curH}:{$curM}";
            $keySlot = $f . '_' . $slotHora;
            
            if ($cupo > 1) {
                if (!isset($conteoTurnosPorSlot[$keySlot])) $conteoTurnosPorSlot[$keySlot] = 0;
                $conteoTurnosPorSlot[$keySlot]++;
                $maxCupoPorSlot[$keySlot] = $cupo;
                
                if ($conteoTurnosPorSlot[$keySlot] >= $maxCupoPorSlot[$keySlot]) {
                    if (!in_array($slotHora, $ocupados[$f])) $ocupados[$f][] = $slotHora;
                }
            } else {
                if (!in_array($slotHora, $ocupados[$f])) $ocupados[$f][] = $slotHora;
            }
        }
    }
    
    echo json_encode($ocupados);
} catch (Exception $e) { echo json_encode([]); }
?>