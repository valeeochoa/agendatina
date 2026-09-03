<?php
try {
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }
    header('Content-Type: application/json; charset=utf-8');
    require_once __DIR__ . '/conexion.php';

    // Verificación de sesión con auto-instanciación aislada para el entorno Demo
    if (!isset($_SESSION['user_id']) || !isset($_SESSION['id_negocio'])) {
        $isDemoContext = (isset($_SESSION['is_demo']) && $_SESSION['is_demo'] === true) || 
                         (isset($_GET['n']) && strpos(strtolower($_GET['n']), 'demo') === 0);
        
        if ($isDemoContext) {
            try {
                // Crear un entorno Demo totalmente aislado e individual para esta sesión
                $token = substr(md5(session_id() . microtime() . rand(1000, 9999)), 0, 8);
                $emailDemo = 'demo_' . $token . '@agendatina.site';
                $rutaDemo = 'demo-' . $token;
                $hash = password_hash('demo1234', PASSWORD_DEFAULT);
                
                $pdo->prepare("INSERT INTO usuarios (nombre_completo, email, password, role, fecha_creacion) VALUES ('Agendatina DEMO', ?, ?, 'admin', NOW())")->execute([$emailDemo, $hash]);
                $newUserId = $pdo->lastInsertId();
                
                $pdo->prepare("INSERT INTO negocios (nombre_fantasia, ruta, plan, max_profesionales, estado_pago, fecha_alta) VALUES ('Agendatina', ?, 'Premium', 5, 'activo', NOW())")->execute([$rutaDemo]);
                $newNegocioId = $pdo->lastInsertId();
                
                $pdo->prepare("INSERT INTO personal_negocio (id_negocio, id_usuario, rol_en_local) VALUES (?, ?, 'admin')")->execute([$newNegocioId, $newUserId]);

                require_once __DIR__ . '/helpers/demo_helper.php';
                asegurarDatosDemo($pdo, $newNegocioId);

                $_SESSION['user_id'] = $newUserId;
                $_SESSION['id_negocio'] = $newNegocioId;
                $_SESSION['nombre_completo'] = 'Agendatina DEMO';
                $_SESSION['nombre_negocio'] = 'Agendatina';
                $_SESSION['ruta_negocio'] = $rutaDemo;
                $_SESSION['rol_en_local'] = 'admin';
                $_SESSION['is_demo'] = true;
            } catch(Throwable $eAuto) {
                error_log("Error al auto-crear sesión demo en perfil.php: " . $eAuto->getMessage());
            }
        }
    }

    if (!isset($_SESSION['user_id']) || !isset($_SESSION['id_negocio'])) {
        session_write_close();
        echo json_encode(['success' => false, 'error' => 'No autorizado. Inicia sesión.']);
        exit;
    }

    $id_usuario = $_SESSION['user_id'];
    $id_negocio = $_SESSION['id_negocio'];

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        // Obtener datos de usuario
        try { $pdo->query("SELECT email_verificado FROM usuarios LIMIT 1"); } 
        catch(Throwable $e) { try { $pdo->exec("ALTER TABLE usuarios ADD COLUMN email_verificado TINYINT DEFAULT 0"); } catch(Throwable $ex) {} }

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
                } catch (Throwable $ePerms) {
                    $user['permisos'] = $defaultProfPerms;
                }
            }
            $_SESSION['permisos'] = $user['permisos'];
        }

        // Auto-Migración para contador mensual de WhatsApp y Descuentos por negocio
        try { $pdo->query("SELECT wpp_enviados_mes FROM negocios LIMIT 1"); } 
        catch(Throwable $e) { try { $pdo->exec("ALTER TABLE negocios ADD COLUMN wpp_enviados_mes INT DEFAULT 0"); } catch(Throwable $ex) {} }
        
        try { $pdo->query("SELECT mes_wpp_contador FROM negocios LIMIT 1"); } 
        catch(Throwable $e) { try { $pdo->exec("ALTER TABLE negocios ADD COLUMN mes_wpp_contador VARCHAR(7) DEFAULT NULL"); } catch(Throwable $ex) {} }

        try { $pdo->query("SELECT codigo_descuento FROM negocios LIMIT 1"); } 
        catch(Throwable $e) { try { $pdo->exec("ALTER TABLE negocios ADD COLUMN codigo_descuento VARCHAR(50) DEFAULT NULL"); } catch(Throwable $ex) {} }
        
        try { $pdo->query("SELECT descuento_aplicado_pct FROM negocios LIMIT 1"); } 
        catch(Throwable $e) { try { $pdo->exec("ALTER TABLE negocios ADD COLUMN descuento_aplicado_pct INT DEFAULT 0"); } catch(Throwable $ex) {} }

        // Reseteo mensual automático si cambió el mes (YYYY-MM)
        $currentMonthStr = date('Y-m');
        $stmtN = $pdo->prepare("SELECT nombre_fantasia, ruta, plan, estado_pago, ultimo_pago, fecha_alta, comprobante, wpp_enviados_mes, mes_wpp_contador, codigo_descuento, descuento_aplicado_pct FROM negocios WHERE id = ?");
        $stmtN->execute([$id_negocio]);
        $business = $stmtN->fetch(PDO::FETCH_ASSOC);

        // Si es un usuario Demo pero la cuenta expiró o no se encontró en la BD clonada, recrear entorno aislado para esta sesión
        if ((!$user || !$business) && (isset($_SESSION['is_demo']) && $_SESSION['is_demo'] === true || isset($_GET['n']) && strpos(strtolower($_GET['n']), 'demo') === 0)) {
            try {
                $token = substr(md5(session_id() . microtime() . rand(1000, 9999)), 0, 8);
                $emailDemo = 'demo_' . $token . '@agendatina.site';
                $rutaDemo = 'demo-' . $token;
                $hash = password_hash('demo1234', PASSWORD_DEFAULT);
                
                $pdo->prepare("INSERT INTO usuarios (nombre_completo, email, password, role, fecha_creacion) VALUES ('Agendatina DEMO', ?, ?, 'admin', NOW())")->execute([$emailDemo, $hash]);
                $newUserId = $pdo->lastInsertId();
                
                $pdo->prepare("INSERT INTO negocios (nombre_fantasia, ruta, plan, max_profesionales, estado_pago, fecha_alta) VALUES ('Agendatina', ?, 'Premium', 5, 'activo', NOW())")->execute([$rutaDemo]);
                $newNegocioId = $pdo->lastInsertId();
                
                $pdo->prepare("INSERT INTO personal_negocio (id_negocio, id_usuario, rol_en_local) VALUES (?, ?, 'admin')")->execute([$newNegocioId, $newUserId]);
                
                $_SESSION['user_id'] = $newUserId;
                $_SESSION['id_negocio'] = $newNegocioId;
                $_SESSION['nombre_completo'] = 'Agendatina DEMO';
                $_SESSION['nombre_negocio'] = 'Agendatina';
                $_SESSION['ruta_negocio'] = $rutaDemo;
                $_SESSION['rol_en_local'] = 'admin';
                $_SESSION['is_demo'] = true;

                $id_usuario = $newUserId;
                $id_negocio = $newNegocioId;

                $stmtU->execute([$newUserId]);
                $user = $stmtU->fetch(PDO::FETCH_ASSOC);
                $stmtN->execute([$newNegocioId]);
                $business = $stmtN->fetch(PDO::FETCH_ASSOC);
            } catch(Throwable $eFallback) {
                error_log("Error en recreación demo en perfil.php: " . $eFallback->getMessage());
            }
        }

        if ($business) {
            if ((isset($_SESSION['is_demo']) && $_SESSION['is_demo'] === true) || (isset($business['ruta']) && strpos($business['ruta'], 'demo') === 0)) {
                require_once __DIR__ . '/helpers/demo_helper.php';
                asegurarDatosDemo($pdo, $id_negocio);
            }

            if ($business['mes_wpp_contador'] !== $currentMonthStr) {
                try {
                    $pdo->prepare("UPDATE negocios SET wpp_enviados_mes = 0, mes_wpp_contador = ? WHERE id = ?")->execute([$currentMonthStr, $id_negocio]);
                    $business['wpp_enviados_mes'] = 0;
                    $business['mes_wpp_contador'] = $currentMonthStr;
                } catch(Throwable $eUp) {}
            }

            // Cantidad de profesionales registrados en el equipo de este negocio
            $profCount = 1;
            try {
                $stmtProf = $pdo->prepare("SELECT COUNT(*) FROM personal_negocio WHERE id_negocio = ?");
                $stmtProf->execute([$id_negocio]);
                $profCount = max(1, (int)$stmtProf->fetchColumn());
            } catch(Throwable $eProf) {}

            $planLower = strtolower($business['plan'] ?? 'basico');
            $isBasic = strpos($planLower, 'básico') !== false || strpos($planLower, 'basico') !== false || strpos($planLower, 'simple') !== false;
            $isPremium = strpos($planLower, 'premium') !== false || strpos($planLower, 'completo') !== false;
            
            $extraProfs = max(0, $profCount - 1);
            $wppBase = $isBasic ? 0 : ($isPremium ? 100 : 50);
            $wppBonus = $isBasic ? 0 : ($extraProfs * 10);
            $wppLimiteTotal = $wppBase + $wppBonus;
            $wppUsados = (int)($business['wpp_enviados_mes'] ?? 0);
            $wppExcedentes = max(0, $wppUsados - $wppLimiteTotal);
            $wppCostoExtra = $wppExcedentes * 60;

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
            session_write_close();
            echo json_encode(['success' => false, 'error' => 'No autorizado. Inicia sesión nuevamente.']);
            exit;
        }

        // Obtener configuración web
        try {
            $stmtC = $pdo->prepare("SELECT color_primario, color_secundario, color_fondo, colores_extra_json FROM configuracion_web WHERE id_negocio = ?");
            $stmtC->execute([$id_negocio]);
            $config = $stmtC->fetch(PDO::FETCH_ASSOC);
        } catch(Throwable $e) { $config = null; }

        // Notificaciones
        try { $pdo->query("SELECT id FROM notificaciones LIMIT 1"); } 
        catch(Throwable $e) { 
            try { $pdo->exec("CREATE TABLE notificaciones (id INT AUTO_INCREMENT PRIMARY KEY, id_negocio INT NULL, titulo VARCHAR(255), mensaje TEXT, fecha DATETIME DEFAULT CURRENT_TIMESTAMP)"); } catch(Throwable $ex) {}
        }

        $notificaciones = [];
        try {
            $stmtNotif = $pdo->prepare("SELECT * FROM notificaciones WHERE id_negocio = ? OR id_negocio IS NULL ORDER BY fecha DESC LIMIT 20");
            $stmtNotif->execute([$id_negocio]);
            $notificaciones = $stmtNotif->fetchAll(PDO::FETCH_ASSOC) ?: [];
        } catch(Throwable $eNotif) {}

        session_write_close();
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

        $pdo->beginTransaction();

        // 1. Actualizar Nombre Completo del Usuario
        if (!empty($nombre)) {
            $pdo->prepare("UPDATE usuarios SET nombre_completo = ? WHERE id = ?")->execute([$nombre, $id_usuario]);
            $_SESSION['nombre_completo'] = $nombre;
        }

        // 2. Actualizar Nombre del Negocio (Solo Administrador)
        if (!empty($nombre_fantasia)) {
            $userRole = $_SESSION['rol_en_local'] ?? 'admin';
            if ($userRole !== 'admin' && (!isset($_SESSION['is_demo']) || $_SESSION['is_demo'] !== true)) {
                throw new Exception("Solo el administrador del local puede modificar el nombre del negocio.");
            }
            $pdo->prepare("UPDATE negocios SET nombre_fantasia = ? WHERE id = ?")->execute([$nombre_fantasia, $id_negocio]);
        }

        // 3. Actualizar Contraseña
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

        // 4. Actualizar Ruta (verificando que sea única)
        if (!empty($ruta)) {
            $userRole = $_SESSION['rol_en_local'] ?? 'admin';
            if ($userRole !== 'admin' && (!isset($_SESSION['is_demo']) || $_SESSION['is_demo'] !== true)) {
                throw new Exception("Solo el administrador del local puede modificar la dirección de la página web.");
            }

            $stmtCheck = $pdo->prepare("SELECT id FROM negocios WHERE (ruta = ? OR subdominio = ?) AND id != ?");
            $stmtCheck->execute([$ruta, $ruta, $id_negocio]);
            if ($stmtCheck->fetch()) {
                throw new Exception("La URL o subdominio '$ruta' ya está en uso por otro negocio. Elige otra.");
            }

            $pdo->prepare("UPDATE negocios SET ruta = ?, subdominio = ? WHERE id = ?")->execute([$ruta, $ruta, $id_negocio]);
            $_SESSION['ruta_negocio'] = $ruta;
        }

        // 5. Actualizar Colores de la Web
        if ($color_primario || $color_secundario || $color_fondo || $colores_extra_json) {
            $stmtCheckConfig = $pdo->prepare("SELECT id FROM configuracion_web WHERE id_negocio = ?");
            $stmtCheckConfig->execute([$id_negocio]);
            
            if ($stmtCheckConfig->fetch()) {
                $sql = "UPDATE configuracion_web SET ";
                $params = [];
                if ($color_primario) { $sql .= "color_primario = ?, "; $params[] = $color_primario; }
                if ($color_secundario) { $sql .= "color_secundario = ?, "; $params[] = $color_secundario; }
                if ($color_fondo) { $sql .= "color_fondo = ?, "; $params[] = $color_fondo; }
                if ($colores_extra_json) { $sql .= "colores_extra_json = ?, "; $params[] = $colores_extra_json; }
                $sql = rtrim($sql, ', ') . " WHERE id_negocio = ?";
                $params[] = $id_negocio;
                
                $pdo->prepare($sql)->execute($params);
            } else {
                $pdo->prepare("INSERT INTO configuracion_web (id_negocio, color_primario, color_secundario, color_fondo, colores_extra_json) VALUES (?, ?, ?, ?, ?)")
                    ->execute([$id_negocio, $color_primario ?: '#D11149', $color_secundario ?: '#FC8712', $color_fondo ?: '#F8FAFC', $colores_extra_json]);
            }
        }

        $pdo->commit();
        session_write_close();
        echo json_encode(['success' => true, 'message' => 'Perfil y configuración actualizados correctamente.']);
        exit;
    }

} catch (Throwable $t) {
    if (isset($pdo) && $pdo->inTransaction()) {
        try { $pdo->rollBack(); } catch (Throwable $eRb) {}
    }
    @session_write_close();
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['success' => false, 'error' => 'Error en el servidor: ' . $t->getMessage()]);
    exit;
}
?>