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


