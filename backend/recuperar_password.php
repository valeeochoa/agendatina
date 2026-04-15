<?php
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

header('Content-Type: application/json; charset=utf-8');

// Validar si PHPMailer existe antes de intentar cargarlo (Evita el Error 500)
if (!file_exists('phpmailer/PHPMailer.php')) {
    echo json_encode(['success' => false, 'error' => 'Falta subir la carpeta "phpmailer" al servidor.']);
    exit;
}

require_once 'phpmailer/Exception.php';
require_once 'phpmailer/PHPMailer.php';
require_once 'phpmailer/SMTP.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método no permitido.']);
    exit;
}

$email = trim($_POST['email'] ?? '');
if (empty($email)) {
    echo json_encode(['success' => false, 'error' => 'El correo electrónico es requerido.']);
    exit;
}

require_once __DIR__ . '/conexion.php';

try {
    // Migración dinámica: Asegurar que existan las columnas para el token temporal en la tabla usuarios
    try { $pdo->query("SELECT reset_token FROM usuarios LIMIT 1"); } 
    catch(\Exception $e) { $pdo->exec("ALTER TABLE usuarios ADD COLUMN reset_token VARCHAR(255) DEFAULT NULL, ADD COLUMN reset_token_expire DATETIME DEFAULT NULL"); }

    // Buscar si el correo pertenece a algún usuario
    $stmt = $pdo->prepare("SELECT id, nombre_completo FROM usuarios WHERE email = :email ORDER BY id DESC LIMIT 1");
    $stmt->execute(['email' => $email]);
    $user = $stmt->fetch();

    if ($user) {
        // Generar un token único y definir expiración (1 hora)
        $token = bin2hex(random_bytes(32));
        $expire = date('Y-m-d H:i:s', strtotime('+1 hour'));

        $update = $pdo->prepare("UPDATE usuarios SET reset_token = :token, reset_token_expire = :expire WHERE id = :id");
        $update->execute(['token' => $token, 'expire' => $expire, 'id' => $user['id']]);

        // Construir enlace de restablecimiento dinámicamente según dónde esté alojada la página
        $protocol = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? "https" : "http";
        $dir = str_replace('/backend', '', dirname($_SERVER['PHP_SELF']));
        $reset_link = $protocol . "://" . $_SERVER['HTTP_HOST'] . $dir . "/reset_password.html?token=" . $token;

        // Configuración de PHPMailer (Igual que en enviar_turno.php)
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

        $mail->setFrom('no-reply@agendatina.site', 'Seguridad - Agendatina');
        $mail->addAddress($email);
        $mail->isHTML(true);
        $mail->Subject = 'Recuperación de Contraseña';
        
        $nombre = !empty($user['nombre_completo']) ? explode(' ', $user['nombre_completo'])[0] : 'Usuario';

        $mail->Body = "<div style='font-family: Arial, sans-serif; padding: 20px; background: #f8fafc; border-radius: 12px; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0;'><h2 style='color: #1e293b;'>Hola $nombre,</h2><p style='font-size: 16px; color: #475569;'>Hemos recibido una solicitud para restablecer la contraseña de tu cuenta en Agendatina.</p><p style='font-size: 16px; color: #475569;'>Haz clic en el siguiente botón para crear una nueva contraseña. Este enlace es válido por 1 hora.</p><div style='text-align: center; margin: 35px 0;'><a href='$reset_link' style='background-color: #3b82f6; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;'>Restablecer Contraseña</a></div><p style='font-size: 14px; color: #94a3b8;'>Si no solicitaste este cambio, puedes ignorar este correo de forma segura.</p></div>";

        $mail->send();
        echo json_encode(['success' => true]);
    } else {
        echo json_encode(['success' => false, 'error' => 'El mail no se encuentra registrado.']);
    }
    
} catch (\Exception $e) {
    echo json_encode(['success' => false, 'error' => 'Error interno del servidor.']);
}
?>