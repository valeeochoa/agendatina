// backend/js/ajustes.js

document.addEventListener('DOMContentLoaded', () => {
    // Verificar sesión y mostrar badge si es Demo
    fetch('backend/perfil.php')
        .then(res => res.json())
        .then(data => {
            if (data && data.success && data.business) {
                const isDemo = (data.business.is_demo === true) || (data.user && data.user.email === 'demo@agendatina.site') || (data.business.ruta === 'demo');
                const badge = document.getElementById('adminSessionBadge');
                const badgeText = document.getElementById('adminSessionBadgeText');
                if (badge && isDemo) {
                    badge.classList.remove('hidden');
                    badge.classList.add('flex');
                    if (badgeText) badgeText.textContent = 'Modo Demo';
                }
            }
        }).catch(() => {});

    // Cargar la configuración actual cuando la página carga
    fetch(`backend/guardar_web.php`)
        .then(res => res.json())
        .then(data => {
            if (data && !data.error) {
                // Guardar la configuración para usarla en otros modales si es necesario
                window.businessWebConfig = data;

                if (data.horarios_detallados_json) {
                    const hInp = document.getElementById('horariosDetalladosJsonInput');
                    if (hInp) hInp.value = data.horarios_detallados_json;
                }

                // Poblar el formulario con los datos cargados
                if (typeof applyCalendarConfigToForm === 'function') {
                    applyCalendarConfigToForm(data);
                }
                if (typeof window.renderHorariosDetalladosResumen === 'function') {
                    window.renderHorariosDetalladosResumen();
                }
            }
        })
        .catch(err => console.error('Error al cargar la configuración inicial:', err));

    // Manejar el envío del formulario de configuración del calendario
    const form = document.getElementById('calendarConfigForm');
    if (form) {
        form.addEventListener('submit', handleCalendarConfigSubmit);
    }
    
    // Inicializar estado del ayuda del intervalo de turnos
    if (typeof window.updateIntervalHelpText === 'function') {
        window.updateIntervalHelpText();
    }
});

window.updateIntervalHelpText = function() {
    const select = document.getElementById('configIntervalo');
    const customDiv = document.getElementById('divIntervaloCustom');
    const helpText = document.getElementById('intervaloHelpText');
    if (!select) return;

    const val = select.value;

    if (val === 'custom') {
        if (customDiv) customDiv.classList.remove('hidden');
        if (helpText) {
            helpText.innerHTML = `<strong>Modo Personalizado:</strong> Ingresa la cantidad exacta de minutos entre cada turno. Por ejemplo: si ingresas 20, en tu web se mostrarán horarios cada 20 minutos (10:00, 10:20, 10:40...).`;
        }
    } else {
        if (customDiv) customDiv.classList.add('hidden');
        
        if (val === 'servicio') {
            if (helpText) {
                helpText.innerHTML = `<strong>Según la Duración del Servicio:</strong> Las opciones de horarios se calcularán dinámicamente según el tiempo que dura el servicio seleccionado por el cliente (Ej: Si el servicio dura 45 min, los horarios serán 10:00, 10:45, 11:30...).`;
            }
        } else {
            const mins = parseInt(val) || 30;
            let t2 = 10 * 60 + mins;
            let h2 = Math.floor(t2 / 60);
            let m2 = t2 % 60;
            let ex2 = `${h2}:${m2 < 10 ? '0' : ''}${m2}`;
            if (helpText) {
                helpText.innerHTML = `<strong>Frecuencia fija de ${mins} minutos:</strong> En tu web pública figurarán bloques de horarios cada ${mins} minutos (Ej: 10:00, ${ex2}, ...).`;
            }
        }
    }
};

/* =========================================================================
   LÓGICA DE HORARIOS PERSONALIZADOS POR DÍA (LUNES A DOMINGO - FORMATO 24HS)
   ========================================================================= */
let currentHorariosDetallados = {};

const DIAS_SEMANA_MAP = [
    { key: '1', nombre: 'Lunes' },
    { key: '2', nombre: 'Martes' },
    { key: '3', nombre: 'Miércoles' },
    { key: '4', nombre: 'Jueves' },
    { key: '5', nombre: 'Viernes' },
    { key: '6', nombre: 'Sábado' },
    { key: '0', nombre: 'Domingo' }
];

