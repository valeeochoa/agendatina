<?php
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

require_once __DIR__ . '/../phpmailer/Exception.php';
require_once __DIR__ . '/../phpmailer/PHPMailer.php';
require_once __DIR__ . '/../phpmailer/SMTP.php';

if (!function_exists('notificarSuperAdminAlert')) {
    function notificarSuperAdminAlert($pdo, $segmento, $mensaje, $id_negocio = null) {
        $id_usuario = $_SESSION['user_id'] ?? null;
        $nombre_usuario = $_SESSION['nombre_completo'] ?? 'Usuario Desconocido';
        $email_usuario = $_SESSION['email'] ?? '';
        $rol_usuario = $_SESSION['rol_en_local'] ?? 'admin';
        $nombre_negocio = $_SESSION['nombre_negocio'] ?? 'Negocio Desconocido';

        if ($id_negocio && $nombre_negocio === 'Negocio Desconocido') {
            try {
                $stmt = $pdo->prepare("SELECT nombre_fantasia FROM negocios WHERE id = ? LIMIT 1");
                $stmt->execute([$id_negocio]);
                $n = $stmt->fetchColumn();
                if ($n) $nombre_negocio = $n;
            } catch(Exception $e) {}
        }

        // 1. Guardar en notificaciones_admin con migración de columnas
        try {
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

            $stmtNotif = $pdo->prepare("INSERT INTO notificaciones_admin (segmento, mensaje, id_negocio, nombre_negocio, id_usuario, nombre_usuario, email_usuario, rol_usuario) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
            $stmtNotif->execute([$segmento, $mensaje, $id_negocio, $nombre_negocio, $id_usuario, $nombre_usuario, $email_usuario, $rol_usuario]);
        } catch(Exception $eNotif) {
            error_log("Error insertando notificacion_admin: " . $eNotif->getMessage());
        }

        // 2. Enviar Correo al SuperAdmin
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

            $mail->setFrom('no-reply@agendatina.site', 'Alertas Agendatina');
            $mail->addAddress('reportes@agendatina.site');
            $mail->isHTML(true);
            $mail->Subject = "⚠️ Alerta - $segmento ($nombre_negocio)";
            $mail->Body = "
            <div style='font-family: Arial, sans-serif; padding: 20px; border-left: 4px solid #ef4444; background: #fafafa;'>
                <h3 style='color: #ef4444; margin-top: 0;'>⚠️ Alerta de Sistema: $segmento</h3>
                <p><strong>Emprendimiento:</strong> $nombre_negocio (ID: $id_negocio)</p>
                <p><strong>Usuario / Emisor:</strong> $nombre_usuario ($email_usuario) - <em>Rol: $rol_usuario</em></p>
                <div style='background: #fff; padding: 12px; border: 1px solid #e2e8f0; border-radius: 8px; margin-top: 10px;'>
                    " . nl2br(htmlspecialchars($mensaje)) . "
                </div>
                <p style='font-size: 11px; color: #94a3b8; margin-top: 15px;'>Notificación automatizada enviada desde el panel de Agendatina.</p>
            </div>";
            $mail->send();
        } catch(Exception $eMail) {
            error_log("Error enviando email de alerta superadmin: " . $eMail->getMessage());
        }
    }
}
?>
