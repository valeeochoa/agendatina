<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/conexion.php';

$ruta = trim($_GET['n'] ?? '');
$id_negocio = 0;

if ($ruta !== '') {
    $stmtN = $pdo->prepare("SELECT id FROM negocios WHERE ruta = :ruta LIMIT 1");
    $stmtN->execute(['ruta' => $ruta]);
    $neg = $stmtN->fetch(PDO::FETCH_ASSOC);
    if ($neg) {
        $id_negocio = (int)$neg['id'];
    }
} elseif (isset($_SESSION['id_negocio'])) {
    $id_negocio = (int)$_SESSION['id_negocio'];
}

session_write_close();

if ($id_negocio <= 0) {
    echo json_encode([]);
    exit;
}

try {
    $stmt = $pdo->prepare("
        SELECT u.nombre_completo, pn.rol_en_local
        FROM personal_negocio pn
        JOIN usuarios u ON u.id = pn.id_usuario
        WHERE pn.id_negocio = :id_negocio
          AND (pn.estado IS NULL OR pn.estado = 'activo')
        ORDER BY pn.id ASC
    ");
    $stmt->execute(['id_negocio' => $id_negocio]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode($rows ?: []);
} catch (Throwable $e) {
    echo json_encode([]);
}
