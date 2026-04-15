<?php
// NOTA: En un entorno de producción real, este archivo debería estar protegido por contraseña
// o eliminado del servidor una vez que hayas creado tus cuentas principales.

session_start();
if (isset($_SESSION['is_demo'])) {
    unset($_SESSION['is_demo']); // Forzar conexión a la base original
}

$mensaje = '';
$claseMensaje = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $nombre_completo = trim($_POST['nombre_completo'] ?? '');
    $email = trim($_POST['email'] ?? '');
    $password = trim($_POST['password'] ?? '');
    $role = trim($_POST['role'] ?? 'cliente');

    if ($nombre_completo && $email && $password) {        
        require_once __DIR__ . '/conexion.php';

        try {
            // Asegurar que las columnas existan
            try { $pdo->query("SELECT nombre_completo FROM usuarios LIMIT 1"); } 
            catch(Exception $e) { $pdo->exec("ALTER TABLE usuarios ADD COLUMN nombre_completo VARCHAR(255) DEFAULT ''"); }
            
            try { $pdo->query("SELECT role FROM usuarios LIMIT 1"); } 
            catch(Exception $e) { $pdo->exec("ALTER TABLE usuarios ADD COLUMN role VARCHAR(50) DEFAULT 'cliente'"); }
            
            try { $pdo->query("SELECT fecha_creacion FROM usuarios LIMIT 1"); } 
            catch(Exception $e) { $pdo->exec("ALTER TABLE usuarios ADD COLUMN fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP"); }

            // Verificamos que el usuario no exista
            $stmt = $pdo->prepare("SELECT id FROM usuarios WHERE email = :email LIMIT 1");
            $stmt->execute(['email' => $email]);
            $existe = $stmt->fetch();

            if (!$existe) {
                try { $pdo->query("SELECT username FROM usuarios LIMIT 1"); $has_username = true; } 
                catch(Exception $e) { $has_username = false; }

                $hash = password_hash($password, PASSWORD_DEFAULT);
                $fecha = date('Y-m-d H:i:s');

                if ($has_username) {
                    $username = explode('@', $email)[0] . rand(100, 999);
                    $stmt = $pdo->prepare("INSERT INTO usuarios (nombre_completo, username, email, password, role, fecha_creacion) VALUES (:nombre, :username, :email, :password, :role, :fecha)");
                    $stmt->execute(['nombre' => $nombre_completo, 'username' => $username, 'email' => $email, 'password' => $hash, 'role' => $role, 'fecha' => $fecha]);
                } else {
                    $stmt = $pdo->prepare("INSERT INTO usuarios (nombre_completo, email, password, role, fecha_creacion) VALUES (:nombre, :email, :password, :role, :fecha)");
                    $stmt->execute(['nombre' => $nombre_completo, 'email' => $email, 'password' => $hash, 'role' => $role, 'fecha' => $fecha]);
                }

                $mensaje = "¡Usuario '$nombre_completo' creado exitosamente!";
                $claseMensaje = "bg-green-100 text-green-800 border-green-200";
            } else {
                $mensaje = "Error: El email ya está registrado.";
                $claseMensaje = "bg-red-100 text-red-800 border-red-200";
            }
        } catch (PDOException $e) {
            $mensaje = "Error de base de datos: " . $e->getMessage();
            $claseMensaje = "bg-red-100 text-red-800 border-red-200";
            }
        }
    } else {
        $mensaje = "Por favor, completa todos los campos.";
        $claseMensaje = "bg-amber-100 text-amber-800 border-amber-200";
    }
}
?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Herramienta: Crear Usuario</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-100 flex items-center justify-center min-h-screen p-6">
    <div class="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full border border-slate-200">
        <h1 class="text-2xl font-bold text-slate-800 mb-6">Alta de Usuarios (Admin)</h1>
        
        <?php if ($mensaje): ?>
            <div class="p-4 rounded-xl border mb-6 text-sm font-medium <?php echo $claseMensaje; ?>">
                <?php echo $mensaje; ?>
            </div>
        <?php endif; ?>

        <form method="POST" class="flex flex-col gap-4">
            <label class="block text-sm font-semibold text-slate-700">Nombre Completo <input type="text" name="nombre_completo" required class="mt-1 w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-blue-500"></label>
            <label class="block text-sm font-semibold text-slate-700">Correo Electrónico <input type="email" name="email" required class="mt-1 w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-blue-500"></label>
            <label class="block text-sm font-semibold text-slate-700">Contraseña Asignada <input type="text" name="password" required minlength="6" maxlength="14" class="mt-1 w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-blue-500" placeholder="Ej. clave123 (6 a 14 caracteres)"></label>
            <label class="block text-sm font-semibold text-slate-700">Tipo de Cuenta
                <select name="role" class="mt-1 w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-blue-500">
                    <option value="admin">Dueño del Local (Administrador)</option>
                    <option value="cliente">Cliente Regular</option>
                </select>
            </label>
            <button type="submit" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-colors mt-2">Crear Cuenta</button>
        </form>
    </div>
</body>
</html>