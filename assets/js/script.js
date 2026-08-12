// backend/js/script.js

// Interceptor global de fetch para inyectar token CSRF en peticiones POST/PUT/DELETE
(function() {
    const originalFetch = window.fetch;
    window.fetch = function(input, init) {
        init = init || {};
        const isWrite = init.method && ['POST', 'PUT', 'DELETE'].includes(init.method.toUpperCase());
        const csrfToken = document.cookie.match(/csrf_token=([^;]+)/)?.[1];
        if (isWrite && csrfToken) {
            init.headers = init.headers || {};
            if (init.headers instanceof Headers) {
                init.headers.set('X-CSRF-Token', csrfToken);
            } else if (Array.isArray(init.headers)) {
                init.headers.push(['X-CSRF-Token', csrfToken]);
            } else {
                init.headers['X-CSRF-Token'] = csrfToken;
            }
        }
        return originalFetch(input, init);
    };
})();

// ==========================================
// LÓGICA COMPARTIDA Y UTILIDADES
// ==========================================

window.confirmActionCallback = null;

// Estilos globales para la animación "pop" de los modales
if (!document.getElementById('global-modal-animations')) {
    const style = document.createElement('style');
    style.id = 'global-modal-animations';
    style.innerHTML = `
        @keyframes modalPop {
            0% { opacity: 0; transform: scale(0.85) translateY(15px); }
            60% { opacity: 1; transform: scale(1.03) translateY(-3px); }
            100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        .animate-modal-pop {
            animation: modalPop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards !important;
        }
    `;
    document.head.appendChild(style);
}

window.openRegisterModal = function(selectedPlan = 'Básico') {
    const modal = document.getElementById('registerModal');
    const content = document.getElementById('registerModalContent');
    if (!modal) return;
    const errorDiv = document.getElementById('registerError');
    if (errorDiv) errorDiv.classList.add('hidden');

    const regPlanEl = document.getElementById('regPlan');
    if (regPlanEl && selectedPlan) {
        const s = selectedPlan.toString().toLowerCase();
        if (s.includes('profesional') || s.includes('inter')) regPlanEl.value = 'Profesional';
        else if (s.includes('premium') || s.includes('prem')) regPlanEl.value = 'Premium';
        else regPlanEl.value = 'Básico';
    }

    modal.classList.remove('hidden');
    modal.classList.add('flex');
    setTimeout(() => { modal.classList.remove('opacity-0'); content.classList.remove('scale-95'); }, 10);
};

window.closeRegisterModal = function() {
    const modal = document.getElementById('registerModal');
    const content = document.getElementById('registerModalContent');
    if (!modal) return;
    modal.classList.add('opacity-0');
    content.classList.add('scale-95');
    setTimeout(() => { modal.classList.add('hidden'); }, 300);
};

window.selectPlan = function(planName) {
    let p = 'Básico';
    if (planName) {
        const s = planName.toString().toLowerCase();
        if (s.includes('profesional') || s.includes('inter')) p = 'Profesional';
        else if (s.includes('premium') || s.includes('prem')) p = 'Premium';
        else p = 'Básico';
    }
    window.location.href = 'registro.html?plan=' + encodeURIComponent(p);
};

window.submitRegister = function(e) {
    e.preventDefault();
    const btn = document.getElementById('btnRegisterSubmit');
    const errorDiv = document.getElementById('registerError');
    const orig = btn.innerHTML;
    errorDiv.classList.add('hidden');
    btn.disabled = true; btn.innerHTML = '<span class="material-symbols-outlined animate-spin text-[20px]">refresh</span> Creando cuenta y cargando agenda demo...';

    const diasChecked = Array.from(document.querySelectorAll('input[name="reg_dias"]:checked')).map(cb => cb.value).join(',');

    const formData = new URLSearchParams({
        nombre_completo: document.getElementById('regNombre').value,
        nombre_fantasia: document.getElementById('regNegocio').value,
        email: document.getElementById('regEmail').value,
        password: document.getElementById('regPassword').value,
        plan: document.getElementById('regPlan') ? document.getElementById('regPlan').value : 'Básico',
        max_profesionales: document.getElementById('regProfs') ? document.getElementById('regProfs').value : '1',
        hora_apertura: document.getElementById('regHoraApertura') ? document.getElementById('regHoraApertura').value : '09:00',
        hora_cierre: document.getElementById('regHoraCierre') ? document.getElementById('regHoraCierre').value : '19:00',
        dias_trabajo: diasChecked || '1,2,3,4,5,6',
        acepta_terminos: document.getElementById('regTerminos').checked ? '1' : '0'
    });

    fetch('backend/registrarse.php', { method: 'POST', body: formData })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            window.location.href = data.redirect || 'dashboard.html';
        } else {
            errorDiv.textContent = data.error || 'Error al crear la cuenta.';
            errorDiv.classList.remove('hidden');
        }
    })
    .catch(() => {
        errorDiv.textContent = 'Error de conexión con el servidor. Por favor reintenta.';
        errorDiv.classList.remove('hidden');
    })
    .finally(() => { btn.disabled = false; btn.innerHTML = orig; });
};

// Listener global para cerrar modales con la tecla Escape (ESC)
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' || e.key === 'Esc') {
        if (typeof window.closeRegisterModal === 'function') window.closeRegisterModal();
        if (typeof window.closePricesModal === 'function') window.closePricesModal();
        if (typeof window.closeClientDetailModal === 'function') window.closeClientDetailModal();
        if (typeof window.closeEditModal === 'function') window.closeEditModal();
        if (typeof window.closeEditInfoModal === 'function') window.closeEditInfoModal();
        if (typeof window.closeNoteModal === 'function') window.closeNoteModal();
        if (typeof window.closeReceiptModal === 'function') window.closeReceiptModal();
        if (typeof window.closeReportErrorModal === 'function') window.closeReportErrorModal();
        if (typeof window.closeContactSuccessModal === 'function') window.closeContactSuccessModal();
    }
});

window.showToast = function(message, type = 'success') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'fixed bottom-6 right-6 z-[60] flex flex-col gap-3 pointer-events-none';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    const bgColor = type === 'success' ? 'bg-green-600' : 'bg-red-600';
    const icon = type === 'success' ? 'check_circle' : 'error';
    
    toast.className = `${bgColor} text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-3 transform transition-all duration-300 translate-y-12 opacity-0 font-medium text-sm`;
    toast.innerHTML = `<span class="material-symbols-outlined">${icon}</span> <span>${message}</span>`;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.remove('translate-y-12', 'opacity-0'));
    setTimeout(() => { toast.classList.add('translate-y-12', 'opacity-0'); setTimeout(() => toast.remove(), 300); }, 3000);
};

window.showConfirm = function(title, message, acceptText, acceptColorClass, callback, extraHtml = '') {
    const confirmTitle = document.getElementById('confirmTitle');
    const confirmMessage = document.getElementById('confirmMessage');
    const btnAccept = document.getElementById('btnAcceptConfirm');
    if(!confirmTitle || !confirmMessage || !btnAccept) return;
    confirmTitle.textContent = title;
    confirmMessage.innerHTML = message + extraHtml;
    btnAccept.textContent = acceptText;
    btnAccept.className = `px-4 py-2.5 text-sm font-bold text-white rounded-xl transition-colors flex-1 ${acceptColorClass}`;
    window.confirmActionCallback = callback;
    const modal = document.getElementById('confirmModal');
    const content = document.getElementById('confirmModalContent');
    if(modal) modal.classList.remove('hidden');
    setTimeout(() => {
        if(modal) modal.classList.remove('opacity-0');
        if(content) content.classList.remove('scale-95');
        if(content) {
            content.classList.remove('scale-95', 'animate-modal-pop');
            void content.offsetWidth;
            content.classList.add('animate-modal-pop');
        }
    }, 10);
};

window.closeConfirm = function() {
    const modal = document.getElementById('confirmModal');
    const content = document.getElementById('confirmModalContent');
    if(modal) modal.classList.add('opacity-0');
    if(content) content.classList.add('scale-95');
    if(content) {
        content.classList.remove('animate-modal-pop');
        content.classList.add('scale-95');
    }
    setTimeout(() => { if(modal) modal.classList.add('hidden'); }, 300);
};

window.confirmarTurnoAdmin = function(id) {
    // Verificar si el turno está en el pasado
    let targetTurno = null;
    if (Array.isArray(window.agendaData)) {
        targetTurno = window.agendaData.find(t => t.id == id);
    }
    if (!targetTurno && Array.isArray(window.allAppointments)) {
        targetTurno = window.allAppointments.find(t => t.id == id);
    }
    
    if (targetTurno) {
        const tDate = new Date(targetTurno.fecha.replace(/-/g, '/') + ' ' + targetTurno.hora);
        const now = new Date();
        if (tDate < now) {
            showConfirm('Turno Antiguo', 'Este turno es del pasado y no se puede confirmar. ¿Deseas enviarlo a la papelera?', 'Sí, enviar a Papelera', 'bg-red-500 hover:bg-red-600', () => {
                window.cancelarTurnoAdmin(id, true);
            });
            return;
        }
    }

    showConfirm('Confirmar Turno', '¿Agendar y confirmar este turno? Aparecerá como ocupado para los clientes.', 'Confirmar', 'bg-amber-500 hover:bg-amber-600', () => {
        return fetch('backend/confirmar_turno.php', { method: 'POST', body: new URLSearchParams({id: id}) })
        .then(res => res.json())
        .then(data => {
            if(data.success) {
                showToast('Turno confirmado exitosamente', 'success');
                if (typeof window.refreshCalendarData === 'function') window.refreshCalendarData();
                if (typeof window.cargarAgenda === 'function') window.cargarAgenda();
                
                if (data.turno && data.turno.celular) {
                    const fParts = data.turno.fecha.split('-');
                    const fDisplay = fParts.length === 3 ? `${fParts[2]}/${fParts[1]}/${fParts[0]}` : data.turno.fecha;
                    const negocio = window.currentBusinessData ? window.currentBusinessData.nombre_fantasia : 'nuestro local';
                    const text = `Hola ${data.turno.nombre}, te confirmamos tu turno en ${negocio} para el ${fDisplay} a las ${data.turno.hora} hs (${data.turno.servicio}). ¡Te esperamos!`;
                    const phone = data.turno.celular.replace(/\D/g, '');
                    const url = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
                    
                    setTimeout(() => {
                        showConfirm('Avisar al cliente', '¿Deseas enviarle un WhatsApp al cliente avisándole que su turno fue confirmado?', 'Enviar WhatsApp', 'bg-emerald-500 hover:bg-emerald-600', () => { window.open(url, '_blank'); });
                    }, 500);
                }
            } else {
                showToast(data.error || 'No se pudo confirmar el turno.', 'error');
            }
        }).catch(() => showToast('Error de conexión', 'error'));
    });
};

window.cancelarTurnoAdmin = function(id, skipConfirm = false) {
    const doCancel = () => {
        const targetTurno = (window.agendaData || []).find(t => t.id == id);
        return fetch('backend/cancelar_turno.php', { method: 'POST', body: new URLSearchParams({id: id}) })
        .then(res => res.json())
        .then(data => {
            if(data.success) {
                showToast('Turno movido a la papelera exitosamente', 'success');
                localStorage.setItem('agendatina_unread_trash', 'true');
                
                // Abrir notificación por WhatsApp al cliente si hay celular disponible
                if (targetTurno) {
                    const rawCel = targetTurno.cliente_celular || targetTurno.celular || '';
                    const cel = rawCel.replace(/\D/g, '');
                    const clientName = targetTurno.cliente_nombre || (targetTurno.nombre + ' ' + (targetTurno.apellido || '')) || 'Cliente';
                    const servicio = targetTurno.servicio || 'tu servicio';
                    const fParts = (targetTurno.fecha || '').split('-');
                    const fDisplay = fParts.length === 3 ? `${fParts[2]}/${fParts[1]}/${fParts[0]}` : targetTurno.fecha;
                    const text = encodeURIComponent(`Hola ${clientName}, te informamos que tu turno para ${servicio} el día ${fDisplay} a las ${targetTurno.hora} hs ha sido cancelado.`);
                    if (cel) {
                        window.open(`https://wa.me/${cel}?text=${text}`, '_blank');
                    }
                }
                
                if (typeof window.refreshCalendarData === 'function') window.refreshCalendarData();
                if (typeof window.cargarAgenda === 'function') window.cargarAgenda();
            } else {
                showToast(data.error || 'No se pudo cancelar el turno.', 'error');
            }
        }).catch(() => showToast('Error de conexión', 'error'));
    };

    if (skipConfirm) {
        return doCancel();
    } else {
        showConfirm('Cancelar Turno', '¿Seguro que deseas cancelar y enviar este turno a la papelera?', 'Sí, Cancelar', 'bg-red-500 hover:bg-red-600', doCancel);
    }
};

window.ensureServicesLoaded = function() {
    if (window.services && window.services.length > 0) {
        return Promise.resolve(window.services);
    }
    return fetch('backend/gestionar_servicios.php' + (typeof window.negocioSlug !== 'undefined' && window.negocioSlug ? `?n=${window.negocioSlug}` : ''))
        .then(res => res.json())
        .then(servData => {
            if (Array.isArray(servData)) {
                window.services = servData;
            }
            return window.services || [];
        })
        .catch(() => window.services || []);
};

window.openEditTurnoModal = function(id) {
    // 1. Obtener datos del turno
    let turno = null;
    if (Array.isArray(window.agendaData)) {
        turno = window.agendaData.find(t => t.id == id);
    }
    if (!turno && Array.isArray(window.allAppointments)) {
        turno = window.allAppointments.find(t => t.id == id);
    }
    
    if (!turno) {
        showToast('No se encontraron los datos del turno.', 'error');
        return;
    }
    
    // Determinar si el turno está en el pasado (historial)
    const tDate = new Date(turno.fecha.replace(/-/g, '/') + ' ' + turno.hora);
    const now = new Date();
    const isPast = tDate < now;

    // 2. Asegurar que el modal existe en el DOM
    let modal = document.getElementById('editTurnoModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'editTurnoModal';
        modal.className = 'fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[150] hidden flex items-center justify-center p-4 opacity-0 transition-opacity duration-300';
        modal.innerHTML = `
            <div class="bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 max-w-md w-full p-8 transform scale-95 transition-transform duration-300 flex flex-col max-h-[90vh]" id="editTurnoModalContent">
                <div class="flex justify-between items-center mb-4 shrink-0">
                    <h2 class="text-xl font-bold text-slate-800 flex items-center gap-2" id="editModalTitleText">
                        <span class="material-symbols-outlined text-primary">edit_calendar</span> Modificar Turno
                    </h2>
                    <button type="button" onclick="window.closeEditTurnoModal()" class="text-slate-400 hover:text-red-500 transition-colors"><span class="material-symbols-outlined">close</span></button>
                </div>
                
                <div id="pastTurnoAlert" class="p-3 mb-3 text-slate-600 rounded-xl border border-slate-200 flex items-start gap-2 text-xs hidden shrink-0" style="background-color: #f8fafc;">
                    <span class="material-symbols-outlined text-slate-400 text-[18px] shrink-0 mt-0.5">info</span>
                    <div>
                        <p class="font-bold text-slate-700">Turno en el Historial</p>
                        <p class="text-slate-500">Este turno ya transcurrió. Solo puedes agregar o modificar las notas internas de control.</p>
                    </div>
                </div>

                <form id="editTurnoForm" class="space-y-4 overflow-y-auto pr-1 flex-1 custom-scrollbar">
                    <input type="hidden" id="editTurnoId" name="id">
                    
                    <div>
                        <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Nombre</label>
                        <input type="text" id="editTurnoNombre" name="nombre" required class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary outline-none text-sm text-slate-700">
                    </div>
                    
                    <div>
                        <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Apellido</label>
                        <input type="text" id="editTurnoApellido" name="apellido" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary outline-none text-sm text-slate-700">
                    </div>
                    
                    <div>
                        <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Celular</label>
                        <input type="text" id="editTurnoCelular" name="celular" required class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary outline-none text-sm text-slate-700">
                    </div>
                    
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Fecha</label>
                            <input type="date" id="editTurnoFecha" name="fecha" required class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary outline-none text-sm text-slate-700">
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Hora</label>
                            <input type="time" id="editTurnoHora" name="hora" required class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary outline-none text-sm text-slate-700">
                        </div>
                    </div>
                    
                    <div>
                        <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Servicio</label>
                        <select id="editTurnoServicio" name="servicio" required class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary outline-none text-sm text-slate-700">
                        </select>
                    </div>
                    
                    <div>
                        <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Profesional</label>
                        <select id="editTurnoProfesional" name="profesional" required class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary outline-none text-sm text-slate-700">
                        </select>
                    </div>

                    <div>
                        <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Notas internas (Ej: Mal trato, me cae bien, etc.)</label>
                        <textarea id="editTurnoNotas" name="notas" rows="2" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary outline-none text-sm text-slate-700 resize-none" placeholder="Agregar notas sobre este cliente..."></textarea>
                    </div>

                    <div>
                        <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Asistencia al Turno</label>
                        <select id="editTurnoAsistio" name="asistio" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary outline-none text-sm font-bold text-slate-700">
                            <option value="1">✓ Sí Asistió (Suma a Estadísticas)</option>
                            <option value="0">✕ No Asistió / Pendiente</option>
                        </select>
                    </div>
                    
                    <button type="submit" class="w-full bg-primary hover:bg-primary/95 text-white font-bold py-3.5 rounded-xl mt-2 transition-all flex items-center justify-center gap-2 shadow-lg shrink-0">Guardar Cambios</button>
                </form>
            </div>
        `;
        document.body.appendChild(modal);
        
        // Registrar evento submit
        document.getElementById('editTurnoForm').addEventListener('submit', function(e) {
            e.preventDefault();
            const submitBtn = e.target.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;
            submitBtn.disabled = true;
            submitBtn.innerHTML = 'Guardando...';
            
            const formData = new FormData(this);
            fetch('backend/editar_turno.php', {
                method: 'POST',
                body: new URLSearchParams(formData)
            })
            .then(res => res.json())
            .then(data => {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
                if (data.success) {
                    showToast('Turno y asistencia modificados correctamente', 'success');
                    window.closeEditTurnoModal();
                    if (typeof window.refreshCalendarData === 'function') window.refreshCalendarData();
                    if (typeof window.cargarAgenda === 'function') window.cargarAgenda();
                    if (typeof window.loadStatistics === 'function') window.loadStatistics();
                } else {
                    showToast(data.error || 'Error al modificar el turno', 'error');
                }
            })
            .catch(() => {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
                showToast('Error de conexión', 'error');
            });
        });
    }
    
    // 3. Cargar opciones de servicios y profesionales
    window.ensureServicesLoaded().then(servs => {
        const servSelect = document.getElementById('editTurnoServicio');
        servSelect.innerHTML = '';
        
        // Servicios únicos
        const uniqueServNames = [...new Set(servs.map(s => s.nombre))];
        uniqueServNames.forEach(s => {
            const selected = s === turno.servicio ? 'selected' : '';
            servSelect.innerHTML += `<option value="${s}" ${selected}>${s}</option>`;
        });
        
        // Profesionales
        const profSelect = document.getElementById('editTurnoProfesional');
        profSelect.innerHTML = '<option value="Cualquiera (Sin preferencia)">Cualquiera (Sin preferencia)</option>';
        const uniqueProfs = [...new Set(servs.map(s => s.profesional).filter(p => p && p.trim() !== '' && p.toLowerCase().trim() !== 'dueño principal'))];
        uniqueProfs.forEach(p => {
            const selected = p === turno.profesional ? 'selected' : '';
            profSelect.innerHTML += `<option value="${p}" ${selected}>${p}</option>`;
        });

        // Asegurar que si el select se renderiza de forma asíncrona, se mantenga deshabilitado
        if (isPast) {
            if (servSelect) { servSelect.disabled = true; servSelect.classList.add('bg-slate-100', 'opacity-70', 'pointer-events-none'); }
            if (profSelect) { profSelect.disabled = true; profSelect.classList.add('bg-slate-100', 'opacity-70', 'pointer-events-none'); }
        } else {
            if (servSelect) { servSelect.disabled = false; servSelect.classList.remove('bg-slate-100', 'opacity-70', 'pointer-events-none'); }
            if (profSelect) { profSelect.disabled = false; profSelect.classList.remove('bg-slate-100', 'opacity-70', 'pointer-events-none'); }
        }
    });
    
    // 4. Poblar datos
    let nombre = turno.nombre || '';
    let apellido = turno.apellido || '';
    if (!nombre && turno.cliente_nombre) {
        const parts = turno.cliente_nombre.trim().split(/\s+/);
        nombre = parts[0] || '';
        apellido = parts.slice(1).join(' ') || '';
    }
    
    document.getElementById('editTurnoId').value = id;
    document.getElementById('editTurnoNombre').value = nombre;
    document.getElementById('editTurnoApellido').value = apellido;
    document.getElementById('editTurnoCelular').value = turno.cliente_celular || turno.celular || '';
    document.getElementById('editTurnoFecha').value = turno.fecha;
    document.getElementById('editTurnoHora').value = turno.hora.substring(0, 5);
    document.getElementById('editTurnoNotas').value = turno.notas || '';
    if (document.getElementById('editTurnoAsistio')) {
        const estAsistio = (parseInt(turno.asistio) === 1 || turno.asistio === 'si' || turno.asistio === true || turno.estado === 'atendido' || turno.estado === 'asistio') ? '1' : '0';
        document.getElementById('editTurnoAsistio').value = estAsistio;
    }
    
    // Configurar UI según sea pasado o futuro
    const alertEl = document.getElementById('pastTurnoAlert');
    if (alertEl) {
        if (isPast) alertEl.classList.remove('hidden');
        else alertEl.classList.add('hidden');
    }
    
    const modalTitleText = document.getElementById('editModalTitleText');
    if (modalTitleText) {
        modalTitleText.innerHTML = isPast 
            ? '<span class="material-symbols-outlined text-primary">description</span> Detalles del Turno' 
            : '<span class="material-symbols-outlined text-primary">edit_calendar</span> Modificar Turno';
    }
    
    const submitBtn = document.getElementById('editTurnoForm')?.querySelector('button[type="submit"]');
    if (submitBtn) {
        submitBtn.textContent = isPast ? 'Guardar Cambios / Asistencia' : 'Guardar Cambios';
    }

    const inputsToLock = [
        document.getElementById('editTurnoNombre'),
        document.getElementById('editTurnoApellido'),
        document.getElementById('editTurnoCelular'),
        document.getElementById('editTurnoFecha'),
        document.getElementById('editTurnoHora'),
        document.getElementById('editTurnoServicio'),
        document.getElementById('editTurnoProfesional')
    ];

    inputsToLock.forEach(input => {
        if (!input) return;
        if (isPast) {
            if (input.tagName === 'SELECT') {
                input.disabled = true;
            } else {
                input.readOnly = true;
            }
            input.classList.add('bg-slate-100', 'opacity-70', 'pointer-events-none');
        } else {
            if (input.tagName === 'SELECT') {
                input.disabled = false;
            } else {
                input.readOnly = false;
            }
            input.classList.remove('bg-slate-100', 'opacity-70', 'pointer-events-none');
        }
    });

    // 5. Mostrar modal
    const content = document.getElementById('editTurnoModalContent');
    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        content.classList.remove('scale-95');
    }, 10);
};

