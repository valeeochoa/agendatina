<?php
if (!function_exists('asegurarDatosDemo')) {
    function asegurarDatosDemo($pdo, $negocioId) {
        if (!$negocioId) return;

        try {
            // 1. Asegurar la existencia de servicios de prueba
            $stmtServ = $pdo->prepare("SELECT id, nombre_servicio, profesional FROM servicios WHERE id_negocio = ?");
            $stmtServ->execute([$negocioId]);
            $servs = $stmtServ->fetchAll(PDO::FETCH_ASSOC);

            if (empty($servs)) {
                $pdo->prepare("INSERT INTO servicios (id_negocio, nombre_servicio, duracion_minutos, precio, descripcion, profesional) VALUES 
                    (?, 'Corte de Demostración', 30, 8000, 'Servicio de prueba para el plan Premium.', 'Valentina'),
                    (?, 'Masaje Relajante', 60, 15000, 'Relájate con nuestros masajes de prueba.', 'Valentina'),
                    (?, 'Limpieza Facial Profunda', 45, 12000, 'Cuidado de la piel con productos premium.', 'Camila'),
                    (?, 'Manicura Semipermanente', 40, 9000, 'Diseños exclusivos y larga duración.', 'Sofía'),
                    (?, 'Perfilado de Cejas', 20, 5000, 'Dale forma y estilo a tu mirada.', 'Marcos')")->execute([$negocioId, $negocioId, $negocioId, $negocioId, $negocioId]);
                
                $stmtServ->execute([$negocioId]);
                $servs = $stmtServ->fetchAll(PDO::FETCH_ASSOC);
            }

            $idServ1 = $servs[0]['id'] ?? null;
            $idServ2 = $servs[1]['id'] ?? null;
            $idServ3 = $servs[2]['id'] ?? null;
            $idServ4 = $servs[3]['id'] ?? null;
            $idServ5 = $servs[4]['id'] ?? null;

            // 2. Verificar reinicio de turnos demo (cada 15 minutos o cuando no haya turnos vigentes)
            try { $pdo->query("SELECT ultimo_reinicio_demo FROM configuracion_web LIMIT 1"); } 
            catch(Exception $e) { $pdo->exec("ALTER TABLE configuracion_web ADD COLUMN ultimo_reinicio_demo INT DEFAULT 0"); }

            $stmtLastReset = $pdo->prepare("SELECT ultimo_reinicio_demo FROM configuracion_web WHERE id_negocio = ? LIMIT 1");
            $stmtLastReset->execute([$negocioId]);
            $dbLastReset = (int)$stmtLastReset->fetchColumn();

            $stmtMaxFecha = $pdo->prepare("SELECT MAX(fecha), COUNT(*) FROM turnos WHERE id_negocio = ? AND (estado != 'eliminado' OR estado IS NULL)");
            $stmtMaxFecha->execute([$negocioId]);
            $rowTurnos = $stmtMaxFecha->fetch(PDO::FETCH_NUM);
            $maxFecha = $rowTurnos[0] ?? null;
            $turnosCount = (int)($rowTurnos[1] ?? 0);

            $sessLastReset = (int)($_SESSION['last_demo_reset'] ?? 0);
            $lastReset = max($dbLastReset, $sessLastReset);
            $currentTime = time();
            $needsReset = false;

            if ($turnosCount === 0) {
                $needsReset = true;
            } elseif ($lastReset === 0 || ($currentTime - $lastReset) >= 900) { // 900 segundos = 15 minutos
                $needsReset = true;
            } elseif ($maxFecha && $maxFecha < date('Y-m-d')) { // Si los turnos pasaron al historial
                $needsReset = true;
            }

            if ($needsReset) {
                // Eliminar turnos previa cuenta demo y volver a generar turnos vigentes y variados
                $pdo->prepare("DELETE FROM turnos WHERE id_negocio = ?")->execute([$negocioId]);

                $t_hoy = date('Y-m-d');
                $t_m1 = date('Y-m-d', strtotime('+1 day'));
                $t_m2 = date('Y-m-d', strtotime('+2 days'));
                $t_m3 = date('Y-m-d', strtotime('+3 days'));
                $t_p1 = date('Y-m-d', strtotime('-1 day'));

                $pdo->prepare("INSERT INTO turnos (id_negocio, cliente_nombre, cliente_celular, fecha, hora, servicio, profesional, id_servicio, estado, asistio, precio) VALUES 
                    (?, 'María Gómez', '1123456789', ?, '10:00', 'Corte de Demostración', 'Valentina', ?, 'confirmado', 0, 8000),
                    (?, 'Juan Pérez', '1198765432', ?, '11:30', 'Masaje Relajante', 'Valentina', ?, 'confirmado', 0, 15000),
                    (?, 'Ana Martínez', '1155443322', ?, '16:00', 'Manicura Semipermanente', 'Sofía', ?, 'pendiente', 0, 9000),
                    (?, 'Laura Díaz', '1166667777', ?, '09:30', 'Limpieza Facial Profunda', 'Camila', ?, 'confirmado', 0, 12000),
                    (?, 'Carlos Sánchez', '1133334444', ?, '15:00', 'Perfilado de Cejas', 'Marcos', ?, 'confirmado', 0, 5000),
                    (?, 'Lucía Fernández', '1144332211', ?, '10:00', 'Masaje Relajante', 'Valentina', ?, 'confirmado', 1, 15000),
                    (?, 'Diego Romero', '1155667788', ?, '14:30', 'Corte de Demostración', 'Valentina', ?, 'confirmado', 1, 8000),
                    (?, 'Carolina Rossi', '1122334455', ?, '17:00', 'Manicura Semipermanente', 'Sofía', ?, 'confirmado', 0, 9000)
                ")->execute([
                    $negocioId, $t_m1, $idServ1,
                    $negocioId, $t_m1, $idServ2,
                    $negocioId, $t_hoy, $idServ4,
                    $negocioId, $t_m1, $idServ3,
                    $negocioId, $t_m2, $idServ5,
                    $negocioId, $t_p1, $idServ2,
                    $negocioId, $t_p1, $idServ1,
                    $negocioId, $t_m3, $idServ4
                ]);

                $_SESSION['last_demo_reset'] = $currentTime;
                try {
                    $pdo->prepare("UPDATE configuracion_web SET ultimo_reinicio_demo = ? WHERE id_negocio = ?")->execute([$currentTime, $negocioId]);
                } catch(Throwable $eUp) {}
            }

            // 3. Asegurar notificaciones iniciales
            $stmtNotifCount = $pdo->prepare("SELECT COUNT(*) FROM notificaciones WHERE id_negocio = ?");
            $stmtNotifCount->execute([$negocioId]);
            if ((int)$stmtNotifCount->fetchColumn() === 0) {
                $pdo->prepare("INSERT INTO notificaciones (id_negocio, titulo, mensaje) VALUES 
                    (?, '¡Bienvenido a Agendatina!', 'Prueba todas las funciones premium desde este panel de control interactivo.'),
                    (?, 'Nuevas solicitudes', 'Tienes 1 turno pendiente por confirmar. Revisa tu Agenda Virtual.')")->execute([$negocioId, $negocioId]);
            }

            // 4. Asegurar configuración web por defecto
            $stmtCfgCount = $pdo->prepare("SELECT COUNT(*) FROM configuracion_web WHERE id_negocio = ?");
            $stmtCfgCount->execute([$negocioId]);
            if ((int)$stmtCfgCount->fetchColumn() === 0) {
                $pdo->prepare("INSERT INTO configuracion_web (id_negocio, color_primario, color_secundario, mensaje_bienvenida, intervalo_turnos, tipo_calendario, titulo)
                               VALUES (?, '#D11149', '#FC8712', 'Agendatina', '30', 'clasico', 'Agendatina')")->execute([$negocioId]);
            }

            // 5. Asegurar usuarios y personal del equipo Demo (Valentina, Camila, Sofía, Marcos)
            $stmtPnCount = $pdo->prepare("SELECT COUNT(*) FROM personal_negocio WHERE id_negocio = ?");
            $stmtPnCount->execute([$negocioId]);
            if ((int)$stmtPnCount->fetchColumn() <= 1) {
                $demoTeam = [
                    ['nombre' => 'Valentina Ochoa', 'email' => 'valentina.demo@agendatina.site', 'rol' => 'admin'],
                    ['nombre' => 'Camila Benítez', 'email' => 'camila.demo@agendatina.site', 'rol' => 'profesional'],
                    ['nombre' => 'Sofía Ramírez', 'email' => 'sofia.demo@agendatina.site', 'rol' => 'profesional'],
                    ['nombre' => 'Marcos Gómez', 'email' => 'marcos.demo@agendatina.site', 'rol' => 'profesional']
                ];
                $stmtCheckU = $pdo->prepare("SELECT id FROM usuarios WHERE email = ? LIMIT 1");
                $stmtInsU = $pdo->prepare("INSERT INTO usuarios (nombre_completo, email, password, role) VALUES (?, ?, ?, 'profesional')");
                $stmtInsPn = $pdo->prepare("INSERT IGNORE INTO personal_negocio (id_negocio, id_usuario, rol_en_local) VALUES (?, ?, ?)");
                
                $hash = password_hash('demo1234', PASSWORD_DEFAULT);
                foreach ($demoTeam as $member) {
                    $stmtCheckU->execute([$member['email']]);
                    $uId = $stmtCheckU->fetchColumn();
                    if (!$uId) {
                        $stmtInsU->execute([$member['nombre'], $member['email'], $hash]);
                        $uId = $pdo->lastInsertId();
                    }
                    if ($uId) {
                        $stmtInsPn->execute([$negocioId, $uId, $member['rol']]);
                    }
                }
            }
        } catch(Throwable $eDemoData) {
            error_log("Error al asegurar datos demo: " . $eDemoData->getMessage());
        }
    }
}
?>
