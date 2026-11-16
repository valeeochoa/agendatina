<?php
use PHPMailer\PHPMailer\PHPMailer;

function ensureCupoWaitlistTables($pdo) {
    try {
        $pdo->query("SELECT id FROM cupos_lista_espera LIMIT 1");
    } catch (\Throwable $e) {
        try {
            $pdo->exec("CREATE TABLE IF NOT EXISTS cupos_lista_espera (
                id INT AUTO_INCREMENT PRIMARY KEY,
                id_negocio INT NOT NULL,
                id_servicio INT NOT NULL DEFAULT 0,
                servicio VARCHAR(255) NOT NULL,
                fecha DATE NOT NULL,
                hora VARCHAR(10) NOT NULL,
                email VARCHAR(255) NOT NULL,
                nombre VARCHAR(255) DEFAULT NULL,
                notificado TINYINT(1) DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_waitlist_slot (id_negocio, fecha, hora, notificado),
                INDEX idx_waitlist_email (email)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
        } catch (\Throwable $e2) {}
    }

    try {
        $pdo->query("SELECT id FROM notificaciones_alumnos LIMIT 1");
    } catch (\Throwable $e) {
        try {
            $pdo->exec("CREATE TABLE IF NOT EXISTS notificaciones_alumnos (
                id INT AUTO_INCREMENT PRIMARY KEY,
                email VARCHAR(255) NOT NULL,
                id_negocio INT NOT NULL,
                negocio_ruta VARCHAR(120) DEFAULT '',
                negocio_nombre VARCHAR(255) DEFAULT '',
                id_servicio INT NOT NULL DEFAULT 0,
                servicio VARCHAR(255) DEFAULT '',
                fecha DATE NOT NULL,
                hora VARCHAR(10) NOT NULL,
                titulo VARCHAR(255) NOT NULL,
                mensaje TEXT,
                leida TINYINT(1) DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_notif_alumno_email (email, leida, created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
        } catch (\Throwable $e2) {}
    }
}

function notificarCupoLiberado($pdo, $id_negocio, $id_servicio, $servicio, $fecha, $hora) {
    $id_negocio = (int)$id_negocio;
    $id_servicio = (int)$id_servicio;
    $servicio = trim((string)$servicio);
    $fechaClean = str_replace('/', '-', trim((string)$fecha));
    if (preg_match('/^(\d{1,2})-(\d{1,2})-(\d{4})$/', $fechaClean, $m)) {
        $fechaClean = $m[3] . '-' . sprintf('%02d', $m[2]) . '-' . sprintf('%02d', $m[1]);
    } else {
        $fechaClean = substr($fechaClean, 0, 10);
    }
    $hora5 = substr(trim((string)$hora), 0, 5);

    if ($id_negocio <= 0 || empty($fechaClean) || empty($hora5)) {
        return 0;
    }

    ensureCupoWaitlistTables($pdo);

    // Buscar suscriptores pendientes para ese negocio, fecha, hora y servicio
    $stmtWait = $pdo->prepare("
        SELECT id, email, nombre, servicio, id_servicio
        FROM cupos_lista_espera
        WHERE id_negocio = :id_negocio
          AND fecha = :fecha
          AND LEFT(hora, 5) = :hora
          AND notificado = 0
          AND (
              (:id_serv > 0 AND id_servicio = :id_serv2)
              OR LOWER(TRIM(servicio)) = LOWER(TRIM(:serv))
          )
    ");
    $stmtWait->execute([
        'id_negocio' => $id_negocio,
        'fecha' => $fechaClean,
        'hora' => $hora5,
        'id_serv' => $id_servicio,
        'id_serv2' => $id_servicio,
        'serv' => $servicio
    ]);
    $suscriptores = $stmtWait->fetchAll(PDO::FETCH_ASSOC);

    if (empty($suscriptores)) {
        return 0;
    }

    // Obtener nombre y ruta del negocio
    $negocioNombre = 'el establecimiento';
    $negocioRuta = '';
    try {
        $stmtNeg = $pdo->prepare("SELECT nombre, ruta FROM negocios WHERE id = :id LIMIT 1");
        $stmtNeg->execute(['id' => $id_negocio]);
        $neg = $stmtNeg->fetch(PDO::FETCH_ASSOC);
        if ($neg) {
            $negocioNombre = $neg['nombre'] ?: $negocioNombre;
            $negocioRuta = $neg['ruta'] ?: '';
        }
    } catch (\Throwable $eNeg) {}

    $fechaFmt = date('d/m/Y', strtotime($fechaClean));
    $servDisplay = $servicio ?: ($suscriptores[0]['servicio'] ?? 'Clase');

    // URL al portal del alumno
    $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'] ?? 'agendatina.site';
    $scriptDir = rtrim(str_replace('\\', '/', dirname(dirname($_SERVER['SCRIPT_NAME'] ?? ''))), '/');
    $portalUrl = $protocol . '://' . $host . $scriptDir . '/alumno.html';

    $phpmailerAvailable = file_exists(__DIR__ . '/../phpmailer/PHPMailer.php');
    if ($phpmailerAvailable) {
        require_once __DIR__ . '/../phpmailer/Exception.php';
        require_once __DIR__ . '/../phpmailer/PHPMailer.php';
        require_once __DIR__ . '/../phpmailer/SMTP.php';
    }

    $notificadosCount = 0;
    $stmtInsNotif = $pdo->prepare("
        INSERT INTO notificaciones_alumnos
        (email, id_negocio, negocio_ruta, negocio_nombre, id_servicio, servicio, fecha, hora, titulo, mensaje, leida, created_at)
        VALUES (:email, :id_neg, :ruta, :neg_nom, :id_serv, :serv, :fecha, :hora, :titulo, :mensaje, 0, NOW())
    ");
    $stmtMark = $pdo->prepare("UPDATE cupos_lista_espera SET notificado = 1 WHERE id = :id");

    foreach ($suscriptores as $sub) {
        $subEmail = strtolower(trim($sub['email'] ?? ''));
        if (empty($subEmail)) continue;
        $subNombre = !empty($sub['nombre']) ? explode(' ', trim($sub['nombre']))[0] : 'Alumno';

        // 1. Crear notificación interna para la campanita del Portal del Alumno
        try {
            $stmtInsNotif->execute([
                'email' => $subEmail,
                'id_neg' => $id_negocio,
                'ruta' => $negocioRuta,
                'neg_nom' => $negocioNombre,
                'id_serv' => $id_servicio ?: (int)($sub['id_servicio'] ?? 0),
                'serv' => $servDisplay,
                'fecha' => $fechaClean,
                'hora' => $hora5,
                'titulo' => '🔔 ¡Se liberó un cupo!',
                'mensaje' => "Se liberó un cupo en {$negocioNombre} para {$servDisplay} el {$fechaFmt} a las {$hora5} hs."
            ]);
        } catch (\Throwable $eDb) {
            error_log("Error creando notificacion de cupo para alumno: " . $eDb->getMessage());
        }

        // 2. Enviar correo desde Agendatina
        if ($phpmailerAvailable) {
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
                $mail->SMTPOptions = ['ssl' => ['verify_peer' => false, 'verify_peer_name' => false, 'allow_self_signed' => true]];

                $mail->setFrom('no-reply@agendatina.site', 'Agendatina • Aviso de Cupos');
                $mail->addAddress($subEmail);
                $mail->isHTML(true);
                $mail->Subject = "🔔 ¡Se liberó un cupo en {$negocioNombre}! ({$servDisplay})";
                $mail->Body = "
                    <div style='font-family: Arial, sans-serif; padding: 24px; background: #fff7ed; border-radius: 16px; max-width: 580px; margin: 0 auto; border: 2px solid #fed7aa;'>
                        <div style='text-align: center; margin-bottom: 18px;'>
                            <h2 style='color: #d11149; margin: 0 0 4px;'>Agendatina</h2>
                            <span style='font-size: 12px; font-weight: bold; color: #fc8712; background: #ffedd5; padding: 4px 12px; border-radius: 12px;'>Cupo Liberado</span>
                        </div>
                        <h3 style='color: #0f172a; margin-top: 0;'>¡Hola {$subNombre}!</h3>
                        <p style='font-size: 14px; color: #334155; line-height: 1.5;'>
                            Se acaba de liberar un lugar en <strong>{$negocioNombre}</strong> para la clase que estabas esperando:
                        </p>
                        <div style='background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 16px; margin: 16px 0; font-size: 14px; color: #1e293b;'>
                            <div><strong>Clase:</strong> {$servDisplay}</div>
                            <div style='margin-top: 4px;'><strong>Fecha:</strong> {$fechaFmt}</div>
                            <div style='margin-top: 4px;'><strong>Horario:</strong> {$hora5} hs</div>
                        </div>
                        <div style='text-align: center; margin-top: 20px;'>
                            <a href='{$portalUrl}' style='display: inline-block; background: #d11149; color: #ffffff; text-decoration: none; font-weight: bold; padding: 12px 24px; border-radius: 10px; font-size: 14px;'>Ir al Portal del Alumno y Reservar</a>
                        </div>
                    </div>
                ";
                $mail->send();
            } catch (\Throwable $eMail) {
                error_log("Error enviando mail de cupo liberado a {$subEmail}: " . $eMail->getMessage());
            }
        }

        // 3. Marcar como notificado
        try {
            $stmtMark->execute(['id' => $sub['id']]);
            $notificadosCount++;
        } catch (\Throwable $eMark) {}
    }

    return $notificadosCount;
}