window.closeEditTurnoModal = function() {
    const modal = document.getElementById('editTurnoModal');
    const content = document.getElementById('editTurnoModalContent');
    if (modal && content) {
        modal.classList.add('opacity-0');
        content.classList.add('scale-95');
        setTimeout(() => {
            modal.classList.add('hidden');
        }, 300);
    }
};

window.toggleAsistenciaTurno = function(idTurno, nuevoEstado) {
    fetch('backend/marcar_asistencia.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_turno: idTurno, asistio: nuevoEstado })
    })
    .then(r => r.json())
    .then(res => {
        if (res.success) {
            if (typeof showToast === 'function') {
                showToast(nuevoEstado === 1 ? '✓ Asistencia confirmada' : 'Asistencia registrada como no asistió', 'success');
            }
            if (typeof window.cargarAgenda === 'function') window.cargarAgenda();
            if (typeof window.refreshCalendarData === 'function') window.refreshCalendarData();
            if (typeof window.loadStatistics === 'function') window.loadStatistics();
        } else {
            if (typeof showToast === 'function') showToast(res.error || 'Error al actualizar asistencia', 'error');
        }
    })
    .catch(() => {
        if (typeof showToast === 'function') showToast('Error de conexión', 'error');
    });
};

// Función global para iniciar demostración interactiva (Botón Pruébalo ahora)
window.iniciarDemo = function() {
    const btn = document.activeElement;
    const originalText = btn && btn.tagName === 'BUTTON' ? btn.textContent : '';
    if (btn && btn.tagName === 'BUTTON') {
        btn.disabled = true;
        btn.textContent = 'Iniciando Demo...';
    }
    
    // Redirige al script que inicializa y resetea la DB temporal automáticamente
    window.location.href = 'demo.php';
};


// ==========================================
// LÓGICA CONFIGURACIÓN WEB (ADMIN)
// ==========================================

function loadAdminWebConfig() {
    fetch(`backend/guardar_web.php?n=${negocioSlug}`)
        .then(res => res.json())
        .then(data => {
            if (data && !data.error) {
                if (document.getElementById('colorPrimarioInput')) document.getElementById('colorPrimarioInput').value = data.color_primario_web || data.color_primario || '#D11149';
                if (document.getElementById('colorFondoInput')) document.getElementById('colorFondoInput').value = data.color_fondo || '#ffffff';
                if (document.getElementById('tituloWebInput')) document.getElementById('tituloWebInput').value = data.titulo || '';
            }
        })
        .catch(err => console.error('Error al cargar config web:', err));
}

function handleWebConfigSubmit(e) {
    e.preventDefault();
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn ? submitBtn.innerHTML : 'Guardar Diseño';
    if (submitBtn) submitBtn.innerHTML = 'Guardando...';

    const payload = {
        color_primario_web: document.getElementById('colorPrimarioInput')?.value || '#D11149',
        color_fondo: document.getElementById('colorFondoInput')?.value || '#ffffff',
        titulo: document.getElementById('tituloWebInput')?.value || ''
    };

    fetch('backend/guardar_web.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            showToast('Configuración visual guardada', 'success');
            applyWebCustomization(); // Refrescar los colores en pantalla sin recargar
        } else {
            showToast(data.error || 'Error al guardar la configuración.', 'error');
        }
    })
    .catch(err => console.error('Error:', err))
    .finally(() => { if (submitBtn) submitBtn.innerHTML = originalText; });
}

// ==========================================
window.clearUserCustomColors = function() {
    localStorage.removeItem('user_color_primario');
    localStorage.removeItem('user_color_secundario');
    localStorage.removeItem('user_colores_extra_json');
    const style = document.getElementById('agendatina-user-custom-colors');
    if (style) style.remove();
};

function logout(redirect = 'login.html') {
    showConfirm('Cerrar sesión', '¿Estás seguro que deseas salir de tu cuenta?', 'Cerrar sesión', 'bg-red-600 hover:bg-red-700', () => {
        if (typeof window.clearUserCustomColors === 'function') window.clearUserCustomColors();
        Object.keys(localStorage).forEach(k => { if (k.startsWith('agendatina_notifs_state_')) localStorage.removeItem(k); });
        sessionStorage.removeItem('agendatina_session');
        return fetch('backend/logout.php').then(() => window.location.href = redirect);
    });
}

// ==========================================
// LÓGICA PARA DASHBOARD.HTML
// ==========================================

window.currentWebData = window.currentWebData || {};

function loadDashboardData() {
    Promise.all([
        fetch('backend/perfil.php')
            .then(async res => {
                const text = await res.text();
                try {
                    return JSON.parse(text);
                } catch (e) {
                    console.error('Error PHP en perfil.php (Dashboard):', text);
                    return { success: false, error: 'Respuesta inválida de perfil.php' };
                }
            }).catch(err => ({ success: false, error: err.message })),
        fetch('backend/guardar_web.php')
            .then(async res => {
                const text = await res.text();
                try {
                    return JSON.parse(text);
                } catch (e) {
                    return {};
                }
            }).catch(() => ({})),
        fetch('backend/obtener_precios.php').then(res => res.json()).catch(() => null),
        fetch('backend/gestionar_servicios.php').then(res => res.json()).catch(() => []),
        fetch('backend/obtener_agenda.php').then(res => res.json()).catch(() => [])
    ])
    .then(([data, webData, pData, services, turnos]) => {
        if (!data || !data.success) {
            if (data && data.error && data.error.toLowerCase().includes('inicia sesión')) {
                window.location.href = 'login.html';
            } else {
                showDashboardError((data && data.error) || 'No se pudieron recuperar los datos de usuario o negocio.');
            }
            return;
        }

        sessionStorage.setItem('agendatina_session', 'active');
        const business = data.business || {};
            if (webData && !webData.error && webData.fecha_alta) {
                business.fecha_alta = webData.fecha_alta;
                if (webData.plan) business.plan = webData.plan;
                if (webData.estado_pago) business.estado_pago = webData.estado_pago;
                if (webData.ultimo_pago) business.ultimo_pago = webData.ultimo_pago;
            }
            window.currentUserData = data.user || {};
            window.currentBusinessData = business;
        
            // Modificar el saludo y el subtítulo
            const dashGreeting = document.getElementById('dashGreeting');
            const dashSubGreeting = document.getElementById('dashSubGreeting');
            if (dashGreeting && window.currentUserData.nombre_completo) {
                const firstName = window.currentUserData.nombre_completo.split(' ')[0];
                dashGreeting.innerHTML = `¡Hola, <span class="text-[#fc8712] font-black">${firstName}</span>!`;
            }
            if (dashSubGreeting && business.nombre_fantasia) {
                dashSubGreeting.innerHTML = `Gestionemos juntos tu negocio <span class="font-extrabold text-[#fc8712] bg-[#fc8712]/10 px-2 py-0.5 rounded-lg border border-[#fc8712]/20 inline-block">${business.nombre_fantasia}</span>`;
            }

            window.currentCustomNotifs = data.notificaciones || [];

            // Animaciones de Bienvenida (Primer inicio) y Modo Demo
            if (sessionStorage.getItem('agendatina_demo_alert')) {
                sessionStorage.removeItem('agendatina_demo_alert');
                setTimeout(() => {
                    if (typeof window.openDemoWelcomeNoticeModal === 'function') {
                        window.openDemoWelcomeNoticeModal();
                    }
                }, 300);
            }

            // Si el profesional debe cambiar su contraseña obligatoriamente por seguridad
            if (data.user && data.user.must_change_password) {
                setTimeout(() => {
                    if (typeof window.openObligatoryPasswordModal === 'function') {
                        window.openObligatoryPasswordModal();
                    }
                }, 1200);
            }
            
            // Modo DEMO: Ocultar botones de reporte y soporte / Mostrar para usuarios reales
            const isDemoUserCheck = (window.currentUserData && window.currentUserData.email === 'demo@agendatina.site') || (business && (business.ruta === 'demo' || business.is_demo));
            const cardSupport = document.getElementById('cardSupport');
            if (cardSupport) {
                cardSupport.style.display = isDemoUserCheck ? 'none' : 'flex';
            }
            if (isDemoUserCheck) {
                document.querySelectorAll('button[onclick^="openReportErrorModal"]').forEach(btn => btn.style.display = 'none');
            }

            // Actualizar Nombre en el Navbar como fallback rápido si tarda en cargar la web
            const dashBusinessName = document.getElementById('dashboardBusinessName');
            if (dashBusinessName) {
                const fallbackName = business.nombre_fantasia || (window.currentUserData && window.currentUserData.nombre_completo) || 'Mi Negocio';
                const currentText = dashBusinessName.textContent.trim();
                if (currentText === 'Cargando...' || currentText === 'Mi Negocio') {
                    dashBusinessName.textContent = fallbackName;
                    
                    const navAvatar = document.getElementById('navAvatar');
                    if (navAvatar && !navAvatar.querySelector('img')) {
                        const words = fallbackName.trim().split(/\s+/);
                        const initials = words.length > 1 ? (words[0][0] + words[1][0]) : fallbackName.substring(0, 2);
                        navAvatar.innerHTML = initials.toUpperCase();
                    }
                }
            }

            // Actualizar Plan en el Navbar
            const isDemoAccount = (window.currentUserData && window.currentUserData.email && window.currentUserData.email.includes('demo')) || (business && (business.ruta === 'demo' || business.is_demo));
            const navPlanName = document.getElementById('navPlanName');
            let displayPlan = isDemoAccount ? (business.plan ? `Plan ${business.plan}` : 'Plan Completo') : (business.plan || 'Plan Simple');
            if (displayPlan.toLowerCase().includes('básico') || displayPlan.toLowerCase().includes('basico')) {
                displayPlan = 'Plan Simple';
            } else if (!displayPlan.toLowerCase().includes('plan')) {
                displayPlan = 'Plan ' + displayPlan.charAt(0).toUpperCase() + displayPlan.slice(1);
            }
            if (navPlanName) navPlanName.textContent = displayPlan;

            // Alerta si los días de trabajo están vacíos
            const configAlertBanner = document.getElementById('configAlertBanner');
            if (configAlertBanner) {
                configAlertBanner.classList.add('hidden');
                configAlertBanner.classList.remove('flex');
            }

            // Configurar modal de pago con el plan correcto
            const paymentPlanName = document.getElementById('paymentPlanName');
            if (paymentPlanName) paymentPlanName.textContent = displayPlan;
            
            const paymentPrice = document.getElementById('paymentPrice');
            
            const planStr = (business.plan || '').toLowerCase();
            const dbStatus = business.estado_pago || 'prueba';

            // Ocultar funciones del dashboard según el plan contratado
            const cardAgenda = document.getElementById('cardAgenda');
            const cardWeb = document.getElementById('cardWeb');
            const cardCalendario = document.getElementById('cardCalendario');
            
            // Actualizar el enlace al calendario detectando si es mensual o semanal
            if (cardCalendario) {
                const isWeekly = webData.tipo_calendario === 'semanal';
                cardCalendario.href = isWeekly ? 'calendarioSemanal.html' : 'calendarioMensual.html';
            }

            if (cardAgenda && cardWeb) {
                cardAgenda.style.display = 'flex';
                cardWeb.style.display = 'flex';
                
                if (planStr.includes('básico') || planStr.includes('basico') || planStr.includes('simple')) {
                    cardAgenda.style.display = 'none'; // Plan simple: Oculta Agenda y Web
                    cardWeb.style.display = 'none';
                } else if (planStr.includes('intermedio') || planStr.includes('profesional')) {
                    cardWeb.style.display = 'none';    // Plan Profesional/Intermedio: Oculta la Web Pública
                }
                
                // Respaldo de seguridad por si el plan falló en cargar antes
                if (data.plan) {
                    const navPlanName = document.getElementById('navPlanName');
                    if (navPlanName && (navPlanName.textContent === 'Cargando plan...' || navPlanName.textContent === 'Plan Básico' || navPlanName.textContent === 'Plan Simple')) {
                        let pName = data.plan;
                        if (pName.toLowerCase().includes('básico') || pName.toLowerCase().includes('basico')) pName = 'Simple';
                        if (!pName.toLowerCase().includes('plan')) pName = 'Plan ' + pName.charAt(0).toUpperCase() + pName.slice(1);
                        navPlanName.textContent = pName;
                    }
                }
            }

            // Calcular estado de suscripción
            const fechaAltaStr = business.fecha_alta ? business.fecha_alta.split(' ')[0] : new Date().toISOString().split('T')[0];

            const subscriptionData = {
                status: dbStatus,
                fechaAlta: fechaAltaStr,
                lastPaymentDate: business.ultimo_pago ? business.ultimo_pago.split(' ')[0] : null,
                plan: (business.plan && !business.plan.toLowerCase().includes('basic')) ? business.plan : 'Simple'
            };

            // Integrar la carga de precios al Banner de Suscripción y al Modal de Pago
            let basePrice = 8889;
            let discount = 10;
            
            if(pData && pData.success) {
                basePrice = parseFloat(pData.data.precio_basico);
                if (planStr.includes('intermedio') || planStr.includes('profesional')) basePrice = parseFloat(pData.data.precio_intermedio);
                if (planStr.includes('completo') || planStr.includes('premium')) basePrice = parseFloat(pData.data.precio_premium);
                
                discount = parseInt(pData.data.descuento_porcentaje) || 0;
                if (pData.data.descuento_hasta) {
                    const expiry = new Date(pData.data.descuento_hasta.replace(/-/g, '/'));
                    if (new Date() > expiry) discount = 0;
                }
            }
            
            const hasDiscount = discount > 0;
            let finalPrice = hasDiscount ? basePrice * (1 - discount/100) : basePrice;
            let formattedPrice = finalPrice.toLocaleString('es-AR', {maximumFractionDigits:0});
            
            if (paymentPrice) {
                let discountBadge = '';
                if (hasDiscount) discountBadge = `<div class="flex flex-wrap items-center justify-center gap-2 mb-1"><span class="text-sm text-slate-400 line-through font-medium">$${basePrice.toLocaleString('es-AR', {maximumFractionDigits:0})}</span><span class="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-md text-xs font-bold">-${discount}% OFF</span></div>`;
                paymentPrice.innerHTML = `${discountBadge}$${formattedPrice} <span class="text-base font-normal text-slate-400">/mes</span>`;
            }
            
            subscriptionData.priceFormatted = formattedPrice;
            checkSubscription(subscriptionData);
            
            // --- ONBOARDING WIDGET (TUTORIAL & TOUR VIRTUAL) ---
            const onboardingWidget = document.getElementById('onboardingWidget');
            if (onboardingWidget) {
                let hasConfig = webData.dias_trabajo && webData.dias_trabajo.trim() !== '';
                let hasServices = Array.isArray(services) && services.length > 0;
                let hasTurnos = Array.isArray(turnos) && turnos.length > 0;

                if (hasConfig && hasServices && hasTurnos && window.currentUserData.email !== 'demo@agendatina.site') {
                    onboardingWidget.classList.add('hidden');
                    onboardingWidget.style.display = 'none';
                } else {
                    onboardingWidget.classList.remove('hidden');
                    onboardingWidget.style.display = 'block';
                    
                    const isDemoUser = (window.currentUserData && window.currentUserData.email && window.currentUserData.email.includes('demo')) || (business && (business.ruta === 'demo' || business.is_demo));
                    
                    const step1Icon = document.getElementById('step1Icon');
                    const step1Text = document.getElementById('step1Text');
                    if (hasConfig && !isDemoUser) {
                        if(step1Icon) { step1Icon.innerHTML = '<span class="material-symbols-outlined text-white text-sm">check</span>'; step1Icon.className = 'w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-sm'; }
                        if(step1Text) {
                            step1Text.classList.add('line-through', 'text-slate-400');
                            const desc = step1Text.parentElement.nextElementSibling;
                            if (desc) desc.classList.add('line-through', 'opacity-50');
                            const link = desc ? desc.nextElementSibling : null;
                            if (link) link.style.display = 'none';
                        }
                    }

                    const step2Icon = document.getElementById('step2Icon');
                    const step2Text = document.getElementById('step2Text');
                    const step2Link = document.getElementById('step2Link');
                    if(step2Link) step2Link.href = webData.tipo_calendario === 'semanal' ? 'calendarioSemanal.html' : 'calendarioMensual.html';
                    
                    if (hasServices && !isDemoUser) {
                        if(step2Icon) { step2Icon.innerHTML = '<span class="material-symbols-outlined text-white text-sm">check</span>'; step2Icon.className = 'w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-sm'; }
                        if(step2Text) {
                            step2Text.classList.add('line-through', 'text-slate-400');
                            const desc = step2Text.parentElement.nextElementSibling;
                            if (desc) desc.classList.add('line-through', 'opacity-50');
                            const link = desc ? desc.nextElementSibling : null;
                            if (link) link.style.display = 'none';
                        }
                    }

                    const step3Link = document.getElementById('step3Link');
                    const step3Icon = document.getElementById('step3Icon');
                    const step3Text = document.getElementById('step3Text');
                    if (hasConfig && hasServices && step3Link) {
                        step3Link.classList.remove('opacity-50', 'pointer-events-none');
                        step3Link.href = (business.ruta || business.subdominio) ? '/' + (business.ruta || business.subdominio) : '#';
                    }
                    if (hasTurnos && !isDemoUser) {
                        if(step3Icon) { step3Icon.innerHTML = '<span class="material-symbols-outlined text-white text-sm">check</span>'; step3Icon.className = 'w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-sm'; }
                        if(step3Text) {
                            step3Text.classList.add('line-through', 'text-slate-400');
                            const desc = step3Text.parentElement.nextElementSibling;
                            if (desc) desc.classList.add('line-through', 'opacity-50');
                            const link = desc ? desc.nextElementSibling : null;
                            if (link) link.style.display = 'none';
                        }
                    }
                }
            }

            checkNotifications(); // Cargar notificaciones en la campanita
            loadDashboardChart(webData.color_primario || '#3b82f6');
            
            // Revelar el dashboard suavemente
            const loader = document.getElementById('dashboardLoader');
            const mainContent = document.getElementById('dashboardMainContent');
            if (loader && mainContent) {
                loader.classList.add('hidden');
                mainContent.classList.remove('hidden');
                setTimeout(() => mainContent.classList.remove('opacity-0'), 50);
            }
    })
    .catch(err => {
        console.error('Error al cargar datos del dashboard:', err);
        showDashboardError('Error al conectar con el servidor: ' + err.message);
    });
}


function showDashboardError(msg) {
    const loader = document.getElementById('dashboardLoader');
    if (loader) {
        loader.innerHTML = `
            <div class="p-6 max-w-sm mx-auto bg-white rounded-2xl shadow-md border border-red-100 text-center">
                <span class="material-symbols-outlined text-red-500 text-5xl mb-3">error</span>
                <p class="font-bold text-slate-800 text-base mb-2">Error de Carga</p>
                <p class="text-sm text-slate-500 mb-4">${msg}</p>
                <button onclick="window.location.reload()" class="bg-primary text-white font-bold py-2 px-6 rounded-xl text-sm transition-all hover:bg-primary/90">Reintentar</button>
            </div>
        `;
    }
}

