<?php
session_start();
header('Content-Type: application/json; charset=utf-8');

if (!isset($_SESSION['user_id']) || !isset($_SESSION['id_negocio'])) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Acceso no autorizado. Inicia sesión.']);
    exit;
}

$id_negocio = (int)$_SESSION['id_negocio'];
require_once __DIR__ . '/conexion.php';

// Auto-migraciones para tabla cupones_descuento
try {
    $pdo->exec("CREATE TABLE IF NOT EXISTS cupones_descuento (
        id INT AUTO_INCREMENT PRIMARY KEY,
        id_negocio INT NOT NULL,
        codigo VARCHAR(50) NOT NULL,
        cliente_celular VARCHAR(50) DEFAULT NULL,
        cliente_nombre VARCHAR(255) DEFAULT NULL,
        porcentaje_descuento INT DEFAULT 10,
        usado TINYINT(1) DEFAULT 0,
        fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
        fecha_expiracion DATETIME NOT NULL,
        fecha_uso DATETIME DEFAULT NULL,
        INDEX (id_negocio),
        INDEX (codigo)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
} catch (\Throwable $e) {}

$colsCupones = [
    'porcentaje_descuento' => 'INT DEFAULT 10',
    'nombre' => 'VARCHAR(150) DEFAULT NULL',
    'cliente_celular' => 'VARCHAR(50) DEFAULT NULL',
    'cliente_nombre' => 'VARCHAR(255) DEFAULT NULL',
    'usado' => 'TINYINT(1) DEFAULT 0',
    'usos_maximos' => 'INT DEFAULT 1',
    'usos_actuales' => 'INT DEFAULT 0',
    'activo' => 'TINYINT(1) DEFAULT 1',
    'es_acumulable' => 'TINYINT(1) DEFAULT 0',
    'fecha_creacion' => 'DATETIME DEFAULT CURRENT_TIMESTAMP',
    'fecha_expiracion' => 'DATETIME DEFAULT NULL',
    'fecha_uso' => 'DATETIME DEFAULT NULL'
];
foreach ($colsCupones as $cName => $cDef) {
    try { $pdo->query("SELECT $cName FROM cupones_descuento LIMIT 1"); } 
    catch(\Throwable $e) { try { $pdo->exec("ALTER TABLE cupones_descuento ADD COLUMN $cName $cDef"); } catch(\Throwable $ex) {} }
}

$action = $_GET['action'] ?? $_POST['action'] ?? 'listar';

if ($_SERVER['REQUEST_METHOD'] === 'GET' || $action === 'listar') {
    try {
        $stmt = $pdo->prepare("SELECT id, nombre, codigo, porcentaje_descuento, fecha_creacion, fecha_expiracion, usos_maximos, usos_actuales, usado, activo, es_acumulable, cliente_nombre 
                               FROM cupones_descuento 
                               WHERE id_negocio = :id_negocio 
                               ORDER BY fecha_creacion DESC");
        $stmt->execute(['id_negocio' => $id_negocio]);
        $cupones = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode(['success' => true, 'cupones' => $cupones]);
    } catch (\Throwable $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Error al obtener cupones: ' . $e->getMessage()]);
    }
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
    $action = $input['action'] ?? $action;

    if ($action === 'crear') {
        $nombre = trim($input['nombre'] ?? '');
        $codigo = strtoupper(trim($input['codigo'] ?? ''));
        $porcentaje = (int)($input['porcentaje_descuento'] ?? 10);
        $fecha_expiracion = trim($input['fecha_expiracion'] ?? '');
        $usos_maximos = isset($input['usos_maximos']) && is_numeric($input['usos_maximos']) ? (int)$input['usos_maximos'] : 0;

        if (empty($codigo)) {
            $codigo = 'DESC' . rand(100, 999) . strtoupper(substr(md5(uniqid()), 0, 3));
        }

        if ($porcentaje < 1 || $porcentaje > 100) {
            echo json_encode(['success' => false, 'error' => 'El porcentaje de descuento debe estar entre 1 y 100%.']);
            exit;
        }

        if (empty($fecha_expiracion)) {
            // Default 30 días de validez si no se indica fecha máxima
            $fecha_expiracion = date('Y-m-d 23:59:59', strtotime('+30 days'));
        } else {
            // Asegurar fin del día si viene solo YYYY-MM-DD
            if (strlen($fecha_expiracion) === 10) {
                $fecha_expiracion .= ' 23:59:59';
            }
        }

        // Verificar si el código ya existe para este negocio
        $stmtCheck = $pdo->prepare("SELECT id FROM cupones_descuento WHERE id_negocio = :id_neg AND UPPER(codigo) = :cod LIMIT 1");
        $stmtCheck->execute(['id_neg' => $id_negocio, 'cod' => $codigo]);
        if ($stmtCheck->fetch()) {
            echo json_encode(['success' => false, 'error' => "Ya existe un cupón con el código '$codigo' en tu negocio."]);
            exit;
        }

        $es_acumulable = !empty($input['es_acumulable']) ? 1 : 0;

        try {
            $stmt = $pdo->prepare("INSERT INTO cupones_descuento 
                (id_negocio, nombre, codigo, porcentaje_descuento, fecha_expiracion, usos_maximos, usos_actuales, activo, es_acumulable) 
                VALUES (:id_neg, :nom, :cod, :pct, :exp, :max, 0, 1, :acum)");
            $stmt->execute([
                'id_neg' => $id_negocio,
                'nom' => $nombre ?: "Cupón $porcentaje% OFF",
                'cod' => $codigo,
                'pct' => $porcentaje,
                'exp' => $fecha_expiracion,
                'max' => $usos_maximos > 0 ? $usos_maximos : 0,
                'acum' => $es_acumulable
            ]);

            echo json_encode([
                'success' => true, 
                'id' => $pdo->lastInsertId(),
                'codigo' => $codigo,
                'message' => 'Cupón creado exitosamente'
            ]);
        } catch (\Throwable $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'Error al guardar el cupón: ' . $e->getMessage()]);
        }
        exit;
    }

    if ($action === 'toggle_activo') {
        $id = (int)($input['id'] ?? 0);
        $activo = (int)($input['activo'] ?? 1);

        try {
            $stmt = $pdo->prepare("UPDATE cupones_descuento SET activo = :act WHERE id = :id AND id_negocio = :id_neg");
            $stmt->execute(['act' => $activo, 'id' => $id, 'id_neg' => $id_negocio]);
            echo json_encode(['success' => true]);
        } catch (\Throwable $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'Error al cambiar estado: ' . $e->getMessage()]);
        }
        exit;
    }

    if ($action === 'eliminar') {
        $id = (int)($input['id'] ?? 0);

        try {
            $stmt = $pdo->prepare("DELETE FROM cupones_descuento WHERE id = :id AND id_negocio = :id_neg");
            $stmt->execute(['id' => $id, 'id_neg' => $id_negocio]);
            echo json_encode(['success' => true]);
        } catch (\Throwable $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'Error al eliminar cupón: ' . $e->getMessage()]);
        }
        exit;
    }
}

http_response_code(400);
echo json_encode(['success' => false, 'error' => 'Acción no válida']);

