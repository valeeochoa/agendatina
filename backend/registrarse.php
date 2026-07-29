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

try {
    // 1. Verificar si el email ya existe
    $stmtCheck = $pdo->prepare("SELECT id FROM usuarios WHERE LOWER(email) = LOWER(:email) LIMIT 1");
    $stmtCheck->execute(['email' => $email]);
    if ($stmtCheck->fetch()) {
        echo json_encode(['success' => false, 'error' => 'El correo electrónico ya se encuentra registrado.']);
        exit;
    }

    // 2. Generar slug único para la web del negocio
    function slugify($text) {
        $text = preg_replace('~[^\pL\d]+~u', '-', $text);
        $text = iconv('utf-8', 'us-ascii//TRANSLIT', $text);
        $text = preg_replace('~[^-\w]+~', '', $text);
        $text = trim($text, '-');
        $text = preg_replace('~-+~', '-', $text);
        $text = strtolower($text);
        return empty($text) ? 'n-a' : $text;
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

    $pdo->beginTransaction();

    // 4. Crear usuario
    $hashPass = password_hash($password, PASSWORD_DEFAULT);
    $stmtUser = $pdo->prepare("INSERT INTO usuarios (nombre_completo, email, password, fecha_creacion) VALUES (:nombre, :email, :pass, NOW())");
    $stmtUser->execute(['nombre' => $nombre_completo, 'email' => $email, 'pass' => $hashPass]);
    $idUsuario = $pdo->lastInsertId();

    // 5. Crear negocio
    $stmtNegocio = $pdo->prepare("INSERT INTO negocios (nombre_fantasia, ruta, plan, max_profesionales, estado_pago, fecha_alta) VALUES (:nombre, :ruta, 'Básico', 1, 'prueba', NOW())");
    $stmtNegocio->execute(['nombre' => $nombre_fantasia, 'ruta' => $ruta]);
    $idNegocio = $pdo->lastInsertId();

    // 6. Vincular usuario con negocio como admin del local
    $stmtPersonal = $pdo->prepare("INSERT INTO personal_negocio (id_usuario, id_negocio, rol_en_local) VALUES (:id_u, :id_n, 'admin')");
    $stmtPersonal->execute(['id_u' => $idUsuario, 'id_n' => $idNegocio]);

    // 7. Crear configuración inicial del negocio
    $stmtConfigWeb = $pdo->prepare("INSERT IGNORE INTO configuracion_web (id_negocio, titulo_banner, subtitulo_banner, color_primario, limite_eliminacion_dias) VALUES (:id_n, :titulo, 'Bienvenido a nuestra agenda online', '#6366f1', 30)");
    $stmtConfigWeb->execute(['id_n' => $idNegocio, 'titulo' => $nombre_fantasia]);

    $pdo->commit();

    // 8. Iniciar sesión automática
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
