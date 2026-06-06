<?php
require_once __DIR__ . '/backend/dotenv.php';
echo "DB_HOST: " . ($_ENV['DB_HOST'] ?? 'not set') . " (getenv: " . getenv('DB_HOST') . ")\n";
echo "DB_NAME: " . ($_ENV['DB_NAME'] ?? 'not set') . " (getenv: " . getenv('DB_NAME') . ")\n";
echo "DB_USER: " . ($_ENV['DB_USER'] ?? 'not set') . " (getenv: " . getenv('DB_USER') . ")\n";
echo "DB_PASS: " . ($_ENV['DB_PASS'] ?? 'not set') . " (getenv: " . getenv('DB_PASS') . ")\n";
echo "SERVER DB_USER: " . ($_SERVER['DB_USER'] ?? 'not set') . "\n";
?>
