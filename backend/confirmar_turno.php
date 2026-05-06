<?php
header('Content-Type: application/json; charset=utf-8');

// Aquí deberías añadir una comprobación de sesión de admin
// session_start();
// if (!isset($_SESSION['user_id']) || $_SESSION['role'] !== 'admin') { ... }

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $id = $_POST['id'] ?? '';

    if (empty($id)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'ID no proporcionado']);
        exit;
    }

    require_once __DIR__ . '/conexion.php';

    try {
        // Actualizamos el estado de la solicitud a 'confirmado'
        $stmt = $pdo->prepare("UPDATE turnos SET estado = 'confirmado' WHERE id = :id");
        $stmt->execute(['id' => $id]);

        if ($stmt->rowCount() > 0) {
            $stmtT = $pdo->prepare("SELECT cliente_nombre, nombre, apellido, cliente_celular, celular, fecha, hora, servicio FROM turnos WHERE id = :id");
            $stmtT->execute(['id' => $id]);
            $turno = $stmtT->fetch(PDO::FETCH_ASSOC);
            $nombreC = $turno['cliente_nombre'] ?: trim($turno['nombre'] . ' ' . $turno['apellido']);
            $celularC = $turno['cliente_celular'] ?: $turno['celular'];
            echo json_encode(['success' => true, 'turno' => ['nombre' => $nombreC, 'celular' => $celularC, 'fecha' => $turno['fecha'], 'hora' => $turno['hora'], 'servicio' => $turno['servicio']]]);
        } else {
            // Esto puede pasar si el ID no existe
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'No se encontró una solicitud con ese ID.']);
        }
        exit;

    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Error de base de datos al confirmar: ' . $e->getMessage()]);
        exit;
    }
}
http_response_code(405);
echo json_encode(['success' => false, 'error' => 'Método no permitido.']);
?>