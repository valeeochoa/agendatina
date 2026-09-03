<?php
session_start();
header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/conexion.php';

// Auto-crear tabla de clientes_negocio si no existe
try {
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS clientes_negocio (
            id INT AUTO_INCREMENT PRIMARY KEY,
            id_negocio INT NOT NULL,
            nombre_completo VARCHAR(255) NOT NULL,
            email VARCHAR(255) NOT NULL,
            telefono VARCHAR(50) DEFAULT '',
            password VARCHAR(255) DEFAULT NULL,
            pases_disponibles INT DEFAULT 0,
            pases_totales INT DEFAULT 0,
            fecha_vencimiento DATE DEFAULT NULL,
            notas TEXT DEFAULT NULL,
            estado ENUM('activo', 'pendiente_activacion', 'inactivo') DEFAULT 'activo',
            fecha_alta DATETIME DEFAULT CURRENT_TIMESTAMP,
            KEY (id_negocio),
            KEY (email)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ");
} catch(Exception $e) {}

// Asegurar existencia de nuevas columnas por si la tabla ya existía anteriormente
try { $pdo->query("SELECT pases_totales FROM clientes_negocio LIMIT 1"); } 
catch(Exception $e) { $pdo->exec("ALTER TABLE clientes_negocio ADD COLUMN pases_totales INT DEFAULT 0"); }

try { $pdo->query("SELECT fecha_vencimiento FROM clientes_negocio LIMIT 1"); } 
catch(Exception $e) { $pdo->exec("ALTER TABLE clientes_negocio ADD COLUMN fecha_vencimiento DATE DEFAULT NULL"); }

try { $pdo->query("SELECT notas FROM clientes_negocio LIMIT 1"); } 
catch(Exception $e) { $pdo->exec("ALTER TABLE clientes_negocio ADD COLUMN notas TEXT DEFAULT NULL"); }


if (!isset($_SESSION['id_negocio'])) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'No autorizado. Inicia sesión.']);
    exit;
}

$id_negocio = $_SESSION['id_negocio'];
$method = $_SERVER['REQUEST_METHOD'];

