<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/conexion.php';

$inputData = json_decode(file_get_contents('php://input'), true) ?: $_POST;
$id_negocio = (int)($inputData['id_negocio'] ?? 0);

$user_id = (int)($inputData['user_id'] ?? $_SESSION['pending_user_id'] ?? $_SESSION['user_id'] ?? 0);

if (!$user_id || !$id_negocio) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Sesión o ID de negocio no válido.']);
    exit;
}

try {
    try { $pdo->exec("ALTER TABLE personal_negocio ADD COLUMN permisos TEXT NULL"); } catch(Exception $e) {}

    $stmt = $pdo->prepare("
        SELECT pn.id_negocio, pn.rol_en_local, pn.permisos, n.nombre_fantasia, n.plan, n.ruta, u.nombre_completo
        FROM personal_negocio pn
        JOIN negocios n ON pn.id_negocio = n.id
        JOIN usuarios u ON pn.id_usuario = u.id
        WHERE pn.id_usuario = ? AND pn.id_negocio = ?
        LIMIT 1
    ");
    $stmt->execute([$user_id, $id_negocio]);
    $biz = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$biz) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'No tienes acceso al negocio seleccionado.']);
        exit;
    }

    // Establecer la sesión activa para el negocio elegido
    $_SESSION['user_id'] = $user_id;
    unset($_SESSION['pending_user_id']);
    
    $_SESSION['nombre_completo'] = $biz['nombre_completo'];
    $_SESSION['id_negocio'] = (int)$biz['id_negocio'];
    $_SESSION['rol_en_local'] = $biz['rol_en_local'];
    $_SESSION['plan'] = $biz['plan'] ?: 'Plan Simple';
    $_SESSION['ruta_negocio'] = $biz['ruta'] ?? '';
    $_SESSION['nombre_negocio'] = $biz['nombre_fantasia'] ?? '';

    if (empty($biz['ruta']) || strpos(strtolower($biz['ruta']), 'demo') === false) {
        unset($_SESSION['is_demo']);
    }

    require_once __DIR__ . '/helpers/permisos_helper.php';
    $ctxSw = sincronizarPermisosSesion($pdo, $_SESSION['id_negocio'], $_SESSION['user_id']);

    session_write_close();
    echo json_encode([
        'success' => true,
        'redirect' => 'dashboard.html',
        'nombre_negocio' => $biz['nombre_fantasia'],
        'rol' => $ctxSw['rol_en_local'],
        'permisos' => $ctxSw['permisos'],
        'user' => [
            'id' => (int)$_SESSION['user_id'],
            'nombre_completo' => $ctxSw['nombre_completo'],
            'rol' => $ctxSw['rol_en_local'],
            'rol_en_local' => $ctxSw['rol_en_local'],
            'permisos' => $ctxSw['permisos']
        ]
    ]);
    exit;

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error al cambiar de negocio: ' . $e->getMessage()]);
}
