<?php
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;
use PHPMailer\PHPMailer\SMTP;

require 'phpmailer/Exception.php';
require 'phpmailer/PHPMailer.php';
require 'phpmailer/SMTP.php';

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método no permitido.']);
    exit;
}

$plan = isset($_POST['plan']) ? trim($_POST['plan']) : '';
$nombre = isset($_POST['nombre']) ? trim($_POST['nombre']) : '';
$negocio = isset($_POST['negocio']) ? trim($_POST['negocio']) : '';
$celular = isset($_POST['celular']) ? trim($_POST['celular']) : '';
$email = isset($_POST['email']) ? trim($_POST['email']) : '';
$mensaje = isset($_POST['mensaje']) ? trim($_POST['mensaje']) : '';

if (empty($nombre) || empty($negocio) || empty($celular) || empty($email) || empty($mensaje)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Por favor, completa todos los campos requeridos.']);
    exit;
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'El formato del email no es válido.']);
    exit;
}

$mail = new PHPMailer(true);

try {
    // Configuración del servidor SMTP
    $mail->isSMTP();
    $mail->Host       = 'localhost'; // Ajusta por ej. smtp.hostinger.com si es necesario
    $mail->SMTPAuth   = true;
    $mail->Username   = 'no-reply@agendatina.site'; // Tu correo de salida
    $mail->Password   = 'Tlqb*Er0kQ'; // La contraseña del correo
    $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS; // o ENCRYPTION_SMTPS para puerto 465
    $mail->Port       = 587; // o 465
    $mail->CharSet    = 'UTF-8';

    // Desactivar verificación de certificado si es host local o de prueba
    $mail->SMTPOptions = array(
        'ssl' => array(
            'verify_peer' => false,
            'verify_peer_name' => false,
            'allow_self_signed' => true
        )
    );

    // Remitente y destinatario
    $mail->setFrom('no-reply@agendatina.site', 'Agendatina (Web)');
    $mail->addAddress('info@agendatina.site');
    $mail->addReplyTo($email, $nombre);

    // Contenido
    $mail->isHTML(true);
    $asuntoStr = empty($plan) ? 'Nueva Consulta Web' : "Solicitud de $plan";
    $mail->Subject = "$asuntoStr - $negocio";
    
    $htmlBody = "
        <div style='font-family: Arial, sans-serif; background-color: #f8fafc; padding: 20px; color: #333;'>
            <div style='max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; border: 1px solid #e2e8f0;'>
                <div style='background-color: #3b82f6; color: white; padding: 20px; text-align: center;'>
                    <h2 style='margin: 0;'>$asuntoStr</h2>
                </div>
                <div style='padding: 20px;'>
                    <p><strong>Nombre:</strong> $nombre</p>
                    <p><strong>Negocio:</strong> $negocio</p>
                    <p><strong>WhatsApp:</strong> $celular</p>
                    <p><strong>Email:</strong> $email</p>
                    " . (!empty($plan) ? "<p><strong>Plan Interesado:</strong> $plan</p>" : "") . "
                    <hr style='border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;'>
                    <p><strong>Mensaje:</strong></p>
                    <div style='background-color: #f1f5f9; padding: 15px; border-radius: 8px;'>
                        " . nl2br(htmlspecialchars($mensaje)) . "
                    </div>
                </div>
            </div>
        </div>
    ";

    $mail->Body = $htmlBody;
    $mail->AltBody = strip_tags(str_replace('<br>', "\n", $htmlBody));

    $mail->send();
    echo json_encode(['success' => true]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => "El mensaje no pudo ser enviado. Detalles: {$mail->ErrorInfo}"]);
}
?>