<?php
session_start();
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/conexion.php';

// Leer datos enviados por JSON o POST
$rawInput = file_get_contents('php://input');
$jsonInput = !empty($rawInput) ? json_decode($rawInput, true) : null;
$method = $_SERVER['REQUEST_METHOD'];

// 1. Detección y validación de negocio
$id_negocio = null;
$reqBizId = (int)($jsonInput['id_negocio'] ?? $_POST['id_negocio'] ?? $_GET['id_negocio'] ?? 0);

// Si se envía id_negocio explícito y el usuario está autenticado, validar que tenga acceso administrativo
if ($reqBizId > 0 && isset($_SESSION['user_id'])) {
    $stmtCheckAccess = $pdo->prepare("SELECT rol_en_local FROM personal_negocio WHERE id_negocio = ? AND id_usuario = ? LIMIT 1");
    $stmtCheckAccess->execute([$reqBizId, $_SESSION['user_id']]);
    $userRoleInBiz = $stmtCheckAccess->fetchColumn();
    if ($userRoleInBiz) {
        $id_negocio = $reqBizId;
        $_SESSION['id_negocio'] = $id_negocio;
        $_SESSION['rol_en_local'] = $userRoleInBiz;
    }
}

// Fallback por slug / subdominio / id público en GET
if (!$id_negocio && $method === 'GET' && isset($_GET['n']) && !empty($_GET['n'])) {
    $slug = trim($_GET['n']);
    $stmtSlug = $pdo->prepare("SELECT id FROM negocios WHERE ruta = :s OR subdominio = :s OR id = :id LIMIT 1");
    $stmtSlug->execute(['s' => $slug, 'id' => (int)$slug]);
    $idFound = $stmtSlug->fetchColumn();
    if ($idFound) {
        $id_negocio = (int)$idFound;
    } else {
        $stmtCfg = $pdo->prepare("SELECT id_negocio FROM configuracion_web WHERE url_logo LIKE :s OR id_negocio = :id LIMIT 1");
        $stmtCfg->execute(['s' => "%$slug%", 'id' => (int)$slug]);
        $rowCfg = $stmtCfg->fetch(PDO::FETCH_ASSOC);
        if ($rowCfg) {
            $id_negocio = (int)$rowCfg['id_negocio'];
        }
    }
    if (!$id_negocio) {
        echo json_encode([]);
        exit;
    }
}

// Fallback a sesión
if (!$id_negocio) {
    $id_negocio = (int)($_SESSION['id_negocio'] ?? 0);
}

// Fallback si la sesión tiene user_id pero id_negocio quedó en 0 o desincronizado
if (!$id_negocio && isset($_SESSION['user_id'])) {
    $stmtDefaultBiz = $pdo->prepare("SELECT id_negocio, rol_en_local FROM personal_negocio WHERE id_usuario = ? ORDER BY (rol_en_local = 'admin') DESC, id_negocio DESC LIMIT 1");
    $stmtDefaultBiz->execute([$_SESSION['user_id']]);
    $defRow = $stmtDefaultBiz->fetch(PDO::FETCH_ASSOC);
    if ($defRow) {
        $id_negocio = (int)$defRow['id_negocio'];
        $_SESSION['id_negocio'] = $id_negocio;
        $_SESSION['rol_en_local'] = $defRow['rol_en_local'];
    }
}

if (!$id_negocio) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Acceso denegado. Sesión no válida.']);
    exit;
}

// Asegurar la existencia de la columna permisos en personal_negocio
try { $pdo->exec("ALTER TABLE personal_negocio ADD COLUMN permisos TEXT NULL"); } catch(Exception $e) {}

// Validar rol administrativo para operaciones de escritura (POST, PUT, DELETE)
$userRole = $_SESSION['rol_en_local'] ?? null;
if (!$userRole && isset($_SESSION['user_id'])) {
    $stmtCheckRole = $pdo->prepare("SELECT rol_en_local FROM personal_negocio WHERE id_negocio = ? AND id_usuario = ? LIMIT 1");
    $stmtCheckRole->execute([$id_negocio, $_SESSION['user_id']]);
    $userRole = $stmtCheckRole->fetchColumn();
    if ($userRole) $_SESSION['rol_en_local'] = $userRole;
}

