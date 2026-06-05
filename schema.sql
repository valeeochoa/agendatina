-- Base de Datos para Agendatina
-- Puedes importar este archivo en phpMyAdmin o ejecutarlo en la consola de MySQL.

CREATE DATABASE IF NOT EXISTS `c2771918_tina` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `c2771918_tina`;

-- 1. Tabla de Usuarios
CREATE TABLE IF NOT EXISTS `usuarios` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `nombre_completo` VARCHAR(255) NOT NULL DEFAULT '',
  `username` VARCHAR(255) NULL,
  `email` VARCHAR(255) NOT NULL UNIQUE,
  `password` VARCHAR(255) NOT NULL,
  `role` VARCHAR(50) NOT NULL DEFAULT 'admin',
  `fecha_creacion` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Tabla de Negocios
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

-- 3. Tabla de Relación / Personal de Negocio
CREATE TABLE IF NOT EXISTS `personal_negocio` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `id_negocio` INT NOT NULL,
  `id_usuario` INT NOT NULL,
  `rol_en_local` VARCHAR(50) NOT NULL DEFAULT 'admin',
  FOREIGN KEY (`id_negocio`) REFERENCES `negocios` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`id_usuario`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Tabla de Servicios
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

-- 5. Tabla de Turnos
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
  FOREIGN KEY (`id_negocio`) REFERENCES `negocios` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`id_servicio`) REFERENCES `servicios` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6. Tabla de Configuración de Mini-Webs
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
  FOREIGN KEY (`id_negocio`) REFERENCES `negocios` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 7. Tabla de Días Bloqueados (Vacaciones/Feriados)
CREATE TABLE IF NOT EXISTS `dias_bloqueados` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `id_negocio` INT NOT NULL,
  `fecha` DATE NOT NULL,
  `profesional` VARCHAR(255) NOT NULL DEFAULT '',
  `motivo` VARCHAR(255) DEFAULT 'Bloqueado por admin',
  FOREIGN KEY (`id_negocio`) REFERENCES `negocios` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 8. Tabla de Notificaciones
CREATE TABLE IF NOT EXISTS `notificaciones` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `id_negocio` INT NULL,
  `titulo` VARCHAR(255) NOT NULL,
  `mensaje` TEXT NOT NULL,
  `fecha` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 9. Tabla de Notificaciones de Admin
CREATE TABLE IF NOT EXISTS `notificaciones_admin` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `segmento` VARCHAR(100) NOT NULL,
  `mensaje` TEXT NOT NULL,
  `id_negocio` INT NULL,
  `fecha` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `leida` BOOLEAN DEFAULT FALSE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 10. Tabla de Notas Internas de Administración
CREATE TABLE IF NOT EXISTS `admin_notas` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `id_negocio` INT NOT NULL UNIQUE,
  `nota` TEXT NOT NULL,
  `fecha_actualizacion` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 11. Tabla de Configuración Global de Precios
CREATE TABLE IF NOT EXISTS `configuracion_global` (
  `id` INT PRIMARY KEY DEFAULT 1,
  `precio_basico` DECIMAL(10,2) NOT NULL DEFAULT 13288.00,
  `precio_intermedio` DECIMAL(10,2) NOT NULL DEFAULT 20563.00,
  `precio_premium` DECIMAL(10,2) NOT NULL DEFAULT 28188.00,
  `descuento_porcentaje` INT NOT NULL DEFAULT 20,
  `descuento_hasta` DATETIME DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 12. Tabla de Intentos de Login (Rate Limiting)
CREATE TABLE IF NOT EXISTS `login_attempts` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `ip_address` VARCHAR(45) NOT NULL UNIQUE,
  `intentos` INT NOT NULL DEFAULT 1,
  `ultimo_intento` DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Inserción inicial de configuración global
INSERT IGNORE INTO `configuracion_global` (`id`, `precio_basico`, `precio_intermedio`, `precio_premium`, `descuento_porcentaje`, `descuento_hasta`) VALUES (1, 13288.00, 20563.00, 28188.00, 20, NULL);
