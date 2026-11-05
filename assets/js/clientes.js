let allClientes = [];
let allServicios = [];
let filtroActual = 'todos';
let isPremiumAccount = true;
let currentPlanName = 'Simple';
let negocioRutaUnica = '';
let negocioNombreUnico = '';

document.addEventListener('DOMContentLoaded', () => {
    cargarClientes();
    setInterval(cargarClientes, 10000);
});

function cargarClientes() {
    fetch('backend/gestionar_clientes.php')
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                allClientes = data.data || [];
                allServicios = data.servicios || [];
                isPremiumAccount = data.is_premium !== undefined ? data.is_premium : true;
                currentPlanName = data.plan || 'Simple';
                negocioRutaUnica = data.negocio_ruta || '';
                negocioNombreUnico = data.negocio_nombre || '';
                
                poblarServiciosDropdowns();
                actualizarEnlaceUnicoView();
                verificarRestriccionPremium();
                actualizarMetricas();
                renderTablaAlumnos();
            } else {
                const errReason = data.error || 'No se pudieron cargar los datos de alumnos';
                console.error('⚠️ [Error de Carga - Clientes/Alumnos] No se pudo volver a cargar la información. Motivo:', errReason);
                if (errReason.toLowerCase().includes('inicia sesión') || errReason.toLowerCase().includes('autorizado') || errReason.toLowerCase().includes('sesión expirada')) {
                    window.location.href = 'login.html';
                } else if (typeof showToast === 'function') {
                    showToast(errReason, 'error');
                }
            }
        })
        .catch(err => console.error('⚠️ [Error de Carga - Clientes/Alumnos] Desconexión de red o fallo al volver a cargar información:', err));
}

function verificarRestriccionPremium() {
    let banner = document.getElementById('bannerPremiumLock');
    if (!isPremiumAccount) {
        if (!banner) {
            banner = document.createElement('div');
            banner.id = 'bannerPremiumLock';
            banner.className = 'mb-8 bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-red-500/10 border-2 border-orange-400/60 rounded-3xl p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm';
            banner.innerHTML = `
                <div class="flex items-center gap-5 text-left">
                    <div class="w-16 h-16 rounded-2xl bg-orange-500 text-white flex items-center justify-center font-bold shrink-0 shadow-lg shadow-orange-500/30">
                        <span class="material-symbols-outlined text-3xl">lock</span>
                    </div>
                    <div>
                        <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-100 border border-orange-200 text-orange-800 text-[11px] font-black uppercase tracking-wider mb-2">
                            <span>🔒 Módulo Exclusivo Plan Premium</span>
                        </div>
                        <h3 class="text-xl md:text-2xl font-extrabold text-slate-900">La gestión de alumnos y cupos requiere Plan Premium</h3>
                        <p class="text-xs md:text-sm text-slate-600 mt-1 max-w-xl">Tu cuenta posee actualmente el <strong>Plan ${currentPlanName}</strong>. Para registrar alumnos, administrar créditos, controlar vencimientos de pases y habilitar el Portal de Alumnos, actualiza tu suscripción.</p>
                    </div>
                </div>
                <a href="perfil.html" class="bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-700 hover:to-amber-600 text-white font-extrabold px-6 py-3.5 rounded-2xl shadow-lg shadow-orange-500/25 hover:scale-[1.02] active:scale-95 transition-all text-xs md:text-sm flex items-center gap-2 shrink-0">
                    <span class="material-symbols-outlined text-[20px]">workspace_premium</span> Mejorar a Plan Premium
                </a>
            `;
            const mainContainer = document.querySelector('main');
            if (mainContainer) mainContainer.insertBefore(banner, mainContainer.firstElementChild);
        }
    } else if (banner) {
        banner.remove();
    }
}

function showPremiumModalNotice() {
    if (typeof showConfirm === 'function') {
        showConfirm({
            title: '🔒 Función Exclusiva Plan Premium',
            message: `El registro y administración de alumnos y créditos de clases está disponible exclusivamente para cuentas con <strong>Plan Premium</strong>.<br><br>¿Deseas conocer los detalles del Plan Premium e impulsar tu negocio?`,
            confirmText: 'Ver Plan Premium',
            confirmColor: 'orange',
            onConfirm: () => { window.location.href = 'perfil.html'; }
        });
    } else {
        alert('Esta función es exclusiva del Plan Premium. Actualiza tu plan en la sección Perfil.');
        window.location.href = 'perfil.html';
    }
}

function actualizarMetricas() {
    const total = allClientes.length;
    const activos = allClientes.filter(c => c.estado_calculado === 'activo').length;
    const sinPases = allClientes.filter(c => c.estado_calculado === 'sin_pases').length;
    const vencidos = allClientes.filter(c => c.estado_calculado === 'vencido').length;

    if (document.getElementById('statTotalAlumnos')) document.getElementById('statTotalAlumnos').textContent = total;
    if (document.getElementById('statAlumnosActivos')) document.getElementById('statAlumnosActivos').textContent = activos;
    if (document.getElementById('statAlumnosSinPases')) document.getElementById('statAlumnosSinPases').textContent = sinPases;
    if (document.getElementById('statAlumnosVencidos')) document.getElementById('statAlumnosVencidos').textContent = vencidos;
}

let serviciosAlumnoEnEdicion = [];

