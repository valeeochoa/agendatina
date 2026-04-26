<?php
// Enrutador Principal de Agendatina

$ruta = $_GET['n'] ?? '';
$vista = $_GET['v'] ?? '';

// 1. Si no hay parámetro de negocio, están visitando la raíz del sitio (Landing Page)
if (empty($ruta)) {
    if (file_exists('index.html')) {
        include 'index.html';
    } else {
        echo "<h1 style='text-align:center; margin-top:50px; font-family:sans-serif;'>Bienvenido a Agendatina</h1>";
    }
    exit;
}

require_once __DIR__ . '/backend/conexion.php';

try {
    // 2. Validar que la ruta del negocio exista en la base de datos
    $stmt = $pdo->prepare("SELECT id FROM negocios WHERE ruta = :ruta LIMIT 1");
    $stmt->execute(['ruta' => $ruta]);
    $negocio = $stmt->fetch();

    if (!$negocio) {
        http_response_code(404);
        echo "<h1 style='text-align:center; margin-top:50px; font-family:sans-serif; color: #333;'>El negocio no existe o el enlace es incorrecto.</h1>";
        exit;
    }

    $id_negocio = $negocio['id'];

    // 3. Obtener el tipo de calendario elegido en los ajustes
    $stmtConf = $pdo->prepare("SELECT tipo_calendario FROM configuracion_web WHERE id_negocio = :id LIMIT 1");
    $stmtConf->execute(['id' => $id_negocio]);
    $conf = $stmtConf->fetch();

    $tipo_calendario = $conf ? ($conf['tipo_calendario'] ?? 'clasico') : 'clasico';

    // 4. Verificar si el plan incluye página web (Premium/Completo)
    $stmtPlan = $pdo->prepare("SELECT plan FROM negocios WHERE id = :id LIMIT 1");
    $stmtPlan->execute(['id' => $id_negocio]);
    $planRow = $stmtPlan->fetch();
    $planName = $planRow ? strtolower($planRow['plan']) : 'basico';
    $tiene_web = (strpos($planName, 'premium') !== false || strpos($planName, 'completo') !== false);

    // 4. Enrutamiento según la URL solicitada
    if ($vista === 'calendario') {
        // Están visitando /tu-negocio/calendario
        if ($tipo_calendario === 'semanal') {
            include 'calendarioSemanal.html';
        } else {
            include 'calendarioMensual.html';
        }
    } elseif ($vista === 'calendarioMensual') {
        include 'calendarioMensual.html';
    } elseif ($vista === 'calendarioSemanal' || $vista === 'calendario2') {
        include 'calendarioSemanal.html';
    } else {
        // Están visitando /tu-negocio (Portada Pública)
        if ($tiene_web && file_exists('web.html')) {
            include 'web.html';
        } else {
            // Fallback: Si no usan la web pública, van directo al calendario
            include ($tipo_calendario === 'semanal') ? 'calendarioSemanal.html' : 'calendarioMensual.html';
        }
    }

} catch (Exception $e) {
    http_response_code(500);
    echo "<h1 style='text-align:center; margin-top:50px; font-family:sans-serif; color: #ef4444;'>Error interno del servidor.</h1>";
}
?>