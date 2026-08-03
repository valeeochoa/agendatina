// backend/js/ajustes.js

document.addEventListener('DOMContentLoaded', () => {
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
});

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
            showToast('Configuración del calendario guardada con éxito.', 'success');
            // Actualizar la configuración global para que otros scripts la usen
            window.businessWebConfig = { ...window.businessWebConfig, ...payload };
        } else {
            showToast(data.error || 'Error al guardar la configuración.', 'error');
        }
    })
    .catch(err => {
        console.error('Error:', err);
        showToast('Error de conexión al guardar.', 'error');
    })
    .finally(() => {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        }
    });
}