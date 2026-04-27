<?php
session_start();
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/conexion.php';

if (!isset($_SESSION['id_negocio']) || !isset($_SESSION['rol_en_local']) || $_SESSION['rol_en_local'] !== 'admin') {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Acceso denegado. Solo el administrador del negocio puede crear o eliminar cuentas de profesionales.']);
    exit;
}

$id_negocio = $_SESSION['id_negocio'];
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    try {
        // Obtener la lista de profesionales creados
        $stmt = $pdo->prepare("
            SELECT u.id, u.nombre_completo, u.email 
            FROM usuarios u
            JOIN personal_negocio pn ON u.id = pn.id_usuario
            WHERE pn.id_negocio = :id_negocio AND pn.rol_en_local = 'profesional'
        ");
        $stmt->execute(['id_negocio' => $id_negocio]);
        $profesionales = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Obtener el límite dictado por el plan (SuperAdmin)
        $stmtLimit = $pdo->prepare("SELECT max_profesionales FROM negocios WHERE id = :id");
        $stmtLimit->execute(['id' => $id_negocio]);
        $max_profesionales = $stmtLimit->fetchColumn() ?: 1;

        echo json_encode(['success' => true, 'data' => $profesionales, 'limite' => $max_profesionales]);
    } catch (Exception $e) {
        echo json_encode(['success' => false, 'error' => 'Error al cargar el equipo.']);
    }
} elseif ($method === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true) ?: $_POST;
    
    $nombre = trim($data['nombre'] ?? '');
    $email = filter_var(trim($data['email'] ?? ''), FILTER_SANITIZE_EMAIL);
    $password = trim($data['password'] ?? '');

    if (!$nombre || !$email || !$password) {
        echo json_encode(['success' => false, 'error' => 'Por favor completa todos los campos (Nombre, Email y Contraseña).']);
        exit;
    }

    try {
        $pdo->beginTransaction();

        // Validar límite
        $stmtLimit = $pdo->prepare("SELECT max_profesionales FROM negocios WHERE id = :id FOR UPDATE");
        $stmtLimit->execute(['id' => $id_negocio]);
        $max_profesionales = $stmtLimit->fetchColumn() ?: 1;

        $stmtCount = $pdo->prepare("SELECT COUNT(*) FROM personal_negocio WHERE id_negocio = :id AND rol_en_local = 'profesional'");
        $stmtCount->execute(['id' => $id_negocio]);
        $current_count = $stmtCount->fetchColumn();

        if ($current_count >= $max_profesionales) {
            throw new Exception("Has alcanzado el límite máximo de $max_profesionales profesionales. Si necesitas más cuentas, contacta a soporte para ampliar tu plan.");
        }

        // Verificar email duplicado en el sistema
        $stmtCheck = $pdo->prepare("SELECT id FROM usuarios WHERE email = :email");
        $stmtCheck->execute(['email' => $email]);
        if ($stmtCheck->fetch()) {
            throw new Exception("El correo '$email' ya se encuentra registrado. Utiliza un correo corporativo o distinto.");
        }

        // Crear usuario y darle rol de profesional
        $hash = password_hash($password, PASSWORD_DEFAULT);
        $stmtUser = $pdo->prepare("INSERT INTO usuarios (nombre_completo, email, password) VALUES (?, ?, ?)");
        $stmtUser->execute([$nombre, $email, $hash]);
        $id_usuario = $pdo->lastInsertId();

        $stmtPn = $pdo->prepare("INSERT INTO personal_negocio (id_negocio, id_usuario, rol_en_local) VALUES (?, ?, 'profesional')");
        $stmtPn->execute([$id_negocio, $id_usuario]);

        $pdo->commit();
        echo json_encode(['success' => true]);
    } catch (Exception $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
} elseif ($method === 'DELETE') {
    $id_usuario = $_GET['id'] ?? null;
    if (!$id_usuario) { echo json_encode(['success' => false, 'error' => 'Falta el ID del profesional.']); exit; }

    try {
        $pdo->beginTransaction();
        $stmtCheck = $pdo->prepare("SELECT id FROM personal_negocio WHERE id_negocio = ? AND id_usuario = ? AND rol_en_local = 'profesional'");
        $stmtCheck->execute([$id_negocio, $id_usuario]);
        if ($stmtCheck->fetch()) {
            $pdo->prepare("DELETE FROM personal_negocio WHERE id_usuario = ?")->execute([$id_usuario]);
            $pdo->prepare("DELETE FROM usuarios WHERE id = ?")->execute([$id_usuario]);
            $pdo->commit();
            echo json_encode(['success' => true]);
        } else {
            throw new Exception("Profesional no encontrado o no pertenece a tu negocio.");
        }
    } catch (Exception $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
}
?>