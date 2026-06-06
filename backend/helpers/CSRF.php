<?php
class CSRF {
    public static function init() {
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }
        if (empty($_SESSION['csrf_token'])) {
            $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
        }
        
        // Exponer el token en una cookie accesible por JS para peticiones fetch
        if (isset($_SESSION['user_id'])) {
            setcookie('csrf_token', $_SESSION['csrf_token'], [
                'expires' => 0,
                'path' => '/',
                'domain' => '',
                'secure' => isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on',
                'httponly' => false, // Permitimos lectura desde JS para enviarlo como header
                'samesite' => 'Lax'
            ]);
        }
    }

    public static function getToken() {
        if (empty($_SESSION['csrf_token'])) {
            self::init();
        }
        return $_SESSION['csrf_token'];
    }

    public static function verify($token) {
        if (empty($_SESSION['csrf_token'])) {
            return false;
        }
        return hash_equals($_SESSION['csrf_token'], $token);
    }
}
?>
