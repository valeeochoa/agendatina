<?php
// Cargador de variables de entorno ligero (.env)

function cargarEnv($path) {
    if (!file_exists($path)) {
        return;
    }

    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        // Ignorar comentarios
        if (strpos(trim($line), '#') === 0) {
            continue;
        }

        // Dividir por el primer signo igual
        $parts = explode('=', $line, 2);
        if (count($parts) === 2) {
            $key = trim($parts[0]);
            $val = trim($parts[1]);

            // Quitar comillas si existen
            $val = trim($val, '"\'');

            putenv("{$key}={$val}");
            $_ENV[$key] = $val;
            $_SERVER[$key] = $val;
        }
    }
}

// Cargar automáticamente buscando en varios niveles posibles
cargarEnv(dirname(__DIR__) . '/.env'); // Directorio actual del proyecto (ej: /public_html/pruebas/.env)
if (!isset($_ENV['DB_NAME'])) {
    cargarEnv(__DIR__ . '/.env'); // En carpeta backend/
}
if (!isset($_ENV['DB_NAME'])) {
    cargarEnv(dirname(dirname(__DIR__)) . '/.env'); // En carpeta raíz superior (ej: /public_html/.env)
}
if (!isset($_ENV['DB_NAME']) && isset($_SERVER['DOCUMENT_ROOT'])) {
    cargarEnv($_SERVER['DOCUMENT_ROOT'] . '/.env'); // En la raíz del servidor web
}
?>
