<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/conexion.php';

unset($_SESSION['is_demo'], $_SESSION['demo_negocio_id'], $_SESSION['ruta_negocio'], $_SESSION['user_id'], $_SESSION['id_negocio'], $_SESSION['rol_en_local'], $_SESSION['permisos']);

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método no permitido.']);
    exit;
}

$email = trim($_POST['email'] ?? '');
$password = trim($_POST['password'] ?? '');
$confirm_password = trim($_POST['confirm_password'] ?? '');

if (empty($email) || empty($password) || empty($confirm_password)) {
    echo json_encode(['success' => false, 'error' => 'Por favor completa todos los campos.']);
    exit;
}

if ($password !== $confirm_password) {
    echo json_encode(['success' => false, 'error' => 'Las contraseñas no coinciden. Por favor verifica que ambas coincidan exactamente.']);
    exit;
}

if (strlen($password) < 6) {
    echo json_encode(['success' => false, 'error' => 'La contraseña debe tener al menos 6 caracteres por seguridad.']);
    exit;
}

// Solo se permite establecer la primera contraseña si el login autorizó este correo recientemente
$autorizado = !empty($_SESSION['first_pass_email'])
    && $_SESSION['first_pass_email'] === strtolower($email)
    && !empty($_SESSION['first_pass_expira'])
    && (int)$_SESSION['first_pass_expira'] >= time();
if (!$autorizado) {
    echo json_encode(['success' => false, 'error' => 'La sesión para configurar tu contraseña expiró. Volvé a ingresar tu correo en el inicio de sesión.']);
    exit;
}
unset($_SESSION['first_pass_email'], $_SESSION['first_pass_expira']);

try {
    $stmt = $pdo->prepare("SELECT id, nombre_completo, debe_cambiar_pass FROM usuarios WHERE email = ? LIMIT 1");
    $stmt->execute([$email]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user) {
        echo json_encode(['success' => false, 'error' => 'No se encontró una cuenta asociada a este correo electrónico.']);
        exit;
    }

    if ((int)($user['debe_cambiar_pass'] ?? 0) !== 1) {
        echo json_encode(['success' => false, 'error' => 'Esta cuenta ya tiene una contraseña establecida. Por favor inicia sesión con tu clave habitual.']);
        exit;
    }

    // Actualizar contraseña y quitar la marca de primer cambio
    $hash = password_hash($password, PASSWORD_DEFAULT);
    $stmtUpd = $pdo->prepare("UPDATE usuarios SET password = ?, debe_cambiar_pass = 0 WHERE id = ?");
    $stmtUpd->execute([$hash, $user['id']]);

    // Buscar los negocios vinculados a este usuario
    try { $pdo->exec("ALTER TABLE personal_negocio ADD COLUMN permisos TEXT NULL"); } catch(Exception $e) {}

    $stmtBiz = $pdo->prepare("
        SELECT pn.id_negocio, pn.rol_en_local, pn.permisos, n.nombre_fantasia, n.plan
        FROM personal_negocio pn
        JOIN negocios n ON pn.id_negocio = n.id
        WHERE pn.id_usuario = ?
        ORDER BY (pn.rol_en_local = 'admin') DESC, pn.id_negocio ASC
    ");
    $stmtBiz->execute([$user['id']]);
    $businesses = $stmtBiz->fetchAll(PDO::FETCH_ASSOC);

    if (count($businesses) > 1) {
        // Múltiples negocios: Guardar sesión temporal del usuario y solicitar selección
        $_SESSION['pending_user_id'] = $user['id'];
        $_SESSION['nombre_completo'] = $user['nombre_completo'];

        echo json_encode([
            'success' => true,
            'multiple_businesses' => true,
            'user_id' => $user['id'],
            'nombre' => $user['nombre_completo'],
            'businesses' => array_map(function($b) {
                return [
                    'id_negocio' => (int)$b['id_negocio'],
                    'nombre' => $b['nombre_fantasia'] ?: 'Mi Negocio',
                    'rol' => $b['rol_en_local'],
                    'plan' => $b['plan']
                ];
            }, $businesses)
        ]);
        exit;
    } else {
        // Negocio único o por defecto
        $biz = $businesses[0] ?? null;
        $id_negocio = $biz ? (int)$biz['id_negocio'] : null;
        $rol_en_local = $biz ? $biz['rol_en_local'] : 'profesional';
        $plan = $biz ? $biz['plan'] : 'Plan Simple';

        $_SESSION['user_id'] = $user['id'];
        $_SESSION['nombre_completo'] = $user['nombre_completo'];
        $_SESSION['rol_en_local'] = $rol_en_local;
        $_SESSION['id_negocio'] = $id_negocio;
        $_SESSION['plan'] = $plan;

        require_once __DIR__ . '/helpers/permisos_helper.php';
        $ctxFirst = sincronizarPermisosSesion($pdo, $id_negocio, $user['id']);

        session_write_close();
        echo json_encode([
            'success' => true,
            'redirect' => 'dashboard.html',
            'rol' => $ctxFirst['rol_en_local'],
            'permisos' => $ctxFirst['permisos'],
            'user' => [
                'id' => (int)$user['id'],
                'nombre_completo' => $ctxFirst['nombre_completo'],
                'email' => $email,
                'rol' => $ctxFirst['rol_en_local'],
                'rol_en_local' => $ctxFirst['rol_en_local'],
                'permisos' => $ctxFirst['permisos']
            ]
        ]);
        exit;
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error al guardar la contraseña: ' . $e->getMessage()]);
}
