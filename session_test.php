<?php
session_start();
if (!isset($_SESSION['count'])) {
    $_SESSION['count'] = 0;
}
$_SESSION['count']++;
echo "<h1>Test de Sesiones PHP</h1>";
echo "<p>Contador de recargas: " . $_SESSION['count'] . "</p>";
echo "<p>Si al recargar la página el número SIEMPRE es 1, significa que las sesiones PHP están ROTAS en el servidor y la variable \$_SESSION se pierde al cambiar de página.</p>";
echo "<p>Ruta donde se intentan guardar las sesiones (Session Save Path): <b>" . session_save_path() . "</b></p>";
if (!is_writable(session_save_path())) {
    echo "<p style='color:red; font-weight:bold'>ERROR: La carpeta temporal (" . session_save_path() . ") NO TIENE PERMISOS de escritura o NO EXISTE.</p>";
    echo "<p style='color:red'>Por esto mismo, el sistema te vuelve a patear al login, porque no se puede crear tu sesión.</p>";
} else {
    echo "<p style='color:green'>La carpeta parece tener permisos, pero si el contador sigue en 1 al recargar, puede haber un problema de configuración en el servidor.</p>";
}
?>
