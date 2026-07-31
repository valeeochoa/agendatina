<?php
session_start();
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/conexion.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'error' => 'Método no permitido.']);
    exit;
}

$nombre_completo = trim($_POST['nombre_completo'] ?? '');
$email = trim(filter_var($_POST['email'] ?? '', FILTER_VALIDATE_EMAIL));
$password = trim($_POST['password'] ?? '');
$nombre_fantasia = trim($_POST['nombre_fantasia'] ?? '');
$acepta_terminos = isset($_POST['acepta_terminos']) && ($_POST['acepta_terminos'] === '1' || $_POST['acepta_terminos'] === 'true' || $_POST['acepta_terminos'] === 'on');

if (!$nombre_completo || !$email || !$password || !$nombre_fantasia) {
    echo json_encode(['success' => false, 'error' => 'Por favor completa todos los campos obligatorios.']);
    exit;
}

if (!$acepta_terminos) {
    echo json_encode(['success' => false, 'error' => 'Debes aceptar los Términos y Condiciones para crear una cuenta.']);
    exit;
}

if (strlen($password) < 6 || strlen($password) > 20) {
    echo json_encode(['success' => false, 'error' => 'La contraseña debe tener entre 6 y 20 caracteres.']);
    exit;
}

$plan = trim($_POST['plan'] ?? 'Básico');
$max_profesionales = max(1, (int)($_POST['max_profesionales'] ?? 1));
$hora_apertura = trim($_POST['hora_apertura'] ?? '09:00');
$hora_cierre = trim($_POST['hora_cierre'] ?? '19:00');
$hora_descanso_inicio = trim($_POST['hora_descanso_inicio'] ?? '');
$hora_descanso_fin = trim($_POST['hora_descanso_fin'] ?? '');
$dias_trabajo = trim($_POST['dias_trabajo'] ?? '1,2,3,4,5,6');