function checkSubscription(subscriptionData) {
    const banner = document.getElementById('subscriptionBanner');
    const subMessage = document.getElementById('subMessage');
    const subIcon = document.getElementById('subIcon');
    const subActionBtn = document.getElementById('subActionBtn');
    
    if (!banner) return;

    const todayZero = new Date();
    todayZero.setHours(0,0,0,0);
    
    const fechaAlta = new Date(subscriptionData.fechaAlta.replace(/-/g, '/') + ' 00:00:00');
    const lastPayment = subscriptionData.lastPaymentDate ? new Date(subscriptionData.lastPaymentDate.replace(/-/g, '/') + ' 00:00:00') : null;

    let cycleStart = lastPayment ? lastPayment : fechaAlta;
    let cycleDays = 30; // Estándar de 30 días para todos los períodos de facturación
    let graceDays = (subscriptionData.status === 'prueba') ? 0 : 5;

    const cycleEnd = new Date(cycleStart);
    cycleEnd.setDate(cycleEnd.getDate() + cycleDays);

    const nextBillingStr = cycleEnd.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });

    const paymentDeadline = new Date(cycleEnd);
    paymentDeadline.setDate(paymentDeadline.getDate() + graceDays);

    const diffToCycleEnd = Math.ceil((cycleEnd - todayZero) / (1000 * 60 * 60 * 24));
    const diffToDeadline = Math.ceil((paymentDeadline - todayZero) / (1000 * 60 * 60 * 24));

    // Variables de configuración de la UI
    let isDashboardBannerHidden = true;
    let dashBannerClass = '';
    let dashIcon = '';
    let dashMsg = '';
    let dashBtnText = '';
    let dashBtnClass = '';
    let showActionBtn = false;
    
    let priceStr = subscriptionData.priceFormatted ? ` <strong>$${subscriptionData.priceFormatted}</strong>` : '';

    if (subscriptionData.status === 'prueba') {
        if (diffToCycleEnd > 0) {
            isDashboardBannerHidden = false;
            dashBannerClass = 'mb-8 p-4 rounded-2xl shadow-sm flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between bg-blue-50 border border-blue-200 text-blue-800';
            dashIcon = 'schedule';
            dashMsg = `Estás en tu período de prueba. Te quedan <strong>${diffToCycleEnd} días</strong> de acceso gratuito. Tu próximo período de facturación inicia el <strong>${nextBillingStr}</strong> (Abonarás tu primer mes${priceStr}). <em>Nota: Los aumentos de tarifa se aplican a partir de tu siguiente ciclo de facturación.</em>`;
            showActionBtn = false; // El botón de pago no estará habilitado durante la prueba gratuita
        } else {
            subscriptionData.status = 'suspendido';
            isDashboardBannerHidden = false;
            dashBannerClass = 'mb-8 p-4 rounded-2xl shadow-sm flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between bg-red-50 border border-red-200 text-red-800';
            dashIcon = 'error';
            dashMsg = `Tu período de prueba ha finalizado. Debes abonar tu primer mes${priceStr} para reactivar el servicio. El nuevo ciclo de 30 días correrá a partir de que el pago sea aprobado.`;
            dashBtnText = 'Pagar Plan';
            dashBtnClass = 'bg-red-600 hover:bg-red-700 text-white';
            showActionBtn = true;
        }
    } else if (subscriptionData.status === 'beta') {
        if (diffToCycleEnd > 0) {
            isDashboardBannerHidden = false;
            dashBannerClass = 'mb-8 p-4 rounded-2xl shadow-sm flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between bg-blue-50 border border-blue-200 text-blue-800';
            dashIcon = 'schedule';
            dashMsg = `Estás en la fase beta. Te quedan ${diffToCycleEnd} días gratuitos.`;
            showActionBtn = false;
        } else if (diffToDeadline >= 0) {
            isDashboardBannerHidden = false;
            dashBannerClass = 'mb-8 p-4 rounded-2xl shadow-sm flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between bg-amber-50 border border-amber-200 text-amber-800';
            dashIcon = 'warning';
            dashMsg = `Tu periodo beta ha finalizado. Tienes <strong>${diffToDeadline} días de gracia</strong> para abonar tu primer mes${priceStr} antes de que se suspenda el servicio.`;
            dashBtnText = 'Pagar ahora';
            dashBtnClass = 'bg-amber-500 hover:bg-amber-600 text-white';
            showActionBtn = true;
        } else {
            subscriptionData.status = 'suspendido';
        }
    } else if (subscriptionData.status === 'activo' || subscriptionData.status === 'pagado') {
        if (diffToCycleEnd > 0) {
            isDashboardBannerHidden = false;
            dashBannerClass = 'mb-8 p-4 rounded-2xl shadow-sm flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between bg-emerald-50 border border-emerald-200 text-emerald-800';
            dashIcon = 'check_circle';
            dashMsg = `Tu cuenta está al día y tu pago fue aprobado. Te quedan <strong>${diffToCycleEnd} días</strong> de servicio.`;
            showActionBtn = false;
        } else if (diffToDeadline >= 0) {
            isDashboardBannerHidden = false;
            dashBannerClass = 'mb-8 p-4 rounded-2xl shadow-sm flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between bg-amber-50 border border-amber-200 text-amber-800';
            dashIcon = 'warning';
            dashMsg = `Tu mes de servicio ha finalizado. Tienes <strong>${diffToDeadline} días de gracia</strong> para renovar tu suscripción${priceStr} y evitar interrupciones.`;
            dashBtnText = 'Renovar Plan';
            dashBtnClass = 'bg-amber-500 hover:bg-amber-600 text-white';
            showActionBtn = true;
        } else {
            subscriptionData.status = 'suspendido';
        }
    } else if (subscriptionData.status === 'pendiente_revision') {
        isDashboardBannerHidden = false;
        dashBannerClass = 'mb-8 p-4 rounded-2xl shadow-sm flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between bg-amber-50 border border-amber-200 text-amber-800';
        dashIcon = 'hourglass_empty';
        dashMsg = 'Tu pago está en revisión. Pronto actualizaremos tu estado.';
        dashBtnText = 'Ver comprobantes';
        dashBtnClass = 'bg-amber-500 hover:bg-amber-600 text-white';
        showActionBtn = true;
    }

    // Estado Impago / Suspendido
    if (subscriptionData.status === 'suspendido' || subscriptionData.status === 'unpaid') {
        if (!dashMsg) {
            isDashboardBannerHidden = false;
            dashBannerClass = 'mb-8 p-4 rounded-2xl shadow-sm flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between bg-red-50 border border-red-200 text-red-800';
            dashIcon = 'error';
            dashMsg = `Tu último comprobante fue rechazado o tu cuenta registra un saldo pendiente. Aboná${priceStr} para reactivar el servicio.`;
            dashBtnText = 'Pagar Plan';
            dashBtnClass = 'bg-red-600 hover:bg-red-700 text-white';
            showActionBtn = true;
        }
    }

    const isDemo = (window.currentUserData && window.currentUserData.email && window.currentUserData.email.includes('demo')) || 
                   (window.currentBusinessData && (window.currentBusinessData.ruta === 'demo' || window.currentBusinessData.is_demo)) ||
                   (sessionStorage.getItem('is_demo_user') === 'true');

    if (isDemo) {
        isDashboardBannerHidden = true;
    }

    // Renderizado en Dashboard
    if (!isDashboardBannerHidden) {
        banner.className = dashBannerClass;
        subIcon.textContent = dashIcon;
        subMessage.innerHTML = dashMsg;
        banner.classList.remove('hidden');
    } else {
        banner.classList.add('hidden');
    }

    if (showActionBtn) {
        subActionBtn.textContent = dashBtnText;
        subActionBtn.className = `px-5 py-2.5 rounded-xl text-sm font-bold transition-transform hover:-translate-y-0.5 ${dashBtnClass}`;
        subActionBtn.classList.remove('hidden');
        if (subscriptionData.status === 'pendiente_revision' && window.currentBusinessData && window.currentBusinessData.comprobante) {
            subActionBtn.onclick = () => window.verComprobanteModal(window.currentBusinessData.comprobante);
        } else {
            subActionBtn.onclick = () => {
                if (isDemo) {
                    window.showDemoPaymentNoticeModal();
                } else {
                    window.location.href = 'pago.html';
                }
            };
        }
    } else {
        subActionBtn.classList.add('hidden');
    }
}

window.showDemoPaymentNoticeModal = function() {
    let modal = document.getElementById('globalDemoPaymentModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'globalDemoPaymentModal';
        modal.className = 'fixed inset-0 z-[999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-all duration-300';
        modal.innerHTML = `
            <div class="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-slate-100 text-center animate-modal-pop">
                <div class="mx-auto flex items-center justify-center h-16 w-16 rounded-2xl bg-amber-50 text-amber-500 mb-4 border border-amber-100">
                    <span class="material-symbols-outlined text-3xl">info</span>
                </div>
                <h3 class="text-xl font-extrabold text-slate-800 mb-2">Cuenta de Demostración</h3>
                <p class="text-slate-600 text-sm leading-relaxed mb-6">
                    Estás explorando Agendatina en modo de <strong>Demostración</strong>. No es necesario abonar planes ni realizar pagos en esta cuenta de prueba.
                </p>
                <button onclick="document.getElementById('globalDemoPaymentModal').classList.add('hidden')" class="w-full bg-slate-800 hover:bg-slate-900 text-white font-extrabold py-3.5 px-6 rounded-2xl transition-all shadow-md cursor-pointer">
                    Entendido
                </button>
            </div>
        `;
        document.body.appendChild(modal);
    } else {
        modal.classList.remove('hidden');
    }
};

document.addEventListener('click', function(e) {
    const link = e.target.closest('a[href*="pago.html"]');
    if (link) {
        const isDemo = (sessionStorage.getItem('is_demo_user') === 'true') ||
                       (sessionStorage.getItem('agendatina_demo_alert') === 'true');
        if (isDemo) {
            e.preventDefault();
            window.showDemoPaymentNoticeModal();
        }
    }
});

// --- GRÁFICO SEMANAL (CHART.JS) ---
function loadDashboardChart(chartColor) {
    const ctx = document.getElementById('weeklyChart');
    if (!ctx) return;

    // Cargar Chart.js dinámicamente solo si no está en el HTML
    if (typeof Chart === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
        script.onload = () => renderWeeklyChart(ctx, chartColor);
        document.head.appendChild(script);
    } else {
        renderWeeklyChart(ctx, chartColor);
    }
}

function renderWeeklyChart(ctx, chartColor) {
    fetch('backend/obtener_agenda.php')
    .then(res => res.json())
    .then(data => {
        if (data && data.error) return;
        if (!Array.isArray(data)) return;

        const days = [];
        const counts = [];
        const labels = [];
        
        // Construir los últimos 7 días (De hace 6 días a Hoy)
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            days.push(d.toISOString().split('T')[0]);
            counts.push(0);
            // Obtener el día de la semana (ej: LUN, MAR)
            labels.push(new Intl.DateTimeFormat('es-ES', { weekday: 'short' }).format(d).toUpperCase());
        }

        // Contar los turnos que coincidan con esos días (excluyendo los bloqueos)
        data.forEach(t => {
            const idx = days.indexOf(t.fecha);
            if (idx !== -1 && t.estado !== 'bloqueado') counts[idx]++;
        });

        if (window.myWeeklyChart) window.myWeeklyChart.destroy();

        window.myWeeklyChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{ label: 'Turnos', data: counts, backgroundColor: chartColor, borderRadius: 6, borderSkipped: false }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: { y: { beginAtZero: true, ticks: { stepSize: 1, precision: 0 } }, x: { grid: { display: false } } },
                plugins: { legend: { display: false } }
            }
        });
    }).catch(err => console.error('Error al cargar datos del gráfico:', err));
}

// Generador seguro de clave LocalStorage para notificaciones
window.getNotifStorageKey = () => {
    const identifier = (window.currentBusinessData && window.currentBusinessData.id) || (window.currentUserData && window.currentUserData.email) || 'default';
    return 'agendatina_notifs_state_' + identifier;
};

// --- LÓGICA DE NOTIFICACIONES (CAMPANITA) ---
function checkNotifications() {
    const notifList = document.getElementById('notifList');
    const notifBadge = document.getElementById('notifBadge');
    if (!notifList) return;
    
    // Auto-refresco en segundo plano cada 30 segundos (Tiempo real)
    if (!window.notifPollingInterval) {
        window.notifPollingInterval = setInterval(checkNotifications, 30000);
    }

    fetch('backend/obtener_agenda.php')
    .then(res => {
        if (!res.ok) throw new Error('Error en respuesta del servidor (' + res.status + ')');
        return res.json();
    })
    .then(data => {
        let notifState = JSON.parse(localStorage.getItem(window.getNotifStorageKey()) || '{}');
        let currentNotifs = [];
        if(Array.isArray(data)) {
            const businessPlan = window.currentBusinessData?.plan?.toLowerCase() || 'basico';
            const isBasic = businessPlan.includes('básico') || businessPlan.includes('basico') || businessPlan.includes('simple') || businessPlan.includes('basico');

            const pendientes = data.filter(t => t.estado === 'pendiente');
            if (pendientes.length > 0) {
                pendientes.forEach(t => {
                    const calPage = window.currentWebData?.tipo_calendario === 'semanal' ? 'calendarioSemanal.html' : 'calendarioMensual.html';
                    const notifLink = isBasic ? `${calPage}?date=${t.fecha}` : `agenda.html?focus=${t.id}`;
                    currentNotifs.push({ 
                        id: 'turno_' + t.id,
                        icon: 'event', 
                        color: 'text-primary', 
                        bg: 'bg-primary/10', 
                        title: `Nuevo turno: ${t.cliente_nombre || (t.nombre + ' ' + (t.apellido || ''))}`, 
                        text: `Solicitud para el ${t.fecha} a las ${t.hora} hs.`,
                        link: notifLink,
                        timestamp: new Date(t.fecha.replace(/-/g, '/') + ' ' + t.hora).getTime() || Date.now()
                    });
                });
            }
        }

        const cNotifs = window.currentCustomNotifs || [];
        cNotifs.forEach(n => {
            currentNotifs.push({
                id: 'custom_' + n.id,
                id_reporte: n.id_reporte || null,
                icon: 'campaign',
                color: 'text-blue-500',
                bg: 'bg-blue-100',
                title: n.titulo,
                text: n.mensaje,
                link: '#',
                timestamp: new Date(n.fecha.replace(/-/g, '/')).getTime() || Date.now()
            });
        });

        if (window.currentBusinessData) {
            const status = window.currentBusinessData.estado_pago;
            // Calcular horas desde el último pago aprobado para que no se muestre por siempre
            const ultimoPagoDate = window.currentBusinessData.ultimo_pago ? new Date(window.currentBusinessData.ultimo_pago.replace(/-/g, '/')) : new Date(0);
            const diffHours = (new Date() - ultimoPagoDate) / (1000 * 60 * 60);

            if ((status === 'activo' || status === 'pagado') && diffHours < 72) {
                currentNotifs.push({ id: 'pago_ok_' + ultimoPagoDate.getTime(), icon: 'check_circle', color: 'text-emerald-500', bg: 'bg-emerald-100', title: 'Pago Aprobado', text: 'Tu último comprobante ha sido verificado.', link: '#', timestamp: ultimoPagoDate.getTime() });
            } else if (status === 'pendiente_revision') {
                currentNotifs.push({ id: 'pago_rev', icon: 'hourglass_empty', color: 'text-amber-500', bg: 'bg-amber-100', title: 'Pago en Revisión', text: 'Estamos verificando tu comprobante.', link: '#', timestamp: Date.now() });
            }
        }

        currentNotifs.forEach(n => {
            if (!notifState[n.id]) { notifState[n.id] = { ...n, read: false, deleted: false, time: Date.now() }; } 
            else { notifState[n.id].title = n.title; notifState[n.id].text = n.text; notifState[n.id].link = n.link; notifState[n.id].id_reporte = n.id_reporte; }
        });

        // Auto-Limpieza: Eliminamos notificaciones huérfanas (ej. de la Demo o turnos borrados) para no mezclarlas
        const validIds = currentNotifs.map(n => n.id);
        Object.keys(notifState).forEach(key => {
            if (!validIds.includes(key)) {
                delete notifState[key];
            }
        });

        let displayNotifs = Object.values(notifState).filter(n => !n.deleted);
        displayNotifs.sort((a, b) => b.time - a.time);

        if (displayNotifs.length > 100) {
            const toDelete = displayNotifs.slice(100);
            toDelete.forEach(n => delete notifState[n.id]);
            displayNotifs = displayNotifs.slice(0, 100);
        }
        localStorage.setItem(window.getNotifStorageKey(), JSON.stringify(notifState));

        // Evitar parpadeos en el menú (No re-escribir HTML si los datos no cambiaron)
        const currentNotifHash = JSON.stringify(displayNotifs);
        if (window.lastNotifHash === currentNotifHash) return;
        window.lastNotifHash = currentNotifHash;

        notifList.innerHTML = '';
        const unreadCount = displayNotifs.filter(n => !n.read).length;

        if (unreadCount > 0 && notifBadge) {
            if(notifBadge) notifBadge.classList.remove('hidden');
        } else if (notifBadge) {
            if(notifBadge) notifBadge.classList.add('hidden');
        }

        if (displayNotifs.length > 0) {
            displayNotifs.forEach(n => {
                const isReport = n.id_reporte || (n.title && (n.title.includes('Soporte') || n.title.includes('Reporte')));
                const safeTitle = (n.title || '').replace(/'/g, "\\'");
                const onClickAction = isReport ? `onclick="window.abrirHiloSoporteCliente(${n.id_reporte || 0}, '${safeTitle}')"` : (n.link === '#' ? '' : `onclick="window.location.href='${n.link ? n.link : 'agenda.html'}'"`);
                const cursorStyle = (n.link === '#' && !isReport) ? 'cursor-default' : 'cursor-pointer hover:bg-slate-100';
                const dot = n.read ? '' : '<span class="w-2 h-2 rounded-full bg-red-500 mt-2"></span>';
                
                notifList.innerHTML += `
                    <div class="p-3 ${cursorStyle} rounded-xl transition-colors flex gap-3 items-start relative group" ${onClickAction}>
                        <div class="${n.bg} ${n.color} p-2 rounded-lg flex-shrink-0 flex items-center justify-center">
                            <span class="material-symbols-outlined text-[18px]">${n.icon}</span>
                        </div>
                        <div class="flex-1 pr-6">
                            <p class="text-sm font-bold text-slate-800">${n.title}</p>
                            <p class="text-xs text-slate-500 leading-tight mt-0.5">${n.text}</p>
                            ${isReport ? '<span class="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 mt-1.5 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100"><span class="material-symbols-outlined text-[12px]">forum</span> Ver conversación / Responder</span>' : ''}
                        </div>
                        <div class="absolute right-3 top-3 flex flex-col items-end gap-2">
                            ${dot}
                            <button onclick="deleteNotif(event, '${n.id}')" class="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" title="Eliminar notificación">
                                <span class="material-symbols-outlined text-[16px]">delete</span>
                            </button>
                        </div>
                    </div>`;
            });
        } else {
            notifList.innerHTML = '<div class="p-4 text-center text-sm text-slate-400">No hay notificaciones nuevas</div>';
        }
    }).catch(err => {
        // Manejo silencioso de desconexión/DNS temporal sin interrumpir el funcionamiento de la app
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            console.warn('Conexión con el servidor intermitente:', err.message);
        }
    });
}

window.toggleNotifications = function(e) {
    e.stopPropagation();
    const dropdown = document.getElementById('notifDropdown');
    if (dropdown) dropdown.classList.toggle('hidden');
};

window.markAllRead = function(e) {
    if(e) e.stopPropagation();
    let notifState = JSON.parse(localStorage.getItem(window.getNotifStorageKey()) || '{}');
    Object.values(notifState).forEach(n => n.read = true);
    localStorage.setItem(window.getNotifStorageKey(), JSON.stringify(notifState));
    checkNotifications();
};

window.deleteAllNotifs = function(e) {
    if(e) e.stopPropagation();
    localStorage.setItem(window.getNotifStorageKey(), '{}');
    checkNotifications();
};

window.deleteNotif = function(e, id) {
    e.stopPropagation();
    let notifState = JSON.parse(localStorage.getItem(window.getNotifStorageKey()) || '{}');
    if (notifState[id]) {
        notifState[id].deleted = true;
        localStorage.setItem(window.getNotifStorageKey(), JSON.stringify(notifState));
        checkNotifications();
    }
};

document.addEventListener('click', () => { const dropdown = document.getElementById('notifDropdown'); if (dropdown && !dropdown.classList.contains('hidden')) { dropdown.classList.add('hidden'); } });

