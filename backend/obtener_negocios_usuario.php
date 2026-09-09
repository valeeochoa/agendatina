<?php
session_start();
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/conexion.php';

$user_id = $_SESSION['user_id'] ?? null;

if (!$user_id) {
    echo json_encode([
        'success' => false,
        'error' => 'No hay sesión activa.',
        'has_multiple' => false,
        'negocios' => []
    ]);
    exit;
}

try {
    // Detectar nombre de columna de logo dinámicamente si es url_logo o logo
    $logoCol = "cw.url_logo";
    try {
        $pdo->query("SELECT url_logo FROM configuracion_web LIMIT 1");
    } catch (Throwable $eCol) {
        $logoCol = "cw.logo";
    }

    $stmt = $pdo->prepare("
        SELECT pn.id_negocio, pn.rol_en_local, n.nombre_fantasia, n.plan, {$logoCol} AS logo
        FROM personal_negocio pn
        JOIN negocios n ON pn.id_negocio = n.id
        LEFT JOIN configuracion_web cw ON n.id = cw.id_negocio
        WHERE pn.id_usuario = ?
        ORDER BY (pn.rol_en_local = 'admin') DESC, pn.id_negocio ASC
    ");
    $stmt->execute([$user_id]);
    $list = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $actualId = (int)($_SESSION['id_negocio'] ?? 0);

    // Evitar duplicados por id_negocio si existieran múltiples registros en JOIN
    $uniqueMap = [];
    foreach ($list as $b) {
        $id = (int)$b['id_negocio'];
        if (!isset($uniqueMap[$id])) {
            $uniqueMap[$id] = [
                'id_negocio' => $id,
                'nombre' => $b['nombre_fantasia'] ?: 'Mi Negocio',
                'rol' => $b['rol_en_local'],
                'plan' => $b['plan'] ?: 'Plan Simple',
                'logo' => $b['logo'] ?? null,
                'is_current' => ($id === $actualId)
            ];
        }
    }

    $formatted = array_values($uniqueMap);

    echo json_encode([
        'success' => true,
        'actual_id_negocio' => $actualId,
        'total' => count($formatted),
        'has_multiple' => (count($formatted) > 1),
        'negocios' => $formatted
    ]);

} catch (Throwable $e) {
    // Devuelve respuesta de error JSON con HTTP 200 para evitar errores 500 en consola de navegador
    echo json_encode([
        'success' => false,
        'error' => 'Error al obtener negocios: ' . $e->getMessage(),
        'has_multiple' => false,
        'negocios' => []
    ]);
}
