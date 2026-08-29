<?php
session_start();
session_unset();
session_destroy();
if (isset($_COOKIE['agendatina_demo'])) {
    setcookie('agendatina_demo', '', time() - 3600, '/');
}
header('Content-Type: application/json; charset=utf-8');
echo json_encode(['success' => true]);
?>