// Cerrar modales con tecla ESC
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const modalsToClose = [
            { id: 'servicesModal', closeFn: () => { if(typeof closeServicesModal === 'function') closeServicesModal(); } },
            { id: 'manualTurnoModal', closeFn: () => { if(typeof closeManualTurnoModal === 'function') closeManualTurnoModal(); } },
            { id: 'confirmModal', closeFn: () => { if(typeof closeConfirm === 'function') closeConfirm(); } },
            { id: 'profileModal', closeFn: () => { if(typeof closeProfileModal === 'function') closeProfileModal(); } },
            { id: 'paymentModal', closeFn: () => { if(typeof closePaymentModal === 'function') closePaymentModal(); } },
            { id: 'webServiceModal', closeFn: () => { if(typeof closeWebModalService === 'function') closeWebModalService(); } },
            { id: 'newClientModal', closeFn: () => { if(typeof closeModal === 'function') closeModal(); } },
            { id: 'editClientModal', closeFn: () => { if(typeof closeEditModal === 'function') closeEditModal(); } },
            { id: 'editInfoModal', closeFn: () => { if(typeof closeEditInfoModal === 'function') closeEditInfoModal(); } },
            { id: 'scheduleModal', closeFn: () => { if(typeof closeScheduleModal === 'function') closeScheduleModal(); } },
            { id: 'supportModal', closeFn: () => { if(typeof closeSupportModal === 'function') closeSupportModal(); } },
            { id: 'notificationModal', closeFn: () => { if(typeof closeNotificationModal === 'function') closeNotificationModal(); } },
            { id: 'receiptModal', closeFn: () => { if(typeof closeReceiptModal === 'function') closeReceiptModal(); } },
            { id: 'calendarConfigModal', closeFn: () => { if(typeof closeCalendarConfigModal === 'function') closeCalendarConfigModal(); } },
            { id: 'confirmDeleteModal', closeFn: () => { if(typeof closeConfirmDelete === 'function') closeConfirmDelete(); } },
            { id: 'customNotifModal', closeFn: () => { if(typeof closeCustomNotifModal === 'function') closeCustomNotifModal(); } },
            { id: 'reportErrorModal', closeFn: () => { if(typeof closeReportErrorModal === 'function') closeReportErrorModal(); } }
        ];
        modalsToClose.forEach(m => {
            const el = document.getElementById(m.id);
            if (el && !el.classList.contains('hidden') && !el.classList.contains('opacity-0')) { m.closeFn(); }
        });
    }
});

// --- ANIMACIÓN DE BIENVENIDA / MODAL ---
function showWelcomeAnimation(plan, isDemo = false) {
    const overlay = document.createElement('div');
    overlay.id = 'welcomeAnimationOverlay';
    overlay.className = 'fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm transition-opacity duration-500 opacity-0';
    
    let planName = plan || 'Básico';
    if (!planName.toLowerCase().includes('plan')) planName = 'Plan ' + planName.charAt(0).toUpperCase() + planName.slice(1);
    
    let title = '¡Bienvenido a Agendatina!';
    let desc = `Hemos preparado una <strong>Guía de Inicio Rápido</strong> en tu panel para que dejes tu agenda lista en menos de 2 minutos.`;
    let icon = 'celebration';
    let iconColor = 'text-primary';
    let iconBg = 'bg-primary/10';

    if (isDemo) {
        title = 'Modo Demostración';
        desc = `Estás en una vista previa interactiva de cómo sería el <strong>Plan PREMIUM</strong>.`;
        icon = 'visibility';
        iconColor = 'text-secondary';
        iconBg = 'bg-secondary/10';
    } else {
        if (!document.getElementById('confettiScript')) {
            const script = document.createElement('script');
            script.id = 'confettiScript';
            script.src = 'https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js';
            script.onload = () => {
                confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, zIndex: 9999 });
            };
            document.head.appendChild(script);
        } else if (typeof confetti === 'function') {
            confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, zIndex: 9999 });
        }
    }

    overlay.innerHTML = `
        <div class="bg-white rounded-[2.5rem] p-10 text-center max-w-md w-full transform scale-90 transition-transform duration-500 shadow-2xl m-4">
            <div class="w-24 h-24 ${iconBg} ${iconColor} rounded-full flex items-center justify-center mx-auto mb-6">
                <span class="material-symbols-outlined text-5xl">${icon}</span>
            </div>
            <h2 class="text-3xl font-extrabold text-slate-800 mb-4 font-display">${title}</h2>
            <p class="text-slate-600 text-lg mb-8 leading-relaxed">${desc}</p>
            <button class="bg-primary hover:bg-primary/90 text-white font-bold py-3.5 px-8 rounded-xl w-full shadow-lg shadow-primary/30 transition-all hover:-translate-y-0.5" onclick="window.handleWelcomePrimaryAction(${isDemo ? 'true' : 'false'})">
                ${isDemo ? 'Entendido, explorar panel' : '¡Comenzar ahora!'}
            </button>
        </div>
    `;
    document.body.appendChild(overlay);
    void overlay.offsetWidth; overlay.classList.remove('opacity-0'); overlay.classList.add('opacity-100'); overlay.querySelector('div').classList.remove('scale-90'); overlay.querySelector('div').classList.add('scale-100');
}

function openSupportModal() {
    if (window.currentUserData && window.currentUserData.email === 'demo@agendatina.site') {
        showToast('Función no disponible en la versión demo.', 'error');
        return;
    }
    const modal = document.getElementById('supportModal');
    const content = document.getElementById('supportModalContent');
    if (!modal || !content) return;
    modal.classList.remove('hidden');
    setTimeout(() => { modal.classList.remove('opacity-0'); content.classList.remove('scale-95'); }, 10);
    setTimeout(() => { 
        modal.classList.remove('opacity-0'); 
        content.classList.remove('scale-95', 'animate-modal-pop');
        void content.offsetWidth;
        content.classList.add('animate-modal-pop');
    }, 10);
}

function closeSupportModal() {
    const modal = document.getElementById('supportModal');
    const content = document.getElementById('supportModalContent');
    if (!modal || !content) return;
    modal.classList.add('opacity-0');
    content.classList.remove('animate-modal-pop');
    content.classList.add('scale-95');
    setTimeout(() => { 
        modal.classList.add('hidden'); 
        const form = document.getElementById('supportForm');
        if (form) form.reset();
    }, 300);
}

function loadCustomization() {
    fetch('backend/guardar_web.php')
        .then(res => res.json())
        .then(data => {
            if (data && !data.error) {
                currentWebData = data;
                checkAdminGlobalSession(data);
                if(document.getElementById('profTitulo')) document.getElementById('profTitulo').value = data.titulo || '';
                if(document.getElementById('profColor1')) document.getElementById('profColor1').value = data.color_primario || '#D11149';
                if(document.getElementById('profColor2')) document.getElementById('profColor2').value = data.color_secundario || '#FC8712';
                if(document.getElementById('profileColor')) document.getElementById('profileColor').value = data.color_primario || '#D11149';

                const displayName = data.titulo || (window.currentBusinessData && window.currentBusinessData.nombre_fantasia) || (window.currentUserData && window.currentUserData.nombre_completo) || 'Mi Negocio';
                
                const dashBusinessName = document.getElementById('dashboardBusinessName');
                if (dashBusinessName) dashBusinessName.textContent = displayName;
                
                const navBusinessName = document.getElementById('navBusinessNameText');
                if (navBusinessName && displayName) navBusinessName.textContent = displayName;
                
                const logoImg = document.getElementById('navBusinessLogoImg');
                const iconEl = document.getElementById('navBusinessIcon');
                const logoUrl = data.logo || data.url_logo;
                if (logoUrl && logoImg) {
                    logoImg.src = logoUrl;
                    logoImg.classList.remove('hidden');
                    if (iconEl) iconEl.classList.add('hidden');
                }
                
                if (data.color_primario && document.getElementById('navIcon')) {
                    document.getElementById('navIcon').style.color = data.color_primario;
                }
                const navBrandAccent = document.getElementById('navBrandAccent');
                if (data.color_secundario && navBrandAccent) {
                    navBrandAccent.style.color = data.color_secundario;
                }
                if ((data.color_primario || data.color_secundario) && !data.logo) {
                    const navAvatar = document.getElementById('navAvatar');
                    const c1 = data.color_primario || '#D11149';
                    const c2 = data.color_secundario || '#FC8712';
                    if (navAvatar) navAvatar.style.background = `linear-gradient(135deg, ${c1} 0%, ${c2} 100%)`;
                }
                if (data.logo && data.logo !== 'null' && data.logo !== 'undefined') {
                    const favicon = document.querySelector('link[rel="icon"]');
                    if (favicon) favicon.href = data.logo;

                    const navIcon = document.getElementById('navIcon');
                    const navLogoImg = document.getElementById('navLogoImg');
                    if (navIcon) navIcon.classList.add('hidden');
                    if (navLogoImg) { navLogoImg.src = data.logo; navLogoImg.classList.remove('hidden'); }
                    
                    const navAvatar = document.getElementById('navAvatar');
                    if (navAvatar) {
                        navAvatar.innerHTML = `<img src="${data.logo}" class="w-full h-full object-cover" alt="Logo">`;
                        navAvatar.style.background = 'transparent';
                    }
                } else {
                    const navAvatar = document.getElementById('navAvatar');
                    if (navAvatar) {
                        const words = displayName.trim().split(/\s+/);
                        const initials = words.length > 1 ? (words[0][0] + words[1][0]) : displayName.substring(0, 2);
                        navAvatar.innerHTML = initials.toUpperCase();
                    }
                }
                
                if (data.color_primario || data.color_secundario || data.colores_extra_json) {
                    window.applyUserCustomColors(data.color_primario, data.color_secundario, data.colores_extra_json);
                }
                if (data.usar_fondo_degrade == 1 || data.usar_fondo_degrade === '1' || data.usar_fondo_degrade === true) {
                    document.body.setAttribute('data-degrade', '1');
                    document.body.classList.add('calendar-degrade-active');
                } else {
                    document.body.removeAttribute('data-degrade');
                    document.body.classList.remove('calendar-degrade-active');
                }
                if (data.logo && data.logo !== 'null' && data.logo !== 'undefined') {
                    // Corregir la ruta del logo si solo viene el nombre de archivo
                    const logoUrl = data.logo.includes('/') ? data.logo : `backend/uploads/logos/${data.logo}`;
                    
                    const profilePreview = document.getElementById('profileLogoPreview');
                    if (profilePreview) { profilePreview.src = logoUrl; profilePreview.classList.remove('hidden'); }
                    const webPreview = document.getElementById('webLogoPreview');
                    if (webPreview) { webPreview.src = logoUrl; webPreview.classList.remove('hidden'); }
                }

                if (data.wpp_stats && typeof window.renderWppQuotaWidget === 'function') {
                    window.renderWppQuotaWidget(data.wpp_stats);
                }
            }
        })
        .catch(err => console.error('Error al cargar personalización:', err));
}

window.renderWppQuotaWidget = function(stats) {
    const widget = document.getElementById('wppQuotaWidget');
    if (!widget || !stats) return;

    widget.classList.remove('hidden');

    const badge = document.getElementById('wppPlanBadge');
    const ratio = document.getElementById('wppQuotaRatio');
    const progress = document.getElementById('wppProgressBar');
    const breakdown = document.getElementById('wppBreakdownContent');
    const overage = document.getElementById('wppOverageBadge');
    const counterBox = document.getElementById('wppCounterBox');

    if (badge) badge.textContent = `Plan ${stats.plan || 'Básico'}`;

    if (!stats.habilitado) {
        // Plan Básico (Sin notificaciones por WhatsApp)
        if (ratio) ratio.textContent = '0 enviadas (Deshabilitado)';
        if (progress) {
            progress.style.width = '0%';
            progress.className = 'h-full bg-slate-300 rounded-full';
        }
        if (breakdown) breakdown.innerHTML = '<strong class="text-amber-800">Plan Básico: Notificaciones por WhatsApp deshabilitadas (Solo Email).</strong> Mejora a Plan Profesional o Premium para activarlas.';
        if (overage) overage.classList.add('hidden');
        if (counterBox) counterBox.className = 'w-full sm:w-auto min-w-[240px] bg-amber-50/70 border border-amber-200/70 p-3.5 rounded-2xl';
        return;
    }

    // Plan Profesional o Premium
    const usados = stats.usados || 0;
    const limite = stats.limite_total || 50;
    const pct = Math.min(100, Math.round((usados / limite) * 100));

    if (ratio) ratio.textContent = `${usados} / ${limite} enviadas`;
    if (progress) {
        progress.style.width = `${pct}%`;
        if (usados > limite) {
            progress.className = 'h-full bg-purple-600 rounded-full animate-pulse';
        } else if (pct >= 85) {
            progress.className = 'h-full bg-amber-500 rounded-full';
        } else {
            progress.className = 'h-full bg-emerald-500 rounded-full';
        }
    }

    const extraProfs = stats.extra_profesionales || 0;
    if (breakdown) {
        const bonusTxt = extraProfs > 0 ? ` + ${stats.bonus} por ${extraProfs} profesional(es) extra` : '';
        breakdown.textContent = `${stats.base} base${bonusTxt} = ${limite} WhatsApps/mes bolsa total del negocio`;
    }

    if (overage) {
        if (stats.excedentes > 0) {
            overage.textContent = `⚠️ Excedente: ${stats.excedentes} WPP extra ($${stats.costo_extra_ars.toLocaleString('es-AR')} ARS a abonar a fin de mes)`;
            overage.classList.remove('hidden');
        } else {
            overage.classList.add('hidden');
        }
    }
};

function openPaymentModal() {
    const modal = document.getElementById('paymentModal');
    const content = document.getElementById('paymentModalContent');
    if (!modal || !content) return;
    modal.classList.remove('hidden');
    setTimeout(() => { modal.classList.remove('opacity-0'); content.classList.remove('scale-95'); }, 10);
    setTimeout(() => { 
        modal.classList.remove('opacity-0'); 
        content.classList.remove('scale-95', 'animate-modal-pop');
        void content.offsetWidth;
        content.classList.add('animate-modal-pop');
    }, 10);
}

function closePaymentModal() {
    const modal = document.getElementById('paymentModal');
    const content = document.getElementById('paymentModalContent');
    if (!modal || !content) return;
    modal.classList.add('opacity-0');
    content.classList.remove('animate-modal-pop');
    content.classList.add('scale-95');
    setTimeout(() => { 
        modal.classList.add('hidden'); 
        const form = document.getElementById('receiptForm');
        if (form) form.reset();
        document.getElementById('paymentFormContainer').classList.remove('hidden');
        document.getElementById('paymentSuccessMessage').classList.add('hidden');
        document.getElementById('paymentSuccessMessage').classList.remove('flex');
    }, 300);
}

window.openProfileModal = function() {
    const modal = document.getElementById('profileModal');
    const content = document.getElementById('profileModalContent');
    if (!modal || !content) return;
    
    // Configurar estadísticas del perfil
    const statConf = document.getElementById('statConf');
    const statPend = document.getElementById('statPend');
    const statTotal = document.getElementById('statTotal');
    const totalConf = window.currentStats ? window.currentStats.reduce((a,b)=>a+(parseInt(b.confirmados)||0), 0) : 0;
    const totalPend = window.currentStats ? window.currentStats.reduce((a,b)=>a+(parseInt(b.pendientes)||0), 0) : 0;
    
    if (statConf) statConf.textContent = totalConf;
    if (statPend) statPend.textContent = totalPend;
    if (statTotal) statTotal.textContent = totalConf + totalPend;
    
    // Configurar botón de comprobante en perfil
    const receiptContainer = document.getElementById('profileReceiptContainer');
    const btnReceipt = document.getElementById('btnProfileViewReceipt');
    if (receiptContainer && window.currentBusinessData) {
        if (window.currentBusinessData.comprobante) {
            receiptContainer.classList.remove('hidden');
            if (btnReceipt) {
                btnReceipt.onclick = () => window.verComprobanteModal(window.currentBusinessData.comprobante);
            }
        } else {
            receiptContainer.classList.add('hidden');
        }
    }

    modal.classList.remove('hidden');
    if(window.currentUserData) {
        document.getElementById('profileName').value = window.currentUserData.nombre_completo || '';
        
        const secSection = document.getElementById('securitySection');
        if (secSection) {
            if (window.currentUserData.email === 'demo@agendatina.site' || (window.currentUserData.nombre_completo && window.currentUserData.nombre_completo.includes('DEMO'))) {
                secSection.classList.add('hidden');
            } else {
                secSection.classList.remove('hidden');
            }
        }
    }
        
        // Cargar estadísticas para el modal
        fetch('backend/obtener_agenda.php')
        .then(res => res.json())
        .then(data => {
            if (Array.isArray(data)) {
                let total = data.length;
                let confirmados = data.filter(t => t.estado === 'confirmado').length;
                let pendientes = data.filter(t => t.estado === 'pendiente').length;
                
                const statTotal = document.getElementById('statTotal');
                const statConf = document.getElementById('statConf');
                const statPend = document.getElementById('statPend');
                
                if(statTotal) statTotal.textContent = total + " turnos";
                if(statConf) statConf.textContent = confirmados + " turnos";
                if(statPend) statPend.textContent = pendientes + " turnos";
            }
            
        }).catch(err => console.error('Error stats:', err));

    modal.classList.remove('hidden');
    setTimeout(() => { modal.classList.remove('opacity-0'); content.classList.remove('scale-95'); }, 10);
    setTimeout(() => { 
        modal.classList.remove('opacity-0'); 
        content.classList.remove('scale-95', 'animate-modal-pop');
        void content.offsetWidth;
        content.classList.add('animate-modal-pop');
    }, 10);
}

function closeProfileModal() {
    const modal = document.getElementById('profileModal');
    const content = document.getElementById('profileModalContent');
    if (!modal || !content) return;
    modal.classList.add('opacity-0');
    content.classList.remove('animate-modal-pop');
    content.classList.add('scale-95');
    setTimeout(() => { 
        modal.classList.add('hidden'); 
        const form = document.getElementById('profileForm');
        if (form) form.reset(); 
        document.getElementById('profileMessage').classList.add('hidden');
    }, 300);
}

function applyCalendarConfigToForm(c) {
    if (!c) return;
    const busTitle = c.nombre_fantasia || c.nombre_negocio || c.titulo || (window.currentBusinessData && window.currentBusinessData.nombre_fantasia) || 'Agendatina';
    if (busTitle) {
        const navEl = document.getElementById('navBusinessNameText') || document.getElementById('navBusinessName');
        if (navEl) navEl.textContent = busTitle;
    }
    const logoImg = document.getElementById('navBusinessLogoImg');
    const iconEl = document.getElementById('navBusinessIcon');
    const logoUrl = c.url_logo || c.logo;
    if (logoUrl && logoImg) {
        logoImg.src = logoUrl;
        logoImg.classList.remove('hidden');
        if (iconEl) iconEl.classList.add('hidden');
    }
    const ha = c.hora_apertura ? c.hora_apertura.substring(0, 5) : '09:00';
    const hc = c.hora_cierre ? c.hora_cierre.substring(0, 5) : '18:00';
    if(document.getElementById('configHoraApertura')) document.getElementById('configHoraApertura').value = ha;
    if(document.getElementById('configHoraCierre')) document.getElementById('configHoraCierre').value = hc;
    if(document.getElementById('configHoraDescansoInicio')) document.getElementById('configHoraDescansoInicio').value = c.hora_descanso_inicio ? c.hora_descanso_inicio.substring(0, 5) : '';
    if(document.getElementById('configHoraDescansoFin')) document.getElementById('configHoraDescansoFin').value = c.hora_descanso_fin ? c.hora_descanso_fin.substring(0, 5) : '';
    
    if (c.dias_trabajo !== undefined) {
        const diasArr = c.dias_trabajo.split(',');
        document.querySelectorAll('input[name="dias_trabajo"]').forEach(cb => {
            cb.checked = diasArr.includes(cb.value);
        });
    } else {
        const defaultDays = ['1','2','3','4','5','6'];
        document.querySelectorAll('input[name="dias_trabajo"]').forEach(cb => {
            cb.checked = defaultDays.includes(cb.value);
        });
    }
    if(document.getElementById('configSimultaneos')) document.getElementById('configSimultaneos').value = c.turnos_simultaneos || 'no';
    if(document.getElementById('configConfirmacionAutomatica')) document.getElementById('configConfirmacionAutomatica').value = c.confirmacion_automatica || 'no';
    if(document.getElementById('configMetodosPago')) document.getElementById('configMetodosPago').value = c.metodos_pago || '';
    if(document.getElementById('configLimiteEliminacion')) document.getElementById('configLimiteEliminacion').value = c.limite_eliminacion_dias !== undefined ? c.limite_eliminacion_dias : 0;
    
    const tipoCalVal = c.tipo_calendario || 'clasico';
    const calRadio = document.querySelector(`input[name="tipo_calendario"][value="${tipoCalVal}"]`);
    if (calRadio) calRadio.checked = true;

    const degradeCb = document.getElementById('configFondoDegrade');
    if (degradeCb) {
        degradeCb.checked = (c.usar_fondo_degrade == 1 || c.usar_fondo_degrade === '1' || c.usar_fondo_degrade === true);
    }
    
    const ant = parseInt(c.anticipacion_turno_min || 0, 10);
    if(document.getElementById('configAnticipacionMin')) document.getElementById('configAnticipacionMin').value = ant;
    if(document.getElementById('configAnticipacionH')) document.getElementById('configAnticipacionH').value = Math.floor(ant / 60);
    if(document.getElementById('configAnticipacionM')) document.getElementById('configAnticipacionM').value = ant % 60;

    const selectInterval = document.getElementById('configIntervalo');
    if(selectInterval) {
        // Garantizar que la opción 'servicio' exista
        if (!selectInterval.querySelector('option[value="servicio"]')) {
            const customOption = selectInterval.querySelector('option[value="custom"]');
            const serviceOption = new Option('Determinado por la duración del servicio', 'servicio');
            if (customOption) {
                selectInterval.insertBefore(serviceOption, customOption);
            } else {
                selectInterval.appendChild(serviceOption);
            }
        }

        const validOpts = ['15','30','45','60','90','120'];
        if(validOpts.includes(c.intervalo_turnos?.toString())) {
            selectInterval.value = c.intervalo_turnos;
            if (document.getElementById('divIntervaloCustom')) document.getElementById('divIntervaloCustom').classList.add('hidden');
        } else if (c.intervalo_turnos === 'servicio') {
            selectInterval.value = 'servicio';
            if (document.getElementById('divIntervaloCustom')) document.getElementById('divIntervaloCustom').classList.add('hidden');
        } else {
            selectInterval.value = 'custom';
            if (document.getElementById('divIntervaloCustom')) document.getElementById('divIntervaloCustom').classList.remove('hidden');
            if (document.getElementById('inputIntervaloCustom')) document.getElementById('inputIntervaloCustom').value = c.intervalo_turnos || 30;
        }

        if (typeof window.updateIntervalHelpText === 'function') {
            window.updateIntervalHelpText();
        }
    }
    const radioCal = document.querySelector(`input[name="tipo_calendario"][value="${c.tipo_calendario || 'clasico'}"]`);
    if (radioCal) {
        radioCal.checked = true;
    }
}

