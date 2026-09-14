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

        const vencText = c.fecha_vencimiento ? formatearFecha(c.fecha_vencimiento) : 'Sin Vencimiento';
        const sNombre = c.servicio || (c.id_servicio ? (allServicios.find(s => s.id == c.id_servicio)?.nombre || '') : '');

        return `
            <tr class="hover:bg-slate-50/80 transition-colors">
                <td class="py-4 px-6">
                    <div class="flex items-center gap-3">
                        <div class="w-9 h-9 rounded-xl bg-orange-100 text-orange-700 font-extrabold flex items-center justify-center text-sm shrink-0">
                            ${c.nombre_completo.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <strong class="text-slate-900 font-bold block text-xs sm:text-sm">${c.nombre_completo}</strong>
                            ${sNombre ? `<span class="inline-flex items-center gap-1 bg-orange-50 text-orange-700 border border-orange-200/60 px-2 py-0.5 rounded-md text-[10px] font-extrabold mt-0.5"><span class="material-symbols-outlined text-[12px]">fitness_center</span> ${escapeHtml(sNombre)}</span>` : ''}
                            ${c.notas ? `<span class="text-[11px] text-slate-400 block line-clamp-1 mt-0.5">${c.notas}</span>` : ''}
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
                        <button onclick="openModalAddPases(${c.id})" class="ml-1 text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 p-1 rounded-lg transition-colors" title="Añadir clases o renovar pases">
                            <span class="material-symbols-outlined text-[16px]">add_circle</span>
                        </button>
                    </div>
                </td>
                <td class="py-4 px-6 font-medium text-slate-600">
                    ${vencText}
                </td>
                <td class="py-4 px-6 text-center">
                    ${badgeHtml}
                </td>
                <td class="py-4 px-6 text-right">
                    <div class="flex items-center justify-end gap-1.5">
                        <button onclick="editarCliente(${c.id})" class="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors" title="Editar Alumno">
                            <span class="material-symbols-outlined text-[18px]">edit</span>
                        </button>
                        <button onclick="eliminarCliente(${c.id}, '${escapeHtml(c.nombre_completo)}')" class="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-colors" title="Eliminar Alumno">
                            <span class="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function poblarServiciosDropdowns() {
    const selCliente = document.getElementById('clienteServicio');
    if (selCliente) {
        const currentVal = selCliente.value;
        let html = '<option value="">-- Seleccionar Servicio --</option>';
        allServicios.forEach(s => {
            const cupoText = s.cupo_maximo ? `${s.cupo_maximo} cupos` : '1 cupo';
            html += `<option value="${s.id}">${escapeHtml(s.nombre)} (${cupoText})</option>`;
        });
        selCliente.innerHTML = html;
        if (currentVal) selCliente.value = currentVal;
    }

    const selInvite = document.getElementById('inviteModalServicio');
    if (selInvite) {
        const currentVal = selInvite.value;
        let html = '<option value="">Todos los Servicios (Predeterminado)</option>';
        allServicios.forEach(s => {
            html += `<option value="${s.id}">${escapeHtml(s.nombre)}</option>`;
        });
        selInvite.innerHTML = html;
        if (currentVal) selInvite.value = currentVal;
    }
}

function onClienteServicioChange(selectedCupos = null) {
    const sel = document.getElementById('clienteServicio');
    const containerPaq = document.getElementById('containerClientePaquete');
    const selectPaq = document.getElementById('clientePaqueteSelect');
    const pasesInput = document.getElementById('clientePases');
    const vencInput = document.getElementById('clienteVencimiento');
    const infoBanner = document.getElementById('clientePasesInfoBanner');
    const infoText = document.getElementById('clientePasesInfoText');

    if (!sel || !sel.value) {
        if (containerPaq) containerPaq.classList.add('hidden');
        if (infoBanner) infoBanner.classList.add('hidden');
        return;
    }

    const servId = sel.value;
    const serv = allServicios.find(s => s.id == servId);
    if (!serv) return;

    // Parsear paquetes de precios configurados para este servicio
    let pkgs = [];
    try {
        if (typeof serv.precios_paquetes_json === 'string') {
            pkgs = JSON.parse(serv.precios_paquetes_json || '[]');
        } else if (Array.isArray(serv.precios_paquetes_json)) {
            pkgs = serv.precios_paquetes_json;
        }
    } catch(e) { pkgs = []; }

    // Poblar selector de tipos de pase
    if (selectPaq && containerPaq) {
        let paqHtml = `<option value="">-- Seleccionar Tipo de Pase --</option>`;
        const defaultCupo = parseInt(serv.cupo_maximo || 8, 10);
        paqHtml += `<option value="${defaultCupo}" data-tipo="base">Pase Estándar (${defaultCupo} clases)</option>`;

        if (Array.isArray(pkgs) && pkgs.length > 0) {
            pkgs.forEach((p, idx) => {
                const cupos = parseInt(p.cupos, 10);
                const precio = parseFloat(p.precio || 0);
                const precioFmt = precio > 0 ? ` - $${precio.toLocaleString('es-AR')}` : '';
                paqHtml += `<option value="${cupos}" data-tipo="paquete">📦 Paquete ${cupos} clases${precioFmt}</option>`;
            });
        }
        paqHtml += `<option value="manual" data-tipo="manual">✍️ Cantidad Manual / Personalizada</option>`;
        selectPaq.innerHTML = paqHtml;
        containerPaq.classList.remove('hidden');

        // Seleccionar cupo indicado o el primero disponible
        if (selectedCupos !== null) {
            selectPaq.value = selectedCupos;
            if (!selectPaq.value) selectPaq.value = 'manual';
        } else {
            selectPaq.value = defaultCupo;
        }
    }

    if (selectedCupos === null && pasesInput) {
        pasesInput.value = serv.cupo_maximo || 8;
    }

    if (vencInput && !vencInput.value) {
        const defaultDate = new Date();
        defaultDate.setDate(defaultDate.getDate() + 30);
        vencInput.value = defaultDate.toISOString().split('T')[0];
    }

    actualizarBannerInfoPases();
}

function onClientePaqueteChange() {
    const selectPaq = document.getElementById('clientePaqueteSelect');
    const pasesInput = document.getElementById('clientePases');
    if (!selectPaq || !pasesInput) return;

    const val = selectPaq.value;
    if (val && val !== 'manual') {
        pasesInput.value = parseInt(val, 10);
    } else if (val === 'manual') {
        pasesInput.focus();
    }
    actualizarBannerInfoPases();
}

function actualizarBannerInfoPases() {
    const sel = document.getElementById('clienteServicio');
    const pasesInput = document.getElementById('clientePases');
    const infoBanner = document.getElementById('clientePasesInfoBanner');
    const infoText = document.getElementById('clientePasesInfoText');

    if (!sel || !sel.value || !pasesInput || !infoBanner || !infoText) return;

    const serv = allServicios.find(s => s.id == sel.value);
    const cant = parseInt(pasesInput.value || 0, 10);

    if (serv) {
        infoText.innerHTML = `Asignado a <strong>${escapeHtml(serv.nombre)}</strong> con <strong>${cant} pases/clases</strong>.`;
        infoBanner.classList.remove('hidden');
    } else {
        infoBanner.classList.add('hidden');
    }
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

function openModalCliente(cliente = null) {
    if (!isPremiumAccount) {
        showPremiumModalNotice();
        return;
    }
    const form = document.getElementById('formCliente');
    if (form) form.reset();

    poblarServiciosDropdowns();

    if (cliente) {
        document.getElementById('modalClienteTitle').textContent = 'Editar Alumno';
        document.getElementById('clienteId').value = cliente.id;
        document.getElementById('clienteNombre').value = cliente.nombre_completo || '';
        document.getElementById('clienteEmail').value = cliente.email || '';
        document.getElementById('clienteTelefono').value = cliente.telefono || '';
        document.getElementById('clientePases').value = cliente.pases_disponibles || 0;
        document.getElementById('clienteVencimiento').value = cliente.fecha_vencimiento || '';
        document.getElementById('clienteNotas').value = cliente.notas || '';
        
        const selServ = document.getElementById('clienteServicio');
        if (selServ) {
            selServ.value = cliente.id_servicio || '';
            onClienteServicioChange(cliente.pases_totales || cliente.pases_disponibles);
        }
    } else {
        document.getElementById('modalClienteTitle').textContent = 'Cargar Nuevo Alumno';
        document.getElementById('clienteId').value = '';
        const selServ = document.getElementById('clienteServicio');
        if (selServ && allServicios.length === 1) {
            selServ.value = allServicios[0].id;
            onClienteServicioChange();
        } else {
            if (selServ) selServ.value = '';
            document.getElementById('clientePases').value = 8;
            const defaultDate = new Date();
            defaultDate.setDate(defaultDate.getDate() + 30);
            document.getElementById('clienteVencimiento').value = defaultDate.toISOString().split('T')[0];
            const containerPaq = document.getElementById('containerClientePaquete');
            if (containerPaq) containerPaq.classList.add('hidden');
            const infoBanner = document.getElementById('clientePasesInfoBanner');
            if (infoBanner) infoBanner.classList.add('hidden');
        }
    }

    const modal = document.getElementById('modalCliente');
    if (modal) modal.classList.remove('hidden');
}

function closeModalCliente() {
    const modal = document.getElementById('modalCliente');
    if (modal) modal.classList.add('hidden');
}

function guardarCliente(e) {
    e.preventDefault();
    if (!isPremiumAccount) {
        showPremiumModalNotice();
        return;
    }
    const btn = document.getElementById('btnGuardarCliente');
    if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }

    const selectedServId = document.getElementById('clienteServicio')?.value || null;
    const selectedServObj = allServicios.find(s => s.id == selectedServId);

    const payload = {
        id: document.getElementById('clienteId')?.value || null,
        nombre_completo: document.getElementById('clienteNombre')?.value || '',
        email: document.getElementById('clienteEmail')?.value || '',
        telefono: document.getElementById('clienteTelefono')?.value || '',
        id_servicio: selectedServId,
        servicio: selectedServObj ? selectedServObj.nombre : '',
        pases_disponibles: document.getElementById('clientePases')?.value || 0,
        fecha_vencimiento: document.getElementById('clienteVencimiento')?.value || null,
        notas: document.getElementById('clienteNotas')?.value || ''
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

// Modal Cargar Más Pases Rápidos / Asociados al Servicio
function openModalAddPases(id, nombreOverride = null) {
    if (!isPremiumAccount) {
        showPremiumModalNotice();
        return;
    }

    const cliente = allClientes.find(c => c.id == id);
    const alumnoNombre = cliente ? cliente.nombre_completo : (nombreOverride || '');
    
    document.getElementById('addPasesClienteId').value = id;
    document.getElementById('addPasesNombreAlumno').textContent = `Alumno: ${alumnoNombre}`;
    
    // Identificar servicio del alumno
    const servId = cliente ? (cliente.id_servicio || null) : null;
    let serv = servId ? allServicios.find(s => s.id == servId) : null;
    if (!serv && cliente && cliente.servicio) {
        serv = allServicios.find(s => s.nombre.toLowerCase().trim() === cliente.servicio.toLowerCase().trim());
    }

    const elServicio = document.getElementById('addPasesServicioAlumno');
    if (elServicio) {
        if (serv) {
            elServicio.innerHTML = `Servicio: <strong class="text-slate-700">${escapeHtml(serv.nombre)}</strong>`;
        } else if (cliente && cliente.servicio) {
            elServicio.innerHTML = `Servicio: <strong class="text-slate-700">${escapeHtml(cliente.servicio)}</strong>`;
        } else {
            elServicio.innerHTML = `Servicio: <span class="text-slate-400 italic">General / No asignado</span>`;
        }
    }

    // Mostrar estado y balance actual
    const elBalance = document.getElementById('addPasesBalanceActualText');
    if (elBalance) {
        const disp = cliente ? cliente.pases_disponibles : 0;
        const tot = cliente ? (cliente.pases_totales || cliente.pases_disponibles) : 0;
        elBalance.innerHTML = `${disp} <span class="text-xs font-semibold text-slate-400">de ${tot} clases</span>`;
    }

    const elVenc = document.getElementById('addPasesVencimientoActualText');
    if (elVenc) {
        elVenc.textContent = cliente && cliente.fecha_vencimiento ? formatearFecha(cliente.fecha_vencimiento) : 'Sin vencimiento';
    }

    // Poblar botones dinámicos de pases
    const containerBotones = document.getElementById('addPasesBotonesContainer');
    if (containerBotones) {
        let botones = [];

        // 1. Obtener paquetes configurados del servicio
        if (serv) {
            let pkgs = [];
            try {
                if (typeof serv.precios_paquetes_json === 'string') {
                    pkgs = JSON.parse(serv.precios_paquetes_json || '[]');
                } else if (Array.isArray(serv.precios_paquetes_json)) {
                    pkgs = serv.precios_paquetes_json;
                }
            } catch(e) { pkgs = []; }

            // Cupo base / estándar del servicio
            const cupoBase = parseInt(serv.cupo_maximo || 8, 10);
            if (cupoBase > 0) {
                botones.push({
                    cupos: cupoBase,
                    label: `+${cupoBase}`,
                    sub: 'Pase Estándar',
                    color: 'emerald'
                });
            }

            // Paquetes comerciales guardados en el servicio
            if (Array.isArray(pkgs)) {
                pkgs.forEach(p => {
                    const c = parseInt(p.cupos, 10);
                    if (c > 0 && !botones.some(b => b.cupos === c)) {
                        const precioFmt = p.precio ? `$${parseFloat(p.precio).toLocaleString('es-AR')}` : 'Paquete';
                        botones.push({
                            cupos: c,
                            label: `+${c}`,
                            sub: precioFmt,
                            color: 'purple'
                        });
                    }
                });
            }
        }

        // Si no hay paquetes específicos o son menos de 2, añadir sugerencias estándar
        if (botones.length === 0) {
            botones.push({ cupos: 4, label: '+4', sub: 'Clases', color: 'emerald' });
            botones.push({ cupos: 8, label: '+8', sub: 'Clases', color: 'emerald' });
            botones.push({ cupos: 12, label: '+12', sub: 'Clases', color: 'emerald' });
        } else if (botones.length === 1) {
            const extraCupo = botones[0].cupos * 2;
            botones.push({ cupos: extraCupo, label: `+${extraCupo}`, sub: 'Doble Pase', color: 'emerald' });
        }

        let botonesHtml = botones.map(b => `
            <button type="button" onclick="confirmAddPases(${b.cupos})" class="p-3 rounded-2xl border-2 border-slate-200 hover:border-emerald-500 hover:bg-emerald-50 text-slate-800 font-extrabold text-sm transition-all flex flex-col items-center gap-0.5 group">
                <span class="text-base text-emerald-600 group-hover:scale-110 transition-transform">${b.label}</span>
                <span class="text-[10px] font-bold text-slate-500 truncate max-w-full">${escapeHtml(b.sub)}</span>
            </button>
        `).join('');

        // Botón Otro (manual)
        botonesHtml += `
            <button type="button" onclick="toggleCustomPasesInput()" id="btnToggleCustomPases" class="p-3 rounded-2xl border-2 border-slate-200 hover:border-orange-500 hover:bg-orange-50 text-slate-800 font-extrabold text-sm transition-all flex flex-col items-center gap-0.5 group">
                <span class="text-base text-orange-600 group-hover:scale-110 transition-transform">+Otro</span>
                <span class="text-[10px] font-bold text-slate-500 uppercase">Manual</span>
            </button>
        `;

        containerBotones.innerHTML = botonesHtml;
    }

    // Reset sección manual
    const sec = document.getElementById('sectionCustomPases');
    if (sec) sec.classList.add('hidden');
    const inp = document.getElementById('inputCustomPases');
    if (inp) inp.value = '';

    const modal = document.getElementById('modalAddPases');
    if (modal) modal.classList.remove('hidden');
}

function closeModalAddPases() {
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
    const id = document.getElementById('addPasesClienteId').value;
    if (!id || !cant) return;

    fetch('backend/gestionar_clientes.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add_pases', id: id, cantidad: cant })
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
    const el = document.getElementById('inputEnlaceUnicoText');
    const elModal = document.getElementById('modalInputEnlaceUnicoText');
    const selInvite = document.getElementById('inviteModalServicio');
    const selectedServId = selInvite ? selInvite.value : '';

    if (negocioRutaUnica) {
        let fullUrl = `${window.location.origin}/alumno.html?unirse=${encodeURIComponent(negocioRutaUnica)}`;
        if (selectedServId) {
            fullUrl += `&s=${encodeURIComponent(selectedServId)}`;
        }
        if (el) el.textContent = fullUrl;
        if (elModal) elModal.textContent = fullUrl;
    } else {
        if (el) el.textContent = 'Enlace no disponible';
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
    let fullUrl = `${window.location.origin}/alumno.html?unirse=${encodeURIComponent(negocioRutaUnica)}`;
    if (selectedServId) {
        fullUrl += `&s=${encodeURIComponent(selectedServId)}`;
    }
    
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(fullUrl).then(() => {
            if (typeof showToast === 'function') showToast('¡Enlace de registro copiado al portapapeles!', 'success');
            else alert('¡Enlace copiado al portapapeles!');
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
    else alert('¡Enlace copiado!');
}

function compartirWhatsAppEnlaceUnico() {
    if (!negocioRutaUnica) return;
    const selInvite = document.getElementById('inviteModalServicio');
    const selectedServId = selInvite ? selInvite.value : '';
    let fullUrl = `${window.location.origin}/alumno.html?unirse=${encodeURIComponent(negocioRutaUnica)}`;
    if (selectedServId) {
        fullUrl += `&s=${encodeURIComponent(selectedServId)}`;
    }
    const nom = negocioNombreUnico || 'nuestro establecimiento';
    const msg = `¡Hola! Podés registrarte o anotarte a nuestras clases en ${nom} a través de nuestro enlace oficial:\n\n${fullUrl}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, '_blank');
}


