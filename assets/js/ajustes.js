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
                // Poblar el formulario con los datos cargados
                if (typeof applyCalendarConfigToForm === 'function') {
                    applyCalendarConfigToForm(data);
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
   FUNCIONES DE WHATSAPP (MODULO RESERVADO PARA IMPLEMENTACION FUTURA)
   =========================================================================
window.generarWaQr = function() {
    const container = document.getElementById('waQrContainer');
    const status = document.getElementById('waQrStatus');
    const badge = document.getElementById('waStatusBadge');
    if (!container) return;

    container.innerHTML = '<span class="material-symbols-outlined text-4xl animate-spin text-emerald-600">refresh</span><p class="text-xs text-slate-500 mt-2 font-medium">Generando código QR...</p>';
    if (status) status.textContent = 'Estado: Generando código QR dinámico...';

    setTimeout(() => {
        const qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=AGENDATINA_WA_SESSION_' + Math.random().toString(36).substring(2, 10);
        container.innerHTML = `<img src="${qrUrl}" alt="Código QR WhatsApp" class="w-full h-full object-contain animate-fade-in">`;
        if (status) status.textContent = 'Estado: Escanea este QR con tu teléfono';
        if (badge) {
            badge.className = 'bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold border border-blue-200 flex items-center gap-1';
            badge.innerHTML = '<span class="w-2 h-2 rounded-full bg-blue-500 animate-ping"></span> Esperando Escaneo';
        }
    }, 1000);
};
*/



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
        limite_eliminacion_dias: form.querySelector('#configLimiteEliminacion')?.value || 0
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