<?php
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception as MailException;

header('Content-Type: application/json; charset=utf-8');

if (!file_exists(__DIR__ . '/phpmailer/PHPMailer.php')) {
    echo json_encode(['success' => false, 'error' => 'Falta la librería de correo en el servidor.']);
    exit;
}

require_once __DIR__ . '/phpmailer/Exception.php';
require_once __DIR__ . '/phpmailer/PHPMailer.php';
require_once __DIR__ . '/phpmailer/SMTP.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método no permitido.']);
    exit;
}

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

$email = strtolower(trim($_POST['email'] ?? $_SESSION['cliente_email'] ?? ''));

if (empty($email)) {
    echo json_encode(['success' => false, 'error' => 'El correo electrónico es obligatorio.']);
    exit;
}

require_once __DIR__ . '/conexion.php';

try {
    // Asegurar existencia de columnas reset_token, reset_token_expire y password en clientes_negocio
    try { $pdo->query("SELECT reset_token FROM clientes_negocio LIMIT 1"); } 
    catch(\Throwable $e) { try { $pdo->exec("ALTER TABLE clientes_negocio ADD COLUMN reset_token VARCHAR(255) DEFAULT NULL, ADD COLUMN reset_token_expire DATETIME DEFAULT NULL"); } catch(\Throwable $ex) {} }

    try { $pdo->query("SELECT password FROM clientes_negocio LIMIT 1"); } 
    catch(\Throwable $e) { try { $pdo->exec("ALTER TABLE clientes_negocio ADD COLUMN password VARCHAR(255) DEFAULT NULL"); } catch(\Throwable $ex) {} }

    // Buscar si el correo pertenece a algún cliente/alumno
    $stmt = $pdo->prepare("SELECT id, nombre_completo FROM clientes_negocio WHERE LOWER(TRIM(email)) = :email LIMIT 1");
    $stmt->execute(['email' => $email]);
    $cliente = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$cliente) {
        // Verificar en la tabla de turnos si tiene historial
        $stmtTurno = $pdo->prepare("SELECT id, cliente_nombre FROM turnos WHERE LOWER(TRIM(cliente_celular)) = :email OR LOWER(TRIM(notas)) LIKE :email_like LIMIT 1");
        $stmtTurno->execute(['email' => $email, 'email_like' => '%' . $email . '%']);
        $turno = $stmtTurno->fetch(PDO::FETCH_ASSOC);
        
        if ($turno) {
            $stmtIns = $pdo->prepare("INSERT INTO clientes_negocio (id_negocio, nombre_completo, email, estado) VALUES (1, :nombre, :email, 'activo')");
            $stmtIns->execute(['nombre' => $turno['cliente_nombre'] ?: 'Alumno', 'email' => $email]);
            $cliente = ['id' => $pdo->lastInsertId(), 'nombre_completo' => $turno['cliente_nombre'] ?: 'Alumno'];
        }
    }

    if ($cliente) {
        // Generar un token único y definir expiración estricta de 10 MINUTOS
        $token = bin2hex(random_bytes(32));
        $expire = date('Y-m-d H:i:s', strtotime('+10 minutes'));

        $update = $pdo->prepare("UPDATE clientes_negocio SET reset_token = :token, reset_token_expire = :expire WHERE LOWER(TRIM(email)) = :email");
        $update->execute(['token' => $token, 'expire' => $expire, 'email' => $email]);

        // Construir enlace de restablecimiento dinámico para el alumno
        $protocol = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? "https" : "http";
        $dir = str_replace('/backend', '', dirname($_SERVER['PHP_SELF']));
        $reset_link = $protocol . "://" . $_SERVER['HTTP_HOST'] . $dir . "/reset_password.html?type=cliente&token=" . $token;

        // Configuración PHPMailer
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

        $mail->setFrom('no-reply@agendatina.site', 'Portal del Alumno - Agendatina');
        $mail->addAddress($email);
        $mail->isHTML(true);
        $mail->Subject = '🔒 Restablecer Contraseña - Portal del Alumno';
        
        $nombre = !empty($cliente['nombre_completo']) ? explode(' ', $cliente['nombre_completo'])[0] : 'Alumno';

        $mail->Body = "
            <div style='font-family: Arial, sans-serif; padding: 25px; background: #fff7ed; border-radius: 16px; max-width: 600px; margin: 0 auto; border: 2px solid #fed7aa;'>
                <div style='text-align: center; margin-bottom: 20px;'>
                    <h2 style='color: #ea580c; margin-bottom: 5px;'>Agendatina • Portal del Alumno</h2>
                    <span style='font-size: 12px; font-weight: bold; color: #c2410c; background: #ffedd5; padding: 4px 12px; border-radius: 12px;'>Restablecimiento de Clave</span>
                </div>
                <h3 style='color: #1e293b; margin-top: 0;'>Hola $nombre,</h3>
                <p style='font-size: 15px; color: #475569; line-height: 1.5;'>
                    Recibimos una solicitud para establecer una nueva contraseña de acceso a tu Portal del Alumno.
                </p>
                <p style='font-size: 15px; color: #475569; line-height: 1.5;'>
                    Hacé clic en el siguiente botón para ingresar tu nueva clave personal. <strong>Por motivos de seguridad, este enlace es único para tu cuenta y vence en exactamente 10 minutos.</strong>
                </p>
                <div style='text-align: center; margin: 30px 0;'>
                    <a href='$reset_link' style='background-color: #fc8712; color: white; padding: 14px 28px; text-decoration: none; border-radius: 12px; font-weight: bold; display: inline-block; box-shadow: 0 4px 12px rgba(252,135,18,0.3);'>
                        Restablecer Mi Contraseña
                    </a>
                </div>
                <p style='font-size: 12px; color: #94a3b8; text-align: center;'>
                    Si no solicitaste este cambio, podés ignorar este correo de forma segura. Tu clave actual permanecerá intacta.
                </p>
            </div>
        ";

        $mail->send();
        echo json_encode([
            'success' => true, 
            'message' => 'Te enviamos un correo con las instrucciones para restablecer tu contraseña. El enlace vence en 10 minutos.'
        ]);
    } else {
        echo json_encode(['success' => false, 'error' => 'No encontramos tu correo electrónico en nuestro sistema de alumnos.']);
    }

} catch (\Throwable $e) {
    echo json_encode(['success' => false, 'error' => 'Error al procesar la solicitud: ' . $e->getMessage()]);
}
