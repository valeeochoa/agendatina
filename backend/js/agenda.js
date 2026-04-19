// backend/js/agenda.js

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
            window.renderAgendaTurnos(data, currentSearch);
        }
    }).catch(err => console.error(err));
};

window.renderAgendaTurnos = function(data, searchTerm = '') {
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
                window.renderAgendaTurnos(window.agendaData, e.target.value);
            });
            
            if (searchTerm) {
                document.getElementById('agendaSearchInput').value = searchTerm;
            }
        }
    }

    let pendientes = data.filter(t => t.estado === 'pendiente');
    let confirmados = data.filter(t => t.estado === 'confirmado');
    let eliminados = data.filter(t => t.estado === 'eliminado');
    
    if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const filterFn = t => 
            (t.cliente_nombre && t.cliente_nombre.toLowerCase().includes(term)) ||
            (t.nombre && t.nombre.toLowerCase().includes(term)) ||
            (t.apellido && t.apellido.toLowerCase().includes(term)) ||
            (t.cliente_celular && t.cliente_celular.includes(term)) ||
            (t.celular && t.celular.includes(term)) ||
            (t.servicio && t.servicio.toLowerCase().includes(term));
            
        pendientes = pendientes.filter(filterFn);
        confirmados = confirmados.filter(filterFn);
        eliminados = eliminados.filter(filterFn);
    }
    
    const urlParams = new URLSearchParams(window.location.search);
    const focusId = urlParams.get('focus');
    
    // Ordenar cronológicamente
    confirmados.sort((a, b) => (a.fecha + ' ' + a.hora).localeCompare(b.fecha + ' ' + b.hora));

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
                <div id="turno-${t.id}" class="bg-white dark:bg-slate-800 border-l-4 border-amber-400 shadow-sm rounded-xl p-5 hover:shadow-md transition-all ${focusClass}">
                    <p class="text-xs font-bold text-amber-500 mb-2 uppercase tracking-wide">${fDisplay} • ${t.hora} hs</p>
                    <p class="text-base font-bold text-slate-800 dark:text-slate-100 mb-1">${t.cliente_nombre || (t.nombre + ' ' + (t.apellido || ''))}</p>
                    <p class="text-sm text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1.5"><span class="material-symbols-outlined text-[16px]">spa</span> ${t.servicio}</p>
                    ${t.profesional && t.profesional !== 'Cualquiera (Sin preferencia)' ? `<p class="text-sm text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-1.5"><span class="material-symbols-outlined text-[16px]">person</span> ${t.profesional}</p>` : '<div class="mb-3"></div>'}
                    
                    <div class="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
                        <button onclick="window.confirmarTurnoAdmin('${t.id}')" class="flex-1 bg-amber-100 hover:bg-amber-200 text-amber-800 dark:bg-amber-500/20 dark:hover:bg-amber-500/40 dark:text-amber-400 text-sm font-bold py-2 rounded-lg transition-colors flex items-center justify-center gap-1 whitespace-nowrap">
                            <span class="material-symbols-outlined text-[18px]">check</span> Confirmar
                        </button>
                        <button onclick="window.contactarWhatsApp('${t.id}')" class="flex-1 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 text-sm font-bold py-2 rounded-lg transition-colors flex items-center justify-center gap-1 whitespace-nowrap" title="Contactar por WhatsApp">
                            <span class="material-symbols-outlined text-[18px]">chat</span> WhatsApp
                        </button>
                        <button onclick="window.cancelarTurnoAdmin('${t.id}')" class="bg-slate-100 dark:bg-slate-700 hover:bg-red-100 dark:hover:bg-red-500/20 text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 text-sm font-bold py-2 px-3 rounded-lg transition-colors flex items-center justify-center" title="Eliminar turno">
                            <span class="material-symbols-outlined text-[18px]">delete</span>
                        </button>
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

    // DIBUJAR CONFIRMADOS
    const listConf = document.getElementById('lista-confirmados');
    if (listConf) {
        listConf.innerHTML = '';
        if (confirmados.length === 0) {
            listConf.innerHTML = `<div class="p-8 text-center text-sm font-medium text-slate-400 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">${searchTerm ? 'No se encontraron resultados de la búsqueda' : 'Aún no tienes turnos confirmados.'}</div>`;
        } else {
            const gruposConf = {};
            confirmados.forEach(t => {
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
                    htmlDia += `
                        <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:shadow-md transition-shadow">
                            <div class="flex-1 min-w-0">
                                <p class="text-xs font-bold text-green-600 mb-1 uppercase tracking-wide">${t.hora} hs</p>
                                <p class="text-base font-bold text-slate-800 dark:text-slate-100 mb-1 truncate" title="${t.cliente_nombre || ''}">${t.cliente_nombre || (t.nombre + ' ' + (t.apellido || ''))}</p>
                                <p class="text-sm text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1.5 truncate" title="${t.servicio}"><span class="material-symbols-outlined text-[16px]">spa</span> ${t.servicio}</p>
                                ${t.profesional && t.profesional !== 'Cualquiera (Sin preferencia)' ? `<p class="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1.5 truncate" title="${t.profesional}"><span class="material-symbols-outlined text-[16px]">person</span> ${t.profesional}</p>` : ''}
                            </div>
                            <div class="flex flex-wrap sm:flex-col gap-2 mt-2 sm:mt-0 w-full sm:w-auto border-t sm:border-t-0 border-slate-100 dark:border-slate-700 pt-3 sm:pt-0">
                                <button onclick="window.contactarWhatsApp('${t.id}')" class="flex-1 sm:flex-none flex items-center justify-center gap-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 px-3 py-2 rounded-lg font-bold transition-colors text-sm whitespace-nowrap"><span class="material-symbols-outlined text-[18px]">chat</span> WhatsApp</button>
                                <button onclick="window.recordatorioWhatsApp('${t.id}')" class="flex-1 sm:flex-none flex items-center justify-center gap-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 px-3 py-2 rounded-lg font-bold transition-colors text-sm whitespace-nowrap" title="Enviar recordatorio"><span class="material-symbols-outlined text-[18px]">notifications_active</span> Recordar</button>
                                <button onclick="window.cancelarTurnoAdmin('${t.id}')" class="flex-1 sm:flex-none flex items-center justify-center gap-1 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/30 px-3 py-2 rounded-lg font-bold transition-colors text-sm whitespace-nowrap" title="Eliminar turno">
                                    <span class="material-symbols-outlined text-[18px]">delete</span> Eliminar
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

    // DIBUJAR ELIMINADOS (PAPELERA)
    const listElim = document.getElementById('lista-eliminados');
    if (listElim) {
        listElim.innerHTML = '';
        if (eliminados.length === 0) {
            listElim.innerHTML = `<div class="p-8 text-center text-sm font-medium text-slate-400 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">${searchTerm ? 'No se encontraron resultados de la búsqueda' : 'La papelera está vacía.'}</div>`;
        } else {
            eliminados.sort((a, b) => new Date(b.fecha_eliminado || 0) - new Date(a.fecha_eliminado || 0));
            eliminados.forEach(t => {
                const fParts = t.fecha.split('-');
                const fDisplay = fParts.length === 3 ? `${fParts[2]}/${fParts[1]}` : t.fecha;
                listElim.innerHTML += `
                    <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex items-center justify-between gap-4 opacity-70 hover:opacity-100 transition-opacity mb-3">
                        <div class="flex-1 min-w-0">
                            <p class="text-xs font-bold text-slate-400 uppercase">${fDisplay} • ${t.hora} hs</p>
                            <p class="text-sm font-bold text-slate-800 dark:text-slate-100 mt-1 truncate" title="${t.cliente_nombre || ''}">${t.cliente_nombre || (t.nombre + ' ' + (t.apellido || ''))}</p>
                            <p class="text-xs text-slate-500 dark:text-slate-400 truncate">${t.servicio}</p>
                        </div>
                        <div class="flex gap-2">
                            <button onclick="window.restaurarTurnoAdmin('${t.id}')" class="text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 p-2 rounded-lg transition-colors" title="Restaurar turno">
                                <span class="material-symbols-outlined text-[18px]">restore_from_trash</span>
                            </button>
                            <button onclick="window.eliminarTurnoPermanente('${t.id}')" class="text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 p-2 rounded-lg transition-colors" title="Eliminar definitivamente">
                                <span class="material-symbols-outlined text-[18px]">delete_forever</span>
                            </button>
                        </div>
                    </div>
                `;
            });
        }
    }
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
                    window.renderAgendaTurnos(window.agendaData, e.target.value);
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