<?php
session_start();
header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/conexion.php';

// =========================================================================
// Asegurar que las nuevas columnas existan dinámicamente (Migración)
// =========================================================================
try { $pdo->query("SELECT descripcion FROM servicios LIMIT 1"); } 
catch(Exception $e) { $pdo->exec("ALTER TABLE servicios ADD COLUMN descripcion TEXT DEFAULT NULL"); }

try { $pdo->query("SELECT imagen1 FROM servicios LIMIT 1"); } 
catch(Exception $e) { $pdo->exec("ALTER TABLE servicios ADD COLUMN imagen1 VARCHAR(255) DEFAULT NULL"); }

try { $pdo->query("SELECT imagen2 FROM servicios LIMIT 1"); } 
catch(Exception $e) { $pdo->exec("ALTER TABLE servicios ADD COLUMN imagen2 VARCHAR(255) DEFAULT NULL"); }

try { $pdo->query("SELECT imagen3 FROM servicios LIMIT 1"); } 
catch(Exception $e) { $pdo->exec("ALTER TABLE servicios ADD COLUMN imagen3 VARCHAR(255) DEFAULT NULL"); }

try { $pdo->query("SELECT profesional FROM servicios LIMIT 1"); } 
catch(Exception $e) { $pdo->exec("ALTER TABLE servicios ADD COLUMN profesional VARCHAR(255) DEFAULT ''"); }

try { $pdo->query("SELECT precio_sena FROM servicios LIMIT 1"); } 
catch(Exception $e) { $pdo->exec("ALTER TABLE servicios ADD COLUMN precio_sena DECIMAL(10, 2) DEFAULT 0"); }

try { $pdo->query("SELECT capacidad FROM servicios LIMIT 1"); } 
catch(Exception $e) { $pdo->exec("ALTER TABLE servicios ADD COLUMN capacidad INT DEFAULT 1"); }

try { $pdo->query("SELECT foto_profesional FROM servicios LIMIT 1"); } 
catch(Exception $e) { $pdo->exec("ALTER TABLE servicios ADD COLUMN foto_profesional VARCHAR(255) DEFAULT NULL"); }

try { $pdo->query("SELECT email_profesional FROM servicios LIMIT 1"); } 
catch(Exception $e) { $pdo->exec("ALTER TABLE servicios ADD COLUMN email_profesional VARCHAR(255) DEFAULT ''"); }

try { $pdo->query("SELECT token_seguridad FROM negocios LIMIT 1"); } 
catch(Exception $e) { $pdo->exec("ALTER TABLE negocios ADD COLUMN token_seguridad VARCHAR(255) DEFAULT 'AgendatinaSec_2024'"); }

try { $pdo->query("SELECT orden FROM servicios LIMIT 1"); } 
catch(Exception $e) { $pdo->exec("ALTER TABLE servicios ADD COLUMN orden INT DEFAULT 0"); }

$method = $_SERVER['REQUEST_METHOD'];

