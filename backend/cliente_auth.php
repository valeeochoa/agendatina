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
            estado ENUM('activo', 'pendiente_activacion', 'inactivo') DEFAULT 'pendiente_activacion',
            fecha_alta DATETIME DEFAULT CURRENT_TIMESTAMP,
            KEY (id_negocio),
            KEY (email)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ");
} catch(Exception $e) {}

$action = $_GET['action'] ?? $_POST['action'] ?? '';

try {
    // ---------------------------------------------------------
    // 1. Verificar Email de Cliente (Detección de Pre-Registro)
    // ---------------------------------------------------------
    if ($action === 'check_email') {
        $email = trim($_POST['email'] ?? $_GET['email'] ?? '');
        $rutaNegocio = trim($_POST['ruta'] ?? $_GET['ruta'] ?? '');

        if (empty($email)) {
            echo json_encode(['success' => false, 'error' => 'Email requerido.']);
            exit;
        }

        $stmt = $pdo->prepare("SELECT id, nombre_completo, password, pases_disponibles, estado FROM clientes_negocio WHERE email = :email LIMIT 1");
        $stmt->execute(['email' => $email]);
        $cliente = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$cliente) {
            // Verificar si tiene turnos registrados con ese email
            $stmtTurno = $pdo->prepare("SELECT cliente_nombre FROM turnos WHERE cliente_celular = :email OR cliente_nombre LIKE :email LIMIT 1");
            $stmtTurno->execute(['email' => '%' . $email . '%']);
            $turno = $stmtTurno->fetch();
            
            if ($turno) {
                echo json_encode([
                    'success' => true,
                    'exists' => true,
                    'has_password' => false,
                    'nombre' => $turno['cliente_nombre']
                ]);
                exit;
            }

            echo json_encode(['success' => true, 'exists' => false]);
            exit;
        }

        echo json_encode([
            'success' => true,
            'exists' => true,
            'has_password' => !empty($cliente['password']),
            'nombre' => $cliente['nombre_completo'],
            'pases' => (int)$cliente['pases_disponibles']
        ]);
        exit;
    }

    // ---------------------------------------------------------
    // 2. Establecer Contraseña por Primera Vez (Onboarding Cliente)
    // ---------------------------------------------------------
    if ($action === 'set_password') {
        $email = trim($_POST['email'] ?? '');
        $password = trim($_POST['password'] ?? '');
        $nombre = trim($_POST['nombre'] ?? '');

        if (empty($email) || strlen($password) < 6) {
            echo json_encode(['success' => false, 'error' => 'Ingresa una contraseña válida de al menos 6 caracteres.']);
            exit;
        }

        $hash = password_hash($password, PASSWORD_DEFAULT);

        $stmtCheck = $pdo->prepare("SELECT id FROM clientes_negocio WHERE email = :email LIMIT 1");
        $stmtCheck->execute(['email' => $email]);
        $cId = $stmtCheck->fetchColumn();

        if ($cId) {
            $stmtUp = $pdo->prepare("UPDATE clientes_negocio SET password = :hash, estado = 'activo' WHERE id = :id");
            $stmtUp->execute(['hash' => $hash, 'id' => $cId]);
        } else {
            $stmtIns = $pdo->prepare("INSERT INTO clientes_negocio (id_negocio, nombre_completo, email, password, estado) VALUES (1, :nombre, :email, :hash, 'activo')");
            $stmtIns->execute(['nombre' => !empty($nombre) ? $nombre : 'Alumno Registrado', 'email' => $email, 'hash' => $hash]);
            $cId = $pdo->lastInsertId();
        }

        $_SESSION['cliente_id'] = $cId;
        $_SESSION['cliente_email'] = $email;
        $_SESSION['cliente_nombre'] = $nombre;

        echo json_encode(['success' => true, 'message' => 'Contraseña configurada con éxito.']);
        exit;
    }

    // ---------------------------------------------------------
    // 3. Login de Cliente
    // ---------------------------------------------------------
    if ($action === 'login') {
        $email = trim($_POST['email'] ?? '');
        $password = trim($_POST['password'] ?? '');

        if (empty($email) || empty($password)) {
            echo json_encode(['success' => false, 'error' => 'Ingresa email y contraseña.']);
            exit;
        }

        $stmt = $pdo->prepare("SELECT id, nombre_completo, email, password, pases_disponibles FROM clientes_negocio WHERE email = :email LIMIT 1");
        $stmt->execute(['email' => $email]);
        $cliente = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$cliente || empty($cliente['password']) || !password_verify($password, $cliente['password'])) {
            echo json_encode(['success' => false, 'error' => 'Email o contraseña incorrectos.']);
            exit;
        }

        $_SESSION['cliente_id'] = $cliente['id'];
        $_SESSION['cliente_email'] = $cliente['email'];
        $_SESSION['cliente_nombre'] = $cliente['nombre_completo'];

        echo json_encode([
            'success' => true,
            'cliente' => [
                'id' => $cliente['id'],
                'nombre' => $cliente['nombre_completo'],
                'email' => $cliente['email'],
                'pases' => (int)$cliente['pases_disponibles']
            ]
        ]);
        exit;
    }

    // ---------------------------------------------------------
    // 4. Mis Clases y Reservas
    // ---------------------------------------------------------
    if ($action === 'mis_clases') {
        $email = $_SESSION['cliente_email'] ?? $_GET['email'] ?? '';

        if (empty($email)) {
            echo json_encode(['success' => false, 'error' => 'No autorizado.']);
            exit;
        }

        $stmt = $pdo->prepare("
            SELECT t.id, t.fecha, t.hora, t.servicio, t.profesional, t.estado, n.nombre_fantasia AS negocio
            FROM turnos t
            LEFT JOIN negocios n ON t.id_negocio = n.id
            WHERE t.cliente_celular = :email OR t.cliente_nombre LIKE :emailLike
            ORDER BY t.fecha DESC, t.hora DESC
        ");
        $stmt->execute(['email' => $email, 'emailLike' => '%' . $email . '%']);
        $clases = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode(['success' => true, 'data' => $clases]);
        exit;
    }

    echo json_encode(['success' => false, 'error' => 'Acción no válida.']);

} catch (PDOException $e) {
    echo json_encode(['success' => false, 'error' => 'Error en el servidor: ' . $e->getMessage()]);
}
?>
