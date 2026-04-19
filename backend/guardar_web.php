<?php
session_start();
header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/conexion.php';

// =========================================================================
// Migraciones automáticas de columnas para configuracion_web
// =========================================================================
try { $pdo->query("SELECT color_fondo FROM configuracion_web LIMIT 1"); } 
catch(Exception $e) { $pdo->exec("ALTER TABLE configuracion_web ADD COLUMN color_fondo VARCHAR(20) DEFAULT '#ffffff'"); }

try { $pdo->query("SELECT color_secundario FROM configuracion_web LIMIT 1"); } 
catch(Exception $e) { $pdo->exec("ALTER TABLE configuracion_web ADD COLUMN color_secundario VARCHAR(20) DEFAULT '#8b5cf6'"); }

try { $pdo->query("SELECT color_primario_web FROM configuracion_web LIMIT 1"); } 
catch(Exception $e) { $pdo->exec("ALTER TABLE configuracion_web ADD COLUMN color_primario_web VARCHAR(20) DEFAULT '#3b82f6'"); }

try { $pdo->query("SELECT color_secundario_web FROM configuracion_web LIMIT 1"); } 
catch(Exception $e) { $pdo->exec("ALTER TABLE configuracion_web ADD COLUMN color_secundario_web VARCHAR(20) DEFAULT '#8b5cf6'"); }

try { $pdo->query("SELECT whatsapp_contacto FROM configuracion_web LIMIT 1"); } 
catch(Exception $e) { $pdo->exec("ALTER TABLE configuracion_web ADD COLUMN whatsapp_contacto VARCHAR(50) DEFAULT ''"); }

try { $pdo->query("SELECT instagram_url FROM configuracion_web LIMIT 1"); } 
catch(Exception $e) { $pdo->exec("ALTER TABLE configuracion_web ADD COLUMN instagram_url VARCHAR(255) DEFAULT ''"); }

try { $pdo->query("SELECT ultimo_pago FROM negocios LIMIT 1"); } 
catch(Exception $e) { $pdo->exec("ALTER TABLE negocios ADD COLUMN ultimo_pago DATETIME DEFAULT NULL"); }

try { $pdo->query("SELECT hora_apertura FROM configuracion_web LIMIT 1"); } 
catch(Exception $e) { $pdo->exec("ALTER TABLE configuracion_web ADD COLUMN hora_apertura VARCHAR(5) DEFAULT '09:00'"); }

try { $pdo->query("SELECT hora_cierre FROM configuracion_web LIMIT 1"); } 
catch(Exception $e) { $pdo->exec("ALTER TABLE configuracion_web ADD COLUMN hora_cierre VARCHAR(5) DEFAULT '18:00'"); }

try { $pdo->query("SELECT intervalo_turnos FROM configuracion_web LIMIT 1"); } 
catch(Exception $e) { $pdo->exec("ALTER TABLE configuracion_web ADD COLUMN intervalo_turnos INT DEFAULT 30"); }

try { $pdo->query("SELECT fondo FROM configuracion_web LIMIT 1"); } 
catch(Exception $e) { $pdo->exec("ALTER TABLE configuracion_web ADD COLUMN fondo VARCHAR(255) DEFAULT NULL"); }

try { $pdo->query("SELECT color_calendario FROM configuracion_web LIMIT 1"); } 
catch(Exception $e) { $pdo->exec("ALTER TABLE configuracion_web ADD COLUMN color_calendario VARCHAR(20) DEFAULT '#1e293b'"); }

try { $pdo->query("SELECT texto_calendario FROM configuracion_web LIMIT 1"); } 
catch(Exception $e) { $pdo->exec("ALTER TABLE configuracion_web ADD COLUMN texto_calendario VARCHAR(10) DEFAULT 'blanco'"); }

try { $pdo->query("SELECT alineacion_servicios FROM configuracion_web LIMIT 1"); } 
catch(Exception $e) { $pdo->exec("ALTER TABLE configuracion_web ADD COLUMN alineacion_servicios VARCHAR(20) DEFAULT 'left'"); }

try { $pdo->query("SELECT titulo FROM configuracion_web LIMIT 1"); } 
catch(Exception $e) { $pdo->exec("ALTER TABLE configuracion_web ADD COLUMN titulo VARCHAR(255) DEFAULT ''"); }

