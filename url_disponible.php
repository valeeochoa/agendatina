<?php
// Vista de Disponibilidad de URL (Agendatina)
// Se incluye desde index.php cuando el parámetro de negocio (URL) no existe en la base de datos.

$displayRuta = strtolower(trim($ruta ?? ''));
$displayRuta = htmlspecialchars($displayRuta, ENT_QUOTES, 'UTF-8');
?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>URL Disponible - <?php echo $displayRuta; ?> | Agendatina</title>
    <link rel="icon" href="public/logo.png">
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1" rel="stylesheet" />
    <link rel="stylesheet" href="assets/css/global.css">
    <style>
        body { font-family: 'Inter', sans-serif; }
        .font-brand { font-family: 'Fredoka', cursive, sans-serif !important; }
        .font-heading { font-family: 'Plus Jakarta Sans', sans-serif; }
        
        .pulse-badge {
            animation: pulseGlow 2.5s infinite ease-in-out;
        }
        @keyframes pulseGlow {
            0%, 100% { box-shadow: 0 0 20px rgba(16, 185, 129, 0.25); }
            50% { box-shadow: 0 0 35px rgba(16, 185, 129, 0.5); transform: scale(1.02); }
        }
    </style>
</head>
<body class="bg-slate-50 text-slate-800 min-h-screen flex flex-col justify-between">

    <!-- Header / Navbar -->
    <header class="bg-white/90 backdrop-blur-md border-b border-slate-200 sticky top-0 z-40">
        <div class="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
            <a href="index.html" class="flex items-center gap-3 hover:opacity-90 transition-opacity">
                <img src="public/logo.png" alt="Agendatina" class="h-9 w-auto drop-shadow-sm">
                <span class="font-brand font-semibold text-2xl tracking-tight text-[#d11149]">Agenda<span class="text-[#fc8712]">tina</span></span>
            </a>
            <div class="flex items-center gap-2 sm:gap-3">
                <a href="index.html#planes" class="px-3 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors hidden sm:inline-block">
                    Ver Planes
                </a>
                <a href="login.html" class="px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 rounded-xl transition-all border border-slate-200">
                    Ingresar
                </a>
                <a href="registro.html?ruta=<?php echo urlencode($displayRuta); ?>" class="px-4 py-2 text-xs font-bold text-white bg-[#d11149] hover:bg-[#b00d3d] rounded-xl transition-all shadow-md shadow-[#d11149]/20">
                    Crear Cuenta
                </a>
            </div>
        </div>
    </header>

    <!-- Main Content Container -->
    <main class="flex-1 max-w-4xl mx-auto px-4 py-10 sm:py-16 w-full flex flex-col justify-center">
        
        <!-- Hero Box Header -->
        <div class="text-center mb-8">
            <span class="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-black uppercase tracking-wider mb-4 border border-emerald-200 shadow-sm">
                <span class="material-symbols-outlined text-[18px] text-emerald-600">verified</span> Enlace Disponible para Negocios
            </span>

            <div class="bg-slate-900 text-white rounded-3xl p-4 sm:p-6 shadow-xl mb-6 max-w-2xl mx-auto border border-slate-800 flex items-center justify-center gap-2 flex-wrap">
                <span class="text-slate-400 font-bold text-base sm:text-xl">agendatina.site/</span>
                <span class="text-emerald-400 font-black text-xl sm:text-3xl tracking-tight underline decoration-emerald-500/50 underline-offset-4"><?php echo $displayRuta; ?></span>
            </div>

            <h1 class="text-3xl sm:text-5xl font-black text-slate-900 font-heading leading-tight mb-3">
                ¡Esta dirección web está <span class="text-emerald-600">DISPONIBLE</span>!
            </h1>
            <p class="text-slate-600 text-sm sm:text-base max-w-xl mx-auto leading-relaxed">
                Ningún negocio o emprendimiento está utilizando esta URL actualmente. Podés solicitarla y asegurar tu enlace personalizado hoy mismo.
            </p>
        </div>

        <!-- Call To Action Card -->
        <div class="bg-white rounded-3xl border border-slate-200/90 shadow-2xl p-6 sm:p-10 mb-8 text-center pulse-badge relative overflow-hidden">
            <div class="absolute -top-24 -right-24 w-48 h-48 bg-emerald-100 rounded-full blur-3xl opacity-60"></div>
            <div class="absolute -bottom-24 -left-24 w-48 h-48 bg-teal-100 rounded-full blur-3xl opacity-60"></div>
            
            <div class="relative z-10 max-w-xl mx-auto">
                <div class="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-emerald-200 shadow-sm">
                    <span class="material-symbols-outlined text-3xl">add_link</span>
                </div>
                
                <h2 class="text-xl sm:text-2xl font-black text-slate-900 font-heading mb-2">
                    ¿Querés que esta sea la página de tu negocio?
                </h2>
                <p class="text-xs sm:text-sm text-slate-500 mb-6">
                    Comenzá tu prueba gratuita en 1 minuto. Tus clientes podrán reservar sus turnos y ver tu catálogo en este enlace.
                </p>

                <div class="flex flex-col sm:flex-row items-center justify-center gap-3">
                    <a href="registro.html?ruta=<?php echo urlencode($displayRuta); ?>" class="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold rounded-2xl shadow-xl shadow-emerald-600/25 transition-all transform hover:-translate-y-0.5 text-sm sm:text-base">
                        <span class="material-symbols-outlined text-[22px]">rocket_launch</span> Registrar Mi Negocio con esta URL
                    </a>
                    <a href="index.html" class="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl transition-all text-xs sm:text-sm border border-slate-200">
                        Ir al Inicio
                    </a>
                </div>
            </div>
        </div>

        <!-- Expiration Policy Warning Card (Regla de 30 Días) -->
        <div class="bg-amber-50/80 rounded-3xl border border-amber-200/90 p-6 sm:p-8 shadow-sm relative">
            <div class="flex items-start gap-4">
                <div class="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 border border-amber-200">
                    <span class="material-symbols-outlined text-2xl">schedule</span>
                </div>
                <div>
                    <h3 class="text-base font-bold text-amber-950 font-heading mb-1.5 flex items-center gap-2">
                        <span>Política de Expiración y Liberación de URL</span>
                        <span class="text-[10px] uppercase tracking-wider font-extrabold bg-amber-200/70 text-amber-900 px-2 py-0.5 rounded-md">Importante</span>
                    </h3>
                    <p class="text-xs sm:text-sm text-amber-900/90 leading-relaxed font-medium">
                        Transcurridos <strong class="text-amber-950 font-extrabold">30 días posteriores al vencimiento de la fecha de cobro</strong> del servicio sin registrar el pago correspondiente, la dirección web (URL) asignada al negocio se eliminará del sistema y quedará automáticamente <strong class="text-amber-950 font-extrabold">DISPONIBLE</strong> para que otros usuarios o emprendimientos puedan solicitarla y utilizarla.
                    </p>
                </div>
            </div>
        </div>

    </main>

    <!-- Footer -->
    <footer class="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500">
        <div class="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div class="flex items-center gap-2">
                <img src="public/logo.png" alt="Agendatina" class="h-6 w-auto">
                <span class="font-brand font-semibold text-lg text-[#d11149]">Agenda<span class="text-[#fc8712]">tina</span></span>
                <span class="text-slate-400">• Todos los derechos reservados.</span>
            </div>
            <div class="flex items-center gap-4 text-xs font-semibold text-slate-500">
                <a href="index.html" class="hover:text-slate-900 transition-colors">Inicio</a>
                <a href="index.html#planes" class="hover:text-slate-900 transition-colors">Planes</a>
                <a href="terminos.html" class="hover:text-slate-900 transition-colors">Términos y Condiciones</a>
            </div>
        </div>
    </footer>

</body>
</html>
