<?php
session_start();
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $username = (string)($_POST['username'] ?? '');
    $password = (string)($_POST['password'] ?? '');

    // 1. Cargar variables de entorno
    require_once __DIR__ . '/dotenv.php';

    // Credenciales de Super Admin
    $super_admin_user = $_ENV['SUPERADMIN_USER'] ?? 'valentina';
    $super_admin_pass = $_ENV['SUPERADMIN_PASS'] ?? 'valentina123';

    if ($super_admin_user === $username && $password === $super_admin_pass) {
        $_SESSION['is_superadmin'] = true;
        $_SESSION['admin_logged_in'] = true;
        $_SESSION['superadmin_last_activity'] = time();
        unset($_SESSION['is_demo']); // Asegurar que el admin opere en la BD real
        echo json_encode(['success' => true]);
    } else {
        echo json_encode(['success' => false, 'error' => 'Usuario o contraseña incorrectos.']);
    }
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $logged_in = false;
    if (isset($_SESSION['is_superadmin']) && $_SESSION['is_superadmin'] === true) {
        $last_activity = $_SESSION['superadmin_last_activity'] ?? 0;
        if (time() - $last_activity > 900) { // Expiración por inactividad de 15 minutos (900 segundos)
            unset($_SESSION['is_superadmin']);
            unset($_SESSION['superadmin_last_activity']);
            session_destroy();
            $logged_in = false;
        } else {
            $_SESSION['superadmin_last_activity'] = time(); // Actualizar actividad
            $logged_in = true;
        }
    }
    session_write_close();
    echo json_encode(['success' => true, 'logged_in' => $logged_in]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
    unset($_SESSION['is_superadmin']);
    session_destroy();
    echo json_encode(['success' => true]);
    exit;
}
?>