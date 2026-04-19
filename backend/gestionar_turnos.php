<?php
session_start();
header('Content-Type: application/json; charset=utf-8');

// Solo para admins
if (!isset($_SESSION['user_id']) || !isset($_SESSION['id_negocio'])) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Acceso no autorizado.']);
    exit;
}

$id_negocio = $_SESSION['id_negocio'];

// Solo POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método no permitido.']);
    exit;
}

require_once __DIR__ . '/conexion.php';

// =========================================================================
// Asegurar que la columna profesional exista dinámicamente (Migración)
// =========================================================================
try { $pdo->query("SELECT profesional FROM dias_bloqueados LIMIT 1"); } 
catch(Exception $e) { $pdo->exec("ALTER TABLE dias_bloqueados ADD COLUMN profesional VARCHAR(255) DEFAULT ''"); }

$fecha = $_POST['fecha'] ?? '';
$action = $_POST['action'] ?? '';
$profesional = $_POST['profesional'] ?? '';

$hora = $_POST['hora'] ?? '';
$servicio = $_POST['servicio'] ?? '';
$nombre = $_POST['nombre'] ?? '';
$apellido = $_POST['apellido'] ?? '';
$celular = $_POST['celular'] ?? '';

if (empty($fecha) || empty($action)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Faltan datos.']);
    exit;
}

try {
    if ($action === 'block_day') {
        // Comprobar si ya existe para evitar duplicados en la agenda
        $check = $pdo->prepare("SELECT id FROM dias_bloqueados WHERE id_negocio = :id_negocio AND fecha = :fecha AND profesional = :profesional");
        $check->execute(['id_negocio' => $id_negocio, 'fecha' => $fecha, 'profesional' => $profesional]);
        
        if (!$check->fetch()) {
            $stmt = $pdo->prepare("INSERT INTO dias_bloqueados (id_negocio, fecha, profesional, motivo) VALUES (:id_negocio, :fecha, :profesional, 'Bloqueado por admin')");
            $stmt->execute(['id_negocio' => $id_negocio, 'fecha' => $fecha, 'profesional' => $profesional]);
        }

    } elseif ($action === 'unblock_day') {
        // Quitar la fecha de la tabla
        $stmt = $pdo->prepare("DELETE FROM dias_bloqueados WHERE id_negocio = :id_negocio AND fecha = :fecha AND profesional = :profesional");
        $stmt->execute(['id_negocio' => $id_negocio, 'fecha' => $fecha, 'profesional' => $profesional]);

    } elseif ($action === 'add_manual') {
        $cliente_nombre = trim($nombre . ' ' . $apellido);
        
        // Encontrar el ID del servicio para que los calendarios puedan saber su duración
        $stmtServ = $pdo->prepare("SELECT id FROM servicios WHERE id_negocio = :id_negocio AND nombre_servicio = :servicio LIMIT 1");
        $stmtServ->execute(['id_negocio' => $id_negocio, 'servicio' => $servicio]);
        $servRow = $stmtServ->fetch();
        $id_servicio = $servRow ? $servRow['id'] : null;
        
        $stmt = $pdo->prepare("INSERT INTO turnos (id_negocio, cliente_nombre, cliente_celular, fecha, hora, servicio, profesional, id_servicio, estado) 
                               VALUES (:id_negocio, :cliente_nombre, :cliente_celular, :fecha, :hora, :servicio, :profesional, :id_servicio, 'confirmado')");
        $stmt->execute([
            'id_negocio' => $id_negocio, 'cliente_nombre' => $cliente_nombre, 'cliente_celular' => $celular,
            'fecha' => $fecha, 'hora' => $hora, 'servicio' => $servicio, 'profesional' => $profesional, 'id_servicio' => $id_servicio
        ]);
        
    } elseif ($action === 'block_time') {
        $stmt = $pdo->prepare("INSERT INTO turnos (id_negocio, cliente_nombre, cliente_celular, fecha, hora, servicio, profesional, estado) 
                               VALUES (:id_negocio, 'Horario Bloqueado', '-', :fecha, :hora, 'Bloqueo', :profesional, 'bloqueado')");
        $stmt->execute([
            'id_negocio' => $id_negocio, 'fecha' => $fecha, 'hora' => $hora, 'profesional' => $profesional
        ]);

    } else {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Acción no válida.']);
        exit;
    }
    echo json_encode(['success' => true]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error de base de datos: ' . $e->getMessage()]);
}
?>