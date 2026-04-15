// backend/js/ajustes.js

function loadAdminWebConfig() {
    fetch(`backend/guardar_web.php`)
        .then(res => res.json())
        .then(data => {
            if (data && !data.error) {
                if (document.getElementById('colorPrimarioInput')) document.getElementById('colorPrimarioInput').value = data.color_primario_web || data.color_primario || '#3b82f6';
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
        color_primario_web: document.getElementById('colorPrimarioInput')?.value || '#3b82f6',
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
            if (typeof applyWebCustomization === 'function') {
                applyWebCustomization();
            }
        } else {
            showToast(data.error || 'Error al guardar la configuración.', 'error');
        }
    })
    .catch(err => console.error('Error:', err))
    .finally(() => { if (submitBtn) submitBtn.innerHTML = originalText; });
}

function openScheduleModal() {
    const modal = document.getElementById('scheduleModal');
    const content = document.getElementById('scheduleModalContent');
    if (!modal || !content) return;
    
    const selectA = document.getElementById('horaApertura');
    const selectC = document.getElementById('horaCierre');
    selectA.innerHTML = ''; selectC.innerHTML = '';
    for(let i=0; i<=23; i++) {
        const val = i.toString().padStart(2, '0') + ':00';
        selectA.innerHTML += `<option value="${val}">${val}</option>`;
        selectC.innerHTML += `<option value="${val}">${val}</option>`;
    }
    
    if (window.businessWebConfig) {
        selectA.value = window.businessWebConfig.hora_apertura ? window.businessWebConfig.hora_apertura.substring(0, 5) : '09:00';
        selectC.value = window.businessWebConfig.hora_cierre ? window.businessWebConfig.hora_cierre.substring(0, 5) : '18:00';
    } else {
        selectA.value = '09:00'; selectC.value = '18:00';
    }

    modal.classList.remove('hidden');
    setTimeout(() => { modal.classList.remove('opacity-0'); content.classList.remove('scale-95'); }, 10);
}

function closeScheduleModal() {
    const modal = document.getElementById('scheduleModal');
    const content = document.getElementById('scheduleModalContent');
    if (!modal || !content) return;
    modal.classList.add('opacity-0');
    content.classList.add('scale-95');
    setTimeout(() => { modal.classList.add('hidden'); }, 300);
}

function applyCalendarConfigToForm(c) {
    if (!c) return;
    if(document.getElementById('configColorPrimario')) document.getElementById('configColorPrimario').value = c.color_primario || '#ec135b';
    if(document.getElementById('configColorSecundario')) document.getElementById('configColorSecundario').value = c.color_secundario || '#fce7f3';
    const ha = c.hora_apertura ? c.hora_apertura.substring(0, 5) : '09:00';
    const hc = c.hora_cierre ? c.hora_cierre.substring(0, 5) : '18:00';
    if(document.getElementById('configHoraApertura')) document.getElementById('configHoraApertura').value = ha;
    if(document.getElementById('configHoraCierre')) document.getElementById('configHoraCierre').value = hc;
    if(document.getElementById('configHoraDescansoInicio')) document.getElementById('configHoraDescansoInicio').value = c.hora_descanso_inicio ? c.hora_descanso_inicio.substring(0, 5) : '';
    if(document.getElementById('configHoraDescansoFin')) document.getElementById('configHoraDescansoFin').value = c.hora_descanso_fin ? c.hora_descanso_fin.substring(0, 5) : '';
    if(document.getElementById('configSimultaneos')) document.getElementById('configSimultaneos').value = c.turnos_simultaneos || 'no';
    if(document.getElementById('configAnticipacionMin')) document.getElementById('configAnticipacionMin').value = parseInt(c.anticipacion_turno_min || 0, 10);
}

document.addEventListener('DOMContentLoaded', () => {
    loadAdminWebConfig();
    const form = document.getElementById('calendarConfigForm');
    if (form) form.addEventListener('submit', handleWebConfigSubmit);
});