try {
    // ---------------------------------------------------------
    // OBTENER LISTADO DE ALUMNOS (GET)
    // ---------------------------------------------------------
    if ($method === 'GET') {
        session_write_close();

        $stmt = $pdo->prepare("
            SELECT c.id, c.nombre_completo, c.email, c.telefono, c.pases_disponibles, c.pases_totales, c.fecha_vencimiento, c.notas, c.estado, c.fecha_alta,
                   (SELECT COUNT(*) FROM turnos t WHERE t.id_negocio = c.id_negocio AND (t.cliente_celular = c.email OR t.cliente_nombre = c.nombre_completo) AND t.estado IN ('pendiente', 'confirmado')) AS clases_reservadas
            FROM clientes_negocio c
            WHERE c.id_negocio = :id_negocio
            ORDER BY c.id DESC
        ");
        $stmt->execute(['id_negocio' => $id_negocio]);
        $clientes = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Calcular estado automático según vencimiento o pases
        $today = date('Y-m-d');
        foreach ($clientes as &$c) {
            $c['pases_disponibles'] = (int)$c['pases_disponibles'];
            $c['pases_totales'] = (int)$c['pases_totales'];
            $c['clases_reservadas'] = (int)$c['clases_reservadas'];

            if (!empty($c['fecha_vencimiento']) && $c['fecha_vencimiento'] < $today) {
                $c['estado_calculado'] = 'vencido';
            } else if ($c['pases_disponibles'] <= 0) {
                $c['estado_calculado'] = 'sin_pases';
            } else {
                $c['estado_calculado'] = 'activo';
            }
        }

        echo json_encode(['success' => true, 'data' => $clientes]);
        exit;
    }

    // ---------------------------------------------------------
    // CREAR O EDITAR ALUMNO (POST)
    // ---------------------------------------------------------
    if ($method === 'POST') {
        $contentType = isset($_SERVER["CONTENT_TYPE"]) ? trim($_SERVER["CONTENT_TYPE"]) : '';
        if (strpos($contentType, 'application/json') !== false) {
            $data = json_decode(file_get_contents('php://input'), true);
        } else {
            $data = $_POST;
        }

        $id = !empty($data['id']) ? (int)$data['id'] : null;
        $action = $data['action'] ?? '';

        // Acción especial: Cargar más pases / créditos rápidamente
        if ($action === 'add_pases' && $id) {
            $cantAdd = (int)($data['cantidad'] ?? 0);
            $stmtAdd = $pdo->prepare("UPDATE clientes_negocio SET pases_disponibles = pases_disponibles + :add, pases_totales = pases_totales + :add WHERE id = :id AND id_negocio = :id_negocio");
            $stmtAdd->execute(['add' => $cantAdd, 'id' => $id, 'id_negocio' => $id_negocio]);
            echo json_encode(['success' => true, 'message' => 'Clases agregadas con éxito.']);
            exit;
        }

        $nombre = trim($data['nombre_completo'] ?? $data['nombre'] ?? '');
        $email = trim($data['email'] ?? '');
        $telefono = trim($data['telefono'] ?? '');
        $pases = max(0, (int)($data['pases_disponibles'] ?? $data['pases'] ?? 0));
        $pases_totales = max($pases, (int)($data['pases_totales'] ?? $pases));
        $fecha_vencimiento = !empty($data['fecha_vencimiento']) ? $data['fecha_vencimiento'] : null;
        $notas = trim($data['notas'] ?? '');

        if (empty($nombre) || empty($email)) {
            echo json_encode(['success' => false, 'error' => 'El nombre y correo electrónico son obligatorios.']);
            exit;
        }

        if ($id) {
            // Actualizar
            $stmt = $pdo->prepare("
                UPDATE clientes_negocio 
                SET nombre_completo = :nombre, email = :email, telefono = :telefono, pases_disponibles = :pases, pases_totales = :pases_totales, fecha_vencimiento = :venc, notas = :notas 
                WHERE id = :id AND id_negocio = :id_negocio
            ");
            $stmt->execute([
                'nombre' => $nombre,
                'email' => $email,
                'telefono' => $telefono,
                'pases' => $pases,
                'pases_totales' => $pases_totales,
                'venc' => $fecha_vencimiento,
                'notas' => $notas,
                'id' => $id,
                'id_negocio' => $id_negocio
            ]);
        } else {
            // Verificar si el email ya existe en este negocio
            $stmtCheck = $pdo->prepare("SELECT id FROM clientes_negocio WHERE id_negocio = :id_negocio AND email = :email LIMIT 1");
            $stmtCheck->execute(['id_negocio' => $id_negocio, 'email' => $email]);
            if ($stmtCheck->fetch()) {
                echo json_encode(['success' => false, 'error' => 'Ya existe un alumno registrado con ese mismo correo electrónico.']);
                exit;
            }

            $stmt = $pdo->prepare("
                INSERT INTO clientes_negocio (id_negocio, nombre_completo, email, telefono, pases_disponibles, pases_totales, fecha_vencimiento, notas, estado)
                VALUES (:id_negocio, :nombre, :email, :telefono, :pases, :pases_totales, :venc, :notas, 'pendiente_activacion')
            ");
            $stmt->execute([
                'id_negocio' => $id_negocio,
                'nombre' => $nombre,
                'email' => $email,
                'telefono' => $telefono,
                'pases' => $pases,
                'pases_totales' => $pases_totales,
                'venc' => $fecha_vencimiento,
                'notas' => $notas
            ]);
        }

        echo json_encode(['success' => true]);
        exit;
    }

    // ---------------------------------------------------------
    // ELIMINAR ALUMNO (DELETE)
    // ---------------------------------------------------------
    if ($method === 'DELETE') {
        parse_str(file_get_contents('php://input'), $deleteVars);
        $id = (int)($deleteVars['id'] ?? $_GET['id'] ?? 0);

        if (!$id) {
            echo json_encode(['success' => false, 'error' => 'ID no proporcionado.']);
            exit;
        }

        $stmt = $pdo->prepare("DELETE FROM clientes_negocio WHERE id = :id AND id_negocio = :id_negocio");
        $stmt->execute(['id' => $id, 'id_negocio' => $id_negocio]);

        echo json_encode(['success' => true]);
        exit;
    }

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error en la base de datos: ' . $e->getMessage()]);
}
?>