try { $pdo->query("SELECT subtitulo FROM configuracion_web LIMIT 1"); } 
catch(Exception $e) { $pdo->exec("ALTER TABLE configuracion_web ADD COLUMN subtitulo VARCHAR(255) DEFAULT ''"); }

try { $pdo->query("SELECT turnos_simultaneos FROM configuracion_web LIMIT 1"); } 
catch(Exception $e) { $pdo->exec("ALTER TABLE configuracion_web ADD COLUMN turnos_simultaneos VARCHAR(10) DEFAULT 'no'"); }

try { $pdo->query("SELECT anticipacion_turno_min FROM configuracion_web LIMIT 1"); } 
catch(Exception $e) { $pdo->exec("ALTER TABLE configuracion_web ADD COLUMN anticipacion_turno_min INT DEFAULT 0"); }

try { $pdo->query("SELECT tipo_calendario FROM configuracion_web LIMIT 1"); } 
catch(Exception $e) { $pdo->exec("ALTER TABLE configuracion_web ADD COLUMN tipo_calendario VARCHAR(20) DEFAULT 'clasico'"); }

try { $pdo->query("SELECT texto_local FROM configuracion_web LIMIT 1"); } 
catch(Exception $e) { $pdo->exec("ALTER TABLE configuracion_web ADD COLUMN texto_local TEXT DEFAULT NULL"); }

try { $pdo->query("SELECT ubicacion_maps FROM configuracion_web LIMIT 1"); } 
catch(Exception $e) { $pdo->exec("ALTER TABLE configuracion_web ADD COLUMN ubicacion_maps TEXT DEFAULT NULL"); }

try { $pdo->query("SELECT cursos_html FROM configuracion_web LIMIT 1"); } 
catch(Exception $e) { $pdo->exec("ALTER TABLE configuracion_web ADD COLUMN cursos_html LONGTEXT DEFAULT NULL"); }

try { $pdo->query("SELECT cursos_json FROM configuracion_web LIMIT 1"); } 
catch(Exception $e) { $pdo->exec("ALTER TABLE configuracion_web ADD COLUMN cursos_json LONGTEXT DEFAULT NULL"); }

try { $pdo->query("SELECT hora_descanso_inicio FROM configuracion_web LIMIT 1"); } 
catch(Exception $e) { $pdo->exec("ALTER TABLE configuracion_web ADD COLUMN hora_descanso_inicio VARCHAR(5) DEFAULT ''"); }

try { $pdo->query("SELECT hora_descanso_fin FROM configuracion_web LIMIT 1"); } 
catch(Exception $e) { $pdo->exec("ALTER TABLE configuracion_web ADD COLUMN hora_descanso_fin VARCHAR(5) DEFAULT ''"); }

try { $pdo->query("SELECT dias_trabajo FROM configuracion_web LIMIT 1"); } 
catch(Exception $e) { $pdo->exec("ALTER TABLE configuracion_web ADD COLUMN dias_trabajo VARCHAR(50) DEFAULT '1,2,3,4,5,6'"); }

try { $pdo->query("SELECT profesionales_json FROM configuracion_web LIMIT 1"); } 
catch(Exception $e) { $pdo->exec("ALTER TABLE configuracion_web ADD COLUMN profesionales_json LONGTEXT DEFAULT NULL"); }

// =========================================================================
// AUTO-SUSPENSIÓN DE NEGOCIOS VENCIDOS (Pseudo-Cron)
// =========================================================================
// Suspende si pasaron > 40 días de prueba (30 días + 10 de gracia para pagar)
// Suspende si están Activos y pasaron > 40 días desde su último pago
try {
    $pdo->exec("UPDATE negocios SET estado_pago = 'suspendido' WHERE (estado_pago = 'prueba' AND DATEDIFF(NOW(), fecha_alta) > 15) OR (estado_pago = 'beta' AND DATEDIFF(NOW(), fecha_alta) > 30) OR (estado_pago IN ('activo', 'pagado') AND ultimo_pago IS NOT NULL AND DATEDIFF(NOW(), ultimo_pago) > 40)");
} catch(Exception $e) { /* Ejecución silenciosa */ }

