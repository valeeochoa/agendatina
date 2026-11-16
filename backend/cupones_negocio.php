<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/conexion.php';

if (!isset($_SESSION['user_id']) || !isset($_SESSION['id_negocio'])) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Acceso no autorizado. Inicia sesión.']);
    exit;
}

$id_negocio = (int)$_SESSION['id_negocio'];
$userId = (int)$_SESSION['user_id'];

// Detectar rol y datos del usuario en la sesión o en personal_negocio
$userRole = $_SESSION['rol_en_local'] ?? 'admin';
$userNombre = $_SESSION['nombre_completo'] ?? '';

if (empty($userNombre) || !isset($_SESSION['rol_en_local'])) {
    try {
        $stmtPn = $pdo->prepare("SELECT nombre, rol_en_local FROM personal_negocio WHERE id_negocio = :nid AND id_usuario = :uid LIMIT 1");
        $stmtPn->execute(['nid' => $id_negocio, 'uid' => $userId]);
        $pnRow = $stmtPn->fetch(PDO::FETCH_ASSOC);
        if ($pnRow) {
            $userRole = $pnRow['rol_en_local'];
            if (!empty($pnRow['nombre'])) $userNombre = $pnRow['nombre'];
        }
    } catch (\Throwable $ePn) {}
}
$isProf = ($userRole === 'profesional');

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
    'profesional_asignado' => 'VARCHAR(255) DEFAULT NULL',
    'id_servicio' => 'INT DEFAULT NULL',
    'id_usuario_creador' => 'INT DEFAULT NULL',
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
        $sql = "SELECT c.id, c.nombre, c.codigo, c.porcentaje_descuento, c.fecha_creacion, c.fecha_expiracion, 
                       c.usos_maximos, c.usos_actuales, c.usado, c.activo, c.es_acumulable, c.cliente_nombre,
                       c.profesional_asignado, c.id_servicio, c.id_usuario_creador, s.nombre AS servicio_nombre 
                FROM cupones_descuento c
                LEFT JOIN servicios s ON c.id_servicio = s.id 
                WHERE c.id_negocio = :id_negocio";
        $params = ['id_negocio' => $id_negocio];

        if ($isProf) {
            $sql .= " AND (c.id_usuario_creador = :uid OR (c.profesional_asignado IS NOT NULL AND LOWER(TRIM(c.profesional_asignado)) = LOWER(TRIM(:mi_nombre))))";
            $params['uid'] = $userId;
            $params['mi_nombre'] = $userNombre;
        }

        $sql .= " ORDER BY c.fecha_creacion DESC";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $cupones = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode([
            'success' => true, 
            'cupones' => $cupones,
            'es_profesional' => $isProf,
            'mi_nombre' => $userNombre
        ]);
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

        // Determinar asignación de profesional y servicio
        $profesional_asignado = null;
        $id_servicio = null;

        if ($isProf) {
            $profesional_asignado = $userNombre;
            if (!empty($input['id_servicio']) && (int)$input['id_servicio'] > 0) {
                $id_servicio = (int)$input['id_servicio'];
                // Validar que el servicio pertenezca al negocio y a este profesional
                $stmtCheckSvc = $pdo->prepare("SELECT id FROM servicios WHERE id = :id AND id_negocio = :nid AND LOWER(TRIM(COALESCE(profesional, ''))) = LOWER(TRIM(:pname)) LIMIT 1");
                $stmtCheckSvc->execute(['id' => $id_servicio, 'nid' => $id_negocio, 'pname' => $userNombre]);
                if (!$stmtCheckSvc->fetch()) {
                    // Si no tiene profesional asignado explícito pero está en el negocio, verificar
                    $stmtCheckSvc2 = $pdo->prepare("SELECT id FROM servicios WHERE id = :id AND id_negocio = :nid LIMIT 1");
                    $stmtCheckSvc2->execute(['id' => $id_servicio, 'nid' => $id_negocio]);
                    if (!$stmtCheckSvc2->fetch()) {
                        echo json_encode(['success' => false, 'error' => 'El servicio seleccionado no es válido.']);
                        exit;
                    }
                }
            }
        } else {
            // Es admin del negocio
            if (!empty($input['profesional_asignado']) && trim($input['profesional_asignado']) !== 'todos') {
                $profesional_asignado = trim($input['profesional_asignado']);
            }
            if (!empty($input['id_servicio']) && (int)$input['id_servicio'] > 0) {
                $id_servicio = (int)$input['id_servicio'];
                $stmtCheckSvc = $pdo->prepare("SELECT id FROM servicios WHERE id = :id AND id_negocio = :nid LIMIT 1");
                $stmtCheckSvc->execute(['id' => $id_servicio, 'nid' => $id_negocio]);
                if (!$stmtCheckSvc->fetch()) {
                    echo json_encode(['success' => false, 'error' => 'El servicio seleccionado no es válido.']);
                    exit;
                }
            }
        }

        try {
            $stmt = $pdo->prepare("INSERT INTO cupones_descuento 
                (id_negocio, nombre, codigo, porcentaje_descuento, fecha_expiracion, usos_maximos, usos_actuales, activo, es_acumulable, profesional_asignado, id_servicio, id_usuario_creador) 
                VALUES (:id_neg, :nom, :cod, :pct, :exp, :max, 0, 1, :acum, :prof, :svc, :uid)");
            $stmt->execute([
                'id_neg' => $id_negocio,
                'nom' => $nombre ?: "Cupón $porcentaje% OFF",
                'cod' => $codigo,
                'pct' => $porcentaje,
                'exp' => $fecha_expiracion,
                'max' => $usos_maximos > 0 ? $usos_maximos : 0,
                'acum' => $es_acumulable,
                'prof' => $profesional_asignado,
                'svc' => $id_servicio,
                'uid' => $userId
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
            if ($isProf) {
                $stmtOwner = $pdo->prepare("SELECT id FROM cupones_descuento WHERE id = :id AND id_negocio = :id_neg AND (id_usuario_creador = :uid OR (profesional_asignado IS NOT NULL AND LOWER(TRIM(profesional_asignado)) = LOWER(TRIM(:mi_nombre)))) LIMIT 1");
                $stmtOwner->execute(['id' => $id, 'id_neg' => $id_negocio, 'uid' => $userId, 'mi_nombre' => $userNombre]);
                if (!$stmtOwner->fetch()) {
                    http_response_code(403);
                    echo json_encode(['success' => false, 'error' => 'No tienes permiso para modificar este cupón.']);
                    exit;
                }
            }

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
            if ($isProf) {
                $stmtOwner = $pdo->prepare("SELECT id FROM cupones_descuento WHERE id = :id AND id_negocio = :id_neg AND (id_usuario_creador = :uid OR (profesional_asignado IS NOT NULL AND LOWER(TRIM(profesional_asignado)) = LOWER(TRIM(:mi_nombre)))) LIMIT 1");
                $stmtOwner->execute(['id' => $id, 'id_neg' => $id_negocio, 'uid' => $userId, 'mi_nombre' => $userNombre]);
                if (!$stmtOwner->fetch()) {
                    http_response_code(403);
                    echo json_encode(['success' => false, 'error' => 'No tienes permiso para eliminar este cupón.']);
                    exit;
                }
            }

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

