<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/conexion.php';

// Auto-migraciones para tabla cupones_descuento
try {
    $pdo->exec("CREATE TABLE IF NOT EXISTS cupones_descuento (
        id INT AUTO_INCREMENT PRIMARY KEY,
        id_negocio INT NOT NULL,
        codigo VARCHAR(50) NOT NULL,
        cliente_celular VARCHAR(50) DEFAULT NULL,
        cliente_nombre VARCHAR(255) DEFAULT NULL,
        porcentaje_descuento INT DEFAULT 10,
        usado TINYINT(1) DEFAULT 0,
        fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
        fecha_expiracion DATETIME NOT NULL,
        fecha_uso DATETIME DEFAULT NULL,
        INDEX (id_negocio),
        INDEX (codigo)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
} catch (\Throwable $e) {}

try { $pdo->query("SELECT usos_maximos FROM cupones_descuento LIMIT 1"); } 
catch(\Throwable $e) { try { $pdo->exec("ALTER TABLE cupones_descuento ADD COLUMN usos_maximos INT DEFAULT 1"); } catch(\Throwable $ex) {} }

try { $pdo->query("SELECT usos_actuales FROM cupones_descuento LIMIT 1"); } 
catch(\Throwable $e) { try { $pdo->exec("ALTER TABLE cupones_descuento ADD COLUMN usos_actuales INT DEFAULT 0"); } catch(\Throwable $ex) {} }

try { $pdo->query("SELECT activo FROM cupones_descuento LIMIT 1"); } 
catch(\Throwable $e) { try { $pdo->exec("ALTER TABLE cupones_descuento ADD COLUMN activo TINYINT(1) DEFAULT 1"); } catch(\Throwable $ex) {} }

$contentType = isset($_SERVER["CONTENT_TYPE"]) ? trim($_SERVER["CONTENT_TYPE"]) : '';
if (strpos($contentType, 'application/json') !== false) {
    $data = json_decode(file_get_contents('php://input'), true) ?? [];
} else {
    $data = $_REQUEST;
}

$negocioSlug = trim($data['negocio'] ?? '');
$codigo = trim($data['codigo'] ?? '');

if (empty($codigo)) {
    echo json_encode(['success' => false, 'error' => 'Por favor, ingresa un código de cupón.']);
    exit;
}

if (empty($negocioSlug)) {
    echo json_encode(['success' => false, 'error' => 'Negocio no especificado.']);
    exit;
}

$codigoClean = strtoupper(preg_replace('/[^a-zA-Z0-9_-]/', '', $codigo));

try {
    $subVal = $negocioSlug;
    $idVal = (is_numeric($negocioSlug) && (int)$negocioSlug > 0) ? (int)$negocioSlug : 0;
    
    $stmtNegocio = $pdo->prepare("SELECT id, nombre_fantasia FROM negocios WHERE ruta = :sub OR subdominio = :sub OR (id = :id AND :id > 0) LIMIT 1");
    $stmtNegocio->execute(['sub' => $subVal, 'id' => $idVal]);
    $negocioBD = $stmtNegocio->fetch(PDO::FETCH_ASSOC);

    if (!$negocioBD && !empty($subVal)) {
        try {
            $stmtCfg = $pdo->prepare("SELECT id_negocio FROM configuracion_web WHERE url_logo LIKE :s LIMIT 1");
            $stmtCfg->execute(['s' => "%$subVal%"]);
            $idFromCfg = $stmtCfg->fetchColumn();
            if ($idFromCfg) {
                $stmtNegocio->execute(['sub' => '', 'id' => (int)$idFromCfg]);
                $negocioBD = $stmtNegocio->fetch(PDO::FETCH_ASSOC);
            }
        } catch (\Throwable $eCfg) {}
    }

    if (!$negocioBD) {
        echo json_encode(['success' => false, 'error' => 'Negocio no encontrado.']);
        exit;
    }

    $id_negocio = (int)$negocioBD['id'];

    // Verificar si el negocio tiene habilitada la función de cupones de descuento
    $stmtWeb = $pdo->prepare("SELECT usar_cupones_descuento, cupon_descuento_pct FROM configuracion_web WHERE id_negocio = ? LIMIT 1");
    $stmtWeb->execute([$id_negocio]);
    $webCfg = $stmtWeb->fetch(PDO::FETCH_ASSOC);

    if (!$webCfg || empty($webCfg['usar_cupones_descuento'])) {
        echo json_encode(['success' => false, 'error' => 'Este negocio no tiene habilitados los cupones de descuento actualmente.']);
        exit;
    }

    // Buscar cupón
    $stmtCup = $pdo->prepare("SELECT id, codigo, porcentaje_descuento, usos_maximos, usos_actuales, fecha_expiracion, activo, usado 
                              FROM cupones_descuento 
                              WHERE id_negocio = :id_neg 
                                AND UPPER(codigo) = :cod 
                              LIMIT 1");
    $stmtCup->execute(['id_neg' => $id_negocio, 'cod' => $codigoClean]);
    $cupon = $stmtCup->fetch(PDO::FETCH_ASSOC);

    if (!$cupon) {
        echo json_encode(['success' => false, 'error' => "El cupón '{$codigoClean}' no es válido para este negocio."]);
        exit;
    }

    if (isset($cupon['activo']) && (int)$cupon['activo'] === 0) {
        echo json_encode(['success' => false, 'error' => "El cupón '{$codigoClean}' se encuentra inactivo."]);
        exit;
    }

    if (!empty($cupon['fecha_expiracion']) && strtotime($cupon['fecha_expiracion']) < time()) {
        echo json_encode(['success' => false, 'error' => "El cupón '{$codigoClean}' ha superado su fecha máxima de vigencia."]);
        exit;
    }

    $maxUsos = (int)($cupon['usos_maximos'] ?? 0);
    $usosAct = (int)($cupon['usos_actuales'] ?? 0);
    $isUsado = (int)($cupon['usado'] ?? 0);

    if (($maxUsos > 0 && $usosAct >= $maxUsos) || ($maxUsos === 1 && $isUsado === 1)) {
        echo json_encode(['success' => false, 'error' => "El cupón '{$codigoClean}' ha alcanzado el límite de usos permitidos."]);
        exit;
    }

    $pct = (int)($cupon['porcentaje_descuento'] ?? ($webCfg['cupon_descuento_pct'] ?? 10));
    if ($pct <= 0) $pct = 10;

    echo json_encode([
        'success' => true,
        'codigo' => $cupon['codigo'],
        'porcentaje_descuento' => $pct,
        'message' => "¡Cupón '{$cupon['codigo']}' aplicado! Obtenés un {$pct}% de descuento."
    ]);
} catch (\Throwable $e) {
    echo json_encode(['success' => false, 'error' => 'Error al validar cupón: ' . $e->getMessage()]);
}
