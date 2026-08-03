<?php
session_start();
header('Content-Type: application/json; charset=utf-8');

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

require_once 'phpmailer/Exception.php';
require_once 'phpmailer/PHPMailer.php';
require_once 'phpmailer/SMTP.php';

require_once __DIR__ . '/conexion.php';

// Asegurar tabla de notificaciones para el Superadmin con datos de identidad
try {
    $pdo->query("SELECT 1 FROM notificaciones_admin LIMIT 1");
} catch (Exception $e) {
    $pdo->exec("CREATE TABLE notificaciones_admin (
        id INT AUTO_INCREMENT PRIMARY KEY, 
        segmento VARCHAR(100), 
        mensaje TEXT, 
        id_negocio INT NULL,
        nombre_negocio VARCHAR(255) DEFAULT NULL,
        id_usuario INT NULL,
        nombre_usuario VARCHAR(255) DEFAULT NULL,
        email_usuario VARCHAR(255) DEFAULT NULL,
        rol_usuario VARCHAR(50) DEFAULT 'admin',
        fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
        leida BOOLEAN DEFAULT FALSE
    )");
}

$cols = [
    'nombre_negocio' => 'VARCHAR(255) DEFAULT NULL',
    'id_usuario' => 'INT NULL',
    'nombre_usuario' => 'VARCHAR(255) DEFAULT NULL',
    'email_usuario' => 'VARCHAR(255) DEFAULT NULL',
    'rol_usuario' => "VARCHAR(50) DEFAULT 'admin'"
];
foreach ($cols as $col => $tipo) {
    try { $pdo->query("SELECT $col FROM notificaciones_admin LIMIT 1"); } 
    catch(Exception $e) { $pdo->exec("ALTER TABLE notificaciones_admin ADD COLUMN $col $tipo"); }
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método no permitido.']);
    exit;
}

$segmento = trim($_POST['segmento'] ?? 'General');
$mensaje = trim($_POST['mensaje'] ?? '');
$id_negocio = $_SESSION['id_negocio'] ?? null;
$id_usuario = $_SESSION['user_id'] ?? null;
$nombre_usuario = $_SESSION['nombre_completo'] ?? 'Usuario Desconocido';
$email_usuario = $_SESSION['email'] ?? '';
$rol_usuario = $_SESSION['rol_en_local'] ?? 'admin';
$nombre_negocio = 'Usuario Desconocido';

if ($id_negocio) {
    $stmt = $pdo->prepare("SELECT n.nombre_fantasia, u.email, u.nombre_completo FROM negocios n LEFT JOIN personal_negocio pn ON n.id = pn.id_negocio LEFT JOIN usuarios u ON pn.id_usuario = u.id WHERE n.id = ? LIMIT 1");
    $stmt->execute([$id_negocio]);
    $neg = $stmt->fetch();
    if ($neg && !empty($neg['nombre_fantasia'])) {
        $nombre_negocio = $neg['nombre_fantasia'];
        if (!$email_usuario) $email_usuario = $neg['email'] ?? '';
        if ($nombre_usuario === 'Usuario Desconocido' && !empty($neg['nombre_completo'])) $nombre_usuario = $neg['nombre_completo'];
    } elseif (isset($_SESSION['is_demo']) && $_SESSION['is_demo']) {
        $nombre_negocio = $_SESSION['nombre_negocio'] ?? 'Agendatina (DEMO)';
        $email_usuario = 'demo@agendatina.site';
    }
} elseif (isset($_SESSION['is_demo']) && $_SESSION['is_demo']) {
    $nombre_negocio = $_SESSION['nombre_negocio'] ?? 'Agendatina (DEMO)';
    $email_usuario = 'demo@agendatina.site';
}

if (empty($mensaje)) {
    echo json_encode(['success' => false, 'error' => 'El mensaje no puede estar vacío.']);
    exit;
}

// Asegurar tabla reportes_error
try {
    $pdo->query("SELECT 1 FROM reportes_error LIMIT 1");
} catch (Exception $e) {
    $pdo->exec("CREATE TABLE reportes_error (
        id INT AUTO_INCREMENT PRIMARY KEY,
        id_negocio INT NULL,
        nombre_negocio VARCHAR(255) DEFAULT NULL,
        id_usuario INT NULL,
        nombre_usuario VARCHAR(255) DEFAULT NULL,
        email_usuario VARCHAR(255) DEFAULT NULL,
        rol_usuario VARCHAR(50) DEFAULT 'admin',
        tipo VARCHAR(50) DEFAULT 'Reporte de Error',
        modulo VARCHAR(100) DEFAULT 'General',
        descripcion TEXT,
        estado VARCHAR(50) DEFAULT 'pendiente',
        fecha DATETIME DEFAULT CURRENT_TIMESTAMP
    )");
}
try { $pdo->query("SELECT tipo FROM reportes_error LIMIT 1"); } catch(Exception $e) { $pdo->exec("ALTER TABLE reportes_error ADD COLUMN tipo VARCHAR(50) DEFAULT 'Reporte de Error'"); }
try { $pdo->query("SELECT rol_usuario FROM reportes_error LIMIT 1"); } catch(Exception $e) { $pdo->exec("ALTER TABLE reportes_error ADD COLUMN rol_usuario VARCHAR(50) DEFAULT 'admin'"); }

try {
    // 1. Guardar en la tabla oficial de reportes de error
    $stmtRep = $pdo->prepare("INSERT INTO reportes_error (id_negocio, nombre_negocio, id_usuario, nombre_usuario, email_usuario, rol_usuario, tipo, modulo, descripcion) VALUES (?, ?, ?, ?, ?, ?, 'Reporte de Error', ?, ?)");
    $stmtRep->execute([$id_negocio, $nombre_negocio, $id_usuario, $nombre_usuario, $email_usuario, $rol_usuario, $segmento, $mensaje]);

    // 2. Guardar notificación para el Superadmin
    $stmt = $pdo->prepare("INSERT INTO notificaciones_admin (segmento, mensaje, id_negocio, nombre_negocio, id_usuario, nombre_usuario, email_usuario, rol_usuario) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
    $stmt->execute(["Reporte de Error: " . $segmento, $mensaje, $id_negocio, $nombre_negocio, $id_usuario, $nombre_usuario, $email_usuario, $rol_usuario]);

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