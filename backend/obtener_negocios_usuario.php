<?php
session_start();
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/conexion.php';

$user_id = $_SESSION['user_id'] ?? null;

if (!$user_id) {
    echo json_encode(['success' => false, 'error' => 'No hay sesión activa.', 'negocios' => []]);
    exit;
}

try {
    $stmt = $pdo->prepare("
        SELECT pn.id_negocio, pn.rol_en_local, n.nombre_fantasia, n.plan, cw.logo
        FROM personal_negocio pn
        JOIN negocios n ON pn.id_negocio = n.id
        LEFT JOIN configuracion_web cw ON n.id = cw.id_negocio
        WHERE pn.id_usuario = ?
        ORDER BY (pn.rol_en_local = 'admin') DESC, pn.id_negocio ASC
    ");
    $stmt->execute([$user_id]);
    $list = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $actualId = (int)($_SESSION['id_negocio'] ?? 0);

    $formatted = array_map(function($b) use ($actualId) {
        return [
            'id_negocio' => (int)$b['id_negocio'],
            'nombre' => $b['nombre_fantasia'] ?: 'Mi Negocio',
            'rol' => $b['rol_en_local'],
            'plan' => $b['plan'] ?: 'Plan Simple',
            'logo' => $b['logo'] ?? null,
            'is_current' => ((int)$b['id_negocio'] === $actualId)
        ];
    }, $list);

    echo json_encode([
        'success' => true,
        'actual_id_negocio' => $actualId,
        'total' => count($formatted),
        'has_multiple' => (count($formatted) > 1),
        'negocios' => $formatted
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error al obtener negocios: ' . $e->getMessage()]);
}