window.openHorariosDetalladosModal = function() {
    const rawVal = document.getElementById('horariosDetalladosJsonInput')?.value || '{}';
    try {
        currentHorariosDetallados = JSON.parse(rawVal);
    } catch(e) {
        currentHorariosDetallados = {};
    }

    renderDiasHorariosContainer();

    const modal = document.getElementById('modalHorariosDetallados');
    if (modal) modal.classList.remove('hidden');
};

window.closeHorariosDetalladosModal = function() {
    const modal = document.getElementById('modalHorariosDetallados');
    if (modal) modal.classList.add('hidden');
};

function renderDiasHorariosContainer() {
    const container = document.getElementById('diasHorariosContainer');
    if (!container) return;

    const defaultApertura = document.getElementById('configHoraApertura')?.value || '09:00';
    const defaultCierre = document.getElementById('configHoraCierre')?.value || '18:00';

    container.innerHTML = '';

    DIAS_SEMANA_MAP.forEach(dia => {
        const diaData = currentHorariosDetallados[dia.key] || { activo: true, tramos: [{ inicio: defaultApertura, fin: defaultCierre }] };
        const activo = diaData.activo !== false;
        const tramos = (diaData.tramos && diaData.tramos.length > 0) ? diaData.tramos : [{ inicio: defaultApertura, fin: defaultCierre }];

        let tramosHtml = '';
        tramos.forEach((t, idx) => {
            tramosHtml += `
                <div class="flex items-center gap-2 bg-slate-50 p-2.5 rounded-2xl border border-slate-200/80">
                    <span class="text-xs font-extrabold text-slate-500">Tramo ${idx + 1}:</span>
                    <input type="time" value="${t.inicio || '09:00'}" data-day="${dia.key}" data-idx="${idx}" data-field="inicio" class="tramo-input w-28 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs sm:text-sm font-bold text-slate-800 focus:ring-2 focus:ring-purple-500 outline-none" title="Formato 24hs: 10:00 (10 hs mañana) vs 22:00 (10 hs noche)">
                    <span class="text-xs font-bold text-slate-400">a</span>
                    <input type="time" value="${t.fin || '18:00'}" data-day="${dia.key}" data-idx="${idx}" data-field="fin" class="tramo-input w-28 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs sm:text-sm font-bold text-slate-800 focus:ring-2 focus:ring-purple-500 outline-none" title="Formato 24hs: 12:00 (mediodía) vs 20:00 (8 hs noche)">
                    ${tramos.length > 1 ? `
                        <button type="button" onclick="removeTramoHorario('${dia.key}', ${idx})" class="text-red-400 hover:text-red-600 p-1 rounded-lg hover:bg-red-50 transition-colors" title="Eliminar tramo">
                            <span class="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                    ` : ''}
                </div>
            `;
        });

        container.innerHTML += `
            <div class="p-4 rounded-2xl border ${activo ? 'border-slate-200 bg-white' : 'border-slate-200/60 bg-slate-50/50'} transition-all">
                <div class="flex items-center justify-between gap-3 mb-3">
                    <div class="flex items-center gap-2.5">
                        <input type="checkbox" id="checkDia_${dia.key}" ${activo ? 'checked' : ''} onchange="toggleDiaActivo('${dia.key}', this.checked)" class="w-5 h-5 text-purple-600 focus:ring-purple-500 rounded border-slate-300 cursor-pointer">
                        <label for="checkDia_${dia.key}" class="font-extrabold text-sm sm:text-base text-slate-800 cursor-pointer">${dia.nombre}</label>
                        <span class="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full ${activo ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-slate-200 text-slate-500'}">
                            ${activo ? 'Abierto' : 'Cerrado'}
                        </span>
                    </div>

                    ${activo ? `
                        <button type="button" onclick="addTramoHorario('${dia.key}')" class="text-xs font-extrabold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 px-3 py-1.5 rounded-xl transition-all flex items-center gap-1 shadow-xs">
                            <span class="material-symbols-outlined text-[16px]">add_circle</span>
                            <span>Agregar Tramo (+)</span>
                        </button>
                    ` : ''}
                </div>

                ${activo ? `
                    <div class="flex flex-wrap gap-2.5 items-center">
                        ${tramosHtml}
                    </div>
                ` : '<p class="text-xs text-slate-400 font-medium italic">Este día permanecerá cerrado (Sin atención).</p>'}
            </div>
        `;
    });
}

window.toggleDiaActivo = function(dayKey, isChecked) {
    if (!currentHorariosDetallados[dayKey]) {
        const defaultApertura = document.getElementById('configHoraApertura')?.value || '09:00';
        const defaultCierre = document.getElementById('configHoraCierre')?.value || '18:00';
        currentHorariosDetallados[dayKey] = { activo: isChecked, tramos: [{ inicio: defaultApertura, fin: defaultCierre }] };
    } else {
        currentHorariosDetallados[dayKey].activo = isChecked;
    }
    renderDiasHorariosContainer();
};

window.addTramoHorario = function(dayKey) {
    if (!currentHorariosDetallados[dayKey]) {
        currentHorariosDetallados[dayKey] = { activo: true, tramos: [] };
    }
    if (!currentHorariosDetallados[dayKey].tramos) {
        currentHorariosDetallados[dayKey].tramos = [];
    }
    currentHorariosDetallados[dayKey].tramos.push({ inicio: '14:00', fin: '18:00' });
    renderDiasHorariosContainer();
};

window.removeTramoHorario = function(dayKey, idx) {
    if (currentHorariosDetallados[dayKey] && currentHorariosDetallados[dayKey].tramos) {
        currentHorariosDetallados[dayKey].tramos.splice(idx, 1);
        renderDiasHorariosContainer();
    }
};

window.renderHorariosDetalladosResumen = function() {
    const hiddenInp = document.getElementById('horariosDetalladosJsonInput');
    const container = document.getElementById('horariosDetalladosResumenContainer');
    if (!hiddenInp || !container) return;

    let data = {};
    try {
        data = JSON.parse(hiddenInp.value || '{}');
    } catch(e) {
        data = {};
    }

    const dayKeys = Object.keys(data);
    if (dayKeys.length === 0) {
        container.classList.add('hidden');
        return;
    }

    let hasCustom = false;
    let summaryCardsHtml = '';
    const activeDaysArr = [];

    DIAS_SEMANA_MAP.forEach(dia => {
        const diaData = data[dia.key];
        if (diaData) {
            hasCustom = true;
            const activo = diaData.activo !== false;
            if (activo) activeDaysArr.push(dia.key);

            let tramosText = '';
            if (activo && diaData.tramos && diaData.tramos.length > 0) {
                tramosText = diaData.tramos.map(t => `${t.inicio || '09:00'} - ${t.fin || '18:00'}`).join(' / ');
            }

            summaryCardsHtml += `
                <div class="flex items-center justify-between p-2.5 bg-white rounded-xl border border-purple-100 shadow-2xs">
                    <div class="flex items-center gap-2">
                        <span class="w-2 h-2 rounded-full ${activo ? 'bg-emerald-500' : 'bg-slate-300'}"></span>
                        <strong class="text-xs text-slate-800 font-bold">${dia.nombre}</strong>
                    </div>
                    <span class="text-xs ${activo ? 'text-purple-900 font-bold' : 'text-slate-400 italic'}">
                        ${activo ? (tramosText || 'Abierto') : 'Cerrado'}
                    </span>
                </div>
            `;
        }
    });

    if (!hasCustom) {
        container.classList.add('hidden');
        return;
    }

    container.innerHTML = `
        <div class="flex items-center justify-between gap-3 mb-3">
            <div class="flex items-center gap-2">
                <span class="material-symbols-outlined text-purple-600 text-[20px]">tune</span>
                <strong class="text-xs sm:text-sm font-extrabold text-purple-950">Horarios Personalizados Configurados (Lunes a Domingo)</strong>
            </div>
            <span class="text-[10px] font-black uppercase bg-purple-600 text-white px-2.5 py-1 rounded-full shadow-xs">Activos</span>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            ${summaryCardsHtml}
        </div>
    `;
    container.classList.remove('hidden');

    // Sincronizar checkboxes de días laborables en la pantalla principal
    if (activeDaysArr.length > 0) {
        document.querySelectorAll('input[name="dias_trabajo"]').forEach(cb => {
            cb.checked = activeDaysArr.includes(cb.value);
        });
    }
};

window.saveHorariosDetalladosModal = function() {
    // Recopilar tramos actualizados desde los inputs
    const tramoInputs = document.querySelectorAll('.tramo-input');
    tramoInputs.forEach(inp => {
        const day = inp.dataset.day;
        const idx = parseInt(inp.dataset.idx);
        const field = inp.dataset.field;
        if (currentHorariosDetallados[day] && currentHorariosDetallados[day].tramos && currentHorariosDetallados[day].tramos[idx]) {
            currentHorariosDetallados[day].tramos[idx][field] = inp.value;
        }
    });

    const jsonStr = JSON.stringify(currentHorariosDetallados);
    const hiddenInp = document.getElementById('horariosDetalladosJsonInput');
    if (hiddenInp) hiddenInp.value = jsonStr;

    if (typeof window.renderHorariosDetalladosResumen === 'function') {
        window.renderHorariosDetalladosResumen();
    }

    if (typeof showToast === 'function') showToast('Horarios personalizados listos para guardar.', 'success');
    closeHorariosDetalladosModal();
};

function handleCalendarConfigSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn ? submitBtn.innerHTML : 'Guardar Cambios';
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = 'Guardando...';
    }

    // Recolectar días de trabajo (checkboxes)
    const diasTrabajo = Array.from(form.querySelectorAll('input[name="dias_trabajo"]:checked')).map(cb => cb.value).join(',');

    // Recolectar tipo de calendario (radio)
    const tipoCalendarioRadio = form.querySelector('input[name="tipo_calendario"]:checked');
    const tipoCalendario = tipoCalendarioRadio ? tipoCalendarioRadio.value : 'clasico';

    // Recolectar intervalo, manejando el caso "custom"
    let intervalo = form.querySelector('#configIntervalo')?.value;
    if (intervalo === 'custom') {
        intervalo = form.querySelector('#inputIntervaloCustom')?.value || 30;
    }

    const payload = {
        color_primario: form.querySelector('#configColorPrimario')?.value,
        color_secundario: form.querySelector('#configColorSecundario')?.value,
        hora_apertura: form.querySelector('#configHoraApertura')?.value,
        hora_cierre: form.querySelector('#configHoraCierre')?.value,
        hora_descanso_inicio: form.querySelector('#configHoraDescansoInicio')?.value,
        hora_descanso_fin: form.querySelector('#configHoraDescansoFin')?.value,
        dias_trabajo: diasTrabajo,
        turnos_simultaneos: form.querySelector('#configSimultaneos')?.value,
        confirmacion_automatica: form.querySelector('#configConfirmacionAutomatica')?.value,
        anticipacion_turno_min: form.querySelector('#configAnticipacionMin')?.value,
        intervalo_turnos: intervalo,
        tipo_calendario: tipoCalendario,
        limite_eliminacion_dias: form.querySelector('#configLimiteEliminacion')?.value || 0,
        horarios_detallados_json: form.querySelector('#horariosDetalladosJsonInput')?.value || '{}'
    };

    fetch('backend/guardar_web.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            if (typeof showToast === 'function') showToast('Configuración del calendario guardada con éxito.', 'success');
            // Actualizar la configuración global para que otros scripts la usen
            window.businessWebConfig = { ...window.businessWebConfig, ...payload };
        } else {
            if (typeof showToast === 'function') showToast(data.error || 'Error al guardar la configuración.', 'error');
        }
    })
    .catch(err => {
        console.error('Error:', err);
        if (typeof showToast === 'function') showToast('Error de conexión al guardar.', 'error');
    })
    .finally(() => {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        }
    });
}