function renderTablaAlumnos() {
    const tbody = document.getElementById('tablaAlumnosBody');
    if (!tbody) return;

    const query = (document.getElementById('inputBuscarAlumno')?.value || '').toLowerCase().trim();

    let filtrados = allClientes.filter(c => {
        // Filtro por búsqueda
        const matchQuery = !query || 
            c.nombre_completo.toLowerCase().includes(query) || 
            c.email.toLowerCase().includes(query) || 
            (c.telefono && c.telefono.toLowerCase().includes(query));

        // Filtro por estado tab
        const matchEstado = filtroActual === 'todos' || c.estado_calculado === filtroActual;

        return matchQuery && matchEstado;
    });

    if (filtrados.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="py-12 text-center text-slate-400">
                    <span class="material-symbols-outlined text-4xl mb-2 text-slate-300">person_off</span>
                    <p class="font-bold text-slate-600 text-sm">No se encontraron alumnos</p>
                    <p class="text-xs text-slate-400 mt-0.5">Probá cambiando la búsqueda o cargá un nuevo alumno.</p>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = filtrados.map(c => {
        let badgeHtml = '';
        if (c.estado_calculado === 'vencido') {
            badgeHtml = `<span class="inline-flex items-center gap-1 bg-rose-100 text-rose-800 px-2.5 py-1 rounded-full text-[10px] font-extrabold"><span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span> Vencido</span>`;
        } else if (c.estado_calculado === 'sin_pases') {
            badgeHtml = `<span class="inline-flex items-center gap-1 bg-amber-100 text-amber-800 px-2.5 py-1 rounded-full text-[10px] font-extrabold"><span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span> Sin Pases</span>`;
        } else {
            badgeHtml = `<span class="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full text-[10px] font-extrabold"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Activo</span>`;
        }

        // Obtener lista de servicios asignados (soporte para múltiples servicios o legado)
        let sList = [];
        try {
            if (typeof c.servicios_pases_json === 'string' && c.servicios_pases_json.trim()) {
                sList = JSON.parse(c.servicios_pases_json || '[]');
            } else if (Array.isArray(c.servicios_pases_json)) {
                sList = c.servicios_pases_json;
            }
        } catch(e) { sList = []; }

        if (!Array.isArray(sList) || sList.length === 0) {
            const legNombre = c.servicio || (c.id_servicio ? (allServicios.find(s => s.id == c.id_servicio)?.nombre || '') : '');
            if (legNombre || c.id_servicio) {
                sList = [{
                    id_servicio: c.id_servicio,
                    servicio: legNombre,
                    etiqueta_pase: '',
                    pases_disponibles: c.pases_disponibles,
                    pases_totales: c.pases_totales || c.pases_disponibles,
                    fecha_vencimiento: c.fecha_vencimiento
                }];
            }
        }

        let serviciosBadgesHtml = '';
        if (sList.length > 0) {
            serviciosBadgesHtml = sList.map(s => {
                const sNom = s.servicio || (allServicios.find(x => x.id == s.id_servicio)?.nombre || 'Servicio');
                const tag = s.etiqueta_pase ? `<span class="text-orange-600 font-bold ml-1">🏷️ ${escapeHtml(s.etiqueta_pase)}</span>` : '';
                const pDisp = s.pases_disponibles ?? 0;
                const pTot = s.pases_totales ?? pDisp;
                return `
                    <div class="inline-flex items-center gap-1.5 bg-orange-50/90 text-orange-950 border border-orange-200/80 px-2.5 py-1 rounded-lg text-[10px] font-extrabold mr-1.5 mb-1 shadow-2xs">
                        <span class="material-symbols-outlined text-[13px] text-orange-600 shrink-0">fitness_center</span>
                        <span>${escapeHtml(sNom)}</span>
                        ${tag}
                        <span class="bg-white/80 border border-orange-200 text-orange-800 px-1.5 py-0.2 rounded-md font-black">${pDisp}/${pTot}</span>
                    </div>
                `;
            }).join('');
        } else {
            serviciosBadgesHtml = `<button type="button" onclick="editarCliente(${c.id})" class="inline-flex items-center gap-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300/80 px-2 py-0.5 rounded-md text-[10px] font-extrabold mt-0.5 transition-colors" title="Haz click para asignarle un servicio"><span class="material-symbols-outlined text-[12px]">add_link</span> Sin servicio (Asignar)</button>`;
        }

        const vencText = c.fecha_vencimiento ? formatearFecha(c.fecha_vencimiento) : 'Sin Vencimiento';

        return `
            <tr class="hover:bg-slate-50/80 transition-colors">
                <td class="py-4 px-6">
                    <div class="flex items-start gap-3">
                        <div class="w-9 h-9 rounded-xl bg-orange-100 text-orange-700 font-extrabold flex items-center justify-center text-sm shrink-0 mt-0.5">
                            ${c.nombre_completo.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <strong class="text-slate-900 font-bold block text-xs sm:text-sm mb-1">${c.nombre_completo}</strong>
                            <div class="flex flex-wrap items-center">
                                ${serviciosBadgesHtml}
                            </div>
                            ${c.notas ? `<span class="text-[11px] text-slate-400 block line-clamp-1 mt-0.5">${escapeHtml(c.notas)}</span>` : ''}
                        </div>
                    </div>
                </td>
                <td class="py-4 px-6">
                    <div class="text-slate-700 font-medium">${c.email}</div>
                    ${c.telefono ? `<div class="text-slate-400 text-[11px]">${c.telefono}</div>` : ''}
                </td>
                <td class="py-4 px-6">
                    <div class="flex items-center gap-2">
                        <span class="text-sm font-extrabold text-slate-900">${c.pases_disponibles}</span>
                        <span class="text-[11px] text-slate-400 font-semibold">de ${c.pases_totales || c.pases_disponibles} clases</span>
                        <button onclick="openModalAddPases(${c.id})" class="ml-1 text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 p-1 rounded-lg transition-colors cursor-pointer" title="Añadir clases o renovar pases">
                            <span class="material-symbols-outlined text-[16px]">add_circle</span>
                        </button>
                    </div>
                    ${sList.length > 1 ? `<span class="text-[10px] text-slate-400 font-bold block mt-0.5">${sList.length} servicios asignados</span>` : ''}
                </td>
                <td class="py-4 px-6 font-medium text-slate-600">
                    ${vencText}
                </td>
                <td class="py-4 px-6 text-center">
                    ${badgeHtml}
                </td>
                <td class="py-4 px-6 text-right">
                    <div class="flex items-center justify-end gap-1.5">
                        <button onclick="editarCliente(${c.id})" class="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer" title="Editar Alumno">
                            <span class="material-symbols-outlined text-[18px]">edit</span>
                        </button>
                        <button onclick="eliminarCliente(${c.id}, '${escapeHtml(c.nombre_completo)}')" class="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer" title="Eliminar Alumno">
                            <span class="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function poblarServiciosDropdowns() {
    const selInvite = document.getElementById('inviteModalServicio');
    if (selInvite) {
        const currentVal = selInvite.value;
        let html = '<option value="">-- Seleccionar Servicio --</option>';
        allServicios.forEach(s => {
            html += `<option value="${s.id}">${escapeHtml(s.nombre)}</option>`;
        });
        selInvite.innerHTML = html;
        if (currentVal) {
            selInvite.value = currentVal;
        } else if (allServicios.length === 1) {
            selInvite.value = allServicios[0].id;
        }
    }
}

function obtenerPaquetesDeServicio(servId) {
    if (!servId) return [];
    const serv = allServicios.find(s => s.id == servId);
    if (!serv) return [];

    let pkgs = [];
    try {
        if (typeof serv.precios_paquetes_json === 'string') {
            pkgs = JSON.parse(serv.precios_paquetes_json || '[]');
        } else if (Array.isArray(serv.precios_paquetes_json)) {
            pkgs = serv.precios_paquetes_json;
        }
    } catch(e) { pkgs = []; }

    return Array.isArray(pkgs) ? pkgs.filter(p => parseInt(p.cupos, 10) > 0) : [];
}

// -------------------------------------------------------------
// MANEJO DE FILAS DINÁMICAS DE SERVICIOS Y PASES EN EL MODAL
// -------------------------------------------------------------
function renderServiciosAlumnoRows() {
    const container = document.getElementById('serviciosAlumnoLista');
    if (!container) return;

    if (serviciosAlumnoEnEdicion.length === 0) {
        container.innerHTML = `
            <div class="p-4 bg-amber-50/70 border border-amber-200 rounded-2xl text-center">
                <span class="material-symbols-outlined text-amber-600 text-2xl mb-1">warning</span>
                <p class="text-xs font-bold text-amber-900">No se ha asignado ningún servicio al alumno.</p>
                <p class="text-[11px] text-amber-700 mt-0.5">Haz click en "+ Asignar Servicio" para configurar sus clases.</p>
            </div>
        `;
        return;
    }

    const defaultVencDate = new Date();
    defaultVencDate.setDate(defaultVencDate.getDate() + 30);
    const defaultVencIso = defaultVencDate.toISOString().split('T')[0];

    container.innerHTML = serviciosAlumnoEnEdicion.map((item, idx) => {
        const pkgs = obtenerPaquetesDeServicio(item.id_servicio);
        const totalRows = serviciosAlumnoEnEdicion.length;

        // Opciones del selector de servicios
        let servOptionsHtml = `<option value="">-- Seleccionar Servicio --</option>`;
        allServicios.forEach(s => {
            const isSel = s.id == item.id_servicio ? 'selected' : '';
            const cupoText = s.cupo_maximo ? `${s.cupo_maximo} cupos` : '1 cupo';
            servOptionsHtml += `<option value="${s.id}" ${isSel}>${escapeHtml(s.nombre)} (${cupoText})</option>`;
        });

        // Opciones del selector de paquetes con etiquetas configuradas por el negocio
        let paqOptionsHtml = `<option value="">-- Seleccionar Paquete / Pase --</option>`;
        let matchedPkg = false;

        if (pkgs.length > 0) {
            pkgs.forEach(p => {
                const cupos = parseInt(p.cupos, 10);
                const precio = parseFloat(p.precio || 0);
                const precioFmt = precio > 0 ? ` - $${precio.toLocaleString('es-AR')}` : '';
                
                // Si el negocio configuró una etiqueta personalizada para el pase (ej: "Pase 8 Clases", "Plan Mensual 12 Clases")
                let textoOpcion = '';
                if (p.etiqueta && p.etiqueta.trim()) {
                    textoOpcion = `🏷️ ${escapeHtml(p.etiqueta)} (${cupos} clases${precioFmt})`;
                } else {
                    textoOpcion = `📦 Paquete ${cupos} clases${precioFmt}`;
                }

                // Identificar si coincide con la opción seleccionada
                const isSelected = (!item.es_manual && (
                    (item.etiqueta_pase && item.etiqueta_pase === p.etiqueta) || 
                    (!item.etiqueta_pase && parseInt(item.pases_disponibles, 10) === cupos)
                ));

                if (isSelected) matchedPkg = true;

                paqOptionsHtml += `<option value="${cupos}" data-etiqueta="${escapeHtml(p.etiqueta || '')}" data-precio="${precio}" ${isSelected ? 'selected' : ''}>${textoOpcion}</option>`;
            });
        }

        const isManualSelected = item.es_manual || (!matchedPkg && item.pases_disponibles !== undefined && item.pases_disponibles !== null);
        paqOptionsHtml += `<option value="manual" ${isManualSelected ? 'selected' : ''}>✍️ Carga Manual / Personalizada</option>`;

        const pasesDisp = item.pases_disponibles !== undefined && item.pases_disponibles !== null ? item.pases_disponibles : 4;
        const vencVal = item.fecha_vencimiento || defaultVencIso;

        return `
            <div class="p-3.5 bg-white border border-orange-200/90 rounded-2xl shadow-2xs space-y-3 relative group" id="filaServicioAlumno_${idx}">
                <!-- Encabezado de la Fila -->
                <div class="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div class="flex items-center gap-2">
                        <span class="w-5 h-5 rounded-full bg-orange-100 text-orange-700 text-[11px] font-black flex items-center justify-center shrink-0">${idx + 1}</span>
                        <span class="text-xs font-extrabold text-slate-800">Servicio y Pases</span>
                        ${item.etiqueta_pase ? `<span class="bg-amber-100 text-amber-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full truncate max-w-[170px]">🏷️ ${escapeHtml(item.etiqueta_pase)}</span>` : ''}
                    </div>

                    ${totalRows > 1 ? `
                        <button type="button" onclick="eliminarFilaServicioAlumno(${idx})" class="text-rose-500 hover:text-rose-700 hover:bg-rose-50 px-2 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer" title="Quitar este servicio">
                            <span class="material-symbols-outlined text-[14px]">delete</span> Quitar
                        </button>
                    ` : ''}
                </div>

                <!-- Selector de Servicio -->
                <div>
                    <label class="block text-[11px] font-bold text-slate-700 mb-1">Servicio Asignado *</label>
                    <select onchange="onServicioRowChange(${idx}, this.value)" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-extrabold text-slate-900 focus:ring-2 focus:ring-orange-500 outline-none">
                        ${servOptionsHtml}
                    </select>
                </div>

                <!-- Selector de Paquetes / Pases con Etiquetas -->
                ${item.id_servicio ? `
                    <div>
                        <label class="block text-[11px] font-bold text-slate-700 mb-1">Pase / Paquete Configurado del Servicio</label>
                        <select onchange="onPaqueteRowChange(${idx}, this)" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-extrabold text-slate-900 focus:ring-2 focus:ring-orange-500 outline-none">
                            ${paqOptionsHtml}
                        </select>
                        <span class="text-[10px] text-slate-400 mt-1 block">Muestra los pases y etiquetas comerciales que definiste en la configuración de este servicio.</span>
                    </div>
                ` : ''}

                <!-- Grilla de Clases y Vencimiento -->
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                        <label class="block text-[11px] font-bold text-slate-700 mb-1">Clases / Créditos Acreditados *</label>
                        <div class="relative">
                            <input type="number" min="0" value="${pasesDisp}" oninput="onManualPasesRowInput(${idx}, this.value)" class="w-full bg-slate-50 border border-slate-200 rounded-xl pl-3.5 pr-12 py-2 text-xs font-extrabold text-slate-900 focus:ring-2 focus:ring-orange-500 outline-none" required>
                            <span class="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">clases</span>
                        </div>
                    </div>
                    <div>
                        <label class="block text-[11px] font-bold text-slate-700 mb-1">Fecha de Vencimiento del Pase</label>
                        <input type="date" value="${vencVal}" onchange="onVencimientoRowInput(${idx}, this.value)" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-orange-500 outline-none">
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function agregarFilaServicioAlumno(data = null) {
    if (data) {
        serviciosAlumnoEnEdicion.push(data);
    } else {
        // Encontrar un servicio no asignado todavía o el primero disponible
        let nuevoServId = '';
        let nuevoServNombre = '';
        if (allServicios.length > 0) {
            const yaAsignados = serviciosAlumnoEnEdicion.map(s => String(s.id_servicio));
            const disponible = allServicios.find(s => !yaAsignados.includes(String(s.id)));
            const selServ = disponible || allServicios[0];
            nuevoServId = selServ.id;
            nuevoServNombre = selServ.nombre;
        }

        const pkgs = obtenerPaquetesDeServicio(nuevoServId);
        let cuposIni = 8;
        let etiquetaIni = '';
        if (pkgs.length > 0) {
            cuposIni = parseInt(pkgs[0].cupos, 10);
            etiquetaIni = pkgs[0].etiqueta || `Pase ${cuposIni} Clases`;
        }

        const defaultDate = new Date();
        defaultDate.setDate(defaultDate.getDate() + 30);

        serviciosAlumnoEnEdicion.push({
            id_servicio: nuevoServId,
            servicio: nuevoServNombre,
            etiqueta_pase: etiquetaIni,
            pases_disponibles: cuposIni,
            pases_totales: cuposIni,
            fecha_vencimiento: defaultDate.toISOString().split('T')[0],
            es_manual: false
        });
    }

    renderServiciosAlumnoRows();
}

function eliminarFilaServicioAlumno(idx) {
    if (serviciosAlumnoEnEdicion.length <= 1) return;
    serviciosAlumnoEnEdicion.splice(idx, 1);
    renderServiciosAlumnoRows();
}

function onServicioRowChange(idx, newServId) {
    if (!serviciosAlumnoEnEdicion[idx]) return;

    const serv = allServicios.find(s => s.id == newServId);
    serviciosAlumnoEnEdicion[idx].id_servicio = newServId ? parseInt(newServId, 10) : null;
    serviciosAlumnoEnEdicion[idx].servicio = serv ? serv.nombre : '';

    const pkgs = obtenerPaquetesDeServicio(newServId);
    if (pkgs.length > 0) {
        const p0 = pkgs[0];
        const c = parseInt(p0.cupos, 10);
        serviciosAlumnoEnEdicion[idx].pases_disponibles = c;
        serviciosAlumnoEnEdicion[idx].pases_totales = c;
        serviciosAlumnoEnEdicion[idx].etiqueta_pase = p0.etiqueta || `Pase ${c} Clases`;
        serviciosAlumnoEnEdicion[idx].es_manual = false;
    } else {
        serviciosAlumnoEnEdicion[idx].pases_disponibles = 4;
        serviciosAlumnoEnEdicion[idx].pases_totales = 4;
        serviciosAlumnoEnEdicion[idx].etiqueta_pase = 'Manual';
        serviciosAlumnoEnEdicion[idx].es_manual = true;
    }

    renderServiciosAlumnoRows();
}

function onPaqueteRowChange(idx, selectEl) {
    if (!serviciosAlumnoEnEdicion[idx] || !selectEl) return;

    const val = selectEl.value;
    if (val === 'manual') {
        serviciosAlumnoEnEdicion[idx].es_manual = true;
        serviciosAlumnoEnEdicion[idx].etiqueta_pase = 'Manual';
        renderServiciosAlumnoRows();
    } else if (val) {
        const selectedOpt = selectEl.options[selectEl.selectedIndex];
        const etq = selectedOpt ? selectedOpt.getAttribute('data-etiqueta') : '';
        const cupos = parseInt(val, 10);

        serviciosAlumnoEnEdicion[idx].es_manual = false;
        serviciosAlumnoEnEdicion[idx].pases_disponibles = cupos;
        serviciosAlumnoEnEdicion[idx].pases_totales = cupos;
        serviciosAlumnoEnEdicion[idx].etiqueta_pase = etq || `Pase ${cupos} Clases`;
        renderServiciosAlumnoRows();
    }
}

function onManualPasesRowInput(idx, val) {
    if (!serviciosAlumnoEnEdicion[idx]) return;
    const num = Math.max(0, parseInt(val || 0, 10));
    serviciosAlumnoEnEdicion[idx].pases_disponibles = num;
    serviciosAlumnoEnEdicion[idx].pases_totales = num;
}

function onVencimientoRowInput(idx, val) {
    if (!serviciosAlumnoEnEdicion[idx]) return;
    serviciosAlumnoEnEdicion[idx].fecha_vencimiento = val || null;
}

function openModalCliente(cliente = null) {
    if (!isPremiumAccount) {
        showPremiumModalNotice();
        return;
    }
    const form = document.getElementById('formCliente');
    if (form) form.reset();

    poblarServiciosDropdowns();
    serviciosAlumnoEnEdicion = [];

    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() + 30);
    const defaultDateStr = defaultDate.toISOString().split('T')[0];

    if (cliente) {
        document.getElementById('modalClienteTitle').textContent = 'Editar Alumno';
        document.getElementById('clienteId').value = cliente.id;
        document.getElementById('clienteNombre').value = cliente.nombre_completo || '';
        document.getElementById('clienteEmail').value = cliente.email || '';
        document.getElementById('clienteTelefono').value = cliente.telefono || '';
        document.getElementById('clienteNotas').value = cliente.notas || '';

        // Cargar múltiples servicios del alumno si existen en servicios_pases_json
        let sList = [];
        try {
            if (typeof cliente.servicios_pases_json === 'string' && cliente.servicios_pases_json.trim()) {
                sList = JSON.parse(cliente.servicios_pases_json || '[]');
            } else if (Array.isArray(cliente.servicios_pases_json)) {
                sList = cliente.servicios_pases_json;
            }
        } catch(e) { sList = []; }

        if (Array.isArray(sList) && sList.length > 0) {
            serviciosAlumnoEnEdicion = sList.map(s => ({
                id_servicio: s.id_servicio,
                servicio: s.servicio || (allServicios.find(x => x.id == s.id_servicio)?.nombre || ''),
                etiqueta_pase: s.etiqueta_pase || '',
                pases_disponibles: s.pases_disponibles !== undefined ? parseInt(s.pases_disponibles, 10) : 0,
                pases_totales: s.pases_totales !== undefined ? parseInt(s.pases_totales, 10) : (s.pases_disponibles || 0),
                fecha_vencimiento: s.fecha_vencimiento || cliente.fecha_vencimiento || defaultDateStr,
                es_manual: false
            }));
        } else if (cliente.id_servicio || cliente.servicio) {
            let sId = cliente.id_servicio || '';
            if (!sId && cliente.servicio) {
                const found = allServicios.find(s => s.nombre.toLowerCase().trim() === cliente.servicio.toLowerCase().trim());
                if (found) sId = found.id;
            }
            serviciosAlumnoEnEdicion = [{
                id_servicio: sId ? parseInt(sId, 10) : null,
                servicio: cliente.servicio || (allServicios.find(x => x.id == sId)?.nombre || ''),
                etiqueta_pase: '',
                pases_disponibles: cliente.pases_disponibles !== undefined ? parseInt(cliente.pases_disponibles, 10) : 0,
                pases_totales: cliente.pases_totales !== undefined ? parseInt(cliente.pases_totales, 10) : (cliente.pases_disponibles || 0),
                fecha_vencimiento: cliente.fecha_vencimiento || defaultDateStr,
                es_manual: false
            }];
        } else {
            // Sin servicio previo: crear una fila limpia
            agregarFilaServicioAlumno();
        }
    } else {
        document.getElementById('modalClienteTitle').textContent = 'Cargar Nuevo Alumno';
        document.getElementById('clienteId').value = '';
        agregarFilaServicioAlumno();
    }

    renderServiciosAlumnoRows();

    const modal = document.getElementById('modalCliente');
    if (modal) modal.classList.remove('hidden');
}

function closeModalCliente() {
    const modal = document.getElementById('modalCliente');
    if (modal) modal.classList.add('hidden');
    serviciosAlumnoEnEdicion = [];
}

function guardarCliente(e) {
    e.preventDefault();
    if (!isPremiumAccount) {
        showPremiumModalNotice();
        return;
    }
    const btn = document.getElementById('btnGuardarCliente');
    if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }

    // Asegurar que al menos un servicio tenga id_servicio seleccionado si hay servicios en la cuenta
    if (allServicios.length > 0) {
        const algunValido = serviciosAlumnoEnEdicion.some(s => s.id_servicio);
        if (!algunValido) {
            if (btn) { btn.disabled = false; btn.textContent = 'Guardar Alumno'; }
            if (typeof showToast === 'function') showToast('Debes seleccionar al menos un servicio para asignar al alumno.', 'error');
            return;
        }
    }

    // Filtrar servicios vacíos sin servicio seleccionado si hay más de 1
    const serviciosFiltrados = serviciosAlumnoEnEdicion.filter(s => s.id_servicio || serviciosAlumnoEnEdicion.length === 1);

    const payload = {
        id: document.getElementById('clienteId')?.value || null,
        nombre_completo: document.getElementById('clienteNombre')?.value || '',
        email: document.getElementById('clienteEmail')?.value || '',
        telefono: document.getElementById('clienteTelefono')?.value || '',
        notas: document.getElementById('clienteNotas')?.value || '',
        servicios_asignados: serviciosFiltrados
    };

    fetch('backend/gestionar_clientes.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
    .then(r => r.json())
    .then(d => {
        if (btn) { btn.disabled = false; btn.textContent = 'Guardar Alumno'; }
        if (d.success) {
            closeModalCliente();
            if (typeof showToast === 'function') showToast(payload.id ? 'Alumno actualizado con éxito.' : 'Nuevo alumno cargado con éxito.', 'success');
            cargarClientes();
        } else {
            if (typeof showToast === 'function') showToast(d.error || 'Error al guardar alumno', 'error');
        }
    })
    .catch(err => {
        if (btn) { btn.disabled = false; btn.textContent = 'Guardar Alumno'; }
        console.error('Error:', err);
    });
}

function filtrarAlumnos() {
    renderTablaAlumnos();
}

function filtrarEstado(estado) {
    filtroActual = estado;
    ['btnFiltroTodos', 'btnFiltroActivos', 'btnFiltroSinPases', 'btnFiltroVencidos'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.className = 'px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all';
    });

    if (estado === 'todos') document.getElementById('btnFiltroTodos').className = 'px-3.5 py-2 rounded-xl text-xs font-extrabold bg-slate-900 text-white shadow-sm transition-all';
    if (estado === 'activo') document.getElementById('btnFiltroActivos').className = 'px-3.5 py-2 rounded-xl text-xs font-extrabold bg-emerald-600 text-white shadow-sm transition-all';
    if (estado === 'sin_pases') document.getElementById('btnFiltroSinPases').className = 'px-3.5 py-2 rounded-xl text-xs font-extrabold bg-amber-600 text-white shadow-sm transition-all';
    if (estado === 'vencido') document.getElementById('btnFiltroVencidos').className = 'px-3.5 py-2 rounded-xl text-xs font-extrabold bg-rose-600 text-white shadow-sm transition-all';

    renderTablaAlumnos();
}

function editarCliente(id) {
    const cliente = allClientes.find(c => c.id == id);
    if (cliente) openModalCliente(cliente);
}

let clienteIdAEliminar = null;

function eliminarCliente(id, nombre) {
    if (!isPremiumAccount) {
        showPremiumModalNotice();
        return;
    }
    clienteIdAEliminar = id;
    const inputId = document.getElementById('deleteAlumnoId');
    const txtNombre = document.getElementById('deleteAlumnoNombreText');
    const modal = document.getElementById('modalConfirmDeleteAlumno');

    if (inputId) inputId.value = id;
    if (txtNombre) txtNombre.innerHTML = escapeHtml(nombre);

    if (modal) {
        modal.classList.remove('hidden');
    } else {
        ejecutarEliminarAlumno(id);
    }
}

function closeModalConfirmDeleteAlumno() {
    clienteIdAEliminar = null;
    const modal = document.getElementById('modalConfirmDeleteAlumno');
    if (modal) modal.classList.add('hidden');
}

function ejecutarEliminarAlumno(idOverride = null) {
    const id = idOverride || clienteIdAEliminar || document.getElementById('deleteAlumnoId')?.value;
    if (!id) return;

    const btn = document.getElementById('btnConfirmDeleteAlumno');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<span class="material-symbols-outlined text-[18px] animate-spin">progress_activity</span> Eliminando...`;
    }

    fetch('backend/gestionar_clientes.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `action=delete&id=${encodeURIComponent(id)}`
    })
    .then(r => r.json())
    .then(d => {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `<span class="material-symbols-outlined text-[18px]">delete</span> Sí, Eliminar`;
        }
        closeModalConfirmDeleteAlumno();
        if (d.success) {
            if (typeof showToast === 'function') showToast('Alumno eliminado correctamente.', 'success');
            cargarClientes();
        } else {
            if (typeof showToast === 'function') showToast(d.error || 'Error al eliminar alumno', 'error');
        }
    })
    .catch(err => {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `<span class="material-symbols-outlined text-[18px]">delete</span> Sí, Eliminar`;
        }
        closeModalConfirmDeleteAlumno();
        console.error('Error al eliminar alumno:', err);
        if (typeof showToast === 'function') showToast('Error al conectar con el servidor para eliminar.', 'error');
    });
}

// -------------------------------------------------------------
// MODAL RECARGA RÁPIDA DE PASES (CON SOPORTE MULTI-SERVICIO)
// -------------------------------------------------------------
let currentAddPasesCliente = null;

function openModalAddPases(id, nombreOverride = null) {
    if (!isPremiumAccount) {
        showPremiumModalNotice();
        return;
    }

    const cliente = allClientes.find(c => c.id == id);
    if (!cliente) return;
    currentAddPasesCliente = cliente;

    const alumnoNombre = cliente.nombre_completo || (nombreOverride || '');
    document.getElementById('addPasesClienteId').value = id;
    document.getElementById('addPasesNombreAlumno').textContent = `Alumno: ${alumnoNombre}`;

    // Obtener servicios asignados al alumno
    let sList = [];
    try {
        if (typeof cliente.servicios_pases_json === 'string' && cliente.servicios_pases_json.trim()) {
            sList = JSON.parse(cliente.servicios_pases_json || '[]');
        } else if (Array.isArray(cliente.servicios_pases_json)) {
            sList = cliente.servicios_pases_json;
        }
    } catch(e) { sList = []; }

    const selectorContainer = document.getElementById('addPasesSelectorServicioContainer');
    const selectServ = document.getElementById('addPasesServicioSelect');

    let targetServId = null;

    if (Array.isArray(sList) && sList.length > 1) {
        // Alumno con múltiples servicios asignados: mostrar selector de servicio
        if (selectorContainer && selectServ) {
            let optsHtml = '';
            sList.forEach((s, idx) => {
                const sNom = s.servicio || (allServicios.find(x => x.id == s.id_servicio)?.nombre || `Servicio ${idx + 1}`);
                const pDisp = s.pases_disponibles ?? 0;
                const pTot = s.pases_totales ?? pDisp;
                optsHtml += `<option value="${s.id_servicio}">${escapeHtml(sNom)} (${pDisp}/${pTot} clases)</option>`;
            });
            selectServ.innerHTML = optsHtml;
            selectorContainer.classList.remove('hidden');
            targetServId = sList[0].id_servicio;
        }
    } else {
        if (selectorContainer) selectorContainer.classList.add('hidden');
        if (sList.length === 1 && sList[0].id_servicio) {
            targetServId = sList[0].id_servicio;
        } else {
            targetServId = cliente.id_servicio || null;
        }
    }

    renderAddPasesUI(cliente, targetServId);

    // Reset sección manual
    const sec = document.getElementById('sectionCustomPases');
    if (sec) sec.classList.add('hidden');
    const inp = document.getElementById('inputCustomPases');
    if (inp) inp.value = '';

    const modal = document.getElementById('modalAddPases');
    if (modal) modal.classList.remove('hidden');
}

function onAddPasesServicioSelectedChange() {
    const selectServ = document.getElementById('addPasesServicioSelect');
    const targetServId = selectServ ? selectServ.value : null;
    if (currentAddPasesCliente) {
        renderAddPasesUI(currentAddPasesCliente, targetServId);
    }
}

function renderAddPasesUI(cliente, targetServId) {
    // Buscar datos del servicio seleccionado dentro del alumno o de allServicios
    let servItemInAlumno = null;
    try {
        let sList = [];
        if (typeof cliente.servicios_pases_json === 'string' && cliente.servicios_pases_json.trim()) {
            sList = JSON.parse(cliente.servicios_pases_json || '[]');
        } else if (Array.isArray(cliente.servicios_pases_json)) {
            sList = cliente.servicios_pases_json;
        }
        if (Array.isArray(sList) && sList.length > 0) {
            servItemInAlumno = sList.find(s => String(s.id_servicio) === String(targetServId)) || sList[0];
        }
    } catch(e) {}

    let serv = targetServId ? allServicios.find(s => String(s.id) === String(targetServId)) : null;
    if (!serv && cliente.servicio) {
        serv = allServicios.find(s => s.nombre.toLowerCase().trim() === cliente.servicio.toLowerCase().trim());
    }

    const elServicio = document.getElementById('addPasesServicioAlumno');
    if (elServicio) {
        if (serv) {
            elServicio.innerHTML = `Servicio: <strong class="text-slate-700">${escapeHtml(serv.nombre)}</strong>`;
        } else if (servItemInAlumno && servItemInAlumno.servicio) {
            elServicio.innerHTML = `Servicio: <strong class="text-slate-700">${escapeHtml(servItemInAlumno.servicio)}</strong>`;
        } else if (cliente.servicio) {
            elServicio.innerHTML = `Servicio: <strong class="text-slate-700">${escapeHtml(cliente.servicio)}</strong>`;
        } else {
            elServicio.innerHTML = `Servicio: <span class="text-slate-400 italic">General / No asignado</span>`;
        }
    }

    // Mostrar estado y balance actual del servicio seleccionado o general
    const elBalance = document.getElementById('addPasesBalanceActualText');
    if (elBalance) {
        const disp = servItemInAlumno ? servItemInAlumno.pases_disponibles : cliente.pases_disponibles;
        const tot = servItemInAlumno ? (servItemInAlumno.pases_totales || servItemInAlumno.pases_disponibles) : (cliente.pases_totales || cliente.pases_disponibles);
        elBalance.innerHTML = `${disp} <span class="text-xs font-semibold text-slate-400">de ${tot} clases</span>`;
    }

    const elVenc = document.getElementById('addPasesVencimientoActualText');
    if (elVenc) {
        const venc = servItemInAlumno && servItemInAlumno.fecha_vencimiento ? servItemInAlumno.fecha_vencimiento : cliente.fecha_vencimiento;
        elVenc.textContent = venc ? formatearFecha(venc) : 'Sin vencimiento';
    }

    // Poblar botones dinámicos de pases del servicio
    const containerBotones = document.getElementById('addPasesBotonesContainer');
    if (containerBotones) {
        let botones = [];

        if (serv) {
            let pkgs = [];
            try {
                if (typeof serv.precios_paquetes_json === 'string') {
                    pkgs = JSON.parse(serv.precios_paquetes_json || '[]');
                } else if (Array.isArray(serv.precios_paquetes_json)) {
                    pkgs = serv.precios_paquetes_json;
                }
            } catch(e) { pkgs = []; }

            if (Array.isArray(pkgs)) {
                pkgs.forEach(p => {
                    const c = parseInt(p.cupos, 10);
                    if (c > 0 && !botones.some(b => b.cupos === c)) {
                        const precioFmt = p.precio ? `$${parseFloat(p.precio).toLocaleString('es-AR')}` : '';
                        const etqFmt = p.etiqueta ? p.etiqueta : (precioFmt ? precioFmt : 'Paquete');
                        botones.push({
                            cupos: c,
                            label: `+${c}`,
                            sub: etqFmt,
                            color: 'purple'
                        });
                    }
                });
            }
        }

        let botonesHtml = '';

        if (!serv && !servItemInAlumno) {
            botonesHtml += `
                <div class="col-span-2 p-3 bg-amber-50 border border-amber-200 rounded-xl mb-1 text-center">
                    <p class="text-xs text-amber-800 font-bold mb-1">Este alumno no tiene servicio asignado.</p>
                    <button type="button" onclick="closeModalAddPases(); editarCliente(${cliente.id});" class="text-xs text-orange-600 hover:text-orange-700 font-extrabold underline inline-flex items-center gap-1 cursor-pointer">
                        <span class="material-symbols-outlined text-[14px]">edit</span> Asignar servicio ahora
                    </button>
                </div>
            `;
        } else if (botones.length === 0) {
            botonesHtml += `
                <div class="col-span-2 p-3 bg-slate-50 border border-slate-200 rounded-xl mb-1 text-center">
                    <p class="text-xs text-slate-500 font-medium">El servicio no tiene paquetes de clases configurados.</p>
                    <p class="text-[11px] text-slate-400 mt-0.5">Podés ingresar la cantidad deseada con el botón Carga Manual.</p>
                </div>
            `;
        }

        if (botones.length > 0) {
            botonesHtml += botones.map(b => `
                <button type="button" onclick="confirmAddPases(${b.cupos})" class="p-3 rounded-2xl border-2 border-slate-200 hover:border-emerald-500 hover:bg-emerald-50 text-slate-800 font-extrabold text-sm transition-all flex flex-col items-center gap-0.5 group cursor-pointer">
                    <span class="text-base text-emerald-600 group-hover:scale-110 transition-transform">${b.label}</span>
                    <span class="text-[10px] font-bold text-slate-500 truncate max-w-full">${escapeHtml(b.sub)}</span>
                </button>
            `).join('');
        }

        // Botón Carga Manual
        const colSpanClass = (botones.length === 0) ? 'col-span-2' : '';
        botonesHtml += `
            <button type="button" onclick="toggleCustomPasesInput()" id="btnToggleCustomPases" class="${colSpanClass} p-3 rounded-2xl border-2 border-slate-200 hover:border-orange-500 hover:bg-orange-50 text-slate-800 font-extrabold text-sm transition-all flex flex-col items-center justify-center gap-0.5 group cursor-pointer">
                <span class="text-base text-orange-600 group-hover:scale-110 transition-transform">+Otro</span>
                <span class="text-[10px] font-bold text-slate-500 uppercase">Carga Manual</span>
            </button>
        `;

        containerBotones.innerHTML = botonesHtml;
    }
}

function closeModalAddPases() {
    currentAddPasesCliente = null;
    const modal = document.getElementById('modalAddPases');
    if (modal) modal.classList.add('hidden');
    const sec = document.getElementById('sectionCustomPases');
    if (sec) sec.classList.add('hidden');
}

function toggleCustomPasesInput() {
    const sec = document.getElementById('sectionCustomPases');
    const inp = document.getElementById('inputCustomPases');
    if (sec) {
        sec.classList.toggle('hidden');
        if (!sec.classList.contains('hidden') && inp) {
            inp.focus();
        }
    }
}

function submitCustomPases() {
    const inp = document.getElementById('inputCustomPases');
    const val = parseInt(inp ? inp.value : 0, 10);
    if (!val || val <= 0) {
        if (typeof showToast === 'function') {
            showToast('Por favor, ingresa una cantidad válida de clases (mayor a 0).', 'error');
        }
        if (inp) inp.focus();
        return;
    }
    confirmAddPases(val);
}

function confirmAddPases(cant) {
    const id = document.getElementById('addPasesClienteId')?.value;
    if (!id || !cant) return;

    const selectServ = document.getElementById('addPasesServicioSelect');
    const targetServId = selectServ && !selectServ.closest('#addPasesSelectorServicioContainer')?.classList.contains('hidden') ? selectServ.value : null;

    fetch('backend/gestionar_clientes.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add_pases', id: id, cantidad: cant, id_servicio: targetServId })
    })
    .then(r => r.json())
    .then(d => {
        closeModalAddPases();
        if (d.success) {
            if (typeof showToast === 'function') showToast(d.message || `Se sumaron +${cant} clases al alumno.`, 'success');
            cargarClientes();
        } else {
            if (typeof showToast === 'function') showToast(d.error || 'Error al agregar clases', 'error');
        }
    })
    .catch(err => {
        closeModalAddPases();
        console.error('Error al agregar clases:', err);
        if (typeof showToast === 'function') showToast('Error al conectar con el servidor.', 'error');
    });
}

function promptCustomPases() {
    // Compatibilidad en caso de llamada residual
    toggleCustomPasesInput();
}

function formatearFecha(f) {
    if (!f) return '';
    const parts = f.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return f;
}

function escapeHtml(str) {
    return String(str || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function actualizarEnlaceUnicoView() {
    const elModal = document.getElementById('modalInputEnlaceUnicoText');
    const selInvite = document.getElementById('inviteModalServicio');
    const selectedServId = selInvite ? selInvite.value : '';

    if (!selectedServId) {
        if (elModal) elModal.textContent = 'Seleccioná un servicio arriba para generar el enlace...';
        return;
    }

    if (negocioRutaUnica) {
        const fullUrl = `${window.location.origin}/alumno.html?unirse=${encodeURIComponent(negocioRutaUnica)}&s=${encodeURIComponent(selectedServId)}`;
        if (elModal) elModal.textContent = fullUrl;
    } else {
        if (elModal) elModal.textContent = 'Enlace no disponible';
    }
}

function openModalInvitarAlumnos() {
    poblarServiciosDropdowns();
    actualizarEnlaceUnicoView();
    const modal = document.getElementById('modalInvitarAlumnos');
    if (modal) modal.classList.remove('hidden');
}

function closeModalInvitarAlumnos() {
    const modal = document.getElementById('modalInvitarAlumnos');
    if (modal) modal.classList.add('hidden');
}

function copiarEnlaceUnicoModal() {
    copiarEnlaceUnico();
}

function copiarEnlaceUnico() {
    if (!negocioRutaUnica) return;
    const selInvite = document.getElementById('inviteModalServicio');
    const selectedServId = selInvite ? selInvite.value : '';
    
    if (!selectedServId) {
        if (typeof showToast === 'function') showToast('Debes seleccionar un servicio para generar el enlace de invitación.', 'error');
        if (selInvite) selInvite.focus();
        return;
    }

    const fullUrl = `${window.location.origin}/alumno.html?unirse=${encodeURIComponent(negocioRutaUnica)}&s=${encodeURIComponent(selectedServId)}`;
    
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(fullUrl).then(() => {
            if (typeof showToast === 'function') showToast('¡Enlace de registro al servicio copiado al portapapeles!', 'success');
        }).catch(() => fallbackCopiar(fullUrl));
    } else {
        fallbackCopiar(fullUrl);
    }
}

function fallbackCopiar(text) {
    const input = document.createElement('input');
    input.value = text;
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    document.body.removeChild(input);
    if (typeof showToast === 'function') showToast('¡Enlace copiado al portapapeles!', 'success');
}

function compartirWhatsAppEnlaceUnico() {
    if (!negocioRutaUnica) return;
    const selInvite = document.getElementById('inviteModalServicio');
    const selectedServId = selInvite ? selInvite.value : '';

    if (!selectedServId) {
        if (typeof showToast === 'function') showToast('Debes seleccionar un servicio antes de compartir por WhatsApp.', 'error');
        if (selInvite) selInvite.focus();
        return;
    }

    const servObj = allServicios.find(s => s.id == selectedServId);
    const servNombre = servObj ? servObj.nombre : '';

    const fullUrl = `${window.location.origin}/alumno.html?unirse=${encodeURIComponent(negocioRutaUnica)}&s=${encodeURIComponent(selectedServId)}`;
    const nom = negocioNombreUnico || 'nuestro establecimiento';
    const servText = servNombre ? ` para ${servNombre}` : '';
    const msg = `¡Hola! Podés registrarte o anotarte a nuestras clases${servText} en ${nom} a través de este enlace:\n\n${fullUrl}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, '_blank');
}




/* =========================================================
   MÓDULO DE CLASES Y CUPOS: GRILLA SEMANAL & ASISTENCIA
   ========================================================= */

let activeModuloAlumnosTab = 'padron';
let currentWeekOffset = 0;
let semanaData = {
    fecha_inicio: '',
    fecha_fin: '',
    config: {},
    servicios: [],
    turnos: []
};
let filtroClaseGrilla = 'todos';
let claseActivaModal = null;

function switchModuloAlumnosTab(tabName) {
    activeModuloAlumnosTab = tabName;
    const btnPadron = document.getElementById('tabBtnPadron');
    const btnGrilla = document.getElementById('tabBtnGrilla');
    const vistaPadron = document.getElementById('vistaPadron');
    const vistaGrilla = document.getElementById('vistaGrillaSemanal');

    if (tabName === 'padron') {
        if (btnPadron) {
            btnPadron.className = 'px-5 py-2.5 rounded-xl font-extrabold text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer bg-white text-slate-900 shadow-sm';
        }
        if (btnGrilla) {
            btnGrilla.className = 'px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer text-slate-600 hover:text-slate-900 hover:bg-white/50';
        }
        if (vistaPadron) vistaPadron.classList.remove('hidden');
        if (vistaGrilla) vistaGrilla.classList.add('hidden');
    } else {
        if (btnPadron) {
            btnPadron.className = 'px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer text-slate-600 hover:text-slate-900 hover:bg-white/50';
        }
        if (btnGrilla) {
            btnGrilla.className = 'px-5 py-2.5 rounded-xl font-extrabold text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer bg-white text-slate-900 shadow-sm';
        }
        if (vistaPadron) vistaPadron.classList.add('hidden');
        if (vistaGrilla) vistaGrilla.classList.remove('hidden');

        // Cargar clases de la semana
        cargarClasesSemana();
    }
}

function cambiarSemana(delta) {
    currentWeekOffset += delta;
    cargarClasesSemana();
}

function irSemanaActual() {
    currentWeekOffset = 0;
    cargarClasesSemana();
}

function onFiltroClaseGrillaChange() {
    const sel = document.getElementById('selectFiltroClaseGrilla');
    if (sel) {
        filtroClaseGrilla = sel.value;
        renderGrillaSemanal();
    }
}

function getRangoSemanaDates(offset) {
    const hoy = new Date();
    const dayOfWeek = hoy.getDay(); // 0 = dom, 1 = lun, etc.
    const diffToMonday = (dayOfWeek === 0 ? -6 : 1) - dayOfWeek;
    const lunes = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + diffToMonday + (offset * 7));
    
    const dias = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(lunes.getFullYear(), lunes.getMonth(), lunes.getDate() + i);
        dias.push(d);
    }
    return dias;
}

