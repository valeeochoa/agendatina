<?php
session_start();
header('Content-Type: application/json; charset=utf-8');

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception as PHPMailerException;

require_once __DIR__ . '/phpmailer/Exception.php';
require_once __DIR__ . '/phpmailer/PHPMailer.php';
require_once __DIR__ . '/phpmailer/SMTP.php';

// Asegurarnos de que el superadministrador SIEMPRE trabaje en la base de datos real
if (isset($_SESSION['is_demo'])) {
    unset($_SESSION['is_demo']);
}

// =========================================================================
// BARRERA DE SEGURIDAD: Bloquea el acceso si no es el administrador
// =========================================================================
if (!isset($_SESSION['is_superadmin']) || $_SESSION['is_superadmin'] !== true) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Acceso denegado. Inicia sesión como Super Admin.']);
    exit;
}

require_once __DIR__ . '/conexion.php';

// Forzar modo de excepciones para evitar fallos silenciosos en la base de datos (Ej: al hacer DELETE)
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

// =========================================================================
// Asegurar que las columnas existan dinámicamente
// Evita errores si la Base de Datos no tiene estos campos aún agregados.
// =========================================================================
try { $pdo->query("SELECT plan FROM negocios LIMIT 1"); } 
catch(Exception $e) { $pdo->exec("ALTER TABLE negocios ADD COLUMN plan VARCHAR(50) DEFAULT 'Basico'"); }

try { $pdo->query("SELECT estado_pago FROM negocios LIMIT 1"); } 
catch(Exception $e) { $pdo->exec("ALTER TABLE negocios ADD COLUMN estado_pago VARCHAR(50) DEFAULT 'prueba'"); }

try { $pdo->query("SELECT nombre_completo FROM usuarios LIMIT 1"); } 
catch(Exception $e) { $pdo->exec("ALTER TABLE usuarios ADD COLUMN nombre_completo VARCHAR(255) DEFAULT ''"); }

try { $pdo->query("SELECT fecha_alta FROM negocios LIMIT 1"); } 
catch(Exception $e) { $pdo->exec("ALTER TABLE negocios ADD COLUMN fecha_alta DATETIME DEFAULT CURRENT_TIMESTAMP"); }

try { $pdo->query("SELECT ruta FROM negocios LIMIT 1"); } 
catch(Exception $e) { 
    try {
        $pdo->exec("ALTER TABLE negocios CHANGE subdominio ruta VARCHAR(255)"); 
    } catch(Exception $e2) {
        $pdo->exec("ALTER TABLE negocios ADD COLUMN ruta VARCHAR(255) DEFAULT ''"); 
    }
}

try { $pdo->query("SELECT ultimo_pago FROM negocios LIMIT 1"); } 
catch(Exception $e) { $pdo->exec("ALTER TABLE negocios ADD COLUMN ultimo_pago DATETIME DEFAULT NULL"); }

try { $pdo->query("SELECT comprobante FROM negocios LIMIT 1"); } 
catch(Exception $e) { $pdo->exec("ALTER TABLE negocios ADD COLUMN comprobante VARCHAR(255) DEFAULT NULL"); }

try { $pdo->query("SELECT id FROM notificaciones LIMIT 1"); } 
catch(Exception $e) { 
    $pdo->exec("CREATE TABLE notificaciones (
        id INT AUTO_INCREMENT PRIMARY KEY, 
        id_negocio INT NULL, 
        titulo VARCHAR(255), 
        mensaje TEXT, 
        fecha DATETIME DEFAULT CURRENT_TIMESTAMP
    )"); 
}

try { $pdo->query("SELECT 1 FROM notificaciones_admin LIMIT 1"); } 
catch(Exception $e) { 
    $pdo->exec("CREATE TABLE notificaciones_admin (
        id INT AUTO_INCREMENT PRIMARY KEY, 
        segmento VARCHAR(100), 
        mensaje TEXT, 
        id_negocio INT NULL,
        fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
        leida BOOLEAN DEFAULT FALSE
    )"); 
}

