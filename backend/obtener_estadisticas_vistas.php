<?php
session_start();
header('Content-Type: application/json; charset=utf-8');

if (!isset($_SESSION['user_id']) || !isset($_SESSION['id_negocio'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'No autorizado']);
    exit;
}

require_once __DIR__ . '/conexion.php';

$id_negocio = (int)$_SESSION['id_negocio'];

// Auto-migración transparente de visitas_negocio si aún no fue creada
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
} catch (\Throwable $eMig) {}

try {
    // Consultar plan y fecha de inicio del negocio
    $stmtNeg = $pdo->prepare("SELECT plan, fecha_alta, created_at FROM negocios WHERE id = ? LIMIT 1");
    $stmtNeg->execute([$id_negocio]);
    $negocio = $stmtNeg->fetch(PDO::FETCH_ASSOC);

    if (!$negocio) {
        echo json_encode(['success' => false, 'error' => 'Negocio no encontrado']);
        exit;
    }

    $plan = strtolower(trim($negocio['plan'] ?? 'basico'));
    $isProOrPremium = (
        strpos($plan, 'profesional') !== false || 
        strpos($plan, 'intermedio') !== false || 
        strpos($plan, 'premium') !== false || 
        strpos($plan, 'completo') !== false
    );

    // Si el negocio no tiene plan Profesional ni Premium, no tiene acceso a métricas de vistas
    if (!$isProOrPremium) {
        echo json_encode([
            'success' => true,
            'allowed' => false,
            'plan' => $plan,
            'message' => 'Métricas de visualizaciones disponibles exclusivamente en planes Profesional y Premium.'
        ]);
        exit;
    }

    $mesActual = date('Y-m');
    $mesAnterior = date('Y-m', strtotime('first day of last month'));

    // 1. Vistas del Mes Actual
    $stmtMesAct = $pdo->prepare("SELECT tipo, COUNT(*) as total FROM visitas_negocio WHERE id_negocio = ? AND mes_anio = ? GROUP BY tipo");
    $stmtMesAct->execute([$id_negocio, $mesActual]);
    $vistasMesAct = ['calendario' => 0, 'web' => 0, 'total' => 0];
    while ($row = $stmtMesAct->fetch(PDO::FETCH_ASSOC)) {
        $tipo = $row['tipo'];
        $cnt = (int)$row['total'];
        $vistasMesAct[$tipo] = $cnt;
        $vistasMesAct['total'] += $cnt;
    }

    // 2. Vistas del Mes Anterior
    $stmtMesAnt = $pdo->prepare("SELECT tipo, COUNT(*) as total FROM visitas_negocio WHERE id_negocio = ? AND mes_anio = ? GROUP BY tipo");
    $stmtMesAnt->execute([$id_negocio, $mesAnterior]);
    $vistasMesAnt = ['calendario' => 0, 'web' => 0, 'total' => 0];
    while ($row = $stmtMesAnt->fetch(PDO::FETCH_ASSOC)) {
        $tipo = $row['tipo'];
        $cnt = (int)$row['total'];
        $vistasMesAnt[$tipo] = $cnt;
        $vistasMesAnt['total'] += $cnt;
    }

    // 3. Vistas Históricas Totales
    $stmtHist = $pdo->prepare("SELECT tipo, COUNT(*) as total FROM visitas_negocio WHERE id_negocio = ? GROUP BY tipo");
    $stmtHist->execute([$id_negocio]);
    $vistasHist = ['calendario' => 0, 'web' => 0, 'total' => 0];
    while ($row = $stmtHist->fetch(PDO::FETCH_ASSOC)) {
        $tipo = $row['tipo'];
        $cnt = (int)$row['total'];
        $vistasHist[$tipo] = $cnt;
        $vistasHist['total'] += $cnt;
    }

    // 4. Período últimos 30 y 90 días
    $stmt30 = $pdo->prepare("SELECT tipo, COUNT(*) as total FROM visitas_negocio WHERE id_negocio = ? AND fecha >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) GROUP BY tipo");
    $stmt30->execute([$id_negocio]);
    $vistas30 = ['calendario' => 0, 'web' => 0, 'total' => 0];
    while ($row = $stmt30->fetch(PDO::FETCH_ASSOC)) {
        $tipo = $row['tipo'];
        $cnt = (int)$row['total'];
        $vistas30[$tipo] = $cnt;
        $vistas30['total'] += $cnt;
    }

    $stmt90 = $pdo->prepare("SELECT tipo, COUNT(*) as total FROM visitas_negocio WHERE id_negocio = ? AND fecha >= DATE_SUB(CURDATE(), INTERVAL 90 DAY) GROUP BY tipo");
    $stmt90->execute([$id_negocio]);
    $vistas90 = ['calendario' => 0, 'web' => 0, 'total' => 0];
    while ($row = $stmt90->fetch(PDO::FETCH_ASSOC)) {
        $tipo = $row['tipo'];
        $cnt = (int)$row['total'];
        $vistas90[$tipo] = $cnt;
        $vistas90['total'] += $cnt;
    }

    // 5. Comparativa Porcentual y Validación de Historial
    // Solo mostrar comparativa si el negocio ya existía/pagaba antes del primer día del mes actual Y hubo vistas
    $fechaInicio = $negocio['fecha_alta'] ?? ($negocio['created_at'] ?? null);
    $primerDiaMesActual = date('Y-m-01');
    $esNegocioConHistorial = false;
    if ($fechaInicio) {
        $timestampInicio = strtotime($fechaInicio);
        if ($timestampInicio > 0 && $timestampInicio < strtotime($primerDiaMesActual)) {
            $esNegocioConHistorial = true;
        }
    }

    $tieneHistorialMesAnterior = ($esNegocioConHistorial && $vistasMesAnt['total'] > 0);
    $variacionPct = null;

    if ($tieneHistorialMesAnterior) {
        $diff = $vistasMesAct['total'] - $vistasMesAnt['total'];
        $variacionPct = round(($diff / $vistasMesAnt['total']) * 100, 1);
    }

    echo json_encode([
        'success' => true,
        'allowed' => true,
        'plan' => $plan,
        'mes_actual' => $vistasMesAct,
        'mes_anterior' => $vistasMesAnt,
        'historico' => $vistasHist,
        'ultimos_30' => $vistas30,
        'ultimos_90' => $vistas90,
        'tiene_historial_mes_anterior' => $tieneHistorialMesAnterior,
        'variacion_pct' => $variacionPct
    ]);

} catch (\Throwable $e) {
    error_log("Error al obtener estadísticas de vistas: " . $e->getMessage());
    echo json_encode(['success' => false, 'error' => 'Error al obtener estadísticas de vistas']);
}
?>