// =========================================================================
// OBTENER SERVICIOS (MÉTODO GET)
// =========================================================================
if ($method === 'GET') {
    // Liberar la sesión para permitir peticiones concurrentes
    session_write_close();

    try {
        $id_negocio = null;

        // 1. Extraer el ID del negocio usando la ruta enviada en la URL (?n=tu-negocio)
        if (!empty($_GET['n'])) {
            $ruta = trim($_GET['n']);
            $stmtNegocio = $pdo->prepare("SELECT id FROM negocios WHERE ruta = :ruta LIMIT 1");
            $stmtNegocio->execute(['ruta' => $ruta]);
            $negocio = $stmtNegocio->fetch(PDO::FETCH_ASSOC);
            
            if ($negocio) {
                $id_negocio = $negocio['id'];
            }
        } 
        // 2. Si no hay 'n', verificar si hay una sesión de administrador activa
        else if (isset($_SESSION['id_negocio'])) {
            $id_negocio = $_SESSION['id_negocio'];
        }

        // 3. Si no logramos identificar el negocio, devolvemos vacío
        if (!$id_negocio) {
            echo json_encode([]);
            exit;
        }

        // 4. Obtener solo los servicios que pertenecen a ese negocio
        $stmt = $pdo->prepare("SELECT id, id_negocio, nombre_servicio AS nombre, descripcion, duracion_minutos AS duracion, precio, precio_sena, capacidad, profesional, email_profesional, foto_profesional, imagen1, imagen2, imagen3 FROM servicios WHERE id_negocio = :id_negocio ORDER BY orden ASC, id DESC");
        $stmt->execute(['id_negocio' => $id_negocio]);
        $servicios = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Obtener ruta del negocio y token para armar los enlaces de agenda de cada profesional
        $stmtNeg = $pdo->prepare("SELECT ruta, token_seguridad FROM negocios WHERE id = :id LIMIT 1");
        $stmtNeg->execute(['id' => $id_negocio]);
        $negData = $stmtNeg->fetch(PDO::FETCH_ASSOC);
        
        $ruta_negocio = $negData ? $negData['ruta'] : '';
        $secret = !empty($negData['token_seguridad']) ? $negData['token_seguridad'] : 'AgendatinaSec_2024'; // Clave secreta para firmar los enlaces
        
        // Obtener el nombre del dueño del negocio como profesional por defecto
        $stmtOwner = $pdo->prepare("SELECT u.nombre_completo FROM usuarios u JOIN personal_negocio pn ON u.id = pn.id_usuario WHERE pn.id_negocio = :id AND pn.rol_en_local = 'admin' LIMIT 1");
        $stmtOwner->execute(['id' => $id_negocio]);
        $ownerName = $stmtOwner->fetchColumn();
        
        foreach ($servicios as &$serv) {
            if (empty($serv['profesional'])) { $serv['profesional'] = $ownerName; }
            if (!empty($serv['profesional'])) {
                $profKey = strtolower(trim($serv['profesional']));
                $token = hash('sha256', $id_negocio . '|' . $profKey . '|' . $secret);
                $serv['enlace_agenda'] = "agenda-profesional.html?n=" . urlencode($ruta_negocio) . "&p=" . urlencode($serv['profesional']) . "&token=" . $token;
            } else {
                $serv['enlace_agenda'] = "";
            }
        }

        echo json_encode($servicios);

    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Error al obtener servicios: ' . $e->getMessage()]);
    }
    exit;
}

