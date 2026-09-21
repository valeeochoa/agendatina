// backend/js/agenda.js

// Estilos para las animaciones de carga
if (!document.getElementById('agenda-animations')) {
    const style = document.createElement('style');
    style.id = 'agenda-animations';
    style.innerHTML = `
        @keyframes fadeSlideUp {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: var(--target-opacity, 1); transform: translateY(0); }
        }
        .animate-new-item {
            animation: fadeSlideUp 0.4s ease-out forwards;
        }
    `;
    document.head.appendChild(style);
}

window.cargarAgenda = function(force = false) {
    if (force) window.agendaLastDataString = null;
    
    // Auto-refresco de la agenda en segundo plano cada 30 segundos
    if (!window.agendaPollingInterval) {
        window.agendaPollingInterval = setInterval(() => window.cargarAgenda(false), 30000);
    }

    const fetchConfig = typeof window.configData === 'undefined'
        ? fetch('backend/guardar_web.php').then(res => res.json()).then(conf => { 
            window.configData = conf; 
            if (conf) {
                if (conf.usar_fondo_degrade == 1 || conf.usar_fondo_degrade === '1' || conf.usar_fondo_degrade === true) {
                    document.body.setAttribute('data-degrade', '1');
                    document.body.classList.add('calendar-degrade-active');
                } else {
                    document.body.removeAttribute('data-degrade');
                    document.body.classList.remove('calendar-degrade-active');
                }
            }
        })
        : Promise.resolve();

    fetchConfig.finally(() => {
        fetch('backend/obtener_agenda.php')
        .then(res => res.json())
        .then(data => {
            if (data && data.error) {
                console.error('⚠️ [Error al cargar agenda] No se pudo volver a cargar la información. Motivo:', data.error);
                if (data.error.toLowerCase().includes('inicia sesión') || data.error.toLowerCase().includes('autorizado') || data.error.toLowerCase().includes('sesión expirada')) {
                    window.location.href = 'login.html';
                } else {
                    if(typeof window.showToast === 'function') window.showToast(data.error, 'error');
                }
                return;
            }
            if (!Array.isArray(data)) return;

        // Evitar parpadeos salvo que se fuerce la recarga
        const newDataString = JSON.stringify(data);
        if (!force && window.agendaLastDataString === newDataString) return;
        window.agendaLastDataString = newDataString;

        window.agendaData = data;
        
        if (typeof window.services === 'undefined' || window.services.length === 0) {
            fetch('backend/gestionar_servicios.php' + (typeof window.negocioSlug !== 'undefined' && window.negocioSlug ? `?n=${window.negocioSlug}` : ''))
            .then(res => res.json())
            .then(servData => {
                if (Array.isArray(servData)) window.services = servData;
                const currentSearch = document.getElementById('agendaSearchInput') ? document.getElementById('agendaSearchInput').value : '';
                window.renderAgendaTurnos(data, currentSearch);
            })
            .catch(() => window.renderAgendaTurnos(data, document.getElementById('agendaSearchInput') ? document.getElementById('agendaSearchInput').value : ''));
        } else {
            const currentSearch = document.getElementById('agendaSearchInput') ? document.getElementById('agendaSearchInput').value : '';
            window.renderAgendaTurnos(data, currentSearch, window.currentAgendaProfTerm || '');
        }
    })
    .catch(err => console.error(err));
});
};

function setupAgendaSearchListeners() {
    const desktopInput = document.getElementById('agendaSearchInput');
    const mobileInput = document.getElementById('agendaSearchInputMobile');

    const handleSearchInput = (val) => {
        if (desktopInput && desktopInput.value !== val) desktopInput.value = val;
        if (mobileInput && mobileInput.value !== val) mobileInput.value = val;
        window.renderAgendaTurnos(window.agendaData || [], val, window.currentAgendaProfTerm || '');
    };

    if (desktopInput && !desktopInput.dataset.bound) {
        desktopInput.dataset.bound = 'true';
        desktopInput.addEventListener('input', (e) => handleSearchInput(e.target.value));
    }
    if (mobileInput && !mobileInput.dataset.bound) {
        mobileInput.dataset.bound = 'true';
        mobileInput.addEventListener('input', (e) => handleSearchInput(e.target.value));
    }
}

if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setupAgendaSearchListeners();
} else {
    document.addEventListener('DOMContentLoaded', setupAgendaSearchListeners);
}

