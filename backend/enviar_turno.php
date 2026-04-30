<?php
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;
use PHPMailer\PHPMailer\SMTP;

require 'phpmailer/Exception.php';
require 'phpmailer/PHPMailer.php';
require 'phpmailer/SMTP.php';

header('Content-Type: application/json; charset=utf-8');

// Permitir solo método POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método no permitido.']);
    exit;
}

// Recibir datos del formulario
$nombre = isset($_POST['nombre']) ? trim($_POST['nombre']) : '';
$apellido = isset($_POST['apellido']) ? trim($_POST['apellido']) : '';
$celular = isset($_POST['celular']) ? trim($_POST['celular']) : '';
$fecha = isset($_POST['fecha']) ? trim($_POST['fecha']) : '';
$hora = isset($_POST['hora']) ? trim($_POST['hora']) : '';
$servicio = isset($_POST['servicio']) ? trim($_POST['servicio']) : '';
$profesional = isset($_POST['profesional']) ? trim($_POST['profesional']) : 'Cualquiera (Sin preferencia)';
$ruta = isset($_POST['negocio']) ? trim($_POST['negocio']) : '';

// Validar datos básicos
if (empty($nombre) || empty($apellido) || empty($celular) || empty($fecha) || empty($hora) || empty($servicio)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Por favor, completa todos los campos requeridos.']);
    exit;
}

require_once __DIR__ . '/conexion.php';

try { $pdo->query("SELECT ultimo_pago FROM negocios LIMIT 1"); } 
catch(Exception $e) { $pdo->exec("ALTER TABLE negocios ADD COLUMN ultimo_pago DATETIME DEFAULT NULL"); }

try { $pdo->query("SELECT estado_pago FROM negocios LIMIT 1"); } 
catch(Exception $e) { $pdo->exec("ALTER TABLE negocios ADD COLUMN estado_pago VARCHAR(50) DEFAULT 'prueba'"); }

try { $pdo->query("SELECT fecha_alta FROM negocios LIMIT 1"); } 
catch(Exception $e) { $pdo->exec("ALTER TABLE negocios ADD COLUMN fecha_alta DATETIME DEFAULT CURRENT_TIMESTAMP"); }

// --- OBTENER DATOS DEL NEGOCIO DESDE LA BASE DE DATOS ---
$stmtNegocio = $pdo->prepare("
    SELECT n.id, n.nombre_fantasia, n.estado_pago, n.ultimo_pago, n.fecha_alta, u.email 
    FROM negocios n 
    LEFT JOIN personal_negocio pn ON n.id = pn.id_negocio AND pn.rol_en_local = 'admin'
    LEFT JOIN usuarios u ON pn.id_usuario = u.id
    WHERE n.ruta = :sub LIMIT 1");
$stmtNegocio->execute(['sub' => $ruta]);
$negocioBD = $stmtNegocio->fetch();

if (!$negocioBD) {
    http_response_code(404);
    echo json_encode(['success' => false, 'error' => 'Negocio no válido o URL incorrecta.']);
    exit;
}

$dbStatus = $negocioBD['estado_pago'] ?? 'prueba';
$isSuspended = ($dbStatus === 'suspendido');

$today = new DateTime();
if ($dbStatus === 'prueba') {
    $fechaAltaStr = !empty($negocioBD['fecha_alta']) ? $negocioBD['fecha_alta'] : 'now';
    $fechaAlta = new DateTime($fechaAltaStr);
    $fechaAlta->modify('+15 days');
    if ($today > $fechaAlta) { $isSuspended = true; }
} elseif ($dbStatus === 'beta') {
    $fechaAltaStr = !empty($negocioBD['fecha_alta']) ? $negocioBD['fecha_alta'] : 'now';
    $fechaAlta = new DateTime($fechaAltaStr);
    $fechaAlta->modify('+35 days');
    if ($today > $fechaAlta) { $isSuspended = true; }
} elseif ($dbStatus === 'activo' || $dbStatus === 'pagado') {
    $ultimoPagoStr = !empty($negocioBD['ultimo_pago']) ? $negocioBD['ultimo_pago'] : '2000-01-01';
    $ultimoPago = new DateTime($ultimoPagoStr);
    $ultimoPago->modify('+35 days');
    if ($today > $ultimoPago) { $isSuspended = true; }
}

if ($isSuspended) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Este negocio tiene las reservas temporalmente suspendidas por falta de pago.']);
    exit;
}