try {
    // 1. Verificar si el email ya existe
    $stmtCheck = $pdo->prepare("SELECT id FROM usuarios WHERE LOWER(email) = LOWER(:email) LIMIT 1");
    $stmtCheck->execute(['email' => $email]);
    if ($stmtCheck->fetch()) {
        echo json_encode(['success' => false, 'error' => 'El correo electrónico ya se encuentra registrado.']);
        exit;
    }

    // 2. Generar slug único para la web del negocio
    if (!function_exists('slugify')) {
        function slugify($text) {
            $text = preg_replace('~[^\pL\d]+~u', '-', $text);
            $text = iconv('utf-8', 'us-ascii//TRANSLIT', $text);
            $text = preg_replace('~[^-\w]+~', '', $text);
            $text = trim($text, '-');
            $text = preg_replace('~-+~', '-', $text);
            $text = strtolower($text);
            return empty($text) ? 'n-a' : $text;
        }
    }

    $baseRuta = slugify($nombre_fantasia);
    $ruta = $baseRuta;
    $count = 1;
    while (true) {
        $stmtRuta = $pdo->prepare("SELECT id FROM negocios WHERE ruta = :ruta LIMIT 1");
        $stmtRuta->execute(['ruta' => $ruta]);
        if (!$stmtRuta->fetch()) break;
        $ruta = $baseRuta . '-' . $count;
        $count++;
    }

    // 3. Obtener días de prueba por defecto configurados por el Super Admin
    $diasPrueba = 30;
    try {
        $stmtConfig = $pdo->query("SELECT COALESCE(dias_prueba_defecto, 30) FROM configuracion_global WHERE id = 1 LIMIT 1");
        if ($stmtConfig) {
            $val = $stmtConfig->fetchColumn();
            if ($val && (int)$val > 0) $diasPrueba = (int)$val;
        }
    } catch (Exception $e) {}

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

require_once __DIR__ . '/phpmailer/Exception.php';
require_once __DIR__ . '/phpmailer/PHPMailer.php';
require_once __DIR__ . '/phpmailer/SMTP.php';

// Asegurar columnas de verificación
try { $pdo->query("SELECT codigo_verificacion FROM usuarios LIMIT 1"); } 
catch(Exception $e) { $pdo->exec("ALTER TABLE usuarios ADD COLUMN codigo_verificacion VARCHAR(10) DEFAULT NULL"); }

try { $pdo->query("SELECT verificacion_expira FROM usuarios LIMIT 1"); } 
catch(Exception $e) { $pdo->exec("ALTER TABLE usuarios ADD COLUMN verificacion_expira DATETIME DEFAULT NULL"); }

try { $pdo->query("SELECT email_verificado FROM usuarios LIMIT 1"); } 
catch(Exception $e) { $pdo->exec("ALTER TABLE usuarios ADD COLUMN email_verificado TINYINT DEFAULT 0"); }

    // Generar código numérico de 6 dígitos válido por 15 minutos
    $codigoVerificacion = sprintf("%06d", mt_rand(1, 999999));
    $verificacionExpira = date('Y-m-d H:i:s', strtotime('+15 minutes'));

    $pdo->beginTransaction();

    // 4. Crear usuario (con código de activación de 15 min)
    $hashPass = password_hash($password, PASSWORD_DEFAULT);
    $stmtUser = $pdo->prepare("INSERT INTO usuarios (nombre_completo, email, password, codigo_verificacion, verificacion_expira, email_verificado, fecha_creacion) VALUES (:nombre, :email, :pass, :cod, :exp, 0, NOW())");
    $stmtUser->execute([
        'nombre' => $nombre_completo,
        'email' => $email,
        'pass' => $hashPass,
        'cod' => $codigoVerificacion,
        'exp' => $verificacionExpira
    ]);
    $idUsuario = $pdo->lastInsertId();

    // 5. Crear negocio con plan y límite de profesionales
    $stmtNegocio = $pdo->prepare("INSERT INTO negocios (nombre_fantasia, ruta, plan, max_profesionales, estado_pago, fecha_alta) VALUES (:nombre, :ruta, :plan, :max_p, 'prueba', NOW())");
    $stmtNegocio->execute([
        'nombre' => $nombre_fantasia,
        'ruta' => $ruta,
        'plan' => $plan,
        'max_p' => $max_profesionales
    ]);
    $idNegocio = $pdo->lastInsertId();

    // 6. Vincular usuario con negocio como admin del local
    $stmtPersonal = $pdo->prepare("INSERT INTO personal_negocio (id_usuario, id_negocio, rol_en_local) VALUES (:id_u, :id_n, 'admin')");
    $stmtPersonal->execute(['id_u' => $idUsuario, 'id_n' => $idNegocio]);

    // 7. Crear configuración inicial del negocio (horarios, descanso, días laborables, color)
    $stmtConfigWeb = $pdo->prepare("INSERT IGNORE INTO configuracion_web (id_negocio, titulo_banner, subtitulo_banner, color_primario, limite_eliminacion_dias, hora_apertura, hora_cierre, hora_descanso_inicio, hora_descanso_fin, dias_trabajo) VALUES (:id_n, :titulo, 'Bienvenido a nuestra agenda online', '#d11149', 30, :h_ap, :h_ci, :h_di, :h_df, :dias)");
    $stmtConfigWeb->execute([
        'id_n' => $idNegocio,
        'titulo' => $nombre_fantasia,
        'h_ap' => $hora_apertura,
        'h_ci' => $hora_cierre,
        'h_di' => $hora_descanso_inicio,
        'h_df' => $hora_descanso_fin,
        'dias' => $dias_trabajo
    ]);

    // 8. Auto-insertar ~10 turnos de demostración para el usuario de prueba
    $demoTurnos = [
        ['cliente' => 'María González', 'tel' => '1123456789', 'email' => 'maria@gmail.com', 'servicio' => 'Corte & Peinado', 'monto' => 4500, 'offset' => 0, 'hora' => '10:00:00', 'estado' => 'confirmado'],
        ['cliente' => 'Carlos Rodríguez', 'tel' => '1198765432', 'email' => 'carlos@gmail.com', 'servicio' => 'Perfilado de Barba', 'monto' => 3000, 'offset' => 0, 'hora' => '11:30:00', 'estado' => 'confirmado'],
        ['cliente' => 'Ana Martínez', 'tel' => '1155443322', 'email' => 'ana@gmail.com', 'servicio' => 'Manicura Rusa', 'monto' => 3800, 'offset' => 0, 'hora' => '16:00:00', 'estado' => 'pendiente'],
        ['cliente' => 'Lucía Fernández', 'tel' => '1166778899', 'email' => 'lucia@gmail.com', 'servicio' => 'Limpieza Facial Profunda', 'monto' => 5200, 'offset' => 1, 'hora' => '09:30:00', 'estado' => 'confirmado'],
        ['cliente' => 'Diego López', 'tel' => '1133221100', 'email' => 'diego@gmail.com', 'servicio' => 'Diseño de Cejas & Barba', 'monto' => 3500, 'offset' => 1, 'hora' => '15:00:00', 'estado' => 'confirmado'],
        ['cliente' => 'Sofía Pérez', 'tel' => '1144556677', 'email' => 'sofia@gmail.com', 'servicio' => 'Tratamiento Capilar', 'monto' => 6000, 'offset' => 2, 'hora' => '11:00:00', 'estado' => 'confirmado'],
        ['cliente' => 'Mateo Gómez', 'tel' => '1177889900', 'email' => 'mateo@gmail.com', 'servicio' => 'Corte Masculino Premium', 'monto' => 4000, 'offset' => 2, 'hora' => '17:30:00', 'estado' => 'pendiente'],
        ['cliente' => 'Valentina Silva', 'tel' => '1188990011', 'email' => 'valen@gmail.com', 'servicio' => 'Nutrición Capilar', 'monto' => 4800, 'offset' => 3, 'hora' => '10:30:00', 'estado' => 'confirmado'],
        ['cliente' => 'Joaquín Navarro', 'tel' => '1122334455', 'email' => 'joaco@gmail.com', 'servicio' => 'Perfilado & Corte', 'monto' => 4200, 'offset' => 4, 'hora' => '14:00:00', 'estado' => 'confirmado'],
        ['cliente' => 'Camila Torres', 'tel' => '1199001122', 'email' => 'cami@gmail.com', 'servicio' => 'Corte + Tinte', 'monto' => 7500, 'offset' => 5, 'hora' => '16:00:00', 'estado' => 'confirmado']
    ];

    $stmtTurno = $pdo->prepare("INSERT INTO turnos (id_negocio, cliente_nombre, cliente_telefono, cliente_email, servicio, precio, fecha, hora, estado, creado_en) VALUES (:id_n, :cli, :tel, :email, :serv, :precio, :fecha, :hora, :estado, NOW())");

    foreach ($demoTurnos as $t) {
        $fechaCalculada = date('Y-m-d', strtotime('+' . $t['offset'] . ' days'));
        $stmtTurno->execute([
            'id_n' => $idNegocio,
            'cli' => $t['cliente'],
            'tel' => $t['tel'],
            'email' => $t['email'],
            'serv' => $t['servicio'],
            'precio' => $t['monto'],
            'fecha' => $fechaCalculada,
            'hora' => $t['hora'],
            'estado' => $t['estado']
        ]);
    }

    // Guardar notificación para el SuperAdmin
    try {
        $pdo->query("SELECT 1 FROM notificaciones_admin LIMIT 1");
    } catch (Exception $eNotif) {
        $pdo->exec("CREATE TABLE notificaciones_admin (
            id INT AUTO_INCREMENT PRIMARY KEY, 
            segmento VARCHAR(100), 
            mensaje TEXT, 
            id_negocio INT NULL,
            fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
            leida BOOLEAN DEFAULT FALSE
        )");
    }
    
    $stmtNotifAdmin = $pdo->prepare("INSERT INTO notificaciones_admin (segmento, mensaje, id_negocio) VALUES ('Nuevo Registro', ?, ?)");
    $stmtNotifAdmin->execute(["Nuevo emprendedor registrado: {$nombre_completo} ({$email}) - Negocio: {$nombre_fantasia} (Plan: {$plan})", $idNegocio]);

    $pdo->commit();

    // 9. Enviar mails de confirmación (Al usuario con su código y al SuperAdmin)
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

        // Enviar al usuario
        $mail->setFrom('no-reply@agendatina.site', 'Agendatina - Verificación');
        $mail->addAddress($email, $nombre_completo);
        $mail->isHTML(true);
        $mail->Subject = "Verifica tu cuenta - Agendatina";
        $mail->Body = "<div style='font-family: Arial, sans-serif; padding: 20px; text-align: center;'><h2 style='color: #D11149;'>¡Bienvenido a Agendatina!</h2><p>Tu código de verificación de 6 dígitos para activar tu cuenta es:</p><div style='font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #D11149; margin: 20px 0;'>$codigoVerificacion</div><p style='font-size: 13px; color: #64748b;'>Este código caduca en 15 minutos.</p></div>";
        $mail->send();

        // Enviar al SuperAdmin
        $mailAdmin = new PHPMailer(true);
        $mailAdmin->isSMTP();
        $mailAdmin->Host       = 'localhost';
        $mailAdmin->SMTPAuth   = true;
        $mailAdmin->Username   = 'no-reply@agendatina.site';
        $mailAdmin->Password   = 'Tlqb*Er0kQ';
        $mailAdmin->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
        $mailAdmin->Port       = 587;
        $mailAdmin->CharSet    = 'UTF-8';
        $mailAdmin->SMTPOptions = array('ssl' => array('verify_peer' => false, 'verify_peer_name' => false, 'allow_self_signed' => true));

        $mailAdmin->setFrom('no-reply@agendatina.site', 'Sistema - Agendatina');
        $mailAdmin->addAddress('reportes@agendatina.site');
        $mailAdmin->isHTML(true);
        $mailAdmin->Subject = "¡Nueva Cuenta Creada! - $nombre_fantasia";
        $mailAdmin->Body = "<div style='font-family: Arial, sans-serif; padding: 20px;'><h2 style='color: #22c55e;'>¡Nueva Cuenta Registrada!</h2><p><strong>Nombre:</strong> $nombre_completo</p><p><strong>Email:</strong> $email</p><p><strong>Emprendimiento:</strong> $nombre_fantasia</p><p><strong>Plan Elegido:</strong> $plan ($max_profesionales prof.)</p></div>";
        $mailAdmin->send();
    } catch (Exception $mEx) {
        error_log("Error al enviar correos de bienvenida: " . $mEx->getMessage());
    }

    // 10. Iniciar sesión automática
    $_SESSION['user_id'] = $idUsuario;
    $_SESSION['email'] = $email;
    $_SESSION['nombre_completo'] = $nombre_completo;
    $_SESSION['id_negocio'] = $idNegocio;
    $_SESSION['nombre_negocio'] = $nombre_fantasia;
    $_SESSION['ruta_negocio'] = $ruta;
    $_SESSION['rol_en_local'] = 'admin';

    echo json_encode(['success' => true, 'redirect' => 'dashboard.html', 'message' => "¡Cuenta creada exitosamente! Cuentas con {$diasPrueba} días de prueba gratuita."]);
} catch (Exception $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    echo json_encode(['success' => false, 'error' => 'Error al crear la cuenta: ' . $e->getMessage()]);
}
?>