window.renderAgendaTurnos = function(data, searchTerm = '', profTerm = '') {
    setupAgendaSearchListeners();
    var listPend = document.getElementById('lista-pendientes');

    // --- POBLAR TABS DE PROFESIONALES (CARPETAS) ---
    let profFilterContainer = document.getElementById('profesionalesAgendaTabs');
    
    if (profFilterContainer) {
        if (window.currentUserData && window.currentUserData.rol_en_local === 'profesional') {
            profFilterContainer.classList.add('hidden');
            profFilterContainer.classList.remove('flex');
        } else if (data.length > 0) {
            const uniqueProfs = [...new Set(data.map(t => t.profesional).filter(p => p && p !== 'Cualquiera (Sin preferencia)'))].sort();
            if (uniqueProfs.length > 0) {
                profFilterContainer.classList.remove('hidden');
                profFilterContainer.classList.add('flex');
                let profTabsHtml = `<div class="flex overflow-x-auto gap-3 pb-2 w-full snap-x pt-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">`;
                let activeAll = profTerm === '' ? 'bg-primary text-white shadow-md ring-2 ring-primary/30 ring-offset-2' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200';
                profTabsHtml += `<button onclick="window.setAgendaProfFilter('')" class="snap-start shrink-0 px-5 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${activeAll}"><span class="material-symbols-outlined text-[18px]">groups</span> Todos los turnos</button>`;
                const now = new Date();
                uniqueProfs.forEach(p => {
                    const count = data.filter(t => {
                        if (t.profesional !== p || t.estado !== 'confirmado') return false;
                        const tDate = new Date(t.fecha.replace(/-/g, '/') + ' ' + t.hora);
                        return tDate >= now;
                    }).length;
                    const countBadge = count > 0 ? `<span class="bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-md text-xs font-black ml-1 shadow-sm" title="${count} turnos próximos confirmados">${count}</span>` : '';
                    const isActive = profTerm === p ? 'bg-primary text-white shadow-md ring-2 ring-primary/30 ring-offset-2' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200';
                    const iconColor = profTerm === p ? 'text-white' : 'text-primary';
                    profTabsHtml += `<button onclick="window.setAgendaProfFilter('${p.replace(/'/g, "\\'")}')" class="snap-start shrink-0 px-5 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${isActive}"><span class="material-symbols-outlined text-[18px] ${iconColor}">person</span> ${p} ${countBadge}</button>`;
                });
                profTabsHtml += `</div>`;
                if (profFilterContainer.innerHTML !== profTabsHtml) profFilterContainer.innerHTML = profTabsHtml;
            } else {
                profFilterContainer.classList.add('hidden');
                profFilterContainer.classList.remove('flex');
            }
        }
    }

    let pendientes = data.filter(t => t.estado === 'pendiente');
    let confirmados = data.filter(t => t.estado === 'confirmado');
    let eliminados = data.filter(t => t.estado === 'eliminado' || t.estado === 'cancelado');
    
    if (searchTerm || profTerm) {
        const term = (searchTerm || '').toLowerCase();
        const filterFn = t => {
            let matchSearch = true;
            if (term) matchSearch = (t.cliente_nombre && t.cliente_nombre.toLowerCase().includes(term)) || (t.nombre && t.nombre.toLowerCase().includes(term)) || (t.apellido && t.apellido.toLowerCase().includes(term)) || (t.cliente_celular && t.cliente_celular.includes(term)) || (t.celular && t.celular.includes(term)) || (t.servicio && t.servicio.toLowerCase().includes(term));
            
            let matchProf = true;
            if (profTerm) matchProf = (t.profesional === profTerm);
            
            return matchSearch && matchProf;
        };
            
        pendientes = pendientes.filter(filterFn);
        confirmados = confirmados.filter(filterFn);
        eliminados = eliminados.filter(filterFn);
    }
    
    const urlParams = new URLSearchParams(window.location.search);
    const focusId = urlParams.get('focus');
    
    // Reseteamos el límite del historial si cambia la búsqueda para no perder resultados
    if (typeof window.lastHistorySearchTerm === 'undefined' || window.lastHistorySearchTerm !== searchTerm) {
        window.historyLimit = 15;
        window.trashLimit = 15;
        window.lastHistorySearchTerm = searchTerm;
    }

    const now = new Date();
    const futuros = [];
    const pasados = [];
    
    confirmados.forEach(t => {
        const tDate = new Date(t.fecha.replace(/-/g, '/') + ' ' + t.hora);
        if (tDate < now) pasados.push(t);
        else futuros.push(t);
    });
    
    futuros.sort((a, b) => (a.fecha + ' ' + a.hora).localeCompare(b.fecha + ' ' + b.hora));
    pasados.sort((a, b) => (b.fecha + ' ' + b.hora).localeCompare(a.fecha + ' ' + a.hora));

    // Separar pendientes en futuros (Por Confirmar) y viejos (Vencidos)
    const pendientesFuturos = [];
    const pendientesViejos = [];
    pendientes.forEach(t => {
        const tDate = new Date(t.fecha.replace(/-/g, '/') + ' ' + t.hora);
        if (tDate < now) {
            pendientesViejos.push(t);
        } else {
            pendientesFuturos.push(t);
        }
    });

    // DIBUJAR PENDIENTES
    if (listPend) {
        listPend.innerHTML = '';
        if (pendientesFuturos.length === 0) listPend.innerHTML = `<div class="p-6 rounded-2xl border border-slate-200 text-center" style="background:#f8fafc;"><p class="text-sm font-medium text-slate-400">${searchTerm ? 'No se encontraron resultados de la búsqueda' : 'No hay turnos pendientes'}</p></div>`;
        
        pendientesFuturos.forEach(t => {
            const fParts = t.fecha.split('-');
            const fDisplay = fParts.length === 3 ? `${fParts[2]}/${fParts[1]}/${fParts[0]}` : t.fecha;
            const focusClass = focusId == t.id ? 'ring-4 ring-primary ring-offset-2 scale-[1.02] transition-transform duration-500' : '';
            listPend.innerHTML += `
                <div id="turno-${t.id}" onclick="if(!event.target.closest('button')) window.openEditTurnoModal('${t.id}')" class="shadow-sm rounded-2xl p-5 hover:shadow-lg cursor-pointer transition-all relative overflow-hidden ${focusClass}" style="background-color: #ffffff; border: 1px solid #e2e8f0;">
                    <div class="absolute top-0 left-0 w-1.5 h-full bg-amber-400"></div>
                    <div class="flex justify-between items-start mb-3">
                        <span class="text-xs font-bold px-3 py-1 rounded-lg uppercase tracking-wider" style="background-color: #fef3c7; color: #92400e;">${fDisplay} • ${t.hora} hs</span>
                        ${t.profesional && t.profesional !== 'Cualquiera (Sin preferencia)' ? `<span class="px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1" style="background-color: #f1f5f9; color: #475569;"><span class="material-symbols-outlined text-[14px]">person</span> ${t.profesional}</span>` : ''}
                    </div>
                    <p class="text-lg font-bold mb-1" style="color: #1e293b;">${t.cliente_nombre || (t.nombre + ' ' + (t.apellido || ''))}</p>
                    <div class="flex items-center gap-3 mb-4">
                        <p class="text-sm font-medium flex items-center gap-1.5 px-3 py-1.5 rounded-lg border" style="color: #475569; background-color: #f8fafc; border-color: #e2e8f0;"><span class="material-symbols-outlined text-[16px]">call</span> ${t.cliente_celular || t.celular}</p>
                        <button onclick="window.contactarWhatsApp('${t.id}')" class="text-emerald-600 bg-emerald-50 hover:bg-emerald-100 p-1.5 rounded-lg transition-colors flex items-center justify-center border border-emerald-100" title="Enviar WhatsApp"><span class="material-symbols-outlined text-[18px]">chat</span></button>
                    </div>
                    ${t.metodo_pago ? `<p class="text-sm mb-1 flex items-center gap-2" style="color: #475569;"><span class="material-symbols-outlined text-[18px] text-slate-500">payments</span> <span class="font-medium">${t.metodo_pago}</span></p>` : ''}
                    <p class="text-sm mb-5 flex items-center gap-2" style="color: #475569;"><span class="material-symbols-outlined text-[18px] text-slate-500">spa</span> <span class="font-medium">${t.servicio}</span></p>
                    
                    <div class="flex items-center gap-3 pt-4 border-t" style="border-color: #e2e8f0;">
                        <button onclick="window.confirmarTurnoAdmin('${t.id}')" class="flex-1 bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-1 shadow-sm shadow-amber-500/20">
                            <span class="material-symbols-outlined text-[18px]">check</span> Confirmar
                        </button>
                        <button onclick="window.cancelarTurnoAdmin('${t.id}')" class="bg-red-50 hover:bg-red-100 text-red-600 text-sm font-bold py-2.5 px-4 rounded-xl transition-colors flex items-center justify-center border border-red-100" title="Eliminar turno">
                            <span class="material-symbols-outlined text-[18px]">close</span>
                        </button>
                    </div>
                </div>
            `;
        });
    }

    const countPendSpan = document.getElementById('countPendientes');
    if (countPendSpan) {
        countPendSpan.textContent = pendientesFuturos.length;
    }

    // DIBUJAR PENDIENTES VIEJOS (VENCIDOS)
    const listVencidos = document.getElementById('lista-vencidos');
    if (listVencidos) {
        listVencidos.innerHTML = '';
        if (pendientesViejos.length === 0) {
            listVencidos.innerHTML = `<div class="p-8 text-center text-sm font-medium text-slate-400 rounded-xl border border-slate-200" style="background:#f8fafc;">${searchTerm ? 'No se encontraron resultados de la búsqueda' : 'No hay turnos vencidos.'}</div>`;
        } else {
            const gruposVencidos = {};
            pendientesViejos.forEach(t => {
                if (!gruposVencidos[t.fecha]) gruposVencidos[t.fecha] = [];
                gruposVencidos[t.fecha].push(t);
            });

            const fechasVencidos = Object.keys(gruposVencidos).sort((a, b) => b.localeCompare(a));
            fechasVencidos.forEach(fecha => {
                const [yyyy, mm, dd] = fecha.split('-');
                const formatFecha = `${dd}/${mm}/${yyyy}`;
                const turnosCount = gruposVencidos[fecha].length;
                const turnosText = turnosCount === 1 ? '1 turno' : `${turnosCount} turnos`;

                let htmlDia = `
                    <div class="mb-8">
                        <h3 class="font-bold text-slate-800 mb-4 flex items-center gap-2 opacity-80">
                            <span class="material-symbols-outlined text-[20px]">history_toggle_off</span> 
                            ${formatFecha}
                            <span class="text-[11px] font-bold px-2 py-0.5 rounded-md ml-1 border border-slate-200" style="background:#f1f5f9;color:#64748b;">${turnosText}</span>
                        </h3>
                        <div class="space-y-3">
                `;

                gruposVencidos[fecha].forEach(t => {
                    htmlDia += `
                        <div id="turno-${t.id}" onclick="if(!event.target.closest('button')) window.openEditTurnoModal('${t.id}')" class="shadow-sm rounded-2xl p-5 hover:shadow-lg cursor-pointer transition-shadow relative overflow-hidden" style="background-color: #ffffff; border: 1px solid #e2e8f0;">
                            <div class="absolute top-0 left-0 w-1.5 h-full bg-amber-400"></div>
                            <div class="flex justify-between items-start mb-3">
                                <span class="text-xs font-bold px-3 py-1 rounded-lg uppercase tracking-wider" style="background-color: #fef3c7; color: #92400e;">${t.hora} hs</span>
                                ${t.profesional && t.profesional !== 'Cualquiera (Sin preferencia)' ? `<span class="px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1" style="background-color: #f1f5f9; color: #475569;"><span class="material-symbols-outlined text-[14px]">person</span> ${t.profesional}</span>` : ''}
                            </div>
                            <p class="text-lg font-bold mb-1" style="color: #1e293b;">${t.cliente_nombre || (t.nombre + ' ' + (t.apellido || ''))}</p>
                            <div class="flex items-center gap-3 mb-4">
                                <p class="text-sm font-medium flex items-center gap-1.5 px-3 py-1.5 rounded-lg border" style="color: #475569; background-color: #f8fafc; border-color: #e2e8f0;"><span class="material-symbols-outlined text-[16px]">call</span> ${t.cliente_celular || t.celular}</p>
                                <button onclick="window.contactarWhatsApp('${t.id}')" class="text-emerald-600 bg-emerald-50 hover:bg-emerald-100 p-1.5 rounded-lg transition-colors flex items-center justify-center border border-emerald-100" title="Enviar WhatsApp"><span class="material-symbols-outlined text-[18px]">chat</span></button>
                            </div>
                            ${t.metodo_pago ? `<p class="text-sm mb-1 flex items-center gap-2" style="color: #475569;"><span class="material-symbols-outlined text-[18px] text-slate-500">payments</span> <span class="font-medium">${t.metodo_pago}</span></p>` : ''}
                            <p class="text-sm mb-5 flex items-center gap-2" style="color: #475569;"><span class="material-symbols-outlined text-[18px] text-slate-500">spa</span> <span class="font-medium">${t.servicio}</span></p>
                            <div class="flex items-center gap-3 pt-4 border-t" style="border-color: #e2e8f0;">
                                <button onclick="window.confirmarTurnoAdmin('${t.id}')" class="flex-1 bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-1 shadow-sm shadow-amber-500/20">
                                    <span class="material-symbols-outlined text-[18px]">check</span> Confirmar
                                </button>
                                <button onclick="window.cancelarTurnoAdmin('${t.id}')" class="bg-red-50 hover:bg-red-100 text-red-600 text-sm font-bold py-2.5 px-4 rounded-xl transition-colors flex items-center justify-center border border-red-100" title="Eliminar turno">
                                    <span class="material-symbols-outlined text-[18px]">close</span>
                                </button>
                            </div>
                        </div>
                    `;
                });

                htmlDia += `</div></div>`;
                gruposVencidos[fecha] = []; // Clear
                listVencidos.innerHTML += htmlDia;
            });
        }
    }

    if (focusId) {
        setTimeout(() => {
            const el = document.getElementById('turno-' + focusId);
            if (el) el.scrollIntoView({behavior: 'smooth', block: 'center'});
        }, 500);
    }

    // DIBUJAR CONFIRMADOS (FUTUROS)
    const listConf = document.getElementById('lista-confirmados');
    if (listConf) {
        listConf.innerHTML = '';
        if (futuros.length === 0) {
            listConf.innerHTML = `<div class="p-8 text-center text-sm font-medium text-slate-400 rounded-xl border border-slate-200" style="background:#f8fafc;">${searchTerm ? 'No se encontraron resultados de la búsqueda' : 'Aún no tienes turnos próximos.'}</div>`;
        } else {
            const gruposConf = {};
            futuros.forEach(t => {
                if (!gruposConf[t.fecha]) gruposConf[t.fecha] = [];
                gruposConf[t.fecha].push(t);
            });

            // Orden cronológico ascendente (el día más próximo primero)
            const fechasConf = Object.keys(gruposConf).sort((a, b) => a.localeCompare(b));
            fechasConf.forEach(fecha => {
                const [yyyy, mm, dd] = fecha.split('-');
                const dateObj = new Date(yyyy, mm - 1, dd);
                const esHoy = new Date().toDateString() === dateObj.toDateString();
                const formatFecha = `${dd}/${mm}/${yyyy}`;
                
                const turnosCount = gruposConf[fecha].length;
                const turnosText = turnosCount === 1 ? '1 turno' : `${turnosCount} turnos`;

                let htmlDia = `
                    <div id="dia-${fecha}" class="mb-8 scroll-mt-24">
                        <h3 class="font-bold text-slate-800 mb-4 flex items-center gap-2 ${esHoy ? 'text-primary' : ''}">
                            <span class="material-symbols-outlined text-[20px]">${esHoy ? 'today' : 'event'}</span> 
                            ${esHoy ? 'Hoy, ' + formatFecha : formatFecha}
                            <span class="text-[11px] font-bold px-2 py-0.5 rounded-md ml-1 border border-slate-200" style="background:#f1f5f9;color:#64748b;">${turnosText}</span>
                        </h3>
                        <div class="space-y-3">
                `;
                
                // Agrupar los turnos del día por horario, servicio y profesional para visualizar clases con múltiples alumnos
                const slotsDelDia = {};
                gruposConf[fecha].forEach(t => {
                    const servKey = (t.id_servicio && parseInt(t.id_servicio) > 0) ? ('s_' + t.id_servicio) : (t.servicio || '').trim().toLowerCase();
                    const horaKey = (t.hora || '').substring(0, 5);
                    const profKey = (t.profesional || 'c').trim().toLowerCase();
                    const slotId = 'slot_' + fecha.replace(/-/g, '') + '_' + servKey.replace(/[^a-zA-Z0-9_]/g, '') + '_' + horaKey.replace(':', '') + '_' + profKey.replace(/[^a-zA-Z0-9_]/g, '');

                    if (!slotsDelDia[slotId]) {
                        // Buscar cupo_maximo del servicio
                        let cupoMax = parseInt(t.cupo_maximo || 0);
                        if ((!cupoMax || cupoMax <= 0) && window.services && Array.isArray(window.services)) {
                            const foundS = window.services.find(s => s.id == t.id_servicio || (s.nombre && s.nombre.trim().toLowerCase() === (t.servicio || '').trim().toLowerCase()));
                            if (foundS) cupoMax = parseInt(foundS.cupo_maximo || foundS.capacidad || 10);
                        }
                        if (!cupoMax || cupoMax <= 0) cupoMax = 10;

                        slotsDelDia[slotId] = {
                            id: slotId,
                            fecha: fecha,
                            formatFecha: formatFecha,
                            servicio: t.servicio,
                            hora: horaKey,
                            profesional: t.profesional,
                            cupo_maximo: cupoMax,
                            icono: t.servicio_icono || 'fitness_center',
                            imagen: t.servicio_imagen || '',
                            turnos: []
                        };
                    }
                    slotsDelDia[slotId].turnos.push(t);
                });

                // Guardar slots globalmente para uso en modalDetalleClase
                if (!window.agendaSlotsMap) window.agendaSlotsMap = {};

                Object.values(slotsDelDia).forEach(slot => {
                    window.agendaSlotsMap[slot.id] = slot;
                    const totalAlumnos = slot.turnos.length;
                    const cupoMax = slot.cupo_maximo || 10;
                    const cupoRatio = `${totalAlumnos}/${cupoMax}`;
                    const pctOcupado = Math.min(100, Math.round((totalAlumnos / cupoMax) * 100));
                    const isFull = totalAlumnos >= cupoMax;

                    if (slot.turnos.length > 1 || slot.turnos[0].metodo_pago === 'Pase de Alumno') {
                        // TARJETA DE CLASE (Grupal o con reserva de pase)
                        // Mostrar los últimos 3 inscriptos
                        const ultimos3 = [...slot.turnos].slice(-3);
                        const restantes = totalAlumnos - ultimos3.length;

                        let alumnosHtml = ultimos3.map(t => {
                            const isAttended = parseInt(t.asistio) === 1 || t.asistio === 'si' || t.asistio === true || t.estado === 'atendido' || t.estado === 'asistio';
                            const asistBtn = isAttended
                                ? `<button onclick="event.stopPropagation(); window.toggleAsistenciaTurno('${t.id}', 0)" class="text-xs font-extrabold px-2.5 py-1 rounded-lg border border-emerald-300 bg-emerald-100 text-emerald-800 hover:bg-emerald-200 transition-all flex items-center gap-1 shrink-0" title="Asistencia confirmada. Click para desmarcar"><span class="material-symbols-outlined text-[14px]">check_circle</span> Asistió</button>`
                                : `<button onclick="event.stopPropagation(); window.toggleAsistenciaTurno('${t.id}', 1)" class="text-xs font-extrabold px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 transition-all flex items-center gap-1 shrink-0" title="Marcar si asistió al turno"><span class="material-symbols-outlined text-[14px]">how_to_reg</span> ¿Asistió?</button>`;
                            
                            const alumnoNombre = t.cliente_nombre || (t.nombre + ' ' + (t.apellido || '')) || 'Alumno';
                            const alumnoTel = t.cliente_celular || t.celular || '';

                            return `
                                <div id="turno-${t.id}" class="p-2.5 bg-slate-50/90 border border-slate-200/80 rounded-xl flex items-center justify-between gap-2 hover:bg-white hover:shadow-xs transition-all">
                                    <div class="flex items-center gap-2.5 min-w-0">
                                        <div class="w-7 h-7 rounded-full bg-purple-100 text-purple-700 font-black text-xs flex items-center justify-center shrink-0">
                                            ${alumnoNombre.charAt(0).toUpperCase()}
                                        </div>
                                        <div class="min-w-0">
                                            <span class="text-xs font-black text-slate-800 truncate block">${alumnoNombre}</span>
                                            <span class="text-[10px] text-slate-500 flex items-center gap-1.5">
                                                ${alumnoTel ? `<span>📱 ${alumnoTel}</span>` : ''}
                                                ${t.metodo_pago ? `<span class="bg-purple-100 text-purple-700 font-bold px-1.5 py-0.2 rounded">${t.metodo_pago}</span>` : ''}
                                            </span>
                                        </div>
                                    </div>
                                    <div class="flex items-center gap-1 shrink-0">
                                        ${asistBtn}
                                        <button onclick="event.stopPropagation(); window.contactarWhatsApp('${t.id}')" class="text-emerald-600 bg-emerald-50 hover:bg-emerald-100 p-1 rounded-lg border border-emerald-200 transition-colors" title="WhatsApp"><span class="material-symbols-outlined text-[15px]">chat</span></button>
                                    </div>
                                </div>
                            `;
                        }).join('');

                        htmlDia += `
                            <div id="slotcard-${slot.id}" onclick="window.openClassDetailModal('${slot.id}')" class="bg-white border-2 border-purple-200 hover:border-purple-400 shadow-sm rounded-2xl p-4 sm:p-5 hover:shadow-xl cursor-pointer transition-all relative overflow-hidden space-y-3 mb-4 group">
                                <div class="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-purple-500 to-indigo-600"></div>
                                <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                                    <div class="flex items-center gap-2">
                                        <span class="text-xs font-black px-3 py-1 rounded-xl bg-purple-100 text-purple-900 border border-purple-200 flex items-center gap-1">
                                            <span class="material-symbols-outlined text-[15px]">schedule</span> ${slot.hora} hs
                                        </span>
                                        <!-- BADGE DE CANTIDAD RESERVADA X/Y -->
                                        <span class="text-xs font-black px-3 py-1 rounded-xl flex items-center gap-1.5 shadow-2xs ${isFull ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white'}">
                                            <span class="material-symbols-outlined text-[15px]">groups</span>
                                            <span>${cupoRatio} ${isFull ? 'Completo' : 'Inscriptos'}</span>
                                        </span>
                                    </div>
                                    <div class="flex items-center gap-2">
                                        ${slot.profesional && slot.profesional !== 'Cualquiera (Sin preferencia)' ? `<span class="px-2.5 py-1 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 flex items-center gap-1"><span class="material-symbols-outlined text-[13px]">person</span> ${slot.profesional}</span>` : ''}
                                        <span class="text-purple-600 group-hover:translate-x-0.5 transition-transform material-symbols-outlined text-[20px]" title="Ver detalles y todos los inscriptos">open_in_new</span>
                                    </div>
                                </div>
                                <div>
                                    <h4 class="font-black text-slate-900 text-base sm:text-lg flex items-center gap-2">
                                        <span class="material-symbols-outlined text-purple-600 text-[20px]">${slot.icono || 'fitness_center'}</span>
                                        <span>${slot.servicio}</span>
                                    </h4>
                                    <p class="text-[11px] font-bold text-slate-400 mt-0.5 flex items-center justify-between">
                                        <span>Últimos registrados (${ultimos3.length} de ${totalAlumnos})</span>
                                        <span class="text-purple-600 font-extrabold text-[11px] group-hover:underline">Click para ver todos</span>
                                    </p>
                                </div>
                                <!-- CONTENEDOR CON BARRA DESPLAZADORA -->
                                <div class="max-h-48 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                                    ${alumnosHtml}
                                </div>
                                ${restantes > 0 ? `
                                    <div class="pt-1 text-center">
                                        <span class="text-xs font-black text-purple-700 bg-purple-50 border border-purple-200/80 px-3 py-1 rounded-xl inline-flex items-center gap-1">
                                            <span class="material-symbols-outlined text-[14px]">more_horiz</span> +${restantes} alumno(s) más inscripto(s) en esta clase
                                        </span>
                                    </div>
                                ` : ''}
                            </div>
                        `;
                    } else {
                        // TARJETA DE TURNO INDIVIDUAL (1 alumno con turno simple)
                        const t = slot.turnos[0];
                        const isAttended = parseInt(t.asistio) === 1 || t.asistio === 'si' || t.asistio === true || t.estado === 'atendido' || t.estado === 'asistio';
                        const asistBtn = isAttended
                            ? `<button onclick="event.stopPropagation(); window.toggleAsistenciaTurno('${t.id}', 0)" class="text-xs font-extrabold px-3 py-1 rounded-lg border border-emerald-300 bg-emerald-100 text-emerald-800 hover:bg-emerald-200 transition-all flex items-center gap-1 shadow-xs" title="Asistencia confirmada. Click para desmarcar"><span class="material-symbols-outlined text-[15px]">check_circle</span> Asistió</button>`
                            : `<button onclick="event.stopPropagation(); window.toggleAsistenciaTurno('${t.id}', 1)" class="text-xs font-extrabold px-3 py-1 rounded-lg border border-slate-200 bg-slate-50 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 transition-all flex items-center gap-1 shadow-xs" title="Marcar si asistió al turno"><span class="material-symbols-outlined text-[15px]">how_to_reg</span> ¿Asistió?</button>`;

                        htmlDia += `
                            <div id="turno-${t.id}" onclick="if(!event.target.closest('button')) window.openClassDetailModal('${slot.id}')" class="shadow-sm rounded-2xl p-5 hover:shadow-lg cursor-pointer transition-shadow relative overflow-hidden" style="background-color: #ffffff; border: 1px solid #e2e8f0;">
                                <div class="absolute top-0 left-0 w-1.5 h-full bg-blue-500"></div>
                                <div class="flex justify-between items-start mb-3">
                                    <div class="flex items-center gap-2">
                                        <span class="text-xs font-bold px-3 py-1 rounded-lg uppercase tracking-wider" style="background-color: #eff6ff; color: #1d4ed8;">${t.hora} hs</span>
                                        <span class="text-xs font-bold px-2.5 py-0.5 rounded-lg bg-slate-100 text-slate-700 border border-slate-200">1/${cupoMax} cupos</span>
                                    </div>
                                    <div class="flex items-center gap-2">
                                        ${asistBtn}
                                        ${t.profesional && t.profesional !== 'Cualquiera (Sin preferencia)' ? `<span class="px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1" style="background-color: #f1f5f9; color: #475569;"><span class="material-symbols-outlined text-[14px]">person</span> ${t.profesional}</span>` : ''}
                                    </div>
                                </div>
                                <p class="text-lg font-bold mb-1" style="color: #1e293b;">${t.cliente_nombre || (t.nombre + ' ' + (t.apellido || ''))}</p>
                                <div class="flex items-center gap-3 mb-4">
                                    <p class="text-sm font-medium flex items-center gap-1.5 px-3 py-1.5 rounded-lg border" style="color: #475569; background-color: #f8fafc; border-color: #e2e8f0;"><span class="material-symbols-outlined text-[16px]">call</span> ${t.cliente_celular || t.celular}</p>
                                    <button onclick="window.contactarWhatsApp('${t.id}')" class="text-emerald-600 bg-emerald-50 hover:bg-emerald-100 p-1.5 rounded-lg transition-colors flex items-center justify-center border border-emerald-100" title="Enviar WhatsApp"><span class="material-symbols-outlined text-[18px]">chat</span></button>
                                </div>
                                ${t.metodo_pago ? `<p class="text-sm mb-1 flex items-center gap-2" style="color: #475569;"><span class="material-symbols-outlined text-[18px] text-slate-500">payments</span> <span class="font-medium">${t.metodo_pago}</span></p>` : ''}
                                <p class="text-sm mb-5 flex items-center gap-2" style="color: #475569;"><span class="material-symbols-outlined text-[18px] text-slate-500">spa</span> <span class="font-medium">${t.servicio}</span></p>
                                <div class="flex items-center gap-3 pt-4 border-t" style="border-color: #e2e8f0;">
                                    <button onclick="window.recordatorioWhatsApp('${t.id}')" class="flex-1 text-sm font-bold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-1 border" style="background-color: #eff6ff; color: #1d4ed8; border-color: #bfdbfe;" title="Enviar recordatorio">
                                        <span class="material-symbols-outlined text-[18px]">notifications_active</span> Recordar
                                    </button>
                                    <button onclick="window.cancelarTurnoAdmin('${t.id}')" class="bg-red-50 hover:bg-red-100 text-red-600 text-sm font-bold py-2.5 px-4 rounded-xl transition-colors flex items-center justify-center border border-red-100" title="Eliminar turno">
                                        <span class="material-symbols-outlined text-[18px]">delete</span>
                                    </button>
                                </div>
                            </div>
                        `;
                    }
                });
                
                htmlDia += `</div></div>`;
                listConf.innerHTML += htmlDia;
            });
        }
    }

    // DIBUJAR HISTORIAL (PASADOS)
    const listHist = document.getElementById('lista-historial');
    if (listHist) {
        listHist.innerHTML = '';
        if (pasados.length === 0) {
            listHist.innerHTML = `<div class="p-8 text-center text-sm font-medium text-slate-400 rounded-xl border border-slate-200" style="background:#f8fafc;">${searchTerm ? 'No se encontraron resultados de la búsqueda' : 'El historial está vacío.'}</div>`;
        } else {
            const pasadosToShow = pasados.slice(0, window.historyLimit);
            const hasMore = pasados.length > window.historyLimit;

            const gruposHist = {};
            pasadosToShow.forEach(t => {
                if (!gruposHist[t.fecha]) gruposHist[t.fecha] = [];
                gruposHist[t.fecha].push(t);
            });

            const fechasHist = Object.keys(gruposHist).sort((a, b) => b.localeCompare(a));
            let globalHistIndex = 0;
            fechasHist.forEach(fecha => {
                const [yyyy, mm, dd] = fecha.split('-');
                const formatFecha = `${dd}/${mm}/${yyyy}`;
                
                const turnosCount = gruposHist[fecha].length;
                const turnosText = turnosCount === 1 ? '1 turno' : `${turnosCount} turnos`;

                let htmlDia = `
                    <div class="mb-8">
                        <h3 class="font-bold text-slate-800 mb-4 flex items-center gap-2 opacity-80">
                            <span class="material-symbols-outlined text-[20px]">history</span> 
                            ${formatFecha}
                            <span class="text-[11px] font-bold px-2 py-0.5 rounded-md ml-1 border border-slate-200" style="background:#f1f5f9;color:#64748b;">${turnosText}</span>
                        </h3>
                        <div class="space-y-3">
                `;
                
                gruposHist[fecha].forEach(t => {
                    globalHistIndex++;
                    const isNewLoaded = window.isLoadingMoreHistory && globalHistIndex > (window.historyLimit - 15);
                    const animClass = isNewLoaded ? 'animate-new-item' : '';
                    const customStyle = isNewLoaded ? 'opacity: 0;' : 'opacity: 0.85;';
                    const isAttended = parseInt(t.asistio) === 1 || t.asistio === 'si' || t.asistio === true || t.estado === 'atendido' || t.estado === 'asistio';
                    const asistBtn = isAttended
                        ? `<button onclick="event.stopPropagation(); window.toggleAsistenciaTurno('${t.id}', 0)" class="text-xs font-black px-3 py-1 rounded-lg border border-emerald-300 bg-emerald-100 text-emerald-800 hover:bg-emerald-200 transition-all flex items-center gap-1 shadow-xs" title="Asistencia confirmada. Click para desmarcar"><span class="material-symbols-outlined text-[15px]">check_circle</span> Asistió</button>`
                        : `<button onclick="event.stopPropagation(); window.toggleAsistenciaTurno('${t.id}', 1)" class="text-xs font-black px-3 py-1 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 transition-all flex items-center gap-1 shadow-xs" title="Marcar si asistió al turno"><span class="material-symbols-outlined text-[15px]">how_to_reg</span> ¿Asistió?</button>`;

                    htmlDia += `
                        <div id="turno-${t.id}" onclick="if(!event.target.closest('button')) window.openEditTurnoModal('${t.id}')" class="shadow-sm rounded-2xl p-5 hover:shadow-lg cursor-pointer transition-all relative overflow-hidden ${animClass}" style="background-color: #ffffff; border: 1px solid #e2e8f0; --target-opacity: 0.85; ${customStyle}">
                            <div class="absolute top-0 left-0 w-1.5 h-full bg-slate-400"></div>
                            <div class="flex justify-between items-start mb-3">
                                <span class="text-xs font-bold px-3 py-1 rounded-lg uppercase tracking-wider" style="background-color: #f1f5f9; color: #475569;">${t.hora} hs</span>
                                <div class="flex items-center gap-2">
                                    ${asistBtn}
                                    ${t.profesional && t.profesional !== 'Cualquiera (Sin preferencia)' ? `<span class="px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1" style="background-color: #f1f5f9; color: #475569;"><span class="material-symbols-outlined text-[14px]">person</span> ${t.profesional}</span>` : ''}
                                </div>
                            </div>
                            <p class="text-lg font-bold mb-1" style="color: #1e293b;">${t.cliente_nombre || (t.nombre + ' ' + (t.apellido || ''))}</p>
                            <div class="flex items-center gap-3 mb-3">
                                <p class="text-sm font-medium flex items-center gap-1.5 px-3 py-1.5 rounded-lg border" style="color: #475569; background-color: #f8fafc; border-color: #e2e8f0;"><span class="material-symbols-outlined text-[16px]">call</span> ${t.cliente_celular || t.celular || 'Sin celular'}</p>
                                <button onclick="window.contactarWhatsApp('${t.id}')" class="text-emerald-600 bg-emerald-50 hover:bg-emerald-100 p-1.5 rounded-lg transition-colors flex items-center justify-center border border-emerald-100" title="Enviar WhatsApp"><span class="material-symbols-outlined text-[18px]">chat</span></button>
                            </div>
                            ${t.metodo_pago ? `<p class="text-sm mb-1 flex items-center gap-2" style="color: #475569;"><span class="material-symbols-outlined text-[18px] text-slate-500">payments</span> <span class="font-medium">${t.metodo_pago}</span></p>` : ''}
                            <p class="text-sm mb-4 flex items-center gap-2" style="color: #475569;"><span class="material-symbols-outlined text-[18px] text-slate-500">spa</span> <span class="font-medium">${t.servicio}</span></p>
                            <div class="flex items-center gap-3 pt-3 border-t" style="border-color: #e2e8f0;">
                                <button onclick="window.cancelarTurnoAdmin('${t.id}')" class="bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold py-2 px-3 rounded-xl transition-colors flex items-center justify-center border border-red-100 gap-1" title="Eliminar turno">
                                    <span class="material-symbols-outlined text-[16px]">delete</span> Eliminar
                                </button>
                            </div>
                        </div>
                    `;
                });
                
                htmlDia += `</div></div>`;
                listHist.innerHTML += htmlDia;
            });
            
            if (hasMore) {
                listHist.innerHTML += `
                    <div class="mt-2 mb-6 flex justify-center">
                        <button id="btnLoadMoreHistory" onclick="window.loadMoreHistory()" class="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-bold rounded-xl transition-colors border border-slate-200 flex items-center gap-2 shadow-sm">
                            <span class="material-symbols-outlined text-[18px]">expand_more</span> Cargar más turnos
                        </button>
                    </div>
                `;
            }
        }
    }

    // DIBUJAR ELIMINADOS (PAPELERA)
    const listElim = document.getElementById('lista-eliminados');
    if (listElim) {
        const trashDot = document.getElementById('trashBadgeDot');
        if (trashDot) {
            const hasDeleted = (Array.isArray(data) ? data : []).some(t => t.estado === 'eliminado' || t.estado === 'cancelado');
            const isUnread = localStorage.getItem('agendatina_unread_trash') !== 'false';
            if (hasDeleted && isUnread && window.activeAgendaTab !== 'papelera') {
                trashDot.classList.remove('hidden');
            } else if (window.activeAgendaTab === 'papelera') {
                trashDot.classList.add('hidden');
                localStorage.setItem('agendatina_unread_trash', 'false');
            }
        }
        listElim.innerHTML = '';
        
        // Determinar mensaje de límite de auto-eliminación
        let autoDeleteInfo = '';
        const limitDays = window.configData && window.configData.limite_eliminacion_dias !== undefined ? parseInt(window.configData.limite_eliminacion_dias) : 0;
        if (limitDays > 0) {
            autoDeleteInfo = `Los turnos en la papelera se eliminarán automáticamente después de <strong>${limitDays} días</strong>.`;
        } else {
            autoDeleteInfo = `Los turnos eliminados no se borrarán automáticamente.`;
        }

        // Agregar banner informativo al inicio de la papelera
        listElim.innerHTML += `
            <div class="p-4 mb-4 text-slate-600 rounded-2xl border border-slate-200 flex items-start gap-3 text-xs sm:text-sm" style="background-color: #f8fafc;">
                <span class="material-symbols-outlined text-slate-400 text-[20px] shrink-0 mt-0.5">info</span>
                <div>
                    <p class="font-medium text-slate-700 mb-1">${autoDeleteInfo}</p>
                    <p class="text-slate-400 text-[11px] sm:text-xs">Si lo deseas, también puedes borrarlos de forma definitiva de manera manual usando el botón de eliminar por completo.</p>
                </div>
            </div>
        `;

        if (eliminados.length === 0) {
            listElim.innerHTML += `<div class="p-8 text-center text-sm font-medium text-slate-400 rounded-xl border border-slate-200" style="background:#ffffff;">${searchTerm ? 'No se encontraron resultados de la búsqueda' : 'No hay turnos borrados.'}</div>`;
        } else {
            eliminados.sort((a, b) => new Date(b.fecha_eliminado || 0) - new Date(a.fecha_eliminado || 0));
            
            const eliminadosToShow = eliminados.slice(0, window.trashLimit);
            const hasMoreEliminados = eliminados.length > window.trashLimit;
            let globalTrashIndex = 0;
            
            eliminadosToShow.forEach(t => {
                globalTrashIndex++;
                const isNewLoaded = window.isLoadingMoreTrash && globalTrashIndex > (window.trashLimit - 15);
                const animClass = isNewLoaded ? 'animate-new-item' : '';
                const opacityClass = isNewLoaded ? 'opacity-0' : 'opacity-70';
                
                const fParts = t.fecha.split('-');
                const fDisplay = fParts.length === 3 ? `${fParts[2]}/${fParts[1]}` : t.fecha;
                listElim.innerHTML += `
                        <div class="rounded-2xl p-3.5 flex flex-col gap-2.5 ${opacityClass} hover:opacity-100 hover:shadow-md hover:-translate-y-0.5 transition-all mb-3 relative overflow-hidden ${animClass}" style="--target-opacity: 0.7; background-color: #ffffff; border: 1px solid #e2e8f0;">
                            <div class="absolute top-0 left-0 w-1.5 h-full bg-slate-400 opacity-60"></div>
                            <div class="flex justify-between items-start">
                                <div class="flex-1 min-w-0">
                                    <span class="text-[11px] font-bold px-2.5 py-1 rounded-lg inline-flex mb-2 uppercase tracking-wide border items-center gap-1 shadow-2xs" style="background-color: #f1f5f9; color: #475569; border-color: #e2e8f0;">
                                        <span class="material-symbols-outlined text-[14px]">schedule</span> ${fDisplay} • ${t.hora} hs
                                    </span>
                                    <p class="text-base sm:text-lg font-extrabold mb-1.5 leading-tight tracking-tight line-through opacity-70" style="color: #1e293b;">${t.cliente_nombre || (t.nombre + ' ' + (t.apellido || ''))}</p>
                                    <div class="p-2 rounded-xl" style="background-color: #f8fafc;">
                                        <p class="text-xs font-semibold flex items-center gap-2" style="color: #475569;"><span class="material-symbols-outlined text-[16px] opacity-70">spa</span> <span class="break-words">${t.servicio}</span></p>
                                    </div>
                                </div>
                            </div>
                            <div class="flex flex-col sm:flex-row gap-2 mt-1 w-full border-t pt-2.5" style="border-color: #f1f5f9;">
                                <button onclick="window.restaurarTurnoAdmin('${t.id}')" class="w-full sm:flex-1 bg-green-50 hover:bg-green-100 text-green-700 text-xs font-bold py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1 border border-green-200 shadow-2xs">
                                    <span class="material-symbols-outlined text-[16px]">restore_from_trash</span> Restaurar
                                </button>
                                <button onclick="window.eliminarTurnoPermanente('${t.id}')" class="w-full sm:flex-none bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1 border border-red-200 shadow-2xs" title="Eliminar definitivamente">
                                    <span class="material-symbols-outlined text-[16px]">delete_forever</span> <span class="sm:hidden">Eliminar definitivo</span>
                                </button>
                            </div>
                        </div>
                `;
            });
            
            if (hasMoreEliminados) {
                listElim.innerHTML += `
                    <div class="mt-2 mb-6 flex justify-center">
                        <button id="btnLoadMoreTrash" onclick="window.loadMoreTrash()" class="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-bold rounded-xl transition-colors border border-slate-200 flex items-center gap-2 shadow-sm">
                            <span class="material-symbols-outlined text-[18px]">expand_more</span> Cargar más turnos eliminados
                        </button>
                    </div>
                `;
            }
        }
    }
    // Al finalizar el render, restaurar el tab activo que el usuario tenía seleccionado
    const savedTab = window.activeAgendaTab || 'proximos';
    if (typeof window.switchAgendaTab === 'function') {
        window.switchAgendaTab(savedTab);
    }
};