window.handleWelcomePrimaryAction = function(isDemo) {
    const welcomeOverlay = document.getElementById('welcomeAnimationOverlay');
    if (welcomeOverlay) {
        welcomeOverlay.classList.remove('opacity-100');
        welcomeOverlay.classList.add('opacity-0');
        setTimeout(() => welcomeOverlay.remove(), 300);
    } else {
        const overlays = document.querySelectorAll('.fixed.inset-0.z-\\[100\\]:not(#firstSetupModal):not(#bookingSuccessModal)');
        overlays.forEach(overlay => {
            overlay.classList.remove('opacity-100');
            overlay.classList.add('opacity-0');
            setTimeout(() => overlay.remove(), 300);
        });
    }
    // Iniciar el Tour Virtual automáticamente al cerrar la bienvenida
    setTimeout(() => {
        if (typeof window.startTour === 'function') window.startTour();
    }, 350);
}

window.closeCalendarConfigModal = function() {
    const modal = document.getElementById('calendarConfigModal');
    const content = document.getElementById('calendarConfigModalContent');
    if (!modal || !content) return;
    modal.classList.add('opacity-0');
    content.classList.remove('animate-modal-pop');
    content.classList.add('scale-95');
    setTimeout(() => { modal.classList.add('hidden'); }, 300);
}

window.toggleProfPasswordVisibility = function(inputId, btn) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const icon = btn ? btn.querySelector('.material-symbols-outlined') : null;
    if (input.type === 'password') {
        input.type = 'text';
        if (icon) icon.textContent = 'visibility_off';
    } else {
        input.type = 'password';
        if (icon) icon.textContent = 'visibility';
    }
};

window.openObligatoryPasswordModal = function() {
    let modal = document.getElementById('modalCambiarPasswordObligatorio');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modalCambiarPasswordObligatorio';
        modal.className = 'fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[300] hidden flex items-center justify-center p-4';
        modal.innerHTML = `
            <div class="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative text-center border border-purple-100 animate-in fade-in zoom-in duration-300">
                <div class="w-16 h-16 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center mx-auto mb-4 border border-purple-200 shadow-xs">
                    <span class="material-symbols-outlined text-3xl">lock_reset</span>
                </div>
                <h3 class="text-xl sm:text-2xl font-extrabold text-slate-800 mb-2 font-display">Actualiza tu Contraseña</h3>
                <p class="text-xs sm:text-sm text-slate-500 mb-6 leading-relaxed">
                    Has ingresado a tu cuenta de profesional por primera vez. Por tu seguridad, establece tu contraseña personal para reemplazar la inicial.
                </p>

                <form id="formCambiarPasswordObligatorio" onsubmit="window.handleCambiarPasswordObligatorio(event)" class="space-y-4 text-left">
                    <div>
                        <label class="block text-xs font-bold text-slate-700 mb-1">Nueva Contraseña</label>
                        <div class="relative">
                            <input type="password" id="inputNuevaPasswordProf" required minlength="6" placeholder="Mínimo 6 caracteres" class="w-full bg-slate-50 border border-slate-200 rounded-xl pl-4 pr-11 py-3 text-sm focus:ring-2 focus:ring-purple-500 outline-none">
                            <button type="button" onclick="toggleProfPasswordVisibility('inputNuevaPasswordProf', this)" class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1" title="Ver contraseña">
                                <span class="material-symbols-outlined text-[20px]">visibility</span>
                            </button>
                        </div>
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-slate-700 mb-1">Confirmar Nueva Contraseña</label>
                        <div class="relative">
                            <input type="password" id="inputConfirmarPasswordProf" required minlength="6" placeholder="Repite tu contraseña" class="w-full bg-slate-50 border border-slate-200 rounded-xl pl-4 pr-11 py-3 text-sm focus:ring-2 focus:ring-purple-500 outline-none">
                            <button type="button" onclick="toggleProfPasswordVisibility('inputConfirmarPasswordProf', this)" class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1" title="Ver contraseña">
                                <span class="material-symbols-outlined text-[20px]">visibility</span>
                            </button>
                        </div>
                    </div>

                    <div id="msgCambiarPasswordProf" class="hidden text-xs font-bold p-3 rounded-xl text-center"></div>

                    <button type="submit" id="btnSubmitCambiarPasswordProf" class="w-full bg-purple-600 hover:bg-purple-700 text-white font-extrabold py-3.5 rounded-xl shadow-lg shadow-purple-600/20 text-sm transition-all flex items-center justify-center gap-2 mt-2">
                        <span class="material-symbols-outlined text-[18px]">verified_user</span> Guardar Nueva Contraseña
                    </button>
                </form>
            </div>
        `;
        document.body.appendChild(modal);
    }
    modal.classList.remove('hidden');
};

window.handleCambiarPasswordObligatorio = function(e) {
    e.preventDefault();
    const pass1 = document.getElementById('inputNuevaPasswordProf')?.value || '';
    const pass2 = document.getElementById('inputConfirmarPasswordProf')?.value || '';
    const msgEl = document.getElementById('msgCambiarPasswordProf');
    const btn = document.getElementById('btnSubmitCambiarPasswordProf');

    if (pass1 !== pass2) {
        if (msgEl) {
            msgEl.textContent = 'Las contraseñas no coinciden. Por favor verifica los datos.';
            msgEl.className = 'text-xs font-bold p-3 rounded-xl text-center bg-red-100 text-red-700 border border-red-200 block';
        }
        return;
    }

    if (pass1.length < 6) {
        if (msgEl) {
            msgEl.textContent = 'La contraseña debe tener al menos 6 caracteres.';
            msgEl.className = 'text-xs font-bold p-3 rounded-xl text-center bg-red-100 text-red-700 border border-red-200 block';
        }
        return;
    }

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="material-symbols-outlined animate-spin text-[18px]">refresh</span> Guardando...';
    }

    fetch('backend/cambiar_password_profesional.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nueva_password: pass1 })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            if (msgEl) {
                msgEl.textContent = '¡Contraseña actualizada con éxito!';
                msgEl.className = 'text-xs font-bold p-3 rounded-xl text-center bg-emerald-100 text-emerald-800 border border-emerald-200 block';
            }
            if (typeof showToast === 'function') showToast('Contraseña actualizada correctamente.', 'success');
            setTimeout(() => {
                const modal = document.getElementById('modalCambiarPasswordObligatorio');
                if (modal) modal.classList.add('hidden');
            }, 1200);
        } else {
            if (msgEl) {
                msgEl.textContent = data.error || 'Error al actualizar la contraseña.';
                msgEl.className = 'text-xs font-bold p-3 rounded-xl text-center bg-red-100 text-red-700 border border-red-200 block';
            }
        }
    })
    .catch(err => {
        if (msgEl) {
            msgEl.textContent = 'Error de conexión. Inténtalo nuevamente.';
            msgEl.className = 'text-xs font-bold p-3 rounded-xl text-center bg-red-100 text-red-700 border border-red-200 block';
        }
    })
    .finally(() => {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<span class="material-symbols-outlined text-[18px]">verified_user</span> Guardar Nueva Contraseña';
        }
    });
};

window.closeContactSuccessModal = function() {
    const modal = document.getElementById('contactSuccessModal');
    const content = document.getElementById('contactSuccessModalContent');
    if (modal && content) {
        modal.classList.add('opacity-0');
        content.classList.remove('animate-modal-pop');
        content.classList.add('scale-95');
        setTimeout(() => { modal.classList.add('hidden'); }, 300);
    }
}

window.closeBookingSuccessModal = function() {
    const modal = document.getElementById('bookingSuccessModal');
    const content = document.getElementById('bookingSuccessModalContent');
    if (modal && content) {
        modal.classList.add('opacity-0');
        content.classList.remove('animate-modal-pop');
        content.classList.add('scale-95');
        setTimeout(() => { modal.classList.add('hidden'); window.location.reload(); }, 300);
    }
}

// ==========================================
// LÓGICA PARA REPORTE DE ERRORES AL SUPERADMIN
// ==========================================
window.openReportErrorModal = function(segment) {
    if (window.currentUserData && window.currentUserData.email === 'demo@agendatina.site') {
        showToast('Función no disponible en la versión demo.', 'error');
        return;
    }
    const modal = document.getElementById('reportErrorModal');
    const content = document.getElementById('reportErrorModalContent');
    if (!modal) {
        showToast('El modal de reportes no está en el HTML', 'error');
        return;
    }
    document.getElementById('reportSegment').value = segment;
    document.getElementById('reportSegmentDisplay').value = segment;
    modal.classList.remove('hidden');
    setTimeout(() => { modal.classList.remove('opacity-0'); content.classList.remove('scale-95'); }, 10);
    setTimeout(() => { 
        modal.classList.remove('opacity-0'); 
        content.classList.remove('scale-95', 'animate-modal-pop');
        void content.offsetWidth;
        content.classList.add('animate-modal-pop');
    }, 10);
};

window.closeReportErrorModal = function() {
    const modal = document.getElementById('reportErrorModal');
    const content = document.getElementById('reportErrorModalContent');
    if (!modal) return;
    modal.classList.add('opacity-0');
    content.classList.remove('animate-modal-pop');
    content.classList.add('scale-95');
    setTimeout(() => { modal.classList.add('hidden'); document.getElementById('reportErrorForm').reset(); }, 300);
};

window.renderAdminReports = function(notificaciones) {
    const listContainer = document.getElementById('adminReportsList');
    if (!listContainer) return;

    listContainer.innerHTML = '';
    if (!notificaciones || notificaciones.length === 0) {
        listContainer.innerHTML = `<div class="p-6 text-center text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-300"><span class="material-symbols-outlined text-4xl mb-2 text-slate-300">check_circle</span><p class="font-medium text-sm">Todo funciona perfecto. No hay reportes recientes.</p></div>`;
        return;
    }

    notificaciones.forEach(notif => {
        const dateObj = new Date(notif.fecha.replace(/-/g, '/'));
        const fechaFormat = dateObj.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
        const horaFormat = dateObj.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

        listContainer.innerHTML += `
            <div class="bg-slate-50 border-l-4 border-red-500 p-4 sm:p-5 rounded-xl shadow-sm hover:shadow-md transition-shadow relative group mb-4 w-full">
                <div class="flex flex-col sm:flex-row sm:justify-between items-start gap-3 mb-3">
                    <span class="text-[10px] font-bold text-red-700 bg-red-100 px-2.5 py-1 rounded-md uppercase tracking-wider">📍 Segmento: ${notif.segmento}</span>
                    <div class="flex items-center gap-2 self-end sm:self-auto mt-2 sm:mt-0">
                        <span class="text-xs font-semibold text-slate-500 bg-white px-2 py-1 rounded-md border border-slate-200">${fechaFormat} - ${horaFormat}</span>
                        <button onclick="deleteAdminReport(${notif.id})" class="text-slate-400 hover:text-red-500 bg-white p-1 rounded-md border border-slate-200 transition-colors" title="Eliminar reporte (Ya solucionado)"><span class="material-symbols-outlined text-[16px] block">delete</span></button>
                    </div>
                </div>
                <div class="mb-3 flex items-center flex-wrap gap-2"><span class="material-symbols-outlined text-[16px] text-slate-400 shrink-0">storefront</span><span class="text-sm font-bold text-slate-700 break-all">ID del Negocio: <span class="text-primary">${notif.id_negocio || 'Usuario Desconocido'}</span></span></div>
                <div class="bg-white p-3 sm:p-4 rounded-lg border border-slate-200 text-sm text-slate-600 relative overflow-hidden"><span class="material-symbols-outlined absolute text-slate-100 text-4xl -top-2 -left-2 rotate-180 z-0">format_quote</span><p class="relative z-10 italic break-words">${notif.mensaje}</p></div>
            </div>`;
    });
};

window.deleteAdminReport = function(id) {
    if (confirm('¿Marcar como solucionado y eliminar este reporte?')) {
        fetch('backend/admin_api.php?id_reporte=' + id, { method: 'DELETE' })
        .then(res => res.json())
        .then(data => { if (data.success) { showToast('Reporte eliminado', 'success'); if (typeof loadAdminData === 'function') loadAdminData(); else window.location.reload(); } else alert(data.error || 'Error al eliminar el reporte.'); })
        .catch(() => alert('Error de conexión al eliminar.'));
    }
};

// ==========================================
// LÓGICA PARA AGENDA.HTML
// ==========================================

window.contactarWhatsApp = function(id) {
    let t = null;
    if (window.agendaData) t = window.agendaData.find(x => x.id == id);
    if (!t && typeof allAppointments !== 'undefined') t = allAppointments.find(x => x.id == id);
    
    if (!t) {
        showToast('No se encontró la información del turno', 'error');
        return;
    }
    let telefono = t.cliente_celular || t.celular || '';
    if (!telefono) {
        showToast('No hay número de teléfono registrado', 'error');
        return;
    }
    
    let nombre = t.cliente_nombre || (t.nombre + ' ' + (t.apellido || '')) || 'Cliente';
    let phone = telefono.replace(/\D/g, '');
    let negocio = window.currentBusinessData ? window.currentBusinessData.nombre_fantasia : 'nuestro local';
    let fParts = t.fecha.split('-');
    let fDisplay = fParts.length === 3 ? `${fParts[2]}/${fParts[1]}/${fParts[0]}` : t.fecha;
    
    let text = `Hola ${nombre}, te escribo desde ${negocio}. `;
    if (t.estado === 'pendiente') text = `Hola ${nombre}, te escribo desde ${negocio} por tu solicitud de turno para el ${fDisplay} a las ${t.hora} hs (${t.servicio}). `;
    else if (t.estado === 'confirmado') text = `Hola ${nombre}, te escribo desde ${negocio} por tu turno del ${fDisplay} a las ${t.hora} hs (${t.servicio}). `;
    
    let url = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
};

window.recordatorioWhatsApp = function(id) {
    let t = null;
    if (window.agendaData) t = window.agendaData.find(x => x.id == id);
    if (!t && typeof allAppointments !== 'undefined') t = allAppointments.find(x => x.id == id);
    
    if (!t) {
        showToast('No se encontró la información del turno', 'error');
        return;
    }
    let telefono = t.cliente_celular || t.celular || '';
    if (!telefono) {
        showToast('No hay número de teléfono registrado', 'error');
        return;
    }
    
    let nombre = t.cliente_nombre || (t.nombre + ' ' + (t.apellido || '')) || 'Cliente';
    let phone = telefono.replace(/\D/g, '');
    let text = `Hola ${nombre}, te recordamos tu turno hoy a las ${t.hora} hs. ¡Te esperamos!`;
    let url = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
};

window.enableImagePreview = function(input) {
    if (!input) return;
    input.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(event) {
            let preview = null;
            if (input.id) preview = document.getElementById(input.id + 'Preview');
            if (!preview && input.parentElement) preview = input.parentElement.querySelector('img');
            if (preview) {
                preview.src = event.target.result;
                preview.classList.remove('hidden');
                input._previewEl = preview;
            }
        };
        reader.readAsDataURL(file);
    });
};

// ==========================================
// LÓGICA DEL CARRUSEL Y PLANES (LANDING)
// ==========================================

var carouselData = [
    { 
        title: 'Plan Simple', 
        desc: 'Calendario de turnos online para que tus clientes soliciten reservas de forma rápida y organizada 24/7.', 
        oldPrice: '$8.889',
        price: '$8.000', 
        tag: 'Ideal para comenzar',
        mockupDesktop: 'public/mockup_calendar_computer.png',
        mockupMobile: 'public/mockup_calendar_phone.png',
        features: [
            'Calendario de reservas online 24/7',
            'Notificaciones automáticas por email',
            'Personalización de 2 colores base de marca',
            'Bloqueo manual de días feriados y vacaciones'
        ]
    },
    { 
        title: 'Plan Profesional', 
        desc: 'Sistema de turnos con Agenda Virtual interactiva y notificaciones por WhatsApp para gestionar tu negocio.', 
        oldPrice: '$11.111',
        price: '$10.000', 
        tag: 'Más Elegido',
        mockupDesktop: 'public/mockup_miagenda_computer.png',
        mockupMobile: 'public/mockup_miagenda_phone.png',
        features: [
            'Todo lo incluido en el Plan Simple',
            'Agenda Virtual interactiva con listado de reservas',
            '50 notificaciones por WhatsApp/mes (bolsa base)',
            '1 opción adicional de color personalizado (+1)'
        ]
    },
    { 
        title: 'Plan Premium', 
        desc: 'Plataforma completa con mini página web de reservas y módulo exclusivo de estadísticas de facturación.', 
        oldPrice: '$16.667',
        price: '$15.000', 
        tag: 'Presencia Online',
        mockupDesktop: 'public/mockup_miagenda_computer.png',
        mockupMobile: 'public/mockup_miagenda_phone.png',
        features: [
            'Todo lo incluido en el Plan Profesional',
            'Página web pública de reservas (mi-web)',
            '100 notificaciones por WhatsApp/mes (bolsa base)',
            'Módulo de Estadísticas y Métricas de Facturación'
        ]
    }
];

var currentCarouselIndex = window.currentCarouselIndex || 1;

window.setCarouselIndex = function(index) {
    const titleEl = document.getElementById('carouselTitle');
    if (!titleEl) return; // Salir si no estamos en la landing

    currentCarouselIndex = index;
    document.getElementById('carouselTitle').textContent = carouselData[index].title;
    
    const descEl = document.getElementById('carouselDesc');
    if (descEl) descEl.textContent = carouselData[index].desc;

    const featuresEl = document.getElementById('carouselFeatures');
    if (featuresEl && carouselData[index].features) {
        featuresEl.innerHTML = carouselData[index].features.map(f => `
            <li class="flex items-center gap-4">
                <span class="material-symbols-outlined text-primary">check_circle</span>
                <span>${f}</span>
            </li>
        `).join('');
    }
    
    // Renderizar Nuevo y Viejo Precio con el 10% OFF
    // Actualizar precios dinámicamente respetando la estructura HTML de index.html
    const oldPriceEl = document.getElementById('carouselOldPrice');
    const priceEl = document.getElementById('carouselPrice');
    
    if (oldPriceEl) oldPriceEl.textContent = carouselData[index].oldPrice;
    if (priceEl) priceEl.textContent = carouselData[index].price;
        
    document.getElementById('carouselTagText').textContent = carouselData[index].tag;
    
    // Actualizar imágenes de los mockups (si existen en el HTML)
    const mockupPc = document.getElementById('mockupDesktopImg');
    const mockupCel = document.getElementById('mockupMobileImg');
    if(mockupPc) mockupPc.src = carouselData[index].mockupDesktop;
    if(mockupCel) mockupCel.src = carouselData[index].mockupMobile;
    
    const carouselOldPriceContainer = document.getElementById('carouselOldPriceContainer');
    if (carouselOldPriceContainer) {
        if (carouselData[index].showOldPrice) {
            carouselOldPriceContainer.style.display = 'flex';
            const badge = carouselOldPriceContainer.querySelector('.bg-emerald-100');
            if (badge) badge.textContent = carouselData[index].badgeText;
        } else {
            carouselOldPriceContainer.style.display = 'none';
        }
        
        const perPersonEl = document.getElementById('carouselPerPerson');
        if (perPersonEl) {
            const planKeys = ['basic', 'inter', 'prem'];
            let currentCount = window.numProfessionals[planKeys[index]];
            if (currentCount && currentCount > 1) {
                let numericPrice = parseInt(carouselData[index].price.replace(/[^0-9]/g, ''));
                let perPerson = numericPrice / currentCount;
                perPersonEl.textContent = `¡Queda en $${perPerson.toLocaleString('es-AR', {maximumFractionDigits:0})} por persona!`;
                perPersonEl.classList.remove('hidden');
            } else {
                perPersonEl.classList.add('hidden');
            }
        }
    }
    
    const actionBtn = document.getElementById('carouselActionBtn');
    if (actionBtn) {
        const planKeys = ['basic', 'inter', 'prem'];
        actionBtn.onclick = () => selectPlan(carouselData[index].title, planKeys[index]);
    }

    const dotsContainer = document.getElementById('carouselDots');
    if (dotsContainer) {
        const dots = dotsContainer.children;
        for (let i = 0; i < dots.length; i++) {
            dots[i].className = i === index ? 'w-8 h-2.5 rounded-full bg-primary transition-all' : 'w-2.5 h-2.5 rounded-full bg-slate-300 transition-all';
        }
    }
};

