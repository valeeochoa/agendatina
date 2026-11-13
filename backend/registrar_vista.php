<?php
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método no permitido']);
    exit;
}

require_once __DIR__ . '/conexion.php';

// Auto-migración transparente de la tabla visitas_negocio
try {
    $pdo->exec("CREATE TABLE IF NOT EXISTS visitas_negocio (
        id INT AUTO_INCREMENT PRIMARY KEY,
        id_negocio INT NOT NULL,
        tipo ENUM('calendario', 'web') NOT NULL,
        fecha DATE NOT NULL,
        mes_anio CHAR(7) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_neg_mes_tipo (id_negocio, mes_anio, tipo),
        INDEX idx_neg_fecha (id_negocio, fecha)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
} catch (\Throwable $eMig) {
    error_log("Error al crear tabla visitas_negocio: " . $eMig->getMessage());
}

$input = json_decode(file_get_contents('php://input'), true) ?: $_POST;
$negocioParam = trim($input['negocio'] ?? '');
$tipo = trim($input['tipo'] ?? 'calendario');

if (!in_array($tipo, ['calendario', 'web'])) {
    $tipo = 'calendario';
}

if (empty($negocioParam)) {
    echo json_encode(['success' => false, 'error' => 'Negocio no especificado']);
    exit;
}

// Ignorar entornos demo
if (stripos($negocioParam, 'demo') === 0 || (isset($_SESSION['is_demo']) && $_SESSION['is_demo'] === true)) {
    echo json_encode(['success' => true, 'ignored' => 'demo']);
    exit;
}

try {
    $idVal = (is_numeric($negocioParam) && (int)$negocioParam > 0) ? (int)$negocioParam : 0;
    $stmtNeg = $pdo->prepare("SELECT id FROM negocios WHERE ruta = :slug OR subdominio = :slug OR (id = :id AND :id > 0) LIMIT 1");
    $stmtNeg->execute(['slug' => $negocioParam, 'id' => $idVal]);
    $negocioRow = $stmtNeg->fetch(PDO::FETCH_ASSOC);

    if (!$negocioRow) {
        echo json_encode(['success' => false, 'error' => 'Negocio no encontrado']);
        exit;
    }

    $id_negocio = (int)$negocioRow['id'];
    $fecha = date('Y-m-d');
    $mes_anio = date('Y-m');

    $stmtIns = $pdo->prepare("INSERT INTO visitas_negocio (id_negocio, tipo, fecha, mes_anio) VALUES (?, ?, ?, ?)");
    $stmtIns->execute([$id_negocio, $tipo, $fecha, $mes_anio]);

    echo json_encode(['success' => true]);
} catch (\Throwable $e) {
    error_log("Error al registrar visita: " . $e->getMessage());
    echo json_encode(['success' => false, 'error' => 'Error al registrar visita']);
}
?>
