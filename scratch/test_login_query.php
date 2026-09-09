<?php
require_once __DIR__ . '/../backend/conexion.php';

try {
    $stmt = $pdo->prepare("
        SELECT pn.id_negocio, pn.rol_en_local, pn.permisos, n.nombre_fantasia, n.plan, cw.logo
        FROM personal_negocio pn
        JOIN negocios n ON pn.id_negocio = n.id
        LEFT JOIN configuracion_web cw ON n.id = cw.id_negocio
        WHERE pn.id_usuario = 1
        GROUP BY pn.id_negocio
        ORDER BY (pn.rol_en_local = 'admin') DESC, pn.id_negocio ASC
    ");
    $stmt->execute();
    echo "Query with GROUP BY succeeded.\n";
} catch (Exception $e) {
    echo "Query with GROUP BY failed: " . $e->getMessage() . "\n";
}

try {
    $stmt2 = $pdo->prepare("
        SELECT pn.id_negocio, pn.rol_en_local, pn.permisos, n.nombre_fantasia, n.plan, cw.logo
        FROM personal_negocio pn
        JOIN negocios n ON pn.id_negocio = n.id
        LEFT JOIN configuracion_web cw ON n.id = cw.id_negocio
        WHERE pn.id_usuario = 1
        ORDER BY (pn.rol_en_local = 'admin') DESC, pn.id_negocio ASC
    ");
    $stmt2->execute();
    echo "Query WITHOUT GROUP BY succeeded.\n";
} catch (Exception $e) {
    echo "Query WITHOUT GROUP BY failed: " . $e->getMessage() . "\n";
}