$fecha_display = $fecha;
if (!empty($fecha)) {
    $dateObj = DateTime::createFromFormat('Y-m-d', $fecha);
    if ($dateObj) {
        $fecha_display = $dateObj->format('d/m/Y');
    }
}

$id_negocio = $negocioBD['id'];
$businessName = $negocioBD['nombre_fantasia'];
$emailDestino = !empty($negocioBD['email']) ? $negocioBD['email'] : 'info@agendatina.site'; // Fallback por si está vacío

// (Opcional) A futuro aquí cargarás logo y colores desde tu tabla 'configuracion' 
// con $id_negocio en lugar del archivo web_data.json
$webDataFile = __DIR__ . '/web_data.json';
$webData = file_exists($webDataFile) ? json_decode(file_get_contents($webDataFile), true) : [];
$primaryColor = !empty($webData['color_primario']) ? $webData['color_primario'] : '#D11149';
$logo = !empty($webData['logo']) ? $webData['logo'] : '';

// Configuración del email
$to = $emailDestino;
$subject = "Nueva Solicitud de Turno - $fecha_display | $businessName";

$logoHtml = '';
if (!empty($logo)) {
    $logoHtml = "<img src='$logo' alt='$businessName' style='max-height: 70px; margin-bottom: 10px; border-radius: 8px;'>";
}

$numeroWhatsApp = preg_replace('/\D/', '', $celular); // Limpiar número para el enlace
$textoWhatsApp = "Hola " . ($nombre . " " . $apellido) . ", te escribo desde " . $businessName . " por tu solicitud de turno para el " . $fecha_display . " a las " . $hora . " hs (" . $servicio . ").";
$urlWhatsApp = "https://wa.me/" . $numeroWhatsApp . "?text=" . urlencode($textoWhatsApp);


$message = "
<html>
<body style='font-family: Arial, sans-serif; color: #333; background-color: #f8fafc; padding: 20px;'>
    <div style='background-color: #fff; max-width: 600px; margin: 0 auto; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);'>
        
        <div style='background-color: #ffffff; padding: 30px 20px; text-align: center; border-bottom: 4px solid $primaryColor;'>
            $logoHtml
            <h1 style='color: $primaryColor; margin: 0; font-size: 26px; font-weight: 800;'>$businessName</h1>
        </div>
        
        <div style='padding: 30px;'>
            <h2 style='color: #1e293b; margin-top: 0;'>¡Nueva Solicitud de Turno!</h2>
            <p style='font-size: 16px; color: #475569;'>Has recibido una nueva solicitud de reserva desde tu página web.</p>
            
            <div style='background-color: #f1f5f9; padding: 20px; border-radius: 8px; border-left: 4px solid $primaryColor; margin: 25px 0;'>
                <p style='margin: 0 0 15px 0; font-size: 18px; color: #0f172a;'><strong>Detalles de la reserva:</strong></p>
                <table style='width: 100%; border-collapse: collapse;'>
                    <tr><td style='padding: 6px 0; color: #64748b;'><strong>Nombre:</strong></td><td style='padding: 6px 0; font-weight: bold;'>$nombre $apellido</td></tr>
                    <tr><td style='padding: 6px 0; color: #64748b;'><strong>Celular:</strong></td><td style='padding: 6px 0; font-weight: bold;'>$celular</td></tr>
                    <tr><td style='padding: 6px 0; color: #64748b;'><strong>Servicio:</strong></td><td style='padding: 6px 0; font-weight: bold;'>$servicio</td></tr>
                    <tr><td style='padding: 6px 0; color: #64748b;'><strong>Profesional:</strong></td><td style='padding: 6px 0; font-weight: bold;'>$profesional</td></tr>
                    <tr><td style='padding: 6px 0; color: #64748b;'><strong>Fecha y Hora:</strong></td><td style='padding: 6px 0; font-weight: bold; color: $primaryColor;'>$fecha_display a las $hora hs</td></tr>
                </table>
            </div>
            
            <p style='margin-top: 20px; color: #475569;'>Por favor, comunícate al número proporcionado para confirmar el horario con el cliente y evitar confusiones.</p>
            
            <div style='text-align: center; margin-top: 35px;'>
                <a href='$urlWhatsApp' style='background-color: #25D366; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;'>Contactar por WhatsApp</a>
            </div>
        </div>
        
        <div style='background-color: #f8fafc; padding: 15px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8;'>
            Este es un mensaje automático generado por <strong>Agendatina</strong>.
        </div>
    </div>