window.setAgendaProfFilter = function(profName) {
    window.currentAgendaProfTerm = profName;
    const tabsContainer = document.getElementById('profesionalesAgendaTabs');
    if (tabsContainer) tabsContainer.dataset.profs = '';
    window.renderAgendaTurnos(window.agendaData, document.getElementById('agendaSearchInput')?.value || '', profName);
};

// Delegación centralizada a script.js para evitar toasts duplicados
window.cancelarTurnoAdmin = function(id) {
    if (typeof window.cancelarTurnoAdminGlobal === 'function') {
        window.cancelarTurnoAdminGlobal(id);
    } else {
        const doCancel = () => {
            return fetch('backend/cancelar_turno.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({ id: id })
            })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    if (typeof showToast === 'function') showToast('Turno movido a la Papelera', 'success');
                    if (typeof window.cargarAgenda === 'function') window.cargarAgenda(true);
                    if (typeof window.refreshCalendarData === 'function') window.refreshCalendarData();
                } else {
                    if (typeof showToast === 'function') showToast(data.error || 'Error al mover a papelera.', 'error');
                }
            })
            .catch(() => { if (typeof showToast === 'function') showToast('Error de conexión', 'error'); });
        };
        if (typeof showConfirm === 'function') {
            showConfirm('Cancelar Turno', '¿Seguro que deseas cancelar y enviar este turno a la papelera?', 'Sí, Cancelar', 'bg-red-600 hover:bg-red-700', doCancel);
        } else if (confirm('¿Seguro que deseas mover este turno a la Papelera?')) {
            doCancel();
        }
    }
};

