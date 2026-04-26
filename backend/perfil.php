<?php
session_start();
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/conexion.php';

if (!isset($_SESSION['user_id']) || !isset($_SESSION['id_negocio'])) {
    echo json_encode(['success' => false, 'error' => 'No autorizado. Inicia sesión.']);
    exit;
}

$id_usuario = $_SESSION['user_id'];
$id_negocio = $_SESSION['id_negocio'];

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    // Liberar el archivo de sesión para evitar bloqueos al navegar entre páginas
    session_write_close();

    // Obtener datos de usuario
    $stmtU = $pdo->prepare("SELECT nombre_completo, email FROM usuarios WHERE id = ?");
    $stmtU->execute([$id_usuario]);
    $user = $stmtU->fetch(PDO::FETCH_ASSOC);

    // Obtener datos del negocio
    $stmtN = $pdo->prepare("SELECT ruta, plan, estado_pago FROM negocios WHERE id = ?");
    $stmtN->execute([$id_negocio]);
    $business = $stmtN->fetch(PDO::FETCH_ASSOC);

    // Obtener configuración web
    try {
        $stmtC = $pdo->prepare("SELECT color_primario, color_secundario, color_fondo FROM configuracion_web WHERE id_negocio = ?");
        $stmtC->execute([$id_negocio]);
        $config = $stmtC->fetch(PDO::FETCH_ASSOC);
    } catch(Exception $e) { $config = null; } // Si la tabla no existe o está vacía

    $stmtNotif = $pdo->prepare("SELECT * FROM notificaciones WHERE id_negocio = ? OR id_negocio IS NULL ORDER BY fecha DESC LIMIT 20");
    $stmtNotif->execute([$id_negocio]);
    $notificaciones = $stmtNotif->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode(['success' => true, 'user' => $user, 'business' => $business, 'config' => $config, 'notificaciones' => $notificaciones]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $contentType = isset($_SERVER["CONTENT_TYPE"]) ? trim($_SERVER["CONTENT_TYPE"]) : '';
    if (strpos($contentType, 'application/json') !== false) {
        $data = json_decode(file_get_contents('php://input'), true);
    } else {
        $data = $_POST;
    }

    $nombre = $data['nombre'] ?? '';
    $password = $data['password'] ?? '';
    $rutaRaw = $data['ruta'] ?? $data['subdominio'] ?? '';
    $ruta = preg_replace('/[^a-zA-Z0-9-]/', '', strtolower(trim($rutaRaw)));
    $color_primario = $data['color_primario'] ?? null;
    $color_secundario = $data['color_secundario'] ?? null;
    $color_fondo = $data['color_fondo'] ?? null;

    try {
        $pdo->beginTransaction();

        // 1. Actualizar Usuario y/o Contraseña
        if (!empty($nombre)) {
            $pdo->prepare("UPDATE usuarios SET nombre_completo = ? WHERE id = ?")->execute([$nombre, $id_usuario]);
            $_SESSION['nombre_completo'] = $nombre; // Refrescar sesión
        }
        if (!empty($password)) {
            $hash = password_hash($password, PASSWORD_DEFAULT);
            $pdo->prepare("UPDATE usuarios SET password = ? WHERE id = ?")->execute([$hash, $id_usuario]);
        }

        // 2. Actualizar Ruta (verificando que sea única)
        if (!empty($ruta)) {
            $check = $pdo->prepare("SELECT id FROM negocios WHERE ruta = ? AND id != ?");
            $check->execute([$ruta, $id_negocio]);
            if ($check->fetch()) {
                throw new Exception("La ruta ya está siendo utilizada por otro local.");
            }
            $pdo->prepare("UPDATE negocios SET ruta = ? WHERE id = ?")->execute([$ruta, $id_negocio]);
        }

        // 3. Actualizar Colores
        if ($color_primario || $color_secundario || $color_fondo) {
            $pdo->prepare("INSERT INTO configuracion_web (id_negocio, color_primario, color_secundario, color_fondo) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE color_primario = ?, color_secundario = ?, color_fondo = ?")->execute([$id_negocio, $color_primario, $color_secundario, $color_fondo, $color_primario, $color_secundario, $color_fondo]);
        }

        $pdo->commit();
        echo json_encode(['success' => true]);
    } catch (Exception $e) {
        $pdo->rollBack();
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
}
?>