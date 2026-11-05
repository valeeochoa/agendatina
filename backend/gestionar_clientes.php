<?php
session_start();
header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/conexion.php';

// Auto-crear tabla de clientes_negocio si no existe
try {
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS clientes_negocio (
            id INT AUTO_INCREMENT PRIMARY KEY,
            id_negocio INT NOT NULL,
            nombre_completo VARCHAR(255) NOT NULL,
            email VARCHAR(255) NOT NULL,
            telefono VARCHAR(50) DEFAULT '',
            password VARCHAR(255) DEFAULT NULL,
            pases_disponibles INT DEFAULT 0,
            pases_totales INT DEFAULT 0,
            fecha_vencimiento DATE DEFAULT NULL,
            notas TEXT DEFAULT NULL,
            estado ENUM('activo', 'pendiente_activacion', 'inactivo') DEFAULT 'activo',
            fecha_alta DATETIME DEFAULT CURRENT_TIMESTAMP,
            KEY (id_negocio),
            KEY (email)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ");
} catch(Exception $e) {}

// Asegurar existencia de nuevas columnas por si la tabla ya existía anteriormente
try { $pdo->query("SELECT color FROM servicios LIMIT 1"); } 
catch(Exception $e) { $pdo->exec("ALTER TABLE servicios ADD COLUMN color VARCHAR(30) DEFAULT '#d11149'"); }

try { $pdo->query("SELECT pases_totales FROM clientes_negocio LIMIT 1"); } 
catch(Exception $e) { $pdo->exec("ALTER TABLE clientes_negocio ADD COLUMN pases_totales INT DEFAULT 0"); }

try { $pdo->query("SELECT fecha_vencimiento FROM clientes_negocio LIMIT 1"); } 
catch(Exception $e) { $pdo->exec("ALTER TABLE clientes_negocio ADD COLUMN fecha_vencimiento DATE DEFAULT NULL"); }

try { $pdo->query("SELECT notas FROM clientes_negocio LIMIT 1"); } 
catch(Exception $e) { $pdo->exec("ALTER TABLE clientes_negocio ADD COLUMN notas TEXT DEFAULT NULL"); }

try { $pdo->query("SELECT cancelaciones_permitidas FROM clientes_negocio LIMIT 1"); } 
catch(Exception $e) { $pdo->exec("ALTER TABLE clientes_negocio ADD COLUMN cancelaciones_permitidas INT DEFAULT NULL"); }

try { $pdo->query("SELECT cancelaciones_restantes FROM clientes_negocio LIMIT 1"); } 
catch(Exception $e) { $pdo->exec("ALTER TABLE clientes_negocio ADD COLUMN cancelaciones_restantes INT DEFAULT NULL"); }

try { $pdo->query("SELECT id_servicio FROM clientes_negocio LIMIT 1"); } 
catch(Exception $e) { $pdo->exec("ALTER TABLE clientes_negocio ADD COLUMN id_servicio INT DEFAULT NULL"); }

try { $pdo->query("SELECT servicio FROM clientes_negocio LIMIT 1"); } 
catch(Exception $e) { $pdo->exec("ALTER TABLE clientes_negocio ADD COLUMN servicio VARCHAR(255) DEFAULT NULL"); }

try { $pdo->query("SELECT servicios_pases_json FROM clientes_negocio LIMIT 1"); } 
catch(Exception $e) { $pdo->exec("ALTER TABLE clientes_negocio ADD COLUMN servicios_pases_json LONGTEXT DEFAULT NULL"); }





$id_negocio = $_SESSION['id_negocio'] ?? null;
$ruta_param = trim($_GET['n'] ?? $_POST['n'] ?? '');
$negRow = null;

// Resolver id_negocio si viene por ruta amigable (ej: ?n=demo) o por parámetro
if (!empty($ruta_param)) {
    try {
        $stmtRuta = $pdo->prepare("SELECT id, plan, ruta, nombre_fantasia FROM negocios WHERE LOWER(TRIM(ruta)) = LOWER(TRIM(:ruta)) LIMIT 1");
        $stmtRuta->execute(['ruta' => $ruta_param]);
        $negRow = $stmtRuta->fetch(PDO::FETCH_ASSOC);
        if ($negRow) {
            $id_negocio = (int)$negRow['id'];
        }
    } catch (Exception $eR) {}
}

if (!$id_negocio && !empty($_GET['id_negocio'])) {
    $id_negocio = (int)$_GET['id_negocio'];
}

if (!$id_negocio) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'No autorizado. Inicia sesión.']);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];

// Detectar si es entorno demo
$is_demo = (isset($_SESSION['is_demo']) && $_SESSION['is_demo']) 
        || (isset($negRow['ruta']) && strpos(strtolower($negRow['ruta']), 'demo') !== false)
        || (!empty($_SESSION['nombre_completo']) && strpos(strtolower($_SESSION['nombre_completo']), 'demo') !== false);

if ($is_demo) {
    require_once __DIR__ . '/helpers/demo_helper.php';
    if (function_exists('asegurarDatosDemo')) {
        asegurarDatosDemo($pdo, $id_negocio);
    }
}

// Verificar plan del negocio
$is_demo = isset($_SESSION['is_demo']) && $_SESSION['is_demo'];
$plan_negocio = 'Simple';
try {
    $stmtPlan = $pdo->prepare("SELECT plan FROM negocios WHERE id = :id LIMIT 1");
    $stmtPlan->execute(['id' => $id_negocio]);
    $negocioData = $stmtPlan->fetch(PDO::FETCH_ASSOC);
    if ($negocioData && !empty($negocioData['plan'])) {
        $plan_negocio = $negocioData['plan'];
    }
} catch (Exception $ePlan) {}

$planLower = strtolower($plan_negocio);
$is_premium = $is_demo || (strpos($planLower, 'premium') !== false) || (strpos($planLower, 'completo') !== false);

$negocio_ruta = '';
$negocio_nombre = '';
try {
    $stmtPlan = $pdo->prepare("SELECT plan, ruta, nombre_fantasia FROM negocios WHERE id = :id LIMIT 1");
    $stmtPlan->execute(['id' => $id_negocio]);
    $negocioData = $stmtPlan->fetch(PDO::FETCH_ASSOC);
    if ($negocioData) {
        if (!empty($negocioData['plan'])) $plan_negocio = $negocioData['plan'];
        $negocio_ruta = $negocioData['ruta'] ?? '';
        $negocio_nombre = $negocioData['nombre_fantasia'] ?? '';
    }
} catch (Exception $ePlan) {}

