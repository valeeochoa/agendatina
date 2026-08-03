<?php
session_start();
// Forzar siempre el entorno DEMO en esta ruta
$_SESSION['is_demo'] = true;
unset($_SESSION['user_id'], $_SESSION['id_negocio']);
require_once __DIR__ . '/backend/conexion.php';

try {
// Usar únicamente la cuenta canonical única para la demo sin multiplicar registros
$emailDemo = 'demo@agendatina.site';
$rutaDemo = 'demo';

// Limpiar cuentas dinámicas obsoletas (demo_xxxx@agendatina.site)
try {
    $pdo->exec("DELETE FROM usuarios WHERE email LIKE 'demo_%@agendatina.site' AND email != 'demo@agendatina.site'");
} catch (Exception $eClean) {}

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
try { $pdo->query("SELECT metodos_pago FROM configuracion_web LIMIT 1"); } catch(Exception $e) { $pdo->exec("ALTER TABLE configuracion_web ADD COLUMN metodos_pago VARCHAR(255) DEFAULT ''"); }
try { $pdo->query("SELECT metodo_pago FROM turnos LIMIT 1"); } catch(Exception $e) { $pdo->exec("ALTER TABLE turnos ADD COLUMN metodo_pago VARCHAR(100) DEFAULT NULL"); }
try { $pdo->query("SELECT url_logo FROM configuracion_web LIMIT 1"); } catch(Exception $e) { $pdo->exec("ALTER TABLE configuracion_web ADD COLUMN url_logo VARCHAR(255) DEFAULT NULL"); }
try { $pdo->query("SELECT color_fondo FROM configuracion_web LIMIT 1"); } catch(Exception $e) { $pdo->exec("ALTER TABLE configuracion_web ADD COLUMN color_fondo VARCHAR(20) DEFAULT '#ffffff'"); }
try { $pdo->query("SELECT url_portada FROM configuracion_web LIMIT 1"); } catch(Exception $e) { $pdo->exec("ALTER TABLE configuracion_web ADD COLUMN url_portada VARCHAR(255) DEFAULT NULL"); }
try { $pdo->query("SELECT url_cursos FROM configuracion_web LIMIT 1"); } catch(Exception $e) { $pdo->exec("ALTER TABLE configuracion_web ADD COLUMN url_cursos VARCHAR(255) DEFAULT NULL"); }
try { $pdo->query("SELECT texto_cursos FROM configuracion_web LIMIT 1"); } catch(Exception $e) { $pdo->exec("ALTER TABLE configuracion_web ADD COLUMN texto_cursos TEXT DEFAULT NULL"); }
try { $pdo->query("SELECT url_certificados FROM configuracion_web LIMIT 1"); } catch(Exception $e) { $pdo->exec("ALTER TABLE configuracion_web ADD COLUMN url_certificados VARCHAR(255) DEFAULT NULL"); }
try { $pdo->query("SELECT cursos_json FROM configuracion_web LIMIT 1"); } catch(Exception $e) { $pdo->exec("ALTER TABLE configuracion_web ADD COLUMN cursos_json LONGTEXT DEFAULT NULL"); }
try { $pdo->query("SELECT profesionales_json FROM configuracion_web LIMIT 1"); } catch(Exception $e) { $pdo->exec("ALTER TABLE configuracion_web ADD COLUMN profesionales_json LONGTEXT DEFAULT NULL"); }
try { $pdo->query("SELECT tipo_calendario FROM configuracion_web LIMIT 1"); } catch(Exception $e) { $pdo->exec("ALTER TABLE configuracion_web ADD COLUMN tipo_calendario VARCHAR(20) DEFAULT 'clasico'"); }
try { $pdo->query("SELECT limite_eliminacion_dias FROM configuracion_web LIMIT 1"); } catch(Exception $e) { $pdo->exec("ALTER TABLE configuracion_web ADD COLUMN limite_eliminacion_dias INT DEFAULT 0"); }
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
    // 1. Crear el usuario de muestra con username único e insensibilidad a errores
    $hash = password_hash('demo1234', PASSWORD_DEFAULT);
    
    try { $pdo->query("SELECT username FROM usuarios LIMIT 1"); $has_username = true; } catch(Exception $e) { $has_username = false; }
    
    try {
        if ($has_username) {
            $pdo->prepare("INSERT INTO usuarios (nombre_completo, username, email, password, role, fecha_creacion) VALUES ('Agendatina DEMO', 'demo', ?, ?, 'admin', NOW())")->execute([$emailDemo, $hash]);
        } else {
            $pdo->prepare("INSERT INTO usuarios (nombre_completo, email, password) VALUES ('Agendatina DEMO', ?, ?)")->execute([$emailDemo, $hash]);
        }
        $userId = $pdo->lastInsertId();
    } catch (Exception $eUserIns) {
        $stmtU = $pdo->prepare("SELECT id FROM usuarios WHERE email = ? LIMIT 1");
        $stmtU->execute([$emailDemo]);
        $userId = $stmtU->fetchColumn();
    }
} else {
    $userId = $user['id'];
}

