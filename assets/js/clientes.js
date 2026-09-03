let allClientes = [];
let filtroActual = 'todos';

document.addEventListener('DOMContentLoaded', () => {
    cargarClientes();
});

function cargarClientes() {
    fetch('backend/gestionar_clientes.php')
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                allClientes = data.data || [];
                actualizarMetricas();
                renderTablaAlumnos();
            } else {
                if (typeof showToast === 'function') showToast(data.error || 'Error al cargar alumnos', 'error');
            }
        })
        .catch(err => console.error('Error al obtener clientes:', err));
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

function eliminarCliente(id, nombre) {
    const doDelete = () => {
        fetch('backend/gestionar_clientes.php', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `id=${id}`
        })
        .then(r => r.json())
        .then(d => {
            if (d.success) {
                if (typeof showToast === 'function') showToast('Alumno eliminado correctamente.', 'success');
                cargarClientes();
            } else {
                if (typeof showToast === 'function') showToast(d.error || 'Error al eliminar alumno', 'error');
            }
        });
    };

    if (typeof showConfirm === 'function') {
        showConfirm({
            title: '¿Eliminar Alumno?',
            message: `¿Estás seguro de eliminar a <strong>${nombre}</strong> del sistema?`,
            confirmText: 'Sí, Eliminar Alumno',
            confirmColor: 'red',
            onConfirm: doDelete
        });
    } else {
        if (confirm(`¿Eliminar a ${nombre}?`)) doDelete();
    }
}

// Modal Cargar Más Pases Rápidos
function openModalAddPases(id, nombre) {
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
