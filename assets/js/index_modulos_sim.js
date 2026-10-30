/**
 * Agendatina - Simulador Interactivo de Módulos (index.html)
 * Pestañas tipo carpeta + Simulaciones interactivas con datos ficticios (sin backend)
 */

(function() {
    'use strict';

    // Lista de módulos en orden de navegación
    const MODULES = [
        { id: 'calendario', label: 'Calendario de Turnos', icon: 'calendar_month', accent: '#FC8712', planBadge: 'Básico • Pro • Premium', planTarget: 'Básico' },
        { id: 'agenda', label: 'Agenda Virtual', icon: 'view_agenda', accent: '#D11149', planBadge: 'Profesional y Premium', planTarget: 'Profesional' },
        { id: 'servicios', label: 'Servicios y Tarifas', icon: 'content_cut', accent: '#10B981', planBadge: 'Básico • Pro • Premium', planTarget: 'Básico' },
        { id: 'equipo', label: 'Equipo y Profesionales', icon: 'badge', accent: '#8B5CF6', planBadge: 'Básico • Pro • Premium', planTarget: 'Básico' },
        { id: 'cupos', label: 'Alumnos / Clases & Cupos', icon: 'groups', accent: '#F59E0B', planBadge: 'Exclusivo Premium', planTarget: 'Premium' },
        { id: 'web', label: 'Mi Página Web', icon: 'language', accent: '#0284C7', planBadge: 'Profesional y Premium', planTarget: 'Profesional' },
        { id: 'estadisticas', label: 'Métricas & Cupones', icon: 'insights', accent: '#0D9488', planBadge: 'Básico • Pro • Premium', planTarget: 'Básico' },
        { id: 'ajustes', label: 'Ajustes de Negocio', icon: 'tune', accent: '#6366F1', planBadge: 'Básico • Pro • Premium', planTarget: 'Básico' },
        { id: 'manual', label: 'Manual & Tour', icon: 'menu_book', accent: '#38BDF8', planBadge: 'Guía Interactiva', planTarget: 'Básico' }
    ];

    let currentModuleIndex = 0;
    let rotationTimer = null;
    let isUserInteracting = false;
    let simCalendarViewMode = 'mensual'; // 'mensual' | 'semanal'
    let simSelectedDay = 15;
    let simSelectedTime = '10:00';
    let simActiveWebTheme = 'default';

    // ==========================================
    // MODAL CTA REUTILIZABLE (Sin alerts)
    // ==========================================
    window.openSimCta = function(title, text, planName = 'Profesional') {
        const modal = document.getElementById('simCtaModal');
        const modalTitle = document.getElementById('simCtaTitle');
        const modalText = document.getElementById('simCtaText');
        const primaryBtn = document.getElementById('simCtaPrimaryBtn');
        const content = document.getElementById('simCtaModalContent');

        if (!modal) return;

        if (modalTitle && title) modalTitle.textContent = title;
        if (modalText && text) modalText.textContent = text;
        if (primaryBtn) {
            let targetPlan = 'Profesional';
            const pLower = (planName || '').toLowerCase();
            if (pLower.includes('sim') || pLower.includes('bas')) targetPlan = 'Plan Simple';
            else if (pLower.includes('prem')) targetPlan = 'Plan Premium';
            else targetPlan = 'Plan Profesional';

            primaryBtn.href = `registro.html?plan=${encodeURIComponent(targetPlan)}`;
            primaryBtn.innerHTML = `<span>Crear Cuenta Gratis (${targetPlan})</span><span class="material-symbols-outlined text-[18px]">arrow_forward</span>`;
        }

        modal.classList.remove('hidden');
        modal.classList.add('flex');
        setTimeout(() => {
            modal.classList.remove('opacity-0');
            if (content) content.classList.remove('scale-95');
        }, 10);
    };

    window.closeSimCta = function() {
        const modal = document.getElementById('simCtaModal');
        const content = document.getElementById('simCtaModalContent');
        if (!modal) return;
        modal.classList.add('opacity-0');
        if (content) content.classList.add('scale-95');
        setTimeout(() => {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }, 300);
    };

    // Cerrar modal CTA con click afuera o tecla ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') window.closeSimCta();
    });

    // ==========================================
    // CONTROL DE PESTAÑAS (TABS)
    // ==========================================
    window.selectModuleTab = function(moduleIdOrAlias, manual = false) {
        if (manual) {
            isUserInteracting = true;
            stopAutoRotation();
        }

        let targetId = moduleIdOrAlias;
        // Compatibilidad con aliases previos
        if (targetId === 'automatizacion') targetId = 'calendario';

        const foundIdx = MODULES.findIndex(m => m.id === targetId);
        if (foundIdx !== -1) {
            currentModuleIndex = foundIdx;
        }

        renderTabsNav();
        renderActiveSimulation();
    };

    window.stepModuleTab = function(direction) {
        isUserInteracting = true;
        stopAutoRotation();
        currentModuleIndex = (currentModuleIndex + direction + MODULES.length) % MODULES.length;
        renderTabsNav();
        renderActiveSimulation();
    };

    window.goToModuleTab = function(moduleId) {
        window.selectModuleTab(moduleId, true);
        const sec = document.getElementById('modulos-detallados');
        if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    function startAutoRotation() {
        stopAutoRotation();
        rotationTimer = setInterval(() => {
            if (!isUserInteracting) {
                currentModuleIndex = (currentModuleIndex + 1) % MODULES.length;
                renderTabsNav();
                renderActiveSimulation();
            }
        }, 5500);
    }

    function stopAutoRotation() {
        if (rotationTimer) {
            clearInterval(rotationTimer);
            rotationTimer = null;
        }
        const statusDot = document.getElementById('modCarouselStatusDot');
        const statusText = document.getElementById('modCarouselStatusText');
        if (statusDot) statusDot.classList.remove('animate-pulse', 'bg-emerald-500');
        if (statusDot) statusDot.classList.add('bg-slate-400');
        if (statusText) statusText.textContent = 'Simulación en vivo (control manual interactivo)';
    }

    // ==========================================
    // RENDERIZADO DE LA BARRA DE PESTAÑAS TIPO CARPETA
    // ==========================================
    function renderTabsNav() {
        const tabsBar = document.getElementById('folderTabsBar');
        if (!tabsBar) return;

        const currentMod = MODULES[currentModuleIndex];

        tabsBar.innerHTML = MODULES.map((m, idx) => {
            const isActive = idx === currentModuleIndex;
            if (isActive) {
                return `
                    <button type="button" 
                        onclick="window.selectModuleTab('${m.id}', true)" 
                        role="tab" 
                        aria-selected="true"
                        style="border-top-color: ${m.accent};"
                        class="group relative shrink-0 px-4 py-3 bg-white rounded-t-xl sm:rounded-t-2xl border-t-4 border-x border-slate-200/90 -mb-[2px] z-10 shadow-sm flex items-center gap-2 text-slate-900 font-extrabold text-xs sm:text-sm cursor-default transition-all">
                        <span class="material-symbols-outlined text-[18px]" style="color: ${m.accent};">${m.icon}</span>
                        <span class="whitespace-nowrap">${m.label}</span>
                        <span class="hidden md:inline-block text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 ml-1">
                            ${m.planBadge}
                        </span>
                    </button>
                `;
            } else {
                return `
                    <button type="button" 
                        onclick="window.selectModuleTab('${m.id}', true)" 
                        role="tab" 
                        aria-selected="false"
                        class="group relative shrink-0 px-3.5 py-2.5 bg-slate-100/90 hover:bg-slate-200/80 rounded-t-lg sm:rounded-t-xl border-t border-x border-slate-200 text-slate-500 hover:text-slate-800 font-semibold text-xs sm:text-sm cursor-pointer transition-all flex items-center gap-1.5">
                        <span class="material-symbols-outlined text-[17px] text-slate-400 group-hover:text-slate-600 transition-colors">${m.icon}</span>
                        <span class="whitespace-nowrap">${m.label}</span>
                    </button>
                `;
            }
        }).join('');

        // Actualizar URL falsa en la barra del navegador
        const urlBar = document.getElementById('simBrowserUrl');
        if (urlBar) {
            urlBar.textContent = `agendatina.site/demo-negocio/${currentMod.id}`;
        }
    }

    // ==========================================
    // RENDERIZADO DEL CONTENIDO DE LA SIMULACIÓN
    // ==========================================
    function renderActiveSimulation() {
        const container = document.getElementById('simModuleWorkspace');
        if (!container) return;

        const mod = MODULES[currentModuleIndex];

        switch(mod.id) {
            case 'calendario':
                container.innerHTML = getSimHtml_Calendario();
                break;
            case 'agenda':
                container.innerHTML = getSimHtml_Agenda();
                break;
            case 'servicios':
                container.innerHTML = getSimHtml_Servicios();
                break;
            case 'equipo':
                container.innerHTML = getSimHtml_Equipo();
                break;
            case 'cupos':
                container.innerHTML = getSimHtml_Cupos();
                break;
            case 'web':
                container.innerHTML = getSimHtml_Web();
                break;
            case 'estadisticas':
                container.innerHTML = getSimHtml_Estadisticas();
                break;
            case 'ajustes':
                container.innerHTML = getSimHtml_Ajustes();
                break;
            case 'manual':
                container.innerHTML = getSimHtml_Manual();
                break;
            default:
                container.innerHTML = getSimHtml_Calendario();
        }
    }

    // ==========================================
    // 1. SIMULACIÓN: CALENDARIO DE TURNOS
    // ==========================================
    window.toggleSimCalendarView = function(view) {
        simCalendarViewMode = view;
        renderActiveSimulation();
    };

    window.selectSimDay = function(day) {
        simSelectedDay = day;
        renderActiveSimulation();
    };

    window.selectSimTime = function(time) {
        simSelectedTime = time;
        renderActiveSimulation();
    };

    function getSimHtml_Calendario() {
        const isMensual = simCalendarViewMode === 'mensual';

        return `
            <div class="space-y-4">
                <!-- Header del Simulador con Toggle Mensual / Semanal -->
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                    <div>
                        <div class="flex items-center gap-2">
                            <span class="w-2.5 h-2.5 rounded-full bg-[#FC8712]"></span>
                            <h4 class="font-extrabold text-slate-900 text-sm sm:text-base">Simulación del Calendario de Turnos (Vista Cliente)</h4>
                        </div>
                        <p class="text-xs text-slate-500">Cálculo dinámico según servicio + 15 min de descanso entre turnos</p>
                    </div>

                    <!-- Toggle Mensual / Semanal -->
                    <div class="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 self-start sm:self-auto">
                        <button type="button" onclick="window.toggleSimCalendarView('mensual')" 
                            class="px-3 py-1 rounded-lg text-xs font-bold transition-all ${isMensual ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'}">
                            Vista Mensual
                        </button>
                        <button type="button" onclick="window.toggleSimCalendarView('semanal')" 
                            class="px-3 py-1 rounded-lg text-xs font-bold transition-all ${!isMensual ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'}">
                            Vista Semanal
                        </button>
                    </div>
                </div>

                ${isMensual ? getSimCalendarMensualHtml() : getSimCalendarSemanalHtml()}
            </div>
        `;
    }

    function getSimCalendarMensualHtml() {
        const days = [
            { d: 10, free: true }, { d: 11, free: true }, { d: 12, free: true },
            { d: 13, free: true }, { d: 14, free: true }, { d: 15, free: true }, { d: 16, free: false }
        ];

        return `
            <div class="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                <!-- Columna Izquierda: Grilla del Mes -->
                <div class="lg:col-span-6 bg-slate-50/70 p-4 rounded-2xl border border-slate-200/90">
                    <div class="flex items-center justify-between mb-3 px-1">
                        <span class="font-extrabold text-xs sm:text-sm text-slate-800">Noviembre 2026</span>
                        <div class="flex items-center gap-1 text-slate-400">
                            <span class="material-symbols-outlined text-[18px]">chevron_left</span>
                            <span class="material-symbols-outlined text-[18px]">chevron_right</span>
                        </div>
                    </div>

                    <div class="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-400 mb-2">
                        <span>LU</span><span>MA</span><span>MI</span><span>JU</span><span>VI</span><span>SA</span><span>DO</span>
                    </div>

                    <div class="grid grid-cols-7 gap-1.5 text-center text-xs">
                        <span class="p-2 text-slate-300">27</span>
                        <span class="p-2 text-slate-300">28</span>
                        <span class="p-2 text-slate-300">29</span>
                        <span class="p-2 text-slate-300">30</span>
                        <span class="p-2 text-slate-300">31</span>
                        <span class="p-2 font-semibold text-slate-600">1</span>
                        <span class="p-2 font-semibold text-slate-600">2</span>
                        <span class="p-2 font-semibold text-slate-600">3</span>
                        <span class="p-2 font-semibold text-slate-600">4</span>
                        <span class="p-2 font-semibold text-slate-600">5</span>
                        <span class="p-2 font-semibold text-slate-600">6</span>
                        <span class="p-2 font-semibold text-slate-600">7</span>
                        <span class="p-2 font-semibold text-slate-600">8</span>
                        <span class="p-2 font-semibold text-slate-600">9</span>
                        ${days.map(item => `
                            <button type="button" onclick="window.selectSimDay(${item.d})" 
                                class="p-2 rounded-xl font-bold transition-all ${item.d === simSelectedDay 
                                    ? 'bg-[#FC8712] text-white shadow-xs scale-105' 
                                    : (item.free ? 'bg-white hover:bg-orange-50 text-slate-800 border border-slate-200/80' : 'bg-slate-100 text-slate-400 cursor-not-allowed')}">
                                ${item.d}
                            </button>
                        `).join('')}
                    </div>

                    <div class="mt-4 pt-3 border-t border-slate-200/80 flex items-center justify-between text-[11px] text-slate-500 font-medium">
                        <span class="flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-[#FC8712]"></span> Día Seleccionado</span>
                        <span class="flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-emerald-500"></span> Horarios Libres</span>
                    </div>
                </div>

                <!-- Columna Derecha: Horarios Disponibles y Formulario -->
                <div class="lg:col-span-6 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3.5">
                    <div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs font-black text-slate-800 uppercase tracking-wider">Horarios para el ${simSelectedDay} de Noviembre</span>
                            <span class="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">3 turnos disponibles</span>
                        </div>
                        <p class="text-[11px] text-slate-500 mt-0.5">Servicio: <strong>Corte & Barba Estilizada</strong> (45 min + 15 min pausa)</p>
                    </div>

                    <div class="grid grid-cols-3 gap-2">
                        ${['09:00', '10:00', '11:15'].map(t => `
                            <button type="button" onclick="window.selectSimTime('${t}')"
                                class="py-2.5 px-2 rounded-xl text-xs font-extrabold transition-all border ${t === simSelectedTime 
                                    ? 'bg-[#FC8712] text-white border-[#FC8712] shadow-xs' 
                                    : 'bg-slate-50 hover:bg-orange-50 text-slate-700 border-slate-200'}">
                                ${t} hs
                            </button>
                        `).join('')}
                    </div>

                    <!-- Mini Formulario Simulado -->
                    <div class="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/90 space-y-2.5">
                        <div class="grid grid-cols-2 gap-2 text-xs">
                            <div>
                                <label class="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Tu Nombre</label>
                                <input type="text" readonly value="Juan Pérez" class="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800">
                            </div>
                            <div>
                                <label class="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">WhatsApp</label>
                                <input type="text" readonly value="+54 9 11 5555-1234" class="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800">
                            </div>
                        </div>

                        <div>
                            <label class="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Cupón de Descuento (Opcional)</label>
                            <div class="flex items-center gap-1.5">
                                <input type="text" readonly value="DESC10 (-10% OFF)" class="w-full bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1.5 text-xs font-black text-emerald-800">
                                <span class="text-[10px] font-extrabold text-emerald-600 shrink-0">Aplicado ✓</span>
                            </div>
                        </div>

                        <div class="pt-1 flex items-center justify-between text-xs font-bold">
                            <span class="text-slate-600">Total a abonar:</span>
                            <div class="text-right">
                                <span class="text-slate-400 line-through text-[11px]">$8.500</span>
                                <span class="text-slate-900 font-black text-sm ml-1">$7.650</span>
                            </div>
                        </div>

                        <button type="button" onclick="window.openSimCta('¡Turno simulado con éxito!', 'En tu negocio real, el cliente recibe el comprobante por WhatsApp/email y la cita se sincroniza en tu calendario.', 'Básico')"
                            class="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#FC8712] to-amber-500 text-white font-extrabold text-xs shadow-xs hover:opacity-95 transition-all flex items-center justify-center gap-1.5">
                            <span class="material-symbols-outlined text-[16px]">check_circle</span>
                            <span>Confirmar Reserva de Turno</span>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    function getSimCalendarSemanalHtml() {
        return `
            <div class="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
                <div class="flex items-center justify-between">
                    <span class="text-xs font-extrabold text-slate-800">Semana del 10 al 16 de Noviembre</span>
                    <span class="text-[11px] font-semibold text-slate-500">Bloques adaptados según duración de servicio</span>
                </div>

                <div class="overflow-x-auto">
                    <div class="min-w-[500px] grid grid-cols-6 gap-2 text-center text-xs">
                        <div class="font-extrabold text-slate-400 pb-1 border-b border-slate-100">Horario</div>
                        <div class="font-extrabold text-slate-800 pb-1 border-b border-slate-100">Lunes 10</div>
                        <div class="font-extrabold text-slate-800 pb-1 border-b border-slate-100">Martes 11</div>
                        <div class="font-extrabold text-slate-800 pb-1 border-b border-slate-100">Miérc 12</div>
                        <div class="font-extrabold text-slate-800 pb-1 border-b border-slate-100">Jueves 13</div>
                        <div class="font-extrabold text-slate-800 pb-1 border-b border-slate-100">Viernes 14</div>

                        <!-- 09:00 -->
                        <div class="font-bold text-slate-400 text-[11px] py-2">09:00 hs</div>
                        <div class="p-2 rounded-lg bg-slate-100 text-slate-400 text-[11px] font-medium">Ocupado</div>
                        <button onclick="window.openSimCta('¡Turno disponible!', 'Podés agendarte en este bloque libre en un solo clic.', 'Básico')" class="p-2 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-bold hover:bg-emerald-100 transition-colors">Libre (45m)</button>
                        <div class="p-2 rounded-lg bg-slate-100 text-slate-400 text-[11px] font-medium">Ocupado</div>
                        <button onclick="window.openSimCta('¡Turno disponible!', 'Podés agendarte en este bloque libre en un solo clic.', 'Básico')" class="p-2 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-bold hover:bg-emerald-100 transition-colors">Libre (45m)</button>
                        <div class="p-2 rounded-lg bg-slate-100 text-slate-400 text-[11px] font-medium">Ocupado</div>

                        <!-- 10:00 -->
                        <div class="font-bold text-slate-400 text-[11px] py-2">10:00 hs</div>
                        <button onclick="window.openSimCta('¡Turno disponible!', 'Podés agendarte en este bloque libre en un solo clic.', 'Básico')" class="p-2 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-bold hover:bg-emerald-100 transition-colors">Libre (60m)</button>
                        <div class="p-2 rounded-lg bg-rose-50 text-[#D11149] border border-rose-200 text-[11px] font-bold">Seña 1h</div>
                        <button onclick="window.openSimCta('¡Turno disponible!', 'Podés agendarte en este bloque libre en un solo clic.', 'Básico')" class="p-2 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-bold hover:bg-emerald-100 transition-colors">Libre (60m)</button>
                        <div class="p-2 rounded-lg bg-slate-100 text-slate-400 text-[11px] font-medium">Ocupado</div>
                        <button onclick="window.openSimCta('¡Turno disponible!', 'Podés agendarte en este bloque libre en un solo clic.', 'Básico')" class="p-2 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-bold hover:bg-emerald-100 transition-colors">Libre (60m)</button>

                        <!-- 11:30 -->
                        <div class="font-bold text-slate-400 text-[11px] py-2">11:30 hs</div>
                        <div class="p-2 rounded-lg bg-slate-100 text-slate-400 text-[11px] font-medium">Ocupado</div>
                        <button onclick="window.openSimCta('¡Turno disponible!', 'Podés agendarte en este bloque libre en un solo clic.', 'Básico')" class="p-2 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-bold hover:bg-emerald-100 transition-colors">Libre (30m)</button>
                        <div class="p-2 rounded-lg bg-slate-100 text-slate-400 text-[11px] font-medium">Ocupado</div>
                        <div class="p-2 rounded-lg bg-slate-100 text-slate-400 text-[11px] font-medium">Ocupado</div>
                        <button onclick="window.openSimCta('¡Turno disponible!', 'Podés agendarte en este bloque libre en un solo clic.', 'Básico')" class="p-2 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-bold hover:bg-emerald-100 transition-colors">Libre (30m)</button>
                    </div>
                </div>

                <div class="pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-slate-500">
                    <span>💡 Hacé clic en cualquier bloque libre para agendar</span>
                    <button type="button" onclick="window.openSimCta('¡Configurá tus turnos en tu propia cuenta!', 'Recibí reservas 24/7 sin estar pendiente del teléfono.', 'Básico')" class="text-[#FC8712] font-bold hover:underline">
                        Crear cuenta gratis →
                    </button>
                </div>
            </div>
        `;
    }

    // ==========================================
    // 2. SIMULACIÓN: AGENDA VIRTUAL (Plan Profesional)
    // ==========================================
    window.confirmSimAppointment = function(btn) {
        if (!btn) return;
        btn.innerHTML = '✓ Confirmado';
        btn.className = 'px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 font-black text-xs';
        btn.disabled = true;
        if (typeof showToast === 'function') {
            showToast('Turno confirmado y notificación enviada al cliente.', 'success');
        }
    };

    function getSimHtml_Agenda() {
        return `
            <div class="space-y-4">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                    <div>
                        <div class="flex items-center gap-2">
                            <span class="w-2.5 h-2.5 rounded-full bg-[#D11149]"></span>
                            <h4 class="font-extrabold text-slate-900 text-sm sm:text-base">Agenda Virtual Interactiva</h4>
                            <span class="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-rose-100 text-[#D11149]">Plan Profesional & Premium</span>
                        </div>
                        <p class="text-xs text-slate-500">Administrá tus citas, estados de confirmación y comunicación directa con clientes</p>
                    </div>

                    <button type="button" onclick="window.openSimCta('¡Agendá citas manuales en tu negocio!', 'Con el Plan Profesional podés registrar turnos telefónicos o presenciales al instante.', 'Profesional')"
                        class="px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#D11149] to-[#FC8712] text-white font-extrabold text-xs shadow-xs hover:opacity-95 transition-all flex items-center gap-1.5 self-start sm:self-auto">
                        <span class="material-symbols-outlined text-[16px]">add</span>
                        <span>Nuevo Turno Manual</span>
                    </button>
                </div>

                <!-- Filtros rápidos de estado -->
                <div class="flex flex-wrap items-center gap-2">
                    <span class="px-3 py-1 rounded-lg bg-[#D11149] text-white text-xs font-bold shadow-2xs">Todos (3)</span>
                    <span class="px-3 py-1 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 text-xs font-bold cursor-pointer">Confirmados (2)</span>
                    <span class="px-3 py-1 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 text-xs font-bold cursor-pointer">En Espera Seña (1)</span>
                </div>

                <!-- Lista de Turnos Simulados -->
                <div class="space-y-2.5">
                    <!-- Turno 1 -->
                    <div class="p-3.5 bg-slate-50/90 rounded-2xl border border-slate-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-300 transition-all">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-[#D11149] to-[#FC8712] text-white flex items-center justify-center font-black text-sm shadow-2xs">
                                MG
                            </div>
                            <div>
                                <div class="flex items-center gap-2">
                                    <h5 class="text-xs sm:text-sm font-extrabold text-slate-900">María Gómez</h5>
                                    <span class="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">Confirmado</span>
                                </div>
                                <p class="text-xs text-slate-500 font-medium">Coloración & Peinado (90 min) • <strong>$18.500</strong></p>
                            </div>
                        </div>

                        <div class="flex items-center gap-2 self-end sm:self-auto">
                            <span class="text-xs font-black text-slate-700 bg-white px-2.5 py-1 rounded-lg border border-slate-200">10:00 hs</span>
                            <button type="button" onclick="window.openSimCta('¡Envío directo de WhatsApp!', 'En el sistema real abrís el chat de WhatsApp con el mensaje del turno listo para enviar.', 'Profesional')"
                                class="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold flex items-center gap-1 transition-colors">
                                <span>💬</span> WhatsApp
                            </button>
                        </div>
                    </div>

                    <!-- Turno 2 (Con Seña 1 hora) -->
                    <div class="p-3.5 bg-slate-50/90 rounded-2xl border border-amber-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-amber-300 transition-all">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center font-black text-sm shadow-2xs">
                                CR
                            </div>
                            <div>
                                <div class="flex items-center gap-2">
                                    <h5 class="text-xs sm:text-sm font-extrabold text-slate-900">Carlos Rossi</h5>
                                    <span class="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-amber-100 text-amber-900">⏳ Esperando Seña (1h)</span>
                                </div>
                                <p class="text-xs text-slate-500 font-medium">Corte Caballero & Barba (45 min) • <strong>$7.500</strong></p>
                            </div>
                        </div>

                        <div class="flex items-center gap-2 self-end sm:self-auto">
                            <span class="text-xs font-black text-slate-700 bg-white px-2.5 py-1 rounded-lg border border-slate-200">11:30 hs</span>
                            <button type="button" onclick="window.confirmSimAppointment(this)"
                                class="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs shadow-2xs transition-all">
                                Confirmar Seña
                            </button>
                        </div>
                    </div>

                    <!-- Turno 3 -->
                    <div class="p-3.5 bg-slate-50/90 rounded-2xl border border-slate-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-300 transition-all">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center font-black text-sm shadow-2xs">
                                LF
                            </div>
                            <div>
                                <div class="flex items-center gap-2">
                                    <h5 class="text-xs sm:text-sm font-extrabold text-slate-900">Lucía Fernández</h5>
                                    <span class="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">Confirmado</span>
                                </div>
                                <p class="text-xs text-slate-500 font-medium">Tratamiento Capilar Brillo (60 min) • <strong>$12.000</strong></p>
                            </div>
                        </div>

                        <div class="flex items-center gap-2 self-end sm:self-auto">
                            <span class="text-xs font-black text-slate-700 bg-white px-2.5 py-1 rounded-lg border border-slate-200">14:00 hs</span>
                            <button type="button" onclick="window.openSimCta('¡Envío directo de WhatsApp!', 'En el sistema real abrís el chat de WhatsApp con el mensaje del turno listo para enviar.', 'Profesional')"
                                class="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold flex items-center gap-1 transition-colors">
                                <span>💬</span> WhatsApp
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // ==========================================
    // 3. SIMULACIÓN: SERVICIOS Y TARIFAS
    // ==========================================
    window.openSimCreateServiceModal = function() {
        const modal = document.getElementById('simServiceModal');
        if (modal) {
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }
    };

    window.closeSimServiceModal = function() {
        const modal = document.getElementById('simServiceModal');
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
    };

    window.submitSimService = function(e) {
        if (e) e.preventDefault();
        window.closeSimServiceModal();
        window.openSimCta(
            '¡Creá tu cuenta gratis para guardar tus servicios!', 
            'Esta es una simulación. Al registrarte gratis tus servicios, duraciones y precios quedarán listos para recibir reservas 24/7.', 
            'Básico'
        );
    };

    function getSimHtml_Servicios() {
        return `
            <div class="space-y-4">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                    <div>
                        <div class="flex items-center gap-2">
                            <span class="w-2.5 h-2.5 rounded-full bg-[#10B981]"></span>
                            <h4 class="font-extrabold text-slate-900 text-sm sm:text-base">Catálogo de Servicios y Tarifas</h4>
                            <span class="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800">Todos los planes</span>
                        </div>
                        <p class="text-xs text-slate-500">Duraciones exactas en horas y minutos, precios en efectivo y descansos</p>
                    </div>

                    <button type="button" onclick="window.openSimCreateServiceModal()"
                        class="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-xs transition-all flex items-center gap-1.5 self-start sm:self-auto">
                        <span class="material-symbols-outlined text-[16px]">add</span>
                        <span>+ Crear Servicio</span>
                    </button>
                </div>

                <!-- Grilla de Servicios -->
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                    <div class="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs hover:border-emerald-300 transition-all flex flex-col justify-between">
                        <div>
                            <div class="flex items-start justify-between mb-2">
                                <span class="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">Corte</span>
                                <span class="text-xs font-bold text-slate-400">40 min</span>
                            </div>
                            <h5 class="font-extrabold text-slate-800 text-sm">Corte de Cabello Clásico</h5>
                            <p class="text-[11px] text-slate-500 mt-1">+10 min de descanso automático incluido</p>
                        </div>
                        <div class="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                            <div>
                                <span class="text-[10px] text-slate-400 block">Efectivo</span>
                                <span class="font-black text-slate-900 text-sm">$6.800</span>
                            </div>
                            <span class="text-xs font-bold text-slate-400 line-through">$7.500</span>
                        </div>
                    </div>

                    <div class="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs hover:border-emerald-300 transition-all flex flex-col justify-between">
                        <div>
                            <div class="flex items-start justify-between mb-2">
                                <span class="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-rose-50 text-[#D11149] border border-rose-200">Color</span>
                                <span class="text-xs font-bold text-slate-400">1h 30m</span>
                            </div>
                            <h5 class="font-extrabold text-slate-800 text-sm">Coloración Global & Reflejos</h5>
                            <p class="text-[11px] text-slate-500 mt-1">+15 min de descanso automático incluido</p>
                        </div>
                        <div class="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                            <div>
                                <span class="text-[10px] text-slate-400 block">Efectivo</span>
                                <span class="font-black text-slate-900 text-sm">$17.500</span>
                            </div>
                            <span class="text-xs font-bold text-slate-400 line-through">$19.000</span>
                        </div>
                    </div>

                    <div class="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs hover:border-emerald-300 transition-all flex flex-col justify-between">
                        <div>
                            <div class="flex items-start justify-between mb-2">
                                <span class="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">Barba</span>
                                <span class="text-xs font-bold text-slate-400">30 min</span>
                            </div>
                            <h5 class="font-extrabold text-slate-800 text-sm">Perfilado y Afeitado Clásico</h5>
                            <p class="text-[11px] text-slate-500 mt-1">Tratamiento con toalla caliente</p>
                        </div>
                        <div class="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                            <div>
                                <span class="text-[10px] text-slate-400 block">Efectivo</span>
                                <span class="font-black text-slate-900 text-sm">$4.500</span>
                            </div>
                            <span class="text-xs font-bold text-slate-400 line-through">$5.000</span>
                        </div>
                    </div>
                </div>

                <!-- Modal Simulado Crear Servicio -->
                <div id="simServiceModal" class="hidden fixed inset-0 z-[75] bg-slate-900/50 backdrop-blur-xs items-center justify-center p-4">
                    <div class="bg-white rounded-2xl p-5 max-w-md w-full border border-slate-200 shadow-xl space-y-3">
                        <div class="flex items-center justify-between pb-2 border-b border-slate-100">
                            <h5 class="font-extrabold text-slate-900 text-sm">Crear Nuevo Servicio (Simulación)</h5>
                            <button type="button" onclick="window.closeSimServiceModal()" class="text-slate-400 hover:text-slate-700 font-bold text-sm">✕</button>
                        </div>
                        <form onsubmit="window.submitSimService(event)" class="space-y-3 text-xs">
                            <div>
                                <label class="block font-bold text-slate-700 mb-1">Nombre del Servicio</label>
                                <input type="text" required value="Masaje Relajante Premium" class="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 font-medium">
                            </div>
                            <div class="grid grid-cols-2 gap-2">
                                <div>
                                    <label class="block font-bold text-slate-700 mb-1">Duración (minutos)</label>
                                    <input type="number" value="50" class="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 font-medium">
                                </div>
                                <div>
                                    <label class="block font-bold text-slate-700 mb-1">Descanso post turno</label>
                                    <input type="number" value="10" class="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 font-medium">
                                </div>
                            </div>
                            <div class="grid grid-cols-2 gap-2">
                                <div>
                                    <label class="block font-bold text-slate-700 mb-1">Precio de Lista ($)</label>
                                    <input type="number" value="12000" class="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 font-medium">
                                </div>
                                <div>
                                    <label class="block font-bold text-slate-700 mb-1">Precio Efectivo ($)</label>
                                    <input type="number" value="10500" class="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 font-medium">
                                </div>
                            </div>
                            <div class="pt-2 flex items-center justify-end gap-2">
                                <button type="button" onclick="window.closeSimServiceModal()" class="px-3 py-2 rounded-lg bg-slate-100 text-slate-600 font-bold text-xs">Cancelar</button>
                                <button type="submit" class="px-4 py-2 rounded-lg bg-emerald-600 text-white font-extrabold text-xs shadow-xs hover:bg-emerald-700 transition-colors">Guardar Servicio</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;
    }

    // ==========================================
    // 4. SIMULACIÓN: EQUIPO Y PROFESIONALES
    // ==========================================
    function getSimHtml_Equipo() {
        return `
            <div class="space-y-4">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                    <div>
                        <div class="flex items-center gap-2">
                            <span class="w-2.5 h-2.5 rounded-full bg-[#8B5CF6]"></span>
                            <h4 class="font-extrabold text-slate-900 text-sm sm:text-base">Gestión de Equipo y Profesionales</h4>
                            <span class="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-purple-100 text-purple-800">Incluido en todos los planes</span>
                        </div>
                        <p class="text-xs text-slate-500">Agendas diferenciadas, fotos, especialidades y permisos individuales</p>
                    </div>

                    <button type="button" onclick="window.openSimCta('¡Sumá a tu equipo de trabajo!', 'Podés configurar de 1 a +5 profesionales según tu negocio con precios especiales por volumen.', 'Básico')"
                        class="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-xs shadow-xs transition-all flex items-center gap-1.5 self-start sm:self-auto">
                        <span class="material-symbols-outlined text-[16px]">person_add</span>
                        <span>+ Agregar Profesional</span>
                    </button>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div class="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs flex items-center justify-between">
                        <div class="flex items-center gap-3">
                            <div class="w-12 h-12 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center font-black text-base border border-purple-200">
                                SO
                            </div>
                            <div>
                                <h5 class="font-extrabold text-slate-900 text-sm">Sofía Valenzuela</h5>
                                <p class="text-xs text-slate-500">Especialista en Coloración & Corte</p>
                                <span class="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md mt-1 inline-block">12 servicios asignados</span>
                            </div>
                        </div>
                        <span class="text-xs font-bold text-slate-400">Lun a Vie</span>
                    </div>

                    <div class="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs flex items-center justify-between">
                        <div class="flex items-center gap-3">
                            <div class="w-12 h-12 rounded-2xl bg-orange-100 text-[#FC8712] flex items-center justify-center font-black text-base border border-orange-200">
                                MR
                            </div>
                            <div>
                                <h5 class="font-extrabold text-slate-900 text-sm">Martín Rossi</h5>
                                <p class="text-xs text-slate-500">Barbero & Estilista Senior</p>
                                <span class="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md mt-1 inline-block">8 servicios asignados</span>
                            </div>
                        </div>
                        <span class="text-xs font-bold text-slate-400">Mar a Sáb</span>
                    </div>
                </div>

                <div class="bg-purple-50/70 p-3.5 rounded-xl border border-purple-200/80 flex items-center justify-between text-xs">
                    <span class="text-purple-900 font-bold">💡 Descuento automático por volumen en equipos de 2 a 5 integrantes (hasta -50% OFF)</span>
                    <button type="button" onclick="window.openSimCta('¡Cotizá tu equipo en segundos!', 'Probá gratis cualquier plan por 30 días sin tarjeta.', 'Básico')" class="text-purple-700 font-black hover:underline shrink-0">
                        Probar gratis →
                    </button>
                </div>
            </div>
        `;
    }

    // ==========================================
    // 5. SIMULACIÓN: ALUMNOS / CLASES Y CUPOS (Premium)
    // ==========================================
    function getSimHtml_Cupos() {
        return `
            <div class="space-y-4">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                    <div>
                        <div class="flex items-center gap-2">
                            <span class="w-2.5 h-2.5 rounded-full bg-[#F59E0B]"></span>
                            <h4 class="font-extrabold text-slate-900 text-sm sm:text-base">Control de Cupos, Clases y Portal de Alumnos</h4>
                            <span class="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-amber-100 text-amber-900">Exclusivo Plan Premium</span>
                        </div>
                        <p class="text-xs text-slate-500">Ideal para pilates, yoga, danza, fitness, talleres y actividades grupales</p>
                    </div>

                    <button type="button" onclick="window.openSimCta('¡Gestioná cupos y pases con Plan Premium!', 'Tus alumnos se inscriben solos a las clases grupales descontando créditos automáticamente.', 'Premium')"
                        class="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-xs shadow-xs transition-all flex items-center gap-1.5 self-start sm:self-auto">
                        <span class="material-symbols-outlined text-[16px]">add_card</span>
                        <span>+ Cargar Pases</span>
                    </button>
                </div>

                <!-- Estado de Cupos en Vivo -->
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div class="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs space-y-2">
                        <div class="flex items-center justify-between">
                            <span class="text-xs font-extrabold text-slate-800">Yoga Flow Matutino (09:00 hs)</span>
                            <span class="text-xs font-black text-amber-600">8 / 10 Cupos</span>
                        </div>
                        <div class="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                            <div class="bg-amber-500 h-full rounded-full" style="width: 80%;"></div>
                        </div>
                        <div class="flex items-center justify-between text-[11px] text-slate-500 font-medium">
                            <span>Prof: Laura Méndez</span>
                            <span class="text-emerald-700 font-bold">2 cupos libres</span>
                        </div>
                    </div>

                    <div class="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs space-y-2">
                        <div class="flex items-center justify-between">
                            <span class="text-xs font-extrabold text-slate-800">Pilates Reformer (11:00 hs)</span>
                            <span class="text-xs font-black text-rose-600">4 / 4 Cupos</span>
                        </div>
                        <div class="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                            <div class="bg-[#D11149] h-full rounded-full" style="width: 100%;"></div>
                        </div>
                        <div class="flex items-center justify-between text-[11px] text-slate-500 font-medium">
                            <span>Prof: Valentina O.</span>
                            <span class="text-rose-700 font-bold">Cupo Completo (Lista espera)</span>
                        </div>
                    </div>
                </div>

                <!-- Tabla de Alumnos Ficticia -->
                <div class="bg-white rounded-2xl border border-slate-200 overflow-hidden text-xs">
                    <div class="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between font-bold text-slate-600">
                        <span>Alumno</span>
                        <span>Pase Activo</span>
                        <span>Vencimiento</span>
                        <span>Acción</span>
                    </div>
                    <div class="p-3 border-b border-slate-100 flex items-center justify-between">
                        <span class="font-bold text-slate-900">Valentina Ramos</span>
                        <span class="bg-amber-50 text-amber-800 px-2 py-0.5 rounded font-bold">3 / 8 Clases</span>
                        <span class="text-slate-500">15/11/2026</span>
                        <button type="button" onclick="window.openSimCta('¡Recargá pases en un clic!', 'Control de vencimientos y auto-renovación para tus alumnos.', 'Premium')" class="text-amber-600 font-bold hover:underline">Recargar</button>
                    </div>
                    <div class="p-3 flex items-center justify-between">
                        <span class="font-bold text-slate-900">Lucas Moreno</span>
                        <span class="bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded font-bold">Pase Libre Mensual</span>
                        <span class="text-slate-500">30/11/2026</span>
                        <span class="text-emerald-600 font-bold">Activo ✓</span>
                    </div>
                </div>
            </div>
        `;
    }

    // ==========================================
    // 6. SIMULACIÓN: MI PÁGINA WEB (Plan Profesional / Premium)
    // ==========================================
    window.setSimWebTheme = function(theme) {
        simActiveWebTheme = theme;
        renderActiveSimulation();
    };

    function getSimHtml_Web() {
        const themeColors = {
            default: { bg: 'from-[#D11149] via-[#e21a56] to-[#FC8712]', btn: 'bg-[#D11149]', tag: 'Rosa & Naranja' },
            emerald: { bg: 'from-emerald-700 via-teal-600 to-lime-600', btn: 'bg-emerald-700', tag: 'Esmeralda & Menta' },
            ocean: { bg: 'from-blue-700 via-cyan-600 to-indigo-700', btn: 'bg-blue-700', tag: 'Océano & Cian' },
            dark: { bg: 'from-slate-900 via-zinc-800 to-amber-700', btn: 'bg-amber-600', tag: 'Dark & Oro' }
        };

        const currentTh = themeColors[simActiveWebTheme] || themeColors.default;

        return `
            <div class="space-y-4">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                    <div>
                        <div class="flex items-center gap-2">
                            <span class="w-2.5 h-2.5 rounded-full bg-[#0284C7]"></span>
                            <h4 class="font-extrabold text-slate-900 text-sm sm:text-base">Tu Página Web Propia (mi-web)</h4>
                            <span class="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-sky-100 text-sky-800">Profesional y Premium</span>
                        </div>
                        <p class="text-xs text-slate-500">Personalizá tu portada, catálogo, enlaces a Instagram y colores corporativos</p>
                    </div>

                    <!-- Selector de Paletas en Vivo -->
                    <div class="flex items-center gap-1.5 self-start sm:self-auto">
                        <span class="text-xs font-bold text-slate-400 mr-1">Paleta:</span>
                        <button type="button" onclick="window.setSimWebTheme('default')" title="Rosa & Naranja" class="w-6 h-6 rounded-full bg-gradient-to-r from-[#D11149] to-[#FC8712] border-2 ${simActiveWebTheme === 'default' ? 'border-slate-800 scale-110 shadow-xs' : 'border-white'}"></button>
                        <button type="button" onclick="window.setSimWebTheme('emerald')" title="Esmeralda" class="w-6 h-6 rounded-full bg-gradient-to-r from-emerald-600 to-teal-500 border-2 ${simActiveWebTheme === 'emerald' ? 'border-slate-800 scale-110 shadow-xs' : 'border-white'}"></button>
                        <button type="button" onclick="window.setSimWebTheme('ocean')" title="Océano" class="w-6 h-6 rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 border-2 ${simActiveWebTheme === 'ocean' ? 'border-slate-800 scale-110 shadow-xs' : 'border-white'}"></button>
                        <button type="button" onclick="window.setSimWebTheme('dark')" title="Dark Oro" class="w-6 h-6 rounded-full bg-gradient-to-r from-slate-900 to-amber-600 border-2 ${simActiveWebTheme === 'dark' ? 'border-slate-800 scale-110 shadow-xs' : 'border-white'}"></button>
                    </div>
                </div>

                <!-- Mockup de la Web Pública -->
                <div class="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                    <!-- Portada de la web con colores dinámicos -->
                    <div class="bg-gradient-to-r ${currentTh.bg} p-6 text-white text-center sm:text-left flex flex-col sm:flex-row items-center gap-4 transition-all duration-300">
                        <div class="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center font-black text-2xl border border-white/30 shrink-0">
                            ST
                        </div>
                        <div>
                            <div class="flex items-center justify-center sm:justify-start gap-2">
                                <h5 class="text-xl font-black">SteticaPepito • Salón & Spa</h5>
                                <span class="bg-white/20 px-2 py-0.5 rounded-full text-[10px] font-black">5.0 ★</span>
                            </div>
                            <p class="text-white/80 text-xs mt-1">Estilismo profesional, tratamientos faciales y corporales en Palermo Soho.</p>
                        </div>
                    </div>

                    <!-- Catálogo y Botón CTA de la web -->
                    <div class="p-4 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3">
                        <div class="text-xs text-slate-600 text-center sm:text-left">
                            <p class="font-bold text-slate-800">Catálogo interactivo con fotos, precios y mapa de ubicación</p>
                            <p class="text-[11px] text-slate-400">Tus clientes reservan directamente sin salir de tu link oficial.</p>
                        </div>
                        <button type="button" onclick="window.openSimCta('¡Tené tu propia página web!', 'Con el Plan Profesional contás con tu web personalizada en tu propio enlace agendatina.site/tu-negocio.', 'Profesional')"
                            class="${currentTh.btn} text-white font-extrabold text-xs px-5 py-2.5 rounded-xl shadow-xs hover:opacity-95 transition-all">
                            Reservar Turno Online →
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    // ==========================================
    // 7. SIMULACIÓN: MÉTRICAS Y CUPONES
    // ==========================================
    window.generateSimCoupon = function(btn) {
        if (!btn) return;
        const code = 'VUELVE10-' + Math.random().toString(36).substring(2, 6).toUpperCase();
        btn.parentElement.innerHTML = `
            <div class="bg-purple-100 text-purple-900 border border-purple-200 px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5">
                <span>🎁 Cupón generado: <strong>${code}</strong> (-10% OFF)</span>
            </div>
        `;
    };

    function getSimHtml_Estadisticas() {
        return `
            <div class="space-y-4">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                    <div>
                        <div class="flex items-center gap-2">
                            <span class="w-2.5 h-2.5 rounded-full bg-[#0D9488]"></span>
                            <h4 class="font-extrabold text-slate-900 text-sm sm:text-base">Métricas, Estadísticas y Retorno de Clientes</h4>
                            <span class="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-teal-100 text-teal-800">Todos los planes</span>
                        </div>
                        <p class="text-xs text-slate-500">Ingresos del mes, gráficos de demanda y reactivación de clientes inactivos</p>
                    </div>

                    <button type="button" onclick="window.openSimCta('¡Tomá el control de tus ingresos!', 'Conocé en tiempo real cuánto factura tu negocio y qué profesionales rinden más.', 'Básico')"
                        class="px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-xs shadow-xs transition-all self-start sm:self-auto">
                        Ver Reportes Completos
                    </button>
                </div>

                <!-- KPI Cards -->
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div class="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
                        <span class="text-[10px] uppercase font-bold text-slate-400">Ingresos Estimados</span>
                        <p class="text-xl font-black text-slate-900 mt-0.5">$1.480.000</p>
                        <span class="text-[10px] text-emerald-600 font-bold">▲ +24% vs mes anterior</span>
                    </div>
                    <div class="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
                        <span class="text-[10px] uppercase font-bold text-slate-400">Turnos Atendidos</span>
                        <p class="text-xl font-black text-slate-900 mt-0.5">142 citas</p>
                        <span class="text-[10px] text-slate-500 font-bold">96% asistencia confirmada</span>
                    </div>
                    <div class="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
                        <span class="text-[10px] uppercase font-bold text-slate-400">Retención de Clientes</span>
                        <p class="text-xl font-black text-teal-600 mt-0.5">68%</p>
                        <span class="text-[10px] text-teal-700 font-bold">18 listos para volver</span>
                    </div>
                </div>

                <!-- Sección Clientes para Retorno con Generador de Cupón -->
                <div class="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200/90 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div>
                        <div class="flex items-center gap-2">
                            <span class="material-symbols-outlined text-purple-600 text-base">loyalty</span>
                            <span class="text-xs font-black text-slate-800">Recuperá a Laura Pérez (Último turno hace 38 días)</span>
                        </div>
                        <p class="text-[11px] text-slate-500 mt-0.5">Servicio sugerido: Reflejos & Brushing. Generá un cupón de 10% OFF para enviarle por WhatsApp.</p>
                    </div>

                    <div>
                        <button type="button" onclick="window.generateSimCoupon(this)"
                            class="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-xs shadow-2xs transition-all whitespace-nowrap">
                            🎁 Generar Cupón 10% OFF
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    // ==========================================
    // 8. SIMULACIÓN: AJUSTES DE NEGOCIO
    // ==========================================
    function getSimHtml_Ajustes() {
        return `
            <div class="space-y-4">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                    <div>
                        <div class="flex items-center gap-2">
                            <span class="w-2.5 h-2.5 rounded-full bg-[#6366F1]"></span>
                            <h4 class="font-extrabold text-slate-900 text-sm sm:text-base">Ajustes y Reglas del Sistema</h4>
                            <span class="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800">Todos los planes</span>
                        </div>
                        <p class="text-xs text-slate-500">Turnos, retención de seña por 1 hora, pausas de descanso y horarios</p>
                    </div>

                    <button type="button" onclick="window.openSimCta('¡Configurá tu negocio a tu medida!', 'Probá gratis cualquier plan por 30 días sin tarjeta.', 'Básico')"
                        class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs shadow-xs transition-all self-start sm:self-auto">
                        Guardar Ajustes
                    </button>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
                    <!-- Ajuste 1: Seña 1 hora -->
                    <div class="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-2">
                        <div class="flex items-center justify-between">
                            <span class="font-extrabold text-slate-800">Retención de Seña (1 hora)</span>
                            <input type="checkbox" checked class="w-4 h-4 text-[#D11149] rounded cursor-pointer">
                        </div>
                        <p class="text-[11px] text-slate-500">Mantiene el turno bloqueado por 60 min mientras el cliente transfiere la seña a tu Alias bancario.</p>
                    </div>

                    <!-- Ajuste 2: Pausa entre turnos -->
                    <div class="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-2">
                        <div class="flex items-center justify-between">
                            <span class="font-extrabold text-slate-800">Pausa de Descanso</span>
                            <span class="text-[10px] font-bold text-slate-400">Entre citas</span>
                        </div>
                        <select class="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-bold text-slate-800">
                            <option value="15">15 minutos entre turnos (Recomendado)</option>
                            <option value="10">10 minutos</option>
                            <option value="20">20 minutos</option>
                            <option value="0">Sin descanso</option>
                        </select>
                    </div>

                    <!-- Ajuste 3: Alias Bancario -->
                    <div class="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-2">
                        <span class="font-extrabold text-slate-800 block">Alias para Transferencias</span>
                        <input type="text" readonly value="estetica.pepito.mp" class="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-black text-slate-800">
                    </div>

                    <!-- Ajuste 4: Primer día de la semana -->
                    <div class="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-2">
                        <span class="font-extrabold text-slate-800 block">Primer día de la semana</span>
                        <div class="flex items-center gap-2">
                            <span class="px-3 py-1.5 rounded-xl bg-[#D11149] text-white font-extrabold text-xs shadow-2xs">Lunes</span>
                            <span class="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-500 font-bold text-xs">Domingo</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // ==========================================
    // 9. SIMULACIÓN: MANUAL Y TOUR VIRTUAL
    // ==========================================
    function getSimHtml_Manual() {
        return `
            <div class="space-y-4">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                    <div>
                        <div class="flex items-center gap-2">
                            <span class="w-2.5 h-2.5 rounded-full bg-[#38BDF8]"></span>
                            <h4 class="font-extrabold text-slate-900 text-sm sm:text-base">Manual de Uso y Tour Virtual Guiado</h4>
                            <span class="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-sky-100 text-sky-800">Acompañamiento inicial</span>
                        </div>
                        <p class="text-xs text-slate-500">Explicaciones claras según tu plan para arrancar sin dudas</p>
                    </div>

                    <button type="button" onclick="window.openSimCta('¡Comenzá con el Tour Virtual!', 'Al ingresar por primera vez, el sistema te guía paso a paso para configurar tu negocio.', 'Básico')"
                        class="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-extrabold text-xs shadow-xs transition-all self-start sm:self-auto">
                        Iniciar Tour Virtual
                    </button>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div class="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5">
                        <span class="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-slate-200 text-slate-700">Paso 1</span>
                        <h5 class="font-bold text-slate-800">Cargar Horarios</h5>
                        <p class="text-[11px] text-slate-500">Definí los días y rangos horarios de apertura y descanso.</p>
                    </div>
                    <div class="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5">
                        <span class="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-slate-200 text-slate-700">Paso 2</span>
                        <h5 class="font-bold text-slate-800">Crear Servicios</h5>
                        <p class="text-[11px] text-slate-500">Agregá tus servicios con duración en minutos y precio.</p>
                    </div>
                    <div class="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5">
                        <span class="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">Paso 3</span>
                        <h5 class="font-bold text-slate-800">Compartir Enlace</h5>
                        <p class="text-[11px] text-slate-500">Pegá tu link en tu biografía de Instagram y WhatsApp.</p>
                    </div>
                </div>
            </div>
        `;
    }

    // ==========================================
    // INICIALIZACIÓN AL CARGAR EL DOM
    // ==========================================
    document.addEventListener('DOMContentLoaded', () => {
        const tabsBar = document.getElementById('folderTabsBar');
        if (tabsBar) {
            renderTabsNav();
            renderActiveSimulation();
            startAutoRotation();

            // Pausar rotación si el usuario pasa el mouse por encima del panel
            const frame = document.getElementById('moduleSimulatorFrame');
            if (frame) {
                frame.addEventListener('mouseenter', () => { isUserInteracting = true; stopAutoRotation(); });
            }
        }
    });

})();
