<?php
session_start();
// Forzar siempre el entorno DEMO en esta ruta
$_SESSION['is_demo'] = true;
unset($_SESSION['user_id'], $_SESSION['id_negocio']);
require_once __DIR__ . '/backend/conexion.php';

try {
$emailDemo = 'demo@agendatina.site';
$stmt = $pdo->prepare("SELECT id FROM usuarios WHERE email = :email LIMIT 1");
$stmt->execute(['email' => $emailDemo]);
$user = $stmt->fetch();

// BARRERA DE PROTECCIÓN: Asegurar columnas antes de insertar datos de prueba
try { $pdo->query("SELECT descripcion FROM servicios LIMIT 1"); } catch(Exception $e) { $pdo->exec("ALTER TABLE servicios ADD COLUMN descripcion TEXT DEFAULT NULL"); }
try { $pdo->query("SELECT profesional FROM servicios LIMIT 1"); } catch(Exception $e) { $pdo->exec("ALTER TABLE servicios ADD COLUMN profesional VARCHAR(255) DEFAULT ''"); }
try { $pdo->query("SELECT profesional FROM turnos LIMIT 1"); } catch(Exception $e) { $pdo->exec("ALTER TABLE turnos ADD COLUMN profesional VARCHAR(255) DEFAULT 'Cualquiera (Sin preferencia)'"); }
try { $pdo->query("SELECT cliente_nombre FROM turnos LIMIT 1"); } catch(Exception $e) { $pdo->exec("ALTER TABLE turnos ADD COLUMN cliente_nombre VARCHAR(255) DEFAULT NULL"); }
try { $pdo->query("SELECT cliente_celular FROM turnos LIMIT 1"); } catch(Exception $e) { $pdo->exec("ALTER TABLE turnos ADD COLUMN cliente_celular VARCHAR(255) DEFAULT NULL"); }
try { $pdo->query("SELECT nombre FROM turnos LIMIT 1"); } catch(Exception $e) { $pdo->exec("ALTER TABLE turnos ADD COLUMN nombre VARCHAR(255) DEFAULT NULL"); }
try { $pdo->query("SELECT apellido FROM turnos LIMIT 1"); } catch(Exception $e) { $pdo->exec("ALTER TABLE turnos ADD COLUMN apellido VARCHAR(255) DEFAULT NULL"); }
try { $pdo->query("SELECT celular FROM turnos LIMIT 1"); } catch(Exception $e) { $pdo->exec("ALTER TABLE turnos ADD COLUMN celular VARCHAR(255) DEFAULT NULL"); }
try { $pdo->query("SELECT intervalo_turnos FROM configuracion_web LIMIT 1"); } catch(Exception $e) { $pdo->exec("ALTER TABLE configuracion_web ADD COLUMN intervalo_turnos VARCHAR(50) DEFAULT '30'"); }
try { $pdo->query("SELECT id_servicio FROM turnos LIMIT 1"); } catch(Exception $e) { $pdo->exec("ALTER TABLE turnos ADD COLUMN id_servicio INT DEFAULT NULL"); }
try { $pdo->query("SELECT nombre_completo FROM usuarios LIMIT 1"); } catch(Exception $e) { $pdo->exec("ALTER TABLE usuarios ADD COLUMN nombre_completo VARCHAR(255) DEFAULT ''"); }
try { $pdo->query("SELECT id FROM notificaciones LIMIT 1"); } catch(Exception $e) { $pdo->exec("CREATE TABLE notificaciones (id INT AUTO_INCREMENT PRIMARY KEY, id_negocio INT NULL, titulo VARCHAR(255), mensaje TEXT, fecha DATETIME DEFAULT CURRENT_TIMESTAMP)"); }
try { $pdo->query("SELECT turnos_simultaneos FROM configuracion_web LIMIT 1"); } catch(Exception $e) { $pdo->exec("ALTER TABLE configuracion_web ADD COLUMN turnos_simultaneos VARCHAR(10) DEFAULT 'no'"); }
try { $pdo->query("SELECT titulo FROM configuracion_web LIMIT 1"); } catch(Exception $e) { $pdo->exec("ALTER TABLE configuracion_web ADD COLUMN titulo VARCHAR(255) DEFAULT ''"); }
try { $pdo->query("SELECT subtitulo FROM configuracion_web LIMIT 1"); } catch(Exception $e) { $pdo->exec("ALTER TABLE configuracion_web ADD COLUMN subtitulo VARCHAR(255) DEFAULT ''"); }
try { $pdo->query("SELECT url_logo FROM configuracion_web LIMIT 1"); } catch(Exception $e) { $pdo->exec("ALTER TABLE configuracion_web ADD COLUMN url_logo VARCHAR(255) DEFAULT NULL"); }
try { $pdo->query("SELECT color_fondo FROM configuracion_web LIMIT 1"); } catch(Exception $e) { $pdo->exec("ALTER TABLE configuracion_web ADD COLUMN color_fondo VARCHAR(20) DEFAULT '#ffffff'"); }
try { $pdo->query("SELECT url_portada FROM configuracion_web LIMIT 1"); } catch(Exception $e) { $pdo->exec("ALTER TABLE configuracion_web ADD COLUMN url_portada VARCHAR(255) DEFAULT NULL"); }
try { $pdo->query("SELECT url_cursos FROM configuracion_web LIMIT 1"); } catch(Exception $e) { $pdo->exec("ALTER TABLE configuracion_web ADD COLUMN url_cursos VARCHAR(255) DEFAULT NULL"); }
try { $pdo->query("SELECT texto_cursos FROM configuracion_web LIMIT 1"); } catch(Exception $e) { $pdo->exec("ALTER TABLE configuracion_web ADD COLUMN texto_cursos TEXT DEFAULT NULL"); }
try { $pdo->query("SELECT url_certificados FROM configuracion_web LIMIT 1"); } catch(Exception $e) { $pdo->exec("ALTER TABLE configuracion_web ADD COLUMN url_certificados VARCHAR(255) DEFAULT NULL"); }
try { $pdo->query("SELECT cursos_json FROM configuracion_web LIMIT 1"); } catch(Exception $e) { $pdo->exec("ALTER TABLE configuracion_web ADD COLUMN cursos_json LONGTEXT DEFAULT NULL"); }
try { $pdo->query("SELECT profesionales_json FROM configuracion_web LIMIT 1"); } catch(Exception $e) { $pdo->exec("ALTER TABLE configuracion_web ADD COLUMN profesionales_json LONGTEXT DEFAULT NULL"); }
try { $pdo->query("SELECT tipo_calendario FROM configuracion_web LIMIT 1"); } catch(Exception $e) { $pdo->exec("ALTER TABLE configuracion_web ADD COLUMN tipo_calendario VARCHAR(20) DEFAULT 'clasico'"); }
try { $pdo->query("SELECT imagen1 FROM servicios LIMIT 1"); } catch(Exception $e) { $pdo->exec("ALTER TABLE servicios ADD COLUMN imagen1 VARCHAR(255) DEFAULT NULL"); }
try { $pdo->query("SELECT imagen2 FROM servicios LIMIT 1"); } catch(Exception $e) { $pdo->exec("ALTER TABLE servicios ADD COLUMN imagen2 VARCHAR(255) DEFAULT NULL"); }
try { $pdo->query("SELECT imagen3 FROM servicios LIMIT 1"); } catch(Exception $e) { $pdo->exec("ALTER TABLE servicios ADD COLUMN imagen3 VARCHAR(255) DEFAULT NULL"); }
try { $pdo->query("SELECT foto_profesional FROM servicios LIMIT 1"); } catch(Exception $e) { $pdo->exec("ALTER TABLE servicios ADD COLUMN foto_profesional VARCHAR(255) DEFAULT NULL"); }
try { $pdo->query("SELECT email_profesional FROM servicios LIMIT 1"); } catch(Exception $e) { $pdo->exec("ALTER TABLE servicios ADD COLUMN email_profesional VARCHAR(255) DEFAULT ''"); }
try { $pdo->query("SELECT orden FROM servicios LIMIT 1"); } catch(Exception $e) { $pdo->exec("ALTER TABLE servicios ADD COLUMN orden INT DEFAULT 0"); }
// NUEVAS BARRERAS (Evitan error 500 si la base es nueva)
try { $pdo->query("SELECT plan FROM negocios LIMIT 1"); } catch(Exception $e) { $pdo->exec("ALTER TABLE negocios ADD COLUMN plan VARCHAR(50) DEFAULT 'Basico'"); }
try { $pdo->query("SELECT estado_pago FROM negocios LIMIT 1"); } catch(Exception $e) { $pdo->exec("ALTER TABLE negocios ADD COLUMN estado_pago VARCHAR(50) DEFAULT 'prueba'"); }
try { $pdo->query("SELECT ruta FROM negocios LIMIT 1"); } catch(Exception $e) { $pdo->exec("ALTER TABLE negocios ADD COLUMN ruta VARCHAR(255) DEFAULT ''"); }
try { $pdo->query("SELECT max_profesionales FROM negocios LIMIT 1"); } catch(Exception $e) { $pdo->exec("ALTER TABLE negocios ADD COLUMN max_profesionales INT DEFAULT 1"); }
try { $pdo->query("SELECT ultimo_pago FROM negocios LIMIT 1"); } catch(Exception $e) { $pdo->exec("ALTER TABLE negocios ADD COLUMN ultimo_pago DATETIME DEFAULT NULL"); }
try { $pdo->query("SELECT comprobante FROM negocios LIMIT 1"); } catch(Exception $e) { $pdo->exec("ALTER TABLE negocios ADD COLUMN comprobante VARCHAR(255) DEFAULT NULL"); }
try { $pdo->query("SELECT role FROM usuarios LIMIT 1"); } catch(Exception $e) { $pdo->exec("ALTER TABLE usuarios ADD COLUMN role VARCHAR(50) DEFAULT 'admin'"); }
try { $pdo->query("SELECT fecha_creacion FROM usuarios LIMIT 1"); } catch(Exception $e) { $pdo->exec("ALTER TABLE usuarios ADD COLUMN fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP"); }

if (!$user) {
    // 1. Crear el usuario de muestra
    $hash = password_hash('demo1234', PASSWORD_DEFAULT);
    
    try { $pdo->query("SELECT username FROM usuarios LIMIT 1"); $has_username = true; } catch(Exception $e) { $has_username = false; }
    
    if ($has_username) {
        $pdo->prepare("INSERT INTO usuarios (nombre_completo, username, email, password, role, fecha_creacion) VALUES ('Agendatina DEMO', 'demo123', ?, ?, 'admin', NOW())")->execute([$emailDemo, $hash]);
    } else {
        $pdo->prepare("INSERT INTO usuarios (nombre_completo, email, password) VALUES ('Agendatina DEMO', ?, ?)")->execute([$emailDemo, $hash]);
    }
    $userId = $pdo->lastInsertId();

    // 2. Crear su propio negocio "Premium"
    $pdo->prepare("INSERT INTO negocios (nombre_fantasia, ruta, plan, max_profesionales, estado_pago) VALUES ('Estética Agendatina', 'demo', 'Completo', 5, 'activo')")->execute();
    $negocioId = $pdo->lastInsertId();

    // 3. Vincularlos
    $pdo->prepare("INSERT INTO personal_negocio (id_negocio, id_usuario, rol_en_local) VALUES (?, ?, 'admin')")->execute([$negocioId, $userId]);
} else {
    $userId = $user['id'];
    // Forzar vínculo al negocio DEMO correcto (ruta fija "demo")
    $stmtDemoBiz = $pdo->prepare("SELECT id FROM negocios WHERE ruta = 'demo' LIMIT 1");
    $stmtDemoBiz->execute();
    $demoBiz = $stmtDemoBiz->fetch();

    if ($demoBiz) {
        $negocioId = $demoBiz['id'];
    } else {
        $pdo->prepare("INSERT INTO negocios (nombre_fantasia, ruta, plan, max_profesionales, estado_pago) VALUES ('Estética Agendatina', 'demo', 'Completo', 5, 'activo')")->execute();
        $negocioId = $pdo->lastInsertId();
    }

    // Asegurar que el usuario demo esté vinculado al negocio demo
    $stmtLink = $pdo->prepare("SELECT id FROM personal_negocio WHERE id_negocio = ? AND id_usuario = ? LIMIT 1");
    $stmtLink->execute([$negocioId, $userId]);
    if (!$stmtLink->fetch()) {
        $pdo->prepare("INSERT INTO personal_negocio (id_negocio, id_usuario, rol_en_local) VALUES (?, ?, 'admin')")->execute([$negocioId, $userId]);
    }
}

// Blindaje: en cada acceso demo, normalizar identidad del negocio demo
$pdo->prepare("UPDATE negocios SET nombre_fantasia = 'Agendatina', ruta = 'demo', plan = 'Completo', max_profesionales = 5, estado_pago = 'activo', ultimo_pago = NOW() WHERE id = ?")->execute([$negocioId]);
$pdo->prepare("INSERT INTO configuracion_web (id_negocio, color_primario, color_secundario, mensaje_bienvenida, subtitulo, titulo)
               VALUES (?, '#ec135b', '#fce7f3', 'Agendatina', 'Sesión de demostración', 'Agendatina')
               ON DUPLICATE KEY UPDATE mensaje_bienvenida = 'Agendatina', subtitulo = 'Sesión de demostración', titulo = 'Agendatina'")->execute([$negocioId]);

// RESET AUTOMÁTICO CADA 10 MINUTOS
$resetFile = __DIR__ . '/demo_reset.txt';
$shouldReset = false;
$lastReset = @file_get_contents($resetFile);
if (!$lastReset || !is_numeric($lastReset) || (time() - intval($lastReset) > 600)) {
    $shouldReset = true;
}


if ($shouldReset && $negocioId) {
    // 1. Limpiar Base de Datos
    $pdo->prepare("DELETE FROM turnos WHERE id_negocio = ?")->execute([$negocioId]);
    $pdo->prepare("DELETE FROM servicios WHERE id_negocio = ?")->execute([$negocioId]);
    $pdo->prepare("DELETE FROM notificaciones WHERE id_negocio = ?")->execute([$negocioId]);
    $pdo->prepare("DELETE FROM dias_bloqueados WHERE id_negocio = ?")->execute([$negocioId]); // Resetear bloqueos
    
    // 2. Limpiar imágenes físicas subidas por el negocio Demo
    $uploadDir = __DIR__ . '/backend/uploads/';
    if (is_dir($uploadDir)) {
        // Busca cualquier archivo que contenga el ID del negocio en su nombre (ej: logo_15.jpg)
        $files = glob($uploadDir . '*_' . $negocioId . '.*');
        foreach ($files as $file) {
            if (is_file($file)) {
                @unlink($file); // Borra el archivo
            }
        }
    }

    // 3. Recrear Servicios por defecto
    $pdo->prepare("INSERT INTO servicios (id_negocio, nombre_servicio, duracion_minutos, precio, descripcion, profesional) VALUES 
        (?, 'Corte de Demostración', 30, 8000, 'Servicio de prueba para el plan Premium.', 'Valentina'),
        (?, 'Masaje Relajante', 60, 15000, 'Relajate con nuestros masajes de prueba.', 'Valentina')")->execute([$negocioId, $negocioId]);

    $stmtServ = $pdo->prepare("SELECT id FROM servicios WHERE id_negocio = ?");
    $stmtServ->execute([$negocioId]);
    $servs = $stmtServ->fetchAll();
    $idServ1 = $servs[0]['id'] ?? null;
    $idServ2 = $servs[1]['id'] ?? null;
    
    // 4. Recrear Turnos de prueba
    $hoy = date('Y-m-d');
    $manana = date('Y-m-d', strtotime('+1 day'));
    
    $pdo->prepare("INSERT INTO turnos (id_negocio, cliente_nombre, cliente_celular, fecha, hora, servicio, profesional, id_servicio, estado) VALUES 
        (?, 'María Gómez', '1123456789', ?, '10:00', 'Corte de Demostración', 'Valentina', ?, 'confirmado'),
        (?, 'Juan Pérez', '1198765432', ?, '15:00', 'Masaje Relajante', 'Valentina', ?, 'pendiente'),
        (?, 'Laura Díaz', '1166667777', ?, '09:00', 'Corte de Demostración', 'Valentina', ?, 'pendiente')")->execute([
            $negocioId, $hoy, $idServ1,
            $negocioId, $hoy, $idServ2,
            $negocioId, $manana, $idServ1
        ]);
        
    $pdo->prepare("INSERT INTO notificaciones (id_negocio, titulo, mensaje) VALUES 
        (?, '¡Bienvenido a Agendatina!', 'Prueba todas las funciones premium desde este panel de control interactivo.'),
        (?, 'Nuevas solicitudes', 'Tienes 2 turnos pendientes por confirmar. Revisa tu Agenda Virtual.')")->execute([$negocioId, $negocioId]);

   // 5. Restaurar Configuración Web a fábrica (Borrando TODAS las imágenes y JSONs)
$pdo->prepare("INSERT INTO configuracion_web (id_negocio, color_primario, color_secundario, mensaje_bienvenida, intervalo_turnos, tipo_calendario, titulo)
               VALUES (?, '#ec135b', '#fce7f3', 'Agendatina', '30', 'clasico', 'Agendatina')
               ON DUPLICATE KEY UPDATE 
               color_primario='#ec135b', 
               color_secundario='#fce7f3', 
               mensaje_bienvenida='Agendatina', 
               titulo='Agendatina', 
               tipo_calendario='clasico',
               url_logo=NULL, 
               url_portada=NULL,
               cursos_json=NULL, 
               profesionales_json=NULL,
               url_cursos=NULL,
               url_certificados=NULL")->execute([$negocioId]);
               
    @file_put_contents($resetFile, time());
}

$_SESSION['user_id'] = $userId;
$_SESSION['id_negocio'] = $negocioId;

// Imprimir HTML válido para que el navegador ejecute el JS limpiamente
echo "<!DOCTYPE html>\n<html>\n<head>\n<title>Redirigiendo a Demo...</title>\n</head>\n<body>\n";
echo "<script>\n";
echo "  sessionStorage.setItem('agendatina_session', 'active');\n";
echo "  sessionStorage.setItem('agendatina_demo_alert', 'true');\n";
echo "  window.location.replace('dashboard.html');\n";
echo "</script>\n";
echo "</body>\n</html>";
exit;

} catch (Exception $e) {
    echo "<!DOCTYPE html>\n<html>\n<head>\n<title>Error de Demo</title>\n</head>\n<body style='font-family: sans-serif; padding: 2rem; color: #ef4444;'>\n";
    echo "<h2>Ocurrió un error al preparar la Demostración:</h2>\n";
    echo "<p><b>" . htmlspecialchars($e->getMessage()) . "</b></p>\n";
    echo "</body>\n</html>";
    exit;
}
?>