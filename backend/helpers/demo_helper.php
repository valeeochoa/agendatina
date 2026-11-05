<?php
if (!function_exists('asegurarDatosDemo')) {
    function asegurarDatosDemo($pdo, $negocioId) {
        if (!$negocioId) return;

        try {
            // 0. Barreras de protección: auto-migración de columnas si no existen
            try { $pdo->query("SELECT cupo_maximo FROM servicios LIMIT 1"); } 
            catch(Throwable $e) { $pdo->exec("ALTER TABLE servicios ADD COLUMN cupo_maximo INT DEFAULT 1"); }

            try { $pdo->query("SELECT tipo_servicio FROM servicios LIMIT 1"); } 
            catch(Throwable $e) { $pdo->exec("ALTER TABLE servicios ADD COLUMN tipo_servicio VARCHAR(50) DEFAULT 'calendario'"); }

            try { $pdo->query("SELECT precios_paquetes_json FROM servicios LIMIT 1"); } 
            catch(Throwable $e) { $pdo->exec("ALTER TABLE servicios ADD COLUMN precios_paquetes_json LONGTEXT DEFAULT NULL"); }

            try { $pdo->query("SELECT asistio FROM turnos LIMIT 1"); } 
            catch(Throwable $e) { $pdo->exec("ALTER TABLE turnos ADD COLUMN asistio TINYINT DEFAULT 0"); }

            try { $pdo->query("SELECT metodo_pago FROM turnos LIMIT 1"); } 
            catch(Throwable $e) { $pdo->exec("ALTER TABLE turnos ADD COLUMN metodo_pago VARCHAR(100) DEFAULT NULL"); }

            try { $pdo->query("SELECT turnos_simultaneos FROM configuracion_web LIMIT 1"); } 
            catch(Throwable $e) { $pdo->exec("ALTER TABLE configuracion_web ADD COLUMN turnos_simultaneos VARCHAR(10) DEFAULT 'si'"); }

            try { $pdo->query("SELECT modo_reservas FROM configuracion_web LIMIT 1"); } 
            catch(Throwable $e) { $pdo->exec("ALTER TABLE configuracion_web ADD COLUMN modo_reservas VARCHAR(50) DEFAULT 'cupos_alumnos'"); }

            try { $pdo->query("SELECT horarios_detallados_json FROM configuracion_web LIMIT 1"); } 
            catch(Throwable $e) { $pdo->exec("ALTER TABLE configuracion_web ADD COLUMN horarios_detallados_json LONGTEXT DEFAULT NULL"); }

            // Horarios detallados predeterminados (Lunes a Sábado de 08:00 a 21:00)
            $defaultHorarios = [
                '1' => ['activo' => true, 'tramos' => [['inicio' => '08:00', 'fin' => '21:00']]],
                '2' => ['activo' => true, 'tramos' => [['inicio' => '08:00', 'fin' => '21:00']]],
                '3' => ['activo' => true, 'tramos' => [['inicio' => '08:00', 'fin' => '21:00']]],
                '4' => ['activo' => true, 'tramos' => [['inicio' => '08:00', 'fin' => '21:00']]],
                '5' => ['activo' => true, 'tramos' => [['inicio' => '08:00', 'fin' => '21:00']]],
                '6' => ['activo' => true, 'tramos' => [['inicio' => '09:00', 'fin' => '14:00']]],
                '0' => ['activo' => false, 'tramos' => []]
            ];
            $horariosJson = json_encode($defaultHorarios, JSON_UNESCAPED_UNICODE);

            // 1. Asegurar la existencia de servicios de prueba (incluyendo clases con cupos)
            $stmtServ = $pdo->prepare("SELECT id, nombre_servicio, tipo_servicio, cupo_maximo FROM servicios WHERE id_negocio = ?");
            $stmtServ->execute([$negocioId]);
            $servs = $stmtServ->fetchAll(PDO::FETCH_ASSOC);

            // Verificar si faltan servicios de clases grupales con cupos
            $hasClasses = false;
            foreach ($servs as $s) {
                if ($s['tipo_servicio'] === 'alumnos' || (int)$s['cupo_maximo'] > 1) {
                    $hasClasses = true;
                    break;
                }
            }

            // 2. Verificar si corresponde reiniciar el entorno Demo (cada 15 minutos o cuando no haya clases/turnos)
            try { $pdo->query("SELECT ultimo_reinicio_demo FROM configuracion_web LIMIT 1"); } 
            catch(Throwable $e) { $pdo->exec("ALTER TABLE configuracion_web ADD COLUMN ultimo_reinicio_demo INT DEFAULT 0"); }

            $stmtLastReset = $pdo->prepare("SELECT ultimo_reinicio_demo FROM configuracion_web WHERE id_negocio = ? LIMIT 1");
            $stmtLastReset->execute([$negocioId]);
            $dbLastReset = (int)$stmtLastReset->fetchColumn();

            $stmtCountTurnos = $pdo->prepare("SELECT COUNT(*) FROM turnos WHERE id_negocio = ? AND (estado != 'eliminado' OR estado IS NULL)");
            $stmtCountTurnos->execute([$negocioId]);
            $turnosCount = (int)$stmtCountTurnos->fetchColumn();

            $sessLastReset = (int)($_SESSION['last_demo_reset'] ?? 0);
            $lastReset = max($dbLastReset, $sessLastReset);
            $currentTime = time();
            $needsReset = false;

            if (empty($servs) || !$hasClasses || $turnosCount === 0) {
                $needsReset = true;
            } elseif ($lastReset === 0 || ($currentTime - $lastReset) >= 900) { // 900 segundos = 15 minutos
                $needsReset = true;
            }

            if ($needsReset) {
                // A. Recrear Servicios de Demostración (Clases grupales + servicios individuales)
                $pdo->prepare("DELETE FROM servicios WHERE id_negocio = ?")->execute([$negocioId]);

                $paquetePilates = json_encode([['pases' => 4, 'precio' => 24000, 'nombre' => 'Pase 4 Clases'], ['pases' => 8, 'precio' => 40000, 'nombre' => 'Pase 8 Clases']], JSON_UNESCAPED_UNICODE);
                $paqueteYoga = json_encode([['pases' => 4, 'precio' => 20000, 'nombre' => 'Pase 4 Clases'], ['pases' => 8, 'precio' => 35000, 'nombre' => 'Pase 8 Clases']], JSON_UNESCAPED_UNICODE);
                $paqueteFuncional = json_encode([['pases' => 4, 'precio' => 22000, 'nombre' => 'Pase 4 Clases'], ['pases' => 8, 'precio' => 38000, 'nombre' => 'Pase 8 Clases']], JSON_UNESCAPED_UNICODE);

                $stmtInsServ = $pdo->prepare("
                    INSERT INTO servicios (id_negocio, nombre_servicio, duracion_minutos, precio, descripcion, profesional, icono, tipo_servicio, cupo_maximo, capacidad, precios_paquetes_json) VALUES 
                    (?, 'Pilates Reformer', 50, 6000, 'Clases grupales en cama Reformer para tonificación muscular y postura.', 'Valentina Ochoa', 'sports_gymnastics', 'alumnos', 8, 8, ?),
                    (?, 'Yoga Dinámico & Flow', 60, 5000, 'Secuencias fluidas de Vinyasa Yoga para fuerza, flexibilidad y respiración.', 'Camila Benítez', 'self_improvement', 'alumnos', 10, 10, ?),
                    (?, 'Entrenamiento Funcional', 45, 5500, 'Circuito de alta intensidad para quemar calorías y acondicionamiento general.', 'Marcos Gómez', 'fitness_center', 'alumnos', 12, 12, ?),
                    (?, 'Masaje Relajante & Descontracturante', 60, 15000, 'Sesión individual de masajes con aceites esenciales.', 'Valentina Ochoa', 'spa', 'calendario', 1, 1, NULL),
                    (?, 'Limpieza Facial Profunda', 45, 12000, 'Higiene facial con punta de diamante y productos premium.', 'Camila Benítez', 'face_retouching_natural', 'calendario', 1, 1, NULL)
                ");
                $stmtInsServ->execute([
                    $negocioId, $paquetePilates,
                    $negocioId, $paqueteYoga,
                    $negocioId, $paqueteFuncional,
                    $negocioId,
                    $negocioId
                ]);

                $stmtServ = $pdo->prepare("SELECT id, nombre_servicio, profesional, cupo_maximo FROM servicios WHERE id_negocio = ? ORDER BY id ASC");
                $stmtServ->execute([$negocioId]);
                $servs = $stmtServ->fetchAll(PDO::FETCH_ASSOC);

                $idPilates = $servs[0]['id'] ?? null;
                $idYoga = $servs[1]['id'] ?? null;
                $idFuncional = $servs[2]['id'] ?? null;
                $idMasaje = $servs[3]['id'] ?? null;
                $idFacial = $servs[4]['id'] ?? null;

                // B. Recrear Alumnos Demo con paquetes activos
                $pdo->prepare("DELETE FROM clientes_negocio WHERE id_negocio = ?")->execute([$negocioId]);

                $pasesPilatesJson = json_encode([['id_servicio' => $idPilates, 'servicio' => 'Pilates Reformer', 'pases_disponibles' => 6, 'pases_totales' => 8, 'fecha_vencimiento' => date('Y-m-d', strtotime('+20 days'))]], JSON_UNESCAPED_UNICODE);
                $pasesYogaJson = json_encode([['id_servicio' => $idYoga, 'servicio' => 'Yoga Dinámico & Flow', 'pases_disponibles' => 4, 'pases_totales' => 4, 'fecha_vencimiento' => date('Y-m-d', strtotime('+30 days'))]], JSON_UNESCAPED_UNICODE);
                $pasesFuncionalJson = json_encode([['id_servicio' => $idFuncional, 'servicio' => 'Entrenamiento Funcional', 'pases_disponibles' => 10, 'pases_totales' => 12, 'fecha_vencimiento' => date('Y-m-d', strtotime('+25 days'))]], JSON_UNESCAPED_UNICODE);
                $pasesMultiplesJson = json_encode([
                    ['id_servicio' => $idPilates, 'servicio' => 'Pilates Reformer', 'pases_disponibles' => 4, 'pases_totales' => 8, 'fecha_vencimiento' => date('Y-m-d', strtotime('+15 days'))],
                    ['id_servicio' => $idFuncional, 'servicio' => 'Entrenamiento Funcional', 'pases_disponibles' => 5, 'pases_totales' => 8, 'fecha_vencimiento' => date('Y-m-d', strtotime('+15 days'))]
                ], JSON_UNESCAPED_UNICODE);

                $stmtInsCli = $pdo->prepare("
                    INSERT INTO clientes_negocio (id_negocio, id_servicio, servicio, nombre_completo, email, telefono, pases_disponibles, pases_totales, fecha_vencimiento, notas, estado, servicios_pases_json) VALUES 
                    (?, ?, 'Pilates Reformer', 'María García', 'maria.demo@agendatina.site', '11 2345 6789', 6, 8, DATE_ADD(CURRENT_DATE, INTERVAL 20 DAY), 'Alumna de Pilates intermedio.', 'activo', ?),
                    (?, ?, 'Entrenamiento Funcional', 'Lucas Fernández', 'lucas.demo@agendatina.site', '11 9876 5432', 10, 12, DATE_ADD(CURRENT_DATE, INTERVAL 25 DAY), 'Pase libre funcional.', 'activo', ?),
                    (?, ?, 'Yoga Dinámico & Flow', 'Carolina Rossi', 'carolina.demo@agendatina.site', '11 2233 4455', 4, 4, DATE_ADD(CURRENT_DATE, INTERVAL 30 DAY), 'Abonó pase mensual Yoga.', 'activo', ?),
                    (?, ?, 'Pilates Reformer', 'Lucía Fernández', 'lucia.demo@agendatina.site', '11 4433 2211', 4, 8, DATE_ADD(CURRENT_DATE, INTERVAL 15 DAY), 'Alumna constante.', 'activo', ?),
                    (?, ?, 'Entrenamiento Funcional', 'Diego Romero', 'diego.demo@agendatina.site', '11 5566 7788', 9, 16, DATE_ADD(CURRENT_DATE, INTERVAL 15 DAY), 'Pase combinado Pilates y Funcional.', 'activo', ?),
                    (?, ?, 'Pilates Reformer', 'Ana Martínez', 'ana.demo@agendatina.site', '11 5555 4444', 0, 8, DATE_ADD(CURRENT_DATE, INTERVAL 5 DAY), 'Sin clases disponibles. Recargar pase.', 'activo', NULL)
                ");
                $stmtInsCli->execute([
                    $negocioId, $idPilates, $pasesPilatesJson,
                    $negocioId, $idFuncional, $pasesFuncionalJson,
                    $negocioId, $idYoga, $pasesYogaJson,
                    $negocioId, $idPilates, $pasesPilatesJson,
                    $negocioId, $idFuncional, $pasesMultiplesJson,
                    $negocioId, $idPilates
                ]);

                // C. Recrear turnos y reservas de clases para la SEMANA ACTUAL
                $pdo->prepare("DELETE FROM turnos WHERE id_negocio = ?")->execute([$negocioId]);

                $tsHoy = time();
                $diaSemana = (int)date('w', $tsHoy);
                $diasALunes = ($diaSemana === 0) ? -6 : (1 - $diaSemana);
                $f_lun = date('Y-m-d', strtotime("{$diasALunes} days", $tsHoy));
                $f_mar = date('Y-m-d', strtotime("+1 day", strtotime($f_lun)));
                $f_mie = date('Y-m-d', strtotime("+2 days", strtotime($f_lun)));
                $f_jue = date('Y-m-d', strtotime("+3 days", strtotime($f_lun)));
                $f_vie = date('Y-m-d', strtotime("+4 days", strtotime($f_lun)));
                $f_sab = date('Y-m-d', strtotime("+5 days", strtotime($f_lun)));

                $stmtInsTurno = $pdo->prepare("
                    INSERT INTO turnos (id_negocio, cliente_nombre, cliente_celular, fecha, hora, servicio, profesional, id_servicio, estado, asistio, metodo_pago, precio) VALUES 
                    (?, ?, ?, ?, ?, ?, ?, ?, 'confirmado', ?, 'Pase de Alumno', ?)
                ");

                // Clases del Lunes
                $stmtInsTurno->execute([$negocioId, 'María García', '11 2345 6789', $f_lun, '09:00', 'Pilates Reformer', 'Valentina Ochoa', $idPilates, 1, 6000]);
                $stmtInsTurno->execute([$negocioId, 'Lucía Fernández', '11 4433 2211', $f_lun, '09:00', 'Pilates Reformer', 'Valentina Ochoa', $idPilates, 1, 6000]);
                $stmtInsTurno->execute([$negocioId, 'Carolina Rossi', '11 2233 4455', $f_lun, '09:00', 'Pilates Reformer', 'Valentina Ochoa', $idPilates, 1, 6000]);
                $stmtInsTurno->execute([$negocioId, 'Lucas Fernández', '11 9876 5432', $f_lun, '18:00', 'Entrenamiento Funcional', 'Marcos Gómez', $idFuncional, 1, 5500]);
                $stmtInsTurno->execute([$negocioId, 'Diego Romero', '11 5566 7788', $f_lun, '18:00', 'Entrenamiento Funcional', 'Marcos Gómez', $idFuncional, 1, 5500]);

                // Clases del Martes
                $stmtInsTurno->execute([$negocioId, 'Carolina Rossi', '11 2233 4455', $f_mar, '10:00', 'Yoga Dinámico & Flow', 'Camila Benítez', $idYoga, 1, 5000]);
                $stmtInsTurno->execute([$negocioId, 'María García', '11 2345 6789', $f_mar, '10:00', 'Yoga Dinámico & Flow', 'Camila Benítez', $idYoga, 1, 5000]);
                $stmtInsTurno->execute([$negocioId, 'Lucía Fernández', '11 4433 2211', $f_mar, '17:00', 'Pilates Reformer', 'Valentina Ochoa', $idPilates, 0, 6000]);
                $stmtInsTurno->execute([$negocioId, 'Diego Romero', '11 5566 7788', $f_mar, '17:00', 'Pilates Reformer', 'Valentina Ochoa', $idPilates, 0, 6000]);

                // Clases del Miércoles
                $stmtInsTurno->execute([$negocioId, 'María García', '11 2345 6789', $f_mie, '09:00', 'Pilates Reformer', 'Valentina Ochoa', $idPilates, 0, 6000]);
                $stmtInsTurno->execute([$negocioId, 'Lucía Fernández', '11 4433 2211', $f_mie, '09:00', 'Pilates Reformer', 'Valentina Ochoa', $idPilates, 0, 6000]);
                $stmtInsTurno->execute([$negocioId, 'Lucas Fernández', '11 9876 5432', $f_mie, '18:30', 'Entrenamiento Funcional', 'Marcos Gómez', $idFuncional, 0, 5500]);
                $stmtInsTurno->execute([$negocioId, 'Diego Romero', '11 5566 7788', $f_mie, '18:30', 'Entrenamiento Funcional', 'Marcos Gómez', $idFuncional, 0, 5500]);

                // Clases del Jueves
                $stmtInsTurno->execute([$negocioId, 'Carolina Rossi', '11 2233 4455', $f_jue, '10:00', 'Yoga Dinámico & Flow', 'Camila Benítez', $idYoga, 0, 5000]);
                $stmtInsTurno->execute([$negocioId, 'María García', '11 2345 6789', $f_jue, '17:00', 'Pilates Reformer', 'Valentina Ochoa', $idPilates, 0, 6000]);
                $stmtInsTurno->execute([$negocioId, 'Lucas Fernández', '11 9876 5432', $f_jue, '17:00', 'Pilates Reformer', 'Valentina Ochoa', $idPilates, 0, 6000]);

                // Clases del Viernes
                $stmtInsTurno->execute([$negocioId, 'Lucía Fernández', '11 4433 2211', $f_vie, '09:00', 'Pilates Reformer', 'Valentina Ochoa', $idPilates, 0, 6000]);
                $stmtInsTurno->execute([$negocioId, 'Diego Romero', '11 5566 7788', $f_vie, '09:00', 'Pilates Reformer', 'Valentina Ochoa', $idPilates, 0, 6000]);
                $stmtInsTurno->execute([$negocioId, 'Lucas Fernández', '11 9876 5432', $f_vie, '18:00', 'Entrenamiento Funcional', 'Marcos Gómez', $idFuncional, 0, 5500]);

                // Turnos individuales tradicionales (Masajes y Faciales)
                $pdo->prepare("
                    INSERT INTO turnos (id_negocio, cliente_nombre, cliente_celular, fecha, hora, servicio, profesional, id_servicio, estado, asistio, metodo_pago, precio) VALUES 
                    (?, 'Sofía Castro', '1133445566', ?, '11:30', 'Masaje Relajante & Descontracturante', 'Valentina Ochoa', ?, 'confirmado', 0, 'Efectivo', 15000),
                    (?, 'Camila Varela', '1177889900', ?, '15:00', 'Limpieza Facial Profunda', 'Camila Benítez', ?, 'confirmado', 0, 'Transferencia', 12000)
                ")->execute([
                    $negocioId, $f_lun, $idMasaje,
                    $negocioId, $f_mar, $idFacial
                ]);

                // D. Restablecer configuración web demo con soporte completo de clases y cupos
                $stmtCfgCheck = $pdo->prepare("SELECT id FROM configuracion_web WHERE id_negocio = ? LIMIT 1");
                $stmtCfgCheck->execute([$negocioId]);
                $cfgId = $stmtCfgCheck->fetchColumn();

                if ($cfgId) {
                    $pdo->prepare("UPDATE configuracion_web SET 
                        color_primario = '#D11149',
                        color_secundario = '#FC8712',
                        mensaje_bienvenida = 'Agendatina Studio',
                        intervalo_turnos = 'servicio',
                        tipo_calendario = 'clasico',
                        titulo = 'Agendatina Studio',
                        usar_fondo_degrade = 1,
                        primer_dia_semana = 1,
                        modo_reservas = 'cupos_alumnos',
                        turnos_simultaneos = 'si',
                        dias_trabajo = '[\"lunes\",\"martes\",\"miercoles\",\"jueves\",\"viernes\",\"sabado\"]',
                        horarios_detallados_json = ?,
                        hora_apertura = '08:00',
                        hora_cierre = '21:00',
                        ultimo_reinicio_demo = ?
                        WHERE id_negocio = ?")->execute([$horariosJson, $currentTime, $negocioId]);
                } else {
                    $pdo->prepare("INSERT INTO configuracion_web (id_negocio, color_primario, color_secundario, mensaje_bienvenida, intervalo_turnos, tipo_calendario, titulo, usar_fondo_degrade, primer_dia_semana, modo_reservas, turnos_simultaneos, dias_trabajo, horarios_detallados_json, hora_apertura, hora_cierre, ultimo_reinicio_demo)
                                   VALUES (?, '#D11149', '#FC8712', 'Agendatina Studio', 'servicio', 'clasico', 'Agendatina Studio', 1, 1, 'cupos_alumnos', 'si', '[\"lunes\",\"martes\",\"miercoles\",\"jueves\",\"viernes\",\"sabado\"]', ?, '08:00', '21:00', ?)")
                        ->execute([$negocioId, $horariosJson, $currentTime]);
                }

                $_SESSION['last_demo_reset'] = $currentTime;
            }

            // 3. Asegurar notificaciones iniciales
            $stmtNotifCount = $pdo->prepare("SELECT COUNT(*) FROM notificaciones WHERE id_negocio = ?");
            $stmtNotifCount->execute([$negocioId]);
            if ((int)$stmtNotifCount->fetchColumn() === 0) {
                $pdo->prepare("INSERT INTO notificaciones (id_negocio, titulo, mensaje) VALUES 
                    (?, '¡Bienvenido a Agendatina!', 'Prueba todas las funciones premium y la gestión de clases grupales con cupos en vivo.'),
                    (?, '🎒 Nueva Reserva de Clase', 'María García se agendó en Pilates Reformer con su pase de alumna.')")->execute([$negocioId, $negocioId]);
            }

            // 4. Asegurar personal del equipo Demo
            $stmtPnCount = $pdo->prepare("SELECT COUNT(*) FROM personal_negocio WHERE id_negocio = ?");
            $stmtPnCount->execute([$negocioId]);
            if ((int)$stmtPnCount->fetchColumn() <= 1) {
                $demoTeam = [
                    ['nombre' => 'Valentina Ochoa', 'email' => 'valentina.demo@agendatina.site', 'rol' => 'admin'],
                    ['nombre' => 'Camila Benítez', 'email' => 'camila.demo@agendatina.site', 'rol' => 'profesional'],
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
