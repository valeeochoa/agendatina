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
            estado ENUM('activo', 'pendiente_activacion', 'inactivo') DEFAULT 'pendiente_activacion',
            fecha_alta DATETIME DEFAULT CURRENT_TIMESTAMP,
            KEY (id_negocio),
            KEY (email)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ");
} catch(Exception $e) {}

// Asegurar existencia de columnas por si la tabla fue creada previamente con esquema reducido
try { $pdo->query("SELECT pases_totales FROM clientes_negocio LIMIT 1"); } 
catch(Exception $e) { $pdo->exec("ALTER TABLE clientes_negocio ADD COLUMN pases_totales INT DEFAULT 0"); }

try { $pdo->query("SELECT fecha_vencimiento FROM clientes_negocio LIMIT 1"); } 
catch(Exception $e) { $pdo->exec("ALTER TABLE clientes_negocio ADD COLUMN fecha_vencimiento DATE DEFAULT NULL"); }

try { $pdo->query("SELECT notas FROM clientes_negocio LIMIT 1"); } 
catch(Exception $e) { $pdo->exec("ALTER TABLE clientes_negocio ADD COLUMN notas TEXT DEFAULT NULL"); }

$action = $_GET['action'] ?? $_POST['action'] ?? '';

try {
    // ---------------------------------------------------------
    // 1. Verificar Email de Cliente (Detección de Pre-Registro)
    // ---------------------------------------------------------
    if ($action === 'check_email') {
        $email = strtolower(trim($_POST['email'] ?? $_GET['email'] ?? ''));

        if (empty($email)) {
            echo json_encode(['success' => false, 'error' => 'Ingresá un correo electrónico válido.']);
            exit;
        }

        // Buscar en clientes_negocio (alumnos asignados por establecimientos)
        $stmt = $pdo->prepare("SELECT id, nombre_completo, password, pases_disponibles, estado FROM clientes_negocio WHERE LOWER(TRIM(email)) = :email LIMIT 1");
        $stmt->execute(['email' => $email]);
        $cliente = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$cliente) {
            // Verificar si tiene turnos registrados con ese email en la tabla turnos
            $stmtTurno = $pdo->prepare("SELECT cliente_nombre FROM turnos WHERE LOWER(TRIM(cliente_celular)) = :email OR LOWER(cliente_nombre) LIKE :emailLike LIMIT 1");
            $stmtTurno->execute(['email' => $email, 'emailLike' => '%' . $email . '%']);
            $turno = $stmtTurno->fetch(PDO::FETCH_ASSOC);
            
            if ($turno) {
                echo json_encode([
                    'success' => true,
                    'exists' => true,
                    'has_password' => false,
                    'nombre' => $turno['cliente_nombre']
                ]);
                exit;
            }

            echo json_encode([
                'success' => true, 
                'exists' => false,
                'message' => 'No encontramos tu correo electrónico en nuestra lista de alumnos. Por favor solicitale a tu profesor o establecimiento que te agregue a sus clases para habilitar tu acceso.'
            ]);
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
        $email = strtolower(trim($_POST['email'] ?? ''));
        $password = trim($_POST['password'] ?? '');
        $nombre = trim($_POST['nombre'] ?? '');

        if (empty($email) || strlen($password) < 6) {
            echo json_encode(['success' => false, 'error' => 'Ingresá una contraseña válida de al menos 6 caracteres.']);
            exit;
        }

        $hash = password_hash($password, PASSWORD_DEFAULT);

        $stmtCheck = $pdo->prepare("SELECT id, nombre_completo FROM clientes_negocio WHERE LOWER(TRIM(email)) = :email LIMIT 1");
        $stmtCheck->execute(['email' => $email]);
        $c = $stmtCheck->fetch(PDO::FETCH_ASSOC);

        if ($c) {
            $stmtUp = $pdo->prepare("UPDATE clientes_negocio SET password = :hash, estado = 'activo' WHERE id = :id");
            $stmtUp->execute(['hash' => $hash, 'id' => $c['id']]);
            $cId = $c['id'];
            if (empty($nombre)) $nombre = $c['nombre_completo'];
        } else {
            $stmtIns = $pdo->prepare("INSERT INTO clientes_negocio (id_negocio, nombre_completo, email, password, estado) VALUES (1, :nombre, :email, :hash, 'activo')");
            $stmtIns->execute(['nombre' => !empty($nombre) ? $nombre : 'Alumno Registrado', 'email' => $email, 'hash' => $hash]);
            $cId = $pdo->lastInsertId();
        }

        $_SESSION['cliente_id'] = $cId;
        $_SESSION['cliente_email'] = $email;
        $_SESSION['cliente_nombre'] = $nombre;

        echo json_encode([
            'success' => true, 
            'message' => 'Contraseña configurada con éxito.',
            'cliente' => [
                'id' => $cId,
                'nombre' => $nombre,
                'email' => $email
            ]
        ]);
        exit;
    }

    // ---------------------------------------------------------
    // 3. Login de Cliente
    // ---------------------------------------------------------
    if ($action === 'login') {
        $email = strtolower(trim($_POST['email'] ?? ''));
        $password = trim($_POST['password'] ?? '');

        if (empty($email) || empty($password)) {
            echo json_encode(['success' => false, 'error' => 'Ingresá email y contraseña.']);
            exit;
        }

        $stmt = $pdo->prepare("SELECT id, nombre_completo, email, password, pases_disponibles FROM clientes_negocio WHERE LOWER(TRIM(email)) = :email LIMIT 1");
        $stmt->execute(['email' => $email]);
        $cliente = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$cliente || empty($cliente['password']) || !password_verify($password, $cliente['password'])) {
            echo json_encode(['success' => false, 'error' => 'Contraseña incorrecta o correo no registrado.']);
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
    // Rutina de Depuración Mensual (Cuentas inactivas por > 6 meses)
    // ---------------------------------------------------------
    try {
        $pdo->exec("
            DELETE FROM clientes_negocio 
            WHERE fecha_alta < DATE_SUB(NOW(), INTERVAL 6 MONTH)
              AND email NOT IN (
                  SELECT DISTINCT cliente_celular FROM turnos WHERE cliente_celular IS NOT NULL AND fecha >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
              )
        ");
    } catch(Exception $exPurge) {}

    // ---------------------------------------------------------
    // 4. Mis Clases y Reservas (Discriminadas por Negocio)
    // ---------------------------------------------------------
    if ($action === 'mis_clases') {
        $email = strtolower(trim($_SESSION['cliente_email'] ?? $_GET['email'] ?? ''));

        if (empty($email)) {
            echo json_encode(['success' => false, 'error' => 'No autorizado.']);
            exit;
        }

        // Obtener la información de los negocios donde el alumno está registrado
        $stmtNegocios = $pdo->prepare("
            SELECT cn.id_negocio, n.nombre_fantasia AS negocio_nombre, cn.pases_disponibles, COALESCE(cn.pases_totales, cn.pases_disponibles) AS pases_totales, cn.fecha_vencimiento
            FROM clientes_negocio cn
            JOIN negocios n ON cn.id_negocio = n.id
            WHERE LOWER(TRIM(cn.email)) = :email
        ");
        $stmtNegocios->execute(['email' => $email]);
        $negociosAsociados = $stmtNegocios->fetchAll(PDO::FETCH_ASSOC);

        // Obtener el historial completo de clases y turnos
        $stmt = $pdo->prepare("
            SELECT t.id, t.id_negocio, COALESCE(n.nombre_fantasia, 'Establecimiento') AS negocio, t.servicio, t.profesional, t.fecha, t.hora, t.estado
            FROM turnos t
            LEFT JOIN negocios n ON t.id_negocio = n.id
            WHERE LOWER(TRIM(t.cliente_celular)) = :email OR LOWER(t.cliente_nombre) LIKE :emailLike
            ORDER BY t.fecha DESC, t.hora DESC
        ");
        $stmt->execute(['email' => $email, 'emailLike' => '%' . $email . '%']);
        $clases = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode([
            'success' => true, 
            'data' => $clases,
            'negocios' => $negociosAsociados
        ]);
        exit;
    }

    echo json_encode(['success' => false, 'error' => 'Acción no válida.']);

} catch (PDOException $e) {
    echo json_encode(['success' => false, 'error' => 'Error en el servidor: ' . $e->getMessage()]);
}
?>
