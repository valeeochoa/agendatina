<?php
session_start();
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/conexion.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

require_once __DIR__ . '/phpmailer/Exception.php';
require_once __DIR__ . '/phpmailer/PHPMailer.php';
require_once __DIR__ . '/phpmailer/SMTP.php';

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'error' => 'No autorizado.']);
    exit;
}

$id_usuario = $_SESSION['user_id'];

try {
    $stmt = $pdo->prepare("SELECT nombre_completo, email FROM usuarios WHERE id = ?");
    $stmt->execute([$id_usuario]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user) {
        echo json_encode(['success' => false, 'error' => 'Usuario no encontrado.']);
        exit;
    }

    $nuevoCodigo = sprintf("%06d", mt_rand(1, 999999));
    $expiracion = date('Y-m-d H:i:s', strtotime('+15 minutes'));

    $update = $pdo->prepare("UPDATE usuarios SET codigo_verificacion = ?, verificacion_expira = ? WHERE id = ?");
    $update->execute([$nuevoCodigo, $expiracion, $id_usuario]);

    // Enviar correo
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

        $mail->setFrom('no-reply@agendatina.site', 'Agendatina - Verificación');
        $mail->addAddress($user['email'], $user['nombre_completo']);
        $mail->isHTML(true);
        $mail->Subject = "Nuevo Código de Verificación - Agendatina";
        $mail->Body = "<div style='font-family: Arial, sans-serif; padding: 20px; text-align: center;'><h2 style='color: #D11149;'>Código de Verificación</h2><p>Tu nuevo código para verificar tu cuenta en Agendatina es:</p><div style='font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #D11149; margin: 20px 0;'>$nuevoCodigo</div><p style='font-size: 13px; color: #64748b;'>Este código es válido durante los próximos 15 minutos.</p></div>";

        $mail->send();
    } catch (Exception $mEx) {
        error_log("Error al enviar email de código: " . $mEx->getMessage());
    }

    echo json_encode(['success' => true, 'message' => 'Nuevo código enviado a tu correo electrónico.']);
} catch (Exception $e) {
    echo json_encode(['success' => false, 'error' => 'Error al reenviar el código: ' . $e->getMessage()]);
}
?>
