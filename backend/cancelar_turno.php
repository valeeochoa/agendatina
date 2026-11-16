<?php
// cancelar_turno.php - Mueve un turno a la papelera (estado = 'eliminado')
header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/conexion.php';

// Verificar sesión
if (!isset($_SESSION['id_negocio'])) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Acceso no autorizado. Inicia sesión.']);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método no permitido.']);
    exit;
}

$id = $_POST['id'] ?? '';
$id_negocio = $_SESSION['id_negocio'];

if (empty($id)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'ID no proporcionado.']);
    exit;
}

try {
    // Asegurar que la columna fecha_eliminado exista (auto-migración)
    try {
        $pdo->query("SELECT fecha_eliminado FROM turnos LIMIT 1");
    } catch (Exception $e) {
        $pdo->exec("ALTER TABLE turnos ADD COLUMN fecha_eliminado DATETIME DEFAULT NULL");
    }

    // Obtener datos del turno antes de moverlo a papelera para notificar lista de espera si corresponde
    $stmtInfo = $pdo->prepare("SELECT id_negocio, id_servicio, servicio, fecha, hora FROM turnos WHERE id = :id LIMIT 1");
    $stmtInfo->execute(['id' => $id]);
    $turnoInfo = $stmtInfo->fetch(PDO::FETCH_ASSOC);

    // Mover a papelera: estado = 'eliminado' + timestamp
    $stmt = $pdo->prepare(
        "UPDATE turnos SET estado = 'eliminado', fecha_eliminado = NOW() 
         WHERE id = :id AND id_negocio = :id_negocio"
    );
    $stmt->execute(['id' => $id, 'id_negocio' => $id_negocio]);

    if ($stmt->rowCount() > 0) {
        if ($turnoInfo) {
            try {
                require_once __DIR__ . '/helpers/cupo_waitlist_helper.php';
                notificarCupoLiberado($pdo, $turnoInfo['id_negocio'], $turnoInfo['id_servicio'] ?? 0, $turnoInfo['servicio'] ?? '', $turnoInfo['fecha'] ?? '', $turnoInfo['hora'] ?? '');
            } catch (\Throwable $eWait) {}
        }
        echo json_encode(['success' => true]);
    } else {
        // Si no actualiza por id_negocio, intentar sin él (compatibilidad con datos viejos)
        $stmtFallback = $pdo->prepare(
            "UPDATE turnos SET estado = 'eliminado', fecha_eliminado = NOW() WHERE id = :id"
        );
        $stmtFallback->execute(['id' => $id]);
        if ($stmtFallback->rowCount() > 0) {
            echo json_encode(['success' => true]);
        } else {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'No se encontró el turno con ID ' . intval($id) . '.']);
        }
    }
    exit;

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error de base de datos: ' . $e->getMessage()]);
    exit;
}