// Petición GET: Devolver los datos actuales desde la BD
if ($_SERVER['REQUEST_METHOD'] === 'GET') {

    try {
        $id_negocio = null;
        
        if (!empty($_GET['n'])) {
            $ruta = $_GET['n'];
            $stmtNegocio = $pdo->prepare("SELECT id FROM negocios WHERE ruta = :sub LIMIT 1");
            $stmtNegocio->execute(['sub' => $ruta]);
            $negocio = $stmtNegocio->fetch();
            if ($negocio) {
                $id_negocio = $negocio['id'];
            }
        } else if (isset($_SESSION['id_negocio'])) {
            // Si el administrador está logueado y no pasa la ruta en la URL, usamos su sesión
            $id_negocio = $_SESSION['id_negocio'];
        }

        if (!$id_negocio) {
            echo json_encode([]); exit;
        }

        $stmt = $pdo->prepare("SELECT color_primario, color_secundario, color_primario_web, color_secundario_web, color_fondo, url_logo AS logo, fondo, mensaje_bienvenida AS titulo, subtitulo, whatsapp_contacto, instagram_url, hora_apertura, hora_cierre, intervalo_turnos, turnos_simultaneos, anticipacion_turno_min, alineacion_servicios, tipo_calendario, texto_local, ubicacion_maps, cursos_html, cursos_json, profesionales_json, hora_descanso_inicio, hora_descanso_fin, dias_trabajo FROM configuracion_web WHERE id_negocio = :id_negocio");
        $stmt->execute(['id_negocio' => $id_negocio]);
        $config = $stmt->fetch();
        
        if (!$config) {
            // Si no hay configuración aún, devolvemos un array vacío
            $config = [];
        }
        
        // Si el título de la página web está vacío, podemos usar el nombre del negocio de la BD como alternativa
        $stmtN = $pdo->prepare("SELECT nombre_fantasia, plan, estado_pago, ultimo_pago, fecha_alta FROM negocios WHERE id = :id");
        $stmtN->execute(['id' => $id_negocio]);
        $n = $stmtN->fetch();
        
        if ($n) {
            if (empty($config['titulo']) && !empty($n['nombre_fantasia'])) {
                $config['titulo'] = $n['nombre_fantasia'];
            }
            $config['plan'] = $n['plan'] ?? 'Basico';
            $config['estado_pago'] = $n['estado_pago'] ?? 'prueba';
            $config['ultimo_pago'] = $n['ultimo_pago'] ?? null;
            $config['fecha_alta'] = $n['fecha_alta'] ?? null;
        }
        
        echo json_encode($config);

    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Error al obtener la configuración: ' . $e->getMessage()]);
    }
    exit;
}

