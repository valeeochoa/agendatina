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

if (isset($_GET['action']) && $_GET['action'] === 'obtener_hilo' && !empty($_GET['id_reporte'])) {
    $idRep = (int)$_GET['id_reporte'];
    $id_negocio = $_SESSION['id_negocio'] ?? null;
    $stmtM = $pdo->prepare("SELECT * FROM mensajes_soporte WHERE id_reporte = ? AND id_negocio = ? ORDER BY fecha ASC");
    $stmtM->execute([$idRep, $id_negocio]);
    $msgs = $stmtM->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode(['success' => true, 'data' => $msgs]);
    exit;
}

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

if ($action === 'responder_cliente' || !empty($_POST['id_reporte'])) {
    $id_reporte = (int)($_POST['id_reporte'] ?? 0);
    if ($id_reporte > 0) {
        try {
            $pdo->query("SELECT 1 FROM mensajes_soporte LIMIT 1");
        } catch (Exception $e) {
            $pdo->exec("CREATE TABLE mensajes_soporte (
                id INT AUTO_INCREMENT PRIMARY KEY, id_reporte INT NOT NULL, id_negocio INT NOT NULL, emisor VARCHAR(20) DEFAULT 'admin', nombre_emisor VARCHAR(255), mensaje TEXT, fecha DATETIME DEFAULT CURRENT_TIMESTAMP
            )");
        }

        $pdo->prepare("INSERT INTO mensajes_soporte (id_reporte, id_negocio, emisor, nombre_emisor, mensaje) VALUES (?, ?, 'cliente', ?, ?)")
            ->execute([$id_reporte, $id_negocio, $nombre_usuario, $mensaje]);

        $pdo->prepare("UPDATE reportes_error SET estado = 'pendiente' WHERE id = ?")->execute([$id_reporte]);

        $stmtNotifAdmin = $pdo->prepare("INSERT INTO notificaciones_admin (segmento, mensaje, id_negocio, nombre_negocio, id_usuario, nombre_usuario, email_usuario, rol_usuario, leida) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)");
        $stmtNotifAdmin->execute(['Soporte / Respuesta de Cliente', "Respuesta en Reporte #{$id_reporte}: {$mensaje}", $id_negocio, $nombre_negocio, $id_usuario, $nombre_usuario, $email_usuario, $rol_usuario]);

        echo json_encode(['success' => true, 'message' => 'Respuesta enviada a soporte.']);
        exit;
    }
}

// Determinar el tipo exacto según el formulario que envió la solicitud
if ($action === 'report_error') {
    $tipoReporte = 'Reporte de Error';
    $prefixNotif = 'Reporte de Error: ';
    $subjectPrefix = '[Agendatina] REPORTE DE ERROR';
} else {
    $tipoReporte = 'Sugerencia / Mejora';
    $prefixNotif = 'Sugerencia / Mejora: ';
    $subjectPrefix = '[Agendatina] SUGERENCIA / MEJORA';
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

    // 1. Insertar en reportes_error con el tipo correspondiente (Reporte de Error o Sugerencia / Mejora)
    try {
        $stmtRep = $pdo->prepare("INSERT INTO reportes_error (id_negocio, nombre_negocio, id_usuario, nombre_usuario, email_usuario, rol_usuario, tipo, modulo, descripcion) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
        $stmtRep->execute([$id_negocio, $nombre_negocio, $id_usuario, $nombre_usuario, $email_usuario, $rol_usuario, $tipoReporte, $segmento, $mensaje]);
    } catch (Exception $eRep) {}

    // 2. Insertar en notificaciones_admin con prefijo correspondiente
    $stmt = $pdo->prepare("INSERT INTO notificaciones_admin (segmento, mensaje, id_negocio, nombre_negocio, id_usuario, nombre_usuario, email_usuario, rol_usuario) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
    $stmt->execute([$prefixNotif . $segmento, $mensaje, $id_negocio, $nombre_negocio, $id_usuario, $nombre_usuario, $email_usuario, $rol_usuario]);

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
        $mail->Subject = "$subjectPrefix: $segmento ($nombre_negocio)";
        $mail->Body = "<h3>$tipoReporte en $segmento</h3><p><strong>Negocio:</strong> " . htmlspecialchars($nombre_negocio) . " (ID: " . ($id_negocio ?? 'N/A') . ")</p><p><strong>Usuario:</strong> " . htmlspecialchars($nombre_usuario) . " (" . htmlspecialchars($email_usuario) . ")</p><p><strong>Mensaje:</strong><br/>" . nl2br(htmlspecialchars($mensaje)) . "</p>";
        $mail->send();
    } catch (PHPMailerException $mailEx) {
        // Falló el email, pero el reporte ya está en la Base de Datos a salvo
    }

    echo json_encode(['success' => true]);
} catch (Exception $e) {
    echo json_encode(['success' => false, 'error' => 'Error al procesar la solicitud.']);
}
?>