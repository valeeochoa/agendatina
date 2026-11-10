<?php
ob_start();
ini_set('display_errors', 0);
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
    $stmtN = $pdo->prepare("SELECT nombre_fantasia, plan, estado_pago, fecha_alta, max_profesionales, descuento_aplicado_pct FROM negocios WHERE id = ?");
    $stmtN->execute([$id_negocio]);
    $business = $stmtN->fetch(PDO::FETCH_ASSOC);

    if (!$business) {
        if (ob_get_length()) ob_clean();
        echo json_encode(['success' => false, 'error' => 'Negocio no encontrado.']);
        exit;
    }

    $estadoPago = strtolower(trim($business['estado_pago'] ?? 'prueba'));
    $planActual = $business['plan'] ?? 'Basico';

    $getRank = function($p) {
        $pLower = strtolower($p ?? '');
        if (strpos($pLower, 'premium') !== false || strpos($pLower, 'completo') !== false) return 3;
        if (strpos($pLower, 'profesional') !== false || strpos($pLower, 'intermedio') !== false) return 2;
        return 1;
    };

    $currentRank = $getRank($planActual);
    $targetRank = $getRank($planNormalizado);

    $isDowngrade = ($targetRank < $currentRank);
    $isUpgrade = ($targetRank > $currentRank);
    $isSame = ($targetRank === $currentRank);

    $nombrePlanDisplay = ($planNormalizado === 'Basico') ? 'Simple' : $planNormalizado;
    $nombrePlanAnterior = ($planActual === 'Basico') ? 'Simple' : $planActual;

    if ($isSame) {
        echo json_encode(['success' => false, 'error' => "Tu negocio ya se encuentra en el Plan {$nombrePlanDisplay}."]);
        exit;
    }

    // En cuentas activas/pagadas, los upgrades requieren abonar la diferencia prorrateada
    if ($estadoPago !== 'prueba' && $isUpgrade) {
        echo json_encode([
            'success' => false, 
            'error' => 'Para subir a un plan superior en cuentas activas se requiere abonar la diferencia prorrateada.'
        ]);
        exit;
    }

    // Calcular nuevo precio pactado para el negocio (incluyendo descuento de plataforma y por equipo del 5% por profesional)
    $nuevoPrecioPactado = 8889.0;
    try {
        $stmtCfg = $pdo->query("SELECT precio_basico, precio_intermedio, precio_premium, descuento_porcentaje, descuento_hasta FROM configuracion_global ORDER BY id ASC LIMIT 1");
        $cfgPrecios = $stmtCfg ? $stmtCfg->fetch(PDO::FETCH_ASSOC) : null;
        if ($cfgPrecios) {
            $rawBase = ($planNormalizado === 'Premium') ? (float)($cfgPrecios['precio_premium'] ?? 16667) :
                       (($planNormalizado === 'Profesional') ? (float)($cfgPrecios['precio_intermedio'] ?? 11111) : (float)($cfgPrecios['precio_basico'] ?? 8889));

            $discPct = isset($cfgPrecios['descuento_porcentaje']) ? (int)$cfgPrecios['descuento_porcentaje'] : 10;
            if (!empty($cfgPrecios['descuento_hasta']) && strtotime($cfgPrecios['descuento_hasta']) < time()) {
                $discPct = 0;
            }
            if (!empty($business['descuento_aplicado_pct']) && (int)$business['descuento_aplicado_pct'] > 0) {
                $discPct = max($discPct, (int)$business['descuento_aplicado_pct']);
            }

            $precioUno = round($rawBase * (100 - $discPct) / 100);
            $profCount = max(1, (int)($business['max_profesionales'] ?? 1));
            if ($profCount === 1) {
                $nuevoPrecioPactado = $precioUno;
            } else {
                $volDisc = min(50, $profCount * 5); // 5% por profesional
                $nuevoPrecioPactado = round(($precioUno * $profCount) * (1 - $volDisc / 100));
            }
        }
    } catch (Exception $ePactado) {}

    try { $pdo->query("SELECT precio_pactado FROM negocios LIMIT 1"); } 
    catch(Exception $eCol) { try { $pdo->exec("ALTER TABLE negocios ADD COLUMN precio_pactado DECIMAL(10,2) DEFAULT NULL"); } catch(Exception $eCol2) {} }

    $stmtUp = $pdo->prepare("UPDATE negocios SET plan = ?, precio_pactado = ? WHERE id = ?");
    $stmtUp->execute([$planNormalizado, $nuevoPrecioPactado, $id_negocio]);

    // Actualizar también la sesión del usuario activo
    $_SESSION['plan'] = $planNormalizado;

    // Registrar en historial_cambios_negocio
    try {
        $pdo->exec("CREATE TABLE IF NOT EXISTS `historial_cambios_negocio` (
            `id` INT AUTO_INCREMENT PRIMARY KEY,
            `id_negocio` INT NOT NULL,
            `tipo_evento` VARCHAR(50) NOT NULL,
            `valor_anterior` VARCHAR(100) DEFAULT NULL,
            `valor_nuevo` VARCHAR(100) DEFAULT NULL,
            `detalle` TEXT DEFAULT NULL,
            `origen` VARCHAR(50) DEFAULT 'cliente',
            `fecha` DATETIME DEFAULT CURRENT_TIMESTAMP,
            KEY `idx_negocio_fecha` (`id_negocio`, `fecha`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

        $stmtHist = $pdo->prepare("INSERT INTO historial_cambios_negocio (id_negocio, tipo_evento, valor_anterior, valor_nuevo, detalle, origen, fecha) VALUES (?, 'cambio_plan', ?, ?, ?, 'cliente', NOW())");
        $stmtHist->execute([$id_negocio, $nombrePlanAnterior, $nombrePlanDisplay, $descAlerta]);
    } catch(Throwable $eHist) {}

    // Notificar al SuperAdmin
    try {
        require_once __DIR__ . '/helpers/notificar_admin_helper.php';
        $nombreNegocio = $business['nombre_fantasia'] ?? 'Negocio ID #' . $id_negocio;
        $motivoAlerta = $isDowngrade ? 'Planes / Downgrade a Plan ' . $nombrePlanDisplay : 'Planes / Cambio de Plan en Prueba';
        $descAlerta = $isDowngrade 
            ? "El negocio '{$nombreNegocio}' cambió a un plan más bajo: '{$nombrePlanDisplay}' (antes: '{$nombrePlanAnterior}'). Nuevo precio pactado: $" . number_format($nuevoPrecioPactado, 0, ',', '.') . "/mes."
            : "El negocio '{$nombreNegocio}' actualizó su plan a '{$nombrePlanDisplay}' durante su período de prueba. Precio pactado futuro: $" . number_format($nuevoPrecioPactado, 0, ',', '.') . "/mes.";

        notificarSuperAdminAlert(
            $pdo, 
            $motivoAlerta, 
            $descAlerta, 
            $id_negocio
        );
    } catch (Exception $eNotif) {}

    $msgSuccess = $isDowngrade 
        ? "¡Plan actualizado exitosamente al Plan {$nombrePlanDisplay}! El nuevo valor mensual regirá para tu próximo ciclo de facturación."
        : "¡Plan actualizado exitosamente al Plan {$nombrePlanDisplay}!";

    if (ob_get_length()) ob_clean();
    echo json_encode([
        'success' => true, 
        'message' => $msgSuccess,
        'plan' => $planNormalizado,
        'is_downgrade' => $isDowngrade
    ]);
} catch (Exception $e) {
    if (ob_get_length()) ob_clean();
    echo json_encode(['success' => false, 'error' => 'Error en base de datos: ' . $e->getMessage()]);
}
?>