// 2. Obtener o crear negocio de muestra de forma ultra-segura
$negocioId = null;
if ($userId) {
    try {
        $stmtUserBiz = $pdo->prepare("SELECT id_negocio FROM personal_negocio WHERE id_usuario = ? LIMIT 1");
        $stmtUserBiz->execute([$userId]);
        $negocioId = $stmtUserBiz->fetchColumn();
    } catch (Exception $eUb) {}
}

if (!$negocioId) {
    try {
        $stmtCheckBiz = $pdo->query("SELECT id FROM negocios WHERE ruta = 'demo' OR subdominio = 'demo' LIMIT 1");
        $negocioId = $stmtCheckBiz ? $stmtCheckBiz->fetchColumn() : null;
    } catch (Exception $eCb) {}
}

if (!$negocioId) {
    $hasSubdominioCol = false;
    try { $pdo->query("SELECT subdominio FROM negocios LIMIT 1"); $hasSubdominioCol = true; } catch (Exception $eSub) {}

    $rutasToTry = ['demo'];
    foreach ($rutasToTry as $rTry) {
        try {
            if ($hasSubdominioCol) {
                $stmtInsB = $pdo->prepare("INSERT INTO negocios (nombre_fantasia, ruta, subdominio, plan, max_profesionales, estado_pago) VALUES ('Agendatina', ?, ?, 'Completo', 5, 'activo')");
                $stmtInsB->execute([$rTry, $rTry]);
            } else {
                $stmtInsB = $pdo->prepare("INSERT INTO negocios (nombre_fantasia, ruta, plan, max_profesionales, estado_pago) VALUES ('Agendatina', ?, 'Completo', 5, 'activo')");
                $stmtInsB->execute([$rTry]);
            }
            $negocioId = $pdo->lastInsertId();
            $rutaDemo = $rTry;
            break;
        } catch (Exception $eTry) {
            // Reintentar con siguiente candidato si colisiona
        }
    }
}

// Fallback absoluto si nada trajo ID
if (!$negocioId) {
    try {
        $stmtAny = $pdo->query("SELECT id FROM negocios ORDER BY id ASC LIMIT 1");
        $negocioId = $stmtAny ? $stmtAny->fetchColumn() : 1;
    } catch(Exception $eAny) {
        $negocioId = 1;
    }
}

// 3. Vincular usuario con negocio demo sin lanzar excepciones
if ($userId && $negocioId) {
    try {
        $stmtLink = $pdo->prepare("SELECT id FROM personal_negocio WHERE id_negocio = ? AND id_usuario = ? LIMIT 1");
        $stmtLink->execute([$negocioId, $userId]);
        if (!$stmtLink->fetch()) {
            $pdo->prepare("INSERT INTO personal_negocio (id_negocio, id_usuario, rol_en_local) VALUES (?, ?, 'admin')")->execute([$negocioId, $userId]);
        }
    } catch(Exception $eLk) {}
}

// Blindaje: en cada acceso demo, normalizar identidad del negocio demo
try {
    $pdo->prepare("UPDATE negocios SET nombre_fantasia = 'Agendatina', plan = 'Completo', max_profesionales = 5, estado_pago = 'activo', ultimo_pago = NOW() WHERE id = ?")->execute([$negocioId]);
} catch(Exception $eUpd) {}

