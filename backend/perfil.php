<?php
session_start();
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/conexion.php';

if (!isset($_SESSION['user_id']) || !isset($_SESSION['id_negocio'])) {
    $isDemoRequested = (isset($_SESSION['is_demo']) && $_SESSION['is_demo'] === true) || 
                       (isset($_GET['n']) && strtolower($_GET['n']) === 'demo') || 
                       (isset($_GET['demo']) && $_GET['demo'] == 1) ||
                       (isset($_SESSION['demo_negocio_id']));

    if ($isDemoRequested) {
        try {
            $targetNegocioId = $_SESSION['demo_negocio_id'] ?? null;
            if (!$targetNegocioId) {
                $stmtLatestDemo = $pdo->query("SELECT id FROM negocios WHERE (ruta LIKE 'demo%' OR subdominio LIKE 'demo%' OR nombre_fantasia LIKE '%Demo%' OR nombre_fantasia LIKE 'Agendatina%') ORDER BY id DESC LIMIT 1");
                $targetNegocioId = $stmtLatestDemo ? $stmtLatestDemo->fetchColumn() : null;
            }
            if ($targetNegocioId) {
                $stmtDemoUser = $pdo->prepare("SELECT id_usuario FROM personal_negocio WHERE id_negocio = ? AND rol_en_local = 'admin' ORDER BY id ASC LIMIT 1");
                $stmtDemoUser->execute([$targetNegocioId]);
                $dUser = $stmtDemoUser->fetchColumn();
                if ($dUser) {
                    $_SESSION['user_id'] = $dUser;
                    $_SESSION['id_negocio'] = $targetNegocioId;
                    $_SESSION['is_demo'] = true;
                    $_SESSION['rol_en_local'] = 'admin';
                }
            }
        } catch (Exception $eDemoAuto) {}
    }
}

if (!isset($_SESSION['user_id']) || !isset($_SESSION['id_negocio'])) {
    echo json_encode(['success' => false, 'error' => 'No autorizado. Inicia sesión.']);
    exit;
}

