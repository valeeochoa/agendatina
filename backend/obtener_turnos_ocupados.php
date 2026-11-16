<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/conexion.php';

$ruta = $_GET['n'] ?? '';
$profesional = $_GET['p'] ?? '';

$id_negocio = null;

if (!empty($ruta)) {
    $stmtNegocio = $pdo->prepare("SELECT id FROM negocios WHERE ruta = :ruta LIMIT 1");
    $stmtNegocio->execute(['ruta' => $ruta]);
    $negocio = $stmtNegocio->fetch();
    if ($negocio) {
        $id_negocio = $negocio['id'];
    }
}

if (!$id_negocio) {
    if (isset($_SESSION['id_negocio'])) {
        $id_negocio = $_SESSION['id_negocio'];
    } else {
        echo json_encode([]); exit;
    }
}

// Determinar si quien consulta es el dueño/admin autenticado del negocio
$esAdminDelNegocio = (isset($_SESSION['id_negocio']) && (int)$_SESSION['id_negocio'] === (int)$id_negocio);

// Permisos del usuario en sesión sincronizados en vivo desde personal_negocio
require_once __DIR__ . '/helpers/permisos_helper.php';
$ctx = ($esAdminDelNegocio && isset($_SESSION['user_id']))
    ? sincronizarPermisosSesion($pdo, $id_negocio, $_SESSION['user_id'])
    : ['is_prof' => false, 'permisos' => obtenerPermisosPorDefecto('admin'), 'nombre_completo' => ''];
$isProfLogged = $ctx['is_prof'];
$userPerms = $ctx['permisos'];
$verTodosTurnos = !empty($userPerms['ver_calendario_otros']);
$profesionalSessionName = trim($ctx['nombre_completo']);

// Si es profesional y NO tiene permiso para ver el calendario de otros, forzar su propio nombre
if ($isProfLogged && !$verTodosTurnos && !empty($profesionalSessionName)) {
    $profesional = $profesionalSessionName;
}

// Liberar el archivo de sesión para que el dashboard no se quede colgado
session_write_close();

