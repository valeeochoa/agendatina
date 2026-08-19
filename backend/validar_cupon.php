<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/conexion.php';

// Asegurar que la tabla codigos_descuento exista
try {
    $pdo->exec("CREATE TABLE IF NOT EXISTS `codigos_descuento` (
        `id` INT AUTO_INCREMENT PRIMARY KEY,
        `codigo` VARCHAR(50) UNIQUE NOT NULL,
        `descuento_porcentaje` INT NOT NULL DEFAULT 10,
        `descripcion` TEXT DEFAULT NULL,
        `activo` TINYINT DEFAULT 1,
        `usos_count` INT DEFAULT 0,
        `fecha_creacion` DATETIME DEFAULT CURRENT_TIMESTAMP
    )");
} catch (Exception $e) {}

$contentType = isset($_SERVER["CONTENT_TYPE"]) ? trim($_SERVER["CONTENT_TYPE"]) : '';
if (strpos($contentType, 'application/json') !== false) {
    $data = json_decode(file_get_contents('php://input'), true);
} else {
    $data = $_REQUEST;
}

$codigo = trim($data['codigo'] ?? '');

if (empty($codigo)) {
    echo json_encode(['success' => false, 'error' => 'Por favor, ingresá un código de descuento.']);
    exit;
}

$codigoClean = strtoupper(preg_replace('/[^a-zA-Z0-9_-]/', '', $codigo));

try {
    $stmt = $pdo->prepare("SELECT id, codigo, descuento_porcentaje, descripcion, activo FROM codigos_descuento WHERE UPPER(codigo) = ? LIMIT 1");
    $stmt->execute([$codigoClean]);
    $cupon = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$cupon) {
        echo json_encode(['success' => false, 'error' => "El código '{$codigoClean}' no existe o no es válido."]);
        exit;
    }

    if ((int)$cupon['activo'] !== 1) {
        echo json_encode(['success' => false, 'error' => "El código '{$codigoClean}' se encuentra inactivo."]);
        exit;
    }

    $pct = (int)$cupon['descuento_porcentaje'];
    echo json_encode([
        'success' => true,
        'codigo' => $cupon['codigo'],
        'descuento_porcentaje' => $pct,
        'descripcion' => $cupon['descripcion'],
        'message' => "¡Código '{$cupon['codigo']}' aplicado! Obtenés un {$pct}% de descuento en tu primera facturación."
    ]);
} catch (Exception $e) {
    echo json_encode(['success' => false, 'error' => 'Error al validar código: ' . $e->getMessage()]);
}
?>
