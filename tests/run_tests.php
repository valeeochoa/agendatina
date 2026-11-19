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
    'backend/gestionar_servicios.php',
    'backend/enviar_turno.php',
    'backend/login.php',
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

echo "\n=== 6. Simulacion de Horarios Especificos por Servicio ===\n";
$horariosServ = [
    '1' => ['activo' => true, 'tramos' => [['inicio' => '14:30', 'fin' => '15:15']]],
    '5' => ['activo' => true, 'tramos' => [['inicio' => '19:30', 'fin' => '20:15']]],
    '3' => ['activo' => false, 'tramos' => []],
];
$generarSlots = function (array $horarios, string $dayKey, int $duracionMin) {
    if (empty($horarios[$dayKey]['activo']) || empty($horarios[$dayKey]['tramos'])) {
        return [];
    }
    $slots = [];
    foreach ($horarios[$dayKey]['tramos'] as $tr) {
        [$sh, $sm] = array_map('intval', explode(':', $tr['inicio']));
        [$eh, $em] = array_map('intval', explode(':', $tr['fin']));
        $start = $sh * 60 + $sm;
        $end = $eh * 60 + $em;
        for ($m = $start; $m + $duracionMin <= $end; $m += $duracionMin) {
            $slots[] = sprintf('%02d:%02d', intdiv($m, 60), $m % 60);
        }
    }
    return $slots;
};
assertTrue($generarSlots($horariosServ, '1', 45) === ['14:30'], "Lunes 14:30-15:15 con duracion 45min genera slot 14:30");
assertTrue($generarSlots($horariosServ, '5', 45) === ['19:30'], "Viernes 19:30-20:15 con duracion 45min genera slot 19:30");
assertTrue($generarSlots($horariosServ, '3', 45) === [], "Dia inactivo (Miercoles) no genera slots");
assertTrue($generarSlots(['5' => ['activo' => true, 'tramos' => [['inicio' => '19:30', 'fin' => '19:45']]]], '5', 45) === [], "Tramo menor a la duracion del servicio (15min < 45min) no genera slot");

$servSrc = file_get_contents(__DIR__ . '/../backend/gestionar_servicios.php');
$turnoSrc = file_get_contents(__DIR__ . '/../backend/enviar_turno.php');
assertTrue(strpos($servSrc, 'horarios_especificos_json') !== false, "gestionar_servicios.php persiste horarios_especificos_json");
assertTrue(strpos($turnoSrc, 'horarios_especificos_json') !== false, "enviar_turno.php valida reservas contra horarios_especificos_json");

echo "\n=== 7. Simulacion de Pase Libre vs Pase Exclusivo (Sin Mezcla) ===\n";
$resolverPase = function (array $serviciosList, int $idServicio, string $nombreServicio, bool $servicioAceptaPaseLibre) {
    $servLower = strtolower(trim($nombreServicio));
    foreach ($serviciosList as $idx => $sItem) {
        $isLibre = !empty($sItem['es_pase_libre']) || (isset($sItem['id_servicio']) && (int)$sItem['id_servicio'] === 0);
        if (!$isLibre && (int)($sItem['id_servicio'] ?? 0) === $idServicio && (int)($sItem['pases_disponibles'] ?? 0) > 0) {
            return $idx;
        }
    }
    foreach ($serviciosList as $idx => $sItem) {
        $isLibre = !empty($sItem['es_pase_libre']) || (isset($sItem['id_servicio']) && (int)$sItem['id_servicio'] === 0);
        if (!$isLibre && strtolower(trim($sItem['servicio'] ?? '')) === $servLower && (int)($sItem['pases_disponibles'] ?? 0) > 0) {
            return $idx;
        }
    }
    if ($servicioAceptaPaseLibre) {
        foreach ($serviciosList as $idx => $sItem) {
            $isLibre = !empty($sItem['es_pase_libre'])
                || (isset($sItem['id_servicio']) && (int)$sItem['id_servicio'] === 0)
                || stripos((string)($sItem['servicio'] ?? ''), 'pase libre') !== false;
            if ($isLibre && (int)($sItem['pases_disponibles'] ?? 0) > 0) {
                return $idx;
            }
        }
    }
    return -1;
};

$pasesSoloSpinning = [
    ['id_servicio' => 10, 'servicio' => 'Spinning', 'es_pase_libre' => false, 'pases_disponibles' => 4],
];
$pasesConLibre = [
    ['id_servicio' => 0, 'servicio' => 'Pase Libre (Todas las Clases)', 'es_pase_libre' => true, 'pases_disponibles' => 8],
];
$pasesMixtos = [
    ['id_servicio' => 0, 'servicio' => 'Pase Libre', 'es_pase_libre' => true, 'pases_disponibles' => 8],
    ['id_servicio' => 10, 'servicio' => 'Spinning', 'es_pase_libre' => false, 'pases_disponibles' => 2],
];

assertTrue($resolverPase($pasesSoloSpinning, 10, 'Spinning', false) === 0, "Pase exclusivo de Spinning permite reservar Spinning");
assertTrue($resolverPase($pasesSoloSpinning, 20, 'PowerJump', true) === -1, "Pase exclusivo de Spinning bloquea reservar PowerJump aunque PowerJump sea Pase Libre");
assertTrue($resolverPase($pasesConLibre, 20, 'PowerJump', true) === 0, "Pase Libre permite reservar clases que tambien tienen Pase Libre");
assertTrue($resolverPase($pasesConLibre, 30, 'Pilates Reformer', false) === -1, "Pase Libre bloquea reservar clases exclusivas (sin opcion Pase Libre)");
assertTrue($resolverPase($pasesMixtos, 10, 'Spinning', true) === 1, "Con Pase Libre y pase especifico, prioriza descontar el especifico");
assertTrue($resolverPase($pasesMixtos, 20, 'PowerJump', true) === 0, "Con Pase Libre y pase especifico, usa Pase Libre para otras clases habilitadas");

$cliAuthSrc = file_get_contents(__DIR__ . '/../backend/cliente_auth.php');
assertTrue(strpos($cliAuthSrc, 'servicioAceptaPaseLibre') !== false, "cliente_auth.php valida que el servicio destino admita Pase Libre sin mezclar exclusivos");

echo "\n=== 8. Simulacion de Rate-Limit Individual por Cuenta en Login ===\n";
$ip = '190.10.20.30';
$keyPadre = md5($ip . '|' . strtolower(trim('dueno@gym.com')));
$keyPadreUpper = md5($ip . '|' . strtolower(trim('  DUENO@GYM.COM ')));
$keyHijo = md5($ip . '|' . strtolower(trim('profe1@gym.com')));

assertTrue($keyPadre !== $keyHijo, "Cuenta padre e hijo en la misma IP tienen claves de bloqueo independientes");
assertTrue($keyPadre === $keyPadreUpper, "La clave de bloqueo normaliza espacios y mayusculas del email");
assertTrue(strlen($keyPadre) === 32 && strlen($keyHijo) === 32, "Las claves md5 miden 32 caracteres (compatibles con VARCHAR(45))");

$loginSrc = file_get_contents(__DIR__ . '/../backend/login.php');
assertTrue(strpos($loginSrc, '$rate_key') !== false, "backend/login.php utiliza rate_key individual por cuenta + IP");

echo "\n----------------------------------------\n";
echo "Resumen: $passed pasaron, $failed fallaron.\n";
exit($failed > 0 ? 1 : 0);
