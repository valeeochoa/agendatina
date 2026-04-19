<?php
session_start();
header('Content-Type: application/json; charset=utf-8');

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

// Ampliar la columna password para que no corte la encriptación
try { $pdo->exec("ALTER TABLE usuarios MODIFY password VARCHAR(255)"); } catch(Exception $e) {}

$method = $_SERVER['REQUEST_METHOD'];

// =========================================================================
// OBTENER TODOS LOS CLIENTES (MÉTODO GET)
// =========================================================================
if ($method === 'GET') {
    // Ejecutar auto-suspensión silenciosa antes de devolver los datos a la tabla
    try {
        // Suspende si pasaron > 15 días (prueba), > 30 días (beta), o > 40 días (activo con último pago)
        $pdo->exec("UPDATE negocios SET estado_pago = 'suspendido' WHERE (estado_pago = 'prueba' AND DATEDIFF(NOW(), fecha_alta) > 15) OR (estado_pago = 'beta' AND DATEDIFF(NOW(), fecha_alta) > 30) OR (estado_pago IN ('activo', 'pagado') AND ultimo_pago IS NOT NULL AND DATEDIFF(NOW(), ultimo_pago) > 40)");
    } catch(Exception $e) {}

    try {
        $stmt = $pdo->query("
            SELECT n.id, n.nombre_fantasia, n.ruta, n.plan, n.estado_pago, n.fecha_alta, 
                   n.ultimo_pago, n.comprobante, u.nombre_completo, u.email,
                   COALESCE(cw.tipo_calendario, 'clasico') AS tipo_calendario
            FROM negocios n
            LEFT JOIN personal_negocio pn ON n.id = pn.id_negocio AND pn.rol_en_local = 'admin'
            LEFT JOIN usuarios u ON pn.id_usuario = u.id
            LEFT JOIN configuracion_web cw ON n.id = cw.id_negocio
            ORDER BY n.id DESC
        ");
        $negocios = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Obtener notificaciones de errores recientes para el SuperAdmin
        $stmtNotifs = $pdo->query("SELECT * FROM notificaciones_admin ORDER BY fecha DESC LIMIT 50");
        $notifs_admin = $stmtNotifs->fetchAll(PDO::FETCH_ASSOC);
        
        echo json_encode(['success' => true, 'data' => $negocios, 'notificaciones' => $notifs_admin]);
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
    $email = trim($data['email'] ?? '');
    $password = trim($data['password'] ?? '');
    $nombre_fantasia = trim($data['nombre_fantasia'] ?? '');
    $rutaRaw = $data['ruta'] ?? $data['subdominio'] ?? ''; // Compatibilidad con variables previas
    $ruta = preg_replace('/[^a-zA-Z0-9-]/', '', strtolower(trim($rutaRaw))); // Sanitizar URL
    $plan = trim($data['plan'] ?? 'Basico');
    $estado_pago = trim($data['estado_pago'] ?? 'prueba');

    if (!$nombre_completo || !$email || !$password || !$nombre_fantasia || !$ruta) {
        echo json_encode(['success' => false, 'error' => 'Por favor completa todos los campos obligatorios.']);
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

    if (!$id_negocio) {
        echo json_encode(['success' => false, 'error' => 'Falta el ID del negocio para la actualización.']);
        exit;
    }

    try {
        $pdo->beginTransaction();

        if ($action === 'edit_client') {
            $nombre_completo = trim($data['nombre_completo'] ?? '');
            $email = trim($data['email'] ?? '');
            $nombre_fantasia = trim($data['nombre_fantasia'] ?? '');
            $ruta = preg_replace('/[^a-zA-Z0-9-]/', '', strtolower(trim($data['ruta'] ?? '')));
            $password = trim($data['password'] ?? '');

            if (!$nombre_completo || !$email || !$nombre_fantasia || !$ruta) {
                throw new Exception('Faltan datos obligatorios (Nombre, Email, Negocio o Ruta).');
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