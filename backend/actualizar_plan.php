<?php
session_start();
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/conexion.php';

if (!isset($_SESSION['user_id']) || !isset($_SESSION['id_negocio'])) {
    echo json_encode(['success' => false, 'error' => 'No autorizado. Inicia sesión.']);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'error' => 'Método no permitido.']);
    exit;
}

$contentType = isset($_SERVER["CONTENT_TYPE"]) ? trim($_SERVER["CONTENT_TYPE"]) : '';
if (strpos($contentType, 'application/json') !== false) {
    $inputData = json_decode(file_get_contents('php://input'), true);
} else {
    $inputData = $_POST;
}

$id_negocio = $_SESSION['id_negocio'];
$id_usuario = $_SESSION['user_id'];
$targetPlan = isset($inputData['plan']) ? trim($inputData['plan']) : '';

$validPlans = ['Basico', 'Profesional', 'Premium'];
$planNormalizado = '';
foreach ($validPlans as $vp) {
    if (strcasecmp($vp, $targetPlan) === 0 || 
        ($vp === 'Basico' && (strcasecmp($targetPlan, 'simple') === 0 || strcasecmp($targetPlan, 'básico') === 0)) ||
        ($vp === 'Profesional' && (strcasecmp($targetPlan, 'intermedio') === 0)) ||
        ($vp === 'Premium' && (strcasecmp($targetPlan, 'completo') === 0))) {
        $planNormalizado = $vp;
        break;
    }
}

if (empty($planNormalizado)) {
    echo json_encode(['success' => false, 'error' => 'Plan no válido especificado.']);
    exit;
}

try {
    // Obtener datos actuales del negocio
    $stmtN = $pdo->prepare("SELECT nombre_fantasia, plan, estado_pago, fecha_alta FROM negocios WHERE id = ?");
    $stmtN->execute([$id_negocio]);
    $business = $stmtN->fetch(PDO::FETCH_ASSOC);

    if (!$business) {
        echo json_encode(['success' => false, 'error' => 'Negocio no encontrado.']);
        exit;
    }

    $estadoPago = $business['estado_pago'] ?? 'prueba';

    // Solo se permite la actualización directa sin cobro si el negocio está en período de prueba
    if ($estadoPago !== 'prueba') {
        echo json_encode([
            'success' => false, 
            'error' => 'El cambio directo sin costo solo aplica durante el período de prueba. Para cuentas activas se requiere abonar la diferencia.'
        ]);
        exit;
    }

    // Actualizar el plan en la base de datos manteniendo el estado 'prueba'
    $nuevoPrecioPactado = 8889;
    try {
        $stmtCfg = $pdo->query("SELECT precio_basico, precio_intermedio, precio_premium FROM configuracion_global WHERE id = 1 LIMIT 1");
        $cfgPrecios = $stmtCfg ? $stmtCfg->fetch(PDO::FETCH_ASSOC) : null;
        if ($cfgPrecios) {
            if ($planNormalizado === 'Premium') {
                $nuevoPrecioPactado = (float)($cfgPrecios['precio_premium'] ?? 16667);
            } elseif ($planNormalizado === 'Profesional') {
                $nuevoPrecioPactado = (float)($cfgPrecios['precio_intermedio'] ?? 11111);
            } else {
                $nuevoPrecioPactado = (float)($cfgPrecios['precio_basico'] ?? 8889);
            }
        }
    } catch (Exception $ePactado) {}
    try { $pdo->query("SELECT precio_pactado FROM negocios LIMIT 1"); } 
    catch(Exception $eCol) { try { $pdo->exec("ALTER TABLE negocios ADD COLUMN precio_pactado DECIMAL(10,2) DEFAULT NULL"); } catch(Exception $eCol2) {} }
    $stmtUp = $pdo->prepare("UPDATE negocios SET plan = ?, precio_pactado = ? WHERE id = ?");
    $stmtUp->execute([$planNormalizado, $nuevoPrecioPactado, $id_negocio]);

    // Notificar al SuperAdmin
    try {
        require_once __DIR__ . '/helpers/notificar_admin_helper.php';
        $nombreNegocio = $business['nombre_fantasia'] ?? 'Negocio ID #' . $id_negocio;
        notificarSuperAdminAlert(
            $pdo, 
            'Planes / Cambio en Período de Prueba', 
            "El negocio '{$nombreNegocio}' actualizó su plan a '{$planNormalizado}' durante su período de prueba.", 
            $id_negocio
        );
    } catch (Exception $eNotif) {}

    echo json_encode([
        'success' => true, 
        'message' => "¡Plan actualizado exitosamente a {$planNormalizado}!",
        'plan' => $planNormalizado
    ]);
} catch (Exception $e) {
    echo json_encode(['success' => false, 'error' => 'Error en base de datos: ' . $e->getMessage()]);
}
?>
