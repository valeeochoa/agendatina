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
    }
    
    const urlParams = new URLSearchParams(window.location.search);
    const focusId = urlParams.get('focus');
    
    // Ordenar cronológicamente
    confirmados.sort((a, b) => (a.fecha + ' ' + a.hora).localeCompare(b.fecha + ' ' + b.hora));

    // DIBUJAR PENDIENTES
    const listPend = document.getElementById('lista-pendientes');
    if (listPend) {
        listPend.innerHTML = '';
        if (pendientes.length === 0) listPend.innerHTML = `<div class="bg-slate-50 p-6 rounded-2xl border border-slate-200 text-center"><p class="text-sm font-medium text-slate-400">${searchTerm ? 'No se encontraron resultados de la búsqueda' : 'No hay turnos pendientes'}</p></div>`;
        
        pendientes.forEach(t => {
            const fParts = t.fecha.split('-');
            const fDisplay = fParts.length === 3 ? `${fParts[2]}/${fParts[1]}/${fParts[0]}` : t.fecha;
            const focusClass = focusId == t.id ? 'ring-4 ring-primary ring-offset-2 scale-[1.02] transition-transform duration-500' : '';
            listPend.innerHTML += `
                <div id="turno-${t.id}" class="bg-white border-l-4 border-amber-400 shadow-sm rounded-xl p-5 hover:shadow-md transition-all ${focusClass}">
                    <p class="text-xs font-bold text-amber-500 mb-2 uppercase tracking-wide">${fDisplay} • ${t.hora} hs</p>
                    <p class="text-base font-bold text-slate-800 mb-1">${t.cliente_nombre || (t.nombre + ' ' + (t.apellido || ''))}</p>
                    <div class="flex items-center gap-2 mb-1">
                        <p class="text-sm font-medium text-slate-600 flex items-center gap-1"><span class="material-symbols-outlined text-[16px]">call</span> ${t.cliente_celular || t.celular}</p>
                        <button onclick="window.contactarWhatsApp('${t.id}')" class="text-[#128C7E] hover:bg-[#25D366]/20 bg-[#25D366]/10 p-1.5 rounded-md transition-colors" title="Enviar WhatsApp"><span class="material-symbols-outlined text-[18px]">chat</span></button>
                    </div>
                    <p class="text-sm text-slate-500 mb-3 mt-2 flex items-center flex-wrap gap-1"><span class="material-symbols-outlined text-[14px]">spa</span> ${t.servicio} ${t.profesional && t.profesional !== 'Cualquiera (Sin preferencia)' ? '<span class="ml-2 px-2 py-0.5 bg-purple-100 text-purple-700 rounded-md text-xs font-semibold">👤 ' + t.profesional + '</span>' : ''}</p>
                    <div class="flex items-center gap-2 mt-2">
                        <button onclick="window.confirmarTurnoAdmin('${t.id}')" class="flex-1 bg-amber-100 hover:bg-amber-200 text-amber-800 text-sm font-bold py-2 rounded-lg transition-colors flex items-center justify-center gap-1">
                            <span class="material-symbols-outlined text-[18px]">check</span> Confirmar
                        </button>
                        <button onclick="window.cancelarTurnoAdmin('${t.id}')" class="bg-slate-100 hover:bg-red-100 text-slate-500 hover:text-red-600 text-sm font-bold py-2 px-3 rounded-lg transition-colors flex items-center justify-center" title="Rechazar solicitud">
                            <span class="material-symbols-outlined text-[18px]">close</span>
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
            listConf.innerHTML = `<div class="p-8 text-center text-sm font-medium text-slate-400 bg-slate-50 rounded-xl border border-slate-200">${searchTerm ? 'No se encontraron resultados de la búsqueda' : 'Aún no tienes turnos confirmados.'}</div>`;
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
                    <div class="mb-6">
                        <h3 class="font-bold text-slate-800 mb-3 flex items-center gap-2 ${esHoy ? 'text-primary' : ''}">
                            <span class="material-symbols-outlined text-[20px]">${esHoy ? 'today' : 'event'}</span> 
                            ${esHoy ? 'Hoy, ' + formatFecha : formatFecha}
                        </h3>
                        <div class="space-y-3">
                `;
                
                gruposConf[fecha].forEach(t => {
                    htmlDia += `
                        <div class="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:shadow-md transition-shadow">
                            <div>
                                <p class="text-xs font-bold text-green-600 mb-1 uppercase tracking-wide">${t.hora} hs</p>
                                <p class="text-base font-bold text-slate-800 mb-1">${t.cliente_nombre || (t.nombre + ' ' + (t.apellido || ''))}</p>
                                <p class="text-sm font-medium text-slate-600 mb-2 flex items-center gap-1"><span class="material-symbols-outlined text-[16px]">call</span> ${t.cliente_celular || t.celular}</p>
                                <div class="flex items-center flex-wrap gap-2">
                                    <span class="bg-blue-50 text-blue-700 font-medium px-2.5 py-1 rounded-md text-xs border border-blue-100">${t.servicio}</span>
                                    ${t.profesional && t.profesional !== 'Cualquiera (Sin preferencia)' ? `<span class="bg-purple-50 text-purple-700 font-medium px-2.5 py-1 rounded-md text-xs border border-purple-100">👤 ${t.profesional}</span>` : ''}
                                </div>
                            </div>
                            <div class="flex flex-row sm:flex-col gap-2 mt-2 sm:mt-0 w-full sm:w-auto border-t sm:border-t-0 border-slate-100 pt-3 sm:pt-0">
                                <button onclick="window.contactarWhatsApp('${t.id}')" class="flex-1 sm:flex-none flex items-center justify-center gap-1 bg-[#25D366]/10 text-[#128C7E] hover:bg-[#25D366]/20 px-3 py-2 rounded-lg font-bold transition-colors text-sm"><span class="material-symbols-outlined text-[18px]">chat</span> Contactar</button>
                                <button onclick="window.recordatorioWhatsApp('${t.id}')" class="flex-1 sm:flex-none flex items-center justify-center gap-1 bg-blue-100 text-blue-700 hover:bg-blue-200 px-3 py-2 rounded-lg font-bold transition-colors text-sm" title="Enviar recordatorio"><span class="material-symbols-outlined text-[18px]">notifications_active</span> Recordar</button>
                                <button onclick="window.cancelarTurnoAdmin('${t.id}')" class="flex-1 sm:flex-none flex items-center justify-center gap-1 text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-2 rounded-lg font-bold transition-colors text-sm" title="Cancelar turno">
                                    <span class="material-symbols-outlined text-[18px]">cancel</span> Cancelar
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
    }
});