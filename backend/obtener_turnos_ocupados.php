<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/conexion.php';

$ruta = $_GET['n'] ?? '';
$profesional = $_GET['p'] ?? '';

if (empty($ruta)) { echo json_encode([]); exit; }

try {
    $stmtNegocio = $pdo->prepare("SELECT id FROM negocios WHERE ruta = :ruta LIMIT 1");
    $stmtNegocio->execute(['ruta' => $ruta]);
    $negocio = $stmtNegocio->fetch();

    if (!$negocio) { echo json_encode([]); exit; }
    $id_negocio = $negocio['id'];
    $ocupados = [];

   // Obtener intervalo_turnos
    $stmtConf = $pdo->prepare("SELECT intervalo_turnos FROM configuracion_web WHERE id_negocio = :id_negocio LIMIT 1");
    $stmtConf->execute(['id_negocio' => $id_negocio]);
    $conf = $stmtConf->fetch();
    
    // CORRECCIÓN: Evitar que el intervalo sea 0 o nulo (por defecto 30 min)
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

        //modificacion 2 por gemini

// 2. Turnos Ocupados (Calculando su duración en múltiples bloques de 30 minutos)
    $sqlTurnos = "SELECT t.fecha, t.hora, COALESCE(s.duracion_minutos, 30) as duracion 
                  FROM turnos t 
                  LEFT JOIN servicios s ON t.id_servicio = s.id 
                  WHERE t.id_negocio = :id_negocio AND t.estado IN ('confirmado', 'bloqueado')";
    $params = ['id_negocio' => $id_negocio];

    // CORRECCIÓN LÓGICA:
    if (!empty($profesional) && $profesional !== 'Cualquiera (Sin preferencia)' && $profesional !== 'Cualquiera' && $profesional !== 'columnas') {
        // Solo filtrar si eligieron a un profesional específico
        $sqlTurnos .= " AND (t.profesional = :profesional OR t.profesional = 'Cualquiera (Sin preferencia)' OR t.profesional IS NULL OR t.profesional = '')";
        $params['profesional'] = $profesional;
    }

    $stmtTurnos = $pdo->prepare($sqlTurnos);
    $stmtTurnos->execute($params);

    foreach ($stmtTurnos->fetchAll() as $t) {
        $f = $t['fecha'];
        if (!isset($ocupados[$f])) $ocupados[$f] = [];
        
        $horaInicio = strtotime($t['hora']);
        // Garantizar que la duración mínima sea el intervalo y dividir para sacar cuántos "bloques" ocupa
        $bloques = ceil(max((int)$t['duracion'], $intervalo) / $intervalo);
        
        for ($i = 0; $i < $bloques; $i++) {
            $ocupados[$f][] = date('H:i', $horaInicio + ($i * $intervalo * 60));
        }
    }
    
    echo json_encode($ocupados);
} catch (Exception $e) { echo json_encode([]); }
?>