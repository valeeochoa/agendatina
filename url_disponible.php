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
    <title><?php echo $displayRuta; ?> — Enlace disponible | Agendatina</title>
    <link rel="icon" href="public/logo.png">
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1" rel="stylesheet" />
    <link rel="stylesheet" href="assets/css/global.css">
    <style>
        body {
            font-family: 'Plus Jakarta Sans', sans-serif;
            background-color: #fafaf9;
            background-image: radial-gradient(#e7e5e4 1px, transparent 1px);
            background-size: 24px 24px;
        }
        .font-brand { font-family: 'Fredoka', cursive, sans-serif !important; }
    </style>
</head>
<body class="text-slate-900 min-h-screen flex flex-col justify-between antialiased">

    <!-- Navbar -->
    <header class="bg-white/90 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-40">
        <div class="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
            <a href="index.html" class="flex items-center gap-2.5 hover:opacity-90 transition-opacity">
                <img src="public/logo.png" alt="Agendatina" class="h-8 w-auto">
                <span class="font-brand font-semibold text-2xl tracking-tight text-[#d11149]">Agenda<span class="text-[#fc8712]">tina</span></span>
            </a>
            <div class="flex items-center gap-2 sm:gap-3">
                <a href="index.html#planes" class="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors hidden sm:inline-block">
                    Planes
                </a>
                <a href="login.html" class="px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors">
                    Ingresar
                </a>
                <a href="registro.html?ruta=<?php echo urlencode($displayRuta); ?>" class="px-4 py-2 text-xs font-bold text-white bg-[#d11149] hover:bg-[#b50e3e] rounded-xl transition-colors">
                    Crear cuenta
                </a>
            </div>
        </div>
    </header>

    <!-- Contenido Principal -->
    <main class="flex-1 max-w-2xl mx-auto px-4 py-12 sm:py-20 w-full flex flex-col justify-center">
        <div class="bg-white rounded-3xl border border-slate-200/90 shadow-[0_20px_50px_-24px_rgba(15,23,42,0.12)] p-6 sm:p-10">

            <!-- Barra estilo navegador con la URL -->
            <div class="flex items-center justify-between gap-3 bg-stone-50 border border-stone-200/90 rounded-2xl px-4 py-3 mb-8">
                <div class="flex items-center gap-2.5 min-w-0">
                    <span class="material-symbols-outlined text-[18px] text-slate-400 shrink-0">lock</span>
                    <div class="text-sm sm:text-base font-medium text-slate-400 truncate">
                        agendatina.site/<span class="text-slate-900 font-bold"><?php echo $displayRuta; ?></span>
                    </div>
                </div>
                <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80 text-[11px] font-bold shrink-0">
                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    Disponible
                </span>
            </div>

            <!-- Título y descripción -->
            <div class="space-y-3 mb-8">
                <h1 class="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
                    Este enlace todavía no tiene dueño.
                </h1>
                <p class="text-sm sm:text-base text-slate-600 leading-relaxed">
                    Podés usar <strong class="text-slate-900 font-semibold">agendatina.site/<?php echo $displayRuta; ?></strong> para mostrar tus servicios, recibir turnos online o gestionar las clases de tus alumnos.
                </p>
            </div>

            <!-- Acciones -->
            <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-8">
                <a href="registro.html?ruta=<?php echo urlencode($displayRuta); ?>" class="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-[#d11149] hover:bg-[#b50e3e] text-white font-bold rounded-xl transition-colors text-sm shadow-sm">
                    <span>Usar este enlace para mi negocio</span>
                    <span class="material-symbols-outlined text-[18px]">arrow_forward</span>
                </a>
                <a href="index.html" class="inline-flex items-center justify-center px-5 py-3.5 bg-stone-100 hover:bg-stone-200/80 text-slate-700 font-semibold rounded-xl transition-colors text-sm">
                    Ir al inicio
                </a>
            </div>

            <!-- Puntos simples + nota de disponibilidad -->
            <div class="pt-6 border-t border-slate-100 space-y-5">
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-medium text-slate-600">
                    <div class="flex items-center gap-2">
                        <span class="material-symbols-outlined text-[17px] text-[#fc8712]">calendar_month</span>
                        <span>Agenda online 24/7</span>
                    </div>
                    <div class="flex items-center gap-2">
                        <span class="material-symbols-outlined text-[17px] text-[#d11149]">language</span>
                        <span>Miniweb personalizada</span>
                    </div>
                    <div class="flex items-center gap-2">
                        <span class="material-symbols-outlined text-[17px] text-emerald-600">check_circle</span>
                        <span>Configuración en 1 minuto</span>
                    </div>
                </div>

                <p class="text-[11px] sm:text-xs text-slate-400 leading-relaxed">
                    Nota: si un negocio supera los 30 días posteriores al vencimiento sin registrar el pago, su dirección web se libera automáticamente y vuelve a quedar disponible.
                </p>
            </div>

        </div>
    </main>

    <!-- Footer -->
    <footer class="bg-white/80 border-t border-slate-200/80 py-6 text-xs text-slate-500">
        <div class="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div class="flex items-center gap-2">
                <img src="public/logo.png" alt="Agendatina" class="h-5 w-auto">
                <span class="font-brand font-semibold text-base text-[#d11149]">Agenda<span class="text-[#fc8712]">tina</span></span>
                <span class="text-slate-300">•</span>
                <span class="text-slate-400">Todos los derechos reservados</span>
            </div>
            <div class="flex items-center gap-5 font-medium text-slate-500">
                <a href="index.html" class="hover:text-slate-900 transition-colors">Inicio</a>
                <a href="index.html#planes" class="hover:text-slate-900 transition-colors">Planes</a>
                <a href="terminos.html" class="hover:text-slate-900 transition-colors">Términos y Condiciones</a>
            </div>
        </div>
    </footer>

</body>
</html>
