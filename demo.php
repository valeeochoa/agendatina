<?php
session_start();

// Forzar siempre el entorno DEMO en esta ruta
$_SESSION['is_demo'] = true;

require_once __DIR__ . '/backend/conexion.php';

try {
    // 1. LIMPIEZA AUTOMÁTICA DE CUENTAS DEMO EXPIRADAS (Mayores a 30 minutos)
    try {
        $stmtOld = $pdo->query("SELECT id FROM negocios WHERE (ruta LIKE 'demo-%' OR subdominio LIKE 'demo-%' OR fecha_alta < NOW() - INTERVAL 30 MINUTE) AND (ruta != 'demo')");
        if ($stmtOld) {
            $oldIds = $stmtOld->fetchAll(PDO::FETCH_COLUMN);
            foreach ($oldIds as $oldId) {
                $pdo->prepare("DELETE FROM turnos WHERE id_negocio = ?")->execute([$oldId]);
                $pdo->prepare("DELETE FROM servicios WHERE id_negocio = ?")->execute([$oldId]);
                $pdo->prepare("DELETE FROM notificaciones WHERE id_negocio = ?")->execute([$oldId]);
                $pdo->prepare("DELETE FROM dias_bloqueados WHERE id_negocio = ?")->execute([$oldId]);
                $pdo->prepare("DELETE FROM configuracion_web WHERE id_negocio = ?")->execute([$oldId]);
                $pdo->prepare("DELETE FROM personal_negocio WHERE id_negocio = ?")->execute([$oldId]);
                $pdo->prepare("DELETE FROM negocios WHERE id = ?")->execute([$oldId]);

                // Limpiar imágenes físicas del disco asociadas a este id_negocio
                $uploadDir = __DIR__ . '/uploads/';
                if (is_dir($uploadDir)) {
                    $subfolders = ['logos', 'fondos', 'profesionales', 'servicios', 'comprobantes'];
                    foreach ($subfolders as $sub) {
                        $files = glob($uploadDir . $sub . '/*_' . $oldId . '.*');
                        if ($files) {
                            foreach ($files as $file) {
                                if (is_file($file)) @unlink($file);
                            }
                        }
                    }
                }
            }
        }
    } catch (Exception $eGC) {}

    // BARRERA DE PROTECCIÓN: Asegurar columnas necesarias en la BD
    try { $pdo->query("SELECT descripcion FROM servicios LIMIT 1"); } catch(Exception $e) { $pdo->exec("ALTER TABLE servicios ADD COLUMN descripcion TEXT DEFAULT NULL"); }
    try { $pdo->query("SELECT profesional FROM servicios LIMIT 1"); } catch(Exception $e) { $pdo->exec("ALTER TABLE servicios ADD COLUMN profesional VARCHAR(255) DEFAULT ''"); }
    try { $pdo->query("SELECT profesional FROM turnos LIMIT 1"); } catch(Exception $e) { $pdo->exec("ALTER TABLE turnos ADD COLUMN profesional VARCHAR(255) DEFAULT 'Cualquiera (Sin preferencia)'"); }
    try { $pdo->query("SELECT precio FROM turnos LIMIT 1"); } catch(Exception $e) { $pdo->exec("ALTER TABLE turnos ADD COLUMN precio INT DEFAULT 0"); }
    try { $pdo->query("SELECT cliente_nombre FROM turnos LIMIT 1"); } catch(Exception $e) { $pdo->exec("ALTER TABLE turnos ADD COLUMN cliente_nombre VARCHAR(255) DEFAULT NULL"); }
    try { $pdo->query("SELECT cliente_celular FROM turnos LIMIT 1"); } catch(Exception $e) { $pdo->exec("ALTER TABLE turnos ADD COLUMN cliente_celular VARCHAR(255) DEFAULT NULL"); }
    try { $pdo->query("SELECT plan FROM negocios LIMIT 1"); } catch(Exception $e) { $pdo->exec("ALTER TABLE negocios ADD COLUMN plan VARCHAR(50) DEFAULT 'Premium'"); }

    // 2. VERIFICAR SI LA SESIÓN ACTUAL YA TIENE UN NEGOCIO DEMO AISLADO ACTIVO
    $sessionDemoId = $_SESSION['demo_negocio_id'] ?? null;
    $isValidSession = false;
    $negocioId = null;
    $userId = null;
    $rutaDemo = 'demo';

    if ($sessionDemoId) {
        $stmtCheck = $pdo->prepare("SELECT id, ruta FROM negocios WHERE id = ? LIMIT 1");
        $stmtCheck->execute([$sessionDemoId]);
        $existingBiz = $stmtCheck->fetch(PDO::FETCH_ASSOC);
        if ($existingBiz) {
            $isValidSession = true;
            $negocioId = $existingBiz['id'];
            $rutaDemo = $existingBiz['ruta'];

            $stmtUser = $pdo->prepare("SELECT id_usuario FROM personal_negocio WHERE id_negocio = ? AND rol_en_local = 'admin' LIMIT 1");
            $stmtUser->execute([$negocioId]);
            $userId = $stmtUser->fetchColumn();
        }
    }

    // 3. SI NO TIENE SESIÓN VÁLIDA, CREAR UN ENTORNO DEMO INDIVIDUAL E ISOLADO
    if (!$isValidSession) {
        $token = substr(md5(session_id() . microtime() . rand(1000, 9999)), 0, 8);
        $emailDemo = 'demo_' . $token . '@agendatina.site';
        $rutaDemo = 'demo-' . $token;

        // Crear usuario administrador único para esta demostración
        $hash = password_hash('demo1234', PASSWORD_DEFAULT);
        $pdo->prepare("INSERT INTO usuarios (nombre_completo, email, password, role, fecha_creacion) VALUES ('Agendatina DEMO', ?, ?, 'admin', NOW())")->execute([$emailDemo, $hash]);
        $userId = $pdo->lastInsertId();

        // Crear negocio demo aislado con Plan Premium
        $pdo->prepare("INSERT INTO negocios (nombre_fantasia, ruta, plan, max_profesionales, estado_pago, fecha_alta) VALUES ('Agendatina', ?, 'Premium', 5, 'activo', NOW())")->execute([$rutaDemo]);
        $negocioId = $pdo->lastInsertId();

        // Vincular usuario como administrador del negocio demo
        $pdo->prepare("INSERT INTO personal_negocio (id_negocio, id_usuario, rol_en_local) VALUES (?, ?, 'admin')")->execute([$negocioId, $userId]);

        // Recrear Servicios por defecto en este entorno
        $pdo->prepare("INSERT INTO servicios (id_negocio, nombre_servicio, duracion_minutos, precio, descripcion, profesional) VALUES 
            (?, 'Corte de Demostración', 30, 8000, 'Servicio de prueba para el plan Premium.', 'Valentina'),
            (?, 'Masaje Relajante', 60, 15000, 'Relájate con nuestros masajes de prueba.', 'Valentina'),
            (?, 'Limpieza Facial Profunda', 45, 12000, 'Cuidado de la piel con productos premium.', 'Camila'),
            (?, 'Manicura Semipermanente', 40, 9000, 'Diseños exclusivos y larga duración.', 'Sofía'),
            (?, 'Perfilado de Cejas', 20, 5000, 'Dale forma y estilo a tu mirada.', 'Marcos')")->execute([$negocioId, $negocioId, $negocioId, $negocioId, $negocioId]);

        // Recrear integrantes del equipo (Profesionales Demo)
        $profsDemo = [
            ['nombre' => 'Valentina Ochoa', 'email' => 'valentina_' . $token . '@agendatina.site'],
            ['nombre' => 'Camila Benítez', 'email' => 'camila_' . $token . '@agendatina.site'],
            ['nombre' => 'Sofía Pérez', 'email' => 'sofia_' . $token . '@agendatina.site'],
            ['nombre' => 'Marcos Gómez', 'email' => 'marcos_' . $token . '@agendatina.site']
        ];

        foreach ($profsDemo as $pDemo) {
            try {
                $hashP = password_hash('demo1234', PASSWORD_DEFAULT);
                $pdo->prepare("INSERT INTO usuarios (nombre_completo, email, password, role) VALUES (?, ?, ?, 'profesional')")->execute([$pDemo['nombre'], $pDemo['email'], $hashP]);
                $pId = $pdo->lastInsertId();
                $pdo->prepare("INSERT INTO personal_negocio (id_negocio, id_usuario, rol_en_local) VALUES (?, ?, 'profesional')")->execute([$negocioId, $pId]);
            } catch (Exception $eP) {}
        }

        // Obtener IDs de servicios para turnos de muestra
        $stmtServ = $pdo->prepare("SELECT id FROM servicios WHERE id_negocio = ?");
        $stmtServ->execute([$negocioId]);
        $servs = $stmtServ->fetchAll();
        $idServ1 = $servs[0]['id'] ?? null;
        $idServ2 = $servs[1]['id'] ?? null;
        $idServ3 = $servs[2]['id'] ?? null;
        $idServ4 = $servs[3]['id'] ?? null;
        $idServ5 = $servs[4]['id'] ?? null;

        // Cargar turnos iniciales de prueba
        $t_hoy = date('Y-m-d');
        $t_m1 = date('Y-m-d', strtotime('+1 day'));
        $t_m2 = date('Y-m-d', strtotime('+2 days'));
        $t_m3 = date('Y-m-d', strtotime('+3 days'));
        $t_m4 = date('Y-m-d', strtotime('+4 days'));
        $t_p1 = date('Y-m-d', strtotime('-1 day'));
        $t_p3 = date('Y-m-d', strtotime('-3 days'));
        $t_p5 = date('Y-m-d', strtotime('-5 days'));

        $pdo->prepare("INSERT INTO turnos (id_negocio, cliente_nombre, cliente_celular, fecha, hora, servicio, profesional, id_servicio, estado, asistio, precio) VALUES 
            (?, 'María Gómez', '1123456789', ?, '10:00', 'Corte de Demostración', 'Valentina', ?, 'confirmado', 0, 8000),
            (?, 'Juan Pérez', '1198765432', ?, '11:30', 'Masaje Relajante', 'Valentina', ?, 'confirmado', 0, 15000),
            (?, 'Ana Martínez', '1155443322', ?, '16:00', 'Manicura Semipermanente', 'Sofía', ?, 'pendiente', 0, 9000),
            (?, 'Laura Díaz', '1166667777', ?, '09:30', 'Limpieza Facial Profunda', 'Camila', ?, 'confirmado', 0, 12000),
            (?, 'Carlos Sánchez', '1133334444', ?, '15:00', 'Perfilado de Cejas', 'Marcos', ?, 'confirmado', 0, 5000),
            (?, 'Lucía Fernández', '1144332211', ?, '10:00', 'Masaje Relajante', 'Valentina', ?, 'confirmado', 1, 15000),
            (?, 'Diego Romero', '1155667788', ?, '14:30', 'Corte de Demostración', 'Valentina', ?, 'confirmado', 1, 8000)
        ")->execute([
            $negocioId, $t_m1, $idServ1,
            $negocioId, $t_m1, $idServ2,
            $negocioId, $t_hoy, $idServ4,
            $negocioId, $t_m1, $idServ3,
            $negocioId, $t_m1, $idServ5,
            $negocioId, $t_p1, $idServ2,
            $negocioId, $t_p3, $idServ1
        ]);

        // Notificaciones iniciales
        $pdo->prepare("INSERT INTO notificaciones (id_negocio, titulo, mensaje) VALUES 
            (?, '¡Bienvenido a Agendatina!', 'Prueba todas las funciones premium desde este panel de control interactivo.'),
            (?, 'Nuevas solicitudes', 'Tienes 1 turno pendiente por confirmar. Revisa tu Agenda Virtual.')")->execute([$negocioId, $negocioId]);

        // Configuración Web por defecto (colores institucionales de Agendatina: #D11149 y #FC8712)
        $pdo->prepare("INSERT INTO configuracion_web (id_negocio, color_primario, color_secundario, mensaje_bienvenida, intervalo_turnos, tipo_calendario, titulo)
                       VALUES (?, '#D11149', '#FC8712', 'Agendatina', '30', 'clasico', 'Agendatina')")->execute([$negocioId]);

        // Guardar referencia en sesión del navegador
        $_SESSION['demo_negocio_id'] = $negocioId;
    }

    // Configurar variables de sesión del usuario activo
    $_SESSION['user_id'] = $userId;
    $_SESSION['id_negocio'] = $negocioId;
    $_SESSION['nombre_completo'] = 'Agendatina DEMO';
    $_SESSION['nombre_negocio'] = 'Agendatina';
    $_SESSION['ruta_negocio'] = $rutaDemo;
    $_SESSION['rol_en_local'] = 'admin';
    $_SESSION['is_demo'] = true;

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