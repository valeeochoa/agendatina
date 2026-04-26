<?php
// =========================================================================
// ADVERTENCIA DE SEGURIDAD: 
// Este archivo permite el registro público de nuevos usuarios y negocios.
// Si tu plataforma es privada (solo el SuperAdmin crea cuentas), debes 
// eliminar este archivo o protegerlo con contraseña. Si es público (SaaS), 
// se recomienda encarecidamente añadir validación reCAPTCHA.
// =========================================================================

session_start();
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método no permitido.']);
    exit;
}

require_once __DIR__ . '/conexion.php';

// Forzar modo de excepciones para asegurar que el RollBack funcione si algo falla
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

$data = json_decode(file_get_contents('php://input'), true);
if (!$data) $data = $_POST;

$nombre_completo = trim($data['nombre_completo'] ?? '');
$email = filter_var(trim($data['email'] ?? ''), FILTER_SANITIZE_EMAIL);
$password = trim($data['password'] ?? '');
$nombre_fantasia = trim($data['nombre_negocio'] ?? $data['nombre_fantasia'] ?? '');
$ruta = preg_replace('/[^a-zA-Z0-9-]/', '', strtolower(trim($data['ruta'] ?? '')));

if (!$nombre_completo || !$email || !$password || !$nombre_fantasia || !$ruta) {
    echo json_encode(['success' => false, 'error' => 'Por favor completa todos los campos obligatorios.']);
    exit;
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    echo json_encode(['success' => false, 'error' => 'El formato del correo electrónico no es válido.']);
    exit;
}

if (strlen($password) < 6) {
    echo json_encode(['success' => false, 'error' => 'La contraseña debe tener al menos 6 caracteres.']);
    exit;
}

try {
    $pdo->beginTransaction();

    // 1. Verificar que el email no exista previamente
    $stmtCheckEmail = $pdo->prepare("SELECT id FROM usuarios WHERE email = :email LIMIT 1");
    $stmtCheckEmail->execute(['email' => $email]);
    if ($stmtCheckEmail->fetch()) {
        throw new Exception("El email '$email' ya está registrado.");
    }

    // 2. Verificar que la ruta del negocio (URL) no esté en uso
    $stmtCheckRuta = $pdo->prepare("SELECT id FROM negocios WHERE ruta = :ruta LIMIT 1");
    $stmtCheckRuta->execute(['ruta' => $ruta]);
    if ($stmtCheckRuta->fetch()) {
        throw new Exception("El enlace '$ruta' ya está en uso por otro negocio. Por favor, elige otro.");
    }

    // 3. Crear el Usuario
    $stmtUser = $pdo->prepare("INSERT INTO usuarios (nombre_completo, email, password) VALUES (:nombre, :email, :password)");
    $stmtUser->execute(['nombre' => $nombre_completo, 'email' => $email, 'password' => password_hash($password, PASSWORD_DEFAULT)]);
    $id_usuario = $pdo->lastInsertId();

    // 4. Crear el Negocio (Plan Básico, en Prueba de 15 días)
    $stmtNegocio = $pdo->prepare("INSERT INTO negocios (nombre_fantasia, ruta, plan, estado_pago) VALUES (:fantasia, :ruta, 'Basico', 'prueba')");
    $stmtNegocio->execute(['fantasia' => $nombre_fantasia, 'ruta' => $ruta]);
    $id_negocio = $pdo->lastInsertId();

    // 5. Vincular al Usuario como Administrador de ese Negocio
    $stmtVinculo = $pdo->prepare("INSERT INTO personal_negocio (id_negocio, id_usuario, rol_en_local) VALUES (:id_negocio, :id_usuario, 'admin')");
    $stmtVinculo->execute(['id_negocio' => $id_negocio, 'id_usuario' => $id_usuario]);

    // Si todo salió bien, guardamos los cambios definitivamente
    $pdo->commit();

    echo json_encode(['success' => true, 'message' => 'Cuenta y negocio creados exitosamente.']);

} catch (Exception $e) {
    // Si ocurre cualquier error en los 5 pasos, deshacemos todo para no dejar datos huérfanos
    if ($pdo->inTransaction()) { $pdo->rollBack(); }
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>