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
        tipo_calendario: tipoCalendario
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