window.selectPlan = function(planName, planKey = 'inter') {
    let count = (window.numProfessionals && window.numProfessionals[planKey]) ? window.numProfessionals[planKey] : 1;
    window.location.href = `registro.html?plan=${encodeURIComponent(planName)}&profs=${count}`;
};

window.resetForm = function() {
    const planBox = document.getElementById('planSelectionBox');
    const inputPlan = document.getElementById('inputPlan');
    if (planBox) planBox.classList.add('hidden');
    if (inputPlan) inputPlan.value = '';
};
// ==========================================
// INICIALIZACIÓN GENERAL AL CARGAR EL DOM
// ==========================================
document.addEventListener('DOMContentLoaded', () => {

    // --- Formularios de Reporte de Error y Soporte ---
    const reportForm = document.getElementById('reportErrorForm');
    if (reportForm) {
        reportForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const btn = document.getElementById('btnReportSubmit');
            const orig = btn.innerHTML;
            btn.disabled = true; btn.innerHTML = 'Enviando...';
            
            const formData = new FormData(this);
            formData.append('action', 'report_error');
            
            fetch('backend/enviar_soporte.php', { method: 'POST', body: formData })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    if (typeof showToast === 'function') showToast('Reporte enviado con éxito.', 'success');
                    if (typeof closeReportErrorModal === 'function') closeReportErrorModal();
                    this.reset();
                } else {
                    if (typeof showToast === 'function') showToast(data.error || 'Error al enviar reporte.', 'error');
                }
            }).catch(() => {
                if (typeof showToast === 'function') showToast('Error de conexión.', 'error');
            }).finally(() => { btn.disabled = false; btn.innerHTML = orig; });
        });
    }

    const supportForm = document.getElementById('supportForm');
    if (supportForm) {
        supportForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const btn = document.getElementById('btnSupportSubmit');
            const orig = btn.innerHTML;
            btn.disabled = true; btn.innerHTML = 'Enviando...';
            
            const formData = new FormData(this);
            formData.append('action', 'support_message');
            formData.append('segmento', 'Soporte y Sugerencias');
            
            fetch('backend/enviar_soporte.php', { method: 'POST', body: formData })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    if (typeof showToast === 'function') showToast('Mensaje enviado con éxito.', 'success');
                    if (typeof closeSupportModal === 'function') closeSupportModal();
                    this.reset();
                } else {
                    if (typeof showToast === 'function') showToast(data.error || 'Error al enviar mensaje.', 'error');
                }
            }).catch(() => {
                if (typeof showToast === 'function') showToast('Error de conexión.', 'error');
            }).finally(() => { btn.disabled = false; btn.innerHTML = orig; });
        });
    }

    // --- Formulario de Contacto en Landing (Validaciones Visuales y AJAX) ---
    const mainContactForm = document.getElementById('mainContactForm');
    if (mainContactForm) {
        mainContactForm.addEventListener('submit', function(e) {
            e.preventDefault(); // Interceptamos siempre para validar antes de enviar
            
            let isValid = true;
            const requiredFields = this.querySelectorAll('[required]');
            
            requiredFields.forEach(field => {
                const isEmpty = !field.value.trim();
                const isInvalidEmail = field.type === 'email' && field.value.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(field.value);
                
                if (isEmpty || isInvalidEmail) {
                    isValid = false;
                    field.classList.remove('border-slate-200');
                    field.classList.add('border-red-500', 'bg-red-50', 'placeholder-red-300');
                    
                    // Evento para limpiar el error visual en cuanto el usuario empiece a escribir
                    field.addEventListener('input', function() {
                        this.classList.remove('border-red-500', 'bg-red-50', 'placeholder-red-300');
                        this.classList.add('border-slate-200');
                    }, { once: true });
                }
            });

            const msgDiv = document.getElementById('contactMessage');
            if (!isValid) {
                if (msgDiv) {
                    msgDiv.innerHTML = '<span class="material-symbols-outlined align-middle text-[18px]">error</span> Por favor, completa correctamente los campos en rojo.';
                    msgDiv.classList.remove('hidden');
                    msgDiv.classList.add('bg-red-100', 'text-red-800');
                }
            } else {
                if (msgDiv) msgDiv.classList.add('hidden');
                
                const btn = document.getElementById('submitBtn');
                const origText = btn.innerHTML;
                if (btn) {
                    btn.disabled = true;
                    btn.innerHTML = '<span class="material-symbols-outlined animate-spin text-[20px] align-middle mr-2">refresh</span> Enviando...';
                }
                
                // Aquí puedes reemplazar este bloque setTimeout con tu fetch() real hacia tu enviador de correos PHP
                setTimeout(() => {
                    const modal = document.getElementById('contactSuccessModal');
                    const content = document.getElementById('contactSuccessModalContent');
                    if (modal && content) { modal.classList.remove('hidden'); setTimeout(() => { modal.classList.remove('opacity-0'); content.classList.remove('scale-95'); }, 10); }
                    
                    this.reset();
                    window.resetForm(); // Oculta la caja de plan seleccionado
                    if (btn) { btn.disabled = false; btn.innerHTML = origText; }
                }, 1500); // Retraso simulado de 1.5 segundos
            }
        });
    }

    // --- Inicializador del Modal de Confirmación Global ---
    const btnAcceptConfirm = document.getElementById('btnAcceptConfirm');
    if (btnAcceptConfirm) {
        btnAcceptConfirm.addEventListener('click', async () => {
            if (confirmActionCallback) {
                const originalText = btnAcceptConfirm.textContent;
                btnAcceptConfirm.disabled = true;
                btnAcceptConfirm.classList.add('opacity-70', 'cursor-not-allowed');
                btnAcceptConfirm.innerHTML = '<span class="material-symbols-outlined animate-spin text-[18px] align-middle mr-1">refresh</span> Procesando...';
                
                try {
                    const result = confirmActionCallback();
                    if (result instanceof Promise) await result;
                } catch (e) {
                    console.error('Error:', e);
                } finally {
                    btnAcceptConfirm.disabled = false;
                    btnAcceptConfirm.classList.remove('opacity-70', 'cursor-not-allowed');
                    btnAcceptConfirm.textContent = originalText;
                    closeConfirm();
                }
            } else {
                closeConfirm();
            }
        });
    }

    // --- Enrutador de inicialización por página ---
    // Cada archivo modular (agenda.js, calendario.js, etc.) tendrá su propio
    // listener 'DOMContentLoaded' para ejecutar su lógica específica.
    // Este archivo principal solo provee las herramientas comunes.

    // --- Parámetros de URL ---
    const dateParam = new URLSearchParams(window.location.search).get('date');
    if (dateParam && typeof cal_selectDate === 'function') {
        setTimeout(() => {
            const [y, m, d] = dateParam.split('-');
            const dObj = new Date(y, m - 1, d);
            cal_selectDate(dObj);
        }, 800);
    }

    if (typeof enableImagePreview === 'function') {
        document.querySelectorAll('input[type="file"]').forEach(enableImagePreview);
    }

        // --- Inicialización del Carrusel (Landing Page) ---
        if (document.getElementById('carouselTitle')) {
            window.numProfessionals = { basic: 1, inter: 1, prem: 1 };
            window.pricingData = null;
            
            window.updateProfCount = function(change, planKey) {
                let newVal = window.numProfessionals[planKey] + change;
                if (newVal < 1) newVal = 1;
                if (newVal > 5) newVal = 5; // Límite de 5 profesionales (50% max) para no regalar el sistema
                window.numProfessionals[planKey] = newVal;
                
                if (document.getElementById('profCountDisplay_' + planKey)) {
                    document.getElementById('profCountDisplay_' + planKey).textContent = window.numProfessionals[planKey];
                }
                window.renderPricing();
            };
            
            window.renderPricing = function() {
                const pData = window.pricingData || {};
                
                let rawB = parseFloat(pData.precio_basico) || 8889;
                let rawI = parseFloat(pData.precio_intermedio) || 11111;
                let rawP = parseFloat(pData.precio_premium) || 16667;

                let discPct = parseInt(pData.descuento_porcentaje);
                if (isNaN(discPct) || discPct < 0) discPct = 0;

                const factor = (100 - discPct) / 100;

                const b = Math.round(rawB * factor);
                const i = Math.round(rawI * factor);
                const p = Math.round(rawP * factor);
                
                const getFinalPrice = (finalPriceForOne, rawBasePrice, count) => {
                    if (count === 1) {
                        return {
                            final: finalPriceForOne,
                            oldPrice: rawBasePrice,
                            badgeText: discPct > 0 ? `-${discPct}% OFF` : '',
                            showOldPrice: discPct > 0
                        };
                    } else {
                        let volumeDiscount = count * 10;
                        if (volumeDiscount > 50) volumeDiscount = 50;
                        
                        let totalBeforeVol = finalPriceForOne * count;
                        let final = totalBeforeVol * (1 - volumeDiscount / 100);
                        
                        return {
                            final: Math.round(final),
                            oldPrice: Math.round(totalBeforeVol),
                            badgeText: `-${volumeDiscount}% POR EQUIPO`,
                            showOldPrice: true
                        };
                    }
                };
                
                const updateBox = (boxId, oldId, finalPriceOne, rawBaseOne, labelClass, perPersonId, planKey) => {
                    const box = document.getElementById(boxId);
                    const old = document.getElementById(oldId);
                    const perPerson = document.getElementById(perPersonId);
                    
                    let count = window.numProfessionals[planKey];
                    let info = getFinalPrice(finalPriceOne, rawBaseOne, count);
                    
                    if (box) box.innerHTML = `$${info.final.toLocaleString('es-AR', {maximumFractionDigits:0})}<span class="text-sm font-normal ${labelClass} ml-1">/mes</span>`;
                    if (old) {
                        const container = old.parentElement;
                        if (info.showOldPrice) {
                            old.textContent = `$${info.oldPrice.toLocaleString('es-AR', {maximumFractionDigits:0})}`;
                            container.style.display = 'flex';
                            const badge = container.querySelector('span:last-child');
                            if (badge) badge.textContent = info.badgeText;
                        } else {
                            container.style.display = 'none';
                        }
                    }
                    
                    // Mostrar precio por cabeza
                    if (perPerson) {
                        if (count > 1) {
                            let pricePerPerson = info.final / count;
                            perPerson.innerHTML = `¡Queda en $${pricePerPerson.toLocaleString('es-AR', {maximumFractionDigits:0})} p/persona!<br><span class="text-xs font-normal text-slate-500 mt-1 block">Ya incluye 10% OFF base + descuento por equipo</span>`;
                            perPerson.classList.remove('hidden');
                        } else {
                            perPerson.classList.add('hidden');
                        }
                    }
                };
                
                updateBox('priceBasicBox', 'priceBasicOld', b, rawB, 'text-slate-500', 'perPersonBasic', 'basic');
                updateBox('priceInterBox', 'priceInterOld', i, rawI, 'text-white/80', 'perPersonInter', 'inter');
                updateBox('pricePremBox', 'pricePremOld', p, rawP, 'text-slate-500', 'perPersonPrem', 'prem');
                
                // Actualizar insignias de notificaciones de WhatsApp dinámicamente según cantidad de profesionales
                const countInter = window.numProfessionals['inter'] || 1;
                const countPrem = window.numProfessionals['prem'] || 1;

                const extraInter = Math.max(0, countInter - 1);
                const extraPrem = Math.max(0, countPrem - 1);

                const wppInter = 50 + (extraInter * 10);
                const wppPrem = 100 + (extraPrem * 10);

                const badgeInter = document.getElementById('wppQuotaDisplay_inter');
                if (badgeInter) {
                    badgeInter.textContent = `${wppInter} WPP/mes total negocio`;
                }

                const badgePrem = document.getElementById('wppQuotaDisplay_prem');
                if (badgePrem) {
                    badgePrem.textContent = `${wppPrem} WPP/mes total negocio`;
                }

                // El Carrusel ("Visualizá tu éxito") debe mostrar SIEMPRE el precio BASE de 1 profesional con su descuento establecido
                const planKeys = ['basic', 'inter', 'prem'];
                const finalPrices = [b, i, p];
                const rawPrices = [rawB, rawI, rawP];
                
                for(let idx = 0; idx < 3; idx++) {
                    let infoBase = getFinalPrice(finalPrices[idx], rawPrices[idx], 1);
                    carouselData[idx].price = '$' + infoBase.final.toLocaleString('es-AR', {maximumFractionDigits:0});
                    carouselData[idx].oldPrice = '$' + infoBase.oldPrice.toLocaleString('es-AR', {maximumFractionDigits:0});
                    carouselData[idx].badgeText = infoBase.badgeText;
                    carouselData[idx].showOldPrice = infoBase.showOldPrice;
                }
                
                setCarouselIndex(currentCarouselIndex);
            };

            // Renderizar de inmediato para evitar que el botón '+' no responda si el servidor tarda en contestar
            window.renderPricing();

            fetch('backend/obtener_precios.php').then(res=>res.json()).then(pData => {
                if(pData.success && pData.data) {
                    window.pricingData = pData.data;
                    window.renderPricing();
                }
            }).catch(() => setCarouselIndex(1));

            const prevBtn = document.getElementById('prevCarouselBtn');
            const nextBtn = document.getElementById('nextCarouselBtn');
            
            if (prevBtn) {
                prevBtn.addEventListener('click', () => {
                    setCarouselIndex(currentCarouselIndex - 1 < 0 ? carouselData.length - 1 : currentCarouselIndex - 1);
                });
            }
            if (nextBtn) {
                nextBtn.addEventListener('click', () => {
                    setCarouselIndex(currentCarouselIndex + 1 >= carouselData.length ? 0 : currentCarouselIndex + 1);
                });
            }
        }
});

function openWebModal() {
    const modal = document.getElementById('webModal');
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden'; // Evita scroll de fondo
}

function closeWebModal() {
    const modal = document.getElementById('webModal');
    modal.classList.add('hidden');
    document.body.style.overflow = 'auto';
}

function showSuspendedAccountModal(message) {
    let modal = document.getElementById('suspendedAccountModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'suspendedAccountModal';
        modal.className = 'fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[999] flex items-center justify-center p-4 sm:p-6 transition-all duration-300';
        modal.innerHTML = `
            <div class="bg-white rounded-3xl shadow-2xl border border-red-100 max-w-md w-full p-6 sm:p-8 text-center animate-modal-pop">
                <div class="w-16 h-16 rounded-2xl bg-red-50 text-red-500 border border-red-100 flex items-center justify-center mx-auto mb-4 shadow-xs">
                    <span class="material-symbols-outlined text-3xl">block</span>
                </div>
                <h3 class="text-xl font-extrabold text-slate-800 mb-2">Cuenta Suspendida</h3>
                <p class="text-sm text-slate-600 font-medium mb-6">${message || 'Tu cuenta está suspendida por falta de pago. Serás redirigido al panel de control para regularizar tu situación.'}</p>
                <button onclick="window.location.href='dashboard.html'" class="w-full bg-red-600 hover:bg-red-700 text-white font-extrabold py-3.5 px-6 rounded-2xl transition-all shadow-lg shadow-red-500/20 active:scale-95">
                    Ir al Panel de Control
                </button>
            </div>
        `;
        document.body.appendChild(modal);
    } else {
        modal.classList.remove('hidden');
    }
}

function isAccountSuspended(dbStatus, lastPaymentStr, fechaAltaStr) {
    // Si es cuenta Demo o está en sesión demo, NUNCA está suspendida
    const isDemo = (window.currentUserData && window.currentUserData.email && window.currentUserData.email.includes('demo')) ||
                   (window.currentBusinessData && (window.currentBusinessData.ruta === 'demo' || (window.currentBusinessData.ruta && window.currentBusinessData.ruta.indexOf('demo') === 0) || window.currentBusinessData.is_demo)) ||
                   (sessionStorage.getItem('is_demo_user') === 'true') ||
                   (sessionStorage.getItem('agendatina_demo_alert') === 'true');
    if (isDemo) return false;

    if (dbStatus === 'suspendido') return true;
    
    const today = new Date();
    
    if (dbStatus === 'prueba' || dbStatus === 'beta') {
        if (!fechaAltaStr) return false;
        const fechaAlta = new Date(fechaAltaStr.replace(/-/g, '/'));
        const trialEnd = new Date(fechaAlta);
        trialEnd.setDate(trialEnd.getDate() + 30);
        return today > trialEnd;
    } 
    
    if (dbStatus === 'activo' || dbStatus === 'pagado') {
        if (!lastPaymentStr) return false; // Si aún no registra fecha de pago en cuenta activa, se asume vigente
        const lastPayment = new Date(lastPaymentStr.replace(/-/g, '/'));
        if (isNaN(lastPayment.getTime())) return false;
        const paymentDeadline = new Date(lastPayment);
        paymentDeadline.setDate(paymentDeadline.getDate() + 40); // 30 días + 10 días de gracia
        return today > paymentDeadline;
    }
    
    return false;
}

