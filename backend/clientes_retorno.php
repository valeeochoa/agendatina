<?php
session_start();
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/conexion.php';

if (!isset($_SESSION['id_negocio'])) {
    echo json_encode(['success' => false, 'error' => 'Sesión no iniciada.']);
    exit;
}

$id_negocio = (int)$_SESSION['id_negocio'];
session_write_close();

// Auto-migraciones seguras
try {
    $pdo->exec("CREATE TABLE IF NOT EXISTS cupones_descuento (
        id INT AUTO_INCREMENT PRIMARY KEY,
        id_negocio INT NOT NULL,
        codigo VARCHAR(50) NOT NULL,
        cliente_celular VARCHAR(50) DEFAULT NULL,
        cliente_nombre VARCHAR(255) DEFAULT NULL,
        porcentaje_descuento INT DEFAULT 10,
        usado TINYINT(1) DEFAULT 0,
        fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
        fecha_expiracion DATETIME NOT NULL,
        fecha_uso DATETIME DEFAULT NULL,
        INDEX (id_negocio),
        INDEX (codigo)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
} catch (Exception $eTbl) {}

foreach ([
    'enviar_msj_automaticos' => 'TINYINT(1) DEFAULT 0',
    'usar_cupones_descuento' => 'TINYINT(1) DEFAULT 0',
    'dias_retorno_clientes' => 'INT DEFAULT 30'
] as $col => $def) {
    try { $pdo->query("SELECT $col FROM configuracion_web LIMIT 1"); }
    catch (Exception $eCol) { try { $pdo->exec("ALTER TABLE configuracion_web ADD COLUMN $col $def"); } catch (Exception $eCol2) {} }
}

$stmtNeg = $pdo->prepare("
    SELECT n.nombre_fantasia, n.ruta,
           COALESCE(cw.enviar_msj_automaticos, 0) AS enviar_msj_automaticos,
           COALESCE(cw.usar_cupones_descuento, 0) AS usar_cupones_descuento,
           COALESCE(cw.dias_retorno_clientes, 30) AS dias_retorno_clientes
    FROM negocios n
    LEFT JOIN configuracion_web cw ON cw.id_negocio = n.id
    WHERE n.id = :id LIMIT 1
");
$stmtNeg->execute(['id' => $id_negocio]);
$negData = $stmtNeg->fetch(PDO::FETCH_ASSOC);

$diasRetorno = max(1, (int)($negData['dias_retorno_clientes'] ?? 30));
$usarCupones = (int)($negData['usar_cupones_descuento'] ?? 0) === 1;
$enviarMsj = (int)($negData['enviar_msj_automaticos'] ?? 0) === 1;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);
    if (!is_array($data)) $data = $_POST;

    $clienteNombre = trim($data['cliente_nombre'] ?? 'Cliente');
    $clienteCelular = preg_replace('/\D/', '', $data['cliente_celular'] ?? '');
    $diasTranscurridos = max(1, (int)($data['dias_transcurridos'] ?? $diasRetorno));

    if (empty($clienteCelular)) {
        echo json_encode(['success' => false, 'error' => 'El cliente no tiene un número de celular válido.']);
        exit;
    }

    $codigoCupon = null;
    if ($usarCupones) {
        $stmtExist = $pdo->prepare("SELECT codigo FROM cupones_descuento WHERE id_negocio = :id_neg AND cliente_celular = :cel AND usado = 0 AND fecha_expiracion > NOW() ORDER BY id DESC LIMIT 1");
        $stmtExist->execute(['id_neg' => $id_negocio, 'cel' => $clienteCelular]);
        $existingCode = $stmtExist->fetchColumn();

        if ($existingCode) {
            $codigoCupon = $existingCode;
        } else {
            $chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
            $randPart = '';
            for ($i = 0; $i < 5; $i++) {
                $randPart .= $chars[random_int(0, strlen($chars) - 1)];
            }
            $codigoCupon = 'DESC10-' . $randPart;
            $expira = date('Y-m-d H:i:s', strtotime('+24 hours'));

            $stmtIns = $pdo->prepare("INSERT INTO cupones_descuento (id_negocio, codigo, cliente_celular, cliente_nombre, porcentaje_descuento, usado, fecha_expiracion) VALUES (:id_neg, :cod, :cel, :nom, 10, 0, :exp)");
            $stmtIns->execute([
                'id_neg' => $id_negocio,
                'cod' => $codigoCupon,
                'cel' => $clienteCelular,
                'nom' => $clienteNombre,
                'exp' => $expira
            ]);
        }
    }

    if ($usarCupones && $codigoCupon) {
        $mensaje = "Hola {$clienteNombre} ya pasaron {$diasTranscurridos} días desde la última vez que viniste, si sacas un turno ahora desde la página con el cupón {$codigoCupon} tenes un 10off, este cupón es para usar una sola vez y expira en 24hs";
    } else {
        $mensaje = "Hola {$clienteNombre} ya pasaron {$diasTranscurridos} días desde la última vez que viniste, te escribimos para recordarte que puedes agendar tu próximo turno desde nuestra página cuando gustes.";
    }

    $wppPhone = $clienteCelular;
    if (strlen($wppPhone) === 10 && strpos($wppPhone, '54') !== 0) {
        $wppPhone = '549' . $wppPhone;
    }

    $whatsappUrl = "https://wa.me/{$wppPhone}?text=" . urlencode($mensaje);

    echo json_encode([
        'success' => true,
        'codigo_cupon' => $codigoCupon,
        'mensaje' => $mensaje,
        'whatsapp_url' => $whatsappUrl
    ]);
    exit;
}