// Petición POST: Guardar los nuevos datos en la BD
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Solo permitir si el administrador está logueado en su negocio
    if (!isset($_SESSION['id_negocio'])) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'No autorizado. Inicia sesión.']);
        exit;
    }
    
    $id_negocio = $_SESSION['id_negocio']; // Sacamos el id de la sesión

    $contentType = isset($_SERVER["CONTENT_TYPE"]) ? trim($_SERVER["CONTENT_TYPE"]) : '';
    if (strpos($contentType, 'application/json') !== false) {
        $data = json_decode(file_get_contents('php://input'), true);
    } else {
        $data = $_POST;
    }

    try {
        $stmtOld = $pdo->prepare("SELECT * FROM configuracion_web WHERE id_negocio = ?");
        $stmtOld->execute([$id_negocio]);
        $oldData = $stmtOld->fetch() ?: [];
        
        $maxSize = 2 * 1024 * 1024; // Límite de 2MB

        // Subir LOGO si fue enviado por archivo
        if (isset($_FILES['logo_file']) && $_FILES['logo_file']['error'] === UPLOAD_ERR_OK) {
            $fileL = $_FILES['logo_file'];

            if ($fileL['size'] > $maxSize) {
                http_response_code(413); // Payload Too Large
                echo json_encode(['success' => false, 'error' => 'El logo es demasiado pesado. El límite es 2MB.']);
                exit;
            }

            $uploadDirL = __DIR__ . '/uploads/logos/';
            if (!is_dir($uploadDirL)) mkdir($uploadDirL, 0755, true);
            $extL = pathinfo($fileL['name'], PATHINFO_EXTENSION);
            $filenameL = 'logo_' . $id_negocio . '_' . time() . '.' . $extL;
            if (move_uploaded_file($fileL['tmp_name'], $uploadDirL . $filenameL)) {
                $data['logo'] = 'backend/uploads/logos/' . $filenameL;
            }
        }

        // Subir FONDO si fue enviado por archivo
        if (isset($_FILES['fondo_file']) && $_FILES['fondo_file']['error'] === UPLOAD_ERR_OK) {
            $fileF = $_FILES['fondo_file'];

            if ($fileF['size'] > $maxSize) {
                http_response_code(413);
                echo json_encode(['success' => false, 'error' => 'La imagen de fondo es demasiado pesada. El límite es 2MB.']);
                exit;
            }

            $uploadDirF = __DIR__ . '/uploads/fondos/';
            if (!is_dir($uploadDirF)) mkdir($uploadDirF, 0755, true);
            $extF = pathinfo($fileF['name'], PATHINFO_EXTENSION);
            $filenameF = 'fondo_' . $id_negocio . '_' . time() . '.' . $extF;
            if (move_uploaded_file($fileF['tmp_name'], $uploadDirF . $filenameF)) {
                $data['fondo'] = 'backend/uploads/fondos/' . $filenameF;
            }
        }
        
        if (isset($data['remove_logo']) && $data['remove_logo'] == '1') {
            $url_logo = '';
        }
        if (isset($data['remove_fondo']) && $data['remove_fondo'] == '1') {
            $url_fondo = '';
        }
        
        $color_primario = isset($data['color_primario']) ? $data['color_primario'] : ($oldData['color_primario'] ?? '#3b82f6');
        $color_secundario = isset($data['color_secundario']) ? $data['color_secundario'] : ($oldData['color_secundario'] ?? '#8b5cf6');
        $color_primario_web = isset($data['color_primario_web']) ? $data['color_primario_web'] : ($oldData['color_primario_web'] ?? '#3b82f6');
        $color_secundario_web = isset($data['color_secundario_web']) ? $data['color_secundario_web'] : ($oldData['color_secundario_web'] ?? '#8b5cf6');
        $color_fondo = isset($data['color_fondo']) ? $data['color_fondo'] : ($oldData['color_fondo'] ?? '#ffffff');
        $url_logo = isset($data['logo']) ? $data['logo'] : ($oldData['url_logo'] ?? '');
        $url_fondo = isset($data['fondo']) ? $data['fondo'] : ($oldData['fondo'] ?? '');
        $mensaje_bienvenida = isset($data['titulo']) ? $data['titulo'] : ($oldData['mensaje_bienvenida'] ?? '');
        $whatsapp_contacto = isset($data['whatsapp_contacto']) ? $data['whatsapp_contacto'] : ($oldData['whatsapp_contacto'] ?? '');
        $instagram_url = isset($data['instagram_url']) ? $data['instagram_url'] : ($oldData['instagram_url'] ?? '');
        $hora_apertura = isset($data['hora_apertura']) ? $data['hora_apertura'] : ($oldData['hora_apertura'] ?? '09:00');
        $hora_cierre = isset($data['hora_cierre']) ? $data['hora_cierre'] : ($oldData['hora_cierre'] ?? '18:00');
        $intervalo_turnos = isset($data['intervalo_turnos']) ? (int)$data['intervalo_turnos'] : ($oldData['intervalo_turnos'] ?? 30);
        $turnos_simultaneos = isset($data['turnos_simultaneos']) ? $data['turnos_simultaneos'] : ($oldData['turnos_simultaneos'] ?? 'no');
        $anticipacion_turno_min = isset($data['anticipacion_turno_min']) ? max(0, (int)$data['anticipacion_turno_min']) : ($oldData['anticipacion_turno_min'] ?? 0);
        $subtitulo = isset($data['subtitulo']) ? $data['subtitulo'] : ($oldData['subtitulo'] ?? '');
        $alineacion_servicios = isset($data['alineacion_servicios']) ? $data['alineacion_servicios'] : ($oldData['alineacion_servicios'] ?? 'left');
        $tipo_calendario = isset($data['tipo_calendario']) ? $data['tipo_calendario'] : ($oldData['tipo_calendario'] ?? 'clasico');
        
        $texto_local = isset($data['texto_local']) ? $data['texto_local'] : ($oldData['texto_local'] ?? '');
        $ubicacion_maps = isset($data['ubicacion_maps']) ? $data['ubicacion_maps'] : ($oldData['ubicacion_maps'] ?? '');
        $cursos_html = isset($data['cursos_html']) ? $data['cursos_html'] : ($oldData['cursos_html'] ?? '');
        $cursos_json = isset($data['cursos_json']) ? $data['cursos_json'] : ($oldData['cursos_json'] ?? '[]');
        $profesionales_json = isset($data['profesionales_json']) ? $data['profesionales_json'] : ($oldData['profesionales_json'] ?? '[]');
        $hora_descanso_inicio = isset($data['hora_descanso_inicio']) ? $data['hora_descanso_inicio'] : ($oldData['hora_descanso_inicio'] ?? '');
        $hora_descanso_fin = isset($data['hora_descanso_fin']) ? $data['hora_descanso_fin'] : ($oldData['hora_descanso_fin'] ?? '');
        $dias_trabajo = isset($data['dias_trabajo']) ? $data['dias_trabajo'] : ($oldData['dias_trabajo'] ?? '1,2,3,4,5,6');
        
        $stmt = $pdo->prepare("INSERT INTO configuracion_web 
            (id_negocio, color_primario, color_secundario, color_primario_web, color_secundario_web, color_fondo, url_logo, fondo, mensaje_bienvenida, subtitulo, whatsapp_contacto, instagram_url, hora_apertura, hora_cierre, intervalo_turnos, turnos_simultaneos, anticipacion_turno_min, alineacion_servicios, tipo_calendario, texto_local, ubicacion_maps, cursos_html, cursos_json, profesionales_json, hora_descanso_inicio, hora_descanso_fin, dias_trabajo) 
            VALUES (:id_negocio, :c_pri, :c_sec, :c_p_web, :c_s_web, :c_bg, :logo, :fondo, :msg, :subtitulo, :wpp, :ig, :h_open, :h_close, :intervalo, :simultaneos, :anticipacion, :align, :tipo_cal, :txt_local, :maps, :cursos_h, :cursos_j, :profs, :h_d_inicio, :h_d_fin, :d_trabajo) 
            ON DUPLICATE KEY UPDATE 
            color_primario = :c_pri, color_secundario = :c_sec, color_primario_web = :c_p_web, color_secundario_web = :c_s_web, color_fondo = :c_bg, url_logo = :logo, fondo = :fondo, mensaje_bienvenida = :msg, subtitulo = :subtitulo, whatsapp_contacto = :wpp, instagram_url = :ig, hora_apertura = :h_open, hora_cierre = :h_close, intervalo_turnos = :intervalo, turnos_simultaneos = :simultaneos, anticipacion_turno_min = :anticipacion, alineacion_servicios = :align, tipo_calendario = :tipo_cal, texto_local = :txt_local, ubicacion_maps = :maps, cursos_html = :cursos_h, cursos_json = :cursos_j, profesionales_json = :profs, hora_descanso_inicio = :h_d_inicio, hora_descanso_fin = :h_d_fin, dias_trabajo = :d_trabajo");
            
        $stmt->execute([
            'id_negocio' => $id_negocio, 'c_pri' => $color_primario, 'c_sec' => $color_secundario, 'c_p_web' => $color_primario_web, 'c_s_web' => $color_secundario_web,
            'c_bg' => $color_fondo, 'logo' => $url_logo, 'fondo' => $url_fondo, 'msg' => $mensaje_bienvenida, 'subtitulo' => $subtitulo, 'wpp' => $whatsapp_contacto, 'ig' => $instagram_url, 'h_open' => $hora_apertura, 'h_close' => $hora_cierre, 'intervalo' => $intervalo_turnos, 'simultaneos' => $turnos_simultaneos, 'anticipacion' => $anticipacion_turno_min, 'align' => $alineacion_servicios, 'tipo_cal' => $tipo_calendario, 'txt_local' => $texto_local, 'maps' => $ubicacion_maps, 'cursos_h' => $cursos_html, 'cursos_j' => $cursos_json, 'profs' => $profesionales_json, 'h_d_inicio' => $hora_descanso_inicio, 'h_d_fin' => $hora_descanso_fin, 'd_trabajo' => $dias_trabajo
        ]);

        $response = ['success' => true];
        if ($url_logo) $response['logoUrl'] = $url_logo;
        if ($url_fondo) $response['fondoUrl'] = $url_fondo;
        echo json_encode($response);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Error al guardar la configuración: ' . $e->getMessage()]);
    }
    exit;
}

http_response_code(405);
echo json_encode(['success' => false, 'error' => 'Método no permitido.']);
?>