// =========================================================================
// CREAR O ACTUALIZAR SERVICIO (MÉTODO POST)
// =========================================================================
if ($method === 'POST') {
    if (!isset($_SESSION['id_negocio'])) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'No autorizado.']);
        exit;
    }

    $contentType = isset($_SERVER["CONTENT_TYPE"]) ? trim($_SERVER["CONTENT_TYPE"]) : '';
    if (strpos($contentType, 'application/json') !== false) {
        $data = json_decode(file_get_contents('php://input'), true);
    } else {
        $data = $_POST;
    }

    $id_negocio = $_SESSION['id_negocio'];
    
    if (isset($data['action']) && $data['action'] === 'reorder') {
        if (isset($data['order']) && is_array($data['order'])) {
            foreach ($data['order'] as $index => $id_srv) {
                $stmt = $pdo->prepare("UPDATE servicios SET orden = :orden WHERE id = :id AND id_negocio = :id_negocio");
                $stmt->execute(['orden' => $index, 'id' => $id_srv, 'id_negocio' => $id_negocio]);
            }
        }
        echo json_encode(['success' => true]);
        exit;
    }

    // Asegurarse de tomar el ID, venga por JSON o por Formulario Multipart
    $id = !empty($_POST['id']) ? $_POST['id'] : (!empty($data['id']) ? $data['id'] : null);
    $nombre = $data['nombre'] ?? '';
    $duracion = $data['duracion'] ?? 0;
    $precio = $data['precio'] ?? 0;
    $precio_sena = $data['precio_sena'] ?? 0;
    $capacidad = isset($data['capacidad']) ? (int)$data['capacidad'] : 1;
    $descripcion = $data['descripcion'] ?? '';
    $profesional = $data['profesional'] ?? '';
    $email_profesional = $data['email_profesional'] ?? '';
    $foto_profesional = $data['foto_profesional'] ?? '';
    $imagen1 = $data['imagen1'] ?? $_POST['imagen1'] ?? '';
    $imagen2 = $data['imagen2'] ?? $_POST['imagen2'] ?? '';
    $imagen3 = $data['imagen3'] ?? $_POST['imagen3'] ?? '';

    // =========================================================================
    // FUNCIÓN DE OPTIMIZACIÓN DE IMÁGENES (Redimensión y conversión a WebP)
    // =========================================================================
    function optimizarImagen($origen, $destino, $calidad = 80, $max_resolucion = 1000) {
        $info = @getimagesize($origen);
        if (!$info) return false;

        $mime = $info['mime'];
        switch ($mime) {
            case 'image/jpeg': $imagen = @imagecreatefromjpeg($origen); break;
            case 'image/png': $imagen = @imagecreatefrompng($origen); break;
            case 'image/webp': $imagen = @imagecreatefromwebp($origen); break;
            case 'image/gif': $imagen = @imagecreatefromgif($origen); break;
            default: return false;
        }
        if (!$imagen) return false;

        $ancho = imagesx($imagen);
        $alto = imagesy($imagen);
        $nuevo_ancho = $ancho; $nuevo_alto = $alto;

        if ($ancho > $max_resolucion || $alto > $max_resolucion) {
            $ratio = $ancho / $alto;
            if ($ancho > $alto) { $nuevo_ancho = $max_resolucion; $nuevo_alto = $max_resolucion / $ratio; } 
            else { $nuevo_alto = $max_resolucion; $nuevo_ancho = $max_resolucion * $ratio; }
        }

        $nueva_imagen = imagecreatetruecolor($nuevo_ancho, $nuevo_alto);
        imagealphablending($nueva_imagen, false);
        imagesavealpha($nueva_imagen, true);
        $transparente = imagecolorallocatealpha($nueva_imagen, 255, 255, 255, 127);
        imagefilledrectangle($nueva_imagen, 0, 0, $nuevo_ancho, $nuevo_alto, $transparente);
        imagecopyresampled($nueva_imagen, $imagen, 0, 0, 0, 0, $nuevo_ancho, $nuevo_alto, $ancho, $alto);
        imagedestroy($imagen);
        $exito = imagewebp($nueva_imagen, $destino, $calidad);
        imagedestroy($nueva_imagen);
        return $exito;
    }

    // Procesar archivo de foto si se envió uno desde la computadora
    if (isset($_FILES['foto_profesional_file']) && $_FILES['foto_profesional_file']['error'] === UPLOAD_ERR_OK) {
        $file = $_FILES['foto_profesional_file'];
        $allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        
        if (in_array($file['type'], $allowedTypes) && $file['size'] <= 2 * 1024 * 1024) {
            $uploadDir = __DIR__ . '/uploads/profesionales/';
            if (!is_dir($uploadDir)) {
                mkdir($uploadDir, 0755, true);
            }
            // Forzamos la extensión WebP y optimizamos (Max: 800px para perfiles)
            $filename = 'prof_' . $id_negocio . '_' . time() . '_' . rand(100,999) . '.webp';
            if (optimizarImagen($file['tmp_name'], $uploadDir . $filename, 80, 800)) {
                $foto_profesional = 'backend/uploads/profesionales/' . $filename;
            }
        }
    }

    // Procesar imágenes del servicio
    $uploadDirServ = __DIR__ . '/uploads/servicios/';
    if (!is_dir($uploadDirServ)) mkdir($uploadDirServ, 0755, true);
    $maxSize = 2 * 1024 * 1024; // Límite de 2MB
    
    for ($i = 1; $i <= 3; $i++) {
        $key = "imagen{$i}_file";
        if (isset($_FILES[$key]) && $_FILES[$key]['error'] === UPLOAD_ERR_OK) {
            $file = $_FILES[$key];
            if ($file['size'] > $maxSize) {
                http_response_code(413);
                echo json_encode(['success' => false, 'error' => "La imagen {$i} del servicio es demasiado pesada. El límite es 2MB."]);
                exit;
            }

            // Forzamos la extensión WebP y optimizamos (Max: 1000px para servicios)
            $filename = "serv_{$id_negocio}_{$i}_" . time() . ".webp";

            if (optimizarImagen($_FILES[$key]['tmp_name'], $uploadDirServ . $filename, 80, 1000)) {
                ${"imagen".$i} = 'backend/uploads/servicios/' . $filename;
            }
        }
    }

    try {
        // Verificar si ya existe un servicio idéntico (mismo nombre, duración y profesional)
        if ($id) {
            $stmtCheck = $pdo->prepare("SELECT id FROM servicios WHERE id_negocio = :id_negocio AND nombre_servicio = :nombre AND duracion_minutos = :duracion AND profesional = :profesional AND id != :id LIMIT 1");
            $stmtCheck->execute(['id_negocio' => $id_negocio, 'nombre' => $nombre, 'duracion' => $duracion, 'profesional' => $profesional, 'id' => $id]);
        } else {
            $stmtCheck = $pdo->prepare("SELECT id FROM servicios WHERE id_negocio = :id_negocio AND nombre_servicio = :nombre AND duracion_minutos = :duracion AND profesional = :profesional LIMIT 1");
            $stmtCheck->execute(['id_negocio' => $id_negocio, 'nombre' => $nombre, 'duracion' => $duracion, 'profesional' => $profesional]);
        }

        if ($stmtCheck->fetch()) {
            echo json_encode(['success' => false, 'error' => 'Este servicio ya se encuentra registrado para este mismo profesional con la misma duración.']);
            exit;
        }

        if ($id) {
            $stmt = $pdo->prepare("UPDATE servicios SET nombre_servicio = :nombre, duracion_minutos = :duracion, precio = :precio, precio_sena = :precio_sena, capacidad = :capacidad, descripcion = :descripcion, profesional = :profesional, email_profesional = :email_profesional, foto_profesional = :foto_profesional, imagen1 = :imagen1, imagen2 = :imagen2, imagen3 = :imagen3 WHERE id = :id AND id_negocio = :id_negocio");
            $stmt->execute(['nombre' => $nombre, 'duracion' => $duracion, 'precio' => $precio, 'precio_sena' => $precio_sena, 'capacidad' => $capacidad, 'descripcion' => $descripcion, 'profesional' => $profesional, 'email_profesional' => $email_profesional, 'foto_profesional' => $foto_profesional, 'imagen1' => $imagen1, 'imagen2' => $imagen2, 'imagen3' => $imagen3, 'id' => $id, 'id_negocio' => $id_negocio]);
        } else {
            $stmt = $pdo->prepare("INSERT INTO servicios (id_negocio, nombre_servicio, duracion_minutos, precio, precio_sena, capacidad, descripcion, profesional, email_profesional, foto_profesional, imagen1, imagen2, imagen3) VALUES (:id_negocio, :nombre, :duracion, :precio, :precio_sena, :capacidad, :descripcion, :profesional, :email_profesional, :foto_profesional, :imagen1, :imagen2, :imagen3)");
            $stmt->execute(['id_negocio' => $id_negocio, 'nombre' => $nombre, 'duracion' => $duracion, 'precio' => $precio, 'precio_sena' => $precio_sena, 'capacidad' => $capacidad, 'descripcion' => $descripcion, 'profesional' => $profesional, 'email_profesional' => $email_profesional, 'foto_profesional' => $foto_profesional, 'imagen1' => $imagen1, 'imagen2' => $imagen2, 'imagen3' => $imagen3]);
        }

        // Auto-sincronizar el profesional a la página web (Mi Equipo)
        if (!empty($profesional)) {
            $stmtCw = $pdo->prepare("SELECT profesionales_json FROM configuracion_web WHERE id_negocio = :id_negocio");
            $stmtCw->execute(['id_negocio' => $id_negocio]);
            $cw = $stmtCw->fetch();
            $profs = [];
            if ($cw && !empty($cw['profesionales_json'])) {
                $profs = json_decode($cw['profesionales_json'], true);
                if (!is_array($profs)) $profs = [];
            }
            $found = false;
            foreach ($profs as &$p) {
                if ($p['nombre'] === $profesional) {
                    $found = true;
                    if (!empty($foto_profesional) && empty($p['foto'])) {
                        $p['foto'] = $foto_profesional;
                    }
                    break;
                }
            }
            if (!$found) {
                $profs[] = ['nombre' => $profesional, 'descripcion' => '', 'foto' => $foto_profesional];
            }
            $pdo->prepare("UPDATE configuracion_web SET profesionales_json = :json WHERE id_negocio = :id_negocio")
                ->execute(['json' => json_encode($profs), 'id_negocio' => $id_negocio]);
        }

        echo json_encode(['success' => true]);
    } catch (PDOException $e) {
        echo json_encode(['success' => false, 'error' => 'Error al guardar el servicio: ' . $e->getMessage()]);
    }
    exit;
}

// =========================================================================
// ELIMINAR SERVICIO (MÉTODO DELETE)
// =========================================================================
if ($method === 'DELETE') {
    if (!isset($_SESSION['id_negocio'])) {
        echo json_encode(['success' => false, 'error' => 'No autorizado.']);
        exit;
    }
    $id = $_GET['id'] ?? null;
    $id_negocio = $_SESSION['id_negocio'];

    $stmt = $pdo->prepare("DELETE FROM servicios WHERE id = :id AND id_negocio = :id_negocio");
    $stmt->execute(['id' => $id, 'id_negocio' => $id_negocio]);
    echo json_encode(['success' => true]);
}