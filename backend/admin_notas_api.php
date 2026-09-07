<?php
session_start();
header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/conexion.php';
require_once __DIR__ . '/admin_auth.php';

// Asegurar que la tabla admin_notas existe y tiene la estructura completa
try {
    $pdo->exec("CREATE TABLE IF NOT EXISTS `admin_notas` (
        `id` INT AUTO_INCREMENT PRIMARY KEY,
        `id_negocio` INT NOT NULL,
        `nota` TEXT NOT NULL,
        `fecha` DATETIME DEFAULT CURRENT_TIMESTAMP,
        `estado` VARCHAR(20) DEFAULT 'activo',
        `fecha_eliminado` DATETIME DEFAULT NULL,
        INDEX (id_negocio)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");
} catch (Exception $e) {}

// Asegurar columnas de eliminación suave y fechas
try { $pdo->exec("ALTER TABLE admin_notas ADD COLUMN estado VARCHAR(20) DEFAULT 'activo'"); } catch(Exception $e) {}
try { $pdo->exec("ALTER TABLE admin_notas ADD COLUMN fecha_eliminado DATETIME DEFAULT NULL"); } catch(Exception $e) {}
try { $pdo->exec("ALTER TABLE admin_notas ADD COLUMN fecha DATETIME DEFAULT CURRENT_TIMESTAMP"); } catch(Exception $e) {}

// Eliminar restricción UNIQUE en id_negocio si existe (proveniente de instalaciones anteriores) para permitir múltiples notas
try {
    $stmtKeys = $pdo->query("SHOW KEYS FROM admin_notas WHERE Key_name = 'id_negocio' AND Non_unique = 0");
    if ($stmtKeys && $stmtKeys->fetch()) {
        $pdo->exec("ALTER TABLE admin_notas DROP INDEX id_negocio");
        $pdo->exec("ALTER TABLE admin_notas ADD INDEX (id_negocio)");
    }
} catch (Exception $e) {}

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    try {
        $stmt = $pdo->query("
            SELECT an.id, an.id_negocio, COALESCE(n.nombre_fantasia, CONCAT('Empresa #', an.id_negocio)) AS nombre_negocio, n.ruta, an.nota, COALESCE(an.fecha, an.fecha_actualizacion, NOW()) AS fecha
            FROM admin_notas an
            LEFT JOIN negocios n ON an.id_negocio = n.id
            WHERE (an.estado IS NULL OR an.estado != 'eliminado')
            ORDER BY COALESCE(an.fecha, an.fecha_actualizacion) DESC
        ");
        $notas = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode([
            'success' => true,
            'data' => $notas
        ]);
    } catch (Exception $e) {
        echo json_encode(['success' => false, 'error' => 'Error al cargar notas: ' . $e->getMessage()]);
    }

} elseif ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true) ?: $_POST;
    $id_negocio = (int)($input['id_negocio'] ?? 0);
    $nota = trim($input['nota'] ?? '');

    if ($id_negocio <= 0 || empty($nota)) {
        echo json_encode(['success' => false, 'error' => 'Por favor selecciona un negocio e ingresa el texto de la nota.']);
        exit;
    }

    try {
        $stmt = $pdo->prepare("INSERT INTO admin_notas (id_negocio, nota, fecha, estado) VALUES (:id_negocio, :nota, NOW(), 'activo')");
        $stmt->execute(['id_negocio' => $id_negocio, 'nota' => $nota]);

        echo json_encode(['success' => true, 'message' => 'Nota administrativa guardada con éxito.']);
    } catch (Exception $e) {
        echo json_encode(['success' => false, 'error' => 'Error al guardar nota: ' . $e->getMessage()]);
    }

} elseif ($method === 'DELETE') {
    $input = json_decode(file_get_contents('php://input'), true) ?: $_GET;
    $id = (int)($input['id'] ?? 0);

    if ($id <= 0) {
        echo json_encode(['success' => false, 'error' => 'ID de nota inválido.']);
        exit;
    }

    try {
        $stmt = $pdo->prepare("UPDATE admin_notas SET estado = 'eliminado', fecha_eliminado = NOW() WHERE id = ?");
        $stmt->execute([$id]);

        echo json_encode(['success' => true, 'message' => 'Nota enviada a la papelera.']);
    } catch (Exception $e) {
        echo json_encode(['success' => false, 'error' => 'Error al eliminar nota: ' . $e->getMessage()]);
    }
}
?>
