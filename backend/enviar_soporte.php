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

$id_usuario = $_SESSION['user_id'] ?? null;
$nombre_usuario = $_SESSION['nombre_completo'] ?? 'Usuario Desconocido';
$email_usuario = $_SESSION['email'] ?? '';
$rol_usuario = $_SESSION['rol_en_local'] ?? 'admin';
$nombre_negocio = 'Usuario Desconocido';

if ($id_negocio) {
    $stmtN = $pdo->prepare("SELECT nombre_fantasia FROM negocios WHERE id = ? LIMIT 1");
    $stmtN->execute([$id_negocio]);
    $nombre_negocio = $stmtN->fetchColumn() ?: 'Usuario Desconocido';
}

try {
    // Asegurar tabla notificaciones_admin
    try { $pdo->query("SELECT 1 FROM notificaciones_admin LIMIT 1"); } 
    catch(Exception $e) { 
        $pdo->exec("CREATE TABLE notificaciones_admin (
            id INT AUTO_INCREMENT PRIMARY KEY, segmento VARCHAR(100), mensaje TEXT, 
            id_negocio INT NULL, nombre_negocio VARCHAR(255), id_usuario INT NULL, nombre_usuario VARCHAR(255), email_usuario VARCHAR(255), rol_usuario VARCHAR(50) DEFAULT 'admin', fecha DATETIME DEFAULT CURRENT_TIMESTAMP, leida BOOLEAN DEFAULT FALSE
        )"); 
    }
    $notifCols = [
        'nombre_negocio' => 'VARCHAR(255) DEFAULT NULL',
        'id_usuario' => 'INT NULL',
        'nombre_usuario' => 'VARCHAR(255) DEFAULT NULL',
        'email_usuario' => 'VARCHAR(255) DEFAULT NULL',
        'rol_usuario' => "VARCHAR(50) DEFAULT 'admin'"
    ];
    foreach ($notifCols as $col => $tipo) {
        try { $pdo->query("SELECT $col FROM notificaciones_admin LIMIT 1"); } 
        catch(Exception $e) { $pdo->exec("ALTER TABLE notificaciones_admin ADD COLUMN $col $tipo"); }
    }

    // Asegurar tabla reportes_error
    try { $pdo->query("SELECT 1 FROM reportes_error LIMIT 1"); } 
    catch(Exception $e) { 
        $pdo->exec("CREATE TABLE reportes_error (
            id INT AUTO_INCREMENT PRIMARY KEY, id_negocio INT NULL, nombre_negocio VARCHAR(255), id_usuario INT NULL, nombre_usuario VARCHAR(255), email_usuario VARCHAR(255), rol_usuario VARCHAR(50) DEFAULT 'admin', tipo VARCHAR(50) DEFAULT 'Reporte de Error', modulo VARCHAR(100) DEFAULT 'General', descripcion TEXT, estado VARCHAR(50) DEFAULT 'pendiente', fecha DATETIME DEFAULT CURRENT_TIMESTAMP
        )"); 
    }
    $reportesCols = [
        'nombre_negocio' => 'VARCHAR(255) DEFAULT NULL',
        'id_usuario' => 'INT NULL',
        'nombre_usuario' => 'VARCHAR(255) DEFAULT NULL',
        'email_usuario' => 'VARCHAR(255) DEFAULT NULL',
        'rol_usuario' => "VARCHAR(50) DEFAULT 'admin'",
        'tipo' => "VARCHAR(50) DEFAULT 'Reporte de Error'"
    ];
    foreach ($reportesCols as $col => $tipo) {
        try { $pdo->query("SELECT $col FROM reportes_error LIMIT 1"); } 
        catch(Exception $e) { $pdo->exec("ALTER TABLE reportes_error ADD COLUMN $col $tipo"); }
    }

    // 1. Insertar en reportes_error como Sugerencia / Mejora
    try {
        $stmtRep = $pdo->prepare("INSERT INTO reportes_error (id_negocio, nombre_negocio, id_usuario, nombre_usuario, email_usuario, rol_usuario, tipo, modulo, descripcion) VALUES (?, ?, ?, ?, ?, ?, 'Sugerencia / Mejora', ?, ?)");
        $stmtRep->execute([$id_negocio, $nombre_negocio, $id_usuario, $nombre_usuario, $email_usuario, $rol_usuario, $segmento, $mensaje]);
    } catch (Exception $eRep) {}

    // 2. Insertar en notificaciones_admin
    $stmt = $pdo->prepare("INSERT INTO notificaciones_admin (segmento, mensaje, id_negocio, nombre_negocio, id_usuario, nombre_usuario, email_usuario, rol_usuario) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
    $stmt->execute(["Sugerencia / Mejora: " . $segmento, $mensaje, $id_negocio, $nombre_negocio, $id_usuario, $nombre_usuario, $email_usuario, $rol_usuario]);

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