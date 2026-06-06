<?php
require_once __DIR__ . '/conexion.php';

header('Content-Type: application/json; charset=utf-8');

if (!isset($_SESSION['user_id']) || !isset($_SESSION['id_negocio'])) {
    echo json_encode(['success' => false, 'error' => 'No autorizado.']);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST' || !isset($_FILES['comprobante'])) {
    echo json_encode(['success' => false, 'error' => 'No se recibió ningún archivo.']);
    exit;
}

$id_negocio = $_SESSION['id_negocio'];

// Instanciar FileUploader para comprobantes (Límite 5MB, admite imágenes y PDF)
$uploader = new FileUploader('comprobantes');
$res = $uploader->upload($_FILES['comprobante'], 5 * 1024 * 1024, ['jpg', 'jpeg', 'png', 'webp', 'pdf'], ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'], false);

if (!$res['success']) {
    echo json_encode(['success' => false, 'error' => $res['error']]);
    exit;
}

$urlComprobante = $res['url'];

try {
    // Asegurar que la columna 'comprobante' exista en la tabla negocios
    try { $pdo->query("SELECT comprobante FROM negocios LIMIT 1"); } 
    catch(Exception $e) { $pdo->exec("ALTER TABLE negocios ADD COLUMN comprobante VARCHAR(255) DEFAULT NULL"); }

    // Guardar la URL del comprobante y pasar el estado a pendiente de revisión
    $pdo->prepare("UPDATE negocios SET estado_pago = 'pendiente_revision', comprobante = ? WHERE id = ?")
        ->execute([$urlComprobante, $id_negocio]);
        
    echo json_encode(['success' => true]);
} catch(Exception $e) {
    @unlink($res['absolute_path']); // Borrar el archivo si falla la base de datos
    echo json_encode(['success' => false, 'error' => 'Error BD: ' . $e->getMessage()]);
}
?>