try {
    $pdo->prepare("INSERT INTO configuracion_web (id_negocio, color_primario, color_secundario, mensaje_bienvenida, subtitulo, titulo)
                   VALUES (?, '#D11149', '#FCB0B3', 'Agendatina', 'Sesión de demostración', 'Agendatina')
                   ON DUPLICATE KEY UPDATE mensaje_bienvenida = 'Agendatina', subtitulo = 'Sesión de demostración', titulo = 'Agendatina'")->execute([$negocioId]);
} catch(Exception $eWeb) {}

// RESET AUTOMÁTICO CADA 10 MINUTOS O EN NUEVAS SESIONES DE NAVEGADOR
$resetFile = __DIR__ . '/demo_reset.txt';
$shouldReset = false;
$lastReset = @file_get_contents($resetFile);
if (!$lastReset || !is_numeric($lastReset) || (time() - intval($lastReset) > 600) || !isset($_SESSION['demo_session_active'])) {
    $shouldReset = true;
    $_SESSION['demo_session_active'] = true;
}

if ($shouldReset && $negocioId) {
    // 1. Limpiar Base de Datos
    $pdo->prepare("DELETE FROM turnos WHERE id_negocio = ?")->execute([$negocioId]);
    $pdo->prepare("DELETE FROM servicios WHERE id_negocio = ?")->execute([$negocioId]);
    $pdo->prepare("DELETE FROM notificaciones WHERE id_negocio = ?")->execute([$negocioId]);
    $pdo->prepare("DELETE FROM dias_bloqueados WHERE id_negocio = ?")->execute([$negocioId]); // Resetear bloqueos
    
    // 2. Limpiar imágenes físicas subidas por el negocio Demo
    $uploadDir = __DIR__ . '/uploads/';
    if (is_dir($uploadDir)) {
        $subfolders = ['logos', 'fondos', 'profesionales', 'servicios', 'comprobantes'];
        foreach ($subfolders as $sub) {
            $dir = $uploadDir . $sub . '/';
            if (is_dir($dir)) {
                $files = glob($dir . '*_' . $negocioId . '.*');
                foreach ($files as $file) {
                    if (is_file($file)) {
                        @unlink($file);
                    }
                }
            }
        }
    }

    // 3. Recrear Servicios por defecto
    $pdo->prepare("INSERT INTO servicios (id_negocio, nombre_servicio, duracion_minutos, precio, descripcion, profesional) VALUES 
        (?, 'Corte de Demostración', 30, 8000, 'Servicio de prueba para el plan Premium.', 'Valentina'),
        (?, 'Masaje Relajante', 60, 15000, 'Relájate con nuestros masajes de prueba.', 'Valentina'),
        (?, 'Limpieza Facial Profunda', 45, 12000, 'Cuidado de la piel con productos premium.', 'Camila'),
        (?, 'Manicura Semipermanente', 40, 9000, 'Diseños exclusivos y larga duración.', 'Sofía'),
        (?, 'Perfilado de Cejas', 20, 5000, 'Dale forma y estilo a tu mirada.', 'Marcos')")->execute([$negocioId, $negocioId, $negocioId, $negocioId, $negocioId]);

    $stmtServ = $pdo->prepare("SELECT id FROM servicios WHERE id_negocio = ?");
    $stmtServ->execute([$negocioId]);
    $servs = $stmtServ->fetchAll();
    $idServ1 = $servs[0]['id'] ?? null;
    $idServ2 = $servs[1]['id'] ?? null;
    $idServ3 = $servs[2]['id'] ?? null;
    $idServ4 = $servs[3]['id'] ?? null;
    $idServ5 = $servs[4]['id'] ?? null;
    
    // 4. Recrear Turnos futuros y pasados para alimentar Estadísticas y Agenda
    $t_hoy = date('Y-m-d');
    $t_m1 = date('Y-m-d', strtotime('+1 day'));
    $t_m2 = date('Y-m-d', strtotime('+2 days'));
    $t_m3 = date('Y-m-d', strtotime('+3 days'));
    $t_m4 = date('Y-m-d', strtotime('+4 days'));

    $t_p1 = date('Y-m-d', strtotime('-1 day'));
    $t_p3 = date('Y-m-d', strtotime('-3 days'));
    $t_p5 = date('Y-m-d', strtotime('-5 days'));
    $t_p8 = date('Y-m-d', strtotime('-8 days'));
    $t_p12 = date('Y-m-d', strtotime('-12 days'));
    $t_p15 = date('Y-m-d', strtotime('-15 days'));
    $t_p20 = date('Y-m-d', strtotime('-20 days'));
    $t_p25 = date('Y-m-d', strtotime('-25 days'));
    $t_p35 = date('Y-m-d', strtotime('-35 days'));
    $t_p50 = date('Y-m-d', strtotime('-50 days'));
    
    $pdo->prepare("INSERT INTO turnos (id_negocio, cliente_nombre, cliente_celular, fecha, hora, servicio, profesional, id_servicio, estado, precio) VALUES 
        (?, 'María Gómez', '1123456789', ?, '10:00', 'Corte de Demostración', 'Valentina', ?, 'confirmado', 8000),
        (?, 'Juan Pérez', '1198765432', ?, '11:30', 'Masaje Relajante', 'Valentina', ?, 'confirmado', 15000),
        (?, 'Ana Martínez', '1155443322', ?, '16:00', 'Manicura Semipermanente', 'Sofía', ?, 'pendiente', 9000),
        (?, 'Laura Díaz', '1166667777', ?, '09:30', 'Limpieza Facial Profunda', 'Camila', ?, 'confirmado', 12000),
        (?, 'Carlos Sánchez', '1133334444', ?, '15:00', 'Perfilado de Cejas', 'Marcos', ?, 'confirmado', 5000),
        (?, 'Sofía Pérez', '1144556677', ?, '11:00', 'Masaje Relajante', 'Valentina', ?, 'confirmado', 15000),
        (?, 'Mateo Gómez', '1177889900', ?, '17:30', 'Corte de Demostración', 'Valentina', ?, 'pendiente', 8000),
        (?, 'Valentina Silva', '1188990011', ?, '10:30', 'Manicura Semipermanente', 'Sofía', ?, 'confirmado', 9000),
        (?, 'Joaquín Navarro', '1122334455', ?, '14:00', 'Limpieza Facial Profunda', 'Camila', ?, 'confirmado', 12000),
        (?, 'Camila Torres', '1199001122', ?, '16:00', 'Perfilado de Cejas', 'Marcos', ?, 'confirmado', 5000),

        (?, 'Lucía Fernández', '1144332211', ?, '10:00', 'Masaje Relajante', 'Valentina', ?, 'atendido', 15000),
        (?, 'Diego Romero', '1155667788', ?, '14:30', 'Corte de Demostración', 'Valentina', ?, 'atendido', 8000),
        (?, 'Martina López', '1177665544', ?, '16:00', 'Limpieza Facial Profunda', 'Camila', ?, 'atendido', 12000),
        (?, 'Agustín Vega', '1188776655', ?, '11:00', 'Perfilado de Cejas', 'Marcos', ?, 'atendido', 5000),
        (?, 'Belén Castro', '1199887766', ?, '15:30', 'Manicura Semipermanente', 'Sofía', ?, 'atendido', 9000),
        (?, 'Nicolas Benítez', '1122446688', ?, '10:30', 'Corte de Demostración', 'Valentina', ?, 'atendido', 8000),
        (?, 'Paula Acosta', '1133557799', ?, '12:00', 'Masaje Relajante', 'Valentina', ?, 'atendido', 15000),
        (?, 'Esteban Morales', '1144668800', ?, '17:00', 'Limpieza Facial Profunda', 'Camila', ?, 'atendido', 12000),
        (?, 'Florencia Herrera', '1155779911', ?, '11:30', 'Manicura Semipermanente', 'Sofía', ?, 'atendido', 9000),
        (?, 'Gonzalo Peralta', '1166880022', ?, '15:00', 'Corte de Demostración', 'Valentina', ?, 'atendido', 8000)
    ")->execute([
        $negocioId, $t_m1, $idServ1,
        $negocioId, $t_m1, $idServ2,
        $negocioId, $t_hoy, $idServ4,
        $negocioId, $t_m1, $idServ3,
        $negocioId, $t_m1, $idServ5,
        $negocioId, $t_m2, $idServ2,
        $negocioId, $t_m2, $idServ1,
        $negocioId, $t_m3, $idServ4,
        $negocioId, $t_m4, $idServ3,
        $negocioId, $t_m4, $idServ5,

        $negocioId, $t_p1, $idServ2,
        $negocioId, $t_p3, $idServ1,
        $negocioId, $t_p5, $idServ3,
        $negocioId, $t_p8, $idServ5,
        $negocioId, $t_p12, $idServ4,
        $negocioId, $t_p15, $idServ1,
        $negocioId, $t_p20, $idServ2,
        $negocioId, $t_p25, $idServ3,
        $negocioId, $t_p35, $idServ4,
        $negocioId, $t_p50, $idServ1
    ]);
        
    $pdo->prepare("INSERT INTO notificaciones (id_negocio, titulo, mensaje) VALUES 
        (?, '¡Bienvenido a Agendatina!', 'Prueba todas las funciones premium desde este panel de control interactivo.'),
        (?, 'Nuevas solicitudes', 'Tienes 2 turnos pendientes por confirmar. Revisa tu Agenda Virtual.')")->execute([$negocioId, $negocioId]);

   // 5. Restaurar Configuración Web a fábrica (Borrando TODAS las imágenes y JSONs)
$pdo->prepare("INSERT INTO configuracion_web (id_negocio, color_primario, color_secundario, mensaje_bienvenida, intervalo_turnos, tipo_calendario, titulo)
               VALUES (?, '#D11149', '#FCB0B3', 'Agendatina', '30', 'clasico', 'Agendatina')
               ON DUPLICATE KEY UPDATE 
               color_primario='#D11149', 
               color_secundario='#FCB0B3', 
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
$_SESSION['nombre_completo'] = 'Agendatina DEMO';
$_SESSION['nombre_negocio'] = 'Agendatina';
$_SESSION['ruta_negocio'] = 'demo';
$_SESSION['rol_en_local'] = 'admin';
$_SESSION['is_demo'] = true;

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