let allClientes = [];
let filtroActual = 'todos';
let isPremiumAccount = true;
let currentPlanName = 'Simple';
let negocioRutaUnica = '';
let negocioNombreUnico = '';

document.addEventListener('DOMContentLoaded', () => {
    cargarClientes();
});

function cargarClientes() {
    fetch('backend/gestionar_clientes.php')
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                allClientes = data.data || [];
                isPremiumAccount = data.is_premium !== undefined ? data.is_premium : true;
                currentPlanName = data.plan || 'Simple';
                negocioRutaUnica = data.negocio_ruta || '';
                negocioNombreUnico = data.negocio_nombre || '';
                
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

        return `
            <tr class="hover:bg-slate-50/80 transition-colors">
                <td class="py-4 px-6">
                    <div class="flex items-center gap-3">
                        <div class="w-9 h-9 rounded-xl bg-orange-100 text-orange-700 font-extrabold flex items-center justify-center text-sm shrink-0">
                            ${c.nombre_completo.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <strong class="text-slate-900 font-bold block text-xs sm:text-sm">${c.nombre_completo}</strong>
                            ${c.notas ? `<span class="text-[11px] text-slate-400 line-clamp-1">${c.notas}</span>` : ''}
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
                        <button onclick="openModalAddPases(${c.id}, '${escapeHtml(c.nombre_completo)}')" class="ml-1 text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 p-1 rounded-lg transition-colors" title="Añadir clases (+4, +8)">
                            <span class="material-symbols-outlined text-[16px]">add_circle</span>
                        </button>
                    </div>
                    ${c.clases_reservadas > 0 ? `<div class="text-[10px] text-orange-600 font-bold mt-0.5">${c.clases_reservadas} clases reservadas en sistema</div>` : ''}
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

    if (cliente) {
        document.getElementById('modalClienteTitle').textContent = 'Editar Alumno';
        document.getElementById('clienteId').value = cliente.id;
        document.getElementById('clienteNombre').value = cliente.nombre_completo || '';
        document.getElementById('clienteEmail').value = cliente.email || '';
        document.getElementById('clienteTelefono').value = cliente.telefono || '';
        document.getElementById('clientePases').value = cliente.pases_disponibles || 0;
        document.getElementById('clienteVencimiento').value = cliente.fecha_vencimiento || '';
        document.getElementById('clienteNotas').value = cliente.notas || '';
    } else {
        document.getElementById('modalClienteTitle').textContent = 'Cargar Nuevo Alumno';
        document.getElementById('clienteId').value = '';
        document.getElementById('clientePases').value = 8;
        
        // Colocar vencimiento a 30 días por defecto
        const defaultDate = new Date();
        defaultDate.setDate(defaultDate.getDate() + 30);
        document.getElementById('clienteVencimiento').value = defaultDate.toISOString().split('T')[0];
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

    const payload = {
        id: document.getElementById('clienteId')?.value || null,
        nombre_completo: document.getElementById('clienteNombre')?.value || '',
        email: document.getElementById('clienteEmail')?.value || '',
        telefono: document.getElementById('clienteTelefono')?.value || '',
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

// Modal Cargar Más Pases Rápidos
function openModalAddPases(id, nombre) {
    if (!isPremiumAccount) {
        showPremiumModalNotice();
        return;
    }
    document.getElementById('addPasesClienteId').value = id;
    document.getElementById('addPasesNombreAlumno').textContent = `Alumno: ${nombre}`;
    const modal = document.getElementById('modalAddPases');
    if (modal) modal.classList.remove('hidden');
}

function closeModalAddPases() {
    const modal = document.getElementById('modalAddPases');
    if (modal) modal.classList.add('hidden');
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
            if (typeof showToast === 'function') showToast(`Se sumaron +${cant} clases al alumno.`, 'success');
            cargarClientes();
        } else {
            if (typeof showToast === 'function') showToast(d.error || 'Error al agregar clases', 'error');
        }
    });
}

function promptCustomPases() {
    const id = document.getElementById('addPasesClienteId').value;
    const val = prompt('Ingresa la cantidad exacta de clases a sumar:');
    if (val && parseInt(val) > 0) {
        confirmAddPases(parseInt(val));
    }
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
    if (negocioRutaUnica) {
        const fullUrl = `${window.location.origin}/alumno.html?unirse=${encodeURIComponent(negocioRutaUnica)}`;
        if (el) el.textContent = fullUrl;
        if (elModal) elModal.textContent = fullUrl;
    } else {
        if (el) el.textContent = 'Enlace no disponible';
        if (elModal) elModal.textContent = 'Enlace no disponible';
    }
}

function openModalInvitarAlumnos() {
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
    const fullUrl = `${window.location.origin}/alumno.html?unirse=${encodeURIComponent(negocioRutaUnica)}`;
    
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
    const fullUrl = `${window.location.origin}/alumno.html?unirse=${encodeURIComponent(negocioRutaUnica)}`;
    const nom = negocioNombreUnico || 'nuestro establecimiento';
    const msg = `¡Hola! Podés registrarte o anotarte a nuestras clases en ${nom} a través de nuestro enlace oficial:\n\n${fullUrl}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, '_blank');
}


