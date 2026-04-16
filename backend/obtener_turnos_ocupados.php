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

try {
    $ocupados = [];

   // Obtener intervalo_turnos
    $stmtConf = $pdo->prepare("SELECT intervalo_turnos FROM configuracion_web WHERE id_negocio = :id_negocio LIMIT 1");
    $stmtConf->execute(['id_negocio' => $id_negocio]);
    $conf = $stmtConf->fetch();
    
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

    // 2. Turnos Ocupados (Calculando su duración en múltiples bloques)
    $sqlTurnos = "SELECT t.fecha, t.hora, COALESCE(s.duracion_minutos, 30) as duracion 
                  FROM turnos t 
                  LEFT JOIN servicios s ON t.id_servicio = s.id 
                  WHERE t.id_negocio = :id_negocio AND t.estado IN ('confirmado', 'bloqueado')";
    $params = ['id_negocio' => $id_negocio];

    if (!empty($profesional) && $profesional !== 'Cualquiera (Sin preferencia)' && $profesional !== 'Cualquiera' && $profesional !== 'columnas') {
        $sqlTurnos .= " AND (t.profesional = :profesional OR t.profesional = 'Cualquiera (Sin preferencia)' OR t.profesional IS NULL OR t.profesional = '')";
        $params['profesional'] = $profesional;
    }

    $stmtTurnos = $pdo->prepare($sqlTurnos);
    $stmtTurnos->execute($params);

    foreach ($stmtTurnos->fetchAll() as $t) {
        $f = $t['fecha'];
        if (!isset($ocupados[$f])) $ocupados[$f] = [];
        
        $horaInicio = strtotime($t['hora']);
        $bloques = ceil(max((int)$t['duracion'], $intervalo) / $intervalo);
        
        for ($i = 0; $i < $bloques; $i++) {
            $ocupados[$f][] = date('H:i', $horaInicio + ($i * $intervalo * 60));
        }
    }
    
    echo json_encode($ocupados);
} catch (Exception $e) { echo json_encode([]); }
?>