// GET: Listar clientes que ya cumplieron >= $diasRetorno días desde su último turno y NO volvieron a agendarse después
try {
    $stmtTurnos = $pdo->prepare("
        SELECT id, cliente_nombre, cliente_celular, servicio, profesional, fecha, hora, estado
        FROM turnos
        WHERE id_negocio = :id_neg
          AND estado IN ('confirmado', 'atendido', 'pendiente')
          AND cliente_celular IS NOT NULL
          AND TRIM(cliente_celular) != ''
        ORDER BY fecha DESC, hora DESC
    ");
    $stmtTurnos->execute(['id_neg' => $id_negocio]);
    $rows = $stmtTurnos->fetchAll(PDO::FETCH_ASSOC);

    // Agrupar por celular limpio (últimos 8-10 dígitos) para verificar el último turno real de cada cliente
    // y chequear que NO se haya vuelto a realizar el servicio ni tenga un turno posterior/futuro.
    $clientesMap = [];
    foreach ($rows as $r) {
        $celDigits = preg_replace('/\D/', '', $r['cliente_celular'] ?? '');
        if (strlen($celDigits) < 6) continue;
        $key = substr($celDigits, -8); // Clave normalizada por los últimos 8 dígitos del teléfono

        if (!isset($clientesMap[$key])) {
            $clientesMap[$key] = [
                'cliente_nombre' => trim($r['cliente_nombre'] ?? 'Cliente'),
                'cliente_celular' => $celDigits,
                'ultimo_servicio' => $r['servicio'] ?? 'Servicio',
                'profesional' => $r['profesional'] ?? '',
                'ultima_fecha' => $r['fecha'],
                'ultima_hora' => $r['hora']
            ];
        } else {
            // Como está ordenado por fecha DESC, si hubiera una fecha mayor la guardamos
            if ($r['fecha'] > $clientesMap[$key]['ultima_fecha']) {
                $clientesMap[$key]['ultima_fecha'] = $r['fecha'];
                $clientesMap[$key]['ultima_hora'] = $r['hora'];
                $clientesMap[$key]['ultimo_servicio'] = $r['servicio'] ?? 'Servicio';
            }
        }
    }

    $hoy = new DateTime(date('Y-m-d'));
    $clientesParaRetorno = [];

    foreach ($clientesMap as $key => $cli) {
        $fechaUlt = DateTime::createFromFormat('Y-m-d', $cli['ultima_fecha']);
        if (!$fechaUlt) continue;

        // Si el cliente ya tiene un turno hoy o en el futuro, NO mostrarlo (ya volvió a sacar turno)
        if ($fechaUlt >= $hoy) continue;

        $diff = $hoy->diff($fechaUlt);
        $diasPasados = (int)$diff->days;

        if ($diasPasados >= $diasRetorno) {
            // Verificar si ya tiene un cupón activo generado en las últimas 24hs
            $stmtCupAct = $pdo->prepare("SELECT codigo, fecha_expiracion FROM cupones_descuento WHERE id_negocio = :id_neg AND cliente_celular = :cel AND usado = 0 AND fecha_expiracion > NOW() ORDER BY id DESC LIMIT 1");
            $stmtCupAct->execute(['id_neg' => $id_negocio, 'cel' => $cli['cliente_celular']]);
            $cupAct = $stmtCupAct->fetch(PDO::FETCH_ASSOC);

            $cli['dias_transcurridos'] = $diasPasados;
            $cli['ultima_fecha_display'] = $fechaUlt->format('d/m/Y');
            $cli['cupon_activo'] = $cupAct ? $cupAct['codigo'] : null;
            $clientesParaRetorno[] = $cli;
        }
    }

    echo json_encode([
        'success' => true,
        'enviar_msj_automaticos' => $enviarMsj,
        'usar_cupones_descuento' => $usarCupones,
        'dias_retorno_clientes' => $diasRetorno,
        'clientes' => $clientesParaRetorno
    ]);
} catch (Exception $e) {
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>