if ($method !== 'GET' && $userRole !== 'admin') {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Acceso denegado. Solo el administrador del negocio puede modificar el equipo y sus permisos.']);
    exit;
}

$defaultProfPerms = ['agenda' => 1, 'ver_todos_turnos' => 1, 'web' => 0, 'servicios' => 0, 'estadisticas' => 0, 'equipo' => 0];
$defaultAdminPerms = ['agenda' => 1, 'ver_todos_turnos' => 1, 'web' => 1, 'servicios' => 1, 'estadisticas' => 1, 'equipo' => 1];

/**
 * Resolver resiliente de profesional en un negocio:
 * Busca por id_usuario o por id de personal_negocio (pn.id).
 * Si no lo encuentra en $id_negocio, verifica si pertenece a algún otro negocio
 * donde el usuario en sesión sea administrador, y si es así, sincroniza el negocio activo.
 */
function resolverPersonalNegocio($pdo, &$id_negocio, $target_id, $admin_user_id = null) {
    $target_id = (int)$target_id;
    if ($target_id <= 0) return null;

    // 1. Buscar en el negocio activo por id_usuario O por id de fila personal_negocio
    if ($id_negocio) {
        $stmt = $pdo->prepare("
            SELECT pn.id AS id_personal, pn.id_negocio, pn.id_usuario, pn.rol_en_local, pn.permisos, u.nombre_completo, u.email
            FROM personal_negocio pn
            JOIN usuarios u ON pn.id_usuario = u.id
            WHERE pn.id_negocio = :id_negocio AND (pn.id_usuario = :target_id OR pn.id = :target_id)
            ORDER BY (pn.id_usuario = :target_id) DESC
            LIMIT 1
        ");
        $stmt->execute(['id_negocio' => $id_negocio, 'target_id' => $target_id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($row) return $row;
    }

    // 2. Si no se encontró en el negocio activo y tenemos el admin_user_id, buscar en cualquier negocio administrado por este admin
    if ($admin_user_id) {
        $stmtAdmin = $pdo->prepare("
            SELECT pn.id AS id_personal, pn.id_negocio, pn.id_usuario, pn.rol_en_local, pn.permisos, u.nombre_completo, u.email
            FROM personal_negocio pn
            JOIN usuarios u ON pn.id_usuario = u.id
            WHERE (pn.id_usuario = :target_id OR pn.id = :target_id)
              AND pn.id_negocio IN (
                  SELECT id_negocio FROM personal_negocio WHERE id_usuario = :admin_id AND rol_en_local = 'admin'
              )
            ORDER BY (pn.id_usuario = :target_id) DESC, pn.id DESC
            LIMIT 1
        ");
        $stmtAdmin->execute([
            'target_id' => $target_id,
            'admin_id' => $admin_user_id
        ]);
        $row = $stmtAdmin->fetch(PDO::FETCH_ASSOC);
        if ($row) {
            $id_negocio = (int)$row['id_negocio'];
            $_SESSION['id_negocio'] = $id_negocio;
            $_SESSION['rol_en_local'] = 'admin';
            return $row;
        }
    }

    return null;
}

if ($method === 'GET') {
    try {
        // Verificar si es sesión o negocio Demo para asegurar integrantes del equipo
        $isDemoContext = (isset($_SESSION['is_demo']) && $_SESSION['is_demo'] === true) || 
                         (isset($_SESSION['email']) && strpos($_SESSION['email'], 'demo') !== false);
        if ($isDemoContext) {
            require_once __DIR__ . '/helpers/demo_helper.php';
            asegurarDatosDemo($pdo, $id_negocio);
        }

        // Obtener la lista de profesionales e integrantes del equipo (deduplicando usuarios)
        $stmt = $pdo->prepare("
            SELECT u.id, MIN(pn.id) AS id_personal, u.nombre_completo, u.email, MIN(pn.rol_en_local) AS rol_en_local, MAX(pn.permisos) AS permisos
            FROM usuarios u
            JOIN personal_negocio pn ON u.id = pn.id_usuario
            WHERE pn.id_negocio = :id_negocio
            GROUP BY u.id, u.nombre_completo, u.email
            ORDER BY (MIN(pn.rol_en_local) = 'admin') DESC, u.id ASC
        ");
        $stmt->execute(['id_negocio' => $id_negocio]);
        $profesionales = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Auto-reparación: Si sólo hay 1 o 0 integrantes en sesión Demo, asegurar equipo demo
        if (count($profesionales) <= 1 && $isDemoContext) {
            require_once __DIR__ . '/helpers/demo_helper.php';
            asegurarDatosDemo($pdo, $id_negocio);
            $stmt->execute(['id_negocio' => $id_negocio]);
            $profesionales = $stmt->fetchAll(PDO::FETCH_ASSOC);
        }

        // Auto-reparación: Si no se encuentran integrantes, vincular al dueño de la sesión activa
        if (empty($profesionales) && isset($_SESSION['user_id'])) {
            try {
                $stmtFix = $pdo->prepare("INSERT IGNORE INTO personal_negocio (id_negocio, id_usuario, rol_en_local) VALUES (?, ?, 'admin')");
                $stmtFix->execute([$id_negocio, $_SESSION['user_id']]);

                $stmt->execute(['id_negocio' => $id_negocio]);
                $profesionales = $stmt->fetchAll(PDO::FETCH_ASSOC);
            } catch (Exception $eFix) {}
        }

        foreach ($profesionales as &$p) {
            $p['id_usuario'] = (int)$p['id'];
            $p['id_personal'] = (int)$p['id_personal'];
            $p['id_negocio'] = (int)$id_negocio;
            if ($p['rol_en_local'] === 'admin') {
                $p['permisos'] = $defaultAdminPerms;
            } else {
                $pPerms = !empty($p['permisos']) ? json_decode($p['permisos'], true) : null;
                $p['permisos'] = is_array($pPerms) ? array_merge($defaultProfPerms, $pPerms) : $defaultProfPerms;
            }
        }
        unset($p);

        // Obtener el límite dictado por el plan y de la tienda (máximo 5 por el momento para todos)
        $stmtLimit = $pdo->prepare("SELECT max_profesionales, plan FROM negocios WHERE id = :id");
        $stmtLimit->execute(['id' => $id_negocio]);
        $bizRow = $stmtLimit->fetch(PDO::FETCH_ASSOC) ?: [];
        $max_profesionales = (int)($bizRow['max_profesionales'] ?? 5);
        if ($max_profesionales < 1) $max_profesionales = 5;
        if ($max_profesionales > 5) $max_profesionales = 5;

        $planStr = strtolower($bizRow['plan'] ?? 'basico');
        $canEditPermissions = (strpos($planStr, 'profesional') !== false || strpos($planStr, 'premium') !== false || strpos($planStr, 'completo') !== false);

        echo json_encode([
            'success' => true, 
            'id_negocio' => (int)$id_negocio,
            'data' => $profesionales, 
            'limite' => $max_profesionales,
            'can_edit_permissions' => $canEditPermissions,
            'plan' => $planStr
        ]);
    } catch (Exception $e) {
        echo json_encode(['success' => false, 'error' => 'Error al cargar el equipo: ' . $e->getMessage()]);
    }
} elseif ($method === 'PUT') {
    $data = $jsonInput ?: (json_decode(file_get_contents('php://input'), true) ?: $_POST);
    $action = $data['action'] ?? '';

    if ($action === 'actualizar_permisos') {
        $target_id = (int)($data['id_usuario'] ?? $data['id'] ?? $data['id_personal'] ?? 0);
        $permisos = $data['permisos'] ?? null;

        if (!$target_id || !is_array($permisos)) {
            echo json_encode(['success' => false, 'error' => 'Datos incompletos para actualizar permisos.']);
            exit;
        }

        $personal = resolverPersonalNegocio($pdo, $id_negocio, $target_id, $_SESSION['user_id'] ?? null);

        if (!$personal) {
            echo json_encode(['success' => false, 'error' => 'El profesional no pertenece a este negocio.']);
            exit;
        }
        if ($personal['rol_en_local'] === 'admin') {
            echo json_encode(['success' => false, 'error' => 'No es necesario modificar permisos para la cuenta del Administrador principal.']);
            exit;
        }

        $stmtPlan = $pdo->prepare("SELECT plan FROM negocios WHERE id = ?");
        $stmtPlan->execute([$id_negocio]);
        $planStr = strtolower($stmtPlan->fetchColumn() ?: 'basico');

        if (strpos($planStr, 'profesional') === false && strpos($planStr, 'premium') === false && strpos($planStr, 'completo') === false) {
            echo json_encode(['success' => false, 'error' => 'La asignación personalizada de roles y permisos a profesionales requiere Plan Profesional o Plan Premium.']);
            exit;
        }

        $permisosJson = json_encode([
            'agenda' => !empty($permisos['agenda']) ? 1 : 0,
            'ver_todos_turnos' => !empty($permisos['ver_todos_turnos']) ? 1 : 0,
            'web' => !empty($permisos['web']) ? 1 : 0,
            'servicios' => !empty($permisos['servicios']) ? 1 : 0,
            'estadisticas' => !empty($permisos['estadisticas']) ? 1 : 0,
            'equipo' => !empty($permisos['equipo']) ? 1 : 0
        ]);

        $stmtUpd = $pdo->prepare("UPDATE personal_negocio SET permisos = ? WHERE id = ?");
        $stmtUpd->execute([$permisosJson, $personal['id_personal']]);

        $stmtUpd2 = $pdo->prepare("UPDATE personal_negocio SET permisos = ? WHERE id_negocio = ? AND id_usuario = ?");
        $stmtUpd2->execute([$permisosJson, $id_negocio, $personal['id_usuario']]);

        echo json_encode(['success' => true, 'permisos' => json_decode($permisosJson, true)]);
        exit;
    } elseif ($action === 'actualizar_datos') {
        $target_id = (int)($data['id_usuario'] ?? $data['id'] ?? $data['id_personal'] ?? 0);
        $nombre = trim($data['nombre_completo'] ?? $data['nombre'] ?? '');
        $email = filter_var(trim($data['email'] ?? ''), FILTER_SANITIZE_EMAIL);
        $password = trim($data['password'] ?? '');

        if (!$target_id || !$nombre || !$email) {
            echo json_encode(['success' => false, 'error' => 'Por favor completa el Nombre y Email del profesional.']);
            exit;
        }

        $personal = resolverPersonalNegocio($pdo, $id_negocio, $target_id, $_SESSION['user_id'] ?? null);

        if (!$personal) {
            echo json_encode(['success' => false, 'error' => 'El profesional no pertenece a este negocio.']);
            exit;
        }

        $actualUserId = (int)$personal['id_usuario'];
        $oldName = trim($personal['nombre_completo'] ?? '');

        $stmtCheck = $pdo->prepare("SELECT id FROM usuarios WHERE email = ? AND id != ? LIMIT 1");
        $stmtCheck->execute([$email, $actualUserId]);
        if ($stmtCheck->fetch()) {
            echo json_encode(['success' => false, 'error' => "El correo '$email' ya pertenece a otro usuario en la plataforma."]);
            exit;
        }

        if (!empty($password)) {
            $hash = password_hash($password, PASSWORD_DEFAULT);
            $stmtUpd = $pdo->prepare("UPDATE usuarios SET nombre_completo = ?, email = ?, password = ? WHERE id = ?");
            $stmtUpd->execute([$nombre, $email, $hash, $actualUserId]);
            try { $pdo->prepare("UPDATE usuarios SET debe_cambiar_pass = 0 WHERE id = ?")->execute([$actualUserId]); } catch (Throwable $eDcp) {}
        } else {
            $stmtUpd = $pdo->prepare("UPDATE usuarios SET nombre_completo = ?, email = ? WHERE id = ?");
            $stmtUpd->execute([$nombre, $email, $actualUserId]);
        }

        // Sincronizar nombre en servicios y configuracion_web
        if ($oldName && $nombre !== $oldName) {
            try {
                $stmtUpdSvc = $pdo->prepare("UPDATE servicios SET profesional = :new_name, email_profesional = :email WHERE id_negocio = :id_negocio AND (profesional = :old_name OR email_profesional = :old_email)");
                $stmtUpdSvc->execute([
                    'new_name' => $nombre,
                    'email' => $email,
                    'id_negocio' => $id_negocio,
                    'old_name' => $oldName,
                    'old_email' => $personal['email']
                ]);
            } catch (Throwable $eSvc) {}

            try {
                $stmtCw = $pdo->prepare("SELECT profesionales_json FROM configuracion_web WHERE id_negocio = ?");
                $stmtCw->execute([$id_negocio]);
                $cwRow = $stmtCw->fetch(PDO::FETCH_ASSOC);
                if ($cwRow && !empty($cwRow['profesionales_json'])) {
                    $profsList = json_decode($cwRow['profesionales_json'], true);
                    if (is_array($profsList)) {
                        $cwModified = false;
                        foreach ($profsList as &$profItem) {
                            if (isset($profItem['nombre']) && (trim($profItem['nombre']) === $oldName || trim($profItem['nombre']) === $nombre)) {
                                $profItem['nombre'] = $nombre;
                                $cwModified = true;
                            }
                        }
                        unset($profItem);
                        if ($cwModified) {
                            $pdo->prepare("UPDATE configuracion_web SET profesionales_json = ? WHERE id_negocio = ?")
                                ->execute([json_encode($profsList, JSON_UNESCAPED_UNICODE), $id_negocio]);
                        }
                    }
                }
            } catch (Throwable $eCw) {}
        }

        echo json_encode(['success' => true]);
        exit;
    } else {
        echo json_encode(['success' => false, 'error' => 'Acción no válida.']);
        exit;
    }
} elseif ($method === 'POST') {
    $data = $jsonInput ?: (json_decode(file_get_contents('php://input'), true) ?: $_POST);
    
    $nombre = trim($data['nombre'] ?? '');
    $email = filter_var(trim($data['email'] ?? ''), FILTER_SANITIZE_EMAIL);
    $password = trim($data['password'] ?? '');
    $permisosInput = $data['permisos'] ?? null;
    $permisosFinal = is_array($permisosInput) ? array_merge($defaultProfPerms, $permisosInput) : $defaultProfPerms;
    $permisosJson = json_encode($permisosFinal);

    if (!$nombre || !$email) {
        echo json_encode(['success' => false, 'error' => 'Por favor completa el Nombre y Correo Electrónico.']);
        exit;
    }

    try {
        $pdo->beginTransaction();

        // Validar límite
        $stmtLimit = $pdo->prepare("SELECT max_profesionales, plan FROM negocios WHERE id = :id FOR UPDATE");
        $stmtLimit->execute(['id' => $id_negocio]);
        $bizInfo = $stmtLimit->fetch(PDO::FETCH_ASSOC) ?: [];
        $planStr = strtolower($bizInfo['plan'] ?? 'basico');
        
        $max_profesionales = (int)($bizInfo['max_profesionales'] ?? 0);
        if ($max_profesionales <= 1) {
            if (strpos($planStr, 'premium') !== false) $max_profesionales = 20;
            elseif (strpos($planStr, 'profesional') !== false) $max_profesionales = 5;
            else $max_profesionales = 3;
        }

        $stmtCount = $pdo->prepare("SELECT COUNT(*) FROM personal_negocio WHERE id_negocio = :id");
        $stmtCount->execute(['id' => $id_negocio]);
        $total_members = (int)$stmtCount->fetchColumn();

        if ($total_members >= $max_profesionales) {
            require_once __DIR__ . '/helpers/notificar_admin_helper.php';
            notificarSuperAdminAlert($pdo, 'Solicitud Ampliación Equipo', "El negocio intentó registrar más profesionales pero alcanzó el límite de su plan ({$max_profesionales} integrantes).", $id_negocio);
            try {
                $pdo->exec("CREATE TABLE IF NOT EXISTS `historial_cambios_negocio` (
                    `id` INT AUTO_INCREMENT PRIMARY KEY,
                    `id_negocio` INT NOT NULL,
                    `tipo_evento` VARCHAR(50) NOT NULL,
                    `valor_anterior` VARCHAR(100) DEFAULT NULL,
                    `valor_nuevo` VARCHAR(100) DEFAULT NULL,
                    `detalle` TEXT DEFAULT NULL,
                    `origen` VARCHAR(50) DEFAULT 'cliente',
                    `fecha` DATETIME DEFAULT CURRENT_TIMESTAMP,
                    KEY `idx_negocio_fecha` (`id_negocio`, `fecha`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

                $stmtHistAmp = $pdo->prepare("INSERT INTO historial_cambios_negocio (id_negocio, tipo_evento, valor_anterior, valor_nuevo, detalle, origen, fecha) VALUES (?, 'ampliacion_personal', ?, ?, ?, 'cliente', NOW())");
                $stmtHistAmp->execute([$id_negocio, (string)$max_profesionales, (string)($max_profesionales + 1), "Intento de agregar profesional ({$nombre} - {$email}) excediendo cupo de {$max_profesionales} integrantes"]);
            } catch(Throwable $eHAmp) {}
            throw new Exception("Has alcanzado el límite máximo de $max_profesionales integrantes en tu equipo para tu plan. Si necesitas ampliar la capacidad, contacta a soporte.");
        }

        // Verificar si el usuario ya existe en la plataforma
        $stmtCheck = $pdo->prepare("SELECT id FROM usuarios WHERE email = :email LIMIT 1");
        $stmtCheck->execute(['email' => $email]);
        $existingUser = $stmtCheck->fetch(PDO::FETCH_ASSOC);

        $insertedPnId = 0;
        if ($existingUser) {
            $id_usuario = (int)$existingUser['id'];

            // Verificar si ya está vinculado a este negocio específico
            $stmtPnCheck = $pdo->prepare("SELECT id, rol_en_local FROM personal_negocio WHERE id_negocio = ? AND id_usuario = ? LIMIT 1");
            $stmtPnCheck->execute([$id_negocio, $id_usuario]);
            $existingPn = $stmtPnCheck->fetch(PDO::FETCH_ASSOC);

            if ($existingPn) {
                if ($existingPn['rol_en_local'] === 'admin') {
                    throw new Exception("El correo '$email' pertenece al Administrador/Dueño principal del negocio y ya forma parte del equipo.");
                } else {
                    throw new Exception("El profesional con el correo '$email' ya forma parte de tu equipo.");
                }
            }

            // Vincular la cuenta existente a este negocio
            $stmtPn = $pdo->prepare("INSERT INTO personal_negocio (id_negocio, id_usuario, rol_en_local, permisos) VALUES (?, ?, 'profesional', ?)");
            $stmtPn->execute([$id_negocio, $id_usuario, $permisosJson]);
            $insertedPnId = (int)$pdo->lastInsertId();
        } else {
            // Crear usuario nuevo (marcado para cambio obligatorio de contraseña en su primer inicio)
            if (empty($password)) {
                $password = bin2hex(random_bytes(8));
            }
            $hash = password_hash($password, PASSWORD_DEFAULT);
            try { $pdo->query("SELECT debe_cambiar_pass FROM usuarios LIMIT 1"); } 
            catch(Exception $e) { try { $pdo->exec("ALTER TABLE usuarios ADD COLUMN debe_cambiar_pass TINYINT DEFAULT 0"); } catch(Exception $e2) {} }

            try {
                $stmtUser = $pdo->prepare("INSERT INTO usuarios (nombre_completo, email, password, email_verificado, debe_cambiar_pass) VALUES (?, ?, ?, 1, 1)");
                $stmtUser->execute([$nombre, $email, $hash]);
            } catch (Exception $eMailCol) {
                $stmtUser = $pdo->prepare("INSERT INTO usuarios (nombre_completo, email, password, debe_cambiar_pass) VALUES (?, ?, ?, 1)");
                $stmtUser->execute([$nombre, $email, $hash]);
            }
            $id_usuario = (int)$pdo->lastInsertId();

            $stmtPn = $pdo->prepare("INSERT INTO personal_negocio (id_negocio, id_usuario, rol_en_local, permisos) VALUES (?, ?, 'profesional', ?)");
            $stmtPn->execute([$id_negocio, $id_usuario, $permisosJson]);
            $insertedPnId = (int)$pdo->lastInsertId();
        }

        $pdo->commit();

        $total_actual = $total_members + 1;
        try {
            require_once __DIR__ . '/helpers/notificar_admin_helper.php';
            notificarSuperAdminAlert($pdo, 'Gestión de Equipo / Nuevo Profesional', "Se registró un nuevo profesional en el equipo: {$nombre} ({$email}). Total actual: {$total_actual} / {$max_profesionales}.", $id_negocio);
        } catch (Exception $eNotif) {}

        echo json_encode([
            'success' => true,
            'id_usuario' => $id_usuario,
            'id_personal' => $insertedPnId,
            'id_negocio' => (int)$id_negocio
        ]);
    } catch (Exception $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
} elseif ($method === 'DELETE') {
    $target_id = (int)($_GET['id'] ?? $_GET['id_usuario'] ?? $jsonInput['id'] ?? $jsonInput['id_usuario'] ?? 0);
    if (!$target_id) { 
        echo json_encode(['success' => false, 'error' => 'Falta el ID del profesional.']); 
        exit; 
    }

    try {
        $pdo->beginTransaction();
        
        $personal = resolverPersonalNegocio($pdo, $id_negocio, $target_id, $_SESSION['user_id'] ?? null);

        if (!$personal) {
            throw new Exception("El profesional no pertenece a este negocio.");
        }

        if ($personal['rol_en_local'] === 'admin') {
            throw new Exception("No es posible eliminar la cuenta del Administrador/Dueño principal del negocio.");
        }

        $actualPnId = (int)$personal['id_personal'];
        $actualUserId = (int)$personal['id_usuario'];
        $profName = trim($personal['nombre_completo'] ?? '');

        // 1. Eliminar relación en personal_negocio
        $pdo->prepare("DELETE FROM personal_negocio WHERE id = ?")->execute([$actualPnId]);
        $pdo->prepare("DELETE FROM personal_negocio WHERE id_negocio = ? AND id_usuario = ?")->execute([$id_negocio, $actualUserId]);

        // 2. Si ya no pertenece a ningún otro negocio, eliminar usuario de la plataforma
        $stmtCheckOther = $pdo->prepare("SELECT COUNT(*) FROM personal_negocio WHERE id_usuario = ?");
        $stmtCheckOther->execute([$actualUserId]);
        if ((int)$stmtCheckOther->fetchColumn() === 0) {
            $pdo->prepare("DELETE FROM usuarios WHERE id = ?")->execute([$actualUserId]);
        }

        // 3. Desvincular de servicios de este negocio asignándolos a "Cualquiera (Sin preferencia)"
        if ($profName) {
            try {
                $stmtUpdSvcs = $pdo->prepare("UPDATE servicios SET profesional = 'Cualquiera (Sin preferencia)' WHERE id_negocio = ? AND (profesional = ? OR email_profesional = ?)");
                $stmtUpdSvcs->execute([$id_negocio, $profName, $personal['email']]);
            } catch (Throwable $eSvcs) {}

            // 4. Limpiar de configuracion_web.profesionales_json
            try {
                $stmtCw = $pdo->prepare("SELECT profesionales_json FROM configuracion_web WHERE id_negocio = ?");
                $stmtCw->execute([$id_negocio]);
                $cwRow = $stmtCw->fetch(PDO::FETCH_ASSOC);
                if ($cwRow && !empty($cwRow['profesionales_json'])) {
                    $profsList = json_decode($cwRow['profesionales_json'], true);
                    if (is_array($profsList)) {
                        $profsList = array_values(array_filter($profsList, function($it) use ($profName) {
                            return isset($it['nombre']) && trim($it['nombre']) !== $profName;
                        }));
                        $pdo->prepare("UPDATE configuracion_web SET profesionales_json = ? WHERE id_negocio = ?")
                            ->execute([json_encode($profsList, JSON_UNESCAPED_UNICODE), $id_negocio]);
                    }
                }
            } catch (Throwable $eCw) {}
        }
        
        $pdo->commit();
        echo json_encode(['success' => true]);
    } catch (Exception $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
}
?>