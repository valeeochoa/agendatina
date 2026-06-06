<?php
require_once __DIR__ . '/conexion.php';

header('Content-Type: application/json; charset=utf-8');

// 1. Verificar que el administrador esté logueado
if (!isset($_SESSION['user_id']) || !isset($_SESSION['id_negocio'])) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Acceso no autorizado. Inicia sesión.']);
    exit;
}

// 2. Permitir solo peticiones POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método no permitido.']);
    exit;
}

// 3. Comprobar que se ha enviado un archivo sin errores
if (!isset($_FILES['logo']) || $_FILES['logo']['error'] !== UPLOAD_ERR_OK) {
    echo json_encode(['success' => false, 'error' => 'No se recibió ninguna imagen o hubo un error en la subida.']);
    exit;
}

$id_negocio = $_SESSION['id_negocio'];

// 4. Instanciar FileUploader y ejecutar la subida optimizada
$uploader = new FileUploader('logos');
$res = $uploader->upload($_FILES['logo'], 2 * 1024 * 1024, ['jpg', 'jpeg', 'png', 'webp', 'gif'], ['image/jpeg', 'image/png', 'image/webp', 'image/gif'], true);

if (!$res['success']) {
    echo json_encode(['success' => false, 'error' => $res['error']]);
    exit;
}

$publicUrl = $res['url'];
$destination = $res['absolute_path'];

try {
    // 5. Obtener el logo anterior para eliminarlo y no acumular archivos basura
    $stmtOld = $pdo->prepare("SELECT url_logo FROM configuracion_web WHERE id_negocio = :id_negocio LIMIT 1");
    $stmtOld->execute(['id_negocio' => $id_negocio]);
    $oldConfig = $stmtOld->fetch();

    if ($oldConfig && !empty($oldConfig['url_logo'])) {
        $oldFilename = basename($oldConfig['url_logo']);
        $oldFileAbsolute = dirname(__DIR__) . '/uploads/logos/' . $oldFilename;
        if (file_exists($oldFileAbsolute) && !is_dir($oldFileAbsolute)) {
            @unlink($oldFileAbsolute); // Borramos el archivo viejo
        }
    }

    // 6. Guardamos o actualizamos el logo nuevo en la base de datos
    $stmt = $pdo->prepare("INSERT INTO configuracion_web (id_negocio, url_logo) 
                           VALUES (:id_negocio, :logo) 
                           ON DUPLICATE KEY UPDATE url_logo = :logo");
    $stmt->execute(['id_negocio' => $id_negocio, 'logo' => $publicUrl]);

    // Devolvemos la nueva URL para que el frontend pueda actualizar la previsualización al instante
    echo json_encode(['success' => true, 'logoUrl' => $publicUrl]);

} catch (PDOException $e) {
    @unlink($destination); // Borrar la imagen si falló la base de datos
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error al guardar en la base de datos: ' . $e->getMessage()]);
}
?>