function formatLocalDateStr(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function cargarClasesSemana() {
    const dias = getRangoSemanaDates(currentWeekOffset);
    const fInicio = formatLocalDateStr(dias[0]);
    const fFin = formatLocalDateStr(dias[6]);

    // Actualizar indicador de texto de la semana
    const labelRango = document.getElementById('labelRangoSemana');
    if (labelRango) {
        const opLunes = dias[0].toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
        const opDomingo = dias[6].toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
        labelRango.textContent = `Semana del ${opLunes} al ${opDomingo}`;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const rutaFromUrl = urlParams.get('n') || '';
    const rutaFinal = negocioRutaUnica || rutaFromUrl || '';
    const nParam = rutaFinal ? `&n=${encodeURIComponent(rutaFinal)}` : '';

    fetch(`backend/gestionar_clientes.php?action=clases_semana&fecha_inicio=${fInicio}&fecha_fin=${fFin}${nParam}`)
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                semanaData = data;
                poblarFiltroClasesDropdown(data.servicios || []);
                renderGrillaSemanal();
            } else {
                console.error('Error al cargar clases de la semana:', data.error);
                if (typeof showToast === 'function') showToast(data.error || 'Error al cargar grilla de clases', 'error');
            }
        })
        .catch(err => {
            console.error('Error de red al cargar clases de la semana:', err);
        });
}

