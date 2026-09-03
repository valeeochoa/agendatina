<?php
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}
$_SESSION = array();
if (ini_get("session.use_cookies")) {
    $params = session_get_cookie_params();
    setcookie(session_name(), '', time() - 42000,
        $params["path"], $params["domain"],
        $params["secure"], $params["httponly"]
    );
}
session_unset();
session_destroy();

if (isset($_COOKIE['agendatina_demo'])) {
    setcookie('agendatina_demo', '', time() - 3600, '/');
}
header('Content-Type: application/json; charset=utf-8');
echo json_encode(['success' => true]);
?>