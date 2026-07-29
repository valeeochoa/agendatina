<?php
// Script de Migración de Base de Datos - Agendatina
// Puedes ejecutar este archivo desde la consola con `php backend/migrar.php` o desde el navegador.

header('Content-Type: text/plain; charset=utf-8');

require_once __DIR__ . '/conexion.php';

echo "=== INICIANDO MIGRACIÓN DE BASE DE DATOS ===\n\n";

$tablas = [
    "usuarios" => "
        CREATE TABLE IF NOT EXISTS `usuarios` (
          `id` INT AUTO_INCREMENT PRIMARY KEY,
          `nombre_completo` VARCHAR(255) NOT NULL DEFAULT '',
          `username` VARCHAR(255) NULL,
          `email` VARCHAR(255) NOT NULL UNIQUE,
          `password` VARCHAR(255) NOT NULL,
          `role` VARCHAR(50) NOT NULL DEFAULT 'admin',
          `reset_token` VARCHAR(255) DEFAULT NULL,
          `reset_token_expire` DATETIME DEFAULT NULL,
          `fecha_creacion` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ",
    "negocios" => "
        CREATE TABLE IF NOT EXISTS `negocios` (
          `id` INT AUTO_INCREMENT PRIMARY KEY,
          `nombre_fantasia` VARCHAR(255) NOT NULL DEFAULT '',
          `ruta` VARCHAR(255) NOT NULL UNIQUE,
          `plan` VARCHAR(50) NOT NULL DEFAULT 'Basico',
          `max_profesionales` INT NOT NULL DEFAULT 1,
          `estado_pago` VARCHAR(50) NOT NULL DEFAULT 'prueba',
          `fecha_alta` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          `ultimo_pago` DATETIME DEFAULT NULL,
          `comprobante` VARCHAR(255) DEFAULT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ",
    "personal_negocio" => "
        CREATE TABLE IF NOT EXISTS `personal_negocio` (
          `id` INT AUTO_INCREMENT PRIMARY KEY,
          `id_negocio` INT NOT NULL,
          `id_usuario` INT NOT NULL,
          `rol_en_local` VARCHAR(50) NOT NULL DEFAULT 'admin',
          FOREIGN KEY (`id_negocio`) REFERENCES `negocios` (`id`) ON DELETE CASCADE,
          FOREIGN KEY (`id_usuario`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ",
    "servicios" => "
        CREATE TABLE IF NOT EXISTS `servicios` (
          `id` INT AUTO_INCREMENT PRIMARY KEY,
          `id_negocio` INT NOT NULL,
          `nombre_servicio` VARCHAR(255) NOT NULL,
          `duracion_minutos` INT NOT NULL DEFAULT 30,
          `precio` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
          `descripcion` TEXT DEFAULT NULL,
          `profesional` VARCHAR(255) NOT NULL DEFAULT '',
          `imagen1` VARCHAR(255) DEFAULT NULL,
          `imagen2` VARCHAR(255) DEFAULT NULL,
          `imagen3` VARCHAR(255) DEFAULT NULL,
          `foto_profesional` VARCHAR(255) DEFAULT NULL,
          `email_profesional` VARCHAR(255) NOT NULL DEFAULT '',
          `orden` INT NOT NULL DEFAULT 0,
          FOREIGN KEY (`id_negocio`) REFERENCES `negocios` (`id`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ",
    "turnos" => "
        CREATE TABLE IF NOT EXISTS `turnos` (
          `id` INT AUTO_INCREMENT PRIMARY KEY,
          `id_negocio` INT NOT NULL,
          `cliente_nombre` VARCHAR(255) DEFAULT NULL,
          `cliente_celular` VARCHAR(255) DEFAULT NULL,
          `fecha` DATE NOT NULL,
          `hora` TIME NOT NULL,
          `servicio` VARCHAR(255) NOT NULL,
          `profesional` VARCHAR(255) NOT NULL DEFAULT 'Cualquiera (Sin preferencia)',
          `id_servicio` INT DEFAULT NULL,
          `estado` VARCHAR(50) NOT NULL DEFAULT 'pendiente',
          `metodo_pago` VARCHAR(100) DEFAULT NULL,
          `nombre` VARCHAR(255) DEFAULT NULL,
          `apellido` VARCHAR(255) DEFAULT NULL,
          `celular` VARCHAR(255) DEFAULT NULL,
          `notas` TEXT DEFAULT NULL,
          FOREIGN KEY (`id_negocio`) REFERENCES `negocios` (`id`) ON DELETE CASCADE,
          FOREIGN KEY (`id_servicio`) REFERENCES `servicios` (`id`) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ",
    "configuracion_web" => "
        CREATE TABLE IF NOT EXISTS `configuracion_web` (
          `id_negocio` INT PRIMARY KEY,
          `color_primario` VARCHAR(20) NOT NULL DEFAULT '#D11149',
          `color_secundario` VARCHAR(20) NOT NULL DEFAULT '#FC8712',
          `color_primario_web` VARCHAR(20) NOT NULL DEFAULT '#D11149',
          `color_secundario_web` VARCHAR(20) NOT NULL DEFAULT '#FC8712',
          `color_fondo` VARCHAR(20) NOT NULL DEFAULT '#ffffff',
          `url_logo` VARCHAR(255) DEFAULT NULL,
          `fondo` VARCHAR(255) DEFAULT NULL,
          `mensaje_bienvenida` VARCHAR(255) NOT NULL DEFAULT '',
          `subtitulo` VARCHAR(255) NOT NULL DEFAULT '',
          `whatsapp_contacto` VARCHAR(50) NOT NULL DEFAULT '',
          `instagram_url` VARCHAR(255) NOT NULL DEFAULT '',
          `hora_apertura` VARCHAR(5) NOT NULL DEFAULT '09:00',
          `hora_cierre` VARCHAR(5) NOT NULL DEFAULT '18:00',
          `intervalo_turnos` INT NOT NULL DEFAULT 30,
          `turnos_simultaneos` VARCHAR(10) NOT NULL DEFAULT 'no',
          `confirmacion_automatica` VARCHAR(10) NOT NULL DEFAULT 'no',
          `anticipacion_turno_min` INT NOT NULL DEFAULT 0,
          `alineacion_servicios` VARCHAR(20) NOT NULL DEFAULT 'left',
          `tipo_calendario` VARCHAR(20) NOT NULL DEFAULT 'clasico',
          `texto_local` TEXT DEFAULT NULL,
          `ubicacion_maps` TEXT DEFAULT NULL,
          `cursos_html` LONGTEXT DEFAULT NULL,
          `cursos_json` LONGTEXT DEFAULT NULL,
          `profesionales_json` LONGTEXT DEFAULT NULL,
          `hora_descanso_inicio` VARCHAR(5) NOT NULL DEFAULT '',
          `hora_descanso_fin` VARCHAR(5) NOT NULL DEFAULT '',
          `dias_trabajo` VARCHAR(50) NOT NULL DEFAULT '1,2,3,4,5,6',
          `metodos_pago` VARCHAR(255) NOT NULL DEFAULT '',
          `limite_eliminacion_dias` INT DEFAULT 0,
          FOREIGN KEY (`id_negocio`) REFERENCES `negocios` (`id`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ",
    "dias_bloqueados" => "
        CREATE TABLE IF NOT EXISTS `dias_bloqueados` (
          `id` INT AUTO_INCREMENT PRIMARY KEY,
          `id_negocio` INT NOT NULL,
          `fecha` DATE NOT NULL,
          `profesional` VARCHAR(255) NOT NULL DEFAULT '',
          `motivo` VARCHAR(255) DEFAULT 'Bloqueado por admin',
          FOREIGN KEY (`id_negocio`) REFERENCES `negocios` (`id`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ",
    "notificaciones" => "
        CREATE TABLE IF NOT EXISTS `notificaciones` (
          `id` INT AUTO_INCREMENT PRIMARY KEY,
          `id_negocio` INT NULL,
          `titulo` VARCHAR(255) NOT NULL,
          `mensaje` TEXT NOT NULL,
          `fecha` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ",
    "notificaciones_admin" => "
        CREATE TABLE IF NOT EXISTS `notificaciones_admin` (
          `id` INT AUTO_INCREMENT PRIMARY KEY,
          `segmento` VARCHAR(100) NOT NULL,
          `mensaje` TEXT NOT NULL,
          `id_negocio` INT NULL,
          `fecha` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          `leida` BOOLEAN DEFAULT FALSE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ",
    "admin_notas" => "
        CREATE TABLE IF NOT EXISTS `admin_notas` (
          `id` INT AUTO_INCREMENT PRIMARY KEY,
          `id_negocio` INT NOT NULL UNIQUE,
          `nota` TEXT NOT NULL,
          `fecha_actualizacion` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ",
    "configuracion_global" => "
        CREATE TABLE IF NOT EXISTS `configuracion_global` (
          `id` INT PRIMARY KEY DEFAULT 1,
          `precio_basico` DECIMAL(10,2) NOT NULL DEFAULT 8889.00,
          `precio_intermedio` DECIMAL(10,2) NOT NULL DEFAULT 11111.00,
          `precio_premium` DECIMAL(10,2) NOT NULL DEFAULT 16667.00,
          `descuento_porcentaje` INT NOT NULL DEFAULT 10,
          `descuento_hasta` DATETIME DEFAULT NULL,
          `dias_prueba_defecto` INT NOT NULL DEFAULT 30
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ",
    "login_attempts" => "
        CREATE TABLE IF NOT EXISTS `login_attempts` (
          `id` INT AUTO_INCREMENT PRIMARY KEY,
          `ip_address` VARCHAR(45) NOT NULL UNIQUE,
          `intentos` INT NOT NULL DEFAULT 1,
          `ultimo_intento` DATETIME NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ",
    "comprobantes_pago" => "
        CREATE TABLE IF NOT EXISTS `comprobantes_pago` (
          `id` INT AUTO_INCREMENT PRIMARY KEY,
          `id_negocio` INT NOT NULL,
          `monto` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
          `plan` VARCHAR(100) DEFAULT NULL,
          `archivo_path` VARCHAR(255) NOT NULL,
          `nombre_archivo` VARCHAR(255) NOT NULL,
          `fecha_pago` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          `estado` VARCHAR(50) DEFAULT 'aprobado',
          `notas` TEXT DEFAULT NULL,
          FOREIGN KEY (`id_negocio`) REFERENCES `negocios` (`id`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    "
];

foreach ($tablas as $nombre => $sql) {
    try {
        $pdo->exec($sql);
        echo "[OK] Tabla '{$nombre}' verificada/creada correctamente.\n";
    } catch (PDOException $e) {
        echo "[ERROR] Error al crear la tabla '{$nombre}': " . $e->getMessage() . "\n";
    }
}

// Auto-migraciones de columnas faltantes
try { $pdo->exec("ALTER TABLE configuracion_global ADD COLUMN dias_prueba_defecto INT NOT NULL DEFAULT 30"); } catch(Exception $e) {}

// Inserciones por defecto
try {
    $pdo->exec("INSERT IGNORE INTO `configuracion_global` (`id`, `precio_basico`, `precio_intermedio`, `precio_premium`, `descuento_porcentaje`, `descuento_hasta`, `dias_prueba_defecto`) VALUES (1, 8889.00, 11111.00, 16667.00, 10, NULL, 30)");
    echo "[OK] Configuración global de precios inicializada.\n";
} catch (PDOException $e) {
    echo "[ERROR] Error al inicializar configuración global: " . $e->getMessage() . "\n";
}

// Migraciones de columnas
$columnMigrations = [
    // Agrega fecha_eliminado a turnos si no existe
    "ALTER TABLE `turnos` ADD COLUMN `fecha_eliminado` DATETIME DEFAULT NULL",
    "ALTER TABLE `usuarios` ADD COLUMN `reset_token` VARCHAR(255) DEFAULT NULL",
    "ALTER TABLE `usuarios` ADD COLUMN `reset_token_expire` DATETIME DEFAULT NULL",
];

foreach ($columnMigrations as $alterSql) {
    try {
        $pdo->exec($alterSql);
        echo "[OK] Columna agregada: {$alterSql}\n";
    } catch (PDOException $e) {
        // Error 1060 = columna ya existe -> es normal, ignorar
        if ($e->getCode() == '42S21' || strpos($e->getMessage(), 'Duplicate column') !== false) {
            echo "[SKIP] Columna ya existia (OK).\n";
        } else {
            echo "[ERROR] " . $e->getMessage() . "\n";
        }
    }
}

echo "\n=== MIGRACIÓN FINALIZADA CON ÉXITO ===\n";
?>
