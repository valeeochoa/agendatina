<?php
// Script de inicialización de Base de Datos Local (Soporta Normal y Sandbox Demo)
$host = 'localhost';
$username = 'root';
$password = '';
$dbnames = ['c2771918_tina', 'c2771918_tina_d'];

foreach ($dbnames as $dbname) {
    try {
        // 1. Conectar a MySQL sin base de datos para crearla
        $pdo = new PDO("mysql:host=$host;charset=utf8mb4", $username, $password);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $pdo->exec("CREATE DATABASE IF NOT EXISTS `$dbname` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
        echo "Base de datos '$dbname' creada o ya existente.\n";
        
        // 2. Conectar a la base de datos
        $pdo = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8mb4", $username, $password);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        
        // 3. Leer e importar schema.sql
        $schema = file_get_contents(__DIR__ . '/schema.sql');
        // Remover comentarios que comiencen con --
        $schema = preg_replace('/^\s*--.*$/m', '', $schema);
        // Dividir consultas por punto y coma
        $queries = array_filter(array_map('trim', explode(';', $schema)));
        
        foreach ($queries as $q) {
            if (!empty($q)) {
                $pdo->exec($q);
            }
        }
        echo "Estructura de tablas importada de schema.sql para '$dbname'.\n";
        
        // 4. Limpiar datos viejos de prueba para comenzar limpio
        $pdo->exec("SET FOREIGN_KEY_CHECKS = 0");
        $pdo->exec("TRUNCATE TABLE turnos");
        $pdo->exec("TRUNCATE TABLE servicios");
        $pdo->exec("TRUNCATE TABLE configuracion_web");
        $pdo->exec("TRUNCATE TABLE personal_negocio");
        $pdo->exec("TRUNCATE TABLE negocios");
        $pdo->exec("TRUNCATE TABLE usuarios");
        $pdo->exec("SET FOREIGN_KEY_CHECKS = 1");
        echo "Tablas limpiadas para '$dbname'.\n";
        
        // 5. Crear Usuario Demo (password: demo123)
        $passHash = password_hash('demo123', PASSWORD_DEFAULT);
        $stmt = $pdo->prepare("INSERT INTO usuarios (nombre_completo, email, password, role) VALUES (?, ?, ?, ?)");
        $stmt->execute(['Usuario Demo', 'demo@agendatina.site', $passHash, 'admin']);
        $userId = $pdo->lastInsertId();
        echo "Usuario 'demo@agendatina.site' creado en '$dbname'.\n";
        
        // 6. Crear Negocio Demo
        $stmt = $pdo->prepare("INSERT INTO negocios (nombre_fantasia, ruta, plan, max_profesionales, estado_pago) VALUES (?, ?, ?, ?, ?)");
        $stmt->execute(['Salón de Belleza Demo', 'demo', 'Premium', 5, 'prueba']);
        $negocioId = $pdo->lastInsertId();
        echo "Negocio 'demo' creado en '$dbname'.\n";
        
        // 7. Vincular usuario a negocio
        $stmt = $pdo->prepare("INSERT INTO personal_negocio (id_negocio, id_usuario, rol_en_local) VALUES (?, ?, ?)");
        $stmt->execute([$negocioId, $userId, 'admin']);
        
        // 8. Crear Configuración Web
        $stmt = $pdo->prepare("INSERT INTO configuracion_web (id_negocio, color_primario, color_secundario, whatsapp_contacto) VALUES (?, ?, ?, ?)");
        $stmt->execute([$negocioId, '#D11149', '#FC8712', '123456789']);
        echo "Configuración web creada en '$dbname'.\n";
        
        // 9. Crear Servicios
        $servicios = [
            ['Corte de Cabello Caballero', 30, 1500.00, 'Corte clásico y moderno', 'Juan Pérez'],
            ['Manicura Completa', 45, 2000.00, 'Cuidado de uñas y esmaltado', 'Ana Gómez'],
            ['Masaje Relajante', 60, 3500.00, 'Masaje descontracturante', 'Juan Pérez'],
        ];
        $stmt = $pdo->prepare("INSERT INTO servicios (id_negocio, nombre_servicio, duracion_minutos, precio, descripcion, profesional) VALUES (?, ?, ?, ?, ?, ?)");
        $serviceIds = [];
        foreach ($servicios as $s) {
            $stmt->execute([$negocioId, $s[0], $s[1], $s[2], $s[3], $s[4]]);
            $serviceIds[$s[0]] = $pdo->lastInsertId();
        }
        echo "Servicios creados en '$dbname'.\n";
        
        // 10. Crear Turnos (Futuros y Pasados, pendientes y confirmados)
        $hoy = date('Y-m-d');
        $manana = date('Y-m-d', strtotime('+1 day'));
        $ayer = date('Y-m-d', strtotime('-1 day'));
        
        $turnos = [
            // Pendientes (hoy y mañana)
            [$hoy, '10:00:00', 'Corte de Cabello Caballero', 'Juan Pérez', 'pendiente', 'Carlos López', '555123456'],
            [$manana, '14:30:00', 'Manicura Completa', 'Ana Gómez', 'pendiente', 'María Rodríguez', '555987654'],
            
            // Confirmados (futuro)
            [$manana, '11:00:00', 'Masaje Relajante', 'Juan Pérez', 'confirmado', 'Jorge Martínez', '555111222'],
            
            // Historial (pasados)
            [$ayer, '09:00:00', 'Corte de Cabello Caballero', 'Juan Pérez', 'confirmado', 'Luis Gomez', '555333444'],
            [$ayer, '16:00:00', 'Manicura Completa', 'Ana Gómez', 'confirmado', 'Sofía Pérez', '555666777'],
            
            // Eliminados (papelera)
            [$hoy, '17:00:00', 'Masaje Relajante', 'Juan Pérez', 'cancelado', 'Pedro Ramírez', '555888999']
        ];
        
        $stmt = $pdo->prepare("INSERT INTO turnos (id_negocio, fecha, hora, servicio, profesional, estado, cliente_nombre, cliente_celular, id_servicio) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
        foreach ($turnos as $t) {
            $idServicio = isset($serviceIds[$t[2]]) ? $serviceIds[$t[2]] : null;
            $stmt->execute([$negocioId, $t[0], $t[1], $t[2], $t[3], $t[4], $t[5], $t[6], $idServicio]);
        }
        echo "Turnos creados en '$dbname'.\n";
        echo "¡Inicialización para '$dbname' completa exitosamente!\n\n";
        
    } catch (PDOException $e) {
        echo "Error PDO para '$dbname': " . $e->getMessage() . "\n\n";
    }
}
?>
