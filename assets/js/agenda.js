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

window.cargarAgenda = function() {
    // Auto-refresco de la agenda en segundo plano cada 30 segundos
    if (!window.agendaPollingInterval) {
        window.agendaPollingInterval = setInterval(window.cargarAgenda, 30000);
    }

    const fetchConfig = typeof window.configData === 'undefined'
        ? fetch('backend/guardar_web.php').then(res => res.json()).then(conf => { window.configData = conf; })
        : Promise.resolve();

    fetchConfig.finally(() => {
        fetch('backend/obtener_agenda.php')
        .then(res => res.json())
        .then(data => {
            if (data && data.error) {
                if (data.error.toLowerCase().includes('inicia sesión') || data.error.toLowerCase().includes('autorizado')) {
                    window.location.href = 'login.html';
                } else {
                    if(typeof window.showToast === 'function') window.showToast(data.error, 'error');
                }
                return;
            }
            if (!Array.isArray(data)) return;

        // Evitar parpadeos: Solo re-renderizar si hubo un cambio real en los datos
        const newDataString = JSON.stringify(data);
        if (window.agendaLastDataString === newDataString) return;
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
    }).catch(err => console.error(err));
};

window.renderAgendaTurnos = function(data, searchTerm = '', profTerm = '') {
    var listPend = document.getElementById('lista-pendientes');
    // Inyectar buscador si no existe en el DOM
    if (!document.getElementById('agendaSearchContainer')) {
        if (listPend) {
            const searchContainer = document.createElement('div');
            searchContainer.id = 'agendaSearchContainer';
            searchContainer.className = 'mb-6 relative w-full';
            searchContainer.innerHTML = `
                <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <span class="material-symbols-outlined text-slate-400 text-[20px]">search</span>
                </div>
                <input type="text" id="agendaSearchInput" class="w-full pl-12 pr-4 py-3.5 rounded-2xl border border-slate-200 bg-white shadow-sm focus:ring-2 focus:ring-primary outline-none transition-all text-sm font-medium text-slate-700 placeholder-slate-400" placeholder="Buscar por cliente, teléfono o servicio...">
            `;
            
            // Colocar el buscador arriba de todo (antes de las pestañas si existen)
            const tabs = document.querySelector('[role="tablist"]') || document.querySelector('.flex.bg-slate-100.p-1') || listPend.parentElement;
            if (tabs && tabs.parentElement && tabs !== listPend.parentElement) {
                tabs.parentElement.insertBefore(searchContainer, tabs);
            } else {
                listPend.parentElement.insertBefore(searchContainer, listPend.parentElement.firstChild);
            }

            // Evento para filtrar en tiempo real
            document.getElementById('agendaSearchInput').addEventListener('input', (e) => {
                window.renderAgendaTurnos(window.agendaData, e.target.value, window.currentAgendaProfTerm || '');
            });
            
            if (searchTerm) {
                document.getElementById('agendaSearchInput').value = searchTerm;
            }
        }
    }

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
                uniqueProfs.forEach(p => {
                    const count = data.filter(t => t.profesional === p && (t.estado === 'pendiente')).length;
                    const countBadge = count > 0 ? `<span class="bg-amber-400 text-amber-900 px-2 py-0.5 rounded-md text-xs font-black ml-1 shadow-sm">${count}</span>` : '';
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

            const fechasConf = Object.keys(gruposConf).sort();
            fechasConf.forEach(fecha => {
                const [yyyy, mm, dd] = fecha.split('-');
                const dateObj = new Date(yyyy, mm - 1, dd);
                const esHoy = new Date().toDateString() === dateObj.toDateString();
                const formatFecha = `${dd}/${mm}/${yyyy}`;
                
                const turnosCount = gruposConf[fecha].length;
                const turnosText = turnosCount === 1 ? '1 turno' : `${turnosCount} turnos`;

                let htmlDia = `
                    <div class="mb-8">
                        <h3 class="font-bold text-slate-800 mb-4 flex items-center gap-2 ${esHoy ? 'text-primary' : ''}">
                            <span class="material-symbols-outlined text-[20px]">${esHoy ? 'today' : 'event'}</span> 
                            ${esHoy ? 'Hoy, ' + formatFecha : formatFecha}
                            <span class="text-[11px] font-bold px-2 py-0.5 rounded-md ml-1 border border-slate-200" style="background:#f1f5f9;color:#64748b;">${turnosText}</span>
                        </h3>
                        <div class="space-y-3">
                `;
                
                gruposConf[fecha].forEach(t => {
                    htmlDia += `
                        <div id="turno-${t.id}" onclick="if(!event.target.closest('button')) window.openEditTurnoModal('${t.id}')" class="shadow-sm rounded-2xl p-5 hover:shadow-lg cursor-pointer transition-shadow relative overflow-hidden" style="background-color: #ffffff; border: 1px solid #e2e8f0;">
                            <div class="absolute top-0 left-0 w-1.5 h-full bg-blue-500"></div>
                            <div class="flex justify-between items-start mb-3">
                                <span class="text-xs font-bold px-3 py-1 rounded-lg uppercase tracking-wider" style="background-color: #eff6ff; color: #1d4ed8;">${t.hora} hs</span>
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
                                <button onclick="window.recordatorioWhatsApp('${t.id}')" class="flex-1 text-sm font-bold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-1 border" style="background-color: #eff6ff; color: #1d4ed8; border-color: #bfdbfe;" title="Enviar recordatorio">
                                    <span class="material-symbols-outlined text-[18px]">notifications_active</span> Recordar
                                </button>
                                <button onclick="window.cancelarTurnoAdmin('${t.id}')" class="bg-red-50 hover:bg-red-100 text-red-600 text-sm font-bold py-2.5 px-4 rounded-xl transition-colors flex items-center justify-center border border-red-100" title="Eliminar turno">
                                    <span class="material-symbols-outlined text-[18px]">delete</span>
                                </button>
                            </div>
                        </div>
                    `;
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
                    htmlDia += `
                        <div id="turno-${t.id}" onclick="if(!event.target.closest('button')) window.openEditTurnoModal('${t.id}')" class="shadow-sm rounded-3xl p-5 flex flex-col gap-3 hover:opacity-100 hover:shadow-xl hover:-translate-y-1 cursor-pointer transition-all relative overflow-hidden ${animClass}" style="background-color: #ffffff; border: 1px solid #e2e8f0; --target-opacity: 0.85; ${customStyle}">
                            <div class="absolute top-0 left-0 w-1.5 h-full opacity-60 bg-blue-500"></div>
                            <div class="flex justify-between items-start">
                                <div class="flex-1 min-w-0">
                                    <span class="text-xs font-extrabold px-3 py-1.5 rounded-xl inline-flex items-center gap-1.5 mb-4 uppercase tracking-wide border shadow-sm w-max" style="background-color: #eff6ff; color: #1d4ed8; border-color: #bfdbfe;">
                                        <span class="material-symbols-outlined text-[15px]">schedule</span> ${t.hora} hs
                                    </span>
                                    <p class="text-2xl font-black mb-3 leading-tight tracking-tight" style="color: #1e293b;">${t.cliente_nombre || (t.nombre + ' ' + (t.apellido || ''))}</p>
                                    <div class="space-y-2 p-3 rounded-2xl" style="background-color: #f1f5f9;">
                                        <p class="text-sm font-semibold flex items-center gap-2.5" style="color: #334155;">
                                            <span class="material-symbols-outlined text-[18px] opacity-70">spa</span> <span class="break-words">${t.servicio}</span>
                                        </p>
                                        ${t.profesional && t.profesional !== 'Cualquiera (Sin preferencia)' ? `<p class="text-sm font-semibold flex items-center gap-2.5" style="color: #334155;"><span class="material-symbols-outlined text-[18px] opacity-70">person</span> <span class="break-words">${t.profesional}</span></p>` : ''}
                                    </div>
                                </div>
                            </div>
                            <div class="flex flex-col sm:flex-row gap-3 mt-2 w-full border-t pt-4" style="border-color: #e2e8f0;">
                                <button onclick="window.contactarWhatsApp('${t.id}')" class="w-full flex items-center justify-center gap-2 bg-[#25D366] text-white hover:bg-[#20bd5a] px-4 py-3 rounded-xl font-bold transition-all text-sm shadow-sm hover:shadow-md">
                                    <span class="material-symbols-outlined text-[18px]">chat</span> WhatsApp
                                </button>
                                <button onclick="window.cancelarTurnoAdmin('${t.id}')" class="w-full flex items-center justify-center gap-1 bg-red-50 text-red-600 hover:bg-red-100 px-4 py-3 rounded-xl font-bold transition-all text-sm border border-red-200 hover:shadow-md" title="Eliminar turno">
                                    <span class="material-symbols-outlined text-[18px]">delete</span> Eliminar
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
            listElim.innerHTML += `<div class="p-8 text-center text-sm font-medium text-slate-400 rounded-xl border border-slate-200" style="background:#ffffff;">${searchTerm ? 'No se encontraron resultados de la búsqueda' : 'No se han borrado turnos.'}</div>`;
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
                        <div class="rounded-3xl p-5 flex flex-col gap-3 ${opacityClass} hover:opacity-100 hover:shadow-xl hover:-translate-y-1 transition-all mb-4 relative overflow-hidden ${animClass}" style="--target-opacity: 0.7; background-color: #ffffff; border: 1px solid #e2e8f0;">
                            <div class="absolute top-0 left-0 w-1.5 h-full bg-slate-400 opacity-60"></div>
                            <div class="flex justify-between items-start">
                                <div class="flex-1 min-w-0">
                                    <span class="text-xs font-extrabold px-3 py-1.5 rounded-xl inline-flex mb-4 uppercase tracking-wide border items-center gap-1.5 w-max shadow-sm" style="background-color: #f1f5f9; color: #475569; border-color: #e2e8f0;">
                                        <span class="material-symbols-outlined text-[15px]">schedule</span> ${fDisplay} • ${t.hora} hs
                                    </span>
                                    <p class="text-2xl font-black mb-3 leading-tight tracking-tight line-through opacity-70" style="color: #1e293b;">${t.cliente_nombre || (t.nombre + ' ' + (t.apellido || ''))}</p>
                                    <div class="p-3 rounded-2xl" style="background-color: #f1f5f9;">
                                        <p class="text-sm font-semibold flex items-center gap-2.5" style="color: #475569;"><span class="material-symbols-outlined text-[18px] opacity-70">spa</span> <span class="break-words">${t.servicio}</span></p>
                                    </div>
                                </div>
                            </div>
                            <div class="flex flex-col sm:flex-row gap-3 mt-2 w-full border-t pt-4" style="border-color: #e2e8f0;">
                                <button onclick="window.restaurarTurnoAdmin('${t.id}')" class="w-full sm:flex-1 bg-green-50 hover:bg-green-100 text-green-700 text-sm font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 border border-green-200 hover:shadow-md">
                                    <span class="material-symbols-outlined text-[18px]">restore_from_trash</span> Restaurar
                                </button>
                                <button onclick="window.eliminarTurnoPermanente('${t.id}')" class="w-full sm:flex-none bg-red-50 hover:bg-red-100 text-red-600 text-sm font-bold py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2 border border-red-200 hover:shadow-md" title="Eliminar definitivamente">
                                    <span class="material-symbols-outlined text-[18px]">delete_forever</span> <span class="sm:hidden">Eliminar definitivo</span>
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
};

window.setAgendaProfFilter = function(profName) {
    window.currentAgendaProfTerm = profName;
    const tabsContainer = document.getElementById('profesionalesAgendaTabs');
    if (tabsContainer) tabsContainer.dataset.profs = '';
    window.renderAgendaTurnos(window.agendaData, document.getElementById('agendaSearchInput')?.value || '', profName);
};

window.restaurarTurnoAdmin = function(id) {
    if (typeof showConfirm === 'function') {
        showConfirm('Restaurar Turno', '¿Deseas restaurar este turno y devolverlo a la agenda de pendientes?', 'Restaurar', 'bg-green-600 hover:bg-green-700', () => {
            return fetch('backend/restaurar_turno.php', { method: 'POST', body: new URLSearchParams({id: id}) })
            .then(res => res.json())
            .then(data => {
                if(data.success) {
                    if(typeof showToast === 'function') showToast('Turno restaurado exitosamente', 'success');
                    window.cargarAgenda();
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
            return fetch('backend/eliminar_turno_permanente.php', { method: 'POST', body: new URLSearchParams({id: id}) })
            .then(res => res.json())
            .then(data => {
                if(data.success) {
                    if(typeof showToast === 'function') showToast('Turno eliminado permanentemente', 'success');
                    window.cargarAgenda();
                } else {
                    if(typeof showToast === 'function') showToast(data.error || 'Error al eliminar.', 'error');
                }
            }).catch(() => { if(typeof showToast === 'function') showToast('Error de conexión', 'error'); });
        });
    }
};

document.addEventListener('DOMContentLoaded', () => {
    // ---- Lógica para agenda.html ----
    if (document.getElementById('lista-pendientes')) {
        // Seguridad: si no hay sesión, redirigir al login
        if (!sessionStorage.getItem('agendatina_session')) {
            fetch('backend/logout.php').then(() => window.location.href = 'login.html');
            return;
        }
        
        window.cargarAgenda();

        // Evento para filtrar en tiempo real
        const searchInput = document.getElementById('agendaSearchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                // Re-renderiza la lista de turnos con el término de búsqueda
                if (window.agendaData) {
                    window.renderAgendaTurnos(window.agendaData, e.target.value, window.currentAgendaProfTerm || '');
                }
            });
        }

        // LÓGICA DE PESTAÑAS (TABS)
        const tabs = document.querySelectorAll('[role="tab"]');
        const panels = document.querySelectorAll('[role="tabpanel"]');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                // Resetear todos los tabs
                tabs.forEach(t => {
                    t.setAttribute('aria-selected', 'false');
                    t.className = 'flex-1 py-2.5 text-sm font-bold rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 flex items-center justify-center gap-1 transition-colors';
                });
                // Activar tab clickeado
                tab.setAttribute('aria-selected', 'true');
                tab.className = 'flex-1 py-2.5 text-sm font-bold rounded-lg bg-white dark:bg-slate-700 shadow-sm text-primary flex items-center justify-center gap-1 transition-colors';
                
                // Mostrar panel correspondiente
                panels.forEach(p => p.classList.add('hidden'));
                document.getElementById(tab.getAttribute('aria-controls')).classList.remove('hidden');
            });
        });
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