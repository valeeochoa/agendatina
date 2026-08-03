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
    try { $pdo->query("SELECT email_verificado FROM usuarios LIMIT 1"); } 
    catch(Exception $e) { $pdo->exec("ALTER TABLE usuarios ADD COLUMN email_verificado TINYINT DEFAULT 0"); }

    $stmtU = $pdo->prepare("SELECT nombre_completo, email, email_verificado FROM usuarios WHERE id = ?");
    $stmtU->execute([$id_usuario]);
    $user = $stmtU->fetch(PDO::FETCH_ASSOC);

    // Obtener datos del negocio
    $stmtN = $pdo->prepare("SELECT nombre_fantasia, ruta, plan, estado_pago, ultimo_pago, comprobante FROM negocios WHERE id = ?");
    $stmtN->execute([$id_negocio]);
    $business = $stmtN->fetch(PDO::FETCH_ASSOC);

    if ($business) {
        $business['is_demo'] = (isset($_SESSION['is_demo']) && $_SESSION['is_demo'] === true) || (isset($business['ruta']) && $business['ruta'] === 'demo') || (isset($user['email']) && strpos($user['email'], 'demo') !== false);
    }

    if (!$user || !$business) {
        echo json_encode(['success' => false, 'error' => 'No autorizado. Inicia sesión nuevamente.']);
        exit;
    }

    // Obtener configuración web
    try {
        $stmtC = $pdo->prepare("SELECT color_primario, color_secundario, color_fondo FROM configuracion_web WHERE id_negocio = ?");
        $stmtC->execute([$id_negocio]);
        $config = $stmtC->fetch(PDO::FETCH_ASSOC);
    } catch(Exception $e) { $config = null; } // Si la tabla no existe o está vacía

    // Migración: Crear tabla de Notificaciones si no existe para evitar caída al cargar la campanita
    try { $pdo->query("SELECT id FROM notificaciones LIMIT 1"); } 
    catch(Exception $e) { 
        $pdo->exec("CREATE TABLE notificaciones (id INT AUTO_INCREMENT PRIMARY KEY, id_negocio INT NULL, titulo VARCHAR(255), mensaje TEXT, fecha DATETIME DEFAULT CURRENT_TIMESTAMP)"); 
    }

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

        // 1. Actualizar Usuario y/o Contraseña (con verificación de seguridad de la contraseña actual)
        if (!empty($nombre) || !empty($password)) {
            // Obtener la contraseña actual en la base de datos
            $stmtCheck = $pdo->prepare("SELECT password FROM usuarios WHERE id = ?");
            $stmtCheck->execute([$id_usuario]);
            $userDb = $stmtCheck->fetch();

            $current_password = $data['current_password'] ?? '';

            if (!$userDb || !password_verify($current_password, $userDb['password'])) {
                throw new Exception("La contraseña actual es incorrecta. No se pueden guardar los cambios.");
            }

            if (!empty($nombre)) {
                $pdo->prepare("UPDATE usuarios SET nombre_completo = ? WHERE id = ?")->execute([$nombre, $id_usuario]);
                $_SESSION['nombre_completo'] = $nombre; // Refrescar sesión
            }
            if (!empty($password)) {
                $hash = password_hash($password, PASSWORD_DEFAULT);
                $pdo->prepare("UPDATE usuarios SET password = ? WHERE id = ?")->execute([$hash, $id_usuario]);
                require_once __DIR__ . '/helpers/notificar_admin_helper.php';
                notificarSuperAdminAlert($pdo, 'Seguridad / Contraseña', "El usuario '{$nombre}' modificó su contraseña de acceso.", $id_negocio);
            }
        }

        // 2. Actualizar Ruta (verificando que sea única)
        if (!empty($ruta)) {
            $check = $pdo->prepare("SELECT id FROM negocios WHERE ruta = ? AND id != ?");
            $check->execute([$ruta, $id_negocio]);
            if ($check->fetch()) {
                throw new Exception("La ruta ya está siendo utilizada por otro local.");
            }
            $pdo->prepare("UPDATE negocios SET ruta = ? WHERE id = ?")->execute([$ruta, $id_negocio]);
            require_once __DIR__ . '/helpers/notificar_admin_helper.php';
            notificarSuperAdminAlert($pdo, 'Configuración / Enlace Web', "El negocio cambió su enlace web público a: agendatina.site/{$ruta}", $id_negocio);
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