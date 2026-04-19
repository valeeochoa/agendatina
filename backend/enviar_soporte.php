<?php
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception as PHPMailerException;

session_start();
header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/conexion.php';
require_once __DIR__ . '/phpmailer/Exception.php';
require_once __DIR__ . '/phpmailer/PHPMailer.php';
require_once __DIR__ . '/phpmailer/SMTP.php';

$action = $_POST['action'] ?? '';
$segmento = $_POST['segmento'] ?? 'Soporte';
$mensaje = $_POST['mensaje'] ?? '';
$id_negocio = $_SESSION['id_negocio'] ?? null;

if (empty($mensaje)) {
    echo json_encode(['success' => false, 'error' => 'El mensaje está vacío.']);
    exit;
}

try {
    // Asegurarse de que la tabla exista
    try { $pdo->query("SELECT 1 FROM notificaciones_admin LIMIT 1"); } 
    catch(Exception $e) { 
        $pdo->exec("CREATE TABLE notificaciones_admin (
            id INT AUTO_INCREMENT PRIMARY KEY, segmento VARCHAR(100), mensaje TEXT, 
            id_negocio INT NULL, fecha DATETIME DEFAULT CURRENT_TIMESTAMP, leida BOOLEAN DEFAULT FALSE
        )"); 
    }

    // Insertar el reporte en la Base de Datos del SuperAdmin
    $stmt = $pdo->prepare("INSERT INTO notificaciones_admin (segmento, mensaje, id_negocio) VALUES (?, ?, ?)");
    $stmt->execute([$segmento, $mensaje, $id_negocio]);

    // Intentar enviar el correo (Aislado para que no rompa el guardado si el servidor SMTP falla)
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

        $mail->setFrom('no-reply@agendatina.site', 'Agendatina Sistema');
        $mail->addAddress('soportes@agendatina.site'); // Correo de soportes
        $mail->addAddress('vochoaolguin@gmail.com'); // Correo del SuperAdmin
        $mail->isHTML(true);
        $mail->Subject = "Nuevo Soporte: $segmento";
        $mail->Body = "<h3>Nuevo mensaje de $segmento</h3><p><strong>ID Negocio:</strong> " . ($id_negocio ?? 'No identificado (Sesión Expirada)') . "</p><p><strong>Mensaje:</strong><br/>" . nl2br(htmlspecialchars($mensaje)) . "</p>";
        $mail->send();
    } catch (PHPMailerException $mailEx) {
        // Falló el email, pero el reporte ya está en la Base de Datos a salvo
    }

    echo json_encode(['success' => true]);
} catch (Exception $e) {
    echo json_encode(['success' => false, 'error' => 'Error al procesar la solicitud.']);
}
?>