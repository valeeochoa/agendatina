<?php
require_once __DIR__ . '/../backend/conexion.php';

try {
    // Check businesses and latest notes query
    $sql = "
        SELECT n.id, n.nombre_fantasia, an.nota AS nota_interna
        FROM negocios n
        LEFT JOIN (
            SELECT an1.id_negocio, an1.nota
            FROM admin_notas an1
            INNER JOIN (
                SELECT id_negocio, MAX(id) AS max_id
                FROM admin_notas
                WHERE (estado IS NULL OR estado != 'eliminado') AND nota IS NOT NULL AND TRIM(nota) != ''
                GROUP BY id_negocio
            ) latest ON an1.id = latest.max_id
        ) an ON n.id = an.id_negocio
        ORDER BY n.id DESC
        LIMIT 5
    ";
    $stmt = $pdo->query($sql);
    $res = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo "SUCCESS: " . count($res) . " businesses fetched.\n";
    print_r($res);
} catch (Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
}