window.confirmarTurnoAdmin = function(id) {
    if (typeof showConfirm === 'function') {
        showConfirm('Confirmar Turno', '¿Agendar y confirmar este turno? Aparecerá como reservado en tu calendario.', 'Confirmar', 'bg-amber-500 hover:bg-amber-600', () => {
            return fetch('backend/confirmar_turno.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({ id: id })
            })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    if (typeof showToast === 'function') showToast('Turno confirmado exitosamente y agendado', 'success');
                    window.cargarAgenda(true);
                    if (typeof window.refreshCalendarData === 'function') window.refreshCalendarData();
                } else {
                    if (typeof showToast === 'function') showToast(data.error || 'No se pudo confirmar el turno.', 'error');
                }
            })
            .catch(() => {
                if (typeof showToast === 'function') showToast('Error de conexión', 'error');
            });
        });
    } else {
        fetch('backend/confirmar_turno.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ id: id })
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                if (typeof showToast === 'function') showToast('Turno confirmado exitosamente', 'success');
                window.cargarAgenda(true);
            }
        });
    }
};

window.restaurarTurnoAdmin = function(id) {
    if (typeof showConfirm === 'function') {
        showConfirm('Restaurar Turno', '¿Deseas restaurar este turno y devolverlo a la agenda?', 'Restaurar', 'bg-green-600 hover:bg-green-700', () => {
            return fetch('backend/gestionar_papelera.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'restore', id: id })
            })
            .then(res => res.json())
            .then(data => {
                if(data.success) {
                    if(typeof showToast === 'function') showToast('Turno restaurado exitosamente', 'success');
                    if (typeof window.cargarAgenda === 'function') window.cargarAgenda(true);
                    if (typeof window.refreshCalendarData === 'function') window.refreshCalendarData();
                    if (typeof window.openPapeleraModal === 'function') window.openPapeleraModal();
                } else {
                    if(typeof showToast === 'function') showToast(data.error || 'Error al restaurar.', 'error');
                }
            }).catch(() => { if(typeof showToast === 'function') showToast('Error de conexión', 'error'); });
        });
    }
};

