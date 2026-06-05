<?php
session_start();
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/conexion.php';

if (!isset($_SESSION['user_id']) || !isset($_SESSION['id_negocio'])) {
    echo json_encode(['success' => false, 'error' => 'No autorizado.']);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST' || !isset($_FILES['comprobante'])) {
    echo json_encode(['success' => false, 'error' => 'No se recibió ningún archivo.']);
    exit;
}

$file = $_FILES['comprobante'];
if ($file['error'] !== UPLOAD_ERR_OK) {
    echo json_encode(['success' => false, 'error' => 'Error al subir el archivo, intenta nuevamente.']);
    exit;
}

    // Validar extensión de archivo contra una lista blanca
    $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    $allowedExtensions = ['jpg', 'jpeg', 'png', 'webp', 'pdf'];
    if (!in_array($ext, $allowedExtensions)) {
        echo json_encode(['success' => false, 'error' => 'Formato no permitido. Extensión de archivo inválida.']);
        exit;
    }

    // Validar tipo MIME real del archivo en el servidor
    $allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    $realMime = '';
    if (function_exists('finfo_open')) {
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $realMime = finfo_file($finfo, $file['tmp_name']);
        finfo_close($finfo);
    } elseif (function_exists('mime_content_type')) {
        $realMime = mime_content_type($file['tmp_name']);
    } else {
        $realMime = $file['type']; // Fallback
    }

    if (!in_array($realMime, $allowedTypes)) {
        echo json_encode(['success' => false, 'error' => 'Contenido de archivo no permitido. El tipo MIME real no coincide con un formato válido.']);
        exit;
    }

    // Validar el tamaño del archivo (Límite: 5MB)
    $maxSize = 5 * 1024 * 1024;
    if ($file['size'] > $maxSize) {
        echo json_encode(['success' => false, 'error' => 'El comprobante es demasiado pesado. El tamaño máximo es 5MB.']);
        exit;
    }

$id_negocio = $_SESSION['id_negocio'];
$uploadDir = __DIR__ . '/uploads/comprobantes/';
if (!is_dir($uploadDir)) mkdir($uploadDir, 0755, true);

// Nombrar el archivo de forma única
$filename = 'comprobante_' . $id_negocio . '_' . time() . '.' . $ext;
$destination = $uploadDir . $filename;

if (move_uploaded_file($file['tmp_name'], $destination)) {
    try {
        // Asegurar que la columna 'comprobante' exista en la tabla negocios
        try { $pdo->query("SELECT comprobante FROM negocios LIMIT 1"); } 
        catch(Exception $e) { $pdo->exec("ALTER TABLE negocios ADD COLUMN comprobante VARCHAR(255) DEFAULT NULL"); }

        // Guardar la URL del comprobante y pasar el estado a pendiente de revisión
        $urlComprobante = 'backend/uploads/comprobantes/' . $filename;
        $pdo->prepare("UPDATE negocios SET estado_pago = 'pendiente_revision', comprobante = ? WHERE id = ?")
            ->execute([$urlComprobante, $id_negocio]);
            
        echo json_encode(['success' => true]);
    } catch(Exception $e) {
        echo json_encode(['success' => false, 'error' => 'Error BD: ' . $e->getMessage()]);
    }
} else {
    echo json_encode(['success' => false, 'error' => 'Error al mover el archivo en el servidor.']);
}
?>