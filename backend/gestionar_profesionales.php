<?php
session_start();
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/conexion.php';

if (!isset($_SESSION['id_negocio']) || !isset($_SESSION['rol_en_local']) || $_SESSION['rol_en_local'] !== 'admin') {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Acceso denegado. Solo el administrador del negocio puede crear o eliminar cuentas de profesionales.']);
    exit;
}

$id_negocio = $_SESSION['id_negocio'];
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    try {
        // Obtener la lista de profesionales e integrantes del equipo (incluyendo admins)
        $stmt = $pdo->prepare("
            SELECT u.id, u.nombre_completo, u.email, pn.rol_en_local 
            FROM usuarios u
            JOIN personal_negocio pn ON u.id = pn.id_usuario
            WHERE pn.id_negocio = :id_negocio
            ORDER BY (pn.rol_en_local = 'admin') DESC, u.id ASC
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

        // Obtener el límite dictado por el plan (SuperAdmin)
        $stmtLimit = $pdo->prepare("SELECT max_profesionales FROM negocios WHERE id = :id");
        $stmtLimit->execute(['id' => $id_negocio]);
        $max_profesionales = $stmtLimit->fetchColumn() ?: 1;

        echo json_encode(['success' => true, 'data' => $profesionales, 'limite' => $max_profesionales]);
    } catch (Exception $e) {
        echo json_encode(['success' => false, 'error' => 'Error al cargar el equipo: ' . $e->getMessage()]);
    }
} elseif ($method === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true) ?: $_POST;
    
    $nombre = trim($data['nombre'] ?? '');
    $email = filter_var(trim($data['email'] ?? ''), FILTER_SANITIZE_EMAIL);
    $password = trim($data['password'] ?? '');

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

        $stmtCount = $pdo->prepare("SELECT COUNT(*) FROM personal_negocio WHERE id_negocio = :id AND rol_en_local = 'profesional'");
        $stmtCount->execute(['id' => $id_negocio]);
        $current_count = (int)$stmtCount->fetchColumn();

        if ($current_count >= $max_profesionales) {
            require_once __DIR__ . '/helpers/notificar_admin_helper.php';
            notificarSuperAdminAlert($pdo, 'Solicitud Ampliación Equipo', "El negocio intentó registrar más profesionales pero alcanzó el límite de su plan ({$max_profesionales} profesionales).", $id_negocio);
            throw new Exception("Has alcanzado el límite máximo de $max_profesionales profesionales adicionales para tu plan. Si necesitas ampliar la capacidad, contacta a soporte.");
        }

        // Verificar si el usuario ya existe en la plataforma (puede trabajar en otro local o tener su propio negocio)
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
            $stmtPn = $pdo->prepare("INSERT INTO personal_negocio (id_negocio, id_usuario, rol_en_local) VALUES (?, ?, 'profesional')");
            $stmtPn->execute([$id_negocio, $id_usuario]);
        } else {
            // Crear usuario nuevo (sin requerir verificación de correo)
            $hash = password_hash($password, PASSWORD_DEFAULT);
            try {
                $stmtUser = $pdo->prepare("INSERT INTO usuarios (nombre_completo, email, password, email_verificado) VALUES (?, ?, ?, 1)");
                $stmtUser->execute([$nombre, $email, $hash]);
            } catch (Exception $eMailCol) {
                $stmtUser = $pdo->prepare("INSERT INTO usuarios (nombre_completo, email, password) VALUES (?, ?, ?)");
                $stmtUser->execute([$nombre, $email, $hash]);
            }
            $id_usuario = $pdo->lastInsertId();

            $stmtPn = $pdo->prepare("INSERT INTO personal_negocio (id_negocio, id_usuario, rol_en_local) VALUES (?, ?, 'profesional')");
            $stmtPn->execute([$id_negocio, $id_usuario]);
        }

        $pdo->commit();

        require_once __DIR__ . '/helpers/notificar_admin_helper.php';
        notificarSuperAdminAlert($pdo, 'Gestión de Equipo / Nuevo Profesional', "Se registró un nuevo profesional en el equipo: {$nombre} ({$email}). Total actual: " . ($current_count + 1) . " / {$max_profesionales}.", $id_negocio);

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
        
        $stmtCheck = $pdo->prepare("SELECT rol_en_local FROM personal_negocio WHERE id_negocio = ? AND id_usuario = ?");
        $stmtCheck->execute([$id_negocio, $id_usuario]);
        $roleInBiz = $stmtCheck->fetchColumn();

        if ($roleInBiz === 'admin') {
            throw new Exception("No es posible eliminar la cuenta del Administrador/Dueño principal del negocio.");
        } elseif ($roleInBiz === 'profesional') {
            $pdo->prepare("DELETE FROM personal_negocio WHERE id_negocio = ? AND id_usuario = ?")->execute([$id_negocio, $id_usuario]);
            
            // Eliminar de usuarios solo si no forma parte de ningún otro negocio
            $stmtCheckOther = $pdo->prepare("SELECT COUNT(*) FROM personal_negocio WHERE id_usuario = ?");
            $stmtCheckOther->execute([$id_usuario]);
            if ($stmtCheckOther->fetchColumn() == 0) {
                $pdo->prepare("DELETE FROM usuarios WHERE id = ?")->execute([$id_usuario]);
            }
            
            $pdo->commit();
            echo json_encode(['success' => true]);
        } else {
            throw new Exception("El profesional no pertenece a tu equipo de trabajo.");
        }
    } catch (Exception $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
}
?>