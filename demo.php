<?php
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// Forzar siempre el entorno DEMO en esta ruta
$_SESSION['is_demo'] = true;

try {
    require_once __DIR__ . '/backend/conexion.php';

    if (!isset($pdo)) {
        throw new Exception("No se pudo establecer la conexión con la base de datos.");
    }

    // Si ya existe una sesión Demo activa válida, reutilizarla y no volver a crear filas en la base de datos
    if (isset($_SESSION['is_demo']) && $_SESSION['is_demo'] === true && !empty($_SESSION['user_id']) && !empty($_SESSION['id_negocio']) && !isset($_GET['reset'])) {
        try {
            $stmtCheckExist = $pdo->prepare("SELECT id FROM negocios WHERE id = ? LIMIT 1");
            $stmtCheckExist->execute([$_SESSION['id_negocio']]);
            if ($stmtCheckExist->fetchColumn()) {
                session_write_close();
                echo "<!DOCTYPE html>\n<html>\n<head>\n<title>Redirigiendo a Demo...</title>\n</head>\n<body>\n";
                echo "<script>\n";
                echo "  sessionStorage.setItem('agendatina_session', 'active');\n";
                echo "  sessionStorage.setItem('is_demo_user', 'true');\n";
                echo "  window.location.replace('dashboard.html');\n";
                echo "</script>\n";
                echo "</body>\n</html>";
                exit;
            }
        } catch (Throwable $eExist) {}
    }

    // 1. LIMPIEZA AUTOMÁTICA DE CUENTAS DEMO EXPIRADAS (Mayores a 30 minutos)
    try {
        $stmtOld = $pdo->query("SELECT id FROM negocios WHERE (ruta LIKE 'demo-%' OR subdominio LIKE 'demo-%' OR nombre_fantasia LIKE 'Demo%') AND (fecha_alta < NOW() - INTERVAL 30 MINUTE OR fecha_alta IS NULL)");
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
        $pdo->exec("DELETE FROM usuarios WHERE (email LIKE 'demo_%@agendatina.site' OR email LIKE 'demo%@agendatina.site') AND id NOT IN (SELECT id_usuario FROM personal_negocio)");
    } catch (Exception $eGC) {}

    // BARRERA DE PROTECCIÓN: Asegurar columnas necesarias en la BD
    try { $pdo->query("SELECT descripcion FROM servicios LIMIT 1"); } catch(Exception $e) { $pdo->exec("ALTER TABLE servicios ADD COLUMN descripcion TEXT DEFAULT NULL"); }
    try { $pdo->query("SELECT profesional FROM servicios LIMIT 1"); } catch(Exception $e) { $pdo->exec("ALTER TABLE servicios ADD COLUMN profesional VARCHAR(255) DEFAULT ''"); }
    try { $pdo->query("SELECT profesional FROM turnos LIMIT 1"); } catch(Exception $e) { $pdo->exec("ALTER TABLE turnos ADD COLUMN profesional VARCHAR(255) DEFAULT 'Cualquiera (Sin preferencia)'"); }
    try { $pdo->query("SELECT precio FROM turnos LIMIT 1"); } catch(Exception $e) { $pdo->exec("ALTER TABLE turnos ADD COLUMN precio INT DEFAULT 0"); }
    try { $pdo->query("SELECT cliente_nombre FROM turnos LIMIT 1"); } catch(Exception $e) { $pdo->exec("ALTER TABLE turnos ADD COLUMN cliente_nombre VARCHAR(255) DEFAULT NULL"); }
    try { $pdo->query("SELECT cliente_celular FROM turnos LIMIT 1"); } catch(Exception $e) { $pdo->exec("ALTER TABLE turnos ADD COLUMN cliente_celular VARCHAR(255) DEFAULT NULL"); }
    try { $pdo->query("SELECT plan FROM negocios LIMIT 1"); } catch(Exception $e) { $pdo->exec("ALTER TABLE negocios ADD COLUMN plan VARCHAR(50) DEFAULT 'Premium'"); }

    // 2. CREAR UN ENTORNO DEMO FRESCO, INDIVIDUAL E ISOLADO CADA VEZ QUE SE ACCEDE DESDE INDEX.HTML
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

    // Inicializar Servicios, Clases con Cupos, Alumnos y Turnos mediante demo_helper
    require_once __DIR__ . '/backend/helpers/demo_helper.php';
    asegurarDatosDemo($pdo, $negocioId);

    // Guardar referencia en sesión del navegador
    $_SESSION['demo_negocio_id'] = $negocioId;

    // Configurar variables de sesión del usuario activo
    $_SESSION['user_id'] = $userId;
    $_SESSION['id_negocio'] = $negocioId;
    $_SESSION['nombre_completo'] = 'Agendatina DEMO';
    $_SESSION['nombre_negocio'] = 'Agendatina';
    $_SESSION['ruta_negocio'] = $rutaDemo;
    $_SESSION['rol_en_local'] = 'admin';
    $_SESSION['is_demo'] = true;

    session_write_close();

    echo "<!DOCTYPE html>\n<html>\n<head>\n<title>Redirigiendo a Demo...</title>\n</head>\n<body>\n";
    echo "<script>\n";
    echo "  localStorage.removeItem('user_color_primario');\n";
    echo "  localStorage.removeItem('user_color_secundario');\n";
    echo "  localStorage.removeItem('user_colores_extra_json');\n";
    echo "  sessionStorage.setItem('agendatina_session', 'active');\n";
    echo "  sessionStorage.setItem('agendatina_demo_alert', 'true');\n";
    echo "  sessionStorage.setItem('is_demo_user', 'true');\n";
    echo "  window.location.replace('dashboard.html');\n";
    echo "</script>\n";
    echo "</body>\n</html>";
    exit;

} catch (Throwable $e) {
    echo "<!DOCTYPE html>\n<html>\n<head>\n<title>Error de Demo</title>\n</head>\n<body style='font-family: sans-serif; padding: 2rem; color: #ef4444;'>\n";
    echo "<h2>Ocurrió un error al preparar la Demostración:</h2>\n";
    echo "<p><b>" . htmlspecialchars($e->getMessage()) . "</b></p>\n";
    echo "</body>\n</html>";
    exit;
}
?>