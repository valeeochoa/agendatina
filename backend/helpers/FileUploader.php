<?php
class FileUploader {
    private $uploadDir;
    private $subFolder;

    public function __construct($subFolder) {
        $this->subFolder = trim($subFolder, '/');
        $this->uploadDir = dirname(dirname(__DIR__)) . '/uploads/' . $this->subFolder . '/';
    }

    public function upload($file, $maxSize = 2097152, $allowedExtensions = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'pdf'], $allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'], $optimizeImage = false) {
        if ($file['error'] !== UPLOAD_ERR_OK) {
            return ['success' => false, 'error' => 'Hubo un error al subir el archivo al servidor.'];
        }

        // 1. Validar tamaño
        if ($file['size'] > $maxSize) {
            $maxMb = round($maxSize / (1024 * 1024), 1);
            return ['success' => false, 'error' => "El archivo es demasiado pesado. El tamaño máximo permitido es {$maxMb}MB."];
        }

        // 2. Validar extensión
        $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        if (!in_array($ext, $allowedExtensions)) {
            return ['success' => false, 'error' => 'Formato no permitido. Extensión de archivo inválida.'];
        }

        // 3. Validar tipo MIME real
        $realMime = '';
        if (function_exists('finfo_open')) {
            $finfo = finfo_open(FILEINFO_MIME_TYPE);
            $realMime = finfo_file($finfo, $file['tmp_name']);
            finfo_close($finfo);
        } elseif (function_exists('mime_content_type')) {
            $realMime = mime_content_type($file['tmp_name']);
        } else {
            $realMime = $file['type'];
        }

        if (!in_array($realMime, $allowedMimes)) {
            return ['success' => false, 'error' => 'Contenido de archivo no permitido. Tipo de archivo inválido.'];
        }

        // Asegurar que el directorio de subida exista
        if (!is_dir($this->uploadDir)) {
            mkdir($this->uploadDir, 0755, true);
        }

        // 4. Nombre de archivo único
        $id_negocio = $_SESSION['id_negocio'] ?? 0;
        $timestamp = time();
        
        if ($optimizeImage && in_array($ext, ['jpg', 'jpeg', 'png', 'webp', 'gif']) && extension_loaded('gd')) {
            // Optimizar y convertir a WebP si GD está activo
            $filename = 'opt_' . $this->subFolder . '_' . $id_negocio . '_' . $timestamp . '.webp';
            $destination = $this->uploadDir . $filename;
            
            if ($this->optimizarImagen($file['tmp_name'], $destination)) {
                return [
                    'success' => true, 
                    'url' => 'uploads/' . $this->subFolder . '/' . $filename,
                    'absolute_path' => $destination
                ];
            }
        }

        // Fallback: Mover archivo original
        $filename = $this->subFolder . '_' . $id_negocio . '_' . $timestamp . '.' . $ext;
        $destination = $this->uploadDir . $filename;

        if (move_uploaded_file($file['tmp_name'], $destination)) {
            return [
                'success' => true,
                'url' => 'uploads/' . $this->subFolder . '/' . $filename,
                'absolute_path' => $destination
            ];
        }

        return ['success' => false, 'error' => 'Error al mover el archivo al directorio de destino.'];
    }

    private function optimizarImagen($origen, $destino, $calidad = 85, $max_resolucion = 600) {
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
        $nuevo_ancho = $ancho; 
        $nuevo_alto = $alto;

        if ($ancho > $max_resolucion || $alto > $max_resolucion) {
            $ratio = $ancho / $alto;
            if ($ancho > $alto) { 
                $nuevo_ancho = $max_resolucion; 
                $nuevo_alto = $max_resolucion / $ratio; 
            } else { 
                $nuevo_alto = $max_resolucion; 
                $nuevo_ancho = $max_resolucion * $ratio; 
            }
        }

        $nueva_imagen = imagecreatetruecolor((int)round($nuevo_ancho), (int)round($nuevo_alto));
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
}
?>