try {
    // ---------------------------------------------------------
    // OBTENER LISTADO DE ALUMNOS O CLASES DE LA SEMANA (GET)
    // ---------------------------------------------------------
    if ($method === 'GET') {
        $action = $_GET['action'] ?? '';

        // Acción especial: Obtener clases y ocupación de la semana para la Grilla Semanal
        if ($action === 'clases_semana') {
            session_write_close();

            $fecha_inicio = $_GET['fecha_inicio'] ?? '';
            $fecha_fin = $_GET['fecha_fin'] ?? '';

            if (empty($fecha_inicio) || empty($fecha_fin)) {
                $tsHoy = time();
                $diaSemana = (int)date('w', $tsHoy); // 0 = dom, 1 = lun, etc.
                $diasHastaLunes = ($diaSemana === 0) ? -6 : (1 - $diaSemana);
                $fecha_inicio = date('Y-m-d', strtotime("{$diasHastaLunes} days", $tsHoy));
                $fecha_fin = date('Y-m-d', strtotime("+6 days", strtotime($fecha_inicio)));
            }

            // 1. Configuración de horarios del negocio
            $stmtConf = $pdo->prepare("
                SELECT hora_apertura, hora_cierre, hora_descanso_inicio, hora_descanso_fin, 
                       dias_trabajo, horarios_detallados_json, intervalo_turnos, 
                       turnos_simultaneos, modo_reservas, tiempo_entre_turnos, primer_dia_semana
                FROM configuracion_web 
                WHERE id_negocio = :id_negocio 
                LIMIT 1
            ");
            $stmtConf->execute(['id_negocio' => $id_negocio]);
            $confWeb = $stmtConf->fetch(PDO::FETCH_ASSOC) ?: [];

            // 2. Servicios del negocio
            $stmtServ = $pdo->prepare("
                SELECT id, nombre_servicio AS nombre, nombre_servicio, 
                       COALESCE(duracion_minutos, 30) AS duracion, 
                       COALESCE(cupo_maximo, capacidad, 1) AS cupo_maximo, 
                       profesional, tipo_servicio, precios_paquetes_json, icono,
                       COALESCE(color, '#d11149') AS color
                FROM servicios 
                WHERE id_negocio = :id_negocio 
                ORDER BY orden ASC, id ASC
            ");
            $stmtServ->execute(['id_negocio' => $id_negocio]);
            $serviciosList = $stmtServ->fetchAll(PDO::FETCH_ASSOC);

            // 3. Turnos e inscriptos para el rango de fechas solicitado
            $turnosSemana = [];
            try {
                $stmtTurnos = $pdo->prepare("
                    SELECT t.id AS id_turno, t.id_servicio, t.servicio, t.profesional, 
                           t.fecha, t.hora, t.cliente_nombre, t.cliente_celular, 
                           COALESCE(t.asistio, 0) AS asistio, t.metodo_pago, t.estado,
                           c.id AS id_cliente_negocio, c.telefono AS cliente_telefono, 
                           c.email AS cliente_email, COALESCE(c.pases_disponibles, 0) AS pases_disponibles
                    FROM turnos t
                    LEFT JOIN clientes_negocio c ON (
                        c.id_negocio = t.id_negocio 
                        AND (
                            (c.email IS NOT NULL AND c.email != '' AND LOWER(TRIM(c.email)) COLLATE utf8mb4_general_ci = LOWER(TRIM(t.cliente_celular)) COLLATE utf8mb4_general_ci)
                            OR (c.nombre_completo IS NOT NULL AND c.nombre_completo != '' AND LOWER(TRIM(c.nombre_completo)) COLLATE utf8mb4_general_ci = LOWER(TRIM(t.cliente_nombre)) COLLATE utf8mb4_general_ci)
                            OR (c.telefono IS NOT NULL AND c.telefono != '' AND LOWER(TRIM(c.telefono)) COLLATE utf8mb4_general_ci = LOWER(TRIM(t.cliente_celular)) COLLATE utf8mb4_general_ci)
                        )
                    )
                    WHERE t.id_negocio = :id_negocio 
                      AND t.fecha >= :fecha_inicio 
                      AND t.fecha <= :fecha_fin 
                      AND t.estado IN ('confirmado', 'pendiente')
                    ORDER BY t.fecha ASC, t.hora ASC
                ");
                $stmtTurnos->execute([
                    'id_negocio' => $id_negocio,
                    'fecha_inicio' => $fecha_inicio,
                    'fecha_fin' => $fecha_fin
                ]);
                $turnosSemana = $stmtTurnos->fetchAll(PDO::FETCH_ASSOC);
            } catch (Exception $eTurnosCollation) {
                // Fallback 100% seguro si las tablas difieren en collation o collation no admite join
                try {
                    $stmtTurnosFallback = $pdo->prepare("
                        SELECT t.id AS id_turno, t.id_servicio, t.servicio, t.profesional, 
                               t.fecha, t.hora, t.cliente_nombre, t.cliente_celular, 
                               COALESCE(t.asistio, 0) AS asistio, t.metodo_pago, t.estado,
                               NULL AS id_cliente_negocio, NULL AS cliente_telefono, 
                               NULL AS cliente_email, 0 AS pases_disponibles
                        FROM turnos t
                        WHERE t.id_negocio = :id_negocio 
                          AND t.fecha >= :fecha_inicio 
                          AND t.fecha <= :fecha_fin 
                          AND t.estado IN ('confirmado', 'pendiente')
                        ORDER BY t.fecha ASC, t.hora ASC
                    ");
                    $stmtTurnosFallback->execute([
                        'id_negocio' => $id_negocio,
                        'fecha_inicio' => $fecha_inicio,
                        'fecha_fin' => $fecha_fin
                    ]);
                    $turnosSemana = $stmtTurnosFallback->fetchAll(PDO::FETCH_ASSOC);

                    // Hidratación en memoria PHP sin dependencia de collations SQL
                    $stmtCliMem = $pdo->prepare("SELECT id, nombre_completo, email, telefono, COALESCE(pases_disponibles, 0) AS pases_disponibles FROM clientes_negocio WHERE id_negocio = :id_negocio");
                    $stmtCliMem->execute(['id_negocio' => $id_negocio]);
                    $alumnosMem = $stmtCliMem->fetchAll(PDO::FETCH_ASSOC);
                    if (!empty($alumnosMem) && !empty($turnosSemana)) {
                        foreach ($turnosSemana as &$trk) {
                            $cNombre = mb_strtolower(trim($trk['cliente_nombre'] ?? ''));
                            $cCel = mb_strtolower(trim($trk['cliente_celular'] ?? ''));
                            foreach ($alumnosMem as $alm) {
                                $aEmail = mb_strtolower(trim($alm['email'] ?? ''));
                                $aNom = mb_strtolower(trim($alm['nombre_completo'] ?? ''));
                                $aTel = mb_strtolower(trim($alm['telefono'] ?? ''));
                                if (($aEmail !== '' && $aEmail === $cCel) || ($aNom !== '' && $aNom === $cNombre) || ($aTel !== '' && $aTel === $cCel)) {
                                    $trk['id_cliente_negocio'] = $alm['id'];
                                    $trk['cliente_telefono'] = $alm['telefono'];
                                    $trk['cliente_email'] = $alm['email'];
                                    $trk['pases_disponibles'] = $alm['pases_disponibles'];
                                    break;
                                }
                            }
                        }
                        unset($trk);
                    }
                } catch (Exception $eFallbackFail) {
                    $turnosSemana = [];
                }
            }

            echo json_encode([
                'success' => true,
                'fecha_inicio' => $fecha_inicio,
                'fecha_fin' => $fecha_fin,
                'config' => $confWeb,
                'servicios' => $serviciosList,
                'turnos' => $turnosSemana,
                'is_premium' => $is_premium,
                'negocio_nombre' => $negocio_nombre,
                'negocio_ruta' => $negocio_ruta
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }

        session_write_close();

        try {
            $stmt = $pdo->prepare("
                SELECT c.id, c.nombre_completo, c.email, c.telefono, c.pases_disponibles, c.pases_totales, c.fecha_vencimiento, c.notas, c.estado, c.fecha_alta, c.id_servicio, c.servicio, c.servicios_pases_json,
                       (SELECT COUNT(*) FROM turnos t WHERE t.id_negocio = c.id_negocio AND (t.cliente_celular COLLATE utf8mb4_general_ci = c.email COLLATE utf8mb4_general_ci OR t.cliente_nombre COLLATE utf8mb4_general_ci = c.nombre_completo COLLATE utf8mb4_general_ci) AND t.estado IN ('pendiente', 'confirmado')) AS clases_reservadas
                FROM clientes_negocio c
                WHERE c.id_negocio = :id_negocio
                ORDER BY c.id DESC
            ");
            $stmt->execute(['id_negocio' => $id_negocio]);
            $clientes = $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (Exception $eCollation) {
            // Fallback 100% seguro si hay conflicto de collation entre tablas
            $stmt = $pdo->prepare("
                SELECT c.id, c.nombre_completo, c.email, c.telefono, c.pases_disponibles, c.pases_totales, c.fecha_vencimiento, c.notas, c.estado, c.fecha_alta, c.id_servicio, c.servicio, c.servicios_pases_json,
                       0 AS clases_reservadas
                FROM clientes_negocio c
                WHERE c.id_negocio = :id_negocio
                ORDER BY c.id DESC
            ");
            $stmt->execute(['id_negocio' => $id_negocio]);
            $clientes = $stmt->fetchAll(PDO::FETCH_ASSOC);

            // Calcular conteo en PHP
            $stmtTurnos = $pdo->prepare("SELECT cliente_celular, cliente_nombre FROM turnos WHERE id_negocio = :id_negocio AND estado IN ('pendiente', 'confirmado')");
            $stmtTurnos->execute(['id_negocio' => $id_negocio]);
            $allTurnos = $stmtTurnos->fetchAll(PDO::FETCH_ASSOC);

            foreach ($clientes as &$c) {
                $cEmail = strtolower(trim($c['email']));
                $cNombre = strtolower(trim($c['nombre_completo']));
                $count = 0;
                foreach ($allTurnos as $t) {
                    $tCell = strtolower(trim($t['cliente_celular']));
                    $tNom = strtolower(trim($t['cliente_nombre']));
                    if (($cEmail && $tCell === $cEmail) || ($cNombre && $tNom === $cNombre)) {
                        $count++;
                    }
                }
                $c['clases_reservadas'] = $count;
            }
        }

        // Obtener la lista de servicios activos del negocio (con cupo_maximo y precios_paquetes_json)
        $servicios = [];
        try {
            $stmtServ = $pdo->prepare("SELECT id, nombre_servicio AS nombre, COALESCE(cupo_maximo, capacidad, 1) AS cupo_maximo, precios_paquetes_json FROM servicios WHERE id_negocio = :id_negocio ORDER BY orden ASC, id DESC");
            $stmtServ->execute(['id_negocio' => $id_negocio]);
            $servicios = $stmtServ->fetchAll(PDO::FETCH_ASSOC);
        } catch (Exception $eServ) {}

        // Calcular estado automático según vencimiento o pases
        $today = date('Y-m-d');
        foreach ($clientes as &$c) {
            $c['pases_disponibles'] = (int)$c['pases_disponibles'];
            $c['pases_totales'] = (int)$c['pases_totales'];
            $c['clases_reservadas'] = (int)$c['clases_reservadas'];

            if (!empty($c['fecha_vencimiento']) && $c['fecha_vencimiento'] < $today) {
                $c['estado_calculado'] = 'vencido';
            } else if ($c['pases_disponibles'] <= 0) {
                $c['estado_calculado'] = 'sin_pases';
            } else {
                $c['estado_calculado'] = 'activo';
            }
        }

        // Calcular clases de la semana actual para precargar la insignia del selector
        $clases_semana_count = 0;
        try {
            $tsHoy = time();
            $diaSemana = (int)date('w', $tsHoy); // 0 = dom, 1 = lun, etc.
            $diasHastaLunes = ($diaSemana === 0) ? -6 : (1 - $diaSemana);
            $fIniSemana = date('Y-m-d', strtotime("{$diasHastaLunes} days", $tsHoy));
            $fFinSemana = date('Y-m-d', strtotime("+6 days", strtotime($fIniSemana)));

            $stmtCountSemana = $pdo->prepare("
                SELECT COUNT(DISTINCT CONCAT(COALESCE(id_servicio, 0), '_', fecha, '_', SUBSTRING(hora, 1, 5))) AS total_clases
                FROM turnos 
                WHERE id_negocio = :id_negocio 
                  AND fecha >= :f_ini 
                  AND fecha <= :f_fin 
                  AND estado IN ('confirmado', 'pendiente')
            ");
            $stmtCountSemana->execute([
                'id_negocio' => $id_negocio,
                'f_ini' => $fIniSemana,
                'f_fin' => $fFinSemana
            ]);
            $clases_semana_count = (int)$stmtCountSemana->fetchColumn();
        } catch(Exception $eCountSem) {}

        echo json_encode([
            'success' => true, 
            'data' => $clientes,
            'servicios' => $servicios,
            'is_premium' => $is_premium,
            'plan' => $plan_negocio,
            'negocio_ruta' => $negocio_ruta,
            'negocio_nombre' => $negocio_nombre,
            'clases_semana_count' => $clases_semana_count
        ]);
        exit;
    }

    // Bloquear acciones de modificación si la cuenta no es Plan Premium ni Demo
    if (!$is_premium) {
        echo json_encode([
            'success' => false,
            'error' => 'El registro y gestión de alumnos es una función exclusiva del Plan Premium. Actualiza tu plan en la sección Perfil.'
        ]);
        exit;
    }

    // ---------------------------------------------------------
    // CREAR O EDITAR ALUMNO (POST)
    // ---------------------------------------------------------
    if ($method === 'POST') {
        $contentType = isset($_SERVER["CONTENT_TYPE"]) ? trim($_SERVER["CONTENT_TYPE"]) : '';
        if (strpos($contentType, 'application/json') !== false) {
            $data = json_decode(file_get_contents('php://input'), true);
        } else {
            $data = $_POST;
        }

        $id = !empty($data['id']) ? (int)$data['id'] : (!empty($_POST['id']) ? (int)$_POST['id'] : null);
        $action = $data['action'] ?? $_POST['action'] ?? '';

        // Acción especial: Inscribir alumno a una clase específica desde la grilla
        if ($action === 'inscribir_alumno_clase') {
            $id_cliente = (int)($data['id_cliente'] ?? 0);
            $id_servicio = (int)($data['id_servicio'] ?? 0);
            $servicio = trim($data['servicio'] ?? '');
            $fecha = trim($data['fecha'] ?? '');
            $hora = trim($data['hora'] ?? '');
            $profesional = trim($data['profesional'] ?? 'Instructor');

            if (!$id_cliente || empty($fecha) || empty($hora) || (empty($servicio) && !$id_servicio)) {
                echo json_encode(['success' => false, 'error' => 'Por favor completa todos los campos para inscribir al alumno.']);
                exit;
            }

            // Consultar datos del alumno
            $stmtC = $pdo->prepare("SELECT id, nombre_completo, email, telefono, pases_disponibles, pases_totales, servicios_pases_json FROM clientes_negocio WHERE id = :id AND id_negocio = :id_negocio LIMIT 1");
            $stmtC->execute(['id' => $id_cliente, 'id_negocio' => $id_negocio]);
            $alumno = $stmtC->fetch(PDO::FETCH_ASSOC);

            if (!$alumno) {
                echo json_encode(['success' => false, 'error' => 'El alumno seleccionado no pertenece a este negocio.']);
                exit;
            }

            // Resolver nombre del servicio si vino vacío
            if ($id_servicio > 0 && empty($servicio)) {
                $stmtSrv = $pdo->prepare("SELECT nombre_servicio FROM servicios WHERE id = :id AND id_negocio = :id_negocio LIMIT 1");
                $stmtSrv->execute(['id' => $id_servicio, 'id_negocio' => $id_negocio]);
                $servicio = $stmtSrv->fetchColumn() ?: 'Clase';
            }

            $nombreAlumno = trim($alumno['nombre_completo']);
            $emailAlumno = strtolower(trim($alumno['email']));
            $telAlumno = trim($alumno['telefono']);
            $contactoTurno = !empty($telAlumno) ? $telAlumno : $emailAlumno;

            // Verificar si el alumno ya está inscripto en este horario
            $stmtDup = $pdo->prepare("
                SELECT id FROM turnos 
                WHERE id_negocio = :id_negocio 
                  AND fecha = :fecha 
                  AND hora LIKE :hora 
                  AND (id_servicio = :id_serv OR servicio = :serv) 
                  AND (
                    LOWER(TRIM(cliente_nombre)) = :nombre 
                    OR LOWER(TRIM(cliente_celular)) = :email 
                    OR (:tel != '' AND LOWER(TRIM(cliente_celular)) = :tel)
                  ) 
                  AND estado != 'cancelado' 
                LIMIT 1
            ");
            $stmtDup->execute([
                'id_negocio' => $id_negocio,
                'fecha' => $fecha,
                'hora' => substr($hora, 0, 5) . '%',
                'id_serv' => $id_servicio ?: 0,
                'serv' => $servicio,
                'nombre' => strtolower($nombreAlumno),
                'email' => $emailAlumno,
                'tel' => strtolower($telAlumno)
            ]);
            if ($stmtDup->fetch()) {
                echo json_encode(['success' => false, 'error' => 'Este alumno ya se encuentra inscripto en esta clase y horario.']);
                exit;
            }

            // Descontar pase del alumno si cuenta con pases
            $serviciosJson = $alumno['servicios_pases_json'] ?? null;
            $serviciosList = $serviciosJson ? json_decode($serviciosJson, true) : null;
            $pasesDispGen = (int)($alumno['pases_disponibles'] ?? 0);

            if (is_array($serviciosList) && count($serviciosList) > 0) {
                $targetIndex = 0;
                $foundMatch = false;

                if ($id_servicio > 0) {
                    foreach ($serviciosList as $idx => $sItem) {
                        if ((int)($sItem['id_servicio'] ?? 0) === $id_servicio) {
                            $targetIndex = $idx;
                            $foundMatch = true;
                            break;
                        }
                    }
                }
                if (!$foundMatch && !empty($servicio)) {
                    $servLower = strtolower($servicio);
                    foreach ($serviciosList as $idx => $sItem) {
                        if (strtolower(trim($sItem['servicio'] ?? '')) === $servLower) {
                            $targetIndex = $idx;
                            $foundMatch = true;
                            break;
                        }
                    }
                }
                if (!$foundMatch) {
                    foreach ($serviciosList as $idx => $sItem) {
                        if ((int)($sItem['pases_disponibles'] ?? 0) > 0) {
                            $targetIndex = $idx;
                            $foundMatch = true;
                            break;
                        }
                    }
                }

                $curDisp = (int)($serviciosList[$targetIndex]['pases_disponibles'] ?? 0);
                $serviciosList[$targetIndex]['pases_disponibles'] = max(0, $curDisp - 1);

                $nuevoTotal = 0;
                foreach ($serviciosList as $sItem) {
                    $nuevoTotal += (int)($sItem['pases_disponibles'] ?? 0);
                }

                $pdo->prepare("
                    UPDATE clientes_negocio 
                    SET pases_disponibles = :disp, 
                        servicios_pases_json = :json 
                    WHERE id = :id AND id_negocio = :id_negocio
                ")->execute([
                    'disp' => $nuevoTotal,
                    'json' => json_encode($serviciosList, JSON_UNESCAPED_UNICODE),
                    'id' => $alumno['id'],
                    'id_negocio' => $id_negocio
                ]);
            } else {
                $nuevoDisp = max(0, $pasesDispGen - 1);
                $pdo->prepare("
                    UPDATE clientes_negocio 
                    SET pases_disponibles = :disp 
                    WHERE id = :id AND id_negocio = :id_negocio
                ")->execute([
                    'disp' => $nuevoDisp,
                    'id' => $alumno['id'],
                    'id_negocio' => $id_negocio
                ]);
            }

            // Insertar reserva en la tabla turnos
            $stmtIns = $pdo->prepare("
                INSERT INTO turnos (id_negocio, cliente_nombre, cliente_celular, fecha, hora, servicio, profesional, id_servicio, metodo_pago, estado, asistio) 
                VALUES (:id_negocio, :nombre, :contacto, :fecha, :hora, :servicio, :profesional, :id_servicio, 'Pase de Alumno', 'confirmado', 0)
            ");
            $stmtIns->execute([
                'id_negocio' => $id_negocio,
                'nombre' => $nombreAlumno,
                'contacto' => $contactoTurno,
                'fecha' => $fecha,
                'hora' => substr($hora, 0, 5),
                'servicio' => $servicio,
                'profesional' => $profesional,
                'id_servicio' => $id_servicio ?: null
            ]);
            $newTurnoId = (int)$pdo->lastInsertId();

            echo json_encode([
                'success' => true,
                'id_turno' => $newTurnoId,
                'message' => "{$nombreAlumno} fue inscripto/a correctamente a la clase."
            ]);
            exit;
        }

        // Acción especial: Remover alumno de una clase y opcionalmente reintegrarle el pase
        if ($action === 'remover_alumno_clase') {
            $id_turno = (int)($data['id_turno'] ?? 0);
            $devolver_pase = isset($data['devolver_pase']) ? (bool)$data['devolver_pase'] : true;

            if (!$id_turno) {
                echo json_encode(['success' => false, 'error' => 'ID de turno no proporcionado.']);
                exit;
            }

            $stmtT = $pdo->prepare("SELECT id, id_servicio, servicio, cliente_nombre, cliente_celular FROM turnos WHERE id = :id AND id_negocio = :id_negocio LIMIT 1");
            $stmtT->execute(['id' => $id_turno, 'id_negocio' => $id_negocio]);
            $turno = $stmtT->fetch(PDO::FETCH_ASSOC);

            if (!$turno) {
                echo json_encode(['success' => false, 'error' => 'Turno no encontrado en este negocio.']);
                exit;
            }

            // Marcar turno como cancelado
            $stmtCanc = $pdo->prepare("UPDATE turnos SET estado = 'cancelado', fecha_eliminado = NOW() WHERE id = :id AND id_negocio = :id_negocio");
            $stmtCanc->execute(['id' => $id_turno, 'id_negocio' => $id_negocio]);

            // Reintegrar pase si corresponde
            if ($devolver_pase) {
                $cNom = trim($turno['cliente_nombre'] ?? '');
                $cContact = trim($turno['cliente_celular'] ?? '');
                $tServId = (int)($turno['id_servicio'] ?? 0);
                $tServNom = trim($turno['servicio'] ?? '');

                $stmtAl = $pdo->prepare("
                    SELECT id, pases_disponibles, pases_totales, servicios_pases_json 
                    FROM clientes_negocio 
                    WHERE id_negocio = :id_negocio 
                      AND (
                        (LOWER(TRIM(email)) = :cContact OR LOWER(TRIM(telefono)) = :cContact)
                        OR LOWER(TRIM(nombre_completo)) = :cNom
                      )
                    LIMIT 1
                ");
                $stmtAl->execute([
                    'id_negocio' => $id_negocio,
                    'cContact' => strtolower($cContact),
                    'cNom' => strtolower($cNom)
                ]);
                $alTarget = $stmtAl->fetch(PDO::FETCH_ASSOC);

                if ($alTarget) {
                    $serviciosJson = $alTarget['servicios_pases_json'] ?? null;
                    $serviciosList = $serviciosJson ? json_decode($serviciosJson, true) : null;

                    if (is_array($serviciosList) && count($serviciosList) > 0) {
                        $targetIndex = 0;
                        $found = false;
                        if ($tServId > 0) {
                            foreach ($serviciosList as $idx => $sItem) {
                                if ((int)($sItem['id_servicio'] ?? 0) === $tServId) {
                                    $targetIndex = $idx;
                                    $found = true;
                                    break;
                                }
                            }
                        }
                        if (!$found && !empty($tServNom)) {
                            $sLow = strtolower($tServNom);
                            foreach ($serviciosList as $idx => $sItem) {
                                if (strtolower(trim($sItem['servicio'] ?? '')) === $sLow) {
                                    $targetIndex = $idx;
                                    $found = true;
                                    break;
                                }
                            }
                        }

                        $serviciosList[$targetIndex]['pases_disponibles'] = (int)($serviciosList[$targetIndex]['pases_disponibles'] ?? 0) + 1;
                        $newTot = 0;
                        foreach ($serviciosList as $sItem) {
                            $newTot += (int)($sItem['pases_disponibles'] ?? 0);
                        }

                        $pdo->prepare("UPDATE clientes_negocio SET pases_disponibles = :disp, servicios_pases_json = :json WHERE id = :id AND id_negocio = :id_negocio")
                            ->execute([
                                'disp' => $newTot,
                                'json' => json_encode($serviciosList, JSON_UNESCAPED_UNICODE),
                                'id' => $alTarget['id'],
                                'id_negocio' => $id_negocio
                            ]);
                    } else {
                        $pdo->prepare("UPDATE clientes_negocio SET pases_disponibles = pases_disponibles + 1 WHERE id = :id AND id_negocio = :id_negocio")
                            ->execute(['id' => $alTarget['id'], 'id_negocio' => $id_negocio]);
                    }
                }
            }

            echo json_encode(['success' => true, 'message' => 'Inscripción eliminada y pase actualizado.']);
            exit;
        }

        // Acción especial: Eliminar Alumno (POST delete)
        if (($action === 'delete' || $action === 'eliminar') && $id) {
            $stmtE = $pdo->prepare("SELECT email FROM clientes_negocio WHERE id = :id AND id_negocio = :id_negocio LIMIT 1");
            $stmtE->execute(['id' => $id, 'id_negocio' => $id_negocio]);
            $cTarget = $stmtE->fetch(PDO::FETCH_ASSOC);

            if ($cTarget && !empty($cTarget['email'])) {
                $cEmail = strtolower(trim($cTarget['email']));
                $stmtOther = $pdo->prepare("SELECT COUNT(*) FROM clientes_negocio WHERE LOWER(TRIM(email)) = :email AND id_negocio != :id_negocio AND id_negocio > 0");
                $stmtOther->execute(['email' => $cEmail, 'id_negocio' => $id_negocio]);
                $otherCount = (int)$stmtOther->fetchColumn();

                if ($otherCount === 0) {
                    $stmtUnlink = $pdo->prepare("UPDATE clientes_negocio SET id_negocio = 0, pases_disponibles = 0, pases_totales = 0, estado = 'inactivo' WHERE id = :id AND id_negocio = :id_negocio");
                    $stmtUnlink->execute(['id' => $id, 'id_negocio' => $id_negocio]);
                } else {
                    $stmtDel = $pdo->prepare("DELETE FROM clientes_negocio WHERE id = :id AND id_negocio = :id_negocio");
                    $stmtDel->execute(['id' => $id, 'id_negocio' => $id_negocio]);
                }
            } else {
                $stmtDel = $pdo->prepare("DELETE FROM clientes_negocio WHERE id = :id AND id_negocio = :id_negocio");
                $stmtDel->execute(['id' => $id, 'id_negocio' => $id_negocio]);
            }

            echo json_encode(['success' => true, 'message' => 'Alumno eliminado con éxito.']);
            exit;
        }

        // Consultar preferencia de auto-renovación de vencimiento (+1 mes)
        $stmtConfAR = $pdo->prepare("SELECT auto_renovar_vencimiento FROM configuracion_web WHERE id_negocio = :id_negocio LIMIT 1");
        $stmtConfAR->execute(['id_negocio' => $id_negocio]);
        $confAR = $stmtConfAR->fetch(PDO::FETCH_ASSOC);
        $autoRenovarVenc = !$confAR || !isset($confAR['auto_renovar_vencimiento']) || $confAR['auto_renovar_vencimiento'] !== 'no';

        // Acción especial: Cargar / Renovar pases a un alumno
        if ($action === 'add_pases' && $id) {
            $cantAdd = max(1, (int)($data['cantidad'] ?? 0));
            $targetServId = !empty($data['id_servicio']) ? (int)$data['id_servicio'] : null;
            
            // Consultar datos actuales del alumno para saber si tiene pases restantes
            $stmtCurr = $pdo->prepare("SELECT pases_disponibles, pases_totales, fecha_vencimiento, cancelaciones_restantes, cancelaciones_permitidas, servicios_pases_json, id_servicio, servicio FROM clientes_negocio WHERE id = :id AND id_negocio = :id_negocio LIMIT 1");
            $stmtCurr->execute(['id' => $id, 'id_negocio' => $id_negocio]);
            $currCliente = $stmtCurr->fetch(PDO::FETCH_ASSOC);

            $pasesDispActual = $currCliente ? max(0, (int)$currCliente['pases_disponibles']) : 0;
            $pasesTotActual = $currCliente ? max(0, (int)$currCliente['pases_totales']) : 0;
            $serviciosJson = $currCliente ? ($currCliente['servicios_pases_json'] ?? null) : null;
            $serviciosList = $serviciosJson ? json_decode($serviciosJson, true) : null;

            // Calcular nuevo vencimiento: renovar a 1 mes desde hoy
            $newVenc = date('Y-m-d', strtotime('+1 month'));

            if (is_array($serviciosList) && count($serviciosList) > 0) {
                $targetIndex = 0;
                if ($targetServId) {
                    foreach ($serviciosList as $idx => $sItem) {
                        if ((int)($sItem['id_servicio'] ?? 0) === $targetServId) {
                            $targetIndex = $idx;
                            break;
                        }
                    }
                }
                
                $curServDisp = (int)($serviciosList[$targetIndex]['pases_disponibles'] ?? 0);
                $curServTot = (int)($serviciosList[$targetIndex]['pases_totales'] ?? $curServDisp);

                if ($curServDisp > 0) {
                    $serviciosList[$targetIndex]['pases_disponibles'] = $curServDisp + $cantAdd;
                    $serviciosList[$targetIndex]['pases_totales'] = ($curServTot > 0 ? $curServTot : $curServDisp) + $cantAdd;
                } else {
                    $serviciosList[$targetIndex]['pases_disponibles'] = $cantAdd;
                    $serviciosList[$targetIndex]['pases_totales'] = $cantAdd;
                }
                $serviciosList[$targetIndex]['fecha_vencimiento'] = $newVenc;

                // Recalcular totales generales
                $nuevoDisponibles = 0;
                $nuevoTotales = 0;
                foreach ($serviciosList as $sItem) {
                    $nuevoDisponibles += (int)($sItem['pases_disponibles'] ?? 0);
                    $nuevoTotales += (int)($sItem['pases_totales'] ?? 0);
                }

                $stmtAdd = $pdo->prepare("
                    UPDATE clientes_negocio 
                    SET pases_disponibles = :disp, 
                        pases_totales = :tot, 
                        fecha_vencimiento = :newVenc, 
                        cancelaciones_permitidas = :tot, 
                        cancelaciones_restantes = :disp,
                        servicios_pases_json = :json
                    WHERE id = :id AND id_negocio = :id_negocio
                ");
                $stmtAdd->execute([
                    'disp' => $nuevoDisponibles, 
                    'tot' => $nuevoTotales, 
                    'newVenc' => $newVenc, 
                    'json' => json_encode($serviciosList, JSON_UNESCAPED_UNICODE),
                    'id' => $id, 
                    'id_negocio' => $id_negocio
                ]);
            } else {
                if ($pasesDispActual > 0) {
                    $nuevoDisponibles = $pasesDispActual + $cantAdd;
                    $nuevoTotales = ($pasesTotActual > 0 ? $pasesTotActual : $pasesDispActual) + $cantAdd;
                } else {
                    $nuevoDisponibles = $cantAdd;
                    $nuevoTotales = $cantAdd;
                }

                $stmtAdd = $pdo->prepare("
                    UPDATE clientes_negocio 
                    SET pases_disponibles = :disp, 
                        pases_totales = :tot, 
                        fecha_vencimiento = :newVenc, 
                        cancelaciones_permitidas = :tot, 
                        cancelaciones_restantes = :disp 
                    WHERE id = :id AND id_negocio = :id_negocio
                ");
                $stmtAdd->execute([
                    'disp' => $nuevoDisponibles, 
                    'tot' => $nuevoTotales, 
                    'newVenc' => $newVenc, 
                    'id' => $id, 
                    'id_negocio' => $id_negocio
                ]);
            }

            echo json_encode([
                'success' => true, 
                'message' => "Se cargaron +{$cantAdd} clases exitosamente. Ahora el alumno cuenta con {$nuevoDisponibles} de {$nuevoTotales} clases disponibles hasta el " . date('d/m/Y', strtotime($newVenc)) . "."
            ]);
            exit;
        }

        $nombre = trim($data['nombre_completo'] ?? $data['nombre'] ?? '');
        $email = trim($data['email'] ?? '');
        $telefono = trim($data['telefono'] ?? '');
        $notas = trim($data['notas'] ?? '');

        if (empty($nombre) || empty($email)) {
            echo json_encode(['success' => false, 'error' => 'El nombre y correo electrónico son obligatorios.']);
            exit;
        }

        // Procesar múltiples servicios asignados al alumno
        $servicios_asignados = $data['servicios_asignados'] ?? null;
        if (is_string($servicios_asignados)) {
            $servicios_asignados = json_decode($servicios_asignados, true);
        }

        $parsedServicios = [];
        $totalDisp = 0;
        $totalTot = 0;
        $maxVenc = null;

        if (is_array($servicios_asignados) && count($servicios_asignados) > 0) {
            foreach ($servicios_asignados as $sa) {
                $sId = !empty($sa['id_servicio']) ? (int)$sa['id_servicio'] : null;
                $sNom = trim($sa['servicio'] ?? '');
                if ($sId && empty($sNom)) {
                    $stmtSName = $pdo->prepare("SELECT nombre_servicio FROM servicios WHERE id = :id_serv AND id_negocio = :id_neg LIMIT 1");
                    $stmtSName->execute(['id_serv' => $sId, 'id_neg' => $id_negocio]);
                    $sNom = $stmtSName->fetchColumn() ?: 'Servicio';
                }
                $pDisp = max(0, (int)($sa['pases_disponibles'] ?? 0));
                $pTot = max($pDisp, (int)($sa['pases_totales'] ?? $pDisp));
                $pVenc = !empty($sa['fecha_vencimiento']) ? $sa['fecha_vencimiento'] : ($autoRenovarVenc ? date('Y-m-d', strtotime('+1 month')) : null);
                $pEtiqueta = trim($sa['etiqueta_pase'] ?? '');

                $totalDisp += $pDisp;
                $totalTot += $pTot;
                if ($pVenc && (!$maxVenc || $pVenc > $maxVenc)) {
                    $maxVenc = $pVenc;
                }

                $parsedServicios[] = [
                    'id_servicio' => $sId,
                    'servicio' => $sNom,
                    'etiqueta_pase' => $pEtiqueta,
                    'pases_disponibles' => $pDisp,
                    'pases_totales' => $pTot,
                    'fecha_vencimiento' => $pVenc
                ];
            }
        }

        // Fallback para formulario simple / anterior
        if (empty($parsedServicios)) {
            $id_servicio = !empty($data['id_servicio']) ? (int)$data['id_servicio'] : (!empty($_POST['id_servicio']) ? (int)$_POST['id_servicio'] : null);
            $servicio = trim($data['servicio'] ?? $_POST['servicio'] ?? '');
            if ($id_servicio && empty($servicio)) {
                $stmtSName = $pdo->prepare("SELECT nombre_servicio FROM servicios WHERE id = :id_serv AND id_negocio = :id_neg LIMIT 1");
                $stmtSName->execute(['id_serv' => $id_servicio, 'id_neg' => $id_negocio]);
                $servicio = $stmtSName->fetchColumn() ?: 'Servicio';
            }
            $pases = max(0, (int)($data['pases_disponibles'] ?? $data['pases'] ?? 0));
            $pases_totales = $pases;
            $fecha_vencimiento = !empty($data['fecha_vencimiento']) ? $data['fecha_vencimiento'] : ($autoRenovarVenc ? date('Y-m-d', strtotime('+1 month')) : null);
            $parsedServicios[] = [
                'id_servicio' => $id_servicio,
                'servicio' => $servicio,
                'etiqueta_pase' => trim($data['etiqueta_pase'] ?? ''),
                'pases_disponibles' => $pases,
                'pases_totales' => $pases_totales,
                'fecha_vencimiento' => $fecha_vencimiento
            ];
            $totalDisp = $pases;
            $totalTot = $pases_totales;
            $maxVenc = $fecha_vencimiento;
        }

        $id_servicio = $parsedServicios[0]['id_servicio'] ?? null;
        $servicio = $parsedServicios[0]['servicio'] ?? '';
        $pases = $totalDisp;
        $pases_totales = $totalTot;
        $fecha_vencimiento = $maxVenc ?: ($autoRenovarVenc ? date('Y-m-d', strtotime('+1 month')) : null);
        $servicios_pases_json = json_encode($parsedServicios, JSON_UNESCAPED_UNICODE);

        if ($id) {
            // Si la fecha de vencimiento es vacía o anterior a hoy y autoRenovarVenc está activo, renovar a +1 mes
            if ($autoRenovarVenc && (empty($fecha_vencimiento) || $fecha_vencimiento < date('Y-m-d'))) {
                $fecha_vencimiento = date('Y-m-d', strtotime('+1 month'));
            }

            $stmt = $pdo->prepare("
                UPDATE clientes_negocio 
                SET nombre_completo = :nombre, 
                    email = :email, 
                    telefono = :telefono, 
                    id_servicio = :id_servicio,
                    servicio = :servicio,
                    pases_disponibles = :pases, 
                    pases_totales = :pases_totales, 
                    fecha_vencimiento = :venc, 
                    notas = :notas,
                    cancelaciones_permitidas = :pases_totales,
                    cancelaciones_restantes = :pases_totales,
                    servicios_pases_json = :servs_json
                WHERE id = :id AND id_negocio = :id_negocio
            ");
            $stmt->execute([
                'nombre' => $nombre,
                'email' => $email,
                'telefono' => $telefono,
                'id_servicio' => $id_servicio,
                'servicio' => $servicio,
                'pases' => $pases,
                'pases_totales' => $pases_totales,
                'venc' => $fecha_vencimiento,
                'notas' => $notas,
                'servs_json' => $servicios_pases_json,
                'id' => $id,
                'id_negocio' => $id_negocio
            ]);
        } else {
            // Verificar si el email ya existe en este negocio
            $stmtCheck = $pdo->prepare("SELECT id FROM clientes_negocio WHERE id_negocio = :id_negocio AND email = :email LIMIT 1");
            $stmtCheck->execute(['id_negocio' => $id_negocio, 'email' => $email]);
            if ($stmtCheck->fetch()) {
                echo json_encode(['success' => false, 'error' => 'Ya existe un alumno registrado con ese mismo correo electrónico.']);
                exit;
            }

            $stmt = $pdo->prepare("
                INSERT INTO clientes_negocio (id_negocio, id_servicio, servicio, nombre_completo, email, telefono, pases_disponibles, pases_totales, fecha_vencimiento, notas, cancelaciones_permitidas, cancelaciones_restantes, estado, servicios_pases_json)
                VALUES (:id_negocio, :id_servicio, :servicio, :nombre, :email, :telefono, :pases, :pases_totales, :venc, :notas, :canc_perm, :canc_rest, 'pendiente_activacion', :servs_json)
            ");
            $stmt->execute([
                'id_negocio' => $id_negocio,
                'id_servicio' => $id_servicio,
                'servicio' => $servicio,
                'nombre' => $nombre,
                'email' => $email,
                'telefono' => $telefono,
                'pases' => $pases,
                'pases_totales' => $pases_totales,
                'venc' => $fecha_vencimiento,
                'notas' => $notas,
                'canc_perm' => $pases_totales,
                'canc_rest' => $pases_totales,
                'servs_json' => $servicios_pases_json
            ]);
        }

        echo json_encode(['success' => true]);
        exit;
    }

    // ---------------------------------------------------------
    // ELIMINAR ALUMNO (DELETE)
    // ---------------------------------------------------------
    if ($method === 'DELETE') {
        parse_str(file_get_contents('php://input'), $deleteVars);
        $id = (int)($deleteVars['id'] ?? $_GET['id'] ?? 0);

        if (!$id) {
            echo json_encode(['success' => false, 'error' => 'ID no proporcionado.']);
            exit;
        }

        $stmtE = $pdo->prepare("SELECT email FROM clientes_negocio WHERE id = :id AND id_negocio = :id_negocio LIMIT 1");
        $stmtE->execute(['id' => $id, 'id_negocio' => $id_negocio]);
        $cTarget = $stmtE->fetch(PDO::FETCH_ASSOC);

        if ($cTarget && !empty($cTarget['email'])) {
            $cEmail = strtolower(trim($cTarget['email']));
            $stmtOther = $pdo->prepare("SELECT COUNT(*) FROM clientes_negocio WHERE LOWER(TRIM(email)) = :email AND id_negocio != :id_negocio AND id_negocio > 0");
            $stmtOther->execute(['email' => $cEmail, 'id_negocio' => $id_negocio]);
            $otherCount = (int)$stmtOther->fetchColumn();

            if ($otherCount === 0) {
                $stmtUnlink = $pdo->prepare("UPDATE clientes_negocio SET id_negocio = 0, pases_disponibles = 0, pases_totales = 0, estado = 'inactivo' WHERE id = :id AND id_negocio = :id_negocio");
                $stmtUnlink->execute(['id' => $id, 'id_negocio' => $id_negocio]);
            } else {
                $stmtDel = $pdo->prepare("DELETE FROM clientes_negocio WHERE id = :id AND id_negocio = :id_negocio");
                $stmtDel->execute(['id' => $id, 'id_negocio' => $id_negocio]);
            }
        } else {
            $stmtDel = $pdo->prepare("DELETE FROM clientes_negocio WHERE id = :id AND id_negocio = :id_negocio");
            $stmtDel->execute(['id' => $id, 'id_negocio' => $id_negocio]);
        }

        echo json_encode(['success' => true]);
        exit;
    }

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error en la base de datos: ' . $e->getMessage()]);
}
?>
