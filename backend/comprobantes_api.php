<?php
session_start();
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/conexion.php';

// Verificar permisos (Superadmin o el dueño del negocio)
$isSuperAdmin = isset($_SESSION['is_superadmin']) && $_SESSION['is_superadmin'] === true;
$idNegocioSesion = $_SESSION['id_negocio'] ?? null;

$method = $_SERVER['REQUEST_METHOD'];

// Asegurar que la tabla comprobantes_pago exista
try {
    $pdo->exec("CREATE TABLE IF NOT EXISTS `comprobantes_pago` (
      `id` INT AUTO_INCREMENT PRIMARY KEY,
      `id_negocio` INT NOT NULL,
      `monto` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      `plan` VARCHAR(100) DEFAULT NULL,
      `archivo_path` VARCHAR(255) NOT NULL,
      `nombre_archivo` VARCHAR(255) NOT NULL,
      `fecha_pago` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      `estado` VARCHAR(50) DEFAULT 'aprobado',
      `notas` TEXT DEFAULT NULL,
      FOREIGN KEY (`id_negocio`) REFERENCES `negocios` (`id`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
} catch (Exception $e) {}

// GET: Listar comprobantes
if ($method === 'GET') {
    $id_negocio = $_GET['id_negocio'] ?? $idNegocioSesion;
    if (!$id_negocio) {
        echo json_encode(['success' => false, 'error' => 'ID de negocio no especificado.']);
        exit;
    }
    
    if (!$isSuperAdmin && $id_negocio != $idNegocioSesion) {
        echo json_encode(['success' => false, 'error' => 'Acceso denegado.']);
        exit;
    }

    try {
        $stmt = $pdo->prepare("SELECT id, id_negocio, monto, plan, archivo_path, nombre_archivo, fecha_pago, estado, notas FROM comprobantes_pago WHERE id_negocio = :id ORDER BY fecha_pago DESC");
        $stmt->execute(['id' => $id_negocio]);
        $comprobantes = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Auto-sincronización con la columna negocios.comprobante
        try {
            $stmtNeg = $pdo->prepare("SELECT comprobante, plan, estado_pago, ultimo_pago FROM negocios WHERE id = ?");
            $stmtNeg->execute([$id_negocio]);
            $neg = $stmtNeg->fetch(PDO::FETCH_ASSOC);

            if ($neg && !empty($neg['comprobante'])) {
                $found = false;
                foreach ($comprobantes as $c) {
                    if ($c['archivo_path'] === $neg['comprobante'] || basename($c['archivo_path']) === basename($neg['comprobante'])) {
                        $found = true;
                        break;
                    }
                }
                if (!$found) {
                    $filename = basename($neg['comprobante']);
                    $legacyComp = [
                        'id' => 'legacy_' . $id_negocio,
                        'id_negocio' => (int)$id_negocio,
                        'monto' => 0.00,
                        'plan' => $neg['plan'] ?? 'Básico',
                        'archivo_path' => $neg['comprobante'],
                        'nombre_archivo' => $filename,
                        'fecha_pago' => $neg['ultimo_pago'] ?? date('Y-m-d H:i:s'),
                        'estado' => $neg['estado_pago'] === 'pendiente_revision' ? 'pendiente' : 'aprobado',
                        'notas' => 'Comprobante subido por el cliente'
                    ];
                    array_unshift($comprobantes, $legacyComp);

                    // Insertar permanentemente en la base para futuras búsquedas
                    try {
                        $stmtInsSync = $pdo->prepare("INSERT INTO comprobantes_pago (id_negocio, monto, plan, archivo_path, nombre_archivo, fecha_pago, estado, notas) VALUES (?, 0, ?, ?, ?, NOW(), ?, 'Comprobante sincronizado')");
                        $stmtInsSync->execute([$id_negocio, $neg['plan'] ?? 'Básico', $neg['comprobante'], $filename, $neg['estado_pago'] === 'pendiente_revision' ? 'pendiente' : 'aprobado']);
                    } catch(Exception $eInsSync) {}
                }
            }
        } catch(Exception $exSync) {}

        echo json_encode(['success' => true, 'data' => $comprobantes]);
    } catch (Exception $e) {
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
    exit;
}

// POST: Subir nuevo comprobante
if ($method === 'POST') {
    if (!$isSuperAdmin) {
        echo json_encode(['success' => false, 'error' => 'Solo el Administrador puede agregar comprobantes.']);
        exit;
    }

    $id_negocio = $_POST['id_negocio'] ?? null;
    $monto = (float)($_POST['monto'] ?? 0);
    $plan = trim($_POST['plan'] ?? 'Básico');
    $notas = trim($_POST['notas'] ?? '');

    if (!$id_negocio || !isset($_FILES['comprobante'])) {
        echo json_encode(['success' => false, 'error' => 'Datos incompletos o archivo no seleccionado.']);
        exit;
    }

    $file = $_FILES['comprobante'];
    $allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!in_array($file['type'], $allowedTypes)) {
        echo json_encode(['success' => false, 'error' => 'Formato no permitido. Solo JPG, PNG, WEBP o PDF.']);
        exit;
    }

    $uploadDir = __DIR__ . '/../uploads/comprobantes/';
    if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0755, true);
    }

    $ext = pathinfo($file['name'], PATHINFO_EXTENSION);
    $newFileName = 'comp_' . $id_negocio . '_' . time() . '_' . rand(100, 999) . '.' . $ext;
    $targetPath = $uploadDir . $newFileName;
    $relativePath = 'uploads/comprobantes/' . $newFileName;

    if (move_uploaded_file($file['tmp_name'], $targetPath)) {
        try {
            $stmt = $pdo->prepare("INSERT INTO comprobantes_pago (id_negocio, monto, plan, archivo_path, nombre_archivo, fecha_pago, estado, notas) VALUES (:id_negocio, :monto, :plan, :path, :nombre, NOW(), 'aprobado', :notas)");
            $stmt->execute([
                'id_negocio' => $id_negocio,
                'monto' => $monto,
                'plan' => $plan,
                'path' => $relativePath,
                'nombre' => $file['name'],
                'notas' => $notas
            ]);
            echo json_encode(['success' => true]);
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'error' => 'Error en BD: ' . $e->getMessage()]);
        }
    } else {
        echo json_encode(['success' => false, 'error' => 'Error al guardar el archivo en el servidor.']);
    }
    exit;
}

// DELETE: Eliminar comprobante
if ($method === 'DELETE') {
    if (!$isSuperAdmin) {
        echo json_encode(['success' => false, 'error' => 'Solo el Administrador puede eliminar comprobantes.']);
        exit;
    }

    $data = json_decode(file_get_contents('php://input'), true);
    $id = $data['id'] ?? null;

    if (!$id) {
        echo json_encode(['success' => false, 'error' => 'ID no proporcionado.']);
        exit;
    }

    try {
        $stmtSel = $pdo->prepare("SELECT archivo_path FROM comprobantes_pago WHERE id = :id");
        $stmtSel->execute(['id' => $id]);
        $row = $stmtSel->fetch(PDO::FETCH_ASSOC);

        if ($row && !empty($row['archivo_path'])) {
            $fullPath = __DIR__ . '/../' . $row['archivo_path'];
            if (file_exists($fullPath)) @unlink($fullPath);
        }

        $stmtDel = $pdo->prepare("DELETE FROM comprobantes_pago WHERE id = :id");
        $stmtDel->execute(['id' => $id]);

        echo json_encode(['success' => true]);
    } catch (Exception $e) {
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
    exit;
}
?>
