<?php
require_once __DIR__ . '/backend/dotenv.php';

function mask($str) {
    if (empty($str)) return 'empty/not set';
    return substr($str, 0, 2) . '...' . substr($str, -1);
}

echo "--- ENV VARIABLES DEBUG ---\n";
echo "DB_HOST: " . ($_ENV['DB_HOST'] ?? 'not set') . " | getenv: " . (getenv('DB_HOST') ?: 'not set') . "\n";
echo "DB_NAME: " . ($_ENV['DB_NAME'] ?? 'not set') . " | getenv: " . (getenv('DB_NAME') ?: 'not set') . "\n";
echo "DB_USER: " . ($_ENV['DB_USER'] ?? 'not set') . " | getenv: " . (getenv('DB_USER') ?: 'not set') . "\n";
echo "DB_PASS: " . mask($_ENV['DB_PASS'] ?? '') . "\n";
echo "DB_DEMO_USER: " . ($_ENV['DB_DEMO_USER'] ?? 'not set') . " | getenv: " . (getenv('DB_DEMO_USER') ?: 'not set') . "\n";
echo "DB_DEMO_PASS: " . mask($_ENV['DB_DEMO_PASS'] ?? '') . "\n";
echo "\n--- FILE CONTENT OF .env ---\n";
$envPath = __DIR__ . '/.env';
if (file_exists($envPath)) {
    $lines = file($envPath);
    foreach ($lines as $line) {
        if (trim($line) === '' || strpos(trim($line), '#') === 0) {
            echo $line;
            continue;
        }
        $parts = explode('=', $line, 2);
        if (count($parts) === 2) {
            $key = trim($parts[0]);
            $val = trim($parts[1]);
            echo "$key=" . (strpos($key, 'PASS') !== false ? mask($val) : $val) . "\n";
        } else {
            echo $line;
        }
    }
} else {
    echo ".env file NOT FOUND at $envPath\n";
}
?>
