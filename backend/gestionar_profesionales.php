<?php
session_start();
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/conexion.php';

if (!isset($_SESSION['id_negocio'])) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Acceso denegado. Sesión no válida.']);
    exit;
}

$id_negocio = $_SESSION['id_negocio'];
$method = $_SERVER['REQUEST_METHOD'];

// Asegurar la existencia de la columna permisos en personal_negocio
try { $pdo->exec("ALTER TABLE personal_negocio ADD COLUMN permisos TEXT NULL"); } catch(Exception $e) {}

// Para POST, PUT y DELETE (crear, modificar o eliminar profesionales), exigir ser administrador
if ($method !== 'GET' && (!isset($_SESSION['rol_en_local']) || $_SESSION['rol_en_local'] !== 'admin')) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Acceso denegado. Solo el administrador del negocio puede modificar el equipo y sus permisos.']);
    exit;
}

$defaultProfPerms = ['agenda' => 1, 'ver_todos_turnos' => 1, 'web' => 0, 'servicios' => 0, 'estadisticas' => 0, 'equipo' => 0];
$defaultAdminPerms = ['agenda' => 1, 'ver_todos_turnos' => 1, 'web' => 1, 'servicios' => 1, 'estadisticas' => 1, 'equipo' => 1];

if ($method === 'GET') {
    try {
        // Obtener la lista de profesionales e integrantes del equipo (deduplicando usuarios)
        $stmt = $pdo->prepare("
            SELECT u.id, u.nombre_completo, u.email, MIN(pn.rol_en_local) AS rol_en_local, MAX(pn.permisos) AS permisos
            FROM usuarios u
            JOIN personal_negocio pn ON u.id = pn.id_usuario
            WHERE pn.id_negocio = :id_negocio
            GROUP BY u.id, u.nombre_completo, u.email
            ORDER BY (MIN(pn.rol_en_local) = 'admin') DESC, u.id ASC
        ");
        $stmt->execute(['id_negocio' => $id_negocio]);
        $profesionales = $stmt->fetchAll(PDO::FETCH_ASSOC);

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
            'data' => $profesionales, 
            'limite' => $max_profesionales,
            'can_edit_permissions' => $canEditPermissions,
            'plan' => $planStr
        ]);
    } catch (Exception $e) {
        echo json_encode(['success' => false, 'error' => 'Error al cargar el equipo: ' . $e->getMessage()]);
    }
} elseif ($method === 'PUT') {
    $data = json_decode(file_get_contents('php://input'), true);
    $action = $data['action'] ?? '';

    if ($action === 'actualizar_permisos') {
        $id_usuario = (int)($data['id_usuario'] ?? 0);
        $permisos = $data['permisos'] ?? null;

        if (!$id_usuario || !is_array($permisos)) {
            echo json_encode(['success' => false, 'error' => 'Datos incompletos para actualizar permisos.']);
            exit;
        }

        $stmtPlan = $pdo->prepare("SELECT plan FROM negocios WHERE id = ?");
        $stmtPlan->execute([$id_negocio]);
        $planStr = strtolower($stmtPlan->fetchColumn() ?: 'basico');

        if (strpos($planStr, 'profesional') === false && strpos($planStr, 'premium') === false && strpos($planStr, 'completo') === false) {
            echo json_encode(['success' => false, 'error' => 'La asignación personalizada de roles y permisos a profesionales requiere Plan Profesional o Plan Premium.']);
            exit;
        }

        $stmtRole = $pdo->prepare("SELECT rol_en_local FROM personal_negocio WHERE id_negocio = ? AND id_usuario = ?");
        $stmtRole->execute([$id_negocio, $id_usuario]);
        $role = $stmtRole->fetchColumn();

        if (!$role) {
            echo json_encode(['success' => false, 'error' => 'El profesional no pertenece a este negocio.']);
            exit;
        }
        if ($role === 'admin') {
            echo json_encode(['success' => false, 'error' => 'No es necesario modificar permisos para la cuenta del Administrador principal.']);
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

        $stmtUpd = $pdo->prepare("UPDATE personal_negocio SET permisos = ? WHERE id_negocio = ? AND id_usuario = ?");
        $stmtUpd->execute([$permisosJson, $id_negocio, $id_usuario]);

        echo json_encode(['success' => true, 'permisos' => json_decode($permisosJson, true)]);
        exit;
    } else {
        echo json_encode(['success' => false, 'error' => 'Acción no válida.']);
        exit;
    }
} elseif ($method === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true) ?: $_POST;
    
    $nombre = trim($data['nombre'] ?? '');
    $email = filter_var(trim($data['email'] ?? ''), FILTER_SANITIZE_EMAIL);
    $password = trim($data['password'] ?? '');
    $permisosInput = $data['permisos'] ?? null;
    $permisosFinal = is_array($permisosInput) ? array_merge($defaultProfPerms, $permisosInput) : $defaultProfPerms;
    $permisosJson = json_encode($permisosFinal);

    if (!$nombre || !$email || !$password) {
        echo json_encode(['success' => false, 'error' => 'Por favor completa todos los campos (Nombre, Email y Contraseña).']);
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
        $total_members = (int)$stmtCount->fetchColumn(); // Incluye al Administrador/Dueño + profesionales existentes

        if ($total_members >= $max_profesionales) {
            require_once __DIR__ . '/helpers/notificar_admin_helper.php';
            notificarSuperAdminAlert($pdo, 'Solicitud Ampliación Equipo', "El negocio intentó registrar más profesionales pero alcanzó el límite de su plan ({$max_profesionales} integrantes).", $id_negocio);
            throw new Exception("Has alcanzado el límite máximo de $max_profesionales integrantes en tu equipo para tu plan. Si necesitas ampliar la capacidad, contacta a soporte.");
        }

        // Verificar si el usuario ya existe en la plataforma
        $stmtCheck = $pdo->prepare("SELECT id FROM usuarios WHERE email = :email LIMIT 1");
        $stmtCheck->execute(['email' => $email]);
        $existingUser = $stmtCheck->fetch(PDO::FETCH_ASSOC);

        if ($existingUser) {
            $id_usuario = $existingUser['id'];

            // Verificar si ya está vinculado a este negocio específico
            $stmtPnCheck = $pdo->prepare("SELECT rol_en_local FROM personal_negocio WHERE id_negocio = ? AND id_usuario = ?");
            $stmtPnCheck->execute([$id_negocio, $id_usuario]);
            $existingRole = $stmtPnCheck->fetchColumn();

            if ($existingRole) {
                if ($existingRole === 'admin') {
                    throw new Exception("El correo '$email' pertenece al Administrador/Dueño principal del negocio y ya forma parte del equipo.");
                } else {
                    throw new Exception("El profesional con el correo '$email' ya forma parte de tu equipo.");
                }
            }

            // Vincular la cuenta existente a este negocio
            $stmtPn = $pdo->prepare("INSERT INTO personal_negocio (id_negocio, id_usuario, rol_en_local, permisos) VALUES (?, ?, 'profesional', ?)");
            $stmtPn->execute([$id_negocio, $id_usuario, $permisosJson]);
        } else {
            // Crear usuario nuevo (marcado para cambio obligatorio de contraseña en su primer inicio)
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
            $id_usuario = $pdo->lastInsertId();

            $stmtPn = $pdo->prepare("INSERT INTO personal_negocio (id_negocio, id_usuario, rol_en_local, permisos) VALUES (?, ?, 'profesional', ?)");
            $stmtPn->execute([$id_negocio, $id_usuario, $permisosJson]);
        }

        $pdo->commit();

        $total_actual = $total_members + 1;
        try {
            require_once __DIR__ . '/helpers/notificar_admin_helper.php';
            notificarSuperAdminAlert($pdo, 'Gestión de Equipo / Nuevo Profesional', "Se registró un nuevo profesional en el equipo: {$nombre} ({$email}). Total actual: {$total_actual} / {$max_profesionales}.", $id_negocio);
        } catch (Exception $eNotif) {}

        echo json_encode(['success' => true]);
    } catch (Exception $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
} elseif ($method === 'DELETE') {
    $id_usuario = $_GET['id'] ?? null;
    if (!$id_usuario) { echo json_encode(['success' => false, 'error' => 'Falta el ID del profesional.']); exit; }

    try {
        $pdo->beginTransaction();
        
        $stmtCheck = $pdo->prepare("SELECT rol_en_local FROM personal_negocio WHERE id_usuario = ? AND id_negocio = ?");
        $stmtCheck->execute([$id_usuario, $id_negocio]);
        $roleInBiz = $stmtCheck->fetchColumn();

        if (!$roleInBiz) {
            $stmtCheckPn = $pdo->prepare("SELECT rol_en_local FROM personal_negocio WHERE id_usuario = ? LIMIT 1");
            $stmtCheckPn->execute([$id_usuario]);
            $roleInBiz = $stmtCheckPn->fetchColumn();
        }

        if ($roleInBiz === 'admin') {
            throw new Exception("No es posible eliminar la cuenta del Administrador/Dueño principal del negocio.");
        } else {
            $pdo->prepare("DELETE FROM personal_negocio WHERE id_usuario = ? AND id_negocio = ?")->execute([$id_usuario, $id_negocio]);
            $pdo->prepare("DELETE FROM personal_negocio WHERE id_usuario = ? AND rol_en_local = 'profesional'")->execute([$id_usuario]);
            
            $stmtCheckOther = $pdo->prepare("SELECT COUNT(*) FROM personal_negocio WHERE id_usuario = ?");
            $stmtCheckOther->execute([$id_usuario]);
            if ($stmtCheckOther->fetchColumn() == 0) {
                $pdo->prepare("DELETE FROM usuarios WHERE id = ?")->execute([$id_usuario]);
            }
            
            $pdo->commit();
            echo json_encode(['success' => true]);
        }
    } catch (Exception $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
}
?>