/* =========================================================
   SISTEMA CROMÁTICO Y VISUAL POR SERVICIO / ACTIVIDAD
   ========================================================= */
const PALETA_SERVICIOS = [
    { 
        id: 'indigo',
        border: 'border-l-indigo-500', 
        bgHeader: 'bg-indigo-50/70 text-indigo-900', 
        bgCard: 'bg-white hover:bg-indigo-50/30',
        badgeServ: 'bg-indigo-50 text-indigo-700 border-indigo-200', 
        dot: 'bg-indigo-500', 
        text: 'text-indigo-700',
        progressBar: 'bg-indigo-500',
        activePill: 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20'
    },
    { 
        id: 'teal',
        border: 'border-l-teal-500', 
        bgHeader: 'bg-teal-50/70 text-teal-900', 
        bgCard: 'bg-white hover:bg-teal-50/30',
        badgeServ: 'bg-teal-50 text-teal-700 border-teal-200', 
        dot: 'bg-teal-500', 
        text: 'text-teal-700',
        progressBar: 'bg-teal-500',
        activePill: 'bg-teal-600 text-white shadow-sm shadow-teal-600/20'
    },
    { 
        id: 'amber',
        border: 'border-l-amber-500', 
        bgHeader: 'bg-amber-50/70 text-amber-900', 
        bgCard: 'bg-white hover:bg-amber-50/30',
        badgeServ: 'bg-amber-50 text-amber-900 border-amber-200', 
        dot: 'bg-amber-500', 
        text: 'text-amber-700',
        progressBar: 'bg-amber-500',
        activePill: 'bg-amber-600 text-white shadow-sm shadow-amber-600/20'
    },
    { 
        id: 'rose',
        border: 'border-l-rose-500', 
        bgHeader: 'bg-rose-50/70 text-rose-900', 
        bgCard: 'bg-white hover:bg-rose-50/30',
        badgeServ: 'bg-rose-50 text-rose-700 border-rose-200', 
        dot: 'bg-rose-500', 
        text: 'text-rose-700',
        progressBar: 'bg-rose-500',
        activePill: 'bg-rose-600 text-white shadow-sm shadow-rose-600/20'
    },
    { 
        id: 'sky',
        border: 'border-l-sky-500', 
        bgHeader: 'bg-sky-50/70 text-sky-900', 
        bgCard: 'bg-white hover:bg-sky-50/30',
        badgeServ: 'bg-sky-50 text-sky-700 border-sky-200', 
        dot: 'bg-sky-500', 
        text: 'text-sky-700',
        progressBar: 'bg-sky-500',
        activePill: 'bg-sky-600 text-white shadow-sm shadow-sky-600/20'
    },
    { 
        id: 'purple',
        border: 'border-l-purple-500', 
        bgHeader: 'bg-purple-50/70 text-purple-900', 
        bgCard: 'bg-white hover:bg-purple-50/30',
        badgeServ: 'bg-purple-50 text-purple-700 border-purple-200', 
        dot: 'bg-purple-500', 
        text: 'text-purple-700',
        progressBar: 'bg-purple-500',
        activePill: 'bg-purple-600 text-white shadow-sm shadow-purple-600/20'
    }
];

