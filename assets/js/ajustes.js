// backend/js/ajustes.js

document.addEventListener('DOMContentLoaded', () => {
    // Verificar sesión y mostrar badge si es Demo
    fetch('backend/perfil.php')
        .then(res => res.json())
        .then(data => {
            if (!data || !data.success || !data.business) {
                return;
            }
            if (data && data.success && data.business) {
                const isDemo = (data.business.is_demo === true) || (data.user && data.user.email === 'demo@agendatina.site') || (data.business.ruta === 'demo');
                window.isDemoAccount = isDemo;
                const badge = document.getElementById('adminSessionBadge');
                const badgeText = document.getElementById('adminSessionBadgeText');
                if (badge && isDemo) {
                    badge.classList.remove('hidden');
                    badge.classList.add('flex');
                    if (badgeText) badgeText.textContent = 'Modo Demo';
                }
                if (isDemo) {
                    const inpTrans = document.getElementById('configDatosTransferencia');
                    const demoWarn = document.getElementById('demoAliasWarning');
                    if (inpTrans) {
                        inpTrans.disabled = true;
                        inpTrans.title = "🔒 En Modo Demo no se permite modificar ni ingresar datos de transferencia bancaria.";
                        inpTrans.classList.add('bg-slate-100', 'cursor-not-allowed', 'opacity-70');
                    }
                    if (demoWarn) {
                        demoWarn.classList.remove('hidden');
                        demoWarn.classList.add('flex');
                    }
                }
            }
        }).catch(() => {
            if (sessionStorage.getItem('is_demo_user') === 'true' && !sessionStorage.getItem('demo_retry_attempted')) {
                sessionStorage.setItem('demo_retry_attempted', 'true');
                window.location.href = 'demo.php';
            } else {
                sessionStorage.removeItem('is_demo_user');
                sessionStorage.removeItem('demo_retry_attempted');
                window.location.href = 'login.html';
            }
        });

    // Cargar la configuración actual cuando la página carga
    fetch(`backend/guardar_web.php`)
        .then(res => res.json())
        .then(data => {
            if (data && !data.error) {
                // Guardar la configuración para usarla en otros modales si es necesario
                window.businessWebConfig = data;

                if (data.color_primario || data.color_secundario || data.colores_extra_json) {
                    if (typeof window.applyUserCustomColors === 'function') {
                        window.applyUserCustomColors(data.color_primario, data.color_secundario, data.colores_extra_json);
                    }
                }

                const isDegradeActive = (data.usar_fondo_degrade == 1 || data.usar_fondo_degrade === '1' || data.usar_fondo_degrade === true);
                if (isDegradeActive) {
                    document.body.setAttribute('data-degrade', '1');
                    document.body.classList.add('calendar-degrade-active');
                } else {
                    document.body.removeAttribute('data-degrade');
                    document.body.classList.remove('calendar-degrade-active');
                }

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

    // Escuchar cambios en vivo del checkbox de Fondo Degradé
    const degradeCheckbox = document.getElementById('configFondoDegrade');
    if (degradeCheckbox) {
        degradeCheckbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                document.body.setAttribute('data-degrade', '1');
                document.body.classList.add('calendar-degrade-active');
            } else {
                document.body.removeAttribute('data-degrade');
                document.body.classList.remove('calendar-degrade-active');
            }
        });
    }

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

window.updateConfirmacionHelpText = function() {
    const select = document.getElementById('configConfirmacionAutomatica');
    const helpText = document.getElementById('confirmacionAutomaticaHelpText');
    if (!select || !helpText) return;

    const val = String(select.value);
    if (val === 'si' || val === '1' || val === 'true') {
        helpText.innerHTML = `<strong>⚡ Aprobación Automática:</strong> Cuando el cliente solicita la reserva desde tu web pública, el turno queda <span class="text-emerald-700 font-bold">Confirmado inmediatamente</span> en tu agenda sin requerir aprobación manual.`;
    } else {
        helpText.innerHTML = `<strong>⌛ Aprobación Manual desde la Web:</strong> La solicitud del cliente ingresa en estado <span class="text-amber-700 font-bold">Pendiente</span>. Recibirás la notificación en tu panel para que hagas clic en <strong>Aprobar</strong> o <strong>Rechazar</strong>.`;
    }
};

window.applyCalendarConfigToForm = function(data) {
    if (!data) return;
    const form = document.getElementById('calendarConfigForm');
    if (!form) return;

    if (data.tipo_calendario) {
        const rad = form.querySelector(`input[name="tipo_calendario"][value="${data.tipo_calendario}"]`);
        if (rad) rad.checked = true;
    }

    if (data.usar_fondo_degrade !== undefined) {
        const chkDegrade = form.querySelector('#configFondoDegrade');
        if (chkDegrade) chkDegrade.checked = (data.usar_fondo_degrade == 1 || data.usar_fondo_degrade === '1' || data.usar_fondo_degrade === true);
    }

    if (data.primer_dia_semana !== undefined) {
        const selectPrimerDia = form.querySelector('#configPrimerDiaSemana');
        if (selectPrimerDia) selectPrimerDia.value = String(data.primer_dia_semana);
    }

    if (data.hora_apertura) form.querySelector('#configHoraApertura').value = data.hora_apertura;
    if (data.hora_cierre) form.querySelector('#configHoraCierre').value = data.hora_cierre;
    if (data.hora_descanso_inicio !== undefined) form.querySelector('#configHoraDescansoInicio').value = data.hora_descanso_inicio || '';
    if (data.hora_descanso_fin !== undefined) form.querySelector('#configHoraDescansoFin').value = data.hora_descanso_fin || '';

    if (data.dias_trabajo !== undefined) {
        const diasArr = (typeof data.dias_trabajo === 'string') ? data.dias_trabajo.split(',') : (data.dias_trabajo || []);
        form.querySelectorAll('input[name="dias_trabajo"]').forEach(cb => {
            cb.checked = diasArr.includes(cb.value);
        });
    }

    if (data.turnos_simultaneos) form.querySelector('#configSimultaneos').value = data.turnos_simultaneos;
    
    if (data.confirmacion_automatica !== undefined) {
        const confVal = (data.confirmacion_automatica == 1 || data.confirmacion_automatica === '1' || data.confirmacion_automatica === 'si') ? 'si' : 'no';
        const selectConf = form.querySelector('#configConfirmacionAutomatica');
        if (selectConf) {
            selectConf.value = confVal;
            window.updateConfirmacionHelpText();
        }
    }

    if (data.anticipacion_turno_min !== undefined) {
        const totalMin = parseInt(data.anticipacion_turno_min) || 0;
        const h = Math.floor(totalMin / 60);
        const m = totalMin % 60;
        if (form.querySelector('#configAnticipacionH')) form.querySelector('#configAnticipacionH').value = h || '';
        if (form.querySelector('#configAnticipacionM')) form.querySelector('#configAnticipacionM').value = m || '';
        if (form.querySelector('#configAnticipacionMin')) form.querySelector('#configAnticipacionMin').value = totalMin;
    }

    if (data.intervalo_turnos) {
        const selectInter = form.querySelector('#configIntervalo');
        if (selectInter) {
            const knownVals = ['servicio', '15', '30', '45', '60', '90', '120'];
            if (knownVals.includes(String(data.intervalo_turnos))) {
                selectInter.value = String(data.intervalo_turnos);
            } else {
                selectInter.value = 'custom';
                const customInp = form.querySelector('#inputIntervaloCustom');
                if (customInp) customInp.value = data.intervalo_turnos;
            }
            window.updateIntervalHelpText();
        }
    }

    if (data.limite_eliminacion_dias !== undefined) {
        const selectElim = form.querySelector('#configLimiteEliminacion');
        if (selectElim) selectElim.value = String(data.limite_eliminacion_dias);
    }

    if (data.datos_transferencia !== undefined) {
        const inpDatos = form.querySelector('#configDatosTransferencia');
        if (inpDatos) inpDatos.value = data.datos_transferencia || '';
    }

    if (data.porcentaje_sena !== undefined) {
        const inpSena = form.querySelector('#configPorcentajeSena');
        if (inpSena) {
            inpSena.value = data.porcentaje_sena || 100;
            window.updateSenaHelpText();
        }
    }

    if (data.metodos_pago !== undefined) {
        const metodosArr = (typeof data.metodos_pago === 'string') ? data.metodos_pago.split(',') : (data.metodos_pago || []);
        form.querySelectorAll('input[name="metodos_pago_arr"]').forEach(cb => {
            cb.checked = metodosArr.includes(cb.value);
        });
        window.toggleMetodosPagoDetails();
    }
};

window.toggleMetodosPagoDetails = function() {
    const chkTrans = document.getElementById('chkTransferencia');
    const divTrans = document.getElementById('divDetallesTransferencia');
    if (chkTrans && divTrans) {
        divTrans.classList.toggle('hidden', !chkTrans.checked);
    }

    const chkMp = document.getElementById('chkMercadoPago');
    const divMp = document.getElementById('divDetallesMercadoPago');
    if (chkMp && divMp) {
        divMp.classList.toggle('hidden', !chkMp.checked);
    }
};

window.updateSenaHelpText = function() {
    const inpSena = document.getElementById('configPorcentajeSena');
    const helpText = document.getElementById('senaHelpText');
    const helpBadge = document.getElementById('senaHelpBadge');
    if (!inpSena || !helpText) return;

    let val = parseInt(inpSena.value) || 100;
    if (val < 1) val = 1;
    if (val > 100) val = 100;
    inpSena.value = val;

    if (val === 100) {
        if (helpBadge) helpBadge.className = 'text-xs p-3 rounded-xl border leading-relaxed font-bold transition-all bg-emerald-50 text-emerald-800 border-emerald-200/80 flex items-start gap-2';
        helpText.innerHTML = '⚡ <strong>Seña del 100%:</strong> Significa que no se exige sólo una reserva parcial, sino que abonen el total del producto o servicio vía Mercado Pago para confirmar el turno.';
    } else {
        if (helpBadge) helpBadge.className = 'text-xs p-3 rounded-xl border leading-relaxed font-bold transition-all bg-purple-50 text-purple-900 border-purple-200/80 flex items-start gap-2';
        helpText.innerHTML = `⌛ <strong>Seña del ${val}%:</strong> El cliente abonará un <strong>${val}%</strong> vía Mercado Pago como seña para reservar el turno, y el saldo restante lo abonará en el local.`;
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

function showModalHorariosErrorMsg(msg) {
    const errorBox = document.getElementById('modalHorariosErrorMsg');
    const errorText = document.getElementById('modalHorariosErrorMsgText');
    if (errorBox && errorText) {
        errorText.textContent = msg;
        errorBox.classList.remove('hidden');
        errorBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    if (typeof showToast === 'function') {
        showToast(msg, 'error');
    }
}

function clearModalHorariosErrorMsg() {
    const errorBox = document.getElementById('modalHorariosErrorMsg');
    if (errorBox) errorBox.classList.add('hidden');
}

window.validateHorariosDetalladosLive = function() {
    syncTramoInputsFromDom();
    for (const dia of DIAS_SEMANA_MAP) {
        const diaData = currentHorariosDetallados[dia.key];
        if (diaData && diaData.activo !== false && diaData.tramos && diaData.tramos.length > 0) {
            for (let i = 0; i < diaData.tramos.length; i++) {
                const t = diaData.tramos[i];
                if (t.inicio && t.fin && t.inicio >= t.fin) {
                    showModalHorariosErrorMsg(`En ${dia.nombre} (Tramo ${i + 1}): La hora de inicio (${t.inicio}) debe ser anterior a la hora de fin (${t.fin}).`);
                    return false;
                }
            }

            const tramosOrdenados = [...diaData.tramos].sort((a, b) => (a.inicio || '').localeCompare(b.inicio || ''));
            for (let i = 0; i < tramosOrdenados.length - 1; i++) {
                const actual = tramosOrdenados[i];
                const siguiente = tramosOrdenados[i + 1];
                if (actual.fin && siguiente.inicio && actual.fin > siguiente.inicio) {
                    showModalHorariosErrorMsg(`Superposición en ${dia.nombre}: El tramo de ${actual.inicio} a ${actual.fin} se cruza con el de ${siguiente.inicio} a ${siguiente.fin}.`);
                    return false;
                }
            }
        }
    }
    clearModalHorariosErrorMsg();
    return true;
};

window.openHorariosDetalladosModal = function() {
    clearModalHorariosErrorMsg();
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
    clearModalHorariosErrorMsg();
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
                    <span class="text-xs font-extrabold text-slate-500 shrink-0 min-w-[65px]">Tramo ${idx + 1}:</span>
                    <input type="time" value="${t.inicio || '09:00'}" data-day="${dia.key}" data-idx="${idx}" data-field="inicio" onchange="validateHorariosDetalladosLive()" class="tramo-input w-28 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs sm:text-sm font-bold text-slate-800 focus:ring-2 focus:ring-purple-500 outline-none" title="Formato 24hs: 10:00 vs 22:00">
                    <span class="text-xs font-bold text-slate-400">a</span>
                    <input type="time" value="${t.fin || '18:00'}" data-day="${dia.key}" data-idx="${idx}" data-field="fin" onchange="validateHorariosDetalladosLive()" class="tramo-input w-28 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs sm:text-sm font-bold text-slate-800 focus:ring-2 focus:ring-purple-500 outline-none" title="Formato 24hs: 12:00 vs 20:00">
                    ${tramos.length > 1 ? `
                        <button type="button" onclick="removeTramoHorario('${dia.key}', ${idx})" class="text-red-400 hover:text-red-600 p-1.5 rounded-xl hover:bg-red-50 transition-colors ml-auto flex items-center justify-center" title="Eliminar tramo">
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
                    <div class="flex flex-col gap-2">
                        ${tramosHtml}
                    </div>
                ` : '<p class="text-xs text-slate-400 font-medium italic">Este día permanecerá cerrado (Sin atención).</p>'}
            </div>
        `;
    });
}

function syncTramoInputsFromDom() {
    const tramoInputs = document.querySelectorAll('#diasHorariosContainer .tramo-input');
    tramoInputs.forEach(inp => {
        const day = inp.dataset.day;
        const idx = parseInt(inp.dataset.idx);
        const field = inp.dataset.field;
        if (day && !isNaN(idx) && field) {
            if (!currentHorariosDetallados[day]) {
                currentHorariosDetallados[day] = { activo: true, tramos: [] };
            }
            if (!currentHorariosDetallados[day].tramos[idx]) {
                currentHorariosDetallados[day].tramos[idx] = { inicio: '09:00', fin: '18:00' };
            }
            currentHorariosDetallados[day].tramos[idx][field] = inp.value;
        }
    });
}

window.toggleDiaActivo = function(dayKey, isChecked) {
    syncTramoInputsFromDom();
    if (!currentHorariosDetallados[dayKey]) {
        const defaultApertura = document.getElementById('configHoraApertura')?.value || '09:00';
        const defaultCierre = document.getElementById('configHoraCierre')?.value || '18:00';
        currentHorariosDetallados[dayKey] = { activo: isChecked, tramos: [{ inicio: defaultApertura, fin: defaultCierre }] };
    } else {
        currentHorariosDetallados[dayKey].activo = isChecked;
    }
    renderDiasHorariosContainer();
    validateHorariosDetalladosLive();
};

window.addTramoHorario = function(dayKey) {
    syncTramoInputsFromDom();
    if (!currentHorariosDetallados[dayKey]) {
        currentHorariosDetallados[dayKey] = { activo: true, tramos: [] };
    }
    if (!currentHorariosDetallados[dayKey].tramos) {
        currentHorariosDetallados[dayKey].tramos = [];
    }

    const tramosExistentes = currentHorariosDetallados[dayKey].tramos;

    if (tramosExistentes.length === 0) {
        tramosExistentes.push({ inicio: '09:00', fin: '18:00' });
    } else if (tramosExistentes.length === 1) {
        const t1 = tramosExistentes[0];
        const [hStart] = (t1.inicio || '09:00').split(':').map(Number);
        const [hEnd] = (t1.fin || '18:00').split(':').map(Number);

        if (hEnd - hStart >= 6 && hEnd > 14) {
            const originalEnd = t1.fin || '18:00';
            t1.fin = '13:00';
            const afternoonStart = '16:00';
            const afternoonEnd = (originalEnd > afternoonStart) ? originalEnd : '20:00';
            tramosExistentes.push({ inicio: afternoonStart, fin: afternoonEnd });
        } else {
            let lastFin = t1.fin || '13:00';
            let [h, m] = lastFin.split(':').map(Number);
            let nextStartH = Math.min(22, h + 1);
            let nextEndH = Math.min(23, nextStartH + 4);
            if (nextStartH >= nextEndH) nextStartH = Math.max(0, nextEndH - 1);
            tramosExistentes.push({
                inicio: `${String(nextStartH).padStart(2, '0')}:${String(m || 0).padStart(2, '0')}`,
                fin: `${String(nextEndH).padStart(2, '0')}:${String(m || 0).padStart(2, '0')}`
            });
        }
    } else {
        const lastTramo = tramosExistentes[tramosExistentes.length - 1];
        let lastFin = lastTramo.fin || '18:00';
        let [h, m] = lastFin.split(':').map(Number);
        let nextStartH = Math.min(22, h + 1);
        let nextEndH = Math.min(23, nextStartH + 4);
        if (nextStartH >= nextEndH) nextStartH = Math.max(0, nextEndH - 1);
        tramosExistentes.push({
            inicio: `${String(nextStartH).padStart(2, '0')}:${String(m || 0).padStart(2, '0')}`,
            fin: `${String(nextEndH).padStart(2, '0')}:${String(m || 0).padStart(2, '0')}`
        });
    }

    renderDiasHorariosContainer();
    validateHorariosDetalladosLive();
};

window.removeTramoHorario = function(dayKey, idx) {
    syncTramoInputsFromDom();
    if (currentHorariosDetallados[dayKey] && currentHorariosDetallados[dayKey].tramos) {
        currentHorariosDetallados[dayKey].tramos.splice(idx, 1);
        renderDiasHorariosContainer();
        validateHorariosDetalladosLive();
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

            let tramosItemsHtml = '';
            if (activo && diaData.tramos && diaData.tramos.length > 0) {
                tramosItemsHtml = diaData.tramos.map((t, idx) => `
                    <div class="flex items-center justify-between text-xs text-purple-950 font-bold bg-purple-50/70 px-2.5 py-1 rounded-lg border border-purple-100/60">
                        <span class="text-[11px] font-extrabold text-purple-600">Tramo ${idx + 1}:</span>
                        <span class="font-extrabold text-slate-800">${t.inicio || '09:00'} - ${t.fin || '18:00'} hs</span>
                    </div>
                `).join('');
            } else if (activo) {
                tramosItemsHtml = `<div class="text-xs text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded">Abierto (Horario general)</div>`;
            }

            summaryCardsHtml += `
                <div class="p-3 bg-white rounded-2xl border border-purple-200/80 shadow-xs flex flex-col justify-between gap-2">
                    <div class="flex items-center justify-between gap-2 border-b border-purple-100/80 pb-1.5">
                        <div class="flex items-center gap-2">
                            <span class="w-2.5 h-2.5 rounded-full ${activo ? 'bg-emerald-500 shadow-xs' : 'bg-slate-300'}"></span>
                            <strong class="text-xs text-slate-900 font-extrabold">${dia.nombre}</strong>
                        </div>
                        <span class="text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${activo ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60' : 'bg-slate-100 text-slate-400 border border-slate-200'}">
                            ${activo ? 'Abierto' : 'Cerrado'}
                        </span>
                    </div>
                    
                    ${activo ? `
                        <div class="space-y-1">
                            ${tramosItemsHtml}
                        </div>
                    ` : `
                        <div class="text-xs text-slate-400 font-medium italic pt-0.5">Cerrado (Sin atención)</div>
                    `}
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
    // Validar en tiempo real antes de procesar guardado
    const isValid = window.validateHorariosDetalladosLive();
    if (!isValid) return;

    const jsonStr = JSON.stringify(currentHorariosDetallados);
    const hiddenInp = document.getElementById('horariosDetalladosJsonInput');
    if (hiddenInp) hiddenInp.value = jsonStr;

    if (typeof window.renderHorariosDetalladosResumen === 'function') {
        window.renderHorariosDetalladosResumen();
    }

    if (typeof showToast === 'function') showToast('Horarios personalizados validados y listos para guardar.', 'success');
    closeHorariosDetalladosModal();
};

function handleCalendarConfigSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const submitBtns = document.querySelectorAll('button[type="submit"][form="calendarConfigForm"], #calendarConfigForm button[type="submit"]');
    submitBtns.forEach(btn => {
        btn.disabled = true;
        btn.dataset.origText = btn.innerHTML;
        btn.innerHTML = '<span class="material-symbols-outlined animate-spin text-[18px]">refresh</span> Guardando...';
    });

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

    // Recolectar métodos de pago
    const metodosArr = Array.from(form.querySelectorAll('input[name="metodos_pago_arr"]:checked')).map(cb => cb.value);
    const metodosStr = metodosArr.join(',');
    if (form.querySelector('#configMetodosPago')) form.querySelector('#configMetodosPago').value = metodosStr;

    let datosTrans = form.querySelector('#configDatosTransferencia')?.value || '';
    if (window.isDemoAccount) {
        datosTrans = window.businessWebConfig?.datos_transferencia || '';
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
        usar_fondo_degrade: form.querySelector('#configFondoDegrade')?.checked ? 1 : 0,
        limite_eliminacion_dias: form.querySelector('#configLimiteEliminacion')?.value || 0,
        horarios_detallados_json: form.querySelector('#horariosDetalladosJsonInput')?.value || '{}',
        metodos_pago: metodosStr,
        datos_transferencia: datosTrans,
        porcentaje_sena: form.querySelector('#configPorcentajeSena')?.value || 100,
        primer_dia_semana: form.querySelector('#configPrimerDiaSemana')?.value ?? 1
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
            if (payload.usar_fondo_degrade) {
                document.body.setAttribute('data-degrade', '1');
                document.body.classList.add('calendar-degrade-active');
            } else {
                document.body.removeAttribute('data-degrade');
                document.body.classList.remove('calendar-degrade-active');
            }
        } else {
            if (typeof showToast === 'function') showToast(data.error || 'Error al guardar la configuración.', 'error');
        }
    })
    .catch(err => {
        console.error('Error:', err);
        if (typeof showToast === 'function') showToast('Error de conexión al guardar.', 'error');
    })
    .finally(() => {
        submitBtns.forEach(btn => {
            btn.disabled = false;
            if (btn.dataset.origText) btn.innerHTML = btn.dataset.origText;
        });
    });
}