</body>
</html>
";

// --- GUARDAR EN BASE DE DATOS PARA LA AGENDA VIRTUAL ---
try { $pdo->query("SELECT profesional FROM turnos LIMIT 1"); } 
catch(Exception $e) { $pdo->exec("ALTER TABLE turnos ADD COLUMN profesional VARCHAR(255) DEFAULT 'Cualquiera (Sin preferencia)'"); }

try { $pdo->query("SELECT id_servicio FROM turnos LIMIT 1"); } 
catch(Exception $e) { $pdo->exec("ALTER TABLE turnos ADD COLUMN id_servicio INT DEFAULT NULL"); }

try { $pdo->query("SELECT cliente_nombre FROM turnos LIMIT 1"); } 
catch(Exception $e) { $pdo->exec("ALTER TABLE turnos ADD COLUMN cliente_nombre VARCHAR(255) DEFAULT NULL"); }

try { $pdo->query("SELECT cliente_celular FROM turnos LIMIT 1"); } 
catch(Exception $e) { $pdo->exec("ALTER TABLE turnos ADD COLUMN cliente_celular VARCHAR(255) DEFAULT NULL"); }

try {
    $pdo->beginTransaction();

    $cliente_nombre = $nombre . ' ' . $apellido;

    // Buscar el ID del servicio en base al nombre para insertarlo como Clave Foránea
    $stmtServ = $pdo->prepare("SELECT id, duracion_minutos, email_profesional, capacidad FROM servicios WHERE id_negocio = :id_negocio AND nombre_servicio = :servicio LIMIT 1");
    $stmtServ->execute(['id_negocio' => $id_negocio, 'servicio' => $servicio]);
    $serv = $stmtServ->fetch();
    $id_servicio = $serv ? $serv['id'] : null;
    $duracion_nuevo = $serv && !empty($serv['duracion_minutos']) ? (int)$serv['duracion_minutos'] : 30;
    $capacidad_nuevo = $serv && !empty($serv['capacidad']) ? (int)$serv['capacidad'] : 1;
    $email_profesional = $serv && !empty($serv['email_profesional']) ? $serv['email_profesional'] : null;

    // =========================================================================
    // SISTEMA ANTICOLISIONES (Evitar Doble Reserva Simultánea)
    // =========================================================================
    $stmtConfig = $pdo->prepare("SELECT turnos_simultaneos FROM configuracion_web WHERE id_negocio = :id LIMIT 1");
    $stmtConfig->execute(['id' => $id_negocio]);
    $configWeb = $stmtConfig->fetch(PDO::FETCH_ASSOC);
    $simultaneos = $configWeb ? $configWeb['turnos_simultaneos'] : 'no';

    if ($simultaneos !== 'si') {
        // Bloqueo de fila para lectura concurrente de los turnos de ese día
        $stmtCheck = $pdo->prepare("
            SELECT t.hora, s.duracion_minutos, t.id_servicio 
            FROM turnos t 
            LEFT JOIN servicios s ON t.id_servicio = s.id 
            WHERE t.id_negocio = :id_negocio 
            AND t.fecha = :fecha 
            AND (t.profesional = :profesional OR t.profesional = 'Cualquiera (Sin preferencia)' OR :profesional = 'Cualquiera (Sin preferencia)')
            AND t.estado IN ('pendiente', 'confirmado', 'bloqueado')
            FOR UPDATE
        ");
        $stmtCheck->execute([
            'id_negocio' => $id_negocio,
            'fecha' => $fecha,
            'profesional' => $profesional
        ]);
        $turnosExistentes = $stmtCheck->fetchAll(PDO::FETCH_ASSOC);

        $nuevoInicio = strtotime("$fecha $hora:00");
        $nuevoFin = $nuevoInicio + ($duracion_nuevo * 60);

        $choque = false;
        $cuposOcupados = 0;

        foreach ($turnosExistentes as $te) {
            $duracion_existente = !empty($te['duracion_minutos']) ? (int)$te['duracion_minutos'] : 30;
            $tInicio = strtotime("$fecha {$te['hora']}:00");
            $tFin = $tInicio + ($duracion_existente * 60);

            // Superposición: Si el nuevo turno inicia antes de que termine el otro, y termina después de que el otro inicie
            if ($nuevoInicio < $tFin && $nuevoFin > $tInicio) {
                if ($te['id_servicio'] == $id_servicio && $tInicio == $nuevoInicio && $capacidad_nuevo > 1) {
                    $cuposOcupados++;
                } else {
                    $choque = true;
                    break;
                }
            }
        }

        if ($choque || $cuposOcupados >= $capacidad_nuevo) {
            $pdo->rollBack();
            http_response_code(409);
            if ($cuposOcupados >= $capacidad_nuevo && $capacidad_nuevo > 1) {
                echo json_encode(['success' => false, 'error' => 'Los cupos para esta clase o servicio en este horario ya están completamente llenos.']);
            } else {
                echo json_encode(['success' => false, 'error' => 'El horario seleccionado acaba de ser reservado por otra persona o se superpone con un turno existente. Por favor, actualiza la página y elige un nuevo horario.']);
            }
            exit;
        }
    }

    $stmt = $pdo->prepare(
        "INSERT INTO turnos (id_negocio, cliente_nombre, cliente_celular, fecha, hora, servicio, profesional, id_servicio, estado) 
         VALUES (:id_negocio, :cliente_nombre, :cliente_celular, :fecha, :hora, :servicio, :profesional, :id_servicio, :estado)"
    );

    $stmt->execute([
        'id_negocio' => $id_negocio,
        'cliente_nombre' => $cliente_nombre,
        'cliente_celular' => $celular,
        'fecha' => $fecha,
        'hora' => $hora,
        'servicio' => $servicio,
        'profesional' => $profesional,
        'id_servicio' => $id_servicio,
        'estado' => 'pendiente',
    ]);

    $pdo->commit();

} catch (PDOException $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    // Si falla la BD, no debería impedir el envío del email, pero sí notificar el error.
    // Quitamos el error 500 para que el navegador no asuma que el servidor colapsó
    echo json_encode(['success' => false, 'error' => 'Error al guardar el turno en la base de datos. Detalles: ' . $e->getMessage()]);
    exit;
}

$mailEnviado = false;

try {
    $mail = new PHPMailer(true);
    $mail->isSMTP();
    $mail->Host       = 'localhost';
    $mail->SMTPAuth   = true;
    $mail->Username   = 'no-reply@agendatina.site';
    $mail->Password   = 'Tlqb*Er0kQ';
    $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
    $mail->Port       = 587;
    $mail->CharSet    = 'UTF-8';
    $mail->SMTPOptions = array('ssl' => array('verify_peer' => false, 'verify_peer_name' => false, 'allow_self_signed' => true));

    // Mail al dueño
    $mail->setFrom('no-reply@agendatina.site', 'Agendatina (Turnos)');
    $mail->addAddress($to);
    $mail->isHTML(true);
    $mail->Subject = $subject;
    $mail->Body = $message;
    $mail->send();
    $mailEnviado = true;

    // Mail al profesional (si tiene email configurado)
    if (!empty($email_profesional)) {
        $mail->clearAddresses();
        $mail->addAddress($email_profesional);
        $profSubject = "Nuevo Turno Asignado - $fecha_display | $businessName";
        $profMessage = str_replace(
            "Has recibido una nueva solicitud de reserva desde tu página web.", 
            "Hola <strong>$profesional</strong>, se te ha asignado un nuevo turno en la agenda de $businessName.", 
            $message
        );
        $profMessage = str_replace("¡Nueva Solicitud de Turno!", "¡Nuevo Turno Asignado!", $profMessage);
        $mail->Subject = $profSubject;
        $mail->Body = $profMessage;
        $mail->send();
    }
} catch (Exception $e) {
    // Falló correo, pero el turno ya está en la DB
    error_log("Error al enviar correo de notificación: " . $mail->ErrorInfo);
}

// Responder al cliente garantizando que el proceso de correo ya finalizó
echo json_encode(['success' => true, 'mail_enviado' => $mailEnviado]);
?>