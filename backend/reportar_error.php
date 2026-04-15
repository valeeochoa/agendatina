<?php
session_start();
header('Content-Type: application/json; charset=utf-8');

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

require_once 'phpmailer/Exception.php';
require_once 'phpmailer/PHPMailer.php';
require_once 'phpmailer/SMTP.php';

require_once __DIR__ . '/conexion.php';

// Asegurar tabla de notificaciones para el Superadmin
try {
    $pdo->query("SELECT 1 FROM notificaciones_admin LIMIT 1");
} catch (Exception $e) {
    $pdo->exec("CREATE TABLE notificaciones_admin (
        id INT AUTO_INCREMENT PRIMARY KEY, 
        segmento VARCHAR(100), 
        mensaje TEXT, 
        id_negocio INT NULL,
        fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
        leida BOOLEAN DEFAULT FALSE
    )");
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método no permitido.']);
    exit;
}

$segmento = trim($_POST['segmento'] ?? 'General');
$mensaje = trim($_POST['mensaje'] ?? '');
$id_negocio = $_SESSION['id_negocio'] ?? null;
$nombre_negocio = 'Usuario Desconocido';
$email_negocio = '';

if ($id_negocio) {
    $stmt = $pdo->prepare("SELECT n.nombre_fantasia, u.email FROM negocios n LEFT JOIN personal_negocio pn ON n.id = pn.id_negocio LEFT JOIN usuarios u ON pn.id_usuario = u.id WHERE n.id = ? LIMIT 1");
    $stmt->execute([$id_negocio]);
    $neg = $stmt->fetch();
    if ($neg) {
        $nombre_negocio = $neg['nombre_fantasia'];
        $email_negocio = $neg['email'];
    }
}

if (empty($mensaje)) {
    echo json_encode(['success' => false, 'error' => 'El mensaje no puede estar vacío.']);
    exit;
}

try {
    // Guardar notificación para la campanita del superadmin
    $stmt = $pdo->prepare("INSERT INTO notificaciones_admin (segmento, mensaje, id_negocio) VALUES (?, ?, ?)");
    $stmt->execute([$segmento, $mensaje, $id_negocio]);

    // Enviar Email a soporte
    $mail = new PHPMailer(true);
    $mail->isSMTP();
    $mail->Host       = 'localhost'; // Ajustar si tienes servidor externo
    $mail->SMTPAuth   = true;
    $mail->Username   = 'no-reply@agendatina.site';
    $mail->Password   = 'Tlqb*Er0kQ';
    $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
    $mail->Port       = 587;
    $mail->CharSet    = 'UTF-8';
    $mail->SMTPOptions = array('ssl' => array('verify_peer' => false, 'verify_peer_name' => false, 'allow_self_signed' => true));

    $mail->setFrom('no-reply@agendatina.site', 'Reportes - Agendatina');
    $mail->addAddress('reportes@agendatina.site');
    //$mail->addAddress('soportes@agendatina.site');
    if ($email_negocio) $mail->addReplyTo($email_negocio, $nombre_negocio);
    
    $mail->isHTML(true);
    $mail->Subject = "Nuevo Reporte de Error - $segmento";
    $mail->Body = "<div style='font-family: Arial, sans-serif; padding: 20px;'><h2 style='color: #ef4444;'>¡Nuevo Reporte de Error!</h2><p><strong>Negocio:</strong> $nombre_negocio (ID: $id_negocio)</p><p><strong>Sección afectada:</strong> $segmento</p><p><strong>Mensaje del usuario:</strong></p><div style='background: #f1f5f9; padding: 15px; border-radius: 8px; border-left: 4px solid #ef4444;'>" . nl2br(htmlspecialchars($mensaje)) . "</div><p style='margin-top: 20px; font-size: 12px; color: #64748b;'>Este mensaje fue generado automáticamente desde la plataforma.</p></div>";
    
    $mail->send();
    echo json_encode(['success' => true]);

} catch (Exception $e) {
    echo json_encode(['success' => false, 'error' => 'Error al procesar el reporte: ' . $e->getMessage()]);
}
?>