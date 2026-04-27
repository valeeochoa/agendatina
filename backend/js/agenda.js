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
    // Inyectar buscador si no existe en el DOM
    if (!document.getElementById('agendaSearchContainer')) {
        const listPend = document.getElementById('lista-pendientes');
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
    const tabsContainer = document.getElementById('profesionalesAgendaTabs');
    if (tabsContainer && data.length > 0) {
        // Chequear rol para no mostrar tabs al empleado
        if (window.currentUserData && window.currentUserData.rol_en_local === 'profesional') {
            tabsContainer.classList.add('hidden');
        } else {
            const uniqueProfs = [...new Set(data.map(t => t.profesional).filter(p => p && p !== 'Cualquiera (Sin preferencia)'))].sort();
            
            if (uniqueProfs.length > 0) {
                tabsContainer.classList.remove('hidden');
                const currentProfsStr = uniqueProfs.join(',');
                
                if (tabsContainer.dataset.profs !== currentProfsStr) {
                    let activeTab = window.currentAgendaProfTerm || '';
                    let optionsHtml = `<button onclick="window.setAgendaProfFilter('')" class="px-6 py-3 rounded-t-2xl font-bold text-sm whitespace-nowrap transition-all shadow-sm flex items-center gap-2 ${activeTab === '' ? 'bg-primary text-white border-b-4 border-white/20' : 'bg-slate-200 text-slate-500 hover:bg-slate-300'}"><span class="material-symbols-outlined text-[18px]">calendar_view_week</span> Agenda General</button>`;
                    uniqueProfs.forEach(p => {
                        optionsHtml += `<button onclick="window.setAgendaProfFilter('${p.replace(/'/g, "\\'")}')" class="px-6 py-3 rounded-t-2xl font-bold text-sm whitespace-nowrap transition-all shadow-sm flex items-center gap-2 ${activeTab === p ? 'bg-primary text-white border-b-4 border-white/20' : 'bg-slate-200 text-slate-500 hover:bg-slate-300'}"><span class="material-symbols-outlined text-[18px]">folder_shared</span> ${p}</button>`;
                    });
                    tabsContainer.innerHTML = optionsHtml;
                    tabsContainer.dataset.profs = currentProfsStr;
                }
            } else {
                tabsContainer.classList.add('hidden');
            }
        }
    }

    let pendientes = data.filter(t => t.estado === 'pendiente');
    let confirmados = data.filter(t => t.estado === 'confirmado');
    let eliminados = data.filter(t => t.estado === 'eliminado');
    
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

    // DIBUJAR PENDIENTES
    const listPend = document.getElementById('lista-pendientes');
    if (listPend) {
        listPend.innerHTML = '';
        if (pendientes.length === 0) listPend.innerHTML = `<div class="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 text-center"><p class="text-sm font-medium text-slate-400">${searchTerm ? 'No se encontraron resultados de la búsqueda' : 'No hay turnos pendientes'}</p></div>`;
        
        pendientes.forEach(t => {
            const fParts = t.fecha.split('-');
            const fDisplay = fParts.length === 3 ? `${fParts[2]}/${fParts[1]}/${fParts[0]}` : t.fecha;
            const focusClass = focusId == t.id ? 'ring-4 ring-primary ring-offset-2 scale-[1.02] transition-transform duration-500' : '';
            listPend.innerHTML += `
                <div id="turno-${t.id}" class="bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-900/50 shadow-sm rounded-xl p-5 hover:shadow-md transition-all ${focusClass}">
                    <div class="flex justify-between items-start mb-3">
                        <span class="text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 px-2.5 py-1 rounded-md uppercase tracking-wide border border-amber-200 dark:border-amber-800/50">${fDisplay} • ${t.hora} hs</span>
                    </div>
                    <p class="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2 leading-tight">${t.cliente_nombre || (t.nombre + ' ' + (t.apellido || ''))}</p>
                    <p class="text-sm text-slate-600 dark:text-slate-400 mb-1 flex items-start gap-2"><span class="material-symbols-outlined text-[18px] shrink-0 text-slate-400">spa</span> <span class="break-words">${t.servicio}</span></p>
                    ${t.profesional && t.profesional !== 'Cualquiera (Sin preferencia)' ? `<p class="text-sm text-slate-600 dark:text-slate-400 mb-3 flex items-start gap-2"><span class="material-symbols-outlined text-[18px] shrink-0 text-slate-400">person</span> <span class="break-words">${t.profesional}</span></p>` : '<div class="mb-3"></div>'}
                    
                    <div class="flex flex-col sm:flex-row items-center gap-2 mt-4 pt-4 border-t border-slate-100 dark:border-slate-700 w-full">
                        <button onclick="window.confirmarTurnoAdmin('${t.id}')" class="w-full sm:flex-1 bg-primary hover:bg-primary/90 text-white text-sm font-bold py-2.5 px-4 rounded-xl transition-colors flex items-center justify-center gap-1 shadow-sm">
                            <span class="material-symbols-outlined text-[18px]">check</span> Confirmar
                        </button>
                        <div class="flex gap-2 w-full sm:w-auto">
                            <button onclick="window.contactarWhatsApp('${t.id}')" class="flex-1 sm:flex-none bg-emerald-50 hover:bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20 dark:text-emerald-400 text-sm font-bold py-2.5 px-4 rounded-xl transition-colors flex items-center justify-center gap-1 border border-emerald-100 dark:border-emerald-800/30" title="Contactar por WhatsApp">
                                <span class="material-symbols-outlined text-[18px]">chat</span>
                            </button>
                            <button onclick="window.cancelarTurnoAdmin('${t.id}')" class="flex-1 sm:flex-none bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-500/10 dark:hover:bg-red-500/20 dark:text-red-400 text-sm font-bold py-2.5 px-4 rounded-xl transition-colors flex items-center justify-center border border-red-100 dark:border-red-800/30" title="Eliminar turno">
                                <span class="material-symbols-outlined text-[18px]">delete</span>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });
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
            listConf.innerHTML = `<div class="p-8 text-center text-sm font-medium text-slate-400 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">${searchTerm ? 'No se encontraron resultados de la búsqueda' : 'Aún no tienes turnos próximos.'}</div>`;
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
                
                let htmlDia = `
                    <div class="mb-8">
                        <h3 class="font-bold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2 ${esHoy ? 'text-primary' : ''}">
                            <span class="material-symbols-outlined text-[20px]">${esHoy ? 'today' : 'event'}</span> 
                            ${esHoy ? 'Hoy, ' + formatFecha : formatFecha}
                        </h3>
                        <div class="space-y-3">
                `;
                
                gruposConf[fecha].forEach(t => {
                    const customStyle = `style="border-left-width: 4px; border-left-color: var(--color-primario, #3b82f6); background-color: color-mix(in srgb, var(--color-primario, #3b82f6) 4%, #ffffff);"`;
                    htmlDia += `
                        <div class="border border-slate-200 dark:border-slate-700 rounded-xl p-4 sm:p-5 flex flex-col gap-3 hover:shadow-md transition-shadow" ${customStyle}>
                            <div class="flex justify-between items-start">
                                <div class="flex-1 min-w-0">
                                    <span class="text-xs font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 px-2.5 py-1 rounded-md inline-block mb-3 uppercase tracking-wide border border-blue-200 dark:border-blue-800/50">${t.hora} hs</span>
                                    <p class="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2 leading-tight">${t.cliente_nombre || (t.nombre + ' ' + (t.apellido || ''))}</p>
                                    <p class="text-sm text-slate-600 dark:text-slate-400 mb-1 flex items-start gap-2"><span class="material-symbols-outlined text-[18px] shrink-0 text-slate-400">spa</span> <span class="break-words">${t.servicio}</span></p>
                                    ${t.profesional && t.profesional !== 'Cualquiera (Sin preferencia)' ? `<p class="text-sm text-slate-600 dark:text-slate-400 flex items-start gap-2"><span class="material-symbols-outlined text-[18px] shrink-0 text-slate-400">person</span> <span class="break-words">${t.profesional}</span></p>` : ''}
                                </div>
                            </div>
                            <div class="flex flex-col sm:flex-row gap-2 mt-1 w-full border-t border-slate-100 dark:border-slate-700 pt-4">
                                <button onclick="window.contactarWhatsApp('${t.id}')" class="w-full sm:flex-1 flex items-center justify-center gap-1 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:hover:bg-emerald-500/20 px-3 py-2.5 rounded-xl font-bold transition-colors text-sm border border-emerald-100 dark:border-emerald-800/30"><span class="material-symbols-outlined text-[18px]">chat</span> WhatsApp</button>
                                <div class="flex gap-2 w-full sm:w-auto">
                                    <button onclick="window.recordatorioWhatsApp('${t.id}')" class="flex-1 sm:flex-none flex items-center justify-center gap-1 bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:hover:bg-blue-500/20 px-4 py-2.5 rounded-xl font-bold transition-colors text-sm border border-blue-100 dark:border-blue-800/30" title="Enviar recordatorio"><span class="material-symbols-outlined text-[18px]">notifications_active</span></button>
                                    <button onclick="window.cancelarTurnoAdmin('${t.id}')" class="flex-1 sm:flex-none flex items-center justify-center gap-1 bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20 px-4 py-2.5 rounded-xl font-bold transition-colors text-sm border border-red-100 dark:border-red-800/30" title="Eliminar turno">
                                        <span class="material-symbols-outlined text-[18px]">delete</span>
                                    </button>
                                </div>
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
            listHist.innerHTML = `<div class="p-8 text-center text-sm font-medium text-slate-400 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">${searchTerm ? 'No se encontraron resultados de la búsqueda' : 'El historial está vacío.'}</div>`;
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
                
                let htmlDia = `
                    <div class="mb-8">
                        <h3 class="font-bold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2 opacity-80">
                            <span class="material-symbols-outlined text-[20px]">history</span> 
                            ${formatFecha}
                        </h3>
                        <div class="space-y-3">
                `;
                
                gruposHist[fecha].forEach(t => {
                    globalHistIndex++;
                    const isNewLoaded = window.isLoadingMoreHistory && globalHistIndex > (window.historyLimit - 15);
                    const animClass = isNewLoaded ? 'animate-new-item' : '';
                    const customStyle = `style="border-left-width: 4px; border-left-color: var(--color-primario, #3b82f6); background-color: color-mix(in srgb, var(--color-primario, #3b82f6) 4%, #ffffff); --target-opacity: 0.85; ${isNewLoaded ? 'opacity: 0;' : 'opacity: 0.85;'}"`;
                    htmlDia += `
                        <div class="border border-slate-200 dark:border-slate-700 rounded-xl p-4 sm:p-5 flex flex-col gap-3 hover:opacity-100 transition-opacity ${animClass}" ${customStyle}>
                            <div class="flex justify-between items-start">
                                <div class="flex-1 min-w-0">
                                    <span class="text-xs font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 px-2.5 py-1 rounded-md inline-block mb-3 uppercase tracking-wide border border-blue-200 dark:border-blue-800/50">${t.hora} hs</span>
                                    <p class="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2 leading-tight">${t.cliente_nombre || (t.nombre + ' ' + (t.apellido || ''))}</p>
                                    <p class="text-sm text-slate-600 dark:text-slate-400 mb-1 flex items-start gap-2"><span class="material-symbols-outlined text-[18px] shrink-0 text-slate-400">spa</span> <span class="break-words">${t.servicio}</span></p>
                                    ${t.profesional && t.profesional !== 'Cualquiera (Sin preferencia)' ? `<p class="text-sm text-slate-600 dark:text-slate-400 flex items-start gap-2"><span class="material-symbols-outlined text-[18px] shrink-0 text-slate-400">person</span> <span class="break-words">${t.profesional}</span></p>` : ''}
                                </div>
                            </div>
                            <div class="flex flex-col sm:flex-row gap-2 mt-1 w-full border-t border-slate-100 dark:border-slate-700 pt-4">
                                <button onclick="window.contactarWhatsApp('${t.id}')" class="w-full flex items-center justify-center gap-1 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:hover:bg-emerald-500/20 px-3 py-2.5 rounded-xl font-bold transition-colors text-sm border border-emerald-100 dark:border-emerald-800/30"><span class="material-symbols-outlined text-[18px]">chat</span> WhatsApp</button>
                                <button onclick="window.cancelarTurnoAdmin('${t.id}')" class="w-full flex items-center justify-center gap-1 bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20 px-4 py-2.5 rounded-xl font-bold transition-colors text-sm border border-red-100 dark:border-red-800/30" title="Eliminar turno">
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
                        <button id="btnLoadMoreHistory" onclick="window.loadMoreHistory()" class="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 text-sm font-bold rounded-xl transition-colors border border-slate-200 dark:border-slate-600 flex items-center gap-2 shadow-sm">
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
        if (eliminados.length === 0) {
            listElim.innerHTML = `<div class="p-8 text-center text-sm font-medium text-slate-400 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">${searchTerm ? 'No se encontraron resultados de la búsqueda' : 'La papelera está vacía.'}</div>`;
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
                        <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 sm:p-5 flex flex-col gap-3 ${opacityClass} hover:opacity-100 transition-opacity mb-3 ${animClass}" style="--target-opacity: 0.7;">
                            <div class="flex justify-between items-start">
                                <div class="flex-1 min-w-0">
                                    <span class="text-xs font-bold bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 px-2.5 py-1 rounded-md inline-block mb-3 uppercase tracking-wide border border-slate-200 dark:border-slate-600">${fDisplay} • ${t.hora} hs</span>
                                    <p class="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2 leading-tight">${t.cliente_nombre || (t.nombre + ' ' + (t.apellido || ''))}</p>
                                    <p class="text-sm text-slate-600 dark:text-slate-400 flex items-start gap-2"><span class="material-symbols-outlined text-[18px] shrink-0 text-slate-400">spa</span> <span class="break-words">${t.servicio}</span></p>
                                </div>
                            </div>
                            <div class="flex flex-col sm:flex-row gap-2 mt-2 w-full border-t border-slate-100 dark:border-slate-700 pt-4">
                                <button onclick="window.restaurarTurnoAdmin('${t.id}')" class="w-full sm:flex-1 bg-green-50 hover:bg-green-100 text-green-700 dark:bg-green-500/10 dark:hover:bg-green-500/20 dark:text-green-400 text-sm font-bold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-1 border border-green-100 dark:border-green-800/30">
                                    <span class="material-symbols-outlined text-[18px]">restore_from_trash</span> Restaurar
                                </button>
                                <button onclick="window.eliminarTurnoPermanente('${t.id}')" class="w-full sm:flex-none bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-500/10 dark:hover:bg-red-500/20 dark:text-red-400 text-sm font-bold py-2.5 px-4 rounded-xl transition-colors flex items-center justify-center gap-1 border border-red-100 dark:border-red-800/30" title="Eliminar definitivamente">
                                    <span class="material-symbols-outlined text-[18px]">delete_forever</span> <span class="sm:hidden">Eliminar definitivo</span>
                                </button>
                            </div>
                        </div>
                `;
            });
            
            if (hasMoreEliminados) {
                listElim.innerHTML += `
                    <div class="mt-2 mb-6 flex justify-center">
                        <button id="btnLoadMoreTrash" onclick="window.loadMoreTrash()" class="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 text-sm font-bold rounded-xl transition-colors border border-slate-200 dark:border-slate-600 flex items-center gap-2 shadow-sm">
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
    if (tab === 'proximos') {
        document.getElementById('tabProximos').className = 'flex-1 py-2 text-sm font-bold rounded-lg bg-white shadow-sm text-primary flex items-center justify-center gap-1 transition-colors';
        document.getElementById('tabHistorial').className = 'flex-1 py-2 text-sm font-bold rounded-lg text-slate-500 hover:text-slate-700 flex items-center justify-center gap-1 transition-colors';
        document.getElementById('lista-confirmados').classList.remove('hidden');
        document.getElementById('lista-historial').classList.add('hidden');
    } else {
        document.getElementById('tabHistorial').className = 'flex-1 py-2 text-sm font-bold rounded-lg bg-white shadow-sm text-primary flex items-center justify-center gap-1 transition-colors';
        document.getElementById('tabProximos').className = 'flex-1 py-2 text-sm font-bold rounded-lg text-slate-500 hover:text-slate-700 flex items-center justify-center gap-1 transition-colors';
        document.getElementById('lista-historial').classList.remove('hidden');
        document.getElementById('lista-confirmados').classList.add('hidden');
    }
};