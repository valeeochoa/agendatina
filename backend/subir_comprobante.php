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

    // Insertar también en la tabla comprobantes_pago para reflejar en el panel admin
    try {
        $pdo->exec("CREATE TABLE IF NOT EXISTS `comprobantes_pago` (
            `id` INT AUTO_INCREMENT PRIMARY KEY,
            `id_negocio` INT NOT NULL,
            `monto` DECIMAL(10,2) DEFAULT NULL,
            `plan` VARCHAR(50) DEFAULT NULL,
            `archivo_path` VARCHAR(255) NOT NULL,
            `nombre_archivo` VARCHAR(255) DEFAULT NULL,
            `fecha_pago` DATETIME DEFAULT CURRENT_TIMESTAMP,
            `estado` VARCHAR(50) DEFAULT 'pendiente',
            `notas` TEXT DEFAULT NULL
        )");
        $origName = $_FILES['comprobante']['name'] ?? 'comprobante';
        $stmtIns = $pdo->prepare("INSERT INTO comprobantes_pago (id_negocio, archivo_path, nombre_archivo, fecha_pago, estado, notas) VALUES (?, ?, ?, NOW(), 'pendiente', 'Comprobante enviado por cliente')");
        $stmtIns->execute([$id_negocio, $urlComprobante, $origName]);
    } catch(Exception $exComp) {}

    echo json_encode(['success' => true]);
} catch(Exception $e) {
    @unlink($res['absolute_path']); // Borrar el archivo si falla la base de datos
    echo json_encode(['success' => false, 'error' => 'Error BD: ' . $e->getMessage()]);
}
?>