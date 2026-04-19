<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/conexion.php';

$ruta = $_GET['n'] ?? '';
$profesional = $_GET['p'] ?? '';
$token = $_GET['token'] ?? '';

if (empty($ruta) || empty($profesional) || empty($token)) {
    echo json_encode(['success' => false, 'error' => 'Enlace no válido o incompleto.']);
    exit;
}

try { $pdo->query("SELECT ultimo_pago FROM negocios LIMIT 1"); } 
catch(Exception $e) { $pdo->exec("ALTER TABLE negocios ADD COLUMN ultimo_pago DATETIME DEFAULT NULL"); }

try {
    $stmtNegocio = $pdo->prepare("SELECT id, nombre_fantasia, token_seguridad, estado_pago, ultimo_pago, fecha_alta FROM negocios WHERE ruta = :ruta LIMIT 1");
    $stmtNegocio->execute(['ruta' => $ruta]);
    $negocio = $stmtNegocio->fetch(PDO::FETCH_ASSOC);

    if (!$negocio) {
        echo json_encode(['success' => false, 'error' => 'Negocio no encontrado.']);
        exit;
    }

    $dbStatus = $negocio['estado_pago'] ?? 'prueba';
    $isSuspended = ($dbStatus === 'suspendido');
    
    $today = new DateTime();
    if ($dbStatus === 'prueba') {
        $fechaAltaStr = !empty($negocio['fecha_alta']) ? $negocio['fecha_alta'] : 'now';
        $fechaAlta = new DateTime($fechaAltaStr);
        $fechaAlta->modify('+15 days');
        if ($today > $fechaAlta) { $isSuspended = true; }
    } elseif ($dbStatus === 'beta') {
        $fechaAltaStr = !empty($negocio['fecha_alta']) ? $negocio['fecha_alta'] : 'now';
        $fechaAlta = new DateTime($fechaAltaStr);
        $fechaAlta->modify('+30 days');
        if ($today > $fechaAlta) { $isSuspended = true; }
    } elseif ($dbStatus === 'activo' || $dbStatus === 'pagado') {
        $ultimoPagoStr = !empty($negocio['ultimo_pago']) ? $negocio['ultimo_pago'] : '2000-01-01';
        $ultimoPago = new DateTime($ultimoPagoStr);
        $ultimoPago->modify('+40 days');
        if ($today > $ultimoPago) { $isSuspended = true; }
    }

    if ($isSuspended) {
        echo json_encode(['success' => false, 'error' => 'La cuenta del negocio se encuentra suspendida por falta de pago.']);
        exit;
    }

    $id_negocio = $negocio['id'];
    $secret = !empty($negocio['token_seguridad']) ? $negocio['token_seguridad'] : 'AgendatinaSec_2024';
    $profKey = strtolower(trim($profesional));
    $expectedToken = hash('sha256', $id_negocio . '|' . $profKey . '|' . $secret);

    if ($token !== $expectedToken) {
        echo json_encode(['success' => false, 'error' => 'No tienes permisos para ver esta agenda. El enlace fue manipulado o es incorrecto.']);
        exit;
    }

    // Solo traer turnos confirmados desde la fecha actual (hoy) en adelante
    $stmt = $pdo->prepare("SELECT id, cliente_nombre, cliente_celular, fecha, hora, servicio, estado FROM turnos WHERE id_negocio = :id_negocio AND profesional = :profesional AND fecha >= CURRENT_DATE AND estado = 'confirmado' ORDER BY fecha ASC, hora ASC");
    $stmt->execute(['id_negocio' => $id_negocio, 'profesional' => $profesional]);
    $turnos = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Obtener los servicios que realiza este profesional
    $stmtServs = $pdo->prepare("SELECT nombre_servicio FROM servicios WHERE id_negocio = :id_negocio AND profesional = :profesional");
    $stmtServs->execute(['id_negocio' => $id_negocio, 'profesional' => $profesional]);
    $serviciosList = $stmtServs->fetchAll(PDO::FETCH_COLUMN);
    $serviciosAsignados = implode(' • ', array_unique($serviciosList));

    $stmtConfig = $pdo->prepare("SELECT url_logo AS logo, color_primario FROM configuracion_web WHERE id_negocio = :id_negocio LIMIT 1");
    $stmtConfig->execute(['id_negocio' => $id_negocio]);
    $cfg = $stmtConfig->fetch(PDO::FETCH_ASSOC) ?: [];

    echo json_encode([
        'success' => true,
        'negocio' => $negocio['nombre_fantasia'],
        'servicios' => $serviciosAsignados,
        'logo' => $cfg['logo'] ?? '',
        'color_primario' => $cfg['color_primario'] ?? '#ec135b',
        'data' => $turnos
    ]);
} catch (PDOException $e) {
    echo json_encode(['success' => false, 'error' => 'Error al obtener la agenda de la base de datos.']);
}
?>