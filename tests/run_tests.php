<?php
/**
 * Suite de Tests de Simulación - Agendatina
 * Ejecutar: php tests/run_tests.php
 */

$passed = 0;
$failed = 0;

function assertTrue($cond, $name, $detail = '') {
    global $passed, $failed;
    if ($cond) {
        $passed++;
        echo "[PASS] $name\n";
    } else {
        $failed++;
        echo "[FAIL] $name" . ($detail ? " -> $detail" : "") . "\n";
    }
}

echo "=== 1. Simulacion de Devoluciones / Cancelaciones (Independientes de Pases) ===\n";
$estadoAlumno = [
    'pases_totales' => 4,
    'pases_disponibles' => 4,
    'cancelaciones_permitidas' => 4,
    'cancelaciones_restantes' => 4,
];

// Simula reservar los 4 cupos (pases_disponibles -> 0, cancelaciones_restantes sigue en 4)
for ($i = 0; $i < 4; $i++) {
    assertTrue($estadoAlumno['pases_disponibles'] > 0, "Puede reservar clase #" . ($i + 1));
    $estadoAlumno['pases_disponibles']--;
}
assertTrue($estadoAlumno['pases_disponibles'] === 0, "Tras 4 reservas, pases_disponibles = 0");
assertTrue($estadoAlumno['cancelaciones_restantes'] === 4, "Cancelaciones restantes sigue siendo 4 aunque pases = 0");

// Simula el calculo de mis_clases en cliente_auth.php
$calcRest = min((int)$estadoAlumno['cancelaciones_restantes'], (int)$estadoAlumno['cancelaciones_permitidas']);
assertTrue($calcRest === 4, "mis_clases reporta 4 cancelaciones disponibles con 0 pases");

// Cancela 1 clase -> devuelve 1 pase y descuenta 1 cancelacion
$estadoAlumno['cancelaciones_restantes']--;
$estadoAlumno['pases_disponibles']++;
assertTrue($estadoAlumno['cancelaciones_restantes'] === 3, "Tras cancelar 1 clase, cancelaciones_restantes = 3");
assertTrue($estadoAlumno['pases_disponibles'] === 1, "Tras cancelar 1 clase, pases_disponibles = 1");

// Consume las 3 cancelaciones restantes
for ($c = 0; $c < 3; $c++) {
    $estadoAlumno['cancelaciones_restantes']--;
    $estadoAlumno['pases_disponibles']++;
}
assertTrue($estadoAlumno['cancelaciones_restantes'] === 0, "Tras usar las 4 cancelaciones, cancelaciones_restantes = 0");
$puedeCancelar = ($estadoAlumno['cancelaciones_restantes'] > 0);
assertTrue($puedeCancelar === false, "Con 0 cancelaciones restantes ya no permite cancelar");

echo "\n=== 2. Simulacion de Cupos (1/10) y Orden de Inscriptos ===\n";
$cupoMax = 10;
$turnosSimulados = [
    ['id' => 101, 'cliente_nombre' => 'Ana Perez', 'id_servicio' => 5, 'hora' => '18:00'],
];
$alumnos = array_column($turnosSimulados, 'cliente_nombre');
$ocupadosCount = count($turnosSimulados);
assertTrue($ocupadosCount === 1 && ($cupoMax - $ocupadosCount) === 9, "1 inscripto en clase de 10 muestra 1/10 (9 libres)");

$turnosSimulados[] = ['id' => 102, 'cliente_nombre' => 'Bruno Gomez', 'id_servicio' => 5, 'hora' => '18:00'];
$turnosSimulados[] = ['id' => 103, 'cliente_nombre' => 'Carla Diaz', 'id_servicio' => 5, 'hora' => '18:00'];
$alumnos = array_column($turnosSimulados, 'cliente_nombre');
assertTrue(
    implode(', ', $alumnos) === 'Ana Perez, Bruno Gomez, Carla Diaz',
    "Lista de asistentes respeta orden de reserva: Ana Perez, Bruno Gomez, Carla Diaz"
);

echo "\n=== 3. Simulacion de Orden Cronologico e Historial ===\n";
$ahora = strtotime('2026-11-17 11:00:00');
$clases = [
    ['id' => 1, 'servicio' => 'Clase pasada hoy', 'fecha' => '2026-11-17', 'hora' => '10:30', 'estado' => 'confirmado'],
    ['id' => 2, 'servicio' => 'Clase en 5 dias',  'fecha' => '2026-11-22', 'hora' => '18:00', 'estado' => 'confirmado'],
    ['id' => 3, 'servicio' => 'Clase manana',     'fecha' => '2026-11-18', 'hora' => '09:00', 'estado' => 'confirmado'],
];
$proximas = array_values(array_filter($clases, function ($c) use ($ahora) {
    if ($c['estado'] === 'cancelado') return false;
    return strtotime($c['fecha'] . ' ' . $c['hora']) > $ahora;
}));
usort($proximas, function ($a, $b) {
    return strtotime($a['fecha'] . ' ' . $a['hora']) <=> strtotime($b['fecha'] . ' ' . $b['hora']);
});
$historial = array_values(array_filter($clases, function ($c) use ($proximas) {
    return !in_array($c, $proximas, true);
}));

assertTrue(count($proximas) === 2, "Solo 2 clases futuras quedan en Proximas Clases");
assertTrue(count($historial) === 1 && $historial[0]['id'] === 1, "La clase de las 10:30 que ya inicio paso al Historial");
assertTrue($proximas[0]['id'] === 3 && $proximas[1]['id'] === 2, "Tu Proxima Clase es la de manana (id 3) antes que la de 5 dias (id 2)");

echo "\n=== 4. Verificacion de SQL en Estadisticas de Vistas ===\n";
$estVistasSrc = file_get_contents(__DIR__ . '/../backend/obtener_estadisticas_vistas.php');
$regVistaSrc  = file_get_contents(__DIR__ . '/../backend/registrar_vista.php');
assertTrue(preg_match('/SELECT\b[^;]*created_at[^;]*FROM\s+negocios/i', $estVistasSrc) === 0, "obtener_estadisticas_vistas.php no consulta columna inexistente created_at en negocios");
assertTrue(strpos($regVistaSrc, 'subdominio') === false, "registrar_vista.php no consulta columna inexistente subdominio");

echo "\n=== 5. Verificacion de Sintaxis PHP en Endpoints Clave ===\n";
$phpFiles = [
    'backend/cliente_auth.php',
    'backend/gestionar_clientes.php',
    'backend/obtener_turnos_ocupados.php',
    'backend/obtener_estadisticas_vistas.php',
    'backend/registrar_vista.php',
    'backend/obtener_personal.php',
    'backend/cancelar_turno.php',
    'backend/helpers/cupo_waitlist_helper.php',
    'url_disponible.php',
];
$phpBin = PHP_BINARY;
foreach ($phpFiles as $rel) {
    $abs = __DIR__ . '/../' . $rel;
    $out = [];
    $code = 0;
    exec(escapeshellarg($phpBin) . ' -l ' . escapeshellarg($abs) . ' 2>&1', $out, $code);
    assertTrue($code === 0, "PHP lint: $rel", implode(' ', $out));
}

echo "\n----------------------------------------\n";
echo "Resumen: $passed pasaron, $failed fallaron.\n";
exit($failed > 0 ? 1 : 0);