try { $pdo->query("SELECT 1 FROM admin_notas LIMIT 1"); } 
catch(Exception $e) { 
    $pdo->exec("CREATE TABLE admin_notas (
        id INT AUTO_INCREMENT PRIMARY KEY,
        id_negocio INT NOT NULL,
        nota TEXT,
        fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY (id_negocio)
    )"); 
}

// Ampliar la columna password para que no corte la encriptación
try { $pdo->exec("ALTER TABLE usuarios MODIFY password VARCHAR(255)"); } catch(Exception $e) {}

$method = $_SERVER['REQUEST_METHOD'];

// =========================================================================
// OBTENER TODOS LOS CLIENTES (MÉTODO GET)
// =========================================================================
if ($method === 'GET') {
    // Liberar la sesión para evitar bloqueos
    session_write_close();

    // Ejecutar auto-suspensión silenciosa antes de devolver los datos a la tabla
    try {
        // Suspende si pasaron > 15 días (prueba), > 35 días (beta), o > 35 días (activo con último pago)
        $pdo->exec("UPDATE negocios SET estado_pago = 'suspendido' WHERE (estado_pago = 'prueba' AND DATEDIFF(NOW(), fecha_alta) > 15) OR (estado_pago = 'beta' AND DATEDIFF(NOW(), fecha_alta) > 35) OR (estado_pago IN ('activo', 'pagado') AND ultimo_pago IS NOT NULL AND DATEDIFF(NOW(), ultimo_pago) > 35)");
    } catch(Exception $e) {}

    try {
        $stmt = $pdo->query("
            SELECT n.id, n.nombre_fantasia, n.ruta, n.plan, n.estado_pago, n.fecha_alta, 
                   n.ultimo_pago, n.comprobante, u.nombre_completo, u.email,
                   COALESCE(cw.tipo_calendario, 'clasico') AS tipo_calendario,
                   an.nota AS nota_interna
            FROM negocios n
            LEFT JOIN personal_negocio pn ON n.id = pn.id_negocio AND pn.rol_en_local = 'admin'
            LEFT JOIN usuarios u ON pn.id_usuario = u.id
            LEFT JOIN configuracion_web cw ON n.id = cw.id_negocio
            LEFT JOIN admin_notas an ON n.id = an.id_negocio
            ORDER BY n.id DESC
        ");
        $negocios = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Obtener notificaciones de errores recientes para el SuperAdmin
        $stmtNotifs = $pdo->query("
            SELECT na.*, n.nombre_fantasia 
            FROM notificaciones_admin na 
            LEFT JOIN negocios n ON na.id_negocio = n.id 
            ORDER BY na.fecha DESC LIMIT 50
        ");
        $notifs_admin = $stmtNotifs->fetchAll(PDO::FETCH_ASSOC);
        
        // Obtener las notas internas más recientes
        $stmtNotas = $pdo->query("
            SELECT an.nota, an.fecha_actualizacion, n.nombre_fantasia, n.id AS id_negocio
            FROM admin_notas an
            LEFT JOIN negocios n ON an.id_negocio = n.id
            WHERE an.nota IS NOT NULL AND TRIM(an.nota) != ''
            ORDER BY an.fecha_actualizacion DESC LIMIT 10
        ");
        $notas_recientes = $stmtNotas->fetchAll(PDO::FETCH_ASSOC);
        
        echo json_encode(['success' => true, 'data' => $negocios, 'notificaciones' => $notifs_admin, 'notas_recientes' => $notas_recientes]);
    } catch (PDOException $e) {
        echo json_encode(['success' => false, 'error' => 'Error BD: ' . $e->getMessage()]);
    }
} 
// =========================================================================
// CREAR NUEVO CLIENTE Y NEGOCIO (MÉTODO POST)
// =========================================================================
elseif ($method === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);
    if (!$data) $data = $_POST;

    // Acciones Globales del SuperAdmin (Mover ARRIBA de las validaciones de nuevo cliente)
    if (isset($data['action']) && $data['action'] === 'send_notification') {
        $titulo = trim($data['titulo'] ?? '');
        $mensaje = trim($data['mensaje'] ?? '');
        $id_neg = !empty($data['id_negocio']) ? $data['id_negocio'] : null; // Si es null, va a TODOS
        if (!$titulo || !$mensaje) {
            echo json_encode(['success' => false, 'error' => 'El título y mensaje son obligatorios.']);
            exit;
        }
        $pdo->prepare("INSERT INTO notificaciones (id_negocio, titulo, mensaje) VALUES (?, ?, ?)")->execute([$id_neg, $titulo, $mensaje]);
        echo json_encode(['success' => true]);
        exit;
    }

    $nombre_completo = trim($data['nombre_completo'] ?? '');
    $email =  = trim($data['password'] ?? '');
    $nombre_fantasia = trim($data['nombre_fantasia'] ?? '');
    $rutaRaw = $data['ruta'] ?? $data['subdominio'] ?? ''; // Compatibilidad con variables previas
    $ruta = preg_replace('/[^a-zA-Z0-9-]/', '', strtolower(trim($rutaRaw))); // Sanitizar URL
    $plan = trim($data['plan'] ?? 'Basico');
    $estado_pago = trim($data['estado_pago'] ?? 'prueba');

    if (!$nombre_completo || !$email || !$password || !$nombre_fantasia || !$ruta) {
        echo json_encode(['success' => false, 'error' => 'Por favor completa todos los campos obligatorios.']);
        exit;
    }
    
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        echo json_encode(['success' => false, 'error' => 'El formato del correo electrónico no es válido.']);
        exit;
    }
    
    if (strlen($password) < 6 || strlen($password) > 14) {
        echo json_encode(['success' => false, 'error' => 'La contraseña debe tener entre 6 y 14 caracteres.']);
        exit;
    }

    try {
        $pdo->beginTransaction();

        // 1. CREAR O RECUPERAR USUARIO
        $stmt = $pdo->prepare("SELECT id FROM usuarios WHERE email = :email LIMIT 1");
        $stmt->execute(['email' => $email]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($user) {
            $id_usuario = $user['id']; // El usuario ya existe, simplemente lo reutilizamos
            
            // Actualizamos la contraseña para asegurarnos de que la nueva ingresada sea válida
            if (!empty($password)) {
                $stmtPass = $pdo->prepare("UPDATE usuarios SET password = :pass WHERE id = :id");
                $stmtPass->execute(['pass' => password_hash($password, PASSWORD_DEFAULT), 'id' => $id_usuario]);
            }

            // Prevenir que el mismo usuario registre dos negocios con el mismo nombre
            $stmtCheckDuplicado = $pdo->prepare("
                SELECT n.id 
                FROM negocios n
                INNER JOIN personal_negocio pn ON n.id = pn.id_negocio
                WHERE pn.id_usuario = :id_usuario AND n.nombre_fantasia = :fantasia
                LIMIT 1
            ");
            $stmtCheckDuplicado->execute(['id_usuario' => $id_usuario, 'fantasia' => $nombre_fantasia]);
            if ($stmtCheckDuplicado->fetch()) {
                throw new Exception("El usuario con el email '$email' ya tiene un negocio registrado con el nombre '$nombre_fantasia'.");
            }
        } else {
            // Evaluamos compatibilidad por si se exige 'username' en tablas viejas
            try { $pdo->query("SELECT username FROM usuarios LIMIT 1"); $has_username = true; } 
            catch(Exception $e) { $has_username = false; }

            if ($has_username) {
                $username = explode('@', $email)[0] . rand(100, 999);
                $stmt = $pdo->prepare("INSERT INTO usuarios (nombre_completo, username, email, password, role, fecha_creacion) VALUES (:nombre, :username, :email, :password, 'admin', NOW())");
                $stmt->execute(['nombre' => $nombre_completo, 'username' => $username, 'email' => $email, 'password' => password_hash($password, PASSWORD_DEFAULT)]);
            } else {
                $stmt = $pdo->prepare("INSERT INTO usuarios (nombre_completo, email, password) VALUES (:nombre, :email, :password)");
                $stmt->execute(['nombre' => $nombre_completo, 'email' => $email, 'password' => password_hash($password, PASSWORD_DEFAULT)]);
            }
            $id_usuario = $pdo->lastInsertId();
        }

        // 2. CREAR NEGOCIO
        // Verificamos en ambas columnas (ruta o subdominio) por compatibilidad con datos residuales
        try {
            $pdo->query("SELECT subdominio FROM negocios LIMIT 1");
            $stmt = $pdo->prepare("SELECT id FROM negocios WHERE ruta = :ruta OR subdominio = :ruta LIMIT 1");
        } catch (Exception $e) {
            $stmt = $pdo->prepare("SELECT id FROM negocios WHERE ruta = :ruta LIMIT 1");
        }
        
        $stmt->execute(['ruta' => $ruta]);
        if ($stmt->fetch()) {
            throw new Exception("El enlace '$ruta' ya está en uso. Si lo eliminaste recientemente, comprueba que se haya borrado correctamente.");
        }
        
        $stmt = $pdo->prepare("INSERT INTO negocios (nombre_fantasia, ruta, plan, estado_pago) VALUES (:fantasia, :ruta, :plan, :estado_pago)");
        $stmt->execute([
            'fantasia' => $nombre_fantasia,
            'ruta' => $ruta,
            'plan' => $plan,
            'estado_pago' => $estado_pago
        ]);
        $id_negocio = $pdo->lastInsertId();

        // 3. VINCULAR USUARIO COMO ADMIN
        $stmt = $pdo->prepare("INSERT INTO personal_negocio (id_negocio, id_usuario, rol_en_local) VALUES (:id_negocio, :id_usuario, 'admin')");
        $stmt->execute(['id_negocio' => $id_negocio, 'id_usuario' => $id_usuario]);

        // 4. CREAR SERVICIO Y PROFESIONAL POR DEFECTO
        try {
            // Asumimos que la tabla 'servicios' ya existe con estas columnas.
            $stmtServ = $pdo->prepare("INSERT INTO servicios (id_negocio, nombre_servicio, duracion_minutos, precio, profesional) VALUES (?, ?, ?, ?, ?)");
            $stmtServ->execute([$id_negocio, 'Servicio de Ejemplo', 30, 0, 'Profesional 1']);
        } catch (Exception $e) {
            // Ignorar si la tabla servicios no existe o falla, no es crítico para la creación del negocio.
            error_log("No se pudo crear servicio por defecto para negocio $id_negocio: " . $e->getMessage());
        }

        $pdo->commit();
        echo json_encode(['success' => true]);

    } catch (Exception $e) {
        if ($pdo->inTransaction()) { $pdo->rollBack(); }
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
}
// =========================================================================
// ACTUALIZAR PLAN Y ESTADO DE UN NEGOCIO (MÉTODO PUT)
// =========================================================================
elseif ($method === 'PUT') {
    $data = json_decode(file_get_contents('php://input'), true);
    
    $id_negocio = $data['id_negocio'] ?? null;
    $plan = $data['plan'] ?? null;
    $estado_pago = $data['estado_pago'] ?? null;
    $action = $data['action'] ?? null;
    $motivo_rechazo = trim($data['motivo_rechazo'] ?? '');
    $nota_interna = $data['nota_interna'] ?? null;

    if (!$id_negocio) {
        echo json_encode(['success' => false, 'error' => 'Falta el ID del negocio para la actualización.']);
        exit;
    }

    // Si vamos a rechazar, obtenemos los datos del usuario para notificarle por email
    $userInfo = null;
    if ($action === 'rechazar_pago') {
        $stmtUser = $pdo->prepare("
            SELECT u.email, u.nombre_completo, n.nombre_fantasia
            FROM usuarios u
            JOIN personal_negocio pn ON u.id = pn.id_usuario
            JOIN negocios n ON pn.id_negocio = n.id
            WHERE pn.id_negocio = :id_negocio AND pn.rol_en_local = 'admin'
            LIMIT 1
        ");
        $stmtUser->execute(['id_negocio' => $id_negocio]);
        $userInfo = $stmtUser->fetch(PDO::FETCH_ASSOC);
    }

    try {
        $pdo->beginTransaction();

        if ($action === 'save_note') {
            if ($nota_interna !== null) {
                $stmt = $pdo->prepare(
                    "INSERT INTO admin_notas (id_negocio, nota) VALUES (:id_negocio, :nota)
                     ON DUPLICATE KEY UPDATE nota = :nota"
                );
                $stmt->execute(['id_negocio' => $id_negocio, 'nota' => $nota_interna]);
            }
        } elseif ($action === 'edit_client') {
            $nombre_completo = trim($data['nombre_completo'] ?? '');
            $email = filter_var(trim($data['email'] ?? '')ata['nombre_fantasia'] ?? '');
            $ruta = preg_replace('/[^a-zA-Z0-9-]/', '', strtolower(trim($data['ruta'] ?? '')));
            $password = trim($data['password'] ?? '');

            if (!$nombre_completo || !$email || !$nombre_fantasia || !$ruta) {
                throw new Exception('Faltan datos obligatorios (Nombre, Email, Negocio o Ruta).');
            }
            
            if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
                throw new Exception('El formato del correo electrónico no es válido.');
            }

            // Validar ruta única
            try {
                $pdo->query("SELECT subdominio FROM negocios LIMIT 1");
                $stmtCheck = $pdo->prepare("SELECT id FROM negocios WHERE (ruta = :ruta OR subdominio = :ruta) AND id != :id");
            } catch (Exception $e) {
                $stmtCheck = $pdo->prepare("SELECT id FROM negocios WHERE ruta = :ruta AND id != :id");
            }
            
            $stmtCheck->execute(['ruta' => $ruta, 'id' => $id_negocio]);
            if ($stmtCheck->fetch()) {
                throw new Exception("El enlace '$ruta' ya está en uso por otro negocio.");
            }

            // Actualizar Negocio
            $sqlNegocio = "UPDATE negocios SET nombre_fantasia = :nf, ruta = :ruta";
            $paramsNegocio = ['nf' => $nombre_fantasia, 'ruta' => $ruta, 'id' => $id_negocio];
            if ($plan) { $sqlNegocio .= ", plan = :plan"; $paramsNegocio['plan'] = $plan; }
            if ($estado_pago) { $sqlNegocio .= ", estado_pago = :estado_pago"; $paramsNegocio['estado_pago'] = $estado_pago; }
            $sqlNegocio .= " WHERE id = :id";
            $stmtNegocio = $pdo->prepare($sqlNegocio);
            $stmtNegocio->execute($paramsNegocio);

            // Buscar y actualizar Usuario Admin
            $stmtPn = $pdo->prepare("SELECT id_usuario FROM personal_negocio WHERE id_negocio = :id_negocio AND rol_en_local = 'admin' LIMIT 1");
            $stmtPn->execute(['id_negocio' => $id_negocio]);
            $pn = $stmtPn->fetch();

            if ($pn && !empty($pn['id_usuario'])) {
                $id_usuario = $pn['id_usuario'];

                // Validar email único
                $stmtCheckEmail = $pdo->prepare("SELECT id FROM usuarios WHERE email = :email AND id != :id");
                $stmtCheckEmail->execute(['email' => $email, 'id' => $id_usuario]);
                if ($stmtCheckEmail->fetch()) {
                    throw new Exception("El email '$email' ya está registrado en otra cuenta.");
                }

                if (!empty($password)) {
                    if (strlen($password) < 6 || strlen($password) > 14) {
                        throw new Exception("La nueva contraseña debe tener entre 6 y 14 caracteres.");
                    }
                    $hash = password_hash($password, PASSWORD_DEFAULT);
                    $stmtUser = $pdo->prepare("UPDATE usuarios SET nombre_completo = :nc, email = :email, password = :pass WHERE id = :id");
                    $stmtUser->execute(['nc' => $nombre_completo, 'email' => $email, 'pass' => $hash, 'id' => $id_usuario]);
                } else {
                    $stmtUser = $pdo->prepare("UPDATE usuarios SET nombre_completo = :nc, email = :email WHERE id = :id");
                    $stmtUser->execute(['nc' => $nombre_completo, 'email' => $email, 'id' => $id_usuario]);
                }
            }
        } else {
            $updates = [];
            $params = ['id' => $id_negocio];
            
            if ($action === 'registrar_pago') {
                $updates[] = "estado_pago = 'activo'";
                $updates[] = "ultimo_pago = NOW()";
            } elseif ($action === 'rechazar_pago') {
                $updates[] = "estado_pago = 'suspendido'";
                $updates[] = "comprobante = NULL";
            } else {
                if ($plan !== null) {
                    $updates[] = "plan = :plan";
                    $params['plan'] = $plan;
                }
                if ($estado_pago !== null) {
                    $updates[] = "estado_pago = :estado_pago";
                    $params['estado_pago'] = $estado_pago;
                }
            }
            
            if (count($updates) > 0) {
                $sql = "UPDATE negocios SET " . implode(', ', $updates) . " WHERE id = :id";
                $stmt = $pdo->prepare($sql);
                $stmt->execute($params);
            }
        }

        $pdo->commit();

        // Enviar email de rechazo DESPUÉS de confirmar que la BD se actualizó
        if ($action === 'rechazar_pago' && $userInfo && !empty($userInfo['email'])) {
            try {
                $mail = new PHPMailer(true);
                $mail->isSMTP();
                $mail->Host       = 'localhost';
                $mail->SMTPAuth   = true;
                $mail->Username   = 'no-reply@agendatina.site';
                $mail->Password   = 'Tlqb*Er0kQ';
                $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
                $mail->Port       = 587;
                $mail->CharSet    = 'UTF-8';
                $mail->SMTPOptions = array('ssl' => array('verify_peer' => false, 'verify_peer_name' => false, 'allow_self_signed' => true));

                $mail->setFrom('no-reply@agendatina.site', 'Agendatina Pagos');
                $mail->addAddress($userInfo['email']);
                $mail->isHTML(true);
                $mail->Subject = 'Problema con tu pago en Agendatina';
                
                $nombre = !empty($userInfo['nombre_completo']) ? explode(' ', $userInfo['nombre_completo'])[0] : 'Usuario';
                $nombreNegocio = $userInfo['nombre_fantasia'] ?? 'tu negocio';

                $motivoHtml = '';
                if (!empty($motivo_rechazo)) {
                    $motivoHtml = "<div style='background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 12px 16px; margin: 20px 0; border-radius: 6px;'>
                        <strong style='color: #991b1b; display: block; margin-bottom: 4px;'>Motivo del rechazo:</strong>
                        <span style='color: #b91c1c;'>" . nl2br(htmlspecialchars($motivo_rechazo)) . "</span>
                    </div>";
                }

                $mail->Body = "<div style='font-family: Arial, sans-serif; padding: 20px; background: #f8fafc; border-radius: 12px; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0;'>
                    <h2 style='color: #ef4444;'>Hola $nombre,</h2>
                    <p style='font-size: 16px; color: #475569;'>Te informamos que el último comprobante de pago que subiste para <strong>$nombreNegocio</strong> fue rechazado.</p>
                    $motivoHtml
                    <p style='font-size: 16px; color: #475569;'>Por este motivo, tu cuenta ha sido suspendida temporalmente. Para reactivarla, por favor, ingresa a tu panel de control y realiza el pago nuevamente subiendo un comprobante válido.</p>
                    <div style='text-align: center; margin: 35px 0;'><a href='https://agendatina.site/dashboard.html' style='background-color: #3b82f6; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;'>Ir a mi Panel</a></div>
                    <p style='font-size: 14px; color: #94a3b8;'>Si crees que esto es un error, por favor, contacta a soporte.</p>
                </div>";

                $mail->send();
            } catch (PHPMailerException $mailEx) {
                error_log("Error al enviar correo de rechazo de pago: " . $mail->ErrorInfo);
            }
        }

        echo json_encode(['success' => true]);
    } catch (Exception $e) {
        if ($pdo->inTransaction()) { $pdo->rollBack(); }
        echo json_encode(['success' => false, 'error' => 'Error al actualizar: ' . $e->getMessage()]);
    }
} 
// =========================================================================
// ELIMINAR UN NEGOCIO Y SUS DATOS (MÉTODO DELETE)
// =========================================================================
elseif ($method === 'DELETE') {
    $id_reporte = $_GET['id_reporte'] ?? null;
    if ($id_reporte) {
        try {
            $pdo->prepare("DELETE FROM notificaciones_admin WHERE id = ?")->execute([$id_reporte]);
            echo json_encode(['success' => true]);
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'error' => 'Error al eliminar el reporte: ' . $e->getMessage()]);
        }
        exit;
    }

    $id_negocio = $_GET['id'] ?? null;
    
    if (!$id_negocio) {
        echo json_encode(['success' => false, 'error' => 'Falta el ID del negocio a eliminar.']);
        exit;
    }

    try {
        $pdo->beginTransaction();

        // Obtener el ID del usuario dueño antes de borrar los vínculos
        $stmtUser = $pdo->prepare("SELECT id_usuario FROM personal_negocio WHERE id_negocio = ? AND rol_en_local = 'admin'");
        $stmtUser->execute([$id_negocio]);
        $adminIds = $stmtUser->fetchAll(PDO::FETCH_COLUMN);

        // Limpiar todas las dependencias para no dejar datos huérfanos
        $tablas = ['turnos', 'servicios', 'dias_bloqueados', 'configuracion_web', 'personal_negocio'];
        foreach ($tablas as $tabla) {
            try { $pdo->prepare("DELETE FROM $tabla WHERE id_negocio = ?")->execute([$id_negocio]); } 
            catch (Exception $e) { /* Ignoramos si alguna de las tablas aún no existe */ }
        }
        
        $stmtNeg = $pdo->prepare("DELETE FROM negocios WHERE id = ?");
        $stmtNeg->execute([$id_negocio]);
        if ($stmtNeg->rowCount() === 0) throw new Exception("El negocio ya no existe o estaba bloqueado por un error interno.");

        // Eliminar también la cuenta del dueño si no administra otros negocios
        if (!empty($adminIds)) {
            foreach ($adminIds as $uid) {
                $checkOther = $pdo->prepare("SELECT COUNT(*) FROM personal_negocio WHERE id_usuario = ?");
                $checkOther->execute([$uid]);
                if ($checkOther->fetchColumn() == 0) {
                    $pdo->prepare("DELETE FROM usuarios WHERE id = ?")->execute([$uid]);
                }
            }
        }

        $pdo->commit();
        echo json_encode(['success' => true]);
    } catch (Exception $e) {
        if ($pdo->inTransaction()) { $pdo->rollBack(); }
        echo json_encode(['success' => false, 'error' => 'Error al eliminar el negocio: ' . $e->getMessage()]);
    }
} else {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método HTTP no permitido.']);
}
?>