function applyWebCustomization() {
    fetch(`backend/guardar_web.php?n=${negocioSlug}`)
        .then(res => res.json())
        .then(data => {
            if (data && !data.error) {
                
                // Validar suspensión automática por fechas o manual
                if (isAccountSuspended(data.estado_pago, data.ultimo_pago, data.fecha_alta)) {
                    const path = window.location.pathname;
                    const isDashboard = path.includes('dashboard');
                    
                    if (!isDashboard) {
                        const isAdminPage = path.includes('agenda') ||
                                            path.includes('mi-web') ||
                                            ((path.includes('calendarioMensual') || path.includes('calendarioSemanal')) && (!negocioSlug || negocioSlug === ''));
                                            
                        if (isAdminPage) {
                            showSuspendedAccountModal('Tu cuenta está suspendida por falta de pago. Serás redirigido al panel de control para regularizar tu situación.');
                            setTimeout(() => {
                                window.location.href = 'dashboard.html';
                            }, 2500);
                            return;
                        } else {
                            document.body.innerHTML = '<div style="display:flex; justify-content:center; align-items:center; height:100vh; background:#fff; color:#333; font-family:sans-serif; font-size:24px; font-weight:bold; margin:0;">Error</div>';
                            return;
                        }
                    }
                }

                window.businessWebConfig = data;
                if (data.hora_apertura || data.hora_cierre) {
                    generateTimeSlots(data.hora_apertura || '09:00', data.hora_cierre || '18:00', data.intervalo_turnos || 30);
                    if (cal_selectedDate) {
                        if (isAdmin && !isPreviewMode) {
                            renderAdminDayView(toYYYYMMDD(cal_selectedDate));
                        } else {
                            cal_renderTimeSlots();
                        }
                    }
                }
                if (typeof cal_renderCalendar === 'function') cal_renderCalendar(); // Recargar si es necesario

                if (data.titulo) {
                    document.title = `${data.titulo} | Reservar Turno`;
                    
                    const navBusinessNameText = document.getElementById('navBusinessNameText');
                    if (navBusinessNameText && data.titulo) {
                        navBusinessNameText.textContent = data.titulo;
                    }
                    
                    const navLinks = document.querySelectorAll('a[href="index.html"], a[href="/"], a[href="#"]');
                    navLinks.forEach(link => {
                        if (negocioSlug && (link.closest('nav') || link.closest('header'))) {
                                if (window.location.search.includes('n=')) {
                                    link.href = 'web.html?n=' + negocioSlug;
                                } else {
                                    link.href = `/${negocioSlug}`;
                                }
                        }
                    });
                }
                
                // --- INYECCIÓN PARA WEB.HTML (PÁGINA PÚBLICA) ---
                if (data.texto_local && document.getElementById('publicTextoLocal')) {
                    document.getElementById('publicTextoLocal').textContent = data.texto_local;
                    const section = document.getElementById('sectionTextoLocal');
                    if (section) section.classList.remove('hidden');
                }
                
                if (data.ubicacion_maps && document.getElementById('publicUbicacionMaps')) {
                    const mapsContainer = document.getElementById('publicUbicacionMaps');
                    if (data.ubicacion_maps.includes('<iframe')) {
                        mapsContainer.innerHTML = data.ubicacion_maps;
                    } else {
                        mapsContainer.innerHTML = `<a href="${data.ubicacion_maps}" target="_blank" class="text-primary hover:underline flex items-center gap-2 justify-center p-4 bg-slate-50 rounded-xl font-bold"><span class="material-symbols-outlined">map</span> Abrir en Google Maps</a>`;
                    }
                    const section = document.getElementById('sectionUbicacionMaps');
                    if (section) section.classList.remove('hidden');
                }

                if (data.cursos_html && document.getElementById('publicCursos')) {
                    document.getElementById('publicCursos').innerHTML = data.cursos_html;
                    const section = document.getElementById('sectionCursos');
                    if (section) section.classList.remove('hidden');
                }

                if (data.cursos_json && document.getElementById('publicCursosList')) {
                    try {
                        const cursos = JSON.parse(data.cursos_json);
                        const container = document.getElementById('publicCursosList');
                        container.innerHTML = '';
                        if (cursos.length > 0) {
                            cursos.forEach(c => {
                                const img = c.foto ? `<img src="${c.foto}" alt="${c.nombre}" class="w-full h-48 object-cover rounded-2xl mb-4 shadow-sm">` : '';
                                container.innerHTML += `
                                    <div class="bg-white rounded-3xl p-6 text-left border border-slate-100 shadow-sm hover:shadow-xl transition-all hover:-translate-y-1">
                                        ${img}
                                        <h3 class="text-xl font-bold text-slate-800">${c.nombre}</h3>
                                        ${c.descripcion ? `<p class="text-sm text-slate-500 mt-3 leading-relaxed">${c.descripcion}</p>` : ''}
                                    </div>
                                `;
                            });
                            const section = document.getElementById('sectionCursos');
                            if (section) section.classList.remove('hidden');
                        }
                    } catch (e) { console.error("Error parseando cursos:", e); }
                }

                let allProfsScript = [];
                if (data.profesionales_json) {
                    try {
                        const parsed = JSON.parse(data.profesionales_json);
                        if (Array.isArray(parsed)) allProfsScript = parsed;
                    } catch (e) {}
                }
                if (typeof servicesData !== 'undefined' && Array.isArray(servicesData) && servicesData.length > 0) {
                    servicesData.forEach(s => {
                        if (s.profesional && s.profesional.trim() !== '' && s.profesional !== 'Cualquiera (Sin preferencia)') {
                            const profName = s.profesional.trim();
                            const exists = allProfsScript.some(p => p.nombre && p.nombre.toLowerCase() === profName.toLowerCase());
                            if (!exists) {
                                allProfsScript.push({
                                    nombre: profName,
                                    descripcion: 'Especialista del equipo',
                                    foto: s.foto_profesional || ''
                                });
                            }
                        }
                    });
                }
                if (allProfsScript.length > 0 && document.getElementById('publicProfesionalesList')) {
                    const container = document.getElementById('publicProfesionalesList');
                    container.innerHTML = '';
                    allProfsScript.forEach(p => {
                        const img = p.foto ? `<img src="${p.foto}" alt="${p.nombre}" class="w-32 h-32 rounded-full object-cover mx-auto mb-4 border-4 border-slate-100 shadow-md">` : `<div class="w-32 h-32 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4 border-4 border-slate-100 shadow-md"><span class="material-symbols-outlined text-5xl">person</span></div>`;
                        container.innerHTML += `
                            <div class="bg-white rounded-3xl p-6 text-center border border-slate-100 shadow-sm hover:shadow-xl transition-all hover:-translate-y-1">
                                ${img}
                                <h3 class="text-xl font-bold text-slate-800">${p.nombre}</h3>
                                <p class="text-sm text-slate-500 mt-3 leading-relaxed">${p.descripcion || 'Profesional'}</p>
                            </div>
                        `;
                    });
                    const section = document.getElementById('sectionProfesionales');
                    if (section) section.classList.remove('hidden');
                }
                // ------------------------------------------------
                
                if (data.alineacion_servicios) {
                    const alignVal = data.alineacion_servicios;
                    const flexAlign = alignVal === 'center' ? 'center' : (alignVal === 'right' ? 'flex-end' : 'flex-start');
                    let alignStyle = document.getElementById('agendatina-service-alignment');
                    if (!alignStyle) {
                        alignStyle = document.createElement('style');
                        alignStyle.id = 'agendatina-service-alignment';
                        document.head.appendChild(alignStyle);
                    }
                    alignStyle.innerHTML = `
                        .service-card, .card-servicio, div[id^="card-servicio-"] { text-align: ${alignVal} !important; }
                        .service-card .p-6, .card-servicio .p-6, .service-card .flex-col { align-items: ${flexAlign} !important; text-align: ${alignVal} !important; }
                        .service-card h3, .card-servicio h3 { text-align: ${alignVal} !important; width: 100% !important; }
                        .service-card .flex, .card-servicio .flex { justify-content: ${flexAlign} !important; width: 100% !important; }
                        .service-card p, .card-servicio p, .service-card .line-clamp-3 { text-align: ${alignVal} !important; width: 100% !important; }
                    `;
                }

                if (!document.getElementById('agendatinaFooter') && (!isAdmin || isPreviewMode)) {
                    const footer = document.createElement('footer');
                    footer.id = 'agendatinaFooter';
                    footer.className = 'text-center py-6 mt-8 w-full flex justify-center';
                    footer.innerHTML = '<a href="https://agendatina.site" target="_blank" class="inline-block hover:opacity-80 transition-opacity"><img src="public/logoletras.png" alt="Agendatina" class="h-14 w-auto opacity-80 hover:opacity-100 transition-all"></a>';
                    
                    const main = document.querySelector('main') || document.body;
                    if (main === document.body) {
                        document.body.appendChild(footer);
                    } else {
                        main.parentElement.appendChild(footer);
                    }
                }
                if (data.logo && data.logo !== 'null' && data.logo !== 'undefined') {
                    const favicon = document.querySelector('link[rel="icon"]');
                    if (favicon) favicon.href = data.logo;
                    
                    const navIconContainer = document.getElementById('navIconContainer');
                    const navLogoImg = document.getElementById('navLogoImg');
                    if (navIconContainer) navIconContainer.classList.add('hidden');
                    if (navLogoImg) { navLogoImg.src = data.logo; navLogoImg.classList.remove('hidden'); }
                
                    const navAvatar = document.getElementById('navAvatar');
                    if (navAvatar) {
                        navAvatar.innerHTML = `<img src="${data.logo}" class="w-full h-full object-cover" alt="Logo">`;
                        navAvatar.style.background = 'transparent';
                    }
                }
                if (data.color_secundario) {
                    const navBrandAccent = document.getElementById('navBrandAccent');
                    if (navBrandAccent) navBrandAccent.style.color = data.color_secundario;
                }
                if (data.color_primario || data.color_secundario || data.color_fondo) {
                    const pColor = data.color_primario || '#D11149';
                    const sColor = data.color_secundario || '#FCB0B3';
                    
                    let hex = pColor.replace('#', '');
                    if(hex.length === 3) hex = hex.split('').map(x => x+x).join('');
                    let r = parseInt(hex.substr(0, 2), 16) || 0;
                    let g = parseInt(hex.substr(2, 2), 16) || 0;
                    let b = parseInt(hex.substr(4, 2), 16) || 0;
                    let yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
                    
                    let textColor = (yiq >= 128) ? '#1e293b' : '#ffffff';

                    // Eliminar la etiqueta de estilo anterior si existe (útil al guardar desde el panel admin)
                    const oldStyle = document.getElementById('dynamic-business-styles');
                    if (oldStyle) oldStyle.remove();

                    const style = document.createElement('style');
                    style.id = 'dynamic-business-styles';
                    
                    let styleHTML = `
                        :root {
                            --color-primario: ${pColor};
                            --color-secundario: ${sColor};
                            --color-texto-contraste: ${textColor};
                        }
                        .bg-primary { background-color: var(--color-primario) !important; }
                        .text-primary { color: var(--color-primario) !important; }
                        .border-primary { border-color: var(--color-primario) !important; }
                        .ring-primary { --tw-ring-color: var(--color-primario) !important; }
                        
                        /* Forzar color en botones principales generales (Tailwind bg-blue-600) */
                        button[type="submit"], .bg-blue-600 { background-color: var(--color-primario) !important; color: var(--color-texto-contraste) !important; }
                        button[type="submit"]:hover, .hover\\:bg-blue-700:hover { background-color: var(--color-primario) !important; color: var(--color-texto-contraste) !important; filter: brightness(0.85); }
                        
                        /* Estilos para el calendario y horarios */
                        .calendar-day.selected { background-color: var(--color-primario) !important; color: var(--color-texto-contraste) !important; }
                        .time-slot.selected { background-color: var(--color-primario) !important; color: var(--color-texto-contraste) !important; border-color: var(--color-primario) !important; }
                        .text-primary-contrast { color: var(--color-texto-contraste) !important; }
                    `;
                    if (data.color_fondo) {
                        styleHTML += `body, .bg-slate-100 { background-color: ${data.color_fondo} !important; }`;
                    }
                    style.innerHTML = styleHTML;
                    document.head.appendChild(style);
                }
        
            if (data.metodos_pago) {
                const metodos = data.metodos_pago.split(',').map(m => m.trim()).filter(m => m);
                if (metodos.length > 0) {
                    ['bookingMetodoPago', 'weeklyMetodoPago'].forEach(id => {
                        const sel = document.getElementById(id);
                        if (sel) {
                            sel.innerHTML = '<option value="" disabled selected>Elige cómo abonarás</option>';
                            metodos.forEach(m => sel.innerHTML += `<option value="${m}">${m}</option>`);
                            if (sel.parentElement) sel.parentElement.classList.remove('hidden');
                            sel.required = true;
                        }
                    });
                }
            }
            }
        })
        .catch(err => console.error('Error al cargar personalización:', err));
}                   // Eliminar la etiqueta de estilo anterior si existe (útil al guardar desde el panel admin)

window.verComprobanteModal = function(url) {
    let modal = document.getElementById('reusableReceiptModal');
    if (!modal) {
        const div = document.createElement('div');
        div.innerHTML = `
        <div id="reusableReceiptModal" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] hidden items-center justify-center p-4 opacity-0 transition-opacity duration-300">
            <div id="reusableReceiptModalContent" class="bg-white rounded-3xl shadow-2xl max-w-2xl w-full p-6 transform scale-95 transition-transform duration-300 flex flex-col max-h-[90vh]">
                <div class="flex justify-between items-center mb-4">
                    <h2 class="text-xl font-bold text-slate-800 flex items-center gap-2"><span class="material-symbols-outlined text-purple-600">receipt_long</span> Comprobante Enviado</h2>
                    <button onclick="window.closeReusableReceiptModal()" class="text-slate-400 hover:text-red-500 bg-slate-100 hover:bg-red-50 rounded-full p-1.5 transition-colors"><span class="material-symbols-outlined">close</span></button>
                </div>
                <div class="flex-1 overflow-auto bg-slate-50 rounded-xl border border-slate-200 mb-4 flex items-center justify-center min-h-[300px]">
                    <img id="reusableReceiptImage" src="" class="max-w-full max-h-[70vh] object-contain hidden" alt="Comprobante">
                    <iframe id="reusableReceiptPdf" src="" class="w-full h-[70vh] hidden border-0"></iframe>
                </div>
                <div class="flex justify-end pt-2">
                    <button onclick="window.closeReusableReceiptModal()" class="px-5 py-2.5 font-bold text-white bg-slate-800 hover:bg-slate-700 rounded-xl shadow-lg transition-all">Cerrar</button>
                </div>
            </div>
        </div>`;
        document.body.appendChild(div.firstElementChild);
        modal = document.getElementById('reusableReceiptModal');
    }
    const content = document.getElementById('reusableReceiptModalContent');
    const img = document.getElementById('reusableReceiptImage');
    const pdf = document.getElementById('reusableReceiptPdf');
    
    img.classList.add('hidden');
    pdf.classList.add('hidden');
    
    if (url.toLowerCase().endsWith('.pdf')) {
        pdf.src = url.includes('/') ? url : `backend/uploads/comprobantes/${url}`;
        pdf.classList.remove('hidden');
    } else {
        img.src = url.includes('/') ? url : `backend/uploads/comprobantes/${url}`;
        img.classList.remove('hidden');
    }
    
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        content.classList.remove('scale-95');
    }, 10);
};

window.closeReusableReceiptModal = function() {
    const modal = document.getElementById('reusableReceiptModal');
    if (!modal) return;
    const content = document.getElementById('reusableReceiptModalContent');
    modal.classList.add('opacity-0');
    content.classList.add('scale-95');
    setTimeout(() => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        document.getElementById('reusableReceiptPdf').src = '';
        document.getElementById('reusableReceiptImage').src = '';
    }, 300);
};

// Ocultar reportes de error y contacto para cuentas de demostración (Demo)
document.addEventListener('DOMContentLoaded', () => {
    const applyDemoButtonVisibility = () => {
        const cardSupport = document.getElementById('cardSupport');
        const isDemo = (sessionStorage.getItem('is_demo_user') === 'true' || sessionStorage.getItem('agendatina_demo_alert') === 'true');

        if (cardSupport) cardSupport.style.display = isDemo ? 'none' : '';

        // Ocultar SOLAMENTE los botones específicos de reportar error en modo Demo, sin tocar contenedores ni el header
        document.querySelectorAll('#navReportBugBtn, #btnReportarErrorAgenda').forEach(btn => {
            if (isDemo) {
                btn.classList.add('hidden');
                btn.style.display = 'none';
            }
        });
    };

    const isDemoCached = sessionStorage.getItem('is_demo_user');
    if (isDemoCached === 'true' || sessionStorage.getItem('agendatina_demo_alert') === 'true') {
        sessionStorage.setItem('is_demo_user', 'true');
        applyDemoButtonVisibility();
    } else {
        fetch('backend/perfil.php')
            .then(res => res.json())
            .then(data => {
                const isDemoUser = (data.success && ((data.user && data.user.email && data.user.email.includes('demo')) || (data.business && (data.business.ruta === 'demo' || data.business.is_demo === true))));
                sessionStorage.setItem('is_demo_user', isDemoUser ? 'true' : 'false');
                applyDemoButtonVisibility();
            })
            .catch(() => applyDemoButtonVisibility());
    }

    checkAdminGlobalSession();
});

// Auto-ejecución inmediata por seguridad
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(checkAdminGlobalSession, 100);
} else {
    document.addEventListener('DOMContentLoaded', checkAdminGlobalSession);
}

function checkAdminGlobalSession(config = null) {
    fetch('backend/perfil.php')
    .then(res => res.json())
    .then(data => {
        let isDemo = false;
        let isUserAdmin = false;

        if (data && data.success && data.business) {
            isDemo = (data.business.is_demo === true) || 
                     (data.user && data.user.email && data.user.email.includes('demo')) || 
                     (data.business.ruta === 'demo') || 
                     (sessionStorage.getItem('is_demo_user') === 'true') ||
                     (sessionStorage.getItem('agendatina_demo_alert') === 'true') ||
                     (config && config.is_demo === true);

            const loggedRuta = (data.business.ruta || '').toLowerCase().trim();
            const urlParams = new URLSearchParams(window.location.search);
            const negocioSlug = urlParams.get('n') || window.location.pathname.split('/')[1] || '';
            const currentRuta = (negocioSlug || (config ? config.ruta || config.subdominio : '') || '').toLowerCase().trim();
            
            const adminPages = ['dashboard', 'ajustes', 'estadisticas', 'servicios', 'equipo', 'mi-web', 'agenda', 'manual', 'consultas', 'perfil', 'pago'];
            const currentPath = window.location.pathname.toLowerCase();
            const isAdminPage = adminPages.some(page => currentPath.includes(page)) || !currentRuta;

            if (isDemo || isAdminPage || loggedRuta === currentRuta || (config && data.business.id == config.id_negocio)) {
                isUserAdmin = true;
            }

            // Actualizar nombre del negocio e imagen del logo en el Header
            const bizNameText = document.getElementById('navBusinessNameText');
            const bizLogoImg = document.getElementById('navBusinessLogoImg');
            const bizIcon = document.getElementById('navBusinessIcon');
            
            if (bizNameText) {
                bizNameText.textContent = data.business.nombre_fantasia || (isDemo ? 'Agendatina' : 'Mi Negocio');
            }
            if (bizLogoImg && (data.business.logo || data.business.url_logo)) {
                const logoUrl = data.business.logo || data.business.url_logo;
                if (logoUrl && logoUrl !== 'null' && logoUrl !== 'undefined' && logoUrl.trim() !== '') {
                    bizLogoImg.src = logoUrl;
                    bizLogoImg.classList.remove('hidden');
                    if (bizIcon) bizIcon.classList.add('hidden');
                }
            }
        }

        // 1. Badge del Dashboard (solo si es demo)
        const demoBadge = document.getElementById('demoBadge');
        if (demoBadge) {
            if (isDemo) {
                demoBadge.classList.remove('hidden');
                demoBadge.style.display = 'inline-flex';
            } else {
                demoBadge.classList.add('hidden');
                demoBadge.style.display = 'none';
            }
        }

        // 2. Menú de perfil y badge de sesión en el Header
        const adminMenu = document.getElementById('adminProfileMenu');
        const sessionBadge = document.getElementById('adminSessionBadge');
        const sessionBadgeText = document.getElementById('adminSessionBadgeText');
        const btnVolverPanel = document.getElementById('btnVolverPanel');
        const navLogoutBtn = document.getElementById('navLogoutBtn');

        if (isUserAdmin) {
            if (adminMenu) {
                adminMenu.classList.remove('hidden');
                adminMenu.style.display = 'flex';
            }
            if (sessionBadge) {
                sessionBadge.classList.remove('hidden');
                sessionBadge.style.display = 'flex';
                const dot = sessionBadge.querySelector('span:first-child');
                if (isDemo) {
                    if (dot) dot.className = 'w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse';
                    if (sessionBadgeText) {
                        sessionBadgeText.textContent = 'Modo Demo';
                        sessionBadgeText.className = 'text-[11px] font-extrabold text-amber-600 dark:text-amber-400 uppercase tracking-wider hidden md:inline';
                    }
                } else {
                    if (dot) dot.className = 'w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse';
                    if (sessionBadgeText) {
                        sessionBadgeText.textContent = 'Tu Local';
                        sessionBadgeText.className = 'text-[11px] font-extrabold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider hidden md:inline';
                    }
                }
            }
            if (btnVolverPanel) {
                btnVolverPanel.classList.remove('hidden');
                btnVolverPanel.style.display = 'inline-flex';
            }
            if (navLogoutBtn) {
                navLogoutBtn.classList.remove('hidden');
                navLogoutBtn.style.display = 'inline-flex';
            }
        } else {
            // Usuario es cliente / visitante sin sesión de admin en este local: OCULTAR TODOS LOS BOTONES DE ADMIN
            if (adminMenu) { adminMenu.classList.add('hidden'); adminMenu.style.display = 'none'; }
            if (sessionBadge) { sessionBadge.classList.add('hidden'); sessionBadge.style.display = 'none'; }
            if (btnVolverPanel) { btnVolverPanel.classList.add('hidden'); btnVolverPanel.style.display = 'none'; }
            if (navLogoutBtn) { navLogoutBtn.classList.add('hidden'); navLogoutBtn.style.display = 'none'; }
        }

        // 3. Botón de Reportar Bug: SOLAMENTE visible para Administradores de Cuentas Reales (no demo, no clientes)
        document.querySelectorAll('#navReportBugBtn, #btnReportarErrorAgenda').forEach(btn => {
            if (isUserAdmin && !isDemo) {
                btn.classList.remove('hidden');
                btn.style.display = 'inline-flex';
            } else {
                btn.classList.add('hidden');
                btn.style.display = 'none';
            }
        });
    })
    .catch(() => {
        // En caso de error de red o sin sesión, asegurar que la vista cliente esté limpia de botones admin
        document.querySelectorAll('#navReportBugBtn, #btnReportarErrorAgenda, #navLogoutBtn, #btnVolverPanel, #adminSessionBadge, #adminProfileMenu').forEach(el => {
            if (el) { el.classList.add('hidden'); el.style.display = 'none'; }
        });
    });
}

window.isPublicAgendatinaOfficialPage = function() {
    const path = window.location.pathname.toLowerCase();
    // Excepción explícita: Si estamos en la página web del negocio (mi-web.html o landing pública del negocio), NO es página oficial del SaaS
    if (path.includes('mi-web') || window.location.search.includes('ruta=')) {
        return false;
    }
    // Páginas institucionales públicas oficiales de la plataforma Agendatina
    const officialPages = [
        'index.html',
        'login.html',
        'registro.html',
        'terminos.html',
        'manual.html',
        'consultas.html',
        '/modelos/',
        '/admin/'
    ];
    
    // Si la ruta es la raíz del dominio o index.html o carpeta admin
    if (path === '/' || path.endsWith('/agendatina/') || path.endsWith('/agendatina/index.html')) {
        return true;
    }
    
    return officialPages.some(page => path.includes(page));
};