try {
    $ocupados = [];

    // Auto-migración columna created_at en turnos si no existe
    try { $pdo->query("SELECT created_at FROM turnos LIMIT 1"); } 
    catch (Exception $e) { try { $pdo->exec("ALTER TABLE turnos ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP"); } catch (Exception $ex) {} }

    // Auto-liberar turnos pendientes de confirmación tras 1 hora (3600 seg) si son con seña / transferencia
    try {
        $pdo->exec("UPDATE turnos 
            SET estado = 'cancelado', notas = CONCAT(COALESCE(notas, ''), ' [Auto-liberado por falta de confirmación de seña en 1 hora]') 
            WHERE estado = 'pendiente' 
              AND (metodo_pago LIKE '%transferencia%' OR metodo_pago LIKE '%seña%')
              AND created_at IS NOT NULL 
              AND created_at < DATE_SUB(NOW(), INTERVAL 1 HOUR)");
    } catch (Exception $eAutoLib) {}

   // Obtener configuración web del negocio (horarios, días laborables, etc.)
    try { $pdo->query("SELECT usar_cupones_descuento FROM configuracion_web LIMIT 1"); } catch (Exception $eCol) { try { $pdo->exec("ALTER TABLE configuracion_web ADD COLUMN usar_cupones_descuento TINYINT(1) DEFAULT 0"); } catch (Exception $eCol2) {} }
    try { $pdo->query("SELECT cupon_descuento_pct FROM configuracion_web LIMIT 1"); } catch (Exception $eCol) { try { $pdo->exec("ALTER TABLE configuracion_web ADD COLUMN cupon_descuento_pct INT DEFAULT 10"); } catch (Exception $eCol2) {} }
    try { $pdo->query("SELECT cupon_duracion_horas FROM configuracion_web LIMIT 1"); } catch (Exception $eCol) { try { $pdo->exec("ALTER TABLE configuracion_web ADD COLUMN cupon_duracion_horas INT DEFAULT 24"); } catch (Exception $eCol2) {} }
    try { $pdo->query("SELECT reserva_sena_1h FROM configuracion_web LIMIT 1"); } catch (Exception $eCol) { try { $pdo->exec("ALTER TABLE configuracion_web ADD COLUMN reserva_sena_1h TINYINT(1) DEFAULT 0"); } catch (Exception $eCol2) {} }
    try { $pdo->query("SELECT tiempo_entre_turnos FROM configuracion_web LIMIT 1"); } catch (Exception $eCol) { try { $pdo->exec("ALTER TABLE configuracion_web ADD COLUMN tiempo_entre_turnos INT DEFAULT 0"); } catch (Exception $eCol2) {} }
    try { $pdo->query("SELECT anticipacion_cupos_min FROM configuracion_web LIMIT 1"); } catch (Exception $eCol) { try { $pdo->exec("ALTER TABLE configuracion_web ADD COLUMN anticipacion_cupos_min INT DEFAULT 0"); } catch (Exception $eCol2) {} }
    try { $pdo->query("SELECT color_primario_web FROM configuracion_web LIMIT 1"); } catch (Exception $eCol) { try { $pdo->exec("ALTER TABLE configuracion_web ADD COLUMN color_primario_web VARCHAR(20) DEFAULT '#D11149'"); } catch (Exception $eCol2) {} }
    try { $pdo->query("SELECT color_secundario_web FROM configuracion_web LIMIT 1"); } catch (Exception $eCol) { try { $pdo->exec("ALTER TABLE configuracion_web ADD COLUMN color_secundario_web VARCHAR(20) DEFAULT '#FC8712'"); } catch (Exception $eCol2) {} }
    $stmtConf = $pdo->prepare("SELECT color_primario, color_secundario, color_primario_web, color_secundario_web, color_fondo, hora_apertura, hora_cierre, hora_descanso_inicio, hora_descanso_fin, dias_trabajo, horarios_detallados_json, intervalo_turnos, tiempo_entre_turnos, primer_dia_semana, turnos_simultaneos, modo_reservas, anticipacion_turno_min, anticipacion_cupos_min, usar_cupones_descuento, cupon_descuento_pct, cupon_duracion_horas, reserva_sena_1h, metodos_pago, datos_transferencia, porcentaje_sena, whatsapp_comprobante FROM configuracion_web WHERE id_negocio = :id_negocio LIMIT 1");
    $stmtConf->execute(['id_negocio' => $id_negocio]);
    $conf = $stmtConf->fetch(PDO::FETCH_ASSOC);

    // Asegurar columnas de cobro/horarios en personal_negocio
    foreach ([
        'datos_transferencia' => 'TEXT DEFAULT NULL',
        'metodos_pago' => 'VARCHAR(255) DEFAULT NULL',
        'porcentaje_sena' => 'INT DEFAULT NULL',
        'reserva_sena_1h' => 'TINYINT(1) DEFAULT NULL',
        'whatsapp_comprobante' => 'VARCHAR(60) DEFAULT NULL'
    ] as $colPn => $defPn) {
        try { $pdo->query("SELECT $colPn FROM personal_negocio LIMIT 1"); } catch (Exception $eCol) { try { $pdo->exec("ALTER TABLE personal_negocio ADD COLUMN $colPn $defPn"); } catch (Exception $eCol2) {} }
    }

    // Si se consulta para un profesional específico o el usuario logueado es profesional, buscar sus horarios y formas de pago propias
    $targetProfName = null;
    if ($isProfLogged && !$verTodosTurnos && !empty($profesionalSessionName)) {
        $targetProfName = $profesionalSessionName;
    } else if (!empty($profesional) && $profesional !== 'Cualquiera (Sin preferencia)' && $profesional !== 'Cualquiera' && $profesional !== 'columnas' && $profesional !== 'todos') {
        $targetProfName = $profesional;
    } else if ($isProfLogged) {
        $targetProfName = $profesionalSessionName;
    }

    if ($targetProfName && $id_negocio) {
        try {
            $stmtProfPn = $pdo->prepare("SELECT pn.dias_trabajo, pn.hora_apertura, pn.hora_cierre, pn.hora_descanso_inicio, pn.hora_descanso_fin, pn.horarios_detallados_json, pn.datos_transferencia, pn.metodos_pago, pn.porcentaje_sena, pn.reserva_sena_1h, pn.whatsapp_comprobante 
                                         FROM personal_negocio pn 
                                         JOIN usuarios u ON u.id = pn.id_usuario 
                                         WHERE pn.id_negocio = :id AND (u.nombre_completo = :p OR pn.id_usuario = :p_uid) 
                                         LIMIT 1");
            $stmtProfPn->execute([
                'id' => $id_negocio,
                'p' => $targetProfName,
                'p_uid' => is_numeric($targetProfName) ? (int)$targetProfName : 0
            ]);
            $profSched = $stmtProfPn->fetch(PDO::FETCH_ASSOC);
            if ($profSched) {
                if (!empty($profSched['hora_apertura'])) $conf['hora_apertura'] = $profSched['hora_apertura'];
                if (!empty($profSched['hora_cierre'])) $conf['hora_cierre'] = $profSched['hora_cierre'];
                if (isset($profSched['hora_descanso_inicio']) && $profSched['hora_descanso_inicio'] !== '') $conf['hora_descanso_inicio'] = $profSched['hora_descanso_inicio'];
                if (isset($profSched['hora_descanso_fin']) && $profSched['hora_descanso_fin'] !== '') $conf['hora_descanso_fin'] = $profSched['hora_descanso_fin'];
                if (!empty($profSched['dias_trabajo'])) $conf['dias_trabajo'] = $profSched['dias_trabajo'];
                if (!empty($profSched['horarios_detallados_json']) && $profSched['horarios_detallados_json'] !== '{}') {
                    $conf['horarios_detallados_json'] = $profSched['horarios_detallados_json'];
                }
                if (!empty(trim($profSched['datos_transferencia'] ?? ''))) {
                    $conf['datos_transferencia'] = trim($profSched['datos_transferencia']);
                }
                if (!empty(trim($profSched['metodos_pago'] ?? ''))) {
                    $conf['metodos_pago'] = trim($profSched['metodos_pago']);
                }
                if (isset($profSched['porcentaje_sena']) && $profSched['porcentaje_sena'] !== null) {
                    $conf['porcentaje_sena'] = (int)$profSched['porcentaje_sena'];
                }
                if (isset($profSched['reserva_sena_1h']) && $profSched['reserva_sena_1h'] !== null) {
                    $conf['reserva_sena_1h'] = (int)$profSched['reserva_sena_1h'];
                }
                if (!empty(trim($profSched['whatsapp_comprobante'] ?? ''))) {
                    $conf['whatsapp_comprobante'] = trim($profSched['whatsapp_comprobante']);
                }
            }
        } catch (Exception $eProfSched) {}
    }

    $permiteSimultaneos = ($conf && (($conf['turnos_simultaneos'] ?? 'no') === 'si' || ($conf['modo_reservas'] ?? '') === 'cupos_alumnos'));

    $hApertura = (!empty($conf['hora_apertura']) && $conf['hora_apertura'] !== '00:00:00' && $conf['hora_apertura'] !== '00:00') ? substr($conf['hora_apertura'], 0, 5) : '09:00';
    $hCierre = (!empty($conf['hora_cierre']) && $conf['hora_cierre'] !== '00:00:00' && $conf['hora_cierre'] !== '00:00') ? substr($conf['hora_cierre'], 0, 5) : '18:00';
    $diasTrabajo = !empty($conf['dias_trabajo']) ? $conf['dias_trabajo'] : '1,2,3,4,5';

    // Resolver mapa de datos de transferencia y cobro por profesional
    $profsTransferencia = [];
    $profsPagos = [];
    try {
        $stmtProfTrList = $pdo->prepare("SELECT LOWER(TRIM(u.nombre_completo)) AS p_nombre, pn.datos_transferencia, pn.metodos_pago, pn.porcentaje_sena, pn.reserva_sena_1h, pn.whatsapp_comprobante FROM personal_negocio pn JOIN usuarios u ON u.id = pn.id_usuario WHERE pn.id_negocio = :id_negocio");
        $stmtProfTrList->execute(['id_negocio' => $id_negocio]);
        foreach ($stmtProfTrList->fetchAll(PDO::FETCH_ASSOC) as $ptr) {
            if (!empty($ptr['p_nombre'])) {
                if (!empty(trim($ptr['datos_transferencia'] ?? ''))) {
                    $profsTransferencia[$ptr['p_nombre']] = trim($ptr['datos_transferencia']);
                }
                $profsPagos[$ptr['p_nombre']] = [
                    'datos_transferencia' => trim($ptr['datos_transferencia'] ?? ''),
                    'metodos_pago' => trim($ptr['metodos_pago'] ?? ''),
                    'porcentaje_sena' => $ptr['porcentaje_sena'] !== null ? (int)$ptr['porcentaje_sena'] : null,
                    'reserva_sena_1h' => $ptr['reserva_sena_1h'] !== null ? (int)$ptr['reserva_sena_1h'] : null,
                    'whatsapp_comprobante' => trim($ptr['whatsapp_comprobante'] ?? '')
                ];
            }
        }
    } catch (Exception $eTrList) {}

    $datosTransferenciaConfig = $conf['datos_transferencia'] ?? '';
    if (!empty($profesional) && isset($profsTransferencia[strtolower(trim($profesional))])) {
        $datosTransferenciaConfig = $profsTransferencia[strtolower(trim($profesional))];
    }

    $ocupados['_config'] = [
        'color_primario' => !empty($conf['color_primario_web']) ? $conf['color_primario_web'] : (!empty($conf['color_primario']) ? $conf['color_primario'] : '#D11149'),
        'color_secundario' => !empty($conf['color_secundario_web']) ? $conf['color_secundario_web'] : (!empty($conf['color_secundario']) ? $conf['color_secundario'] : '#FC8712'),
        'color_fondo' => !empty($conf['color_fondo']) ? $conf['color_fondo'] : '#F8FAFC',
        'hora_apertura' => $hApertura,
        'hora_cierre' => $hCierre,
        'hora_descanso_inicio' => $conf['hora_descanso_inicio'] ?? '',
        'hora_descanso_fin' => $conf['hora_descanso_fin'] ?? '',
        'dias_trabajo' => $diasTrabajo,
        'horarios_detallados_json' => !empty($conf['horarios_detallados_json']) ? $conf['horarios_detallados_json'] : '{}',
        'intervalo_turnos' => !empty($conf['intervalo_turnos']) ? $conf['intervalo_turnos'] : 'servicio',
        'tiempo_entre_turnos' => max(0, (int)($conf['tiempo_entre_turnos'] ?? 0)),
        'primer_dia_semana' => (int)($conf['primer_dia_semana'] ?? 1),
        'turnos_simultaneos' => $permiteSimultaneos ? 'si' : 'no',
        'modo_reservas' => $conf['modo_reservas'] ?? 'libre',
        'anticipacion_turno_min' => max(0, (int)($conf['anticipacion_turno_min'] ?? 0)),
        'anticipacion_cupos_min' => max(0, (int)($conf['anticipacion_cupos_min'] ?? 0)),
        'usar_cupones_descuento' => (int)($conf['usar_cupones_descuento'] ?? 0),
        'cupon_descuento_pct' => (int)($conf['cupon_descuento_pct'] ?? 10),
        'cupon_duracion_horas' => (int)($conf['cupon_duracion_horas'] ?? 24),
        'reserva_sena_1h' => (int)($conf['reserva_sena_1h'] ?? 0),
        'metodos_pago' => $conf['metodos_pago'] ?? '',
        'datos_transferencia' => $datosTransferenciaConfig,
        'porcentaje_sena' => (int)($conf['porcentaje_sena'] ?? 50),
        'whatsapp_comprobante' => $conf['whatsapp_comprobante'] ?? '',
        'profs_datos_transferencia' => $profsTransferencia,
        'profs_pagos' => $profsPagos,
        'profesional_fijado' => ($isProfLogged && !$verTodosTurnos) ? $profesionalSessionName : null,
        'es_profesional_propio' => ($isProfLogged && !$verTodosTurnos)
    ];
    
    $intervaloRaw = $conf && isset($conf['intervalo_turnos']) && is_numeric($conf['intervalo_turnos']) ? (int)$conf['intervalo_turnos'] : 30;
    $intervalo = $intervaloRaw > 0 ? $intervaloRaw : 30;

    // 1. Días bloqueados completos (Manuales)
    $stmtBloqueos = $pdo->prepare("SELECT fecha, profesional FROM dias_bloqueados WHERE id_negocio = :id_negocio");
    $stmtBloqueos->execute(['id_negocio' => $id_negocio]);
    foreach ($stmtBloqueos->fetchAll() as $b) {
        $f = $b['fecha'];
        if (!isset($ocupados[$f])) $ocupados[$f] = [];
        if (empty($b['profesional'])) {
            $ocupados[$f][] = 'blocked_day';
        } else if ($isProfLogged && !$verTodosTurnos && !empty($profesionalSessionName)) {
            if (strcasecmp(trim($b['profesional']), $profesionalSessionName) === 0) {
                $ocupados[$f][] = 'blocked_day_prof';
            }
        } else if (!empty($profesional) && strcasecmp(trim($b['profesional']), trim($profesional)) === 0) {
            $ocupados[$f][] = 'blocked_day_prof';
        }
    }

    // 2. Turnos Ocupados (Calculando su duración y cupos por servicio, excluyendo clases del Portal de Alumnos)
    $sqlTurnos = "SELECT t.fecha, t.hora, COALESCE(s.duracion_minutos, 30) as duracion, t.id_servicio, COALESCE(s.cupo_maximo, s.capacidad, 1) as cupo_maximo, t.profesional, t.cliente_nombre, t.servicio 
                  FROM turnos t 
                  LEFT JOIN servicios s ON t.id_servicio = s.id 
                  WHERE t.id_negocio = :id_negocio 
                    AND t.estado IN ('pendiente', 'confirmado', 'bloqueado')
                    AND COALESCE(s.tipo_servicio, 'calendario') != 'alumnos'
                    AND COALESCE(s.cupo_maximo, s.capacidad, 1) <= 1
                    AND COALESCE(t.metodo_pago, '') != 'Pase de Alumno'";
    $params = ['id_negocio' => $id_negocio];

    if ($isProfLogged && !$verTodosTurnos && !empty($profesionalSessionName)) {
        $sqlTurnos .= " AND t.profesional IS NOT NULL AND TRIM(t.profesional) != '' AND LOWER(TRIM(t.profesional)) = LOWER(TRIM(:mi_prof_nombre))";
        $params['mi_prof_nombre'] = $profesionalSessionName;
    } else if (!empty($profesional) && $profesional !== 'Cualquiera (Sin preferencia)' && $profesional !== 'Cualquiera' && $profesional !== 'columnas' && $profesional !== 'todos') {
        $sqlTurnos .= " AND (t.profesional = :profesional OR t.profesional = 'Cualquiera (Sin preferencia)' OR t.profesional IS NULL OR t.profesional = '')";
        $params['profesional'] = $profesional;
    }

    $stmtTurnos = $pdo->prepare($sqlTurnos);
    $stmtTurnos->execute($params);

    $conteoTurnosPorSlot = [];
    $maxCupoPorSlot = [];
    $ocupados['_details'] = [];
    $ocupados['_alumnos'] = [];
    $ocupados['_by_service'] = [];
    $ocupados['_by_prof'] = [];
    $hasProfFilter = ($isProfLogged && !$verTodosTurnos && !empty($profesionalSessionName)) ||
                     (!empty($profesional) && $profesional !== 'Cualquiera (Sin preferencia)' && $profesional !== 'Cualquiera' && $profesional !== 'columnas' && $profesional !== 'todos');

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
        $cliNom = trim($t['cliente_nombre'] ?? '');

        list($startH, $startM) = explode(':', $hStart);
        list($endH, $endM) = explode(':', $hEnd);
        $startMins = ((int)$startH * 60) + (int)$startM;
        $endMins = ((int)$endH * 60) + (int)$endM;
        $tiempoEntreTurnos = max(0, (int)($conf['tiempo_entre_turnos'] ?? 0));
        $endMinsWithBuffer = $endMins + $tiempoEntreTurnos;

        $ocupados['_details'][$f][] = [
            'start' => $hStart,
            'end' => $hEnd,
            'startMins' => $startMins,
            'endMins' => $endMins,
            'endMinsWithBuffer' => $endMinsWithBuffer,
            'duracion' => $duracionMin,
            'cupo_maximo' => $cupo,
            'profesional' => $prof,
            'id_servicio' => $t['id_servicio'] ?? null,
            'servicio' => $esAdminDelNegocio ? ($t['servicio'] ?? null) : 'Reservado',
            'cliente_nombre' => $esAdminDelNegocio ? $cliNom : 'Ocupado'
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

        if (!isset($ocupados['_alumnos'][$keyServSlot])) $ocupados['_alumnos'][$keyServSlot] = [];
        if (!empty($cliNom) && !in_array($cliNom, $ocupados['_alumnos'][$keyServSlot])) {
            $ocupados['_alumnos'][$keyServSlot][] = $cliNom;
        }
        
        // Agregar los cortes de tiempo ocupados durante la atención
        if (!$permiteSimultaneos) {
            // El negocio NO permite simultáneos por profesional: cada profesional bloquea únicamente sus propios horarios.
            $profNorm = strtolower(trim((string)$prof));
            $isUnassignedProf = ($profNorm === '' || $profNorm === 'cualquiera (sin preferencia)' || $profNorm === 'cualquiera');
            if (!$isUnassignedProf) {
                if (!isset($ocupados['_by_prof'][$profNorm])) $ocupados['_by_prof'][$profNorm] = [];
                if (!isset($ocupados['_by_prof'][$profNorm][$f])) $ocupados['_by_prof'][$profNorm][$f] = [];
            }

            for ($subMins = $startMins; $subMins < $endMinsWithBuffer; $subMins += $sliceStep) {
                $curH = str_pad((string)floor($subMins / 60), 2, '0', STR_PAD_LEFT);
                $curM = str_pad((string)($subMins % 60), 2, '0', STR_PAD_LEFT);
                $slotHora = "{$curH}:{$curM}";
                $keySlot = $f . '_' . ($isUnassignedProf ? 'all' : $profNorm) . '_' . $slotHora;
                $slotLleno = false;

                if ($cupo > 1) {
                    if (!isset($conteoTurnosPorSlot[$keySlot])) $conteoTurnosPorSlot[$keySlot] = 0;
                    $conteoTurnosPorSlot[$keySlot]++;
                    $maxCupoPorSlot[$keySlot] = $cupo;
                    if ($conteoTurnosPorSlot[$keySlot] >= $maxCupoPorSlot[$keySlot]) {
                        $slotLleno = true;
                    }
                } else {
                    $slotLleno = true;
                }

                if ($slotLleno) {
                    if (!$isUnassignedProf && !in_array($slotHora, $ocupados['_by_prof'][$profNorm][$f])) {
                        $ocupados['_by_prof'][$profNorm][$f][] = $slotHora;
                    }
                    if (($hasProfFilter || $isUnassignedProf) && !in_array($slotHora, $ocupados[$f])) {
                        $ocupados[$f][] = $slotHora;
                    }
                }
            }
        } else {
            // El negocio SÍ permite simultáneos: cada servicio tiene su propio calendario y cupos independientes.
            if (!isset($ocupados['_by_service'][$servId])) $ocupados['_by_service'][$servId] = [];
            if (!isset($ocupados['_by_service'][$servId][$f])) $ocupados['_by_service'][$servId][$f] = [];

            for ($subMins = $startMins; $subMins < $endMinsWithBuffer; $subMins += $sliceStep) {
                $curH = str_pad((string)floor($subMins / 60), 2, '0', STR_PAD_LEFT);
                $curM = str_pad((string)($subMins % 60), 2, '0', STR_PAD_LEFT);
                $slotHora = "{$curH}:{$curM}";
                $keySlotServ = $f . '_' . $servId . '_' . $slotHora;

                if (!isset($conteoTurnosPorSlot[$keySlotServ])) $conteoTurnosPorSlot[$keySlotServ] = 0;
                $conteoTurnosPorSlot[$keySlotServ]++;

                if ($conteoTurnosPorSlot[$keySlotServ] >= $cupo) {
                    if (!in_array($slotHora, $ocupados['_by_service'][$servId][$f])) {
                        $ocupados['_by_service'][$servId][$f][] = $slotHora;
                    }
                }
            }
        }
    }
    
    echo json_encode($ocupados);
} catch (Exception $e) { echo json_encode([]); }
?>