<?php
/**
 * Helper para normalización y gestión de permisos granulares de profesionales y administradores.
 */

if (!function_exists('obtenerPermisosPorDefecto')) {
    function obtenerPermisosPorDefecto($rol = 'profesional') {
        if ($rol === 'admin' || $rol === 'dueño') {
            return [
                'ver_mi_agenda' => 1,
                'ver_agenda_otros' => 1,
                'ver_mi_calendario' => 1,
                'ver_calendario_otros' => 1,
                'ver_mis_estadisticas' => 1,
                'ver_estadisticas_otros' => 1,
                'ver_mis_clientes' => 1,
                'ver_clientes_todos' => 1,
                'servicios' => 1,
                'web' => 1,
                'equipo' => 1,
                // Compatibilidad hacia atrás
                'agenda' => 1,
                'ver_todos_turnos' => 1,
                'estadisticas' => 1,
                'clientes' => 1
            ];
        }

        // Rol: PROFESIONAL (Por defecto solo ve SU agenda, SU calendario con SUS turnos, y servicios propios)
        return [
            'ver_mi_agenda' => 1,
            'ver_agenda_otros' => 0,
            'ver_mi_calendario' => 1,
            'ver_calendario_otros' => 0,
            'ver_mis_estadisticas' => 0,
            'ver_estadisticas_otros' => 0,
            'ver_mis_clientes' => 0,
            'ver_clientes_todos' => 0,
            'servicios' => 1,
            'web' => 0,
            'equipo' => 0,
            // Compatibilidad hacia atrás
            'agenda' => 1,
            'ver_todos_turnos' => 0,
            'estadisticas' => 0,
            'clientes' => 0
        ];
    }
}

if (!function_exists('normalizarPermisos')) {
    function normalizarPermisos($rawPerms, $rol = 'profesional') {
        $p = is_array($rawPerms) ? $rawPerms : (json_decode($rawPerms ?: '[]', true) ?: []);
        $defaults = obtenerPermisosPorDefecto($rol);

        $res = [];
        // Mapeo granular sin heredar indebidamente claves globales antiguas para profesionales
        $res['ver_mi_agenda'] = isset($p['ver_mi_agenda']) ? (int)!empty($p['ver_mi_agenda']) : (isset($p['agenda']) ? (int)!empty($p['agenda']) : $defaults['ver_mi_agenda']);
        $res['ver_agenda_otros'] = isset($p['ver_agenda_otros']) ? (int)!empty($p['ver_agenda_otros']) : $defaults['ver_agenda_otros'];
        
        $res['ver_mi_calendario'] = isset($p['ver_mi_calendario']) ? (int)!empty($p['ver_mi_calendario']) : (isset($p['agenda']) ? (int)!empty($p['agenda']) : $defaults['ver_mi_calendario']);
        $res['ver_calendario_otros'] = isset($p['ver_calendario_otros']) ? (int)!empty($p['ver_calendario_otros']) : $defaults['ver_calendario_otros'];

        $res['ver_mis_estadisticas'] = isset($p['ver_mis_estadisticas']) ? (int)!empty($p['ver_mis_estadisticas']) : (isset($p['estadisticas']) ? (int)!empty($p['estadisticas']) : $defaults['ver_mis_estadisticas']);
        $res['ver_estadisticas_otros'] = isset($p['ver_estadisticas_otros']) ? (int)!empty($p['ver_estadisticas_otros']) : $defaults['ver_estadisticas_otros'];

        $res['ver_mis_clientes'] = isset($p['ver_mis_clientes']) ? (int)!empty($p['ver_mis_clientes']) : (isset($p['clientes']) ? (int)!empty($p['clientes']) : $defaults['ver_mis_clientes']);
        $res['ver_clientes_todos'] = isset($p['ver_clientes_todos']) ? (int)!empty($p['ver_clientes_todos']) : $defaults['ver_clientes_todos'];

        $res['servicios'] = isset($p['servicios']) ? (int)!empty($p['servicios']) : $defaults['servicios'];
        $res['web'] = isset($p['web']) ? (int)!empty($p['web']) : $defaults['web'];
        $res['equipo'] = isset($p['equipo']) ? (int)!empty($p['equipo']) : $defaults['equipo'];

        // Derivados para retrocompatibilidad
        $res['agenda'] = ($res['ver_mi_agenda'] || $res['ver_agenda_otros'] || $res['ver_mi_calendario'] || $res['ver_calendario_otros']) ? 1 : 0;
        $res['ver_todos_turnos'] = ($res['ver_calendario_otros'] || $res['ver_agenda_otros']) ? 1 : 0;
        $res['estadisticas'] = ($res['ver_mis_estadisticas'] || $res['ver_estadisticas_otros']) ? 1 : 0;
        $res['clientes'] = ($res['ver_mis_clientes'] || $res['ver_clientes_todos']) ? 1 : 0;

        return $res;
    }
}

if (!function_exists('sincronizarPermisosSesion')) {
    function sincronizarPermisosSesion($pdo, $id_negocio = null, $id_usuario = null) {
        $uid = $id_usuario ?: ($_SESSION['user_id'] ?? null);
        $nid = $id_negocio ?: ($_SESSION['id_negocio'] ?? null);
        $rol = $_SESSION['rol_en_local'] ?? 'admin';
        $rawPerms = $_SESSION['permisos'] ?? [];
        $nombre = $_SESSION['nombre_completo'] ?? '';

        if ($uid && $nid) {
            try {
                $stmt = $pdo->prepare("SELECT pn.rol_en_local, pn.permisos, u.nombre_completo FROM personal_negocio pn JOIN usuarios u ON u.id = pn.id_usuario WHERE pn.id_negocio = ? AND pn.id_usuario = ? LIMIT 1");
                $stmt->execute([$nid, $uid]);
                $row = $stmt->fetch(PDO::FETCH_ASSOC);
                if ($row) {
                    $rol = $row['rol_en_local'] ?: 'profesional';
                    $rawPerms = !empty($row['permisos']) ? json_decode($row['permisos'], true) : [];
                    if (!empty($row['nombre_completo'])) {
                        $nombre = $row['nombre_completo'];
                    }
                    $_SESSION['rol_en_local'] = $rol;
                    $_SESSION['nombre_completo'] = $nombre;
                }
            } catch (\Throwable $e) {}
        }

        $normPerms = normalizarPermisos($rawPerms, $rol);
        $_SESSION['permisos'] = $normPerms;

        return [
            'rol_en_local' => $rol,
            'is_prof' => ($rol === 'profesional'),
            'permisos' => $normPerms,
            'nombre_completo' => $nombre
        ];
    }
}