function getServiceColorConfig(serviceId) {
    const num = Math.abs(parseInt(serviceId, 10) || 0);
    return PALETA_SERVICIOS[num % PALETA_SERVICIOS.length];
}

function poblarFiltroClasesDropdown(servicios) {
    const sel = document.getElementById('selectFiltroClaseGrilla');
    if (sel) {
        const currentVal = sel.value || 'todos';
        sel.innerHTML = '<option value="todos">Todas las clases y servicios</option>';

        servicios.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.id;
            opt.textContent = `${s.nombre_servicio || s.nombre} (Cupo: ${s.cupo_maximo || 1})`;
            sel.appendChild(opt);
        });

        if (currentVal && Array.from(sel.options).some(o => o.value === currentVal)) {
            sel.value = currentVal;
        }
    }

    renderPillsServiciosGrilla(servicios);
}

function renderPillsServiciosGrilla(servicios) {
    const container = document.getElementById('pillsServiciosGrilla');
    if (!container) return;

    const turnos = (semanaData && Array.isArray(semanaData.turnos)) ? semanaData.turnos : [];
    const totalInscriptosSemana = turnos.length;

    let html = '';

    // Píldora: Todas las actividades
    const isAllActive = (filtroClaseGrilla === 'todos');
    const allBtnClass = isAllActive 
        ? 'bg-slate-900 text-white shadow-sm font-black' 
        : 'bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold';

    html += `
        <button type="button" onclick="filtrarPorPillServicio('todos')" class="px-3.5 py-1.5 rounded-xl text-xs flex items-center gap-1.5 transition-all shrink-0 cursor-pointer ${allBtnClass}">
            <span class="material-symbols-outlined text-[15px]">apps</span>
            <span>Todas las Actividades</span>
            <span class="ml-1 px-1.5 py-0.2 rounded-full text-[10px] ${isAllActive ? 'bg-white/20 text-white' : 'bg-white text-slate-700 border border-slate-200'}">${totalInscriptosSemana}</span>
        </button>
    `;

    servicios.forEach(s => {
        const sId = String(s.id);
        const isActive = (filtroClaseGrilla === sId);
        const sNombre = s.nombre_servicio || s.nombre || 'Servicio';
        const cConf = getServiceColorConfig(s.id);

        const countInscriptosServ = turnos.filter(t => {
            return (t.id_servicio && String(t.id_servicio) === sId) ||
                   (t.servicio && t.servicio.toLowerCase().trim() === sNombre.toLowerCase().trim());
        }).length;

        const pillClass = isActive 
            ? `${cConf.activePill} font-black` 
            : `bg-slate-50 hover:bg-white text-slate-700 border border-slate-200 hover:border-slate-300 font-bold`;

        html += `
            <button type="button" onclick="filtrarPorPillServicio('${sId}')" class="px-3.5 py-1.5 rounded-xl text-xs flex items-center gap-1.5 transition-all shrink-0 cursor-pointer ${pillClass}">
                <span class="w-2.5 h-2.5 rounded-full ${cConf.dot}"></span>
                <span>${escapeHtml(sNombre)}</span>
                <span class="ml-1 px-1.5 py-0.2 rounded-full text-[10px] ${isActive ? 'bg-white/20 text-white' : 'bg-white text-slate-600 border border-slate-200'}">${countInscriptosServ}</span>
            </button>
        `;
    });

    container.innerHTML = html;

    const lblResumen = document.getElementById('labelResumenFiltroServicio');
    if (lblResumen) {
        if (filtroClaseGrilla === 'todos') {
            lblResumen.textContent = `Mostrando ${servicios.length} actividades combinadas`;
        } else {
            const servEncontrado = servicios.find(s => String(s.id) === String(filtroClaseGrilla));
            lblResumen.textContent = `Filtrando por: ${servEncontrado ? (servEncontrado.nombre_servicio || servEncontrado.nombre) : 'Servicio'}`;
        }
    }
}

