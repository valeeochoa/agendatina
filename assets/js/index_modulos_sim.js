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
        { id: 'estadisticas', label: 'Métricas & Gráficos', icon: 'insights', accent: '#0D9488', planBadge: 'Básico • Pro • Premium', planTarget: 'Básico' } ];

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

        const trialDays = (window.pricingData && window.pricingData.dias_prueba_defecto) ? window.pricingData.dias_prueba_defecto : 30;

        if (modalTitle && title) modalTitle.textContent = title;
        if (modalText && text) {
            modalText.textContent = text.replace(/30\s*días/gi, `${trialDays} días`);
        }
        if (modal) {
            modal.querySelectorAll('.trial-days-display').forEach(el => el.textContent = trialDays);
        }

        if (primaryBtn) {
            let targetPlan = 'Profesional';
            const pLower = (planName || '').toLowerCase();
            if (pLower.includes('sim') || pLower.includes('bas')) targetPlan = 'Plan Simple';
            else if (pLower.includes('prem')) targetPlan = 'Plan Premium';
            else targetPlan = 'Plan Profesional';

            primaryBtn.href = `registro.html?plan=${encodeURIComponent(targetPlan)}`;
            primaryBtn.innerHTML = `<span>Comenzar prueba gratis de <span class="trial-days-display">${trialDays}</span> días (${targetPlan})</span><span class="material-symbols-outlined text-[18px]">arrow_forward</span>`;
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
        
        // Desplazamiento inteligente para encuadrar completamente las pestañas y el simulador
        setTimeout(() => {
            const target = document.getElementById('folderTabsBar') || document.getElementById('moduleSimulatorFrame') || document.getElementById('modulos-detallados');
            if (target) {
                const nav = document.getElementById('mainNav');
                const navHeight = nav ? nav.offsetHeight : 70;
                const targetRect = target.getBoundingClientRect();
                const absoluteTargetTop = targetRect.top + window.pageYOffset;
                // Margen de 14px debajo de la barra de navegación fija
                const scrollY = Math.max(0, absoluteTargetTop - navHeight - 14);

                window.scrollTo({
                    top: scrollY,
                    behavior: 'smooth'
                });
            }
        }, 50);
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
                        class="group relative shrink-0 px-4 py-3 bg-white rounded-t-xl sm:rounded-t-2xl border-t-4 border-x border-slate-200/90 -mb-px z-10 shadow-sm flex items-center gap-2 text-slate-900 font-extrabold text-xs sm:text-sm cursor-default transition-all">
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

        // Auto-desplazamiento suave de la barra horizontal SOLO si la pestaña activa no es visible o desborda
        setTimeout(() => {
            const activeTabBtn = tabsBar.querySelector('[aria-selected="true"]');
            if (activeTabBtn) {
                const barRect = tabsBar.getBoundingClientRect();
                const btnRect = activeTabBtn.getBoundingClientRect();
                if (btnRect.right > barRect.right || btnRect.left < barRect.left) {
                    activeTabBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
                }
            }
        }, 30);
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
            default:
                container.innerHTML = getSimHtml_Calendario();
        }
    }

    // ==========================================
    // 1. SIMULACIÓN: CALENDARIO DE TURNOS
    // Fiel reflejo de calendarioMensual.html y calendarioSemanal.html
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
                <!-- Header Navbar Oficial idéntico a calendarioMensual.html -->
                <div class="bg-white/95 border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
                    <!-- Barra de acento con degradé oficial de Agendatina -->
                    <div class="h-1 bg-gradient-to-r from-[#D11149] via-[#f44979] to-[#FC8712]"></div>
                    
                    <div class="px-3 sm:px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                        <!-- Izquierda: Volver al panel + Marca Agendatina + Nombre de Negocio -->
                        <div class="flex items-center gap-2 sm:gap-3 flex-wrap">
                            <button type="button" onclick="window.openSimCta('¡Panel de Control Administrativo!', 'Desde el panel principal gestionás turnos, caja, clientes y métricas.', 'Básico')"
                                class="bg-[#d11149] hover:bg-[#b00e3d] text-white font-extrabold py-1.5 px-3 sm:px-3.5 rounded-xl transition-all flex items-center gap-1.5 text-xs shadow-xs hover:scale-[1.02] active:scale-95 cursor-pointer">
                                <span class="material-symbols-outlined text-[17px]">arrow_back</span>
                                <span class="hidden sm:inline">Volver al panel</span>
                            </button>
                            <span class="text-slate-300 font-light text-base hidden sm:inline">|</span>
                            <div class="flex items-center gap-2">
                                <img src="public/logo.png" alt="Agendatina" class="h-7 w-auto drop-shadow-xs">
                                <span class="font-brand font-semibold text-xl tracking-tight text-[#d11149]">Agenda<span class="text-[#fc8712]">tina</span></span>
                            </div>
                            <span class="text-slate-300 font-light text-base hidden md:inline">|</span>
                            <div class="flex items-center gap-2 bg-slate-50 border border-slate-200/80 px-2.5 py-1 rounded-xl shadow-2xs">
                                <span class="material-symbols-outlined text-[17px] text-[#d11149]">storefront</span>
                                <span class="text-xs font-extrabold text-slate-800">Studio Glam</span>
                            </div>
                        </div>

                        <!-- Derecha: Página Web + Modo Demo + Reportar Error -->
                        <div class="flex items-center gap-2 sm:gap-2.5">
                            <button type="button" onclick="window.selectModuleTab('web', true)"
                                class="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3 py-1.5 rounded-xl text-xs transition-all border border-slate-200/80 shadow-2xs cursor-pointer">
                                <span class="material-symbols-outlined text-[16px] text-[#d11149]">language</span>
                                <span class="hidden sm:inline">Página Web</span>
                            </button>
                            <div class="flex items-center gap-1.5 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-xl shadow-2xs">
                                <span class="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                                <span class="text-[11px] font-extrabold text-amber-800 uppercase tracking-wider hidden sm:inline">Modo Demo</span>
                            </div>
                            <button type="button" onclick="window.openSimCta('¡Soporte Técnico Directo!', 'Contás con soporte técnico por WhatsApp y mesa de ayuda 24/7.', 'Básico')"
                                class="text-xs font-bold text-red-500 bg-red-50 hover:bg-red-100 border border-red-200/70 px-2.5 py-1.5 rounded-xl flex items-center gap-1 transition-colors cursor-pointer" title="Reportar Error">
                                <span class="material-symbols-outlined text-[16px]">bug_report</span>
                                <span class="hidden lg:inline">Reportar Error</span>
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Barra de Herramientas del Calendario (Navegación + Modos de Vista + Acciones) -->
                <div class="bg-white border border-slate-200/90 rounded-2xl p-3 shadow-xs flex flex-wrap items-center justify-between gap-3">
                    <div class="flex items-center gap-2">
                        <div class="flex items-center bg-slate-100 rounded-xl p-0.5 border border-slate-200">
                            <button type="button" onclick="window.openSimCta('¡Navegación de Fechas en Tiempo Real!', 'Podés avanzar o retroceder de mes y bloquear feriados al instante.', 'Básico')" class="p-1 text-slate-600 hover:text-slate-900 rounded-lg">
                                <span class="material-symbols-outlined text-[18px]">chevron_left</span>
                            </button>
                            <span class="px-2 text-xs font-black text-slate-800">Agosto 2026</span>
                            <button type="button" onclick="window.openSimCta('¡Navegación de Fechas en Tiempo Real!', 'Podés avanzar o retroceder de mes y bloquear feriados al instante.', 'Básico')" class="p-1 text-slate-600 hover:text-slate-900 rounded-lg">
                                <span class="material-symbols-outlined text-[18px]">chevron_right</span>
                            </button>
                        </div>
                        <span class="text-xs font-bold px-2.5 py-1 rounded-xl bg-slate-100 text-slate-600">Hoy</span>
                    </div>

                    <!-- Selector Mensual / Semanal interactivo en vivo -->
                    <div class="flex items-center bg-slate-100/90 p-1 rounded-xl border border-slate-200">
                        <button type="button" onclick="window.setSimCalendarView('mensual')"
                            class="px-3 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${isMensual ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'}">
                            Vista Mensual
                        </button>
                        <button type="button" onclick="window.setSimCalendarView('semanal')"
                            class="px-3 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${!isMensual ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'}">
                            Vista Semanal
                        </button>
                    </div>

                    <!-- Botones de Acción Operativa -->
                    <div class="flex items-center gap-2">
                        <button type="button" onclick="window.openSimCta('¡Bloqueo de Días y Horarios!', 'Con un solo clic bloqueás francos, vacaciones o turnos sobre la marcha.', 'Básico')"
                            class="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold border border-slate-200 flex items-center gap-1 transition-colors">
                            <span class="material-symbols-outlined text-[16px] text-amber-600">event_busy</span>
                            <span class="hidden sm:inline">Bloquear Horarios</span>
                        </button>
                        <button type="button" onclick="window.openSimCta('¡Gestión de Catálogo de Servicios!', 'Creá servicios, definí precios y asigná profesionales específicos.', 'Básico')"
                            class="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold border border-slate-200 flex items-center gap-1 transition-colors">
                            <span class="material-symbols-outlined text-[16px] text-teal-600">content_cut</span>
                            <span class="hidden sm:inline">Gestionar Servicios</span>
                        </button>
                        <button type="button" onclick="window.copySimCalendarLink(this)"
                            class="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold flex items-center gap-1 shadow-2xs transition-all cursor-pointer">
                            <span class="material-symbols-outlined text-[16px]">share</span>
                            <span>Copiar Enlace</span>
                        </button>
                    </div>
                </div>

                <!-- Contenido Dinámico: Vista Mensual o Vista Semanal -->
                ${isMensual ? getSimCalendarHtml_Mensual() : getSimCalendarHtml_Semanal()}
            </div>
        `;
    }

    function getSimHtml_Agenda() {
        return `
            <div class="space-y-3.5">
                <!-- Navbar Auténtico de la Agenda Virtual (Fiel a agenda.html) -->
                <div class="bg-white border border-slate-200/90 rounded-2xl p-2.5 sm:p-3 shadow-xs flex flex-wrap items-center justify-between gap-2.5">
                    <div class="flex items-center gap-2 sm:gap-3">
                        <button type="button" onclick="window.openSimCta('Panel de Control', 'Volvé a tu panel central con un solo clic.', 'Profesional')"
                            class="bg-[#d11149] hover:bg-[#b00e3d] text-white font-bold py-1.5 px-3 rounded-lg flex items-center gap-1.5 text-xs shadow-2xs transition-all cursor-pointer">
                            <span class="material-symbols-outlined text-[16px]">arrow_back</span>
                            <span class="hidden sm:inline">Volver al panel</span>
                        </button>
                        <span class="text-slate-300 font-light text-base hidden sm:inline">|</span>
                        <div class="flex items-center gap-1.5">
                            <span class="font-brand font-semibold text-lg sm:text-xl tracking-tight text-[#d11149]">Agenda<span class="text-[#fc8712]">tina</span></span>
                        </div>
                        <span class="text-slate-300 font-light text-base hidden sm:inline">|</span>
                        <div class="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg">
                            <span class="material-symbols-outlined text-[16px] text-[#d11149]">storefront</span>
                            <span class="text-xs font-bold text-slate-800">Studio Glam</span>
                        </div>
                    </div>
                    <div class="flex items-center gap-2">
                        <div class="flex items-center gap-1.5 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-md text-[11px] font-extrabold text-amber-800">
                            <span class="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                            <span>Agenda Activa</span>
                        </div>
                        <button type="button" onclick="window.openSimCta('Reporte de Inconvenientes', 'Canal directo para reportar cualquier incidencia técnica de tu agenda.', 'Profesional')"
                            class="text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition-colors cursor-pointer">
                            <span class="material-symbols-outlined text-[14px]">bug_report</span>
                            <span class="hidden md:inline">Reportar Error</span>
                        </button>
                    </div>
                </div>

                <!-- Header de la Agenda Virtual como agenda.html -->
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#D11149] to-[#FC8712] text-white flex items-center justify-center shadow-md shadow-rose-500/20">
                            <span class="material-symbols-outlined text-xl">calendar_month</span>
                        </div>
                        <div>
                            <div class="flex items-center gap-2">
                                <h4 class="font-extrabold text-slate-900 text-base">Mi Agenda Virtual</h4>
                                <span class="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-rose-100 text-[#D11149]">Plan Profesional</span>
                            </div>
                            <p class="text-xs text-slate-500">Gestiona tus turnos en tiempo real y coordina señas por WhatsApp</p>
                        </div>
                    </div>

                    <!-- Buscador y botón nuevo turno -->
                    <div class="flex items-center gap-2 self-start sm:self-auto">
                        <div class="relative hidden sm:block">
                            <span class="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-[16px]">search</span>
                            <input type="text" readonly value="Buscar cliente o servicio..." class="pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-400 w-48">
                        </div>
                        <button type="button" onclick="window.openSimCta('¡Agendá citas manuales en tu negocio!', 'Con el Plan Profesional podés registrar turnos telefónicos o presenciales al instante.', 'Profesional')"
                            class="px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#D11149] to-[#FC8712] text-white font-extrabold text-xs shadow-md shadow-rose-500/20 hover:opacity-95 transition-all flex items-center gap-1.5 cursor-pointer">
                            <span class="material-symbols-outlined text-[16px]">add</span>
                            <span>Nuevo Turno Manual</span>
                        </button>
                    </div>
                </div>

                <!-- Tabs de Profesionales (como agenda.html) -->
                <div class="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
                    <span class="px-3 py-1.5 rounded-xl bg-slate-900 text-white font-extrabold shadow-2xs">Todos los profesionales (4)</span>
                    <span class="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold border border-slate-200 cursor-pointer">Sofía V. (2)</span>
                    <span class="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold border border-slate-200 cursor-pointer">Martín R. (2)</span>
                </div>

                <!-- Layout Principal en Dos Columnas (4 cols / 8 cols) -->
                <div class="grid grid-cols-1 lg:grid-cols-12 gap-5">

                    <!-- COLUMNA IZQUIERDA (4 cols): POR CONFIRMAR -->
                    <div class="lg:col-span-4 space-y-3">
                        <div class="flex items-center justify-between pb-1">
                            <div class="flex items-center gap-2">
                                <span class="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse"></span>
                                <h5 class="text-xs font-black text-amber-900 uppercase tracking-wider">Por Confirmar</h5>
                            </div>
                            <span class="text-xs font-black text-amber-800 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-md">1 pendiente</span>
                        </div>

                        <!-- Tarjeta Pendiente de Seña -->
                        <div class="bg-white rounded-2xl border-2 border-amber-300 p-4 shadow-sm hover:shadow-md transition-all space-y-3">
                            <div class="flex items-start justify-between gap-2">
                                <div class="flex items-center gap-2.5">
                                    <div class="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center font-black text-xs shadow-2xs">
                                        CR
                                    </div>
                                    <div>
                                        <h6 class="font-extrabold text-slate-900 text-xs sm:text-sm">Carlos Rossi</h6>
                                        <span class="text-[11px] text-slate-500 font-medium">+54 9 11 3456-7890</span>
                                    </div>
                                </div>
                                <span class="text-xs font-black text-slate-700 bg-slate-100 px-2 py-0.5 rounded-lg">11:30 hs</span>
                            </div>

                            <div class="bg-amber-50/70 p-2.5 rounded-xl border border-amber-200 text-xs">
                                <div class="flex items-center justify-between font-bold text-slate-800">
                                    <span>Corte Caballero & Barba</span>
                                    <span>$7.500</span>
                                </div>
                                <span class="text-[11px] text-slate-500 block">45 min · Atiende: Martín R.</span>
                                <div class="mt-2 flex items-center gap-1 text-[10px] font-black text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md w-fit">
                                    <span><span class="material-symbols-outlined text-[13px] inline-block align-middle mr-0.5">hourglass_top</span> Esperando comprobante de seña (1h)</span>
                                </div>
                            </div>

                            <div class="flex items-center gap-2 pt-1">
                                <button type="button" onclick="window.confirmSimAppointment(this)"
                                    class="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-2xs transition-all flex items-center justify-center gap-1 cursor-pointer">
                                    <span class="material-symbols-outlined text-[15px]">check</span>
                                    <span>Confirmar Seña</span>
                                </button>
                                <button type="button" onclick="window.openSimCta('¡Envío directo de WhatsApp!', 'En el sistema real abrís el chat de WhatsApp con el mensaje del turno listo para enviar.', 'Profesional')"
                                    class="p-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition-colors cursor-pointer" title="Contactar por WhatsApp">
                                    <span class="material-symbols-outlined text-[17px]">chat</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- COLUMNA DERECHA (8 cols): TABS INTERNOS Y TURNOS CONFIRMADOS -->
                    <div class="lg:col-span-8 bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                        
                        <!-- Barra de Tabs Internos de agenda.html -->
                        <div class="flex border-b border-slate-200 px-3 pt-2 gap-1 bg-slate-50/80 overflow-x-auto text-xs">
                            <button type="button" class="px-3.5 py-2 font-extrabold rounded-t-xl text-[#D11149] bg-white border-t border-x border-slate-200 -mb-px flex items-center gap-1.5 shadow-2xs">
                                <span class="material-symbols-outlined text-[16px]">event_available</span>
                                <span>Próximos (3)</span>
                            </button>
                            <button type="button" class="px-3 py-2 font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1.5 cursor-pointer">
                                <span class="material-symbols-outlined text-[16px]">history_toggle_off</span>
                                <span>Vencidos</span>
                            </button>
                            <button type="button" class="px-3 py-2 font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1.5 cursor-pointer">
                                <span class="material-symbols-outlined text-[16px]">history</span>
                                <span>Historial</span>
                            </button>
                            <button type="button" class="px-3 py-2 font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1.5 cursor-pointer">
                                <span class="material-symbols-outlined text-[16px]">delete</span>
                                <span>Papelera</span>
                            </button>
                        </div>

                        <!-- Lista de Turnos Confirmados con Encabezado de Fecha -->
                        <div class="p-4 sm:p-5 space-y-3">
                            <div class="flex items-center justify-between pb-2 border-b border-slate-100">
                                <span class="text-xs font-extrabold text-slate-800">Hoy · 14 de Noviembre</span>
                                <span class="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">3 turnos programados</span>
                            </div>

                            <!-- Turno 1 -->
                            <div class="p-3 bg-slate-50 hover:bg-slate-100/80 rounded-2xl border border-slate-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors">
                                <div class="flex items-center gap-3">
                                    <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-[#D11149] to-[#FC8712] text-white flex items-center justify-center font-black text-xs shadow-2xs shrink-0">
                                        MG
                                    </div>
                                    <div>
                                        <div class="flex items-center gap-2">
                                            <h6 class="text-xs sm:text-sm font-extrabold text-slate-900">María Gómez</h6>
                                            <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">Confirmado</span>
                                        </div>
                                        <p class="text-xs text-slate-500">Coloración & Peinado (90 min) · Atiende: <strong>Sofía V.</strong></p>
                                    </div>
                                </div>
                                <div class="flex items-center gap-2 self-end sm:self-auto">
                                    <span class="text-xs font-black text-slate-800 bg-white px-2.5 py-1 rounded-lg border border-slate-200">10:00 hs</span>
                                    <span class="text-xs font-black text-slate-900">$18.500</span>
                                    <button type="button" onclick="window.openSimCta('¡Recordatorio por WhatsApp!', 'Envía confirmaciones y avisos previos automáticos a tus clientes.', 'Profesional')" class="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200 flex items-center gap-1">
                                        <span class="material-symbols-outlined text-[14px]">chat</span>
                                        <span class="hidden sm:inline">WhatsApp</span>
                                    </button>
                                </div>
                            </div>

                            <!-- Turno 2 -->
                            <div class="p-3 bg-slate-50 hover:bg-slate-100/80 rounded-2xl border border-slate-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors">
                                <div class="flex items-center gap-3">
                                    <div class="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center font-black text-xs shadow-2xs shrink-0">
                                        LF
                                    </div>
                                    <div>
                                        <div class="flex items-center gap-2">
                                            <h6 class="text-xs sm:text-sm font-extrabold text-slate-900">Lucía Fernández</h6>
                                            <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">Confirmado</span>
                                        </div>
                                        <p class="text-xs text-slate-500">Tratamiento Capilar Brillo (60 min) · Atiende: <strong>Sofía V.</strong></p>
                                    </div>
                                </div>
                                <div class="flex items-center gap-2 self-end sm:self-auto">
                                    <span class="text-xs font-black text-slate-800 bg-white px-2.5 py-1 rounded-lg border border-slate-200">12:15 hs</span>
                                    <span class="text-xs font-black text-slate-900">$12.000</span>
                                    <button type="button" onclick="window.openSimCta('¡Recordatorio por WhatsApp!', 'Envía confirmaciones y avisos previos automáticos a tus clientes.', 'Profesional')" class="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200 flex items-center gap-1">
                                        <span class="material-symbols-outlined text-[14px]">chat</span>
                                        <span class="hidden sm:inline">WhatsApp</span>
                                    </button>
                                </div>
                            </div>

                            <!-- Turno 3 -->
                            <div class="p-3 bg-slate-50 hover:bg-slate-100/80 rounded-2xl border border-slate-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors">
                                <div class="flex items-center gap-3">
                                    <div class="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-xs shadow-2xs shrink-0">
                                        EQ
                                    </div>
                                    <div>
                                        <div class="flex items-center gap-2">
                                            <h6 class="text-xs sm:text-sm font-extrabold text-slate-900">Esteban Quito</h6>
                                            <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">Confirmado</span>
                                        </div>
                                        <p class="text-xs text-slate-500">Corte Clásico Caballero (40 min) · Atiende: <strong>Martín R.</strong></p>
                                    </div>
                                </div>
                                <div class="flex items-center gap-2 self-end sm:self-auto">
                                    <span class="text-xs font-black text-slate-800 bg-white px-2.5 py-1 rounded-lg border border-slate-200">15:30 hs</span>
                                    <span class="text-xs font-black text-slate-900">$8.500</span>
                                    <button type="button" onclick="window.openSimCta('¡Recordatorio por WhatsApp!', 'Envía confirmaciones y avisos previos automáticos a tus clientes.', 'Profesional')" class="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200 flex items-center gap-1">
                                        <span class="material-symbols-outlined text-[14px]">chat</span>
                                        <span class="hidden sm:inline">WhatsApp</span>
                                    </button>
                                </div>
                            </div>
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
    // 6. SIMULACIÓN: MI PÁGINA WEB (Plan Profesional & Premium)
    // Fiel reflejo de web.html (Hero, Barra Atajos, Catálogo y Paletas Sugeridas)
    // ==========================================
    window.setSimWebTheme = function(theme) {
        simActiveWebTheme = theme;
        renderActiveSimulation();
    };

    function getSimHtml_Web() {
        const themePresets = {
            default: {
                id: 'default',
                name: 'Agendatina Clásica',
                tag: 'Rosa & Naranja',
                heroGradient: 'from-[#D11149] via-[#e21a56] to-[#FC8712]',
                primaryBtn: 'bg-[#D11149] hover:bg-[#b00e3d]',
                primaryText: 'text-[#D11149]',
                accentBadge: 'bg-rose-100 text-[#D11149]',
                swatches: ['#D11149', '#FC8712']
            },
            rosa_verde: {
                id: 'rosa_verde',
                name: 'Rosa & Verde Menta',
                tag: 'Estética & Spa',
                heroGradient: 'from-[#E9579A] via-[#d44385] to-[#2FA36B]',
                primaryBtn: 'bg-[#E9579A] hover:bg-[#d44385]',
                primaryText: 'text-[#E9579A]',
                accentBadge: 'bg-pink-100 text-[#E9579A]',
                swatches: ['#E9579A', '#2FA36B']
            },
            celeste_marron: {
                id: 'celeste_marron',
                name: 'Celeste & Marrón Café',
                tag: 'Estudio & Relax',
                heroGradient: 'from-[#52A9C9] via-[#3f8ca8] to-[#6B4A2F]',
                primaryBtn: 'bg-[#52A9C9] hover:bg-[#3f8ca8]',
                primaryText: 'text-[#52A9C9]',
                accentBadge: 'bg-sky-100 text-sky-800',
                swatches: ['#52A9C9', '#6B4A2F']
            },
            azul_amarillo: {
                id: 'azul_amarillo',
                name: 'Azul & Amarillo Pastel',
                tag: 'Barbería & Fitness',
                heroGradient: 'from-[#1D4ED8] via-[#2563eb] to-[#F59E0B]',
                primaryBtn: 'bg-[#1D4ED8] hover:bg-[#1e40af]',
                primaryText: 'text-[#1D4ED8]',
                accentBadge: 'bg-blue-100 text-[#1D4ED8]',
                swatches: ['#1D4ED8', '#F59E0B']
            },
            dark_oro: {
                id: 'dark_oro',
                name: 'Dark Elegance & Ámbar',
                tag: 'Tattoo & Noche',
                heroGradient: 'from-slate-900 via-slate-800 to-[#D97706]',
                primaryBtn: 'bg-[#D97706] hover:bg-[#b45309]',
                primaryText: 'text-amber-700',
                accentBadge: 'bg-amber-100 text-amber-900',
                swatches: ['#0F172A', '#D97706']
            }
        };

        const activePreset = themePresets[simActiveWebTheme] || themePresets.default;

        return `
            <div class="space-y-4">
                <!-- Header con Selector de Paletas Sugeridas en Vivo -->
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                    <div>
                        <div class="flex items-center gap-2">
                            <span class="w-2.5 h-2.5 rounded-full bg-[#0284C7]"></span>
                            <h4 class="font-extrabold text-slate-900 text-sm sm:text-base">Tu Página Web Pública de Reservas (web.html)</h4>
                            <span class="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-sky-100 text-sky-800">Plan Profesional & Premium</span>
                        </div>
                        <p class="text-xs text-slate-500">Muestra fielmente tu portada, catálogo de servicios, atajos de atención y paleta corporativa</p>
                    </div>

                    <!-- Selector de Paletas Sugeridas Más Usadas -->
                    <div class="flex flex-wrap items-center gap-1.5 self-start sm:self-auto">
                        <span class="text-xs font-bold text-slate-400 mr-1 flex items-center gap-1">
                            <span class="material-symbols-outlined text-[15px]">palette</span>
                            Paleta:
                        </span>
                        ${Object.values(themePresets).map(preset => `
                            <button type="button" onclick="window.setSimWebTheme('${preset.id}')" 
                                title="${preset.name} (${preset.tag})"
                                class="px-2.5 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${preset.id === simActiveWebTheme 
                                    ? 'bg-slate-900 text-white border-slate-900 shadow-2xs scale-105' 
                                    : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'}">
                                <span class="flex -space-x-1">
                                    <span class="w-3.5 h-3.5 rounded-full border border-white" style="background-color: ${preset.swatches[0]};"></span>
                                    <span class="w-3.5 h-3.5 rounded-full border border-white" style="background-color: ${preset.swatches[1]};"></span>
                                </span>
                                <span class="hidden md:inline">${preset.name.split(' ')[0]}</span>
                            </button>
                        `).join('')}
                    </div>
                </div>

                <!-- Marco de la Página Web Real (Reflejo Fiel de web.html) -->
                <div class="bg-white rounded-3xl border-2 border-slate-200 overflow-hidden shadow-md">
                    
                    <!-- Barra de Navegación de la Web Pública -->
                    <div class="bg-white/95 backdrop-blur-md px-5 py-3 border-b border-slate-100 flex items-center justify-between">
                        <div class="flex items-center gap-2.5">
                            <div class="w-8 h-8 rounded-xl ${activePreset.primaryBtn} text-white flex items-center justify-center font-black text-xs shadow-2xs">
                                SE
                            </div>
                            <div>
                                <span class="font-extrabold text-sm text-slate-900 block leading-tight">Stetica & Estilo</span>
                                <span class="text-[10px] text-slate-400 font-medium block">agendatina.site/stetica-estilo</span>
                            </div>
                        </div>

                        <div class="flex items-center gap-3">
                            <nav class="hidden sm:flex items-center gap-4 text-xs font-bold text-slate-600">
                                <a href="javascript:void(0)" class="hover:text-primary transition-colors">Servicios</a>
                                <a href="javascript:void(0)" class="hover:text-primary transition-colors">Equipo</a>
                                <a href="javascript:void(0)" class="hover:text-primary transition-colors">Contacto</a>
                            </nav>
                            <button type="button" onclick="window.selectModuleTab('calendario', true)"
                                class="${activePreset.primaryBtn} text-white text-xs font-extrabold px-3.5 py-1.5 rounded-xl shadow-xs transition-all flex items-center gap-1 cursor-pointer">
                                <span class="material-symbols-outlined text-[15px]">calendar_month</span>
                                <span>Solicitar Turno</span>
                            </button>
                        </div>
                    </div>

                    <!-- HERO SECTION con degradado dinámico (Idéntico a web.html) -->
                    <div class="bg-gradient-to-r ${activePreset.heroGradient} px-6 py-10 sm:py-14 text-white text-center relative overflow-hidden transition-all duration-500">
                        <div class="max-w-2xl mx-auto space-y-3.5 relative z-10">
                            <div class="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/20 backdrop-blur-md text-white text-[11px] font-bold border border-white/30 shadow-2xs">
                                <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                                <span>Turnos y Reservas Online Disponibles</span>
                            </div>
                            <h3 class="text-2xl sm:text-4xl font-extrabold tracking-tight drop-shadow-xs">
                                Bienvenidos a Stetica & Estilo
                            </h3>
                            <p class="text-xs sm:text-base text-white/90 max-w-xl mx-auto font-normal leading-relaxed">
                                Tu espacio de relax, estética y cuidado personal en Palermo Soho. Reservá tu cita en 3 simples pasos.
                            </p>
                            <div class="pt-2 flex flex-wrap items-center justify-center gap-2.5">
                                <button type="button" onclick="window.selectModuleTab('calendario', true)"
                                    class="bg-white text-slate-900 hover:bg-slate-100 font-extrabold text-xs sm:text-sm px-5 py-2.5 rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer">
                                    <span class="material-symbols-outlined text-[18px] ${activePreset.primaryText}">calendar_month</span>
                                    <span>Solicitar Turno Ahora</span>
                                </button>
                                <button type="button" onclick="window.openSimCta('¡Configurá tu propia web!', 'Personalizá logo, fotos de servicios, enlaces de Instagram y mapa en tu Plan Profesional.', 'Profesional')"
                                    class="bg-white/15 hover:bg-white/25 text-white font-bold text-xs sm:text-sm px-4 py-2.5 rounded-xl border border-white/30 transition-all">
                                    <span>Ver Catálogo</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- BARRA DE ATAJOS FLOTANTE (Idéntica a web.html) -->
                    <div class="px-4 -mt-5 relative z-20 max-w-4xl mx-auto">
                        <div class="bg-white rounded-2xl border border-slate-200/90 p-3 sm:p-4 shadow-md grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                            <div class="flex items-center gap-2.5">
                                <div class="w-8 h-8 rounded-xl bg-orange-100 text-[#FC8712] flex items-center justify-center shrink-0">
                                    <span class="material-symbols-outlined text-[18px]">schedule</span>
                                </div>
                                <div>
                                    <span class="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Atención</span>
                                    <strong class="text-slate-800 text-[11px] font-bold block">Lun a Sáb 09-20h</strong>
                                </div>
                            </div>

                            <div class="flex items-center gap-2.5">
                                <div class="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                                    <span class="material-symbols-outlined text-[18px]">verified</span>
                                </div>
                                <div>
                                    <span class="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Reserva Online</span>
                                    <strong class="text-slate-800 text-[11px] font-bold block">Confirmación al Instante</strong>
                                </div>
                            </div>

                            <div class="flex items-center gap-2.5">
                                <div class="w-8 h-8 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center shrink-0">
                                    <span class="material-symbols-outlined text-[18px]">groups</span>
                                </div>
                                <div>
                                    <span class="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Especialistas</span>
                                    <strong class="text-slate-800 text-[11px] font-bold block">Equipo Calificado</strong>
                                </div>
                            </div>

                            <div class="flex items-center gap-2.5">
                                <div class="w-8 h-8 rounded-xl bg-sky-100 text-sky-600 flex items-center justify-center shrink-0">
                                    <span class="material-symbols-outlined text-[18px]">chat</span>
                                </div>
                                <div>
                                    <span class="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Consultas</span>
                                    <strong class="text-slate-800 text-[11px] font-bold block">WhatsApp Directo</strong>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- CATÁLOGO DE SERVICIOS (Idéntico a web.html) -->
                    <div class="p-5 sm:p-7 space-y-4">
                        <div class="text-center max-w-sm mx-auto">
                            <h4 class="text-base sm:text-lg font-extrabold text-slate-900">Nuestros Servicios Destacados</h4>
                            <div class="w-12 h-1 ${activePreset.primaryBtn} mx-auto rounded-full mt-1.5 mb-2"></div>
                            <p class="text-xs text-slate-500">Seleccioná un servicio para iniciar tu reserva sin intermediarios</p>
                        </div>

                        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                            
                            <!-- Servicio 1 -->
                            <div class="bg-slate-50 rounded-2xl border border-slate-200/90 p-4 flex flex-col justify-between hover:border-slate-300 transition-all shadow-2xs">
                                <div>
                                    <div class="flex items-center justify-between mb-2">
                                        <span class="text-[10px] font-bold px-2 py-0.5 rounded-md ${activePreset.accentBadge}">Corte & Barba</span>
                                        <span class="text-xs font-black text-slate-900">$8.500</span>
                                    </div>
                                    <h5 class="font-extrabold text-slate-900 text-xs sm:text-sm">Corte de Cabello & Styling</h5>
                                    <p class="text-[11px] text-slate-500 mt-1">Lavado premium, corte con tijera o máquina y acabado con pomada mate.</p>
                                    <span class="text-[10px] text-slate-400 block mt-2 font-medium">⏱ 45 min · Atiende: Martín R.</span>
                                </div>
                                <button type="button" onclick="window.selectModuleTab('calendario', true)"
                                    class="mt-3 w-full py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 font-extrabold text-xs shadow-2xs transition-all flex items-center justify-center gap-1 cursor-pointer">
                                    <span>Agendar Turno</span>
                                    <span class="material-symbols-outlined text-[14px]">arrow_forward</span>
                                </button>
                            </div>

                            <!-- Servicio 2 -->
                            <div class="bg-slate-50 rounded-2xl border border-slate-200/90 p-4 flex flex-col justify-between hover:border-slate-300 transition-all shadow-2xs">
                                <div>
                                    <div class="flex items-center justify-between mb-2">
                                        <span class="text-[10px] font-bold px-2 py-0.5 rounded-md ${activePreset.accentBadge}">Estética Facial</span>
                                        <span class="text-xs font-black text-slate-900">$14.000</span>
                                    </div>
                                    <h5 class="font-extrabold text-slate-900 text-xs sm:text-sm">Tratamiento Facial Glow</h5>
                                    <p class="text-[11px] text-slate-500 mt-1">Limpieza profunda, exfoliación ultrasónica y máscara de hidratación intensiva.</p>
                                    <span class="text-[10px] text-slate-400 block mt-2 font-medium">⏱ 60 min · Atiende: Sofía V.</span>
                                </div>
                                <button type="button" onclick="window.selectModuleTab('calendario', true)"
                                    class="mt-3 w-full py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 font-extrabold text-xs shadow-2xs transition-all flex items-center justify-center gap-1 cursor-pointer">
                                    <span>Agendar Turno</span>
                                    <span class="material-symbols-outlined text-[14px]">arrow_forward</span>
                                </button>
                            </div>

                            <!-- Servicio 3 -->
                            <div class="bg-slate-50 rounded-2xl border border-slate-200/90 p-4 flex flex-col justify-between hover:border-slate-300 transition-all shadow-2xs">
                                <div>
                                    <div class="flex items-center justify-between mb-2">
                                        <span class="text-[10px] font-bold px-2 py-0.5 rounded-md ${activePreset.accentBadge}">Color & Pelo</span>
                                        <span class="text-xs font-black text-slate-900">$22.000</span>
                                    </div>
                                    <h5 class="font-extrabold text-slate-900 text-xs sm:text-sm">Balayage & Nutrición</h5>
                                    <p class="text-[11px] text-slate-500 mt-1">Efecto de iluminación natural esfumada más baño de nutrición celular.</p>
                                    <span class="text-[10px] text-slate-400 block mt-2 font-medium">⏱ 90 min · Atiende: Sofía V.</span>
                                </div>
                                <button type="button" onclick="window.selectModuleTab('calendario', true)"
                                    class="mt-3 w-full py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 font-extrabold text-xs shadow-2xs transition-all flex items-center justify-center gap-1 cursor-pointer">
                                    <span>Agendar Turno</span>
                                    <span class="material-symbols-outlined text-[14px]">arrow_forward</span>
                                </button>
                            </div>
                        </div>
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
                            <h4 class="font-extrabold text-slate-900 text-sm sm:text-base">Métricas, Estadísticas y Diagramas de Rendimiento</h4>
                            <span class="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-teal-100 text-teal-800">Todos los planes</span>
                        </div>
                        <p class="text-xs text-slate-500">Visualización de demanda semanal, desglose por servicios y retención activa</p>
                    </div>

                    <button type="button" onclick="window.openSimCta('¡Tomá el control de tus ingresos!', 'Conocé en tiempo real cuánto factura tu negocio y qué profesionales rinden más.', 'Básico')"
                        class="px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-xs shadow-xs transition-all self-start sm:self-auto cursor-pointer">
                        Ver Reportes Completos
                    </button>
                </div>

                <!-- KPI Cards -->
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div class="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
                        <span class="text-[10px] uppercase font-bold text-slate-400">Ingresos del Mes</span>
                        <p class="text-xl font-black text-slate-900 mt-0.5">$1.480.000</p>
                        <span class="text-[10px] text-emerald-600 font-bold">▲ +24% vs mes anterior</span>
                    </div>
                    <div class="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
                        <span class="text-[10px] uppercase font-bold text-slate-400">Turnos Totales</span>
                        <p class="text-xl font-black text-slate-900 mt-0.5">142 citas</p>
                        <span class="text-[10px] text-teal-700 font-bold">96% asistencia confirmada</span>
                    </div>
                    <div class="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
                        <span class="text-[10px] uppercase font-bold text-slate-400">Clientes Fieles</span>
                        <p class="text-xl font-black text-teal-600 mt-0.5">68%</p>
                        <span class="text-[10px] text-teal-700 font-bold">18 listos para volver</span>
                    </div>
                </div>

                <!-- DIAGRAMAS VISUALES: Diagrama de Barras (Semana) + Diagrama de Torta (Servicios) -->
                <div class="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
                    <!-- Diagrama de Barras: Demanda por Día -->
                    <div class="lg:col-span-7 bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                        <div class="flex items-center justify-between">
                            <span class="text-xs font-black text-slate-800 flex items-center gap-1.5">
                                <span class="material-symbols-outlined text-[16px] text-teal-600">bar_chart</span>
                                Turnos por Día de la Semana
                            </span>
                            <span class="text-[11px] font-bold text-slate-400">Semana Actual</span>
                        </div>

                        <div class="h-36 flex items-end justify-between gap-2 pt-4 px-1 pb-1 border-b border-slate-100">
                            <!-- Lunes -->
                            <div class="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group">
                                <span class="text-[10px] font-extrabold text-slate-600 group-hover:text-teal-600 transition-colors">18</span>
                                <div class="w-full bg-slate-100 rounded-t-lg overflow-hidden flex items-end h-[60%]">
                                    <div class="w-full bg-gradient-to-t from-teal-600 to-teal-400 h-full rounded-t-lg transition-all group-hover:opacity-90"></div>
                                </div>
                                <span class="text-[10px] font-bold text-slate-400">Lun</span>
                            </div>
                            <!-- Martes -->
                            <div class="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group">
                                <span class="text-[10px] font-extrabold text-slate-600 group-hover:text-teal-600 transition-colors">24</span>
                                <div class="w-full bg-slate-100 rounded-t-lg overflow-hidden flex items-end h-[80%]">
                                    <div class="w-full bg-gradient-to-t from-teal-600 to-teal-400 h-full rounded-t-lg transition-all group-hover:opacity-90"></div>
                                </div>
                                <span class="text-[10px] font-bold text-slate-400">Mar</span>
                            </div>
                            <!-- Miércoles -->
                            <div class="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group">
                                <span class="text-[10px] font-extrabold text-slate-600 group-hover:text-teal-600 transition-colors">15</span>
                                <div class="w-full bg-slate-100 rounded-t-lg overflow-hidden flex items-end h-[50%]">
                                    <div class="w-full bg-gradient-to-t from-teal-600 to-teal-400 h-full rounded-t-lg transition-all group-hover:opacity-90"></div>
                                </div>
                                <span class="text-[10px] font-bold text-slate-400">Mié</span>
                            </div>
                            <!-- Jueves -->
                            <div class="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group">
                                <span class="text-[10px] font-extrabold text-slate-600 group-hover:text-teal-600 transition-colors">28</span>
                                <div class="w-full bg-slate-100 rounded-t-lg overflow-hidden flex items-end h-[90%]">
                                    <div class="w-full bg-gradient-to-t from-teal-600 to-teal-400 h-full rounded-t-lg transition-all group-hover:opacity-90"></div>
                                </div>
                                <span class="text-[10px] font-bold text-slate-400">Jue</span>
                            </div>
                            <!-- Viernes (Pico) -->
                            <div class="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group">
                                <span class="text-[10px] font-extrabold text-[#D11149] group-hover:scale-110 transition-transform">32</span>
                                <div class="w-full bg-slate-100 rounded-t-lg overflow-hidden flex items-end h-[100%]">
                                    <div class="w-full bg-gradient-to-t from-[#D11149] to-[#FC8712] h-full rounded-t-lg transition-all shadow-xs"></div>
                                </div>
                                <span class="text-[10px] font-extrabold text-slate-700">Vie</span>
                            </div>
                            <!-- Sábado -->
                            <div class="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group">
                                <span class="text-[10px] font-extrabold text-slate-600 group-hover:text-teal-600 transition-colors">25</span>
                                <div class="w-full bg-slate-100 rounded-t-lg overflow-hidden flex items-end h-[82%]">
                                    <div class="w-full bg-gradient-to-t from-teal-600 to-teal-400 h-full rounded-t-lg transition-all group-hover:opacity-90"></div>
                                </div>
                                <span class="text-[10px] font-bold text-slate-400">Sáb</span>
                            </div>
                        </div>

                        <div class="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                            <span>Día con mayor ocupación: <strong>Viernes (32 citas)</strong></span>
                            <span class="text-emerald-600 font-extrabold">Promedio: 23,6 citas/día</span>
                        </div>
                    </div>

                    <!-- Diagrama de Torta / Donut: Distribución de Servicios -->
                    <div class="lg:col-span-5 bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3 flex flex-col justify-between">
                        <div class="flex items-center justify-between">
                            <span class="text-xs font-black text-slate-800 flex items-center gap-1.5">
                                <span class="material-symbols-outlined text-[16px] text-teal-600">pie_chart</span>
                                Servicios más Demandados
                            </span>
                            <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200">142 citas</span>
                        </div>

                        <div class="flex items-center gap-4 py-1">
                            <!-- CSS Conic Gradient Donut -->
                            <div class="relative w-24 h-24 rounded-full shrink-0 flex items-center justify-center shadow-inner"
                                style="background: conic-gradient(#0D9488 0% 48%, #FC8712 48% 76%, #8B5CF6 76% 100%);">
                                <div class="w-14 h-14 bg-white rounded-full flex flex-col items-center justify-center shadow-xs">
                                    <span class="text-[10px] font-black text-slate-800 leading-tight">142</span>
                                    <span class="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">Turnos</span>
                                </div>
                            </div>

                            <!-- Leyenda de Servicios -->
                            <div class="space-y-1.5 text-xs flex-1">
                                <div class="flex items-center justify-between">
                                    <span class="flex items-center gap-1.5 font-bold text-slate-700">
                                        <span class="w-2.5 h-2.5 rounded-full bg-[#0D9488]"></span>
                                        Corte & Peinado
                                    </span>
                                    <span class="font-black text-slate-900">48%</span>
                                </div>
                                <div class="flex items-center justify-between">
                                    <span class="flex items-center gap-1.5 font-bold text-slate-700">
                                        <span class="w-2.5 h-2.5 rounded-full bg-[#FC8712]"></span>
                                        Manicuría Spa
                                    </span>
                                    <span class="font-black text-slate-900">28%</span>
                                </div>
                                <div class="flex items-center justify-between">
                                    <span class="flex items-center gap-1.5 font-bold text-slate-700">
                                        <span class="w-2.5 h-2.5 rounded-full bg-[#8B5CF6]"></span>
                                        Color & Spa
                                    </span>
                                    <span class="font-black text-slate-900">24%</span>
                                </div>
                            </div>
                        </div>

                        <!-- Mini desglose de clientes nuevos vs recurrentes -->
                        <div class="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                            <span class="text-slate-500 font-medium">Clientes Recurrentes:</span>
                            <span class="font-extrabold text-teal-700">68% (96 clientes)</span>
                        </div>
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
                            class="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-xs shadow-2xs transition-all whitespace-nowrap cursor-pointer">
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
