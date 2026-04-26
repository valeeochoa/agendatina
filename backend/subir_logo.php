<?php
session_start();
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
$file = $_FILES['logo'];

// 4. Validar que el archivo sea una imagen permitida
$allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
if (!in_array($file['type'], $allowedTypes)) {
    echo json_encode(['success' => false, 'error' => 'Formato no permitido. Utiliza JPG, PNG, WEBP o GIF.']);
    exit;
}

// 5. Validar el tamaño del archivo (Límite: 2MB)
$maxSize = 2 * 1024 * 1024;
if ($file['size'] > $maxSize) {
    echo json_encode(['success' => false, 'error' => 'La imagen es demasiado pesada. El tamaño máximo es 2MB.']);
    exit;
}

// 6. Preparar el directorio de subida
$uploadDir = __DIR__ . '/uploads/logos/';
if (!is_dir($uploadDir)) {
    // Crear la carpeta recursivamente si no existe
    mkdir($uploadDir, 0755, true);
}

// =========================================================================
// FUNCIÓN DE OPTIMIZACIÓN DE IMÁGENES (Redimensión y conversión a WebP)
// =========================================================================
function optimizarImagen($origen, $destino, $calidad = 85, $max_resolucion = 600) {
    $info = @getimagesize($origen);
    if (!$info) return false;

    $mime = $info['mime'];
    switch ($mime) {
        case 'image/jpeg': $imagen = @imagecreatefromjpeg($origen); break;
        case 'image/png': $imagen = @imagecreatefrompng($origen); break;
        case 'image/webp': $imagen = @imagecreatefromwebp($origen); break;
        case 'image/gif': $imagen = @imagecreatefromgif($origen); break;
        default: return false;
    }
    if (!$imagen) return false;

    $ancho = imagesx($imagen); $alto = imagesy($imagen);
    $nuevo_ancho = $ancho; $nuevo_alto = $alto;

    if ($ancho > $max_resolucion || $alto > $max_resolucion) {
        $ratio = $ancho / $alto;
        if ($ancho > $alto) { $nuevo_ancho = $max_resolucion; $nuevo_alto = $max_resolucion / $ratio; } 
        else { $nuevo_alto = $max_resolucion; $nuevo_ancho = $max_resolucion * $ratio; }
    }

    $nueva_imagen = imagecreatetruecolor($nuevo_ancho, $nuevo_alto);
    imagealphablending($nueva_imagen, false); imagesavealpha($nueva_imagen, true);
    $transparente = imagecolorallocatealpha($nueva_imagen, 255, 255, 255, 127);
    imagefilledrectangle($nueva_imagen, 0, 0, $nuevo_ancho, $nuevo_alto, $transparente);
    imagecopyresampled($nueva_imagen, $imagen, 0, 0, 0, 0, $nuevo_ancho, $nuevo_alto, $ancho, $alto);
    imagedestroy($imagen);
    $exito = imagewebp($nueva_imagen, $destino, $calidad);
    imagedestroy($nueva_imagen);
    return $exito;
}

// 7. Generar un nombre de archivo único para evitar sobrescrituras
$filename = 'logo_negocio_' . $id_negocio . '_' . time() . '.webp';
$destination = $uploadDir . $filename;

// Ruta relativa pública que se guardará en la base de datos y leerá el frontend
$publicUrl = 'backend/uploads/logos/' . $filename;

// 8. Optimizar, convertir a WebP y guardar en la carpeta de destino
if (optimizarImagen($file['tmp_name'], $destination, 85, 600)) {
    
    require_once __DIR__ . '/conexion.php';

    try {
        // 1. Obtener el logo anterior para eliminarlo y no acumular archivos basura
        $stmtOld = $pdo->prepare("SELECT url_logo FROM configuracion_web WHERE id_negocio = :id_negocio LIMIT 1");
        $stmtOld->execute(['id_negocio' => $id_negocio]);
        $oldConfig = $stmtOld->fetch();

        if ($oldConfig && !empty($oldConfig['url_logo'])) {
            $oldFilename = basename($oldConfig['url_logo']); // Extraemos solo el nombre del archivo
            $oldFileAbsolute = $uploadDir . $oldFilename;    // Armamos la ruta real en el servidor
            if (file_exists($oldFileAbsolute) && !is_dir($oldFileAbsolute)) {
                @unlink($oldFileAbsolute); // Borramos el archivo viejo
            }
        }

        // 2. Guardamos o actualizamos el logo nuevo en la base de datos
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
} else {
    echo json_encode(['success' => false, 'error' => 'Error en el servidor al intentar guardar la imagen.']);
}
?>