window.applyUserCustomColors = function(pColor, sColor, extraColors) {
    let style = document.getElementById('agendatina-user-custom-colors');

    // Si estamos en una página oficial institucional de Agendatina o en la web pública de un negocio (web.html),
    // NO debemos inyectar estilos de sesión de administrador para evitar mezclar temas entre negocios.
    const isPublicWebPage = window.location.pathname.includes('web.html');
    if ((window.isPublicAgendatinaOfficialPage && window.isPublicAgendatinaOfficialPage()) || isPublicWebPage) {
        if (style) style.remove();
        return;
    }

    if (!pColor) pColor = localStorage.getItem('user_color_primario') || '#D11149';
    if (!sColor) sColor = localStorage.getItem('user_color_secundario') || '#FC8712';

    // Resolver extraColors sin arrastrar configuraciones residuales de otras cuentas
    if (extraColors === undefined || extraColors === null) {
        const cachedExtra = localStorage.getItem('user_colores_extra_json');
        if (cachedExtra) {
            try { extraColors = JSON.parse(cachedExtra); } catch(e) { extraColors = {}; }
        } else {
            extraColors = {};
        }
    } else if (typeof extraColors === 'string') {
        try { extraColors = JSON.parse(extraColors); } catch(e) { extraColors = {}; }
    }
    extraColors = (extraColors && typeof extraColors === 'object') ? extraColors : {};

    localStorage.setItem('user_color_primario', pColor);
    localStorage.setItem('user_color_secundario', sColor);
    localStorage.setItem('user_colores_extra_json', JSON.stringify(extraColors));

    if (!style) {
        style = document.createElement('style');
        style.id = 'agendatina-user-custom-colors';
        document.head.appendChild(style);
    }

    let extraCss = '';
    const btnColor = (extraColors && extraColors.color_botones) ? extraColors.color_botones : pColor;

    if (extraColors.color_terciario) {
        extraCss += `
            .bg-tertiary { background-color: ${extraColors.color_terciario} !important; }
            .text-tertiary { color: ${extraColors.color_terciario} !important; }
            .border-tertiary { border-color: ${extraColors.color_terciario} !important; }
        `;
    }
    if (extraColors.color_header) {
        extraCss += `
            header:not(#adminHeader):not(#mainNav), nav:not(#adminHeader):not(#mainNav) { background-color: ${extraColors.color_header} !important; }
        `;
    }
    if (extraColors.color_texto_titulos) {
        extraCss += `
            main h1, main h2, main h3, main h4 { color: ${extraColors.color_texto_titulos} !important; }
        `;
    }
    if (extraColors.color_botones) {
        extraCss += `
            .btn-cta, button.bg-primary, a.bg-primary, #btnVolverPanel, .signature-glow, .btn-modal-confirm, #btnModalConfirm, #modalConfirmBtn, #btnConfirmAction, #btnCustomConfirm, #btnSaveCalendarConfig, #btnProfileSubmit, #btnTeamSubmit, #btnReportSubmit, #btnSubmitVerify, #btnAcceptConfirm { background-color: ${extraColors.color_botones} !important; border-color: ${extraColors.color_botones} !important; }
        `;
    }
    if (extraColors.color_cards) {
        extraCss += `
            .card-custom { background-color: ${extraColors.color_cards} !important; }
        `;
    }
    if (extraColors.color_hover) {
        extraCss += `
            .hover\\:bg-primary\\/90:hover { background-color: ${extraColors.color_hover} !important; }
        `;
    }

    style.innerHTML = `
        :root {
            --color-primario: ${pColor};
            --color-secundario: ${sColor};
            --primary: ${pColor};
            --secondary: ${sColor};
            --color-terciario: ${extraColors.color_terciario || '#8b5cf6'};
            --color-botones: ${btnColor};
        }

        /* 1. Fondo del Panel con matiz armónico de ambos colores */
        body, html {
            background-color: color-mix(in srgb, ${pColor} 8%, color-mix(in srgb, ${sColor} 6%, #ffffff)) !important;
        }

        /* 1.b. Fondo Degradé dinámico de colores de marca para el Calendario */
        body.calendar-degrade-active, body[data-degrade="1"], html.calendar-degrade-active, html[data-degrade="1"] {
            background-color: transparent !important;
            background-image: linear-gradient(135deg, color-mix(in srgb, ${pColor} 25%, #ffffff) 0%, #ffffff 40%, color-mix(in srgb, ${sColor} 30%, #ffffff) 100%) !important;
            background-attachment: fixed !important;
        }

        /* 1.c. Barra desplazadora destacada con Color Secundario */
        .custom-scrollbar::-webkit-scrollbar, 
        .time-slots-scrollbar::-webkit-scrollbar,
        #gridHorarios::-webkit-scrollbar,
        [id*="slots"]::-webkit-scrollbar {
            width: 9px !important;
            height: 9px !important;
        }
        .custom-scrollbar::-webkit-scrollbar-track,
        .time-slots-scrollbar::-webkit-scrollbar-track,
        #gridHorarios::-webkit-scrollbar-track,
        [id*="slots"]::-webkit-scrollbar-track {
            background: color-mix(in srgb, ${sColor} 14%, #f1f5f9) !important;
            border-radius: 9999px !important;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb,
        .time-slots-scrollbar::-webkit-scrollbar-thumb,
        #gridHorarios::-webkit-scrollbar-thumb,
        [id*="slots"]::-webkit-scrollbar-thumb {
            background: ${sColor} !important;
            border-radius: 9999px !important;
            border: 2px solid #ffffff !important;
            box-shadow: 0 2px 6px color-mix(in srgb, ${sColor} 40%, transparent) !important;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover,
        .time-slots-scrollbar::-webkit-scrollbar-thumb:hover,
        #gridHorarios::-webkit-scrollbar-thumb:hover,
        [id*="slots"]::-webkit-scrollbar-thumb:hover {
            background: color-mix(in srgb, ${sColor} 85%, black) !important;
        }
        .custom-scrollbar, .time-slots-scrollbar, #gridHorarios, [id*="slots"] {
            scrollbar-width: thin !important;
            scrollbar-color: ${sColor} color-mix(in srgb, ${sColor} 14%, #f1f5f9) !important;
        }

        /* 2. Bordes de Cards y Resaltado Hover con Color Secundario */
        .card-custom, 
        .bg-white.rounded-3xl, 
        div.border-slate-200, 
        div.border-slate-200\\/80, 
        .border-slate-100 {
            border-color: color-mix(in srgb, ${sColor} 30%, color-mix(in srgb, ${pColor} 15%, #e2e8f0)) !important;
            transition: border-color 0.3s ease, box-shadow 0.3s ease;
        }

        .card-custom:hover, 
        .bg-white.rounded-3xl:hover {
            border-color: ${sColor} !important;
            box-shadow: 0 10px 25px -5px color-mix(in srgb, ${sColor} 25%, transparent) !important;
        }

        /* 3. Colores Primarios y Botones de Acción/Confirmación en Modales y Dashboard */
        .bg-primary, 
        button.bg-primary, 
        a.bg-primary, 
        .btn-primary, 
        .btn-cta,
        #btnVolverPanel,
        .btn-modal-confirm,
        #btnModalConfirm,
        #modalConfirmBtn,
        #btnConfirmAction,
        #btnCustomConfirm,
        #btnSaveCalendarConfig,
        #btnProfileSubmit,
        #btnTeamSubmit,
        #btnReportSubmit,
        #btnSubmitVerify,
        #btnAcceptConfirm,
        div[id*="Modal"] button[type="submit"]:not(.bg-red-500):not(.bg-red-600):not(.bg-emerald-500):not(.bg-emerald-600),
        div[id*="modal"] button[type="submit"]:not(.bg-red-500):not(.bg-red-600):not(.bg-emerald-500):not(.bg-emerald-600) { 
            background-color: ${btnColor} !important; 
            border-color: ${btnColor} !important;
        }

        .text-primary { color: ${pColor} !important; }
        .border-primary { border-color: ${pColor} !important; }
        .hover\\:bg-primary\\/90:hover { background-color: color-mix(in srgb, ${btnColor} 90%, black) !important; }
        .focus\\:ring-primary:focus { --tw-ring-color: ${btnColor} !important; }
        .shadow-primary\\/30 { --tw-shadow-color: color-mix(in srgb, ${btnColor} 30%, transparent) !important; }
        .shadow-primary\\/20 { --tw-shadow-color: color-mix(in srgb, ${btnColor} 20%, transparent) !important; }

        .signature-glow {
            background: linear-gradient(135deg, ${btnColor} 0%, ${sColor} 100%) !important;
        }

        /* 4. Colores Secundarios (Destacados, Iconos, Badges, Botones Secundarios) */
        .bg-secondary, button.bg-secondary, .btn-secondary { background-color: ${sColor} !important; }
        .text-secondary { color: ${sColor} !important; }
        .border-secondary { border-color: ${sColor} !important; }
        
        .bg-secondary\\/10 { background-color: color-mix(in srgb, ${sColor} 12%, #ffffff) !important; color: ${sColor} !important; }
        .bg-secondary\\/20 { background-color: color-mix(in srgb, ${sColor} 20%, #ffffff) !important; color: ${sColor} !important; }

        /* Iconos de cabecera e insignias con acento secundario */
        .w-14.h-14.rounded-2xl,
        .w-13.h-13.rounded-2xl,
        .w-12.h-12.rounded-2xl {
            border-color: color-mix(in srgb, ${sColor} 40%, transparent) !important;
        }

        /* 5. Calendario y Franjas Horarias */
        /* Cuadrados del Calendario */
        .calendar-day:not(.disabled), 
        .mini-calendar-day:not(.disabled),
        #calendarDays > div:not(.disabled):not(:empty),
        #weeklyCalendarDays > div:not(.disabled):not(:empty),
        #adminWeeklyGrid > div:not(.disabled):not(:empty),
        .weekly-day-card {
            background-color: color-mix(in srgb, ${pColor} 15%, #ffffff) !important;
            border: 1.5px solid color-mix(in srgb, ${sColor} 40%, #ffffff) !important;
            color: ${pColor} !important;
            font-weight: 800 !important;
        }

        /* Día Seleccionado / Activo con Gradiente de Primario a Secundario */
        .calendar-day.selected, 
        .mini-calendar-day.selected, 
        .time-slot.selected, 
        .mini-time-slot.selected,
        #calendarDays > div.selected,
        #weeklyCalendarDays > div.selected,
        #adminWeeklyGrid > div.selected {
            background: linear-gradient(135deg, ${pColor} 0%, ${sColor} 100%) !important;
            color: #ffffff !important;
            border-color: ${sColor} !important;
            font-weight: 900 !important;
            box-shadow: 0 4px 16px color-mix(in srgb, ${sColor} 35%, transparent) !important;
        }

        /* Hover de Franjas Horarias */
        .time-slot:hover:not(.booked),
        #weeklyTimeSlots > button:not(.disabled):hover {
            background-color: color-mix(in srgb, ${sColor} 20%, #ffffff) !important;
            border-color: ${sColor} !important;
            color: ${sColor} !important;
        }

        /* Navegación y Encabezados del Calendario */
        #monthYear, #selectedDateText, #weekRangeDisplay, #weekMonthYear, #adminWeekMonthYear, #selectedDateLabel, .grid-cols-7 > div {
            color: ${pColor} !important;
            font-weight: 800 !important;
        }
        button#prevWeek, button#nextWeek, button#adminPrevWeekBtn, button#adminNextWeekBtn, button#prevMonth, button#nextMonth {
            background-color: color-mix(in srgb, ${pColor} 20%, #ffffff) !important;
            color: ${pColor} !important;
            border-color: color-mix(in srgb, ${pColor} 45%, #ffffff) !important;
        }
        button#prevWeek:hover, button#nextWeek:hover, button#adminPrevWeekBtn:hover, button#adminNextWeekBtn:hover, button#prevMonth:hover, button#nextMonth:hover {
            background-color: color-mix(in srgb, ${pColor} 35%, #ffffff) !important;
            border-color: ${pColor} !important;
        }

        /* Botones de Acción y Paneles */
        #btnWeeklySubmit, #adminControls, #btnMultiSelect {
            border-color: color-mix(in srgb, ${pColor} 40%, #e2e8f0) !important;
        }

        /* Pestañas de Profesionales Activas / Inactivas con Gradiente */
        .prof-tab-pill.active, .tab-cal-active {
            background: linear-gradient(135deg, ${pColor} 0%, ${sColor} 100%) !important;
            color: #ffffff !important;
            border-color: ${sColor} !important;
            box-shadow: 0 4px 12px color-mix(in srgb, ${sColor} 30%, transparent) !important;
        }
        .prof-tab-pill:not(.active) {
            background-color: color-mix(in srgb, ${sColor} 10%, #ffffff) !important;
            color: ${sColor} !important;
            border-color: color-mix(in srgb, ${sColor} 35%, #e2e8f0) !important;
        }

        /* Avatar del Usuario en Navbar con Gradiente Primario a Secundario */
        #navAvatar:not(:has(img)) {
            background: linear-gradient(135deg, ${pColor} 0%, ${sColor} 100%) !important;
            color: #ffffff !important;
        }

        ${extraCss}

        /* Protección del logo institucional de Agendatina en Header/Footer */
        .font-brand.font-semibold.text-2xl.tracking-tight.text-\\[\\#d11149\\],
        #navAgendatinaBrand .text-\\[\\#d11149\\],
        header .font-brand .text-\\[\\#d11149\\],
        footer .font-brand .text-\\[\\#d11149\\] {
            color: #d11149 !important;
        }
        .font-brand.font-semibold.text-2xl.tracking-tight .text-\\[\\#fc8712\\],
        #navAgendatinaBrand .text-\\[\\#fc8712\\],
        header .font-brand .text-\\[\\#fc8712\\],
        footer .font-brand .text-\\[\\#fc8712\\] {
            color: #fc8712 !important;
        }
    `;
};

document.addEventListener('DOMContentLoaded', () => {
    const isPublicWebPage = window.location.pathname.includes('web.html');
    if ((window.isPublicAgendatinaOfficialPage && window.isPublicAgendatinaOfficialPage()) || isPublicWebPage) {
        const style = document.getElementById('agendatina-user-custom-colors');
        if (style) style.remove();
        return; // Preservar tema de Agendatina en páginas oficiales y web pública
    }

    // 1. Carga inmediata desde el almacenamiento local para renderizado instantáneo
    const cachedP = localStorage.getItem('user_color_primario');
    const cachedS = localStorage.getItem('user_color_secundario');
    const cachedExtra = localStorage.getItem('user_colores_extra_json');
    if (cachedP || cachedS || cachedExtra) {
        window.applyUserCustomColors(cachedP, cachedS, cachedExtra);
    }

    // 2. Sincronización obligatoria desde el servidor para que Dueño/Admin y Profesionales compartan siempre los mismos colores
    if (typeof loadCustomization === 'function') {
        loadCustomization();
    }
});

// --- LÓGICA DE HILO DE SOPORTE PARA CLIENTES / NEGOCIOS ---
window.abrirHiloSoporteCliente = function(idReporte, titulo) {
    let modal = document.getElementById('modalSoporteHiloCliente');
    if (!modal) {
        const div = document.createElement('div');
        div.innerHTML = `
        <div id="modalSoporteHiloCliente" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] hidden flex items-center justify-center p-4 opacity-0 transition-opacity duration-300">
            <div id="modalSoporteHiloClienteContent" class="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl relative transform scale-95 transition-transform duration-300">
                <button type="button" onclick="window.cerrarHiloSoporteCliente()" class="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 transition-colors">
                    <span class="material-symbols-outlined">close</span>
                </button>

                <div class="mb-4">
                    <div class="flex items-center gap-2 text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">
                        <span class="material-symbols-outlined text-lg">support_agent</span>
                        <span>Soporte Técnico Agendatina</span>
                    </div>
                    <h3 class="text-xl font-extrabold text-slate-900 font-display" id="hiloClienteTitulo">Conversación de Soporte</h3>
                    <p class="text-xs text-slate-500 mt-1">Hilo directo de comunicación sobre tu reporte o solicitud.</p>
                </div>

                <div id="hiloClienteMensajes" class="bg-slate-50 rounded-2xl p-4 border border-slate-200 mb-4 max-h-60 overflow-y-auto space-y-3 text-xs">
                    <div class="text-center text-slate-400 font-medium">Cargando conversación...</div>
                </div>

                <form onsubmit="window.enviarRespuestaClienteSoporte(event)" class="space-y-3">
                    <input type="hidden" id="hiloClienteReporteId" value="">
                    <div>
                        <label class="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Responder a Soporte</label>
                        <textarea id="hiloClienteTextarea" rows="3" class="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-primary font-medium" placeholder="Escribe tu mensaje o respuesta a Soporte aquí..." required></textarea>
                    </div>
                    <div class="flex justify-end gap-3 pt-1">
                        <button type="button" onclick="window.cerrarHiloSoporteCliente()" class="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-5 py-2.5 rounded-xl text-xs transition-all">Cerrar</button>
                        <button type="submit" id="btnEnviarClienteSoporte" class="bg-primary hover:bg-primary/90 text-white font-extrabold px-6 py-2.5 rounded-xl text-xs transition-all shadow-md shadow-primary/20 flex items-center gap-1.5">
                            <span class="material-symbols-outlined text-[16px]">send</span> Enviar Respuesta
                        </button>
                    </div>
                </form>
            </div>
        </div>`;
        document.body.appendChild(div.firstElementChild);
        modal = document.getElementById('modalSoporteHiloCliente');
    }

    document.getElementById('hiloClienteReporteId').value = idReporte || '';
    if (titulo) document.getElementById('hiloClienteTitulo').textContent = titulo;

    const container = document.getElementById('hiloClienteMensajes');
    container.innerHTML = '<div class="text-center text-slate-400 font-medium">Cargando conversación...</div>';

    if (idReporte && idReporte > 0) {
        fetch(`backend/enviar_soporte.php?action=obtener_hilo&id_reporte=${idReporte}`)
            .then(r => r.json())
            .then(d => {
                if (d.success && d.data && d.data.length > 0) {
                    let html = '';
                    d.data.forEach(m => {
                        const isSuper = m.emisor === 'admin';
                        const f = new Date(m.fecha).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
                        html += `
                            <div class="p-3 rounded-2xl ${isSuper ? 'bg-blue-50 border border-blue-100 text-blue-900 mr-4' : 'bg-primary/10 border border-primary/20 text-slate-900 ml-4'}">
                                <div class="flex justify-between items-center mb-1">
                                    <strong class="text-[11px] font-black">${isSuper ? '🛡️ Soporte Agendatina' : '👤 Tú'}</strong>
                                    <span class="text-[10px] text-slate-400">${f}</span>
                                </div>
                                <p class="leading-relaxed font-medium">${m.mensaje}</p>
                            </div>
                        `;
                    });
                    container.innerHTML = html;
                    container.scrollTop = container.scrollHeight;
                } else {
                    container.innerHTML = '<div class="text-center text-slate-400 text-xs py-2">Sin mensajes registrados aún. Escribe tu respuesta abajo.</div>';
                }
            })
            .catch(() => container.innerHTML = '<div class="text-center text-slate-400 text-xs py-2">Sin mensajes previos.</div>');
    } else {
        container.innerHTML = '<div class="text-center text-slate-400 text-xs py-2">Puedes enviar un mensaje directo al equipo de soporte de Agendatina.</div>';
    }

    const content = document.getElementById('modalSoporteHiloClienteContent');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        content.classList.remove('scale-95');
    }, 10);
};

window.cerrarHiloSoporteCliente = function() {
    const modal = document.getElementById('modalSoporteHiloCliente');
    if (!modal) return;
    const content = document.getElementById('modalSoporteHiloClienteContent');
    modal.classList.add('opacity-0');
    content.classList.add('scale-95');
    setTimeout(() => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }, 300);
};

window.enviarRespuestaClienteSoporte = function(e) {
    e.preventDefault();
    const idReporte = document.getElementById('hiloClienteReporteId').value;
    const mensaje = document.getElementById('hiloClienteTextarea').value;
    const btn = document.getElementById('btnEnviarClienteSoporte');
    
    if (!mensaje.trim()) return;

    btn.disabled = true;
    btn.innerHTML = '<span class="material-symbols-outlined animate-spin text-[16px]">refresh</span> Enviando...';

    const formData = new FormData();
    formData.append('action', 'responder_cliente');
    formData.append('id_reporte', idReporte);
    formData.append('mensaje', mensaje);

    const csrfToken = document.cookie.match(/csrf_token=([^;]+)/)?.[1];
    if (csrfToken) formData.append('csrf_token', csrfToken);

    fetch('backend/enviar_soporte.php', { method: 'POST', body: formData })
        .then(r => r.json())
        .then(d => {
            btn.disabled = false;
            btn.innerHTML = '<span class="material-symbols-outlined text-[16px]">send</span> Enviar Respuesta';
            if (d.success) {
                document.getElementById('hiloClienteTextarea').value = '';
                if (idReporte) {
                    window.abrirHiloSoporteCliente(idReporte);
                } else {
                    window.cerrarHiloSoporteCliente();
                    alert('Tu mensaje fue enviado a Soporte correctamente.');
                }
            } else {
                alert(d.error || 'Error al enviar respuesta.');
            }
        })
        .catch(() => {
            btn.disabled = false;
            btn.innerHTML = '<span class="material-symbols-outlined text-[16px]">send</span> Enviar Respuesta';
            alert('Error de conexión con el servidor.');
        });
};