function filtrarPorPillServicio(servicioId) {
    filtroClaseGrilla = String(servicioId);
    const sel = document.getElementById('selectFiltroClaseGrilla');
    if (sel) sel.value = filtroClaseGrilla;
    renderPillsServiciosGrilla(semanaData.servicios || []);
    renderGrillaSemanal();
}

function onToggleSoloConInscriptosChange() {
    renderGrillaSemanal();
}

function isNegocioOpenOnDay(dateObj, config) {
    if (!config) return true;
    let diasTrabajo = config.dias_trabajo || '';
    if (typeof diasTrabajo === 'string' && diasTrabajo.trim()) {
        try {
            if (diasTrabajo.startsWith('[') || diasTrabajo.startsWith('{')) {
                const parsed = JSON.parse(diasTrabajo);
                if (Array.isArray(parsed)) {
                    diasTrabajo = parsed;
                }
            }
        } catch(e) {}
    }

    const dayNum = dateObj.getDay(); // 0 = dom, 1 = lun, etc.
    const dayNames = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
    const currentName = dayNames[dayNum];

    // Verificar si hay horarios detallados con activo: false
    if (config.horarios_detallados_json) {
        try {
            const hDet = typeof config.horarios_detallados_json === 'string'
                ? JSON.parse(config.horarios_detallados_json)
                : config.horarios_detallados_json;
            const dayKeyMap = { 1: 'lun', 2: 'mar', 3: 'mie', 4: 'jue', 5: 'vie', 6: 'sab', 0: 'dom' };
            const textKey = dayKeyMap[dayNum];
            const diaData = (hDet && (hDet[String(dayNum)] !== undefined ? hDet[String(dayNum)] : (textKey ? hDet[textKey] : null)));
            if (diaData && diaData.activo === false) {
                return false;
            }
        } catch(e) {}
    }

    if (Array.isArray(diasTrabajo) && diasTrabajo.length > 0) {
        const lowerList = diasTrabajo.map(d => String(d).toLowerCase().trim());
        return lowerList.includes(currentName) || lowerList.includes(String(dayNum));
    } else if (typeof diasTrabajo === 'string' && diasTrabajo.trim()) {
        const lowerStr = diasTrabajo.toLowerCase();
        return lowerStr.includes(currentName) || lowerStr.includes(String(dayNum));
    }

    return true;
}

function getServiceSlotsForDayBusiness(servicio, dateObj, config) {
    const duracion = parseInt(servicio.duracion || servicio.duracion_minutos || 60, 10) || 60;
    let step = duracion;
    if (config && config.intervalo_turnos && config.intervalo_turnos !== 'servicio') {
        const parsedInt = parseInt(config.intervalo_turnos, 10);
        if (!isNaN(parsedInt) && parsedInt > 0) step = parsedInt;
    }

    let tramos = [];
    if (config && config.horarios_detallados_json) {
        try {
            const hDet = typeof config.horarios_detallados_json === 'string'
                ? JSON.parse(config.horarios_detallados_json)
                : config.horarios_detallados_json;
            const dayKeyMap = { 1: 'lun', 2: 'mar', 3: 'mie', 4: 'jue', 5: 'vie', 6: 'sab', 0: 'dom' };
            const textKey = dayKeyMap[dateObj.getDay()];
            const diaData = (hDet && (hDet[String(dateObj.getDay())] !== undefined ? hDet[String(dateObj.getDay())] : (textKey ? hDet[textKey] : null)));
            if (diaData && diaData.activo !== false && Array.isArray(diaData.tramos) && diaData.tramos.length > 0) {
                tramos = diaData.tramos.map(t => {
                    let [sh, sm] = (t.inicio || '09:00').split(':').map(Number);
                    let [eh, em] = (t.fin || '18:00').split(':').map(Number);
                    return { start: sh * 60 + sm, end: eh * 60 + em };
                });
            }
        } catch(e) {}
    }

    if (tramos.length === 0) {
        let [sh, sm] = (config.hora_apertura || '09:00').split(':').map(Number);
        let [eh, em] = (config.hora_cierre || '18:00').split(':').map(Number);
        let openMins = sh * 60 + sm;
        let closeMins = eh * 60 + em;

        if (config.hora_descanso_inicio && config.hora_descanso_fin) {
            let [dh1, dm1] = config.hora_descanso_inicio.split(':').map(Number);
            let [dh2, dm2] = config.hora_descanso_fin.split(':').map(Number);
            let breakStart = dh1 * 60 + dm1;
            let breakEnd = dh2 * 60 + dm2;
            if (breakStart > openMins && breakStart < closeMins) {
                tramos.push({ start: openMins, end: breakStart });
                if (breakEnd < closeMins) tramos.push({ start: breakEnd, end: closeMins });
            } else {
                tramos.push({ start: openMins, end: closeMins });
            }
        } else {
            tramos.push({ start: openMins, end: closeMins });
        }
    }

    const slots = [];
    tramos.forEach(tramo => {
        for (let m = tramo.start; m + duracion <= tramo.end; m += step) {
            let hh = String(Math.floor(m / 60)).padStart(2, '0');
            let mm = String(m % 60).padStart(2, '0');
            slots.push(`${hh}:${mm}`);
        }
    });

    return slots;
}

