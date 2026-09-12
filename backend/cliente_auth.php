<?php
session_start();
header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/conexion.php';

// Auto-crear tabla de clientes_negocio si no existe
try {
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS clientes_negocio (
            id INT AUTO_INCREMENT PRIMARY KEY,
            id_negocio INT NOT NULL,
            nombre_completo VARCHAR(255) NOT NULL,
            email VARCHAR(255) NOT NULL,
            telefono VARCHAR(50) DEFAULT '',
            password VARCHAR(255) DEFAULT NULL,
            pases_disponibles INT DEFAULT 0,
            pases_totales INT DEFAULT 0,
            fecha_vencimiento DATE DEFAULT NULL,
            notas TEXT DEFAULT NULL,
            estado ENUM('activo', 'pendiente_activacion', 'inactivo') DEFAULT 'pendiente_activacion',
            fecha_alta DATETIME DEFAULT CURRENT_TIMESTAMP,
            KEY (id_negocio),
            KEY (email)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ");
} catch(Exception $e) {}

// Asegurar existencia de columnas por si la tabla fue creada previamente con esquema reducido
try { $pdo->query("SELECT pases_totales FROM clientes_negocio LIMIT 1"); } 
catch(Exception $e) { $pdo->exec("ALTER TABLE clientes_negocio ADD COLUMN pases_totales INT DEFAULT 0"); }

try { $pdo->query("SELECT fecha_vencimiento FROM clientes_negocio LIMIT 1"); } 
catch(Exception $e) { $pdo->exec("ALTER TABLE clientes_negocio ADD COLUMN fecha_vencimiento DATE DEFAULT NULL"); }

try { $pdo->query("SELECT notas FROM clientes_negocio LIMIT 1"); } 
catch(Exception $e) { $pdo->exec("ALTER TABLE clientes_negocio ADD COLUMN notas TEXT DEFAULT NULL"); }

try { $pdo->query("SELECT cancelaciones_permitidas FROM clientes_negocio LIMIT 1"); } 
catch(Exception $e) { $pdo->exec("ALTER TABLE clientes_negocio ADD COLUMN cancelaciones_permitidas INT DEFAULT NULL"); }

try { $pdo->query("SELECT cancelaciones_restantes FROM clientes_negocio LIMIT 1"); } 
catch(Exception $e) { $pdo->exec("ALTER TABLE clientes_negocio ADD COLUMN cancelaciones_restantes INT DEFAULT NULL"); }


$action = $_GET['action'] ?? $_POST['action'] ?? '';

try {
    // ---------------------------------------------------------
    // 0. Obtener Información de Negocio por Ruta (Invitación)
    // ---------------------------------------------------------
    if ($action === 'info_negocio') {
        $ruta = strtolower(trim($_POST['ruta'] ?? $_GET['ruta'] ?? ''));

        if (empty($ruta)) {
            echo json_encode(['success' => false, 'error' => 'Ruta de negocio no especificada.']);
            exit;
        }

        $stmt = $pdo->prepare("SELECT id, nombre_fantasia, ruta FROM negocios WHERE LOWER(TRIM(ruta)) = :ruta LIMIT 1");
        $stmt->execute(['ruta' => $ruta]);
        $negocio = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$negocio) {
            echo json_encode(['success' => false, 'error' => 'El establecimiento especificado no fue encontrado.']);
            exit;
        }

        echo json_encode([
            'success' => true,
            'negocio' => [
                'id' => $negocio['id'],
                'nombre' => $negocio['nombre_fantasia'],
                'ruta' => $negocio['ruta']
            ]
        ]);
        exit;
    }

    // ---------------------------------------------------------
    // 0b. Registrar Nuevo Alumno y Vincular a Negocio
    // ---------------------------------------------------------
    if ($action === 'register_and_link') {
        $ruta = strtolower(trim($_POST['ruta'] ?? ''));
        $nombre = trim($_POST['nombre'] ?? '');
        $email = strtolower(trim($_POST['email'] ?? ''));
        $telefono = trim($_POST['telefono'] ?? '');
        $password = trim($_POST['password'] ?? '');

        if (empty($ruta) || empty($nombre) || empty($email) || strlen($password) < 6) {
            echo json_encode(['success' => false, 'error' => 'Completa todos los campos obligatorios y ingresá una contraseña de al menos 6 caracteres.']);
            exit;
        }

        // Buscar negocio por ruta
        $stmtNeg = $pdo->prepare("SELECT id, nombre_fantasia FROM negocios WHERE LOWER(TRIM(ruta)) = :ruta LIMIT 1");
        $stmtNeg->execute(['ruta' => $ruta]);
        $negocio = $stmtNeg->fetch(PDO::FETCH_ASSOC);

        if (!$negocio) {
            echo json_encode(['success' => false, 'error' => 'El establecimiento no existe o la URL no es válida.']);
            exit;
        }

        $id_negocio = $negocio['id'];

        // Verificar si ya existe un alumno con este email vinculado a ESTE negocio
        $stmtCheck = $pdo->prepare("SELECT id, password FROM clientes_negocio WHERE id_negocio = :id_negocio AND LOWER(TRIM(email)) = :email LIMIT 1");
        $stmtCheck->execute(['id_negocio' => $id_negocio, 'email' => $email]);
        $existente = $stmtCheck->fetch(PDO::FETCH_ASSOC);

        $hash = password_hash($password, PASSWORD_DEFAULT);

        if ($existente) {
            if (!empty($existente['password'])) {
                echo json_encode(['success' => false, 'error' => 'Ya tenés una cuenta registrada en este establecimiento. Seleccioná la opción "Ya tengo cuenta" para ingresar.']);
                exit;
            } else {
                // Pre-registrado previamente por el administrador del negocio sin contraseña -> actualizar clave y activar
                $stmtUp = $pdo->prepare("UPDATE clientes_negocio SET nombre_completo = :nombre, telefono = :telefono, password = :hash, estado = 'activo' WHERE id = :id");
                $stmtUp->execute(['nombre' => $nombre, 'telefono' => $telefono, 'hash' => $hash, 'id' => $existente['id']]);
                $cId = $existente['id'];
            }
        } else {
            // Crear nuevo registro en el negocio
            $stmtIns = $pdo->prepare("INSERT INTO clientes_negocio (id_negocio, nombre_completo, email, telefono, password, pases_disponibles, pases_totales, estado) VALUES (:id_negocio, :nombre, :email, :telefono, :hash, 0, 0, 'pendiente_activacion')");
            $stmtIns->execute([
                'id_negocio' => $id_negocio,
                'nombre' => $nombre,
                'email' => $email,
                'telefono' => $telefono,
                'hash' => $hash
            ]);
            $cId = $pdo->lastInsertId();
        }

        $_SESSION['cliente_id'] = $cId;
        $_SESSION['cliente_email'] = $email;
        $_SESSION['cliente_nombre'] = $nombre;

        echo json_encode([
            'success' => true,
            'message' => '¡Cuenta registrada y vinculada con éxito a ' . $negocio['nombre_fantasia'] . '!',
            'cliente' => [
                'id' => $cId,
                'nombre' => $nombre,
                'email' => $email
            ],
            'negocio_nombre' => $negocio['nombre_fantasia']
        ]);
        exit;
    }

    // ---------------------------------------------------------
    // 0c. Iniciar Sesión y Vincular Alumno Existente a Negocio
    // ---------------------------------------------------------
    if ($action === 'login_and_link') {
        $ruta = strtolower(trim($_POST['ruta'] ?? ''));
        $email = strtolower(trim($_POST['email'] ?? ''));
        $password = trim($_POST['password'] ?? '');

        if (empty($ruta) || empty($email) || empty($password)) {
            echo json_encode(['success' => false, 'error' => 'Ingresá tu correo electrónico y contraseña.']);
            exit;
        }

        // Buscar negocio por ruta
        $stmtNeg = $pdo->prepare("SELECT id, nombre_fantasia FROM negocios WHERE LOWER(TRIM(ruta)) = :ruta LIMIT 1");
        $stmtNeg->execute(['ruta' => $ruta]);
        $negocio = $stmtNeg->fetch(PDO::FETCH_ASSOC);

        if (!$negocio) {
            echo json_encode(['success' => false, 'error' => 'El establecimiento no fue encontrado.']);
            exit;
        }

        $id_negocio = $negocio['id'];

        // Buscar alumno por email en cualquier negocio para validar contraseña
        $stmtClient = $pdo->prepare("SELECT id, nombre_completo, email, telefono, password FROM clientes_negocio WHERE LOWER(TRIM(email)) = :email AND password IS NOT NULL LIMIT 1");
        $stmtClient->execute(['email' => $email]);
        $alumno = $stmtClient->fetch(PDO::FETCH_ASSOC);

        $isSessionValid = isset($_SESSION['cliente_email']) && strtolower(trim($_SESSION['cliente_email'])) === $email;

        if (!$isSessionValid && (!$alumno || empty($alumno['password']) || !password_verify($password, $alumno['password']))) {
            echo json_encode(['success' => false, 'error' => 'Contraseña incorrecta o correo no registrado.']);
            exit;
        }

        if (!$alumno && $isSessionValid) {
            $alumno = ['nombre_completo' => $_SESSION['cliente_nombre'] ?? 'Alumno', 'telefono' => '', 'password' => ''];
        }

        // Verificar si ya existe vinculación en este negocio específico
        $stmtLink = $pdo->prepare("SELECT id, nombre_completo, pases_disponibles FROM clientes_negocio WHERE id_negocio = :id_negocio AND LOWER(TRIM(email)) = :email LIMIT 1");
        $stmtLink->execute(['id_negocio' => $id_negocio, 'email' => $email]);
        $link = $stmtLink->fetch(PDO::FETCH_ASSOC);

        if (!$link) {
            // Crear la vinculación en el nuevo negocio
            $stmtNewLink = $pdo->prepare("INSERT INTO clientes_negocio (id_negocio, nombre_completo, email, telefono, password, pases_disponibles, pases_totales, estado) VALUES (:id_negocio, :nombre, :email, :telefono, :hash, 0, 0, 'pendiente_activacion')");
            $stmtNewLink->execute([
                'id_negocio' => $id_negocio,
                'nombre' => $alumno['nombre_completo'],
                'email' => $email,
                'telefono' => $alumno['telefono'] ?? '',
                'hash' => $alumno['password']
            ]);
            $cId = $pdo->lastInsertId();
            $msg = '¡Te has vinculado con éxito a ' . $negocio['nombre_fantasia'] . '! El establecimiento te asignará tus cupos de clase.';
        } else {
            $cId = $link['id'];
            $msg = '¡Bienvenido! Tu cuenta ya se encuentra vinculada a ' . $negocio['nombre_fantasia'] . '.';
        }

        $_SESSION['cliente_id'] = $cId;
        $_SESSION['cliente_email'] = $email;
        $_SESSION['cliente_nombre'] = $alumno['nombre_completo'];

        echo json_encode([
            'success' => true,
            'message' => $msg,
            'cliente' => [
                'id' => $cId,
                'nombre' => $alumno['nombre_completo'],
                'email' => $email
            ],
            'negocio_nombre' => $negocio['nombre_fantasia']
        ]);
        exit;
    }

    // ---------------------------------------------------------
    // 1. Verificar Email de Cliente (Detección de Pre-Registro)
    // ---------------------------------------------------------
    if ($action === 'check_email') {
        $email = strtolower(trim($_POST['email'] ?? $_GET['email'] ?? ''));

        if (empty($email)) {
            echo json_encode(['success' => false, 'error' => 'Ingresá un correo electrónico válido.']);
            exit;
        }

        // Buscar en clientes_negocio (alumnos asignados por establecimientos)
        $stmt = $pdo->prepare("SELECT id, nombre_completo, password, pases_disponibles, estado FROM clientes_negocio WHERE LOWER(TRIM(email)) = :email LIMIT 1");
        $stmt->execute(['email' => $email]);
        $cliente = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$cliente) {
            // Verificar si tiene turnos registrados con ese email en la tabla turnos
            $stmtTurno = $pdo->prepare("SELECT cliente_nombre FROM turnos WHERE LOWER(TRIM(cliente_celular)) = :email OR LOWER(cliente_nombre) LIKE :emailLike LIMIT 1");
            $stmtTurno->execute(['email' => $email, 'emailLike' => '%' . $email . '%']);
            $turno = $stmtTurno->fetch(PDO::FETCH_ASSOC);
            
            if ($turno) {
                echo json_encode([
                    'success' => true,
                    'exists' => true,
                    'has_password' => false,
                    'nombre' => $turno['cliente_nombre']
                ]);
                exit;
            }

            echo json_encode([
                'success' => true, 
                'exists' => false,
                'message' => 'No encontramos tu correo electrónico en nuestra lista de alumnos. Por favor solicitale a tu profesor o establecimiento que te agregue a sus clases para habilitar tu acceso.'
            ]);
            exit;
        }

        echo json_encode([
            'success' => true,
            'exists' => true,
            'has_password' => !empty($cliente['password']),
            'nombre' => $cliente['nombre_completo'],
            'pases' => (int)$cliente['pases_disponibles']
        ]);
        exit;
    }

    // ---------------------------------------------------------
    // 2. Establecer Contraseña por Primera Vez (Onboarding Cliente)
    // ---------------------------------------------------------
    if ($action === 'set_password') {
        $email = strtolower(trim($_POST['email'] ?? ''));
        $password = trim($_POST['password'] ?? '');
        $nombre = trim($_POST['nombre'] ?? '');

        if (empty($email) || strlen($password) < 6) {
            echo json_encode(['success' => false, 'error' => 'Ingresá una contraseña válida de al menos 6 caracteres.']);
            exit;
        }

        $hash = password_hash($password, PASSWORD_DEFAULT);

        $stmtCheck = $pdo->prepare("SELECT id, nombre_completo FROM clientes_negocio WHERE LOWER(TRIM(email)) = :email LIMIT 1");
        $stmtCheck->execute(['email' => $email]);
        $c = $stmtCheck->fetch(PDO::FETCH_ASSOC);

        if ($c) {
            $stmtUp = $pdo->prepare("UPDATE clientes_negocio SET password = :hash, estado = 'activo' WHERE id = :id");
            $stmtUp->execute(['hash' => $hash, 'id' => $c['id']]);
            $cId = $c['id'];
            if (empty($nombre)) $nombre = $c['nombre_completo'];
        } else {
            $stmtIns = $pdo->prepare("INSERT INTO clientes_negocio (id_negocio, nombre_completo, email, password, estado) VALUES (1, :nombre, :email, :hash, 'activo')");
            $stmtIns->execute(['nombre' => !empty($nombre) ? $nombre : 'Alumno Registrado', 'email' => $email, 'hash' => $hash]);
            $cId = $pdo->lastInsertId();
        }

        $_SESSION['cliente_id'] = $cId;
        $_SESSION['cliente_email'] = $email;
        $_SESSION['cliente_nombre'] = $nombre;

        echo json_encode([
            'success' => true, 
            'message' => 'Contraseña configurada con éxito.',
            'cliente' => [
                'id' => $cId,
                'nombre' => $nombre,
                'email' => $email
            ]
        ]);
        exit;
    }

    // ---------------------------------------------------------
    // 3. Login de Cliente
    // ---------------------------------------------------------
    if ($action === 'login') {
        $email = strtolower(trim($_POST['email'] ?? ''));
        $password = trim($_POST['password'] ?? '');

        if (empty($email) || empty($password)) {
            echo json_encode(['success' => false, 'error' => 'Ingresá email y contraseña.']);
            exit;
        }

        $stmt = $pdo->prepare("SELECT id, nombre_completo, email, password, pases_disponibles FROM clientes_negocio WHERE LOWER(TRIM(email)) = :email LIMIT 1");
        $stmt->execute(['email' => $email]);
        $cliente = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$cliente || empty($cliente['password']) || !password_verify($password, $cliente['password'])) {
            echo json_encode(['success' => false, 'error' => 'Contraseña incorrecta o correo no registrado.']);
            exit;
        }

        $_SESSION['cliente_id'] = $cliente['id'];
        $_SESSION['cliente_email'] = $cliente['email'];
        $_SESSION['cliente_nombre'] = $cliente['nombre_completo'];

        echo json_encode([
            'success' => true,
            'cliente' => [
                'id' => $cliente['id'],
                'nombre' => $cliente['nombre_completo'],
                'email' => $cliente['email'],
                'pases' => (int)$cliente['pases_disponibles']
            ]
        ]);
        exit;
    }

    // ---------------------------------------------------------
    // Rutina de Depuración Mensual (Cuentas inactivas por > 6 meses)
    // ---------------------------------------------------------
    try {
        $pdo->exec("
            DELETE FROM clientes_negocio 
            WHERE fecha_alta < DATE_SUB(NOW(), INTERVAL 6 MONTH)
              AND email NOT IN (
                  SELECT DISTINCT cliente_celular FROM turnos WHERE cliente_celular IS NOT NULL AND fecha >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
              )
        ");
    } catch(Exception $exPurge) {}

    // ---------------------------------------------------------
    // 4. Mis Clases y Reservas (Discriminadas por Negocio)
    // ---------------------------------------------------------
    if ($action === 'mis_clases') {
        $email = strtolower(trim($_SESSION['cliente_email'] ?? $_GET['email'] ?? ''));

        if (empty($email)) {
            echo json_encode(['success' => false, 'error' => 'No autorizado.']);
            exit;
        }

        // Obtener la información de los negocios donde el alumno está registrado
        $stmtNegocios = $pdo->prepare("
            SELECT cn.id_negocio, n.nombre_fantasia AS negocio_nombre, n.ruta AS negocio_ruta, n.estado_pago, 
                   cn.pases_disponibles, COALESCE(cn.pases_totales, cn.pases_disponibles) AS pases_totales, 
                   cn.fecha_vencimiento, cn.cancelaciones_permitidas, cn.cancelaciones_restantes, cn.telefono, cn.nombre_completo
            FROM clientes_negocio cn
            JOIN negocios n ON cn.id_negocio = n.id
            WHERE LOWER(TRIM(cn.email)) = :email
        ");
        $stmtNegocios->execute(['email' => $email]);
        $negociosAsociados = $stmtNegocios->fetchAll(PDO::FETCH_ASSOC);

        foreach ($negociosAsociados as &$neg) {
            $pTotales = max(1, (int)$neg['pases_totales']);
            $maxCanc = isset($neg['cancelaciones_permitidas']) && $neg['cancelaciones_permitidas'] !== null ? (int)$neg['cancelaciones_permitidas'] : $pTotales;
            $restCanc = isset($neg['cancelaciones_restantes']) && $neg['cancelaciones_restantes'] !== null ? (int)$neg['cancelaciones_restantes'] : $maxCanc;
            $neg['cancelaciones_max'] = $maxCanc;
            $neg['cancelaciones_restantes'] = $restCanc;
        }
        unset($neg);

        // Obtener perfil del cliente
        $stmtPerfil = $pdo->prepare("SELECT nombre_completo, email, telefono FROM clientes_negocio WHERE LOWER(TRIM(email)) = :email LIMIT 1");
        $stmtPerfil->execute(['email' => $email]);
        $perfil = $stmtPerfil->fetch(PDO::FETCH_ASSOC);

        // Obtener el historial completo de clases y turnos con vencimiento y límites de devolución
        $stmt = $pdo->prepare("
            SELECT t.id, t.id_negocio, t.id_servicio, COALESCE(n.nombre_fantasia, 'Establecimiento') AS negocio, n.ruta AS negocio_ruta, 
                   t.servicio, t.profesional, t.fecha, t.hora, t.estado,
                   cn.fecha_vencimiento, cn.cancelaciones_restantes, cn.cancelaciones_permitidas, cn.pases_totales
            FROM turnos t
            LEFT JOIN negocios n ON t.id_negocio = n.id
            LEFT JOIN clientes_negocio cn ON t.id_negocio = cn.id_negocio AND LOWER(TRIM(cn.email)) = :email
            WHERE LOWER(TRIM(t.cliente_celular)) = :email OR LOWER(t.cliente_nombre) LIKE :emailLike
            ORDER BY t.fecha DESC, t.hora DESC
        ");
        $stmt->execute(['email' => $email, 'emailLike' => '%' . $email . '%']);
        $clases = $stmt->fetchAll(PDO::FETCH_ASSOC);

        foreach ($clases as &$c) {
            $pTotales = max(1, (int)($c['pases_totales'] ?? 4));
            $maxCanc = isset($c['cancelaciones_permitidas']) && $c['cancelaciones_permitidas'] !== null ? (int)$c['cancelaciones_permitidas'] : $pTotales;
            $restCanc = isset($c['cancelaciones_restantes']) && $c['cancelaciones_restantes'] !== null ? (int)$c['cancelaciones_restantes'] : $maxCanc;
            $c['cancelaciones_max'] = $maxCanc;
            $c['cancelaciones_restantes'] = $restCanc;
        }
        unset($c);

        echo json_encode([
            'success' => true, 
            'data' => $clases,
            'negocios' => $negociosAsociados,
            'perfil' => $perfil ?: ['nombre_completo' => 'Alumno', 'email' => $email, 'telefono' => '']
        ]);
        exit;
    }

    // ---------------------------------------------------------
    // 5. Actualizar Perfil del Alumno
    // ---------------------------------------------------------
    if ($action === 'update_profile') {
        $email = strtolower(trim($_SESSION['cliente_email'] ?? $_POST['email'] ?? ''));
        $nombre = trim($_POST['nombre'] ?? '');
        $telefono = trim($_POST['telefono'] ?? '');
        $password = trim($_POST['password'] ?? '');

        if (empty($email)) {
            echo json_encode(['success' => false, 'error' => 'Sesión expirada. Por favor iniciá sesión nuevamente.']);
            exit;
        }

        if (!empty($nombre)) {
            $stmtUp = $pdo->prepare("UPDATE clientes_negocio SET nombre_completo = :nombre, telefono = :telefono WHERE LOWER(TRIM(email)) = :email");
            $stmtUp->execute(['nombre' => $nombre, 'telefono' => $telefono, 'email' => $email]);
            $_SESSION['cliente_nombre'] = $nombre;
        }

        if (!empty($password)) {
            if (strlen($password) < 6) {
                echo json_encode(['success' => false, 'error' => 'La contraseña debe tener al menos 6 caracteres.']);
                exit;
            }
            $hash = password_hash($password, PASSWORD_DEFAULT);
            $stmtPass = $pdo->prepare("UPDATE clientes_negocio SET password = :hash WHERE LOWER(TRIM(email)) = :email");
            $stmtPass->execute(['hash' => $hash, 'email' => $email]);
        }

        echo json_encode(['success' => true, 'message' => 'Perfil actualizado correctamente.']);
        exit;
    }

    // ---------------------------------------------------------
    // 6. Cancelar Reserva de Clase (Devolviendo pase si le quedan cancelaciones)
    // ---------------------------------------------------------
    if ($action === 'cancelar_turno') {
        $email = strtolower(trim($_SESSION['cliente_email'] ?? $_POST['email'] ?? $_GET['email'] ?? ''));
        $turnoId = (int)($_POST['id'] ?? $_GET['id'] ?? 0);

        if (empty($email) || !$turnoId) {
            echo json_encode(['success' => false, 'error' => 'Datos insuficientes para cancelar la reserva.']);
            exit;
        }

        $stmtCheck = $pdo->prepare("SELECT id, id_negocio, estado FROM turnos WHERE id = :id AND (LOWER(TRIM(cliente_celular)) = :email OR LOWER(cliente_nombre) LIKE :emailLike)");
        $stmtCheck->execute(['id' => $turnoId, 'email' => $email, 'emailLike' => '%' . $email . '%']);
        $turno = $stmtCheck->fetch(PDO::FETCH_ASSOC);

        if (!$turno) {
            echo json_encode(['success' => false, 'error' => 'Reserva no encontrada o no pertenece a tu cuenta.']);
            exit;
        }

        if ($turno['estado'] === 'cancelado') {
            echo json_encode(['success' => false, 'error' => 'Esta clase ya se encuentra cancelada.']);
            exit;
        }

        // Obtener el registro del cliente en este establecimiento para controlar el límite de cancelaciones
        $stmtClient = $pdo->prepare("SELECT id, pases_totales, pases_disponibles, cancelaciones_permitidas, cancelaciones_restantes FROM clientes_negocio WHERE id_negocio = :id_negocio AND LOWER(TRIM(email)) = :email LIMIT 1");
        $stmtClient->execute(['id_negocio' => $turno['id_negocio'], 'email' => $email]);
        $cn = $stmtClient->fetch(PDO::FETCH_ASSOC);

        $nuevasRestantes = 0;
        $maxCanc = 4;

        if ($cn) {
            $pTotales = max(1, (int)($cn['pases_totales'] ?? 4));
            $maxCanc = isset($cn['cancelaciones_permitidas']) && $cn['cancelaciones_permitidas'] !== null ? (int)$cn['cancelaciones_permitidas'] : $pTotales;
            $restCanc = isset($cn['cancelaciones_restantes']) && $cn['cancelaciones_restantes'] !== null ? (int)$cn['cancelaciones_restantes'] : $maxCanc;

            if ($restCanc <= 0) {
                echo json_encode([
                    'success' => false, 
                    'error' => "Has alcanzado el límite máximo de cancelaciones (" . $maxCanc . ") de tu pase actual en este establecimiento. No podés realizar más devoluciones en este ciclo."
                ]);
                exit;
            }

            $nuevasRestantes = max(0, $restCanc - 1);
            $pdo->prepare("UPDATE clientes_negocio SET pases_disponibles = pases_disponibles + 1, cancelaciones_restantes = ? WHERE id = ?")->execute([$nuevasRestantes, $cn['id']]);
        } else {
            $pdo->prepare("UPDATE clientes_negocio SET pases_disponibles = pases_disponibles + 1 WHERE id_negocio = ? AND LOWER(TRIM(email)) = ?")->execute([$turno['id_negocio'], $email]);
        }

        $pdo->prepare("UPDATE turnos SET estado = 'cancelado' WHERE id = ?")->execute([$turnoId]);

        echo json_encode([
            'success' => true, 
            'message' => 'Reserva cancelada correctamente. Se devolvió 1 pase a tu cuenta. Te quedan ' . $nuevasRestantes . ' cancelaciones disponibles en tu pase actual.'
        ]);
        exit;
    }

    // ---------------------------------------------------------
    // 7. Reservar Clase con Pase (1-Click Booking Alumno)
    // ---------------------------------------------------------
    if ($action === 'reservar_con_pase') {
        $email = strtolower(trim($_SESSION['cliente_email'] ?? $_POST['email'] ?? ''));
        $id_negocio = (int)($_POST['id_negocio'] ?? 0);
        $fecha = trim($_POST['fecha'] ?? '');
        $hora = trim($_POST['hora'] ?? '');
        $servicio = trim($_POST['servicio'] ?? '');
        $profesional = trim($_POST['profesional'] ?? 'Cualquiera (Sin preferencia)');
        $id_servicio = (int)($_POST['id_servicio'] ?? 0);

        if (empty($email) || !$id_negocio || empty($fecha) || empty($hora) || empty($servicio)) {
            echo json_encode(['success' => false, 'error' => 'Por favor selecciona fecha, hora y servicio válidos.']);
            exit;
        }

        // 0. Validar que la clase no sea para un horario que ya transcurrió
        date_default_timezone_set('America/Argentina/Buenos_Aires');
        $classTimestamp = strtotime($fecha . ' ' . $hora);
        if ($classTimestamp !== false && $classTimestamp < time()) {
            echo json_encode(['success' => false, 'error' => 'No podés reservar una clase cuyo horario ya transcurrió.']);
            exit;
        }

        // 1. Verificar si el alumno ya está inscripto en esta misma clase, fecha y hora
        $stmtCheckDup = $pdo->prepare("SELECT id FROM turnos WHERE id_negocio = :id_negocio AND LOWER(TRIM(cliente_celular)) = :email AND fecha = :fecha AND hora LIKE :hora AND (id_servicio = :id_servicio OR servicio = :servicio) AND estado != 'cancelado' LIMIT 1");
        $stmtCheckDup->execute([
            'id_negocio' => $id_negocio,
            'email' => $email,
            'fecha' => $fecha,
            'hora' => substr($hora, 0, 5) . '%',
            'id_servicio' => $id_servicio ?: 0,
            'servicio' => $servicio
        ]);
        if ($stmtCheckDup->fetch()) {
            echo json_encode(['success' => false, 'error' => 'Ya te encontrás inscripto/a en esta clase para este día y horario.']);
            exit;
        }

        // 2. Verificar si el cliente tiene pases disponibles EXCLUSIVAMENTE en este negocio
        $stmtClient = $pdo->prepare("SELECT id, nombre_completo, pases_disponibles FROM clientes_negocio WHERE id_negocio = :id_negocio AND LOWER(TRIM(email)) = :email LIMIT 1");
        $stmtClient->execute(['id_negocio' => $id_negocio, 'email' => $email]);
        $clientData = $stmtClient->fetch(PDO::FETCH_ASSOC);

        if (!$clientData) {
            echo json_encode(['success' => false, 'error' => 'No estás registrado/a como alumno en este establecimiento.']);
            exit;
        }

        $pasesDisponibles = (int)($clientData['pases_disponibles'] ?? 0);
        if ($pasesDisponibles <= 0) {
            echo json_encode(['success' => false, 'error' => 'No tenés pases disponibles en este establecimiento para agendarte. Por favor contactá al negocio para renovar tu pase.']);
            exit;
        }

        $nombreCliente = $_SESSION['cliente_nombre'] ?? $clientData['nombre_completo'] ?? 'Alumno';

        // Descontar 1 pase únicamente de la cuenta de ESTE negocio
        $pdo->prepare("UPDATE clientes_negocio SET pases_disponibles = GREATEST(0, pases_disponibles - 1) WHERE id = ?")->execute([$clientData['id']]);

        // 3. Insertar reserva en la tabla turnos
        $stmtIns = $pdo->prepare("INSERT INTO turnos (id_negocio, cliente_nombre, cliente_celular, fecha, hora, servicio, profesional, id_servicio, metodo_pago, estado) VALUES (:id_negocio, :nombre, :email, :fecha, :hora, :servicio, :profesional, :id_servicio, 'Pase de Alumno', 'confirmado')");
        $stmtIns->execute([
            'id_negocio' => $id_negocio,
            'nombre' => $nombreCliente,
            'email' => $email,
            'fecha' => $fecha,
            'hora' => $hora,
            'servicio' => $servicio,
            'profesional' => $profesional,
            'id_servicio' => $id_servicio ?: null
        ]);

        // 4. Crear notificación en la campanita para el negocio
        try {
            try {
                $pdo->query("SELECT id FROM notificaciones LIMIT 1");
            } catch (\Throwable $e) {
                $pdo->exec("CREATE TABLE notificaciones (id INT AUTO_INCREMENT PRIMARY KEY, id_negocio INT NULL, titulo VARCHAR(255), mensaje TEXT, fecha DATETIME DEFAULT CURRENT_TIMESTAMP, leida TINYINT DEFAULT 0)");
            }

            $fechaFmt = date('d/m/Y', strtotime($fecha));
            $horaFmt = substr($hora, 0, 5);
            $stmtNotif = $pdo->prepare("INSERT INTO notificaciones (id_negocio, titulo, mensaje, fecha) VALUES (:id_negocio, :titulo, :mensaje, NOW())");
            $stmtNotif->execute([
                'id_negocio' => $id_negocio,
                'titulo' => '🎒 Nueva Inscripción a Clase',
                'mensaje' => "El alumno/a {$nombreCliente} ({$email}) se inscribió a la clase de {$servicio} ({$profesional}) para el día {$fechaFmt} a las {$horaFmt} hs."
            ]);
        } catch (\Throwable $eNotif) {
            error_log("Error guardando notificacion de negocio: " . $eNotif->getMessage());
        }

        echo json_encode(['success' => true, 'message' => '¡Inscripción confirmada con éxito! Tu clase ha sido agendada.']);
        exit;
    }

    echo json_encode(['success' => false, 'error' => 'Acción no válida.']);

} catch (PDOException $e) {
    echo json_encode(['success' => false, 'error' => 'Error en el servidor: ' . $e->getMessage()]);
}
?>