$id_usuario = $_SESSION['user_id'];
$id_negocio = $_SESSION['id_negocio'];

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    // Liberar el archivo de sesión para evitar bloqueos al navegar entre páginas
    session_write_close();

    // Obtener datos de usuario
    try { $pdo->query("SELECT email_verificado FROM usuarios LIMIT 1"); } 
    catch(Exception $e) { $pdo->exec("ALTER TABLE usuarios ADD COLUMN email_verificado TINYINT DEFAULT 0"); }

    $stmtU = $pdo->prepare("SELECT nombre_completo, email, email_verificado FROM usuarios WHERE id = ?");
    $stmtU->execute([$id_usuario]);
    $user = $stmtU->fetch(PDO::FETCH_ASSOC);

    $userRole = $_SESSION['rol_en_local'] ?? 'admin';
    $defaultProfPerms = ['agenda' => 1, 'ver_todos_turnos' => 1, 'web' => 0, 'servicios' => 0, 'estadisticas' => 0, 'equipo' => 0];
    $defaultAdminPerms = ['agenda' => 1, 'ver_todos_turnos' => 1, 'web' => 1, 'servicios' => 1, 'estadisticas' => 1, 'equipo' => 1];

    if ($user) {
        $user['rol'] = $userRole;
        if ($userRole === 'admin') {
            $user['permisos'] = $defaultAdminPerms;
        } else {
            try {
                $stmtPnPerms = $pdo->prepare("SELECT permisos FROM personal_negocio WHERE id_usuario = ? AND id_negocio = ? LIMIT 1");
                $stmtPnPerms->execute([$id_usuario, $id_negocio]);
                $rawPerms = $stmtPnPerms->fetchColumn();
                $parsedPerms = !empty($rawPerms) ? json_decode($rawPerms, true) : ($_SESSION['permisos'] ?? null);
                $user['permisos'] = is_array($parsedPerms) ? array_merge($defaultProfPerms, $parsedPerms) : $defaultProfPerms;
            } catch (Exception $ePerms) {
                $user['permisos'] = $defaultProfPerms;
            }
        }
        $_SESSION['permisos'] = $user['permisos'];
    }

    // Auto-Migración para contador mensual de WhatsApp por negocio
    try { $pdo->query("SELECT wpp_enviados_mes FROM negocios LIMIT 1"); } 
    catch(Exception $e) { $pdo->exec("ALTER TABLE negocios ADD COLUMN wpp_enviados_mes INT DEFAULT 0"); }
    
    try { $pdo->query("SELECT mes_wpp_contador FROM negocios LIMIT 1"); } 
    catch(Exception $e) { $pdo->exec("ALTER TABLE negocios ADD COLUMN mes_wpp_contador VARCHAR(7) DEFAULT NULL"); }

    // Reseteo mensual automático si cambió el mes (YYYY-MM)
    $currentMonthStr = date('Y-m');
    $stmtN = $pdo->prepare("SELECT nombre_fantasia, ruta, plan, estado_pago, ultimo_pago, fecha_alta, comprobante, wpp_enviados_mes, mes_wpp_contador, codigo_descuento, descuento_aplicado_pct FROM negocios WHERE id = ?");
    $stmtN->execute([$id_negocio]);
    $business = $stmtN->fetch(PDO::FETCH_ASSOC);

    if ($business) {
        if ($business['mes_wpp_contador'] !== $currentMonthStr) {
            try {
                $pdo->prepare("UPDATE negocios SET wpp_enviados_mes = 0, mes_wpp_contador = ? WHERE id = ?")->execute([$currentMonthStr, $id_negocio]);
                $business['wpp_enviados_mes'] = 0;
                $business['mes_wpp_contador'] = $currentMonthStr;
            } catch(Exception $eUp) {}
        }

        // Cantidad de profesionales registrados en el equipo de este negocio
        $profCount = 1;
        try {
            $stmtProf = $pdo->prepare("SELECT COUNT(*) FROM personal_negocio WHERE id_negocio = ?");
            $stmtProf->execute([$id_negocio]);
            $profCount = max(1, (int)$stmtProf->fetchColumn());
        } catch(Exception $eProf) {}

        $planLower = strtolower($business['plan'] ?? 'basico');
        $isBasic = strpos($planLower, 'básico') !== false || strpos($planLower, 'basico') !== false || strpos($planLower, 'simple') !== false;
        $isPremium = strpos($planLower, 'premium') !== false || strpos($planLower, 'completo') !== false;
        
        $extraProfs = max(0, $profCount - 1);
        $wppBase = $isBasic ? 0 : ($isPremium ? 100 : 50);
        $wppBonus = $isBasic ? 0 : ($extraProfs * 10);
        $wppLimiteTotal = $wppBase + $wppBonus;
        $wppUsados = (int)($business['wpp_enviados_mes'] ?? 0);
        $wppExcedentes = max(0, $wppUsados - $wppLimiteTotal);
        $wppCostoExtra = $wppExcedentes * 60; // $60 ARS por WhatsApp extra superada la bolsa global

        $business['wpp_stats'] = [
            'habilitado' => !$isBasic,
            'plan' => $business['plan'] ?? 'Básico',
            'profesionales_count' => $profCount,
            'extra_profesionales' => $extraProfs,
            'base' => $wppBase,
            'bonus' => $wppBonus,
            'limite_total' => $wppLimiteTotal,
            'usados' => $wppUsados,
            'excedentes' => $wppExcedentes,
            'costo_extra_ars' => $wppCostoExtra
        ];

        $business['is_demo'] = (isset($_SESSION['is_demo']) && $_SESSION['is_demo'] === true) || (isset($business['ruta']) && $business['ruta'] === 'demo') || (isset($user['email']) && strpos($user['email'], 'demo') !== false);
    }

    if (!$user || !$business) {
        echo json_encode(['success' => false, 'error' => 'No autorizado. Inicia sesión nuevamente.']);
        exit;
    }

    // Obtener configuración web
    try {
        $stmtC = $pdo->prepare("SELECT color_primario, color_secundario, color_fondo, colores_extra_json FROM configuracion_web WHERE id_negocio = ?");
        $stmtC->execute([$id_negocio]);
        $config = $stmtC->fetch(PDO::FETCH_ASSOC);
    } catch(Exception $e) { $config = null; } // Si la tabla no existe o está vacía

    // Migración: Crear tabla de Notificaciones si no existe para evitar caída al cargar la campanita
    try { $pdo->query("SELECT id FROM notificaciones LIMIT 1"); } 
    catch(Exception $e) { 
        $pdo->exec("CREATE TABLE notificaciones (id INT AUTO_INCREMENT PRIMARY KEY, id_negocio INT NULL, titulo VARCHAR(255), mensaje TEXT, fecha DATETIME DEFAULT CURRENT_TIMESTAMP)"); 
    }

    $stmtNotif = $pdo->prepare("SELECT * FROM notificaciones WHERE id_negocio = ? OR id_negocio IS NULL ORDER BY fecha DESC LIMIT 20");
    $stmtNotif->execute([$id_negocio]);
    $notificaciones = $stmtNotif->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode(['success' => true, 'user' => $user, 'business' => $business, 'config' => $config, 'notificaciones' => $notificaciones]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $contentType = isset($_SERVER["CONTENT_TYPE"]) ? trim($_SERVER["CONTENT_TYPE"]) : '';
    if (strpos($contentType, 'application/json') !== false) {
        $data = json_decode(file_get_contents('php://input'), true);
    } else {
        $data = $_POST;
    }

    $nombre = trim($data['nombre'] ?? '');
    $nombre_fantasia = trim($data['nombre_fantasia'] ?? '');
    $password = $data['password'] ?? '';
    $rutaRaw = $data['ruta'] ?? $data['subdominio'] ?? '';
    $ruta = preg_replace('/[^a-zA-Z0-9-]/', '', strtolower(trim($rutaRaw)));
    $color_primario = $data['color_primario'] ?? null;
    $color_secundario = $data['color_secundario'] ?? null;
    $color_fondo = $data['color_fondo'] ?? null;
    $colores_extra_json = $data['colores_extra_json'] ?? null;

    try {
        $pdo->beginTransaction();

        // 1. Actualizar Nombre Completo del Usuario
        if (!empty($nombre)) {
            $pdo->prepare("UPDATE usuarios SET nombre_completo = ? WHERE id = ?")->execute([$nombre, $id_usuario]);
            $_SESSION['nombre_completo'] = $nombre; // Refrescar sesión
        }

        // 2. Actualizar Nombre del Negocio (Solo Administrador)
        if (!empty($nombre_fantasia)) {
            $userRole = $_SESSION['rol_en_local'] ?? 'admin';
            if ($userRole !== 'admin' && (!isset($_SESSION['is_demo']) || $_SESSION['is_demo'] !== true)) {
                throw new Exception("Solo el administrador del local puede modificar el nombre del negocio.");
            }
            $pdo->prepare("UPDATE negocios SET nombre_fantasia = ? WHERE id = ?")->execute([$nombre_fantasia, $id_negocio]);
        }

        // 2. Actualizar Contraseña (con verificación de seguridad obligatoria de la contraseña actual)
        if (!empty($password)) {
            if ((isset($_SESSION['is_demo']) && $_SESSION['is_demo'] === true) || (isset($_SESSION['email']) && $_SESSION['email'] === 'demo@agendatina.site')) {
                throw new Exception("Función no disponible en la versión demo.");
            }
            $current_password = $data['current_password'] ?? '';
            if (empty($current_password)) {
                throw new Exception("Para cambiar tu contraseña debes ingresar tu contraseña actual.");
            }
            $stmtCheck = $pdo->prepare("SELECT password FROM usuarios WHERE id = ?");
            $stmtCheck->execute([$id_usuario]);
            $userDb = $stmtCheck->fetch();

            if (!$userDb || !password_verify($current_password, $userDb['password'])) {
                throw new Exception("La contraseña actual ingresada es incorrecta.");
            }

            $hash = password_hash($password, PASSWORD_DEFAULT);
            $pdo->prepare("UPDATE usuarios SET password = ? WHERE id = ?")->execute([$hash, $id_usuario]);
            require_once __DIR__ . '/helpers/notificar_admin_helper.php';
            notificarSuperAdminAlert($pdo, 'Seguridad / Contraseña', "El usuario '{$nombre}' modificó su contraseña de acceso.", $id_negocio);
        }

        // 2. Actualizar Ruta (verificando que sea única)
        if (!empty($ruta)) {
            $check = $pdo->prepare("SELECT id FROM negocios WHERE ruta = ? AND id != ?");
            $check->execute([$ruta, $id_negocio]);
            if ($check->fetch()) {
                throw new Exception("La ruta ya está siendo utilizada por otro local.");
            }
            $pdo->prepare("UPDATE negocios SET ruta = ? WHERE id = ?")->execute([$ruta, $id_negocio]);
            require_once __DIR__ . '/helpers/notificar_admin_helper.php';
            notificarSuperAdminAlert($pdo, 'Configuración / Enlace Web', "El negocio cambió su enlace web público a: agendatina.site/{$ruta}", $id_negocio);
        }

        // 3. Actualizar Colores
        if ($color_primario || $color_secundario || $color_fondo || $colores_extra_json !== null) {
            $pdo->prepare("INSERT INTO configuracion_web (id_negocio, color_primario, color_secundario, color_fondo, colores_extra_json) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE color_primario = ?, color_secundario = ?, color_fondo = ?, colores_extra_json = ?")->execute([$id_negocio, $color_primario, $color_secundario, $color_fondo, $colores_extra_json, $color_primario, $color_secundario, $color_fondo, $colores_extra_json]);
        }

        $pdo->commit();
        echo json_encode(['success' => true]);
    } catch (Exception $e) {
        $pdo->rollBack();
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
}
?>