function renderGrillaSemanal() {
    const container = document.getElementById('grillaSemanaContainer');
    if (!container) return;

    const dias = getRangoSemanaDates(currentWeekOffset);
    const hoyStr = formatLocalDateStr(new Date());
    const servicios = (semanaData && Array.isArray(semanaData.servicios)) ? semanaData.servicios : [];
    const turnos = (semanaData && Array.isArray(semanaData.turnos)) ? semanaData.turnos : [];
    const config = semanaData.config || {};

    const toggleSoloInscriptos = document.getElementById('toggleSoloConInscriptos');
    const soloConInscriptos = toggleSoloInscriptos ? toggleSoloInscriptos.checked : true;

    let totalClasesSemana = 0;
    let totalInscriptosSemana = 0;
    let totalCapacidadSemana = 0;

    // Procesar y renderizar días
    const diasGenerados = [];

    dias.forEach(dateObj => {
        const fechaStr = formatLocalDateStr(dateObj);
        const isHoy = fechaStr === hoyStr;

        const dayNameCap = dateObj.toLocaleDateString('es-AR', { weekday: 'long' });
        const dayNameDisplay = dayNameCap.charAt(0).toUpperCase() + dayNameCap.slice(1);
        const dayNum = dateObj.getDate();
        const monthShort = dateObj.toLocaleDateString('es-AR', { month: 'short' });

        const isOpen = isNegocioOpenOnDay(dateObj, config);
        const turnosDelDia = turnos.filter(t => t.fecha === fechaStr);

        // REGLA SOLICITADA POR EL USUARIO:
        // Los días que están cerrados NO deben aparecer en la grilla para no ocupar espacio
        if (!isOpen && turnosDelDia.length === 0) {
            return;
        }

        let clasesDelDia = [];
        let scheduledSlotsKeys = new Set();

        // 1. Identificar todas las clases con alumnos en la base de datos para este día
        turnosDelDia.forEach(t => {
            const tHora = String(t.hora).substring(0, 5);
            const tServId = t.id_servicio || 0;

            if (filtroClaseGrilla !== 'todos' && tServId && String(tServId) !== String(filtroClaseGrilla)) {
                return;
            }

            const key = `${tServId}_${tHora}`;
            if (!scheduledSlotsKeys.has(key)) {
                scheduledSlotsKeys.add(key);

                const sObj = servicios.find(s => parseInt(s.id) === parseInt(tServId)) || {
                    id: tServId,
                    nombre_servicio: t.servicio || 'Clase',
                    cupo_maximo: 10,
                    profesional: t.profesional || 'Instructor'
                };

                const inscriptos = turnosDelDia.filter(other => {
                    const matchServ = (other.id_servicio && parseInt(other.id_servicio) === parseInt(tServId)) ||
                                      (other.servicio && other.servicio.toLowerCase().trim() === String(t.servicio).toLowerCase().trim());
                    const matchHora = String(other.hora).substring(0, 5) === tHora;
                    return matchServ && matchHora;
                });

                clasesDelDia.push({
                    servicioId: sObj.id,
                    servicioNombre: sObj.nombre_servicio || t.servicio || 'Clase',
                    hora: tHora,
                    profesional: t.profesional || sObj.profesional || 'Instructor',
                    cupoMaximo: parseInt(sObj.cupo_maximo || 10, 10) || 10,
                    inscriptos: inscriptos
                });
            }
        });

        // 2. Si el usuario desea ver todos los horarios del día (o si filtró por un servicio específico)
        if (!soloConInscriptos || filtroClaseGrilla !== 'todos') {
            if (isOpen) {
                servicios.forEach(s => {
                    if (filtroClaseGrilla !== 'todos' && String(s.id) !== String(filtroClaseGrilla)) {
                        return;
                    }

                    const cupoMax = parseInt(s.cupo_maximo || 10, 10) || 10;
                    const sNombre = s.nombre_servicio || s.nombre || 'Clase';
                    const prof = s.profesional || 'Instructor';

                    const slots = getServiceSlotsForDayBusiness(s, dateObj, config);
                    slots.forEach(horaSlot => {
                        const key = `${s.id}_${horaSlot}`;
                        if (!scheduledSlotsKeys.has(key)) {
                            scheduledSlotsKeys.add(key);

                            const inscriptos = turnosDelDia.filter(t => {
                                const matchServ = (t.id_servicio && parseInt(t.id_servicio) === parseInt(s.id)) ||
                                                  (t.servicio && t.servicio.toLowerCase().trim() === sNombre.toLowerCase().trim());
                                const matchHora = String(t.hora).substring(0, 5) === horaSlot;
                                return matchServ && matchHora;
                            });

                            if (!soloConInscriptos || inscriptos.length > 0) {
                                clasesDelDia.push({
                                    servicioId: s.id,
                                    servicioNombre: sNombre,
                                    hora: horaSlot,
                                    profesional: prof,
                                    cupoMaximo: cupoMax,
                                    inscriptos: inscriptos
                                });
                            }
                        }
                    });
                });
            }
        }

        // Ordenar clases cronológicamente
        clasesDelDia.sort((a, b) => {
            const cmpHora = a.hora.localeCompare(b.hora);
            if (cmpHora !== 0) return cmpHora;
            return a.servicioNombre.localeCompare(b.servicioNombre);
        });

        // Detectar superposición de horarios
        const horasCount = {};
        clasesDelDia.forEach(c => {
            horasCount[c.hora] = (horasCount[c.hora] || 0) + 1;
        });

        // Acumular métricas
        clasesDelDia.forEach(c => {
            totalClasesSemana++;
            totalInscriptosSemana += c.inscriptos.length;
            totalCapacidadSemana += c.cupoMaximo;
        });

        const tieneClases = clasesDelDia.length > 0;

        // Encabezado del día: Tipografía proporcionada, espaciosa y sin superposiciones
        let headerHtml = '';
        if (isHoy) {
            headerHtml = `
                <div class="bg-gradient-to-r from-orange-600 to-amber-500 text-white px-4 py-3 rounded-t-2xl flex items-center justify-between gap-2 shadow-xs">
                    <div class="flex items-baseline gap-2 min-w-0">
                        <span class="text-xs font-black uppercase tracking-wider text-orange-100 truncate">${dayNameDisplay}</span>
                        <span class="text-base font-black text-white shrink-0">${dayNum} ${monthShort}</span>
                    </div>
                    <div class="flex items-center gap-2 shrink-0">
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-white text-orange-600 tracking-wider shadow-2xs">Hoy</span>
                        ${tieneClases ? `<span class="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-white/20 text-white">${clasesDelDia.length} ${clasesDelDia.length === 1 ? 'clase' : 'clases'}</span>` : ''}
                    </div>
                </div>
            `;
        } else {
            headerHtml = `
                <div class="bg-white border-b border-slate-200/80 px-4 py-3 rounded-t-2xl flex items-center justify-between gap-2">
                    <div class="flex items-baseline gap-2 min-w-0">
                        <span class="text-xs font-bold uppercase tracking-wider text-slate-500 truncate">${dayNameDisplay}</span>
                        <span class="text-base font-black text-slate-800 shrink-0">${dayNum} ${monthShort}</span>
                    </div>
                    <div class="shrink-0">
                        ${tieneClases 
                            ? `<span class="px-2.5 py-0.5 rounded-xl text-[11px] font-bold bg-orange-50 text-orange-700 border border-orange-200/90 shadow-2xs">${clasesDelDia.length} ${clasesDelDia.length === 1 ? 'clase' : 'clases'}</span>`
                            : `<span class="text-[11px] font-medium text-slate-400">Sin clases</span>`
                        }
                    </div>
                </div>
            `;
        }

        let clasesHtml = '';
        if (clasesDelDia.length === 0) {
            clasesHtml = `
                <div class="py-8 px-3 text-center text-slate-400 bg-white/80 rounded-2xl border border-dashed border-slate-200 my-1">
                    <span class="material-symbols-outlined text-2xl text-slate-300 block mb-1">schedule</span>
                    <span class="text-xs font-bold text-slate-500 block">Sin clases agendadas</span>
                    <p class="text-[11px] text-slate-400 mt-1">Desmarca "Solo clases con inscriptos" para ver los horarios disponibles.</p>
                </div>
            `;
        } else {
            clasesHtml = clasesDelDia.map(c => {
                const ocupados = c.inscriptos.length;
                const cupoMax = c.cupoMaximo;
                const libres = Math.max(0, cupoMax - ocupados);
                const pctOcupacion = cupoMax > 0 ? Math.min(100, Math.round((ocupados / cupoMax) * 100)) : 0;
                const esSuperpuesta = (horasCount[c.hora] > 1);

                const cConf = getServiceColorConfig(c.servicioId);

                // Badge de ocupación
                let badgeOcupacion = '';
                let barraColor = cConf.progressBar;

                if (ocupados >= cupoMax) {
                    badgeOcupacion = `<span class="px-2.5 py-0.5 rounded-lg text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-200 shadow-2xs">COMPLETO</span>`;
                    barraColor = 'bg-rose-500';
                } else if (ocupados > 0 && libres <= 2) {
                    badgeOcupacion = `<span class="px-2.5 py-0.5 rounded-lg text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-200 shadow-2xs">Últimos ${libres} cupos</span>`;
                    barraColor = 'bg-amber-500';
                } else if (ocupados > 0) {
                    badgeOcupacion = `<span class="px-2.5 py-0.5 rounded-lg text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-2xs">${libres} cupos libres</span>`;
                    barraColor = 'bg-emerald-500';
                } else {
                    badgeOcupacion = `<span class="px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">Disponible</span>`;
                    barraColor = 'bg-slate-300';
                }

                // Badge de superposición horaria
                const superpuestaBadge = esSuperpuesta ? `
                    <span class="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-md border border-amber-200 shrink-0" title="Horario compartido con otra actividad simultánea">
                        <span class="material-symbols-outlined text-[13px]">layers</span>
                        <span>Simultánea</span>
                    </span>
                ` : '';

                const jsonCardData = JSON.stringify({
                    servicioId: c.servicioId,
                    servicioNombre: c.servicioNombre,
                    fecha: fechaStr,
                    hora: c.hora,
                    profesional: c.profesional,
                    cupoMaximo: c.cupoMaximo
                }).replace(/"/g, '&quot;');

                // RECUADRO DE CLASE MODERNO, LIMPIO Y ESPACIOSO
                // REGLAS DEL USUARIO:
                // 1. Tipografía sutil y proporcionada para la hora (text-xs / text-[13px])
                // 2. Nombre del servicio en tamaño moderado (text-sm font-bold), no gigante
                // 3. No listar los nombres de los alumnos en la tarjeta: al hacer click abren la lista completa y asistencia
                // 4. Espaciado limpio y balanceado
                return `
                    <div onclick="abrirModalDetalleClaseFromCard('${jsonCardData}')" class="bg-white hover:bg-slate-50 border border-slate-200/90 hover:border-orange-300 ${cConf.border} border-l-4 rounded-xl p-3.5 shadow-2xs hover:shadow-xs transition-all cursor-pointer flex flex-col justify-between group">
                        <div class="space-y-2">
                            <!-- Fila superior: Hora proporcionada + Badge simultánea si aplica -->
                            <div class="flex items-center justify-between gap-2">
                                <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-orange-700 bg-orange-50 border border-orange-200/80">
                                    <span class="material-symbols-outlined text-[14px] text-orange-500">schedule</span>
                                    <span>${c.hora} hs</span>
                                </span>
                                ${superpuestaBadge}
                            </div>

                            <!-- Nombre del Servicio: Tamaño moderado, equilibrado y prolijo -->
                            <div>
                                <h4 class="text-sm font-bold text-slate-800 group-hover:text-orange-600 transition-colors leading-snug line-clamp-2">
                                    ${escapeHtml(c.servicioNombre)}
                                </h4>
                                <div class="flex items-center gap-1 text-[11px] text-slate-400 mt-0.5">
                                    <span class="material-symbols-outlined text-[13px]">person</span>
                                    <span class="truncate">${escapeHtml(c.profesional)}</span>
                                </div>
                            </div>

                            <!-- Estado de ocupación y cupos -->
                            <div class="pt-1">
                                <div class="flex items-center justify-between text-xs font-medium text-slate-600 mb-1">
                                    <span class="text-[11px] font-bold text-slate-700">${ocupados} / ${cupoMax} inscriptos</span>
                                    <span class="text-[11px] ${ocupados >= cupoMax ? 'text-rose-600 font-bold' : 'text-slate-400'}">${pctOcupacion}%</span>
                                </div>
                                <div class="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                    <div class="${barraColor} h-full rounded-full transition-all duration-300" style="width: ${pctOcupacion}%"></div>
                                </div>
                            </div>
                        </div>

                        <!-- Footer: Badge de estado + acción clara "Ver lista" sin saturar -->
                        <div class="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
                            <div>${badgeOcupacion}</div>
                            <span class="text-xs font-bold ${cConf.text} flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                                <span>Ver lista</span>
                                <span class="material-symbols-outlined text-[14px]">arrow_forward</span>
                            </span>
                        </div>
                    </div>
                `;
            }).join('');
        }

        // Columna del día: diseño amplio y distinguido
        const colContainerClass = tieneClases
            ? 'bg-slate-50/70 border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden flex flex-col min-h-[300px]'
            : 'bg-slate-50/30 border border-dashed border-slate-200/80 rounded-2xl overflow-hidden flex flex-col min-h-[160px] opacity-75';

        diasGenerados.push(`
            <div class="${colContainerClass}">
                ${headerHtml}
                <div class="p-3 space-y-3 flex-1 overflow-y-auto">
                    ${clasesHtml}
                </div>
            </div>
        `);
    });

    if (diasGenerados.length === 0) {
        container.innerHTML = `
            <div class="col-span-full py-16 text-center text-slate-400 bg-white rounded-3xl border border-dashed border-slate-200">
                <span class="material-symbols-outlined text-4xl text-slate-300 mb-2">event_busy</span>
                <p class="font-bold text-slate-600 text-sm">No hay clases o días habilitados para esta semana.</p>
                <p class="text-xs text-slate-400 mt-1">Podés navegar a otra semana o revisar los horarios en Ajustes.</p>
            </div>
        `;
    } else {
        container.innerHTML = diasGenerados.join('');
    }

    // Actualizar métricas superiores de la semana
    const statClases = document.getElementById('statSemanaTotalClases');
    const statAlumnos = document.getElementById('statSemanaTotalAlumnos');
    const statLibres = document.getElementById('statSemanaCuposLibres');
    const statPct = document.getElementById('statSemanaOcupacionPct');
    const badgeTab = document.getElementById('badgeSemanaInscriptosCount');

    if (statClases) statClases.textContent = totalClasesSemana;
    if (statAlumnos) statAlumnos.textContent = totalInscriptosSemana;
    if (statLibres) statLibres.textContent = Math.max(0, totalCapacidadSemana - totalInscriptosSemana);
    
    const pct = totalCapacidadSemana > 0 ? Math.round((totalInscriptosSemana / totalCapacidadSemana) * 100) : 0;
    if (statPct) statPct.textContent = `${pct}%`;
    if (badgeTab) badgeTab.textContent = totalInscriptosSemana;
}

function abrirModalDetalleClaseFromCard(jsonStr) {
    try {
        const data = JSON.parse(jsonStr);
        abrirModalDetalleClase(data);
    } catch(e) {
        console.error('Error al abrir modal detalle clase:', e);
    }
}

function abrirModalDetalleClase(data) {
    claseActivaModal = data;

    const modal = document.getElementById('modalDetalleClaseAsistencia');
    if (!modal) return;

    // Título y encabezado
    document.getElementById('modalDetalleClaseServicioNombre').textContent = data.servicioNombre;
    document.getElementById('modalDetalleClaseTitulo').textContent = data.servicioNombre;
    document.getElementById('modalDetalleClaseHora').textContent = data.hora;
    document.getElementById('modalDetalleClaseProf').textContent = data.profesional || 'Instructor';

    // Formatear fecha bonita
    const [y, m, d] = data.fecha.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    const fBonita = dateObj.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
    document.getElementById('modalDetalleClaseFecha').textContent = fBonita.charAt(0).toUpperCase() + fBonita.slice(1);

    renderAlumnosInscriptosModal();
    poblarSelectAlumnosParaInscribir();

    modal.classList.remove('hidden');
}

function closeModalDetalleClaseAsistencia() {
    const modal = document.getElementById('modalDetalleClaseAsistencia');
    if (modal) modal.classList.add('hidden');
    claseActivaModal = null;
}

function renderAlumnosInscriptosModal() {
    if (!claseActivaModal) return;

    const turnos = semanaData.turnos || [];
    const inscriptos = turnos.filter(t => {
        const matchFecha = t.fecha === claseActivaModal.fecha;
        const matchHora = String(t.hora).substring(0, 5) === claseActivaModal.hora;
        const matchServ = (t.id_servicio && parseInt(t.id_servicio) === parseInt(claseActivaModal.servicioId)) ||
                          (t.servicio && t.servicio.toLowerCase().trim() === claseActivaModal.servicioNombre.toLowerCase().trim());
        return matchFecha && matchHora && matchServ;
    });

    const ocupados = inscriptos.length;
    const cupoMax = claseActivaModal.cupoMaximo;
    const libres = Math.max(0, cupoMax - ocupados);

    // Actualizar badges de cupo
    const cupoBadge = document.getElementById('modalDetalleClaseCupoBadge');
    if (cupoBadge) {
        if (ocupados >= cupoMax) {
            cupoBadge.className = 'px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-200';
            cupoBadge.textContent = `COMPLETO (${ocupados}/${cupoMax})`;
        } else {
            cupoBadge.className = 'px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200';
            cupoBadge.textContent = `${ocupados} de ${cupoMax} cupos ocupados (${libres} libres)`;
        }
    }

    const countBadge = document.getElementById('modalDetalleClaseInscriptosCountBadge');
    if (countBadge) countBadge.textContent = ocupados;

    const restText = document.getElementById('modalDetalleClaseCuposRestantesText');
    if (restText) restText.textContent = `Cupos disponibles: ${libres}`;

    const listContainer = document.getElementById('modalDetalleClaseInscriptosList');
    if (!listContainer) return;

    if (inscriptos.length === 0) {
        listContainer.innerHTML = `
            <div class="py-8 text-center text-slate-400 bg-slate-50 border border-dashed border-slate-200 rounded-2xl">
                <span class="material-symbols-outlined text-3xl mb-1 text-slate-300">person_off</span>
                <p class="text-xs font-bold text-slate-600">Aún no hay alumnos inscriptos en este horario</p>
                <p class="text-[11px] text-slate-400">Podés sumar alumnos utilizando el recuadro inferior.</p>
            </div>
        `;
        return;
    }

    listContainer.innerHTML = inscriptos.map(al => {
        const isPresente = al.asistio == 1;
        const tel = al.cliente_telefono || al.cliente_celular || '';
        const email = al.cliente_email || '';
        const contacto = tel || email || 'Sin contacto';

        // Enlace WhatsApp
        let wppBtn = '';
        if (tel && tel.replace(/\D/g, '').length >= 7) {
            const cleanPhone = tel.replace(/\D/g, '');
            const wppMsg = encodeURIComponent(`¡Hola ${al.cliente_nombre}! Te recordamos tu clase de ${claseActivaModal.servicioNombre} para el día ${claseActivaModal.fecha} a las ${claseActivaModal.hora} hs en ${negocioNombreUnico || 'nuestro centro'}.`);
            wppBtn = `
                <a href="https://wa.me/${cleanPhone}?text=${wppMsg}" target="_blank" class="w-8 h-8 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-600 flex items-center justify-center transition-colors shadow-2xs" title="Escribir por WhatsApp">
                    <span class="material-symbols-outlined text-[16px]">chat</span>
                </a>
            `;
        }

        // Botón Asistencia Toggle
        const asistBtnClass = isPresente 
            ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs' 
            : 'bg-slate-100 hover:bg-slate-200 text-slate-600';
        const asistIcon = isPresente ? 'check_circle' : 'radio_button_unchecked';
        const asistLabel = isPresente ? 'Presente' : 'Marcar Presente';
        const nextState = isPresente ? 0 : 1;

        const safeStudentName = String(al.cliente_nombre).replace(/'/g, "\\'");

        return `
            <div class="bg-white border border-slate-200 rounded-2xl p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs hover:border-slate-300 transition-all">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-xl ${isPresente ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'} flex items-center justify-center font-bold text-sm shrink-0">
                        ${escapeHtml((al.cliente_nombre || 'A').charAt(0).toUpperCase())}
                    </div>
                    <div>
                        <h5 class="text-xs sm:text-sm font-extrabold text-slate-900">${escapeHtml(al.cliente_nombre)}</h5>
                        <p class="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                            <span class="material-symbols-outlined text-[14px] text-slate-400">call</span>
                            <span>${escapeHtml(contacto)}</span>
                        </p>
                    </div>
                </div>

                <div class="flex items-center justify-end gap-2 shrink-0">
                    ${wppBtn}

                    <!-- Botón Asistencia -->
                    <button type="button" onclick="marcarAsistenciaModal(${al.id_turno}, ${nextState}, this)" class="px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1 transition-all cursor-pointer ${asistBtnClass}">
                        <span class="material-symbols-outlined text-[16px]">${asistIcon}</span>
                        <span>${asistLabel}</span>
                    </button>

                    <!-- Botón Quitar Alumno -->
                    <button type="button" onclick="confirmarRemoverAlumnoClase(${al.id_turno}, '${safeStudentName}')" class="w-8 h-8 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 flex items-center justify-center transition-colors cursor-pointer" title="Quitar de esta clase">
                        <span class="material-symbols-outlined text-[16px]">close</span>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function poblarSelectAlumnosParaInscribir() {
    const sel = document.getElementById('modalDetalleSelectAlumno');
    if (!sel) return;

    sel.innerHTML = '<option value="">-- Seleccionar Alumno del Padrón --</option>';

    if (!allClientes || allClientes.length === 0) return;

    // Ordenar alfabéticamente por nombre
    const ordenados = [...allClientes].sort((a, b) => (a.nombre_completo || '').localeCompare(b.nombre_completo || ''));

    ordenados.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        const pDisp = c.pases_disponibles !== undefined ? c.pases_disponibles : 0;
        opt.textContent = `${c.nombre_completo} (${pDisp} clases disponibles)`;
        sel.appendChild(opt);
    });
}

function marcarAsistenciaModal(turnoId, nuevoEstado, btnElem) {
    if (!turnoId) return;

    if (btnElem) {
        btnElem.disabled = true;
        btnElem.classList.add('opacity-50');
    }

    fetch('backend/marcar_asistencia.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_turno: turnoId, asistio: nuevoEstado })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            // Actualizar localmente en semanaData.turnos
            if (semanaData && Array.isArray(semanaData.turnos)) {
                const target = semanaData.turnos.find(t => parseInt(t.id_turno) === parseInt(turnoId));
                if (target) target.asistio = nuevoEstado;
            }

            renderAlumnosInscriptosModal();
            renderGrillaSemanal();
            if (typeof showToast === 'function') {
                showToast(nuevoEstado === 1 ? '✓ Asistencia marcada correctamente' : 'Asistencia removida', 'success');
            }
        } else {
            if (typeof showToast === 'function') showToast(data.error || 'No se pudo actualizar la asistencia', 'error');
            if (btnElem) {
                btnElem.disabled = false;
                btnElem.classList.remove('opacity-50');
            }
        }
    })
    .catch(err => {
        console.error('Error de red al marcar asistencia:', err);
        if (btnElem) {
            btnElem.disabled = false;
            btnElem.classList.remove('opacity-50');
        }
    });
}

function confirmarRemoverAlumnoClase(turnoId, nombreAlumno) {
    document.getElementById('removerAlumnoTurnoId').value = turnoId;
    document.getElementById('removerAlumnoNombreText').textContent = nombreAlumno || 'este alumno';
    document.getElementById('chkReintegrarPaseRemover').checked = true;

    const modal = document.getElementById('modalConfirmRemoverAlumnoClase');
    if (modal) modal.classList.remove('hidden');
}

function closeModalConfirmRemoverAlumnoClase() {
    const modal = document.getElementById('modalConfirmRemoverAlumnoClase');
    if (modal) modal.classList.add('hidden');
}

function ejecutarRemoverAlumnoClase() {
    const turnoId = document.getElementById('removerAlumnoTurnoId').value;
    const devolverPase = document.getElementById('chkReintegrarPaseRemover').checked ? 1 : 0;
    const btn = document.getElementById('btnConfirmRemoverAlumnoClase');

    if (!turnoId) return;

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="material-symbols-outlined text-[16px] animate-spin">refresh</span> Desinscribiendo...';
    }

    fetch('backend/gestionar_clientes.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action: 'remover_alumno_clase',
            id_turno: turnoId,
            devolver_pase: devolverPase
        })
    })
    .then(res => res.json())
    .then(data => {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<span class="material-symbols-outlined text-[18px]">check</span><span>Sí, Desinscribir</span>';
        }

        if (data.success) {
            closeModalConfirmRemoverAlumnoClase();

            // Quitar turno localmente
            if (semanaData && Array.isArray(semanaData.turnos)) {
                semanaData.turnos = semanaData.turnos.filter(t => parseInt(t.id_turno) !== parseInt(turnoId));
            }

            renderAlumnosInscriptosModal();
            renderGrillaSemanal();
            cargarClientes(); // Refrescar padrón de alumnos para ver pases actualizados

            if (typeof showToast === 'function') showToast(data.message || 'Alumno desinscripto correctamente', 'success');
        } else {
            if (typeof showToast === 'function') showToast(data.error || 'No se pudo desinscribir al alumno', 'error');
        }
    })
    .catch(err => {
        console.error('Error al remover alumno de clase:', err);
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<span class="material-symbols-outlined text-[18px]">check</span><span>Sí, Desinscribir</span>';
        }
    });
}

function ejecutarInscripcionManualClase() {
    if (!claseActivaModal) return;

    const sel = document.getElementById('modalDetalleSelectAlumno');
    const idCliente = sel ? sel.value : '';
    const btn = document.getElementById('btnInscribirManual');

    if (!idCliente) {
        if (typeof showToast === 'function') showToast('Selecciona a un alumno del padrón para inscribirlo.', 'error');
        if (sel) sel.focus();
        return;
    }

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="material-symbols-outlined text-[16px] animate-spin">refresh</span> Inscribiendo...';
    }

    fetch('backend/gestionar_clientes.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action: 'inscribir_alumno_clase',
            id_cliente: idCliente,
            id_servicio: claseActivaModal.servicioId,
            servicio: claseActivaModal.servicioNombre,
            fecha: claseActivaModal.fecha,
            hora: claseActivaModal.hora,
            profesional: claseActivaModal.profesional
        })
    })
    .then(res => res.json())
    .then(data => {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<span class="material-symbols-outlined text-[18px]">check_circle</span><span>Inscribir</span>';
        }

        if (data.success) {
            if (sel) sel.value = '';
            if (typeof showToast === 'function') showToast(data.message || 'Alumno inscripto con éxito', 'success');

            // Recargar datos actualizados de la semana y padrón
            cargarClasesSemana();
            cargarClientes();

            // Simular actualización inmediata en modal
            setTimeout(() => {
                if (claseActivaModal) renderAlumnosInscriptosModal();
            }, 300);
        } else {
            if (typeof showToast === 'function') showToast(data.error || 'No se pudo inscribir al alumno', 'error');
        }
    })
    .catch(err => {
        console.error('Error al inscribir alumno a clase:', err);
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<span class="material-symbols-outlined text-[18px]">check_circle</span><span>Inscribir</span>';
        }
    });
}
