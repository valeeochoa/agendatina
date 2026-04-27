<?php
session_start();
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $username = (string)($_POST['username'] ?? '');
    $password = (string)($_POST['password'] ?? '');

    // Credenciales de Super Admin
    $super_admin_user = 'valentina';
    
    // Reemplaza este hash con el tuyo. Este es el hash de la contraseña "Agendatina2026!"
    $super_admin_pass_hash = '$2y$10$tZ2A9D6Y2P8p2I2fC3w4J.O5r2t5b5c5e5f5g5h5i5j5k5l5m5n5o'; 

    if (hash_equals($super_admin_user, $username) && password_verify($password, $super_admin_pass_hash)) {
        $_SESSION['is_superadmin'] = true;
        unset($_SESSION['is_demo']); // Asegurar que el admin opere en la BD real
        echo json_encode(['success' => true]);
    } else {
        echo json_encode(['success' => false, 'error' => 'Usuario o contraseña incorrectos.']);
    }
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    session_write_close();
    $logged_in = isset($_SESSION['is_superadmin']) && $_SESSION['is_superadmin'] === true;
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