window.eliminarTurnoPermanente = function(id) {
    if (typeof showConfirm === 'function') {
        showConfirm('Eliminar Permanente', '¿Seguro que deseas eliminar este turno definitivamente? Esta acción no se puede deshacer.', 'Eliminar', 'bg-red-600 hover:bg-red-700', () => {
            return fetch('backend/gestionar_papelera.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'delete_permanent', id: id })
            })
            .then(res => res.json())
            .then(data => {
                if(data.success) {
                    if(typeof showToast === 'function') showToast('Turno eliminado permanentemente', 'success');
                    if (typeof window.cargarAgenda === 'function') window.cargarAgenda(true);
                    if (typeof window.refreshCalendarData === 'function') window.refreshCalendarData();
                    if (typeof window.openPapeleraModal === 'function') window.openPapeleraModal();
                } else {
                    if(typeof showToast === 'function') showToast(data.error || 'Error al eliminar.', 'error');
                }
            }).catch(() => { if(typeof showToast === 'function') showToast('Error de conexión', 'error'); });
        });
    }
};

window.vaciarPapeleraCompletamente = function() {
    if (confirm('¿Seguro que deseas vaciar la Papelera por completo? Se eliminarán permanentemente todos los turnos cancelados o borrados.')) {
        fetch('backend/gestionar_papelera.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'empty_trash' })
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                if (typeof showToast === 'function') showToast('Papelera vaciada por completo', 'success');
                window.closePapeleraModal();
                if (typeof window.cargarAgenda === 'function') window.cargarAgenda(true);
                if (typeof window.refreshCalendarData === 'function') window.refreshCalendarData();
            }
        });
    }
};

window.openPapeleraModal = function() {
    const modal = document.getElementById('papeleraModal');
    if (!modal) return;
    modal.classList.remove('hidden');
    const container = document.getElementById('papeleraList');
    if (container) container.innerHTML = '<p class="text-center text-slate-400 py-8 text-sm">Cargando papelera...</p>';

    fetch('backend/gestionar_papelera.php')
        .then(res => res.json())
        .then(data => {
            if (data.success && Array.isArray(data.data)) {
                renderPapeleraModalList(data.data);
            } else {
                if (container) container.innerHTML = '<p class="text-center text-red-500 py-8 text-sm">Error al cargar la papelera.</p>';
            }
        });
};

window.closePapeleraModal = function() {
    const modal = document.getElementById('papeleraModal');
    if (modal) modal.classList.add('hidden');
};

function renderPapeleraModalList(list) {
    const container = document.getElementById('papeleraList');
    if (!container) return;
    if (list.length === 0) {
        container.innerHTML = '<div class="p-8 text-center text-sm font-medium text-slate-400 rounded-2xl bg-slate-50 border border-slate-200">No hay turnos en la papelera.</div>';
        return;
    }

    let html = '';
    list.forEach(t => {
        const clienteName = t.cliente_nombre || (t.nombre + ' ' + (t.apellido || ''));
        const celular = t.cliente_celular || t.celular || '';
        const fElim = t.fecha_eliminado ? new Date(t.fecha_eliminado).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }) : 'Reciente';

        html += `
            <div class="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:border-slate-300 transition-all">
                <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 mb-1">
                        <span class="bg-red-100 text-red-700 text-[10px] font-bold px-2 py-0.5 rounded uppercase">${t.estado}</span>
                        <span class="text-[11px] text-slate-400 font-medium">Movido: ${fElim}</span>
                    </div>
                    <h4 class="font-bold text-slate-900 text-sm sm:text-base line-through opacity-80">${clienteName}</h4>
                    <p class="text-[11px] text-slate-500 font-medium mt-0.5 flex flex-wrap items-center gap-2">
                        <span>📅 ${t.fecha} • ${t.hora} hs</span>
                        <span>✂️ ${t.servicio}</span>
                        ${celular ? `<span>📱 ${celular}</span>` : ''}
                    </p>
                </div>
                <div class="flex items-center gap-2 w-full sm:w-auto">
                    <button onclick="window.restaurarTurnoAdmin(${t.id})" class="flex-1 sm:flex-none px-3 py-1.5 bg-green-50 hover:bg-green-100 text-green-700 font-bold rounded-lg text-xs border border-green-200 transition-all flex items-center justify-center gap-1">
                        <span class="material-symbols-outlined text-[15px]">restore</span> Restaurar
                    </button>
                    <button onclick="window.eliminarTurnoPermanente(${t.id})" class="flex-1 sm:flex-none px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 font-bold rounded-lg text-xs border border-red-200 transition-all flex items-center justify-center gap-1" title="Eliminar permanentemente">
                        <span class="material-symbols-outlined text-[15px]">delete_forever</span> Borrar
                    </button>
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
}

document.addEventListener('DOMContentLoaded', () => {
    // ---- Lógica para agenda.html ----
    if (document.getElementById('lista-pendientes')) {
        window.cargarAgenda();

        // Verificar si es usuario demo y ocultar botón de reportar error
        // Siempre verificar con el backend para evitar cache obsoleto
        const btnReport = document.getElementById('btnReportarErrorAgenda');
        if (btnReport) {
            if (sessionStorage.getItem('is_demo_user') === 'true') {
                btnReport.style.display = 'none';
            }
            fetch('backend/perfil.php')
                .then(r => r.json())
                .then(d => {
                    if (!d || !d.success || !d.business) {
                        const errReason = (d && d.error) ? d.error : 'Sin respuesta válida de sesión en agenda';
                        console.error('⚠️ [Error de Carga - Agenda] No se pudo volver a cargar la sesión. Motivo:', errReason);
                        window.location.href = 'login.html';
                        return;
                    }
                    const isDemo = d.success && d.user && d.user.email && d.user.email.includes('demo');
                    if (isDemo) {
                        btnReport.style.display = 'none';
                        sessionStorage.setItem('is_demo_user', 'true');
                    } else {
                        sessionStorage.removeItem('is_demo_user');
                    }
                }).catch(err => {
                    console.error('⚠️ [Error de Carga - Agenda] Desconexión de red o fallo al volver a cargar información:', err);
                    window.location.href = 'login.html';
                });
        }
    }
});

window.loadMoreHistory = function() {
    const btn = document.getElementById('btnLoadMoreHistory');
    if (btn) {
        btn.innerHTML = `<span class="material-symbols-outlined text-[18px] animate-spin">refresh</span> Cargando...`;
        btn.classList.add('pointer-events-none', 'opacity-70');
    }
    
    window.isLoadingMoreHistory = true;
    
    setTimeout(() => {
        window.historyLimit += 15;
        const currentSearch = document.getElementById('agendaSearchInput') ? document.getElementById('agendaSearchInput').value : '';
        if (window.agendaData) {
            window.renderAgendaTurnos(window.agendaData, currentSearch);
        }
        setTimeout(() => { window.isLoadingMoreHistory = false; }, 50);
    }, 500);
};

window.loadMoreTrash = function() {
    const btn = document.getElementById('btnLoadMoreTrash');
    if (btn) {
        btn.innerHTML = `<span class="material-symbols-outlined text-[18px] animate-spin">refresh</span> Cargando...`;
        btn.classList.add('pointer-events-none', 'opacity-70');
    }
    
    window.isLoadingMoreTrash = true;
    
    setTimeout(() => {
        window.trashLimit += 15;
        const currentSearch = document.getElementById('agendaSearchInput') ? document.getElementById('agendaSearchInput').value : '';
        if (window.agendaData) {
            window.renderAgendaTurnos(window.agendaData, currentSearch);
        }
        setTimeout(() => { window.isLoadingMoreTrash = false; }, 50);
    }, 500);
};

window.switchAgendaTab = function(tab) {
    // Guardar el tab activo para que renderAgendaTurnos pueda restaurarlo
    window.activeAgendaTab = tab;
    
    const tabs = {
        proximos: document.getElementById('tabProximos'),
        vencidos: document.getElementById('tabVencidos'),
        historial: document.getElementById('tabHistorial'),
        papelera: document.getElementById('tabPapelera'),
    };
    const panels = {
        proximos: document.getElementById('lista-confirmados'),
        vencidos: document.getElementById('lista-vencidos'),
        historial: document.getElementById('lista-historial'),
        papelera: document.getElementById('lista-eliminados'),
    };

    const activeClass = 'text-primary bg-white border border-slate-200 border-b-white -mb-px';
    const inactiveClass = 'text-slate-400 hover:text-slate-600 border-transparent';

    Object.keys(tabs).forEach(key => {
        if (!tabs[key]) return;
        tabs[key].className = `flex-1 sm:flex-none sm:px-5 py-2.5 text-sm font-bold rounded-t-xl flex items-center justify-center gap-1.5 transition-all ${key === tab ? activeClass : inactiveClass}`;
    });

    Object.keys(panels).forEach(key => {
        if (!panels[key]) return;
        if (key === tab) panels[key].classList.remove('hidden');
        else panels[key].classList.add('hidden');
    });
};

window.descargarHistorialTurnos = function(btn) {
    const originalHtml = btn.innerHTML;
    btn.innerHTML = '<span class="material-symbols-outlined animate-spin text-[20px]">refresh</span>';
    btn.disabled = true;

    fetch('backend/obtener_agenda.php?historial=1')
    .then(res => res.json())
    .then(data => {
        if (!Array.isArray(data) || data.length === 0) {
            if(typeof showToast === 'function') showToast('No hay turnos en el historial para exportar.', 'error');
            return;
        }
        const headers = ['ID', 'Fecha', 'Hora', 'Cliente', 'Celular', 'Servicio', 'Profesional', 'Estado'];
        const rows = data.map(t => {
            const nombreCliente = t.cliente_nombre || (t.nombre + ' ' + (t.apellido || ''));
            const celular = t.cliente_celular || t.celular || '';
            return [
                t.id, `"${t.fecha}"`, `"${t.hora}"`, `"${nombreCliente.replace(/"/g, '""')}"`,
                `"${celular}"`, `"${(t.servicio || '').replace(/"/g, '""')}"`,
                `"${(t.profesional || '').replace(/"/g, '""')}"`, `"${t.estado || ''}"`
            ].join(',');
        });
        const csvContent = [headers.join(','), ...rows].join('\n');
        const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const downloadUrl = URL.createObjectURL(blob);
        link.setAttribute("href", downloadUrl);
        link.setAttribute("download", `Historial_Turnos_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        if(typeof showToast === 'function') showToast('Historial descargado con éxito.', 'success');
    })
    .catch(err => { console.error(err); if(typeof showToast === 'function') showToast('Error al descargar el historial.', 'error'); })
    .finally(() => { btn.innerHTML = originalHtml; btn.disabled = false; });
};

// --- Modal Detalle de Clase Grupal / Horario ---
window.openClassDetailModal = function(slotId) {
    if (!window.agendaSlotsMap || !window.agendaSlotsMap[slotId]) {
        // Si no es un slot agrupado pero es un ID de turno individual, abrir modal de turno
        if (typeof window.openEditTurnoModal === 'function') {
            window.openEditTurnoModal(slotId);
        }
        return;
    }

    const slot = window.agendaSlotsMap[slotId];
    const modal = document.getElementById('modalDetalleClase');
    if (!modal) return;

    // Configurar encabezado
    const horaEl = document.getElementById('modalClaseHora');
    const fechaEl = document.getElementById('modalClaseFecha');
    const tituloEl = document.getElementById('modalClaseTitulo');
    const profEl = document.getElementById('modalClaseProfesor');
    const iconEl = document.getElementById('modalClaseIcon');
    const cuposBadge = document.getElementById('modalClaseCuposBadge');
    const totalInscriptos = document.getElementById('modalClaseTotalInscriptos');
    const progressBar = document.getElementById('modalClaseProgressBar');
    const listaAlumnos = document.getElementById('modalClaseListaAlumnos');

    if (horaEl) horaEl.textContent = `${slot.hora} hs`;
    if (fechaEl) fechaEl.textContent = slot.formatFecha || slot.fecha;
    if (tituloEl) tituloEl.textContent = slot.servicio;
    if (profEl) {
        const profName = slot.profesional && slot.profesional !== 'Cualquiera (Sin preferencia)' ? slot.profesional : 'Sin profesor asignado';
        profEl.innerHTML = `<span class="material-symbols-outlined text-[14px]">person</span> <span>${profName}</span>`;
    }
    if (iconEl) iconEl.textContent = slot.icono || 'fitness_center';

    const total = slot.turnos.length;
    const max = slot.cupo_maximo || 10;
    const pct = Math.min(100, Math.round((total / max) * 100));

    if (cuposBadge) {
        cuposBadge.innerHTML = `<span class="material-symbols-outlined text-[18px] text-purple-600">groups</span> ${total}/${max} cupos ocupados ${total >= max ? '<span class="text-xs bg-rose-100 text-rose-700 px-2 py-0.5 rounded-md font-bold ml-1">¡Clase Completa!</span>' : ''}`;
    }
    if (totalInscriptos) totalInscriptos.textContent = total;
    if (progressBar) {
        progressBar.style.width = `${pct}%`;
        if (pct >= 100) {
            progressBar.className = 'bg-rose-500 h-full rounded-full transition-all';
        } else if (pct >= 75) {
            progressBar.className = 'bg-amber-500 h-full rounded-full transition-all';
        } else {
            progressBar.className = 'bg-gradient-to-r from-purple-500 to-indigo-600 h-full rounded-full transition-all';
        }
    }

    if (listaAlumnos) {
        if (slot.turnos.length === 0) {
            listaAlumnos.innerHTML = `<p class="text-sm text-slate-400 text-center py-6">No hay alumnos inscriptos aún.</p>`;
        } else {
            listaAlumnos.innerHTML = slot.turnos.map(t => {
                const isAttended = parseInt(t.asistio) === 1 || t.asistio === 'si' || t.asistio === true || t.estado === 'atendido' || t.estado === 'asistio';
                const asistBtn = isAttended
                    ? `<button onclick="window.toggleAsistenciaTurno('${t.id}', 0); setTimeout(() => window.openClassDetailModal('${slotId}'), 400);" class="text-xs font-black px-3 py-1.5 rounded-xl border border-emerald-300 bg-emerald-100 text-emerald-800 hover:bg-emerald-200 transition-all flex items-center gap-1 shadow-xs" title="Asistencia confirmada. Click para desmarcar"><span class="material-symbols-outlined text-[15px]">check_circle</span> Asistió</button>`
                    : `<button onclick="window.toggleAsistenciaTurno('${t.id}', 1); setTimeout(() => window.openClassDetailModal('${slotId}'), 400);" class="text-xs font-black px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 transition-all flex items-center gap-1 shadow-xs" title="Marcar si asistió a la clase"><span class="material-symbols-outlined text-[15px]">how_to_reg</span> ¿Asistió?</button>`;

                const alumnoNombre = t.cliente_nombre || (t.nombre + ' ' + (t.apellido || '')) || 'Alumno';
                const alumnoTel = t.cliente_celular || t.celular || '';

                return `
                    <div id="modal-turno-${t.id}" class="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex flex-wrap items-center justify-between gap-3 hover:bg-white hover:border-purple-200 transition-all">
                        <div class="flex items-center gap-3 min-w-0">
                            <div class="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 font-black text-sm flex items-center justify-center shrink-0">
                                ${alumnoNombre.charAt(0).toUpperCase()}
                            </div>
                            <div class="min-w-0">
                                <strong class="text-sm font-black text-slate-800 truncate block">${alumnoNombre}</strong>
                                <div class="text-xs text-slate-500 flex flex-wrap items-center gap-2 mt-0.5">
                                    ${alumnoTel ? `<span class="flex items-center gap-0.5"><span class="material-symbols-outlined text-[13px]">call</span> ${alumnoTel}</span>` : ''}
                                    ${t.metodo_pago ? `<span class="bg-purple-100 text-purple-800 text-[10px] font-black px-2 py-0.5 rounded-md">${t.metodo_pago}</span>` : ''}
                                    ${t.creado_el ? `<span class="text-[10px] text-slate-400">Inscripto: ${t.creado_el.substring(0, 16)}</span>` : ''}
                                </div>
                            </div>
                        </div>
                        <div class="flex items-center gap-1.5 shrink-0">
                            ${asistBtn}
                            <button onclick="window.contactarWhatsApp('${t.id}')" class="text-emerald-600 bg-emerald-50 hover:bg-emerald-100 p-1.5 rounded-xl border border-emerald-200 transition-colors" title="Enviar WhatsApp"><span class="material-symbols-outlined text-[18px]">chat</span></button>
                            <button onclick="window.closeClassDetailModal(); window.openEditTurnoModal('${t.id}');" class="text-slate-500 hover:text-slate-800 p-1.5 rounded-xl hover:bg-slate-100 transition-colors" title="Editar turno"><span class="material-symbols-outlined text-[18px]">edit</span></button>
                            <button onclick="window.cancelarTurnoAdmin('${t.id}'); window.closeClassDetailModal();" class="text-red-500 hover:text-red-700 p-1.5 rounded-xl hover:bg-red-50 transition-colors" title="Cancelar reserva"><span class="material-symbols-outlined text-[18px]">delete</span></button>
                        </div>
                    </div>
                `;
            }).join('');
        }
    }

    modal.classList.remove('hidden');
};

window.closeClassDetailModal = function() {
    const modal = document.getElementById('modalDetalleClase');
    if (modal) modal.classList.add('hidden');
};

// Cerrar modal al presionar ESC o hacer click en el fondo
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        window.closeClassDetailModal();
    }
});
document.addEventListener('click', (e) => {
    const modal = document.getElementById('modalDetalleClase');
    if (modal && !modal.classList.contains('hidden') && e.target === modal) {
        window.closeClassDetailModal();
    }
});

// Auto-scroll y navegación cuando la URL contiene ?date= o ?fecha= o ?focus=
function checkUrlNavigationAndFocus() {
    const params = new URLSearchParams(window.location.search);
    const targetDate = params.get('date') || params.get('fecha');
    const focusId = params.get('focus');

    if (targetDate) {
        // Asegurarse de que esté en la pestaña de próximos confirmados
        if (typeof window.switchAgendaTab === 'function') {
            window.switchAgendaTab('proximos');
        }

        setTimeout(() => {
            const diaEl = document.getElementById('dia-' + targetDate);
            if (diaEl) {
                diaEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
                diaEl.classList.add('ring-4', 'ring-purple-400', 'ring-offset-4', 'rounded-2xl', 'transition-all');
                setTimeout(() => {
                    diaEl.classList.remove('ring-4', 'ring-purple-400', 'ring-offset-4');
                }, 3000);
            }
        }, 600);
    }

    if (focusId) {
        setTimeout(() => {
            const el = document.getElementById('turno-' + focusId) || document.getElementById('slotcard-' + focusId);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                el.classList.add('ring-4', 'ring-primary', 'ring-offset-2', 'scale-[1.02]', 'transition-all');
                setTimeout(() => {
                    el.classList.remove('ring-4', 'ring-primary', 'ring-offset-2', 'scale-[1.02]');
                }, 3500);
            }
        }, 800);
    }
}

// Ejecutar check al renderizar
if (!window.origRenderAgendaTurnos) {
    window.origRenderAgendaTurnos = window.renderAgendaTurnos;
    window.renderAgendaTurnos = function() {
        if (typeof window.origRenderAgendaTurnos === 'function') {
            window.origRenderAgendaTurnos.apply(this, arguments);
        }
        checkUrlNavigationAndFocus();
    };
}

// --- Recarga Automática por Eventos ---
window.forceCargarAgenda = function() {
    if (typeof window.cargarAgenda === 'function') {
        window.cargarAgenda(true);
    }
};

window.addEventListener('focus', window.forceCargarAgenda);
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') window.forceCargarAgenda();
});
document.addEventListener('click', (e) => {
    if (e.target.closest('button') || e.target.closest('a')) {
        setTimeout(window.forceCargarAgenda, 350);
    }
});