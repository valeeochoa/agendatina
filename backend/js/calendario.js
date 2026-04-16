// backend/js/calendario.js
const urlParams = new URLSearchParams(window.location.search);
const negocioSlug = urlParams.get('n') || '';

var globalSelectedProfessional = '';
var isPreviewMode = false;
var services = [];
var allAppointments = [];
var isAdmin = !urlParams.has('n') || sessionStorage.getItem('agendatina_session') === 'active';

let cal_currentDate = new Date();
let cal_selectedDate = null;
let cal_selectedTime = null;
let cal_availableTimes = [];
let cal_bookedSlots = {};

// Variables exclusivas calendario semanal
let weekStartDate = new Date();
weekStartDate.setHours(0,0,0,0);
let weeklySelectedService = null;
let weeklySelectedProf = null;
let cal2_selectedDate = null;
let cal2_selectedTime = null;

window.getBreakTimes = function() {
    let breakStart = window.businessWebConfig?.hora_descanso_inicio || '';
    let breakEnd = window.businessWebConfig?.hora_descanso_fin || '';
    let breaks = [];
    if (breakStart && breakEnd) {
        let current = new Date();
        let [bSH, bSM] = breakStart.split(':').map(Number);
        let [bEH, bEM] = breakEnd.split(':').map(Number);
        current.setHours(bSH, bSM, 0, 0);
        let bEndObj = new Date();
        bEndObj.setHours(bEH, bEM, 0, 0);
        while (current < bEndObj) {
            let h = current.getHours().toString().padStart(2, '0');
            let m = current.getMinutes().toString().padStart(2, '0');
            breaks.push(`${h}:${m}`);
            current.setMinutes(current.getMinutes() + 5);
        }
    }
    return breaks;
};

window.isTimeInBreak = function(timeStr) {
    let breakStart = window.businessWebConfig?.hora_descanso_inicio || '';
    let breakEnd = window.businessWebConfig?.hora_descanso_fin || '';
    if (!breakStart || !breakEnd) return false;
    let t = new Date(); let [tH, tM] = timeStr.split(':').map(Number); t.setHours(tH, tM, 0, 0);
    let bS = new Date(); let [sH, sM] = breakStart.split(':').map(Number); bS.setHours(sH, sM, 0, 0);
    let bE = new Date(); let [eH, eM] = breakEnd.split(':').map(Number); bE.setHours(eH, eM, 0, 0);
    return t >= bS && t < bE;
};

window.isWorkingDay = function(date) {
    let diasTrabajo = window.businessWebConfig?.dias_trabajo;
    if (diasTrabajo === undefined) diasTrabajo = '1,2,3,4,5,6';
    if (!diasTrabajo) return false;
    const workingDays = diasTrabajo.split(',').map(Number);
    return workingDays.includes(date.getDay());
};

function generateTimeSlots(startStr = '09:00', endStr = '18:00', interval = 30) {
    interval = parseInt(interval) || 30;
    cal_availableTimes.length = 0;
    let [startH, startM] = startStr.split(':').map(Number);
    let [endH, endM] = endStr.split(':').map(Number);

    if (isNaN(startH)) startH = 9;
    if (isNaN(startM)) startM = 0;
    if (isNaN(endH)) endH = 18;
    if (isNaN(endM)) endM = 0;

    let current = new Date();
    current.setHours(startH, startM, 0, 0);

    let end = new Date();
    end.setHours(endH, endM, 0, 0);

    while (current < end) {
        let h = current.getHours().toString().padStart(2, '0');
        let m = current.getMinutes().toString().padStart(2, '0');
        cal_availableTimes.push(`${h}:${m}`);
        current.setMinutes(current.getMinutes() + interval);
    }
}
generateTimeSlots();

function cal_fetchBookedTimes() {
    let prof = globalSelectedProfessional;
    if (!prof || prof === 'columnas') {
        const profSelect = document.getElementById('profesionalSelect');
        prof = profSelect ? profSelect.value : '';
    }

    let url = negocioSlug ? `backend/obtener_turnos_ocupados.php?n=${negocioSlug}` : `backend/obtener_turnos_ocupados.php`;
    if (prof && prof !== 'Cualquiera (Sin preferencia)' && prof !== 'Cualquiera' && prof !== 'columnas') {
        url += (url.includes('?') ? '&' : '?') + `p=${encodeURIComponent(prof)}`;
    }

    fetch(url)
    .then(res => res.json())
    .then(data => {
        cal_bookedSlots = data;
        if (cal_selectedDate) cal_renderTimeSlots();
        cal_renderCalendar();
    })
    .catch(err => console.error('Error al cargar turnos ocupados:', err));
}

function cal_renderCalendar() {
    const monthYearEl = document.getElementById('monthYear');
    if (!monthYearEl) return;

    const year = cal_currentDate.getFullYear();
    const month = cal_currentDate.getMonth();
    
    monthYearEl.textContent = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' }).format(cal_currentDate);
    
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    today.setHours(0,0,0,0);
    
    const calendarDays = document.getElementById('calendarDays');
    calendarDays.innerHTML = '';
    
    for (let i = 0; i < firstDay; i++) calendarDays.innerHTML += `<div></div>`;
    
    for (let i = 1; i <= daysInMonth; i++) {
        const date = new Date(year, month, i);
        const isPast = date < today;
        const dateString = toYYYYMMDD(date);
        const isGeneralBlock = cal_bookedSlots[dateString] && cal_bookedSlots[dateString].includes('blocked_day');
        let isProfBlock = cal_bookedSlots[dateString] && cal_bookedSlots[dateString].includes('blocked_day_prof');
        if (!globalSelectedProfessional || globalSelectedProfessional === 'columnas' || globalSelectedProfessional === 'Cualquiera (Sin preferencia)' || globalSelectedProfessional === 'Cualquiera') {
            isProfBlock = false;
        }
        const isDayBlocked = isGeneralBlock || isProfBlock;
        const isNotWorkingDay = !window.isWorkingDay(date);
        
        const effectiveIsAdmin = isAdmin && !isPreviewMode;
        const visuallyDisabled = isPast || isNotWorkingDay || isDayBlocked;
        const isClickable = effectiveIsAdmin ? !(isPast || isNotWorkingDay) : !visuallyDisabled;

        const dayDiv = document.createElement('div');
        dayDiv.textContent = i;
        dayDiv.className = `p-2 aspect-square flex items-center justify-center rounded-xl transition-all`;

        if (visuallyDisabled) {
            dayDiv.classList.add('disabled');
            if (effectiveIsAdmin && isDayBlocked && !(isPast || isNotWorkingDay)) {
                dayDiv.style.border = '2px solid #ef4444';
                dayDiv.style.color = '#ef4444';
                dayDiv.style.cursor = 'pointer';
                dayDiv.title = 'Día bloqueado (Click para gestionar)';
            } else if (!effectiveIsAdmin) {
                dayDiv.title = 'Día no disponible';
            }
        } else {
            dayDiv.classList.add('calendar-day');
        }
        
        // Multi-select / Single select styling
        if (isMultiSelectMode && selectedDates.includes(dateString)) {
            dayDiv.style.border = '2px solid var(--primary-color, #ec135b)';
            dayDiv.style.backgroundColor = 'rgba(236, 19, 91, 0.1)';
        } else if (cal_selectedDate && date.getTime() === cal_selectedDate.getTime() && !isMultiSelectMode) {
            dayDiv.classList.add('selected');
        }

        if (isClickable) dayDiv.addEventListener('click', () => handleDayClick(date));
        calendarDays.appendChild(dayDiv);
    }
}

function cal_renderTimeSlots() {
    const timeSlotsContainer = document.getElementById('timeSlots');
    if (!timeSlotsContainer) return;

    timeSlotsContainer.innerHTML = '';
    cal_selectedTime = null;
    document.getElementById('horaSeleccionada').value = '';
    
    const fechaActual = toYYYYMMDD(cal_selectedDate);
    const baseOcupadas = cal_bookedSlots[fechaActual] || [];
    const horasOcupadas = [...baseOcupadas, ...window.getBreakTimes()];
    const now = new Date();
    const selectedAtMidnight = new Date(cal_selectedDate.getFullYear(), cal_selectedDate.getMonth(), cal_selectedDate.getDate());
    const todayAtMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const isTodaySelected = selectedAtMidnight.getTime() === todayAtMidnight.getTime();
    const minAdvance = parseInt(window.businessWebConfig?.anticipacion_turno_min || 0, 10) || 0;

    let selectedDuration = 30;
    const serviceSelect = document.getElementById('serviceSelect');
    if (serviceSelect && serviceSelect.value) {
        const sName = serviceSelect.value;
        let matchingService = null;
        if (typeof globalSelectedProfessional !== 'undefined' && globalSelectedProfessional) {
            matchingService = services.find(s => s.nombre === sName && s.profesional === globalSelectedProfessional);
        }
        if (!matchingService) matchingService = services.find(s => s.nombre === sName);
        if (matchingService && matchingService.duracion) selectedDuration = parseInt(matchingService.duracion);
    }
    
    let interval = 30;
    if (window.businessWebConfig && window.businessWebConfig.intervalo_turnos) {
        if (window.businessWebConfig.intervalo_turnos === 'servicio') {
            interval = selectedDuration;
        } else {
            interval = parseInt(window.businessWebConfig.intervalo_turnos) || 30;
        }
    }
    
    generateTimeSlots(window.businessWebConfig?.hora_apertura, window.businessWebConfig?.hora_cierre, interval);

    const blocksNeeded = Math.ceil(selectedDuration / interval);

    cal_availableTimes.forEach((time, index) => {
        if (window.isTimeInBreak(time)) return; 
        const slot = document.createElement('div');
        let isBooked = false;
        const [hh, mm] = time.split(':').map(Number);
        const slotDate = new Date(cal_selectedDate.getFullYear(), cal_selectedDate.getMonth(), cal_selectedDate.getDate(), hh, mm, 0, 0);
        
        for (let i = 0; i < blocksNeeded; i++) {
            if (index + i >= cal_availableTimes.length) {
                isBooked = true; 
                break;
            }
            const timeToCheck = cal_availableTimes[index + i].substring(0, 5);
            if (horasOcupadas.includes(timeToCheck)) {
                isBooked = true;
                break;
            }
        }
        if (!isBooked && isTodaySelected && slotDate.getTime() <= now.getTime()) isBooked = true;
        if (!isBooked && minAdvance > 0) {
            const minAllowed = new Date(now.getTime() + (minAdvance * 60000));
            if (slotDate.getTime() < minAllowed.getTime()) isBooked = true;
        }
        
        slot.textContent = isBooked ? time + ' (No disponible)' : time;
        slot.className = isBooked ? 'time-slot booked text-center py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-bold opacity-50 cursor-not-allowed' : 'time-slot bg-slate-100 dark:bg-slate-900 text-center py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-bold border-slate-200 dark:border-slate-700 hover:border-primary hover:text-primary cursor-pointer transition-colors';
        
        if (!isBooked) {
            slot.addEventListener('click', () => {
                document.querySelectorAll('.time-slot').forEach(el => el.classList.remove('selected'));
                slot.classList.add('selected');
                cal_selectedTime = time;
                document.getElementById('horaSeleccionada').value = time;
            });
        }
        timeSlotsContainer.appendChild(slot);
    });
}

function cal_selectDate(date) {
    cal_selectedDate = date;
    const dateString = toYYYYMMDD(date);
    cal_renderCalendar();
    const formattedDate = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }).format(date);

    const effectiveIsAdmin = isAdmin && !isPreviewMode;
    
    const clientBookingView = document.getElementById('clientBookingView');
    const adminDayView = document.getElementById('adminDayView');
    const adminDateText = document.getElementById('adminSelectedDateText');
    const selectedDateText = document.getElementById('selectedDateText');
    const fechaSeleccionada = document.getElementById('fechaSeleccionada');
    const dayDetailsContainer = document.getElementById('dayDetailsContainer');

    if (effectiveIsAdmin) {
        if (clientBookingView) clientBookingView.classList.add('hidden');
        if (adminDayView) {
            adminDayView.classList.remove('hidden');
            adminDayView.style.background = '';
            adminDayView.style.color = '';
        }
        
        if (adminDateText) {
            adminDateText.textContent = formattedDate;
            adminDateText.style.color = '';
            adminDateText.style.textShadow = '';
        }
        
        if (typeof renderAdminDayView === 'function') renderAdminDayView(dateString);
    } else {
        if (adminDayView) adminDayView.classList.add('hidden');
        if (clientBookingView) clientBookingView.classList.remove('hidden');
        if (selectedDateText) selectedDateText.textContent = formattedDate;
        if (fechaSeleccionada) fechaSeleccionada.value = dateString;
        if (typeof cal_renderTimeSlots === 'function') cal_renderTimeSlots();
    }
    
    if (dayDetailsContainer) {
        dayDetailsContainer.classList.remove('hidden');
        const emptyState = document.getElementById('emptyState');
        if (emptyState) emptyState.classList.add('hidden');
        dayDetailsContainer.scrollIntoView({ behavior: 'smooth' });
    }
}

function fetchAllAppointments() {
    return fetch('backend/obtener_agenda.php')
        .then(res => res.json())
        .then(data => {
            allAppointments = data;
            if (isAdmin && cal_selectedDate) {
                renderAdminDayView(toYYYYMMDD(cal_selectedDate));
            }
        });
}

function renderAdminDayView(dateString) {
    const adminTimeSlots = document.getElementById('adminTimeSlots');
    const adminAppointmentsList = document.getElementById('adminAppointmentsList');
    
    if (!adminTimeSlots) return;

    // 1. Filtrar turnos del día
    let appointmentsForDay = allAppointments.filter(t => t.fecha === dateString);
    
    // Limpiamos AMBOS contenedores
    adminTimeSlots.innerHTML = '';
    if (adminAppointmentsList) adminAppointmentsList.innerHTML = '';

    const horasOcupadas = [...(cal_bookedSlots[dateString] || []), ...window.getBreakTimes()];

    // ==========================================
    // MODO COLUMNAS
    // ==========================================
    if (globalSelectedProfessional === 'columnas') {
        const uniqueProfs = [...new Set(services.map(s => s.profesional).filter(p => p && p.trim() !== ''))];
        if (uniqueProfs.length === 0) uniqueProfs.push('General');

        adminTimeSlots.className = 'flex gap-4 overflow-x-auto pb-4 custom-scrollbar';

        uniqueProfs.forEach(prof => {
            const colDiv = document.createElement('div');
            colDiv.className = 'flex-1 min-w-[220px] max-w-[300px] border border-slate-200 dark:border-slate-700 rounded-2xl p-3 bg-slate-50 dark:bg-slate-800';
            colDiv.innerHTML = `<h4 class="text-center font-bold text-slate-700 dark:text-slate-300 mb-3 border-b border-slate-200 dark:border-slate-700 pb-2 truncate" title="${prof}">👤 ${prof}</h4>`;

            const slotsDiv = document.createElement('div');
            slotsDiv.className = 'space-y-2 max-h-[350px] overflow-y-auto pr-1 custom-scrollbar';

            const profApts = appointmentsForDay.filter(a => a.profesional === prof || (prof === 'General'));
            const profSlotOwnership = {};
            const adminInterval = window.businessWebConfig?.intervalo_turnos === 'servicio' ? 30 : (parseInt(window.businessWebConfig?.intervalo_turnos) || 30);

            profApts.forEach(apt => {
                const start = apt.hora.substring(0, 5);
                const duration = parseInt(apt.duracion_minutos || apt.duracion || 30);
                const blocks = Math.ceil(duration / adminInterval);
                const startIndex = cal_availableTimes.findIndex(t => t.substring(0, 5) === start);
                if (startIndex !== -1) {
                    for (let i = 0; i < blocks; i++) {
                        if (startIndex + i < cal_availableTimes.length) {
                            profSlotOwnership[cal_availableTimes[startIndex + i].substring(0, 5)] = apt;
                        }
                    }
                }
            });

            cal_availableTimes.forEach(time => {
                if (window.isTimeInBreak(time)) return;
                const timeKey = time.substring(0, 5);
                const apt = profSlotOwnership[timeKey];
                const isBooked = horasOcupadas.includes('blocked_day') || (!apt && horasOcupadas.includes(timeKey)); 

                const slotDiv = document.createElement('div');
                slotDiv.className = 'bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-2 shadow-sm flex flex-col justify-between w-full mb-2 gap-1.5';

                if (apt) {
                    let badgeClass = 'bg-slate-100 text-slate-700';
                    let badgeText = 'Ocupado';
                    const isPend = apt.estado === 'pendiente';
                    badgeClass = isPend ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : (apt.estado === 'bloqueado' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400');
                    badgeText = isPend ? 'Pendiente' : (apt.estado === 'bloqueado' ? 'Bloqueado' : 'Confirmado');
                    const clientName = apt.cliente_nombre || (apt.nombre + ' ' + (apt.apellido || '')) || 'Sin Nombre';

                    slotDiv.innerHTML = `
                        <div class="flex justify-between items-center w-full">
                            <span class="text-sm font-bold text-slate-700 dark:text-slate-300">${time}</span>
                            <span class="${badgeClass} text-[9px] font-bold px-1.5 py-0.5 rounded uppercase">${badgeText}</span>
                        </div>
                        <div class="text-xs text-slate-600 dark:text-slate-400 font-medium truncate w-full" title="${clientName}">${clientName}</div>
                    `;
                } else if (isBooked) {
                    slotDiv.innerHTML = `
                        <div class="flex justify-between items-center w-full">
                            <span class="text-sm font-bold text-slate-400">${time}</span>
                            <span class="bg-slate-100 dark:bg-slate-800 text-slate-400 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase">Ocupado</span>
                        </div>`;
                } else {
                    slotDiv.innerHTML = `
                        <div class="flex justify-between items-center w-full">
                            <span class="text-sm font-bold text-slate-700 dark:text-slate-300">${time}</span>
                            <div class="flex items-center gap-1 shrink-0">
                                <button onclick="openManualTurnoModal('${time}', '${prof}')" class="text-primary hover:bg-primary/10 p-1.5 rounded-lg transition-colors" title="Agregar turno">
                                    <span class="material-symbols-outlined text-[16px]">add_circle</span>
                                </button>
                                <button onclick="bloquearHorario('${dateString}', '${time}', '${prof}')" class="text-slate-400 hover:text-red-500 p-1.5 rounded-lg transition-colors flex items-center justify-center" title="Bloquear horario">
                                    <span class="material-symbols-outlined text-[16px]">block</span>
                                </button>
                            </div>
                        </div>`;
                }
                slotsDiv.appendChild(slotDiv);
            });

            colDiv.appendChild(slotsDiv);
            adminTimeSlots.appendChild(colDiv);
        });

        if (adminAppointmentsList) {
            if (appointmentsForDay.length > 0) {
                adminAppointmentsList.innerHTML = `<h3 class="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4 mt-6">Todos los Turnos del Día</h3>`;
                appointmentsForDay.forEach(apt => {
                    const isPend = apt.estado === 'pendiente';
                    const border = isPend ? 'border-amber-400' : (apt.estado === 'bloqueado' ? 'border-red-400' : 'border-green-500');
                    const nombre = apt.cliente_nombre || (apt.nombre + ' ' + (apt.apellido || '')) || 'Sin Nombre';
                    const cel = apt.cliente_celular || apt.celular || '';
                    
                    adminAppointmentsList.innerHTML += `
                        <div class="bg-white dark:bg-slate-800 border-l-4 ${border} rounded-xl p-4 shadow-sm flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-r border-t border-b border-slate-100 dark:border-slate-700 mb-3">
                            <div>
                                <p class="text-xs font-bold text-slate-400 uppercase">${apt.hora} hs <span class="ml-2 text-primary bg-primary/10 px-2 py-0.5 rounded-md font-semibold">👤 ${apt.profesional || 'General'}</span></p>
                                <p class="text-base font-bold text-slate-800 dark:text-slate-100 mt-1">${nombre}</p>
                                <p class="text-xs text-slate-500">${apt.servicio || 'Bloqueo Manual'}</p>
                            </div>
                            <div class="flex gap-2">
                                ${isPend ? `<button onclick="confirmarTurnoAdmin('${apt.id}')" class="bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm transition-colors">Confirmar</button>` : ''}
                                ${apt.estado !== 'bloqueado' ? `<button onclick="contactarWhatsApp('${cel}', '${nombre}')" class="bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-600 transition-colors">WhatsApp</button>` : ''}
                                <button onclick="cancelarTurnoAdmin('${apt.id}')" class="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 px-2 py-1.5 rounded-lg transition-colors" title="Eliminar/Liberar"><span class="material-symbols-outlined text-[16px]">delete</span></button>
                            </div>
                        </div>`;
                });
            } else {
                adminAppointmentsList.innerHTML = `
                    <div class="flex flex-col items-center justify-center p-8 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 mt-6">
                        <span class="material-symbols-outlined text-3xl text-slate-300 mb-2">event_busy</span>
                        <p class="text-center text-slate-400 text-sm font-medium">No hay turnos registrados para este día.</p>
                    </div>`;
            }
        }
        return;
    }

    // ==========================================
    // MODO ESTÁNDAR
    // ==========================================
    adminTimeSlots.className = 'space-y-2 max-h-[300px] overflow-y-auto pr-2 border border-slate-800 rounded-xl p-2 custom-scrollbar';
    
    if (globalSelectedProfessional && globalSelectedProfessional !== 'Cualquiera (Sin preferencia)' && globalSelectedProfessional !== '') {
        appointmentsForDay = appointmentsForDay.filter(t => t.profesional === globalSelectedProfessional);
    }

    // 2. Mapear dueños de slots (propagación de duración)
    const slotOwnership = {};
    const adminInterval = window.businessWebConfig?.intervalo_turnos === 'servicio' ? 30 : (parseInt(window.businessWebConfig?.intervalo_turnos) || 30);
    
    appointmentsForDay.forEach(apt => {
        const start = apt.hora.substring(0, 5);
        const duration = parseInt(apt.duracion_minutos || apt.duracion || 30);
        const blocks = Math.ceil(duration / adminInterval);
        const startIndex = cal_availableTimes.findIndex(t => t.substring(0, 5) === start);
        if (startIndex !== -1) {
            for (let i = 0; i < blocks; i++) {
                if (startIndex + i < cal_availableTimes.length) {
                    slotOwnership[cal_availableTimes[startIndex + i].substring(0, 5)] = apt;
                }
            }
        }
    });

    // --- PARTE A: GRILLA DE HORARIOS (Uno debajo del otro) ---
    cal_availableTimes.forEach(time => {
        if (window.isTimeInBreak(time)) return;
        const timeKey = time.substring(0, 5);
        const isBooked = horasOcupadas.includes(timeKey);
        const apt = slotOwnership[timeKey];
        
        const slotDiv = document.createElement('div');
        // Usamos w-full y mb-2 para asegurar que estén uno debajo del otro ocupando todo el ancho
        slotDiv.className = 'bg-white rounded-xl border border-slate-200 p-3 shadow-sm flex items-center justify-between w-full mb-2';

        if (isBooked || apt) {
            let badgeClass = 'bg-slate-100 text-slate-700';
            let badgeText = 'Ocupado';
            if (apt) {
                const isPend = apt.estado === 'pendiente';
                badgeClass = isPend ? 'bg-amber-100 text-amber-700' : (apt.estado === 'bloqueado' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700');
                badgeText = isPend ? 'Pendiente' : (apt.estado === 'bloqueado' ? 'Bloqueado' : 'Confirmado');
            }
            slotDiv.innerHTML = `<span class="text-sm font-bold text-slate-700">${time}</span><span class="${badgeClass} text-[10px] font-bold px-2 py-0.5 rounded-md uppercase">${badgeText}</span>`;
        } else {
            // Se añaden clases de flex center para forzar que los botones SIEMPRE se vean
            slotDiv.innerHTML = `
                <span class="text-sm font-bold text-slate-700">${time}</span>
                <div class="flex items-center gap-3 shrink-0">
                    <button onclick="openManualTurnoModal('${time}')" class="text-primary hover:bg-primary/10 p-1.5 rounded-lg transition-colors flex items-center justify-center" title="Agregar turno">
                        <span class="material-symbols-outlined text-[20px]">add_circle</span>
                    </button>
                    <button onclick="bloquearHorario('${dateString}', '${time}')" class="text-slate-400 hover:text-red-500 p-1.5 rounded-lg transition-colors flex items-center justify-center" title="Bloquear horario">
                        <span class="material-symbols-outlined text-[20px]">block</span>
                    </button>
                </div>`;
        }
        adminTimeSlots.appendChild(slotDiv);
    });

    // --- PARTE B: LISTADO DE TURNOS (En su propio contenedor abajo) ---
    if (adminAppointmentsList) {
        if (appointmentsForDay.length > 0) {
            adminAppointmentsList.innerHTML = `<h3 class="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4">Turnos del Día</h3>`;
            
            appointmentsForDay.forEach(apt => {
                const isPend = apt.estado === 'pendiente';
                const border = isPend ? 'border-amber-400' : (apt.estado === 'bloqueado' ? 'border-red-400' : 'border-green-500');
                const nombre = apt.cliente_nombre || (apt.nombre + ' ' + (apt.apellido || '')) || 'Sin Nombre';
                const cel = apt.cliente_celular || apt.celular || '';
                
                adminAppointmentsList.innerHTML += `
                    <div class="bg-white border-l-4 ${border} rounded-xl p-4 shadow-sm flex flex-col sm:flex-row justify-between sm:items-center gap-4 border border-slate-100 mb-3">
                        <div>
                            <p class="text-xs font-bold text-slate-400 uppercase">${apt.hora} hs</p>
                            <p class="text-base font-bold text-slate-800">${nombre}</p>
                            <p class="text-xs text-slate-500">${apt.servicio || 'Bloqueo Manual'}</p>
                        </div>
                        <div class="flex gap-2">
                            ${isPend ? `<button onclick="confirmarTurnoAdmin('${apt.id}')" class="bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm transition-colors">Confirmar</button>` : ''}
                            ${apt.estado !== 'bloqueado' ? `<button onclick="contactarWhatsApp('${cel}', '${nombre}')" class="bg-slate-50 hover:bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 transition-colors">WhatsApp</button>` : ''}
                            <button onclick="cancelarTurnoAdmin('${apt.id}')" class="text-red-500 hover:bg-red-50 px-2 py-1.5 rounded-lg transition-colors" title="Eliminar/Liberar"><span class="material-symbols-outlined text-[16px]">delete</span></button>
                        </div>
                    </div>`;
            });
        } else {
            adminAppointmentsList.innerHTML = `
                <div class="flex flex-col items-center justify-center p-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    <span class="material-symbols-outlined text-3xl text-slate-300 mb-2">event_busy</span>
                    <p class="text-center text-slate-400 text-sm font-medium">No hay turnos registrados para este día.</p>
                </div>`;
        }
    }
}

function confirmarTurnoAdmin(id) {
    showConfirm('Confirmar Turno', '¿Agendar y confirmar este turno? Aparecerá como ocupado para los clientes.', 'Confirmar', 'bg-amber-500 hover:bg-amber-600', () => {
        return fetch('backend/confirmar_turno.php', { method: 'POST', body: new URLSearchParams({id: id}) })
        .then(res => res.json())
        .then(data => {
            if(data.success) {
                showToast('Turno confirmado exitosamente', 'success');
                fetchAllAppointments(); 
                cal_fetchBookedTimes(); 
            } else {
                showToast(data.error || 'No se pudo confirmar el turno.', 'error');
            }
        }).catch(() => showToast('Error de conexión', 'error'));
    });
}

function cancelarTurnoAdmin(id) {
    showConfirm('Cancelar Turno', '¿Seguro que deseas cancelar o liberar este horario?', 'Sí, Cancelar', 'bg-red-500 hover:bg-red-600', () => {
        return fetch('backend/cancelar_turno.php', { method: 'POST', body: new URLSearchParams({id: id}) })
        .then(res => res.json())
        .then(data => {
            if(data.success) {
                showToast('Horario liberado exitosamente', 'success');
                fetchAllAppointments(); 
                cal_fetchBookedTimes(); 
            } else {
                showToast(data.error || 'No se pudo cancelar el turno.', 'error');
            }
        }).catch(() => showToast('Error de conexión', 'error'));
    });
}

function toggleDayBlock(dateString, block) {
    const title = block ? 'Bloquear Día' : 'Desbloquear Día';
    const msg = block ? '¿Estás seguro de que deseas bloquear este día? Los clientes no podrán solicitar nuevos turnos.' : '¿Deseas volver a habilitar este día para que reciba turnos?';
    const btnColor = block ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600';
    const btnText = block ? 'Bloquear' : 'Desbloquear';

    showConfirm(title, msg, btnText, btnColor, () => {
        const toggleBtn = document.getElementById('toggleDayBlockBtn');
        if (toggleBtn) {
            toggleBtn.disabled = true;
            toggleBtn.textContent = 'Procesando...';
            toggleBtn.classList.add('opacity-70', 'cursor-not-allowed');
        }

        const isGeneralBlock = cal_bookedSlots[dateString] && cal_bookedSlots[dateString].includes('blocked_day');
        const action = block ? 'block_day' : 'unblock_day';
        let bodyParams = `fecha=${dateString}&action=${action}`;
        
        if (block) {
            if (typeof globalSelectedProfessional !== 'undefined' && globalSelectedProfessional !== '' && globalSelectedProfessional !== 'columnas') {
                bodyParams += `&profesional=${encodeURIComponent(globalSelectedProfessional)}`;
            }
        } else {
            if (!isGeneralBlock && typeof globalSelectedProfessional !== 'undefined' && globalSelectedProfessional !== '' && globalSelectedProfessional !== 'columnas') {
                bodyParams += `&profesional=${encodeURIComponent(globalSelectedProfessional)}`;
            }
        }

        return fetch('backend/gestionar_turnos.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: bodyParams
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                showToast(block ? 'Día bloqueado exitosamente' : 'Día desbloqueado exitosamente', 'success');
                cal_fetchBookedTimes(); 
            } else {
                showToast(data.error || 'No se pudo realizar la operación.', 'error');
                if (cal_selectedDate) renderAdminDayView(toYYYYMMDD(cal_selectedDate));
            }
        })
        .catch(err => {
            showToast('Error de conexión.', 'error');
            if (cal_selectedDate) renderAdminDayView(toYYYYMMDD(cal_selectedDate));
        });
    });
}

function openManualTurnoModal(preselectedTime = null, preselectedProf = null) {
    if (!cal_selectedDate) {
        alert("Selecciona un día en el calendario primero.");
        return;
    }
    const isEvent = preselectedTime && typeof preselectedTime === 'object';
    const timeToSelect = isEvent ? null : preselectedTime;
    const fechaActual = toYYYYMMDD(cal_selectedDate);
    document.getElementById('manualFecha').value = fechaActual;
    
    let adminInterval = 30;
    if (window.businessWebConfig && window.businessWebConfig.intervalo_turnos && window.businessWebConfig.intervalo_turnos !== 'servicio') {
        adminInterval = parseInt(window.businessWebConfig.intervalo_turnos) || 30;
    }
    generateTimeSlots(window.businessWebConfig?.hora_apertura, window.businessWebConfig?.hora_cierre, adminInterval);
    
    const horasOcupadas = [...(cal_bookedSlots[fechaActual] || []), ...window.getBreakTimes()];
    const simultaneos = window.businessWebConfig?.turnos_simultaneos === 'si';

    const horaSelect = document.getElementById('manualHora');
    horaSelect.innerHTML = '';
    cal_availableTimes.forEach(t => {
        if (window.isTimeInBreak(t)) return;
        const isOccupied = horasOcupadas.includes(t.substring(0, 5));
        const isDisabled = (!simultaneos && isOccupied) ? 'disabled' : '';
        const suffix = isOccupied ? ' (Ocupado)' : '';
        const isSelected = t === timeToSelect ? 'selected' : '';
        horaSelect.innerHTML += `<option value="${t}" ${isSelected} ${isDisabled}>${t}${suffix}</option>`;
    });

    const profToSelect = preselectedProf || globalSelectedProfessional;
    const profSelect = document.getElementById('manualProfesional');
    profSelect.innerHTML = '<option value="Cualquiera (Sin preferencia)">Cualquiera (Sin preferencia)</option>';
    const uniqueProfs = [...new Set(services.map(s => s.profesional).filter(p => p && p.trim() !== ''))];
    uniqueProfs.forEach(p => {
        const sel = profToSelect === p ? 'selected' : '';
        profSelect.innerHTML += `<option value="${p}" ${sel}>${p}</option>`;
    });

    const servSelect = document.getElementById('manualServicio');
    servSelect.innerHTML = '';
    const uniqueServs = [...new Set(services.map(s => s.nombre))];
    uniqueServs.forEach(s => servSelect.innerHTML += `<option value="${s}">${s}</option>`);

    const modal = document.getElementById('manualTurnoModal');
    const content = document.getElementById('manualTurnoModalContent');
    setManualModalMode('turno');
    modal.classList.remove('hidden');
    setTimeout(() => { modal.classList.remove('opacity-0'); content.classList.remove('scale-95'); }, 10);
}

function closeManualTurnoModal() {
    const modal = document.getElementById('manualTurnoModal');
    const content = document.getElementById('manualTurnoModalContent');
    modal.classList.add('opacity-0');
    content.classList.add('scale-95');
    setTimeout(() => { modal.classList.add('hidden'); document.getElementById('manualTurnoForm').reset(); }, 300);
}

function setManualModalMode(mode) {
    const actionInput = document.getElementById('manualAction');
    const fields = document.getElementById('manualTurnoFields');
    const tabTurno = document.getElementById('tabManualTurno');
    const tabBlock = document.getElementById('tabManualBlock');

    if (mode === 'turno') {
        actionInput.value = 'add_manual';
        fields.classList.remove('hidden');
        document.getElementById('manualNombre').required = true;
        document.getElementById('manualApellido').required = true;
        document.getElementById('manualCelular').required = true;
        document.getElementById('manualServicio').required = true;
        tabTurno.className = 'flex-1 py-2 text-sm font-bold rounded-lg bg-white dark:bg-slate-800 shadow-sm text-primary';
        tabBlock.className = 'flex-1 py-2 text-sm font-bold rounded-lg text-slate-500 hover:text-slate-300';
    } else {
        actionInput.value = 'block_time';
        fields.classList.add('hidden');
        document.getElementById('manualNombre').required = false;
        document.getElementById('manualApellido').required = false;
        document.getElementById('manualCelular').required = false;
        document.getElementById('manualServicio').required = false;
        tabBlock.className = 'flex-1 py-2 text-sm font-bold rounded-lg bg-white dark:bg-slate-800 shadow-sm text-primary';
        tabTurno.className = 'flex-1 py-2 text-sm font-bold rounded-lg text-slate-500 hover:text-slate-300';
    }
}

function fetchServices() {
    const queryParam = negocioSlug ? `?n=${negocioSlug}` : '';
    fetch('backend/gestionar_servicios.php' + queryParam)
        .then(res => res.json())
        .then(data => {
            services = data;
            populateServiceSelect();
            populateCalendarViewFilter();
            if (isAdmin) renderServicesList();
            
            const profDatalist = document.getElementById('profesionalesList');
            if (profDatalist) {
                profDatalist.innerHTML = '';
                const uniqueProfs = [...new Set(services.map(s => s.profesional).filter(p => p && p.trim() !== ''))];
                uniqueProfs.forEach(p => profDatalist.innerHTML += `<option value="${p}">`);
            }
            
            if (document.getElementById('weeklyCalendarView')) {
                initWizard();
            }
        });
}

function populateCalendarViewFilter() {
    const titleContainer = document.querySelector('.lg\\:col-span-7 .flex.justify-between.items-center.mb-8');
    if (!titleContainer) return;

    let filterContainer = document.getElementById('calendarViewFilterContainer');
    if (!filterContainer) {
        filterContainer = document.createElement('div');
        filterContainer.id = 'calendarViewFilterContainer';
        filterContainer.className = 'mb-6 flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-white dark:bg-white/5 p-4 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm';
        
        const label = document.createElement('label');
        label.className = 'text-sm font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap flex items-center gap-1';
        label.innerHTML = '<span class="material-symbols-outlined text-[18px]">filter_alt</span> Vista de Profesional:';
        
        const select = document.createElement('select');
        select.id = 'calendarViewFilter';
        select.className = 'bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary w-full sm:w-auto';
        
        select.addEventListener('change', (e) => {
            globalSelectedProfessional = e.target.value;
            
            const profSelect = document.getElementById('profesionalSelect');
            if (profSelect) {
                const optExists = Array.from(profSelect.options).some(opt => opt.value === e.target.value);
                profSelect.value = optExists ? e.target.value : 'Cualquiera (Sin preferencia)';
            }
            
            updateServiceDropdown();
            updateProfServicesDisplay();
            cal_fetchBookedTimes();
            if (cal_selectedDate) {
                const effectiveIsAdmin = isAdmin && !isPreviewMode;
                if (effectiveIsAdmin) {
                    renderAdminDayView(toYYYYMMDD(cal_selectedDate));
                    if (typeof renderAdminWeeklyGrid === 'function' && document.getElementById('adminWeeklyGrid')) {
                        renderAdminWeeklyGrid();
                    }
                } else {
                    cal_renderTimeSlots();
                }
            }
        });

        filterContainer.appendChild(label);
        filterContainer.appendChild(select);
        
        if (titleContainer && titleContainer.parentElement) {
            titleContainer.parentElement.insertBefore(filterContainer, titleContainer.nextSibling);
        }
    }

    const select = document.getElementById('calendarViewFilter');
    const uniqueProfs = [...new Set(services.map(s => s.profesional).filter(p => p && p.trim() !== ''))];
    
    if (uniqueProfs.length === 1 && (!isAdmin || isPreviewMode)) {
        filterContainer.style.display = 'none';
    } else if (uniqueProfs.length === 0) {
        filterContainer.style.display = 'none';
        return;
    } else {
        filterContainer.style.display = 'flex';
    }
    
    select.innerHTML = '';
    const effectiveIsAdmin = isAdmin && !isPreviewMode;
    
    if (effectiveIsAdmin) {
        select.innerHTML += '<option value="">🏢 Todos los Profesionales (General)</option>';
        const isSelectedCol = globalSelectedProfessional === 'columnas' ? 'selected' : '';
        select.innerHTML += `<option value="columnas" ${isSelectedCol}>📊 Todos en Columnas (Modo Admin)</option>`;
    } else {
        select.innerHTML += '<option value="">👤 Cualquiera (Sin preferencia)</option>';
    }
    
    uniqueProfs.forEach(prof => {
        const isSelected = prof === globalSelectedProfessional ? 'selected' : '';
        select.innerHTML += `<option value="${prof}" ${isSelected}>👤 ${prof}</option>`;
    });
}

function populateServiceSelect() {
    updateServiceDropdown();

    const select = document.getElementById('serviceSelect');
    const urlParams = new URLSearchParams(window.location.search);
    const servicioUrl = urlParams.get('servicio');
    if (servicioUrl && select) {
        const optExists = Array.from(select.options).some(opt => opt.value === servicioUrl);
        if (optExists) {
            select.value = servicioUrl;
            select.dispatchEvent(new Event('change'));
        }
    }
    updateProfServicesDisplay();
}

function updateServiceDropdown() {
    const serviceSelect = document.getElementById('serviceSelect');
    if (!serviceSelect) return;
    
    const currentSelectedService = serviceSelect.value;
    serviceSelect.innerHTML = '<option value="" disabled selected>¿Qué servicio deseas?</option>';
    
    const prof = globalSelectedProfessional;
    let availableServices = services;
    
    if (prof && prof !== 'columnas' && prof !== 'Cualquiera (Sin preferencia)' && prof !== 'Cualquiera') {
        availableServices = services.filter(s => s.profesional === prof);
    }
    
    const uniqueNames = new Set();
    availableServices.forEach(service => {
        if (!uniqueNames.has(service.nombre)) {
            uniqueNames.add(service.nombre);
            const precioText = service.precio ? ` - $${service.precio}` : '';
            const isSelected = currentSelectedService === service.nombre ? 'selected' : '';
            serviceSelect.innerHTML += `<option value="${service.nombre}" ${isSelected}>${service.nombre}${precioText}</option>`;
        }
    });
    
    if (currentSelectedService && !uniqueNames.has(currentSelectedService)) {
        serviceSelect.value = '';
    }
}

function updateProfServicesDisplay() {
    const mainTitle = document.getElementById('mainCalendarTitle');
    const mainSubtitle = document.getElementById('mainCalendarSubtitle');
    if (!mainTitle || !mainSubtitle) return;
    
    const prof = globalSelectedProfessional;
    if (prof && prof !== 'columnas' && prof !== 'Cualquiera (Sin preferencia)' && prof !== 'Cualquiera') {
        const profServs = services.filter(s => s.profesional === prof).map(s => s.nombre);
        const uniqueProfServs = [...new Set(profServs)].join(' • ');
        
        mainTitle.innerHTML = `<span class="text-primary flex items-center gap-2"><span class="material-symbols-outlined text-[32px]">person</span> ${prof}</span>`;
        
        if (uniqueProfServs) {
            mainSubtitle.innerHTML = `<strong class="text-slate-600 dark:text-slate-400 uppercase tracking-wider text-xs">Servicios:</strong> ${uniqueProfServs}`;
        } else {
            mainSubtitle.textContent = "Selecciona el día que mejor te quede.";
        }
    } else {
        mainTitle.textContent = "Reserva tu cita";
        mainSubtitle.textContent = "Selecciona el día que mejor te quede.";
    }
}

function openServicesModal() {
    const modal = document.getElementById('servicesModal');
    const content = document.getElementById('servicesModalContent');
    modal.classList.remove('hidden', 'opacity-0');
    setTimeout(() => { content.classList.remove('scale-95'); }, 10);
    renderServicesList();
}

function closeServicesModal() {
    const modal = document.getElementById('servicesModal');
    const content = document.getElementById('servicesModalContent');
    modal.classList.add('opacity-0');
    content.classList.add('scale-95');
    setTimeout(() => { modal.classList.add('hidden'); resetServiceForm(); }, 300);
}

function renderServicesList() {
    const container = document.getElementById('servicesListContainer');
    if (!container) return;
    container.innerHTML = '';
    if (services.length === 0) {
        container.innerHTML = '<p class="text-sm text-slate-500">No hay servicios definidos.</p>';
        return;
    }
    services.forEach(service => {
        const precioText = service.precio ? ` • $${service.precio}` : '';
        const defaultIcon = `<div class="w-4 h-4 rounded-full bg-purple-200 text-purple-700 flex items-center justify-center shrink-0"><span class="material-symbols-outlined" style="font-size: 12px;">person</span></div>`;
        const profIcon = service.foto_profesional ? `<img src="${service.foto_profesional}" class="w-4 h-4 rounded-full object-cover border border-purple-200 shrink-0">` : defaultIcon;
        const linkBtn = service.enlace_agenda ? `<button type="button" onclick="copyProfLink(event, '${service.enlace_agenda}')" class="text-emerald-600 hover:text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md transition-colors inline-flex items-center gap-1 text-[10px] font-bold ml-2 uppercase tracking-wide" title="Copiar enlace"><span class="material-symbols-outlined text-[12px]">link</span> Obtener Enlace de Agenda</button>` : '';
        container.innerHTML += `
            <div class="flex items-center justify-between bg-slate-50 p-3 rounded-lg">
                <div>
                    <p class="font-bold text-slate-800 flex items-center flex-wrap gap-1">${service.nombre} ${service.profesional ? `<span class="text-xs font-normal text-purple-600 bg-purple-100 px-2 py-0.5 rounded-md inline-flex items-center gap-1 ml-1">${profIcon} <span>${service.profesional}</span></span>${linkBtn}` : ''}</p>
                    <p class="text-sm text-slate-500">${service.duracion} min${precioText}</p>
                </div>
                <div class="flex gap-2">
                    <button onclick="editService('${service.id}')" class="text-blue-500 hover:text-blue-700"><span class="material-symbols-outlined">edit</span></button>
                    <button onclick="deleteService('${service.id}')" class="text-red-500 hover:text-red-700"><span class="material-symbols-outlined">delete</span></button>
                </div>
            </div>
        `;
    });
}

function copyProfLink(e, relativePath) {
    e.preventDefault();
    e.stopPropagation();
    const pathParts = window.location.pathname.split('/');
    pathParts.pop(); 
    const baseUrl = window.location.origin + pathParts.join('/');
    const fullUrl = `${baseUrl}/${relativePath}`;
    
    navigator.clipboard.writeText(fullUrl).then(() => {
        showToast('¡Enlace de agenda copiado al portapapeles!', 'success');
    }).catch(() => prompt('Copia manualmente este enlace:', fullUrl));
}

function getProfessionalAgendaLinkByName(profName) {
    if (!profName || profName === 'Cualquiera (Sin preferencia)') return '';
    const prof = (profName || '').trim();
    const service = (services || []).find(s => (s.profesional || '').trim() === prof && s.enlace_agenda);
    return service ? service.enlace_agenda : '';
}

function buildProfessionalLinkButton(profName) {
    const rel = getProfessionalAgendaLinkByName(profName);
    if (!rel) return '';
    return `<button type="button" onclick="copyProfLink(event, '${rel}')" class="ml-1 text-emerald-600 hover:text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md transition-colors inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide" title="Copiar enlace de agenda"><span class="material-symbols-outlined text-[12px]">link</span> Enlace Prof.</button>`;
}

window.copyMyLink = function() {
    let ruta = '';
    if (window.currentBusinessData && window.currentBusinessData.ruta) {
        ruta = window.currentBusinessData.ruta;
    } else if (typeof negocioSlug !== 'undefined' && negocioSlug) {
        ruta = negocioSlug;
    }
    if (!ruta) return;
    const link = window.location.origin + '/' + ruta;
    navigator.clipboard.writeText(link).then(() => {
        showToast('¡Enlace de reservas copiado!', 'success');
    }).catch(() => { prompt('Copia tu enlace manualmente:', link); });
};

function regenerarEnlacesProf() {
    showConfirm('Regenerar Enlaces', '¿Seguro que deseas regenerar todos los enlaces de las agendas? \n\nTodos los enlaces enviados previamente dejarán de funcionar.', 'Regenerar', 'bg-red-500 hover:bg-red-600', () => {
        return fetch('backend/regenerar_enlaces.php', { method: 'POST' })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                showToast('¡Enlaces regenerados correctamente!', 'success');
                if (typeof fetchServices === 'function') fetchServices();
                if (typeof window.fetchAndRenderWebServices === 'function') window.fetchAndRenderWebServices();
            } else {
                showToast(data.error || 'Error al regenerar.', 'error');
            }
        }).catch(err => showToast('Error de conexión con el servidor.', 'error'));
    });
}

function handleServiceFormSubmit(e) {
    e.preventDefault();
    const form = e.target;
    
    const h = parseInt(document.getElementById('serviceDurationH') ? document.getElementById('serviceDurationH').value : 0) || 0;
    const m = parseInt(document.getElementById('serviceDurationM') ? document.getElementById('serviceDurationM').value : 0) || 0;
    if (document.getElementById('serviceDuration')) document.getElementById('serviceDuration').value = (h * 60) + m;

    const formData = new FormData(form);
    if(document.getElementById('descEditor')) formData.set('descripcion', document.getElementById('descEditor').innerHTML);

    fetch('backend/gestionar_servicios.php', {
        method: 'POST',
        body: formData
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            showToast('Servicio guardado exitosamente', 'success');
            fetchServices();
            resetServiceForm();
        } else {
            showToast(data.error || 'Error al guardar el servicio', 'error');
        }
    }).catch(() => showToast('Error de conexión', 'error'));
}

function editService(id) {
    const service = services.find(s => String(s.id) === String(id));
    if (service) {
        document.getElementById('serviceFormTitle').textContent = 'Editar Servicio';
        document.getElementById('serviceId').value = service.id;
        document.getElementById('serviceName').value = service.nombre;
        const d = parseInt(service.duracion) || 0;
        if (document.getElementById('serviceDurationH')) document.getElementById('serviceDurationH').value = Math.floor(d / 60);
        if (document.getElementById('serviceDurationM')) document.getElementById('serviceDurationM').value = d % 60;
        if (document.getElementById('serviceDuration')) document.getElementById('serviceDuration').value = d;
        document.getElementById('servicePrice').value = service.precio || '';
        if(document.getElementById('serviceProfessional')) document.getElementById('serviceProfessional').value = service.profesional || '';
        if(document.getElementById('serviceProfessionalEmail')) document.getElementById('serviceProfessionalEmail').value = service.email_profesional || '';
        if(document.getElementById('serviceProfessionalPhoto')) document.getElementById('serviceProfessionalPhoto').value = service.foto_profesional || '';
        if(document.getElementById('serviceProfessionalFile')) document.getElementById('serviceProfessionalFile').value = '';
        if(document.getElementById('descEditor')) document.getElementById('descEditor').innerHTML = service.descripcion || '';
        document.getElementById('cancelEditBtn').classList.remove('hidden');
    }
}

function deleteService(id) {
    showConfirm('Eliminar Servicio', '¿Seguro que quieres eliminar este servicio permanentemente?', 'Eliminar', 'bg-red-500 hover:bg-red-600', () => {
        return fetch(`backend/gestionar_servicios.php?id=${id}`, { method: 'DELETE' })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                showToast('Servicio eliminado exitosamente', 'success');
                fetchServices(); 
            } else {
                showToast(data.error || 'Error al eliminar el servicio', 'error');
            }
        }).catch(() => showToast('Error de conexión', 'error'));
    });
}

function resetServiceForm() {
    const form = document.getElementById('serviceForm');
    if (form) form.reset();
    const serviceIdInput = document.getElementById('serviceId');
    if (serviceIdInput) serviceIdInput.value = '';
    if(document.getElementById('serviceProfessional')) document.getElementById('serviceProfessional').value = '';
    if(document.getElementById('serviceProfessionalEmail')) document.getElementById('serviceProfessionalEmail').value = '';
    if(document.getElementById('serviceProfessionalPhoto')) document.getElementById('serviceProfessionalPhoto').value = '';
    const fileInput = document.getElementById('serviceProfessionalFile');
    if(fileInput) {
        fileInput.value = '';
        if (fileInput._previewEl) {
            fileInput._previewEl.classList.add('hidden');
            fileInput._previewEl.src = '';
        }
    }
    if(document.getElementById('descEditor')) document.getElementById('descEditor').innerHTML = '';
    if (document.getElementById('serviceDurationH')) document.getElementById('serviceDurationH').value = '';
    if (document.getElementById('serviceDurationM')) document.getElementById('serviceDurationM').value = '';
    const formTitle = document.getElementById('serviceFormTitle');
    if (formTitle) formTitle.textContent = 'Añadir Nuevo Servicio';
    const cancelBtn = document.getElementById('cancelEditBtn');
    if (cancelBtn) cancelBtn.classList.add('hidden');
}

function initWizard() {
    const effectiveIsAdmin = isAdmin && !isPreviewMode;
    const wizardOverlay = document.getElementById('wizardOverlay');
    const mainContent = document.getElementById('mainContent');
    const adminView = document.getElementById('adminWeeklyView');
    
    if (effectiveIsAdmin) {
        if (wizardOverlay) wizardOverlay.classList.add('hidden');
        if (mainContent) mainContent.classList.add('hidden');
        
        if (adminView) {
            adminView.classList.remove('hidden');
            initAdminWeeklyServices();
        }
        return;
    } else {
        if (adminView) adminView.classList.add('hidden');
        if (wizardOverlay) wizardOverlay.classList.remove('hidden');
        if (mainContent) mainContent.classList.add('hidden');
    }

    const sList = document.getElementById('wizardServicesList');
    if (!sList) {
        if (wizardOverlay) wizardOverlay.classList.add('hidden');
        if (mainContent) mainContent.classList.remove('hidden');
        cal_fetchBookedTimesWeekly();
        return;
    }

    if (sList && !document.getElementById('wizardCategoryBar')) {
        const catBar = document.createElement('div');
        catBar.id = 'wizardCategoryBar';
        catBar.className = 'flex gap-2 overflow-x-auto pb-4 mb-4 custom-scrollbar';
        catBar.innerHTML = `<button class="px-5 py-2 rounded-full bg-primary text-white font-bold text-sm shrink-0 shadow-md">Todos los servicios</button>`;
        sList.parentElement.insertBefore(catBar, sList);
    }

    sList.innerHTML = '';
    const uniqueServices = [...new Set(services.map(s => s.nombre))];
    if (uniqueServices.length === 0) {
        if (isAdmin) {
            sList.innerHTML = `
                <div class="text-center py-8">
                    <div class="w-16 h-16 bg-slate-50 border border-slate-200 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                        <span class="material-symbols-outlined text-3xl">spa</span>
                    </div>
                    <p class="text-slate-800 font-bold mb-2 text-lg">Aún no tienes servicios cargados</p>
                    <p class="text-sm text-slate-500 mb-4">Para utilizar este calendario interactivo, necesitas agregar al menos un servicio desde tu panel de control.</p>
                    <button type="button" onclick="window.location.href='dashboard.html'" class="inline-block bg-primary text-white font-bold py-2.5 px-6 rounded-xl shadow-md shadow-primary/20 hover:bg-primary/90 transition-colors text-sm">Ir al panel de control</button>
                </div>
            `;
        } else {
            sList.innerHTML = `
                <div class="text-center py-8">
                    <div class="w-16 h-16 bg-slate-50 border border-slate-200 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                        <span class="material-symbols-outlined text-3xl">event_busy</span>
                    </div>
                    <p class="text-slate-800 font-bold mb-2 text-lg">Servicios no disponibles</p>
                    <p class="text-sm text-slate-500 mb-4">Este negocio aún no tiene servicios configurados en este momento. Por favor, intenta más tarde.</p>
                </div>
            `;
        }
        return;
    }

    uniqueServices.forEach(sName => {
        const sMatches = services.filter(s => s.nombre === sName);
        const minPrice = Math.min(...sMatches.map(s => parseFloat(s.precio) || 0));
        const priceDisplay = minPrice > 0 ? `Desde $${minPrice}` : '';
        const dur = sMatches[0].duracion;
        const img = sMatches[0].imagen1 || sMatches[0].foto_profesional;

        const imgHtml = img ? `<img src="${img}" class="w-16 h-16 rounded-xl object-cover shrink-0 border border-slate-200">` : `<div class="w-16 h-16 rounded-xl bg-slate-100 flex items-center justify-center shrink-0 border border-slate-200"><span class="material-symbols-outlined text-slate-400">spa</span></div>`;

        const btn = document.createElement('button');
        btn.className = 'w-full text-left p-4 rounded-2xl border border-slate-200 hover:border-primary hover:shadow-lg hover:-translate-y-0.5 transition-all bg-white flex justify-between items-center gap-4 group';
        btn.innerHTML = `
            <div class="flex items-center gap-4">
                ${imgHtml}
                <div>
                    <p class="font-bold text-slate-800 text-lg group-hover:text-primary transition-colors">${sName}</p>
                    <p class="text-sm font-semibold text-slate-500 mt-1 flex items-center gap-2"><span class="material-symbols-outlined text-[16px]">schedule</span> ${dur} min ${priceDisplay ? ' <span class="text-slate-300">|</span> <span class="text-emerald-600 font-bold">' + priceDisplay + '</span>' : ''}</p>
                </div>
            </div>
            <span class="material-symbols-outlined text-slate-300 group-hover:text-primary group-hover:translate-x-1 transition-transform">chevron_right</span>
        `;
        btn.onclick = () => selectWizardService(sName);
        sList.appendChild(btn);
    });
}

function selectWizardService(sName) {
    weeklySelectedService = sName;
    document.getElementById('step1Modal').classList.add('hidden');
    document.getElementById('step2Modal').classList.remove('hidden');

    const pList = document.getElementById('wizardProfList');
    pList.innerHTML = '';
    
    const professionals = services.filter(s => s.nombre === sName).map(s => s.profesional).filter(p => p && p.trim() !== '');
    const uniqueProfs = [...new Set(professionals)];

    const createProfBtn = (pName, display, icon) => {
        const btn = document.createElement('button');
        btn.className = 'w-full text-left p-4 rounded-2xl border border-slate-200 hover:border-primary hover:shadow-lg hover:-translate-y-0.5 transition-all bg-slate-50 flex items-center gap-4 group';
        btn.innerHTML = `
            <div class="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
                ${icon ? `<img src="${icon}" class="w-full h-full rounded-full object-cover">` : `<span class="material-symbols-outlined text-2xl">${pName === 'Cualquiera' ? 'groups' : 'person'}</span>`}
            </div>
            <div class="flex-1">
                <p class="font-bold text-slate-800 text-lg group-hover:text-primary transition-colors">${display}</p>
            </div>
            <span class="material-symbols-outlined text-slate-300 group-hover:text-primary group-hover:translate-x-1 transition-transform">chevron_right</span>
        `;
        btn.onclick = () => selectWizardProf(pName);
        return btn;
    };

    pList.appendChild(createProfBtn('Cualquiera', 'Cualquiera (Sin preferencia)', null));
    uniqueProfs.forEach(p => {
        const sMatch = services.find(s => s.nombre === sName && s.profesional === p);
        pList.appendChild(createProfBtn(p, p, sMatch ? sMatch.foto_profesional : null));
    });
}

function backToStep1() {
    document.getElementById('step2Modal').classList.add('hidden');
    document.getElementById('step1Modal').classList.remove('hidden');
}

function selectWizardProf(pName) {
    weeklySelectedProf = pName;
    
    const wizardOverlay = document.getElementById('wizardOverlay');
    if (wizardOverlay) wizardOverlay.classList.add('hidden');
    
    const mainContent = document.getElementById('mainContent');
    if (mainContent) mainContent.classList.remove('hidden');
    
    globalSelectedProfessional = pName === 'Cualquiera' ? 'Cualquiera (Sin preferencia)' : pName;
    
    const sumService = document.getElementById('summaryService');
    if (sumService) sumService.textContent = weeklySelectedService;
    
    const sumProf = document.getElementById('summaryProf');
    if (sumProf) sumProf.innerHTML = `<span class="material-symbols-outlined text-[16px]">person</span> ${pName === 'Cualquiera' ? 'Sin preferencia' : pName}`;
    
    const wServ = document.getElementById('weeklyServicio');
    if (wServ) wServ.value = weeklySelectedService;
    
    const wProf = document.getElementById('weeklyProfesional');
    if (wProf) wProf.value = globalSelectedProfessional;

    const serviceSelect = document.getElementById('serviceSelect');
    if (serviceSelect) {
        const opts = Array.from(serviceSelect.options);
        if (!opts.some(o => o.value === weeklySelectedService)) {
            serviceSelect.innerHTML += `<option value="${weeklySelectedService}">${weeklySelectedService}</option>`;
        }
        serviceSelect.value = weeklySelectedService;
    }

    const profSelect = document.getElementById('profesionalSelect');
    if (profSelect) {
        const opts = Array.from(profSelect.options);
        if (!opts.some(o => o.value === globalSelectedProfessional)) {
            profSelect.innerHTML += `<option value="${globalSelectedProfessional}">${globalSelectedProfessional}</option>`;
        }
        profSelect.value = globalSelectedProfessional;
    }

    cal_fetchBookedTimesWeekly();
}

var adminWeeklySelectedService = null;
var adminWeeklySelectedProf = null;

function initAdminWeeklyServices() {
    const container = document.getElementById('adminWeeklyServices');
    if (!container) return;
    container.innerHTML = '';
    
    const uniqueServices = [...new Set(services.map(s => s.nombre))];
    if (uniqueServices.length === 0) {
        container.innerHTML = '<p class="text-sm text-slate-500 py-4 text-center">No hay servicios configurados.</p>';
        return;
    }

    uniqueServices.forEach(sName => {
        const btn = document.createElement('button');
        btn.className = `w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between group bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-primary`;
        btn.innerHTML = `<span class="font-bold text-sm">${sName}</span> <span class="material-symbols-outlined text-slate-300 group-hover:text-primary transition-colors text-sm">chevron_right</span>`;
        
        btn.onclick = () => {
            document.querySelectorAll('#adminWeeklyServices button').forEach(b => {
                b.classList.remove('border-primary', 'bg-primary/10', 'text-primary', 'dark:bg-primary/20');
                b.classList.add('bg-slate-50', 'dark:bg-slate-900', 'text-slate-700', 'dark:text-slate-300', 'border-slate-200', 'dark:border-slate-700');
                b.querySelector('span.material-symbols-outlined').classList.remove('text-primary');
                b.querySelector('span.material-symbols-outlined').classList.add('text-slate-300');
            });
            btn.classList.remove('bg-slate-50', 'dark:bg-slate-900', 'text-slate-700', 'dark:text-slate-300', 'border-slate-200', 'dark:border-slate-700');
            btn.classList.add('border-primary', 'bg-primary/10', 'dark:bg-primary/20', 'text-primary');
            btn.querySelector('span.material-symbols-outlined').classList.remove('text-slate-300');
            btn.querySelector('span.material-symbols-outlined').classList.add('text-primary');
            
            adminWeeklySelectedService = sName;
            adminWeeklySelectedProf = null; 
            renderAdminWeeklyProfs();
            renderAdminWeeklyGrid(); 
        };
        container.appendChild(btn);
    });
    
    if (container.firstChild) container.firstChild.click();
}

function renderAdminWeeklyProfs() {
    const container = document.getElementById('adminWeeklyProfs');
    if (!container) return;
    container.innerHTML = '';
    
    let allProfs = [...new Set(services.map(s => s.profesional).filter(p => p && p.trim() !== ''))];
    let matchingProfs = [];
    let otherProfs = [];
    
    if (adminWeeklySelectedService) {
        matchingProfs = [...new Set(services.filter(s => s.nombre === adminWeeklySelectedService).map(s => s.profesional))];
        otherProfs = allProfs.filter(p => !matchingProfs.includes(p));
    } else {
        otherProfs = allProfs;
    }
    
    const createProfBtn = (pName, isHighlighted) => {
        const btn = document.createElement('button');
        const baseClasses = isHighlighted 
            ? 'border-primary bg-primary/10 dark:bg-primary/20 text-primary' 
            : 'border-slate-200 dark:border-slate-700 hover:border-primary/50 bg-slate-50 dark:bg-slate-900 text-slate-500';
        
        btn.className = `w-full text-left p-3 rounded-xl border transition-all flex items-center gap-3 ${baseClasses}`;
        btn.innerHTML = `<span class="material-symbols-outlined text-[18px]">${isHighlighted ? 'check_circle' : 'person'}</span> <span class="font-bold text-sm">${pName}</span>`;
        
        btn.onclick = () => {
            adminWeeklySelectedProf = pName;
            globalSelectedProfessional = pName;
            
            document.querySelectorAll('#adminWeeklyProfs button').forEach(b => b.classList.remove('ring-2', 'ring-primary', 'ring-offset-2', 'dark:ring-offset-slate-800'));
            btn.classList.add('ring-2', 'ring-primary', 'ring-offset-2', 'dark:ring-offset-slate-800');
            
            cal_fetchBookedTimesWeeklyAdmin();
        };
        return btn;
    };
    
    matchingProfs.forEach(p => container.appendChild(createProfBtn(p, true)));
    otherProfs.forEach(p => container.appendChild(createProfBtn(p, false)));
    
    if (matchingProfs.length === 1) container.firstChild.click();
}

function cal_fetchBookedTimesWeeklyAdmin() {
    let url = negocioSlug ? `backend/obtener_turnos_ocupados.php?n=${negocioSlug}` : `backend/obtener_turnos_ocupados.php`;
    if (adminWeeklySelectedProf && adminWeeklySelectedProf !== 'Cualquiera (Sin preferencia)' && adminWeeklySelectedProf !== 'columnas') {
        url += (url.includes('?') ? '&' : '?') + `p=${encodeURIComponent(adminWeeklySelectedProf)}`;
    }
    fetch(url).then(res => res.json()).then(data => { cal_bookedSlots = data; renderAdminWeeklyGrid(); }).catch(err => console.error('Error:', err));
}

function renderAdminWeeklyGrid() {
    const grid = document.getElementById('adminWeeklyGrid');
    if (!grid) return;
    grid.innerHTML = '';
    
    const monthYearEl = document.getElementById('adminWeekMonthYear');
    if (monthYearEl) monthYearEl.textContent = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' }).format(weekStartDate);
    const today = new Date(); today.setHours(0,0,0,0);
    
    if (!adminWeeklySelectedProf) {
        grid.innerHTML = '<div class="w-full text-center p-8 text-slate-400 font-bold border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">Selecciona un profesional para ver su disponibilidad</div>';
        return;
    }
    
    let selectedDuration = 30;
    if (adminWeeklySelectedService) {
        const matchingService = services.find(s => s.nombre === adminWeeklySelectedService && (s.profesional === adminWeeklySelectedProf || !adminWeeklySelectedProf));
        if (matchingService) selectedDuration = parseInt(matchingService.duracion) || 30;
    }
    
    let interval = 30;
    if (window.businessWebConfig && window.businessWebConfig.intervalo_turnos) interval = window.businessWebConfig.intervalo_turnos === 'servicio' ? selectedDuration : parseInt(window.businessWebConfig.intervalo_turnos);
    
    generateTimeSlots(window.businessWebConfig?.hora_apertura, window.businessWebConfig?.hora_cierre, interval);
    const blocksNeeded = Math.ceil(selectedDuration / interval);

    for (let i = 0; i < 7; i++) {
        const date = new Date(weekStartDate); date.setDate(weekStartDate.getDate() + i);
        const dateString = toYYYYMMDD(date); const isPast = date < today;
        const col = document.createElement('div'); col.className = 'flex-1 min-w-[100px] flex flex-col gap-2';
        const dayName = new Intl.DateTimeFormat('es-ES', { weekday: 'short' }).format(date).toUpperCase();
        const isToday = date.getTime() === today.getTime();
        
        col.innerHTML = `<div class="text-center p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 mb-2"><div class="text-xs font-bold ${isToday ? 'text-primary' : 'text-slate-400'}">${dayName}</div><div class="text-xl font-extrabold ${isToday ? 'text-primary' : 'text-slate-800 dark:text-slate-100'}">${date.getDate()}</div></div>`;
        const slotsContainer = document.createElement('div'); slotsContainer.className = 'flex flex-col gap-2 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar';
        
        const horasOcupadas = [...(cal_bookedSlots[dateString] || []), ...window.getBreakTimes()];
        const isGeneralBlock = horasOcupadas.includes('blocked_day');
        let isProfBlock = horasOcupadas.includes('blocked_day_prof');
        if (!adminWeeklySelectedProf || adminWeeklySelectedProf === 'columnas' || adminWeeklySelectedProf === 'Cualquiera (Sin preferencia)') isProfBlock = false;
        
        if (isPast || !window.isWorkingDay(date) || isGeneralBlock || isProfBlock) {
            slotsContainer.innerHTML = `<div class="text-center p-4 text-xs font-bold text-slate-400 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">No disponible</div>`;
        } else {
            cal_availableTimes.forEach((time, idx) => {
                if (window.isTimeInBreak(time)) return;
                let isBooked = false;
                const slotDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), ...time.split(':').map(Number), 0, 0);
                for (let j = 0; j < blocksNeeded; j++) { if (idx + j >= cal_availableTimes.length || horasOcupadas.includes(cal_availableTimes[idx + j].substring(0, 5))) { isBooked = true; break; } }
                if (!isBooked && isToday && slotDate.getTime() <= new Date().getTime()) isBooked = true;
                
                const slot = document.createElement('div');
                slot.className = `p-2 text-center text-xs font-bold rounded-lg border ${isBooked ? 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-900/50 text-red-400 cursor-not-allowed' : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800/50 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-800/50 cursor-pointer transition-colors'}`;
                
                if (!isBooked) {
                    slot.textContent = time;
                    slot.onclick = () => {
                        if (!adminWeeklySelectedProf || !adminWeeklySelectedService) { showToast('Selecciona un servicio y un profesional primero', 'error'); return; }
                        cal_selectedDate = date; globalSelectedProfessional = adminWeeklySelectedProf;
                        openManualTurnoModal(time);
                        setTimeout(() => { const servSelect = document.getElementById('manualServicio'); if (servSelect) servSelect.value = adminWeeklySelectedService; }, 100);
                    };
                } else { slot.innerHTML = `${time} <span class="block text-[9px] font-normal mt-0.5 opacity-80">Ocupado</span>`; }
                slotsContainer.appendChild(slot);
            });
            if (cal_availableTimes.length === 0) slotsContainer.innerHTML = `<div class="text-center p-4 text-xs font-bold text-slate-400 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">Sin horarios</div>`;
        }
        col.appendChild(slotsContainer); grid.appendChild(col);
    }
}

function resetWizard() {
    weeklySelectedService = null;
    weeklySelectedProf = null;
    cal2_selectedDate = null;
    cal2_selectedTime = null;
    
    const mainContent = document.getElementById('mainContent');
    if (mainContent) mainContent.classList.add('hidden');
    
    const step2Modal = document.getElementById('step2Modal');
    if (step2Modal) step2Modal.classList.add('hidden');
    
    const step1Modal = document.getElementById('step1Modal');
    if (step1Modal) step1Modal.classList.remove('hidden');
    
    const wizardOverlay = document.getElementById('wizardOverlay');
    if (wizardOverlay) wizardOverlay.classList.remove('hidden');
}

function cal_fetchBookedTimesWeekly() {
    let url = negocioSlug ? `backend/obtener_turnos_ocupados.php?n=${negocioSlug}` : `backend/obtener_turnos_ocupados.php`;
    if (globalSelectedProfessional && globalSelectedProfessional !== 'Cualquiera (Sin preferencia)' && globalSelectedProfessional !== 'columnas') url += (url.includes('?') ? '&' : '?') + `p=${encodeURIComponent(globalSelectedProfessional)}`;

    fetch(url).then(res => res.json()).then(data => {
        cal_bookedSlots = data;
        renderWeeklyCalendar();
        findNextAvailableSlot();
    }).catch(err => console.error('Error:', err));
}

function renderWeeklyCalendar() {
    const monthYearEl = document.getElementById('weekMonthYear');
    if (!monthYearEl) return;

    monthYearEl.textContent = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' }).format(weekStartDate);
    
    const calendarDays = document.getElementById('weeklyCalendarDays');
    calendarDays.innerHTML = '';
    const today = new Date();
    today.setHours(0,0,0,0);

    const dayFormatter = new Intl.DateTimeFormat('es-ES', { weekday: 'short' });
    const selectedTimeValue = cal2_selectedDate ? cal2_selectedDate.getTime() : null;
    const ignoreProfBlock = !globalSelectedProfessional || globalSelectedProfessional === 'columnas' || globalSelectedProfessional === 'Cualquiera (Sin preferencia)';
    const fragment = document.createDocumentFragment();

    for (let i = 0; i < 7; i++) {
        const date = new Date(weekStartDate);
        date.setDate(weekStartDate.getDate() + i);
        
        const isPast = date < today;
        const dateString = toYYYYMMDD(date);
        const isGeneralBlock = cal_bookedSlots[dateString] && cal_bookedSlots[dateString].includes('blocked_day');
        let isProfBlock = cal_bookedSlots[dateString] && cal_bookedSlots[dateString].includes('blocked_day_prof');
        if (ignoreProfBlock) isProfBlock = false;
        
        const isDayBlocked = isGeneralBlock || isProfBlock;
        const isNotWorkingDay = !window.isWorkingDay(date);
        let hasAvailableSlots = (!isPast && !isNotWorkingDay && !isDayBlocked) ? checkDayHasAvailableSlots(date) : false;
        const visuallyDisabled = isPast || isNotWorkingDay || isDayBlocked || (!hasAvailableSlots && !isPast && !isNotWorkingDay);
        
        const dayDiv = document.createElement('div');
        const dayName = dayFormatter.format(date).substring(0,3).toUpperCase();
        
        let bgClass = '', textClass = '', borderClass = 'border-transparent';

        if (visuallyDisabled) {
            bgClass = 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/50';
            textClass = 'text-red-500 dark:text-red-400';
        } else {
            bgClass = 'bg-green-100 dark:bg-green-900/30 border-green-400 dark:border-green-600/50';
            textClass = 'text-green-700 dark:text-green-400';
        }

        if (selectedTimeValue === date.getTime()) {
            borderClass = 'border-primary ring-4 ring-primary/30 ring-offset-2';
            bgClass = 'bg-primary';
            textClass = 'text-white';
        } else {
            borderClass = visuallyDisabled ? 'border-red-200 dark:border-red-800/50' : 'border-green-400 dark:border-green-600/50';
        }

        dayDiv.className = `flex flex-col items-center justify-center py-4 px-1 rounded-2xl border-2 shadow-sm ${borderClass} ${bgClass} ${textClass}`;
        
        if (visuallyDisabled) {
            dayDiv.classList.add('opacity-50', 'cursor-not-allowed');
        } else {
            dayDiv.classList.add('cursor-pointer', 'hover:scale-105', 'transition-transform', 'hover:border-green-500');
            const currentIterDate = new Date(date);
            dayDiv.addEventListener('click', () => selectWeeklyDate(currentIterDate));
        }
        
        dayDiv.innerHTML = `<span class="text-[10px] font-bold tracking-widest mb-1 opacity-80">${dayName}</span><span class="text-2xl font-extrabold">${date.getDate()}</span>`;
        fragment.appendChild(dayDiv);
    }
    calendarDays.appendChild(fragment);
}

function checkDayHasAvailableSlots(date) {
    const fechaActual = toYYYYMMDD(date);
    const horasOcupadas = [...(cal_bookedSlots[fechaActual] || []), ...window.getBreakTimes()];
    const now = new Date();
    const isToday = date.getTime() === new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const minAdvance = parseInt(window.businessWebConfig?.anticipacion_turno_min || 0, 10) || 0;
    const sName = weeklySelectedService;
    let matchingService = null;
    if (globalSelectedProfessional && globalSelectedProfessional !== 'Cualquiera (Sin preferencia)') {
        matchingService = services.find(s => s.nombre === sName && s.profesional === globalSelectedProfessional);
    }
    if (!matchingService) {
        matchingService = services.find(s => s.nombre === sName);
    }
    let selectedDuration = parseInt((matchingService || {}).duracion || 30);
    
    let interval = 30;
    if (window.businessWebConfig && window.businessWebConfig.intervalo_turnos) {
        if (window.businessWebConfig.intervalo_turnos === 'servicio') {
            interval = selectedDuration;
        } else {
            interval = parseInt(window.businessWebConfig.intervalo_turnos) || 30;
        }
    }
    generateTimeSlots(window.businessWebConfig?.hora_apertura, window.businessWebConfig?.hora_cierre, interval);
    
    const blocksNeeded = Math.ceil(selectedDuration / interval);

    for (let i = 0; i < cal_availableTimes.length; i++) {
        if (window.isTimeInBreak(cal_availableTimes[i])) continue;
        let isBooked = false;
        const slotDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), ...cal_availableTimes[i].split(':').map(Number), 0, 0);
        for (let j = 0; j < blocksNeeded; j++) {
            if (i + j >= cal_availableTimes.length || horasOcupadas.includes(cal_availableTimes[i + j].substring(0, 5))) { isBooked = true; break; }
        }
        if (!isBooked && isToday && slotDate.getTime() <= now.getTime()) isBooked = true;
        if (!isBooked && minAdvance > 0 && slotDate.getTime() < (now.getTime() + (minAdvance * 60000))) isBooked = true;
        if (!isBooked) return true;
    }
    return false;
}

function selectWeeklyDate(date) {
    cal2_selectedDate = date;
    document.getElementById('selectedDateLabel').textContent = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }).format(date);
    document.getElementById('weeklyFecha').value = toYYYYMMDD(date);
    renderWeeklyCalendar();
    
    const container = document.getElementById('weeklyTimeSlots');
    container.innerHTML = '';
    document.getElementById('weeklyHora').value = '';
    cal2_selectedTime = null;
    
    const horasOcupadas = [...(cal_bookedSlots[toYYYYMMDD(date)] || []), ...window.getBreakTimes()];
    const now = new Date();
    const isToday = date.getTime() === new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const minAdvance = parseInt(window.businessWebConfig?.anticipacion_turno_min || 0, 10) || 0;
    const sName = weeklySelectedService;
    let matchingService = null;
    if (globalSelectedProfessional && globalSelectedProfessional !== 'Cualquiera (Sin preferencia)') {
        matchingService = services.find(s => s.nombre === sName && s.profesional === globalSelectedProfessional);
    }
    if (!matchingService) {
        matchingService = services.find(s => s.nombre === sName);
    }
    let selectedDuration = parseInt((matchingService || {}).duracion || 30);
    
    let interval = 30;
    if (window.businessWebConfig && window.businessWebConfig.intervalo_turnos) {
        if (window.businessWebConfig.intervalo_turnos === 'servicio') {
            interval = selectedDuration;
        } else {
            interval = parseInt(window.businessWebConfig.intervalo_turnos) || 30;
        }
    }
    generateTimeSlots(window.businessWebConfig?.hora_apertura, window.businessWebConfig?.hora_cierre, interval);
    
    const blocksNeeded = Math.ceil(selectedDuration / interval);

    let slotsGenerated = 0;
    let firstAvailableTime = null;
    cal_availableTimes.forEach((time, index) => {
        if (window.isTimeInBreak(time)) return;
        let isBooked = false;
        const slotDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), ...time.split(':').map(Number), 0, 0);
        for (let i = 0; i < blocksNeeded; i++) {
            if (index + i >= cal_availableTimes.length || horasOcupadas.includes(cal_availableTimes[index + i].substring(0, 5))) { isBooked = true; break; }
        }
        if (!isBooked && isToday && slotDate.getTime() <= now.getTime()) isBooked = true;
        if (!isBooked && minAdvance > 0 && slotDate.getTime() < (now.getTime() + (minAdvance * 60000))) isBooked = true;

        if (!isBooked) {
            if (!firstAvailableTime) firstAvailableTime = time;
            slotsGenerated++;
            const slot = document.createElement('div');
            slot.textContent = time;
            slot.className = 'time-slot bg-slate-100 dark:bg-slate-800 text-center py-3.5 rounded-xl text-sm font-extrabold border border-slate-200 dark:border-slate-700 hover:border-primary hover:text-primary cursor-pointer transition-all hover:shadow-md';
            slot.addEventListener('click', () => {
                document.querySelectorAll('#weeklyTimeSlots .time-slot').forEach(el => el.classList.remove('selected', 'bg-primary', 'text-white', 'border-primary', 'shadow-md'));
                slot.classList.add('selected', 'bg-primary', 'text-white', 'border-primary', 'shadow-md');
                slot.classList.remove('bg-slate-100', 'dark:bg-slate-800', 'text-slate-800', 'dark:text-slate-100');
                cal2_selectedTime = time;
                document.getElementById('weeklyHora').value = time;
            });
            container.appendChild(slot);
        }
    });
    
    if (firstAvailableTime && !cal2_selectedTime) {
        const slots = container.querySelectorAll('.time-slot');
        for(let slot of slots) {
            if (slot.textContent === firstAvailableTime) {
                slot.click();
                break;
            }
        }
    }
    
    if (slotsGenerated === 0) container.innerHTML = '<div class="col-span-full p-6 text-center text-red-500 bg-red-50 rounded-xl font-bold">No hay horarios disponibles para este día.</div>';
}

function findNextAvailableSlot() {
    const today = new Date(); today.setHours(0,0,0,0);
    for (let d = 0; d < 30; d++) {
        const testDate = new Date(today); testDate.setDate(today.getDate() + d);
        if (window.isWorkingDay(testDate) && (!cal_bookedSlots[toYYYYMMDD(testDate)] || !cal_bookedSlots[toYYYYMMDD(testDate)].includes('blocked_day'))) {
            if (checkDayHasAvailableSlots(testDate)) {
                document.getElementById('nextAvailableText').textContent = `${new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'short' }).format(testDate)}`;
                document.getElementById('nextAvailableBanner').classList.remove('hidden');
                if (!cal2_selectedDate) {
                    weekStartDate = new Date(testDate);
                    selectWeeklyDate(testDate);
                }
                return;
            }
        }
    }
}

// --- LÓGICA DE SELECCIÓN MÚLTIPLE Y BLOQUEOS ---
let isMultiSelectMode = false;
let selectedDates = [];

function toggleMultiSelectMode() {
    isMultiSelectMode = !isMultiSelectMode;
    selectedDates = [];
    
    const multiSelectActions = document.getElementById('multiSelectActions');
    if (multiSelectActions) {
        if (isMultiSelectMode) {
            multiSelectActions.classList.remove('hidden');
            multiSelectActions.classList.add('flex');
        } else {
            multiSelectActions.classList.add('hidden');
            multiSelectActions.classList.remove('flex');
        }
    }
    
    const btnMultiSelect = document.getElementById('btnMultiSelect');
    if (btnMultiSelect) {
        btnMultiSelect.classList.toggle('bg-primary', isMultiSelectMode);
        btnMultiSelect.classList.toggle('text-white', isMultiSelectMode);
    }
    
    if (typeof updateMultiSelectUI === 'function') {
        updateMultiSelectUI();
    }
    cal_renderCalendar();
}

window.updateMultiSelectUI = function() {
    const instruction = document.getElementById('multiSelectInstruction');
    const activeDiv = document.getElementById('multiSelectActive');
    const btnBlock = document.getElementById('btnBulkBlock');
    const btnUnblock = document.getElementById('btnBulkUnblock');
    const countSpan = document.getElementById('selectedDaysCount');

    if (!instruction || !activeDiv) return;

    if (selectedDates.length === 0) {
        instruction.classList.remove('hidden');
        activeDiv.classList.add('hidden');
        activeDiv.classList.remove('flex');
    } else {
        instruction.classList.add('hidden');
        activeDiv.classList.remove('hidden');
        activeDiv.classList.add('flex');
        if (countSpan) countSpan.textContent = selectedDates.length;

        let hasBlocked = false;
        let hasUnblocked = false;

        selectedDates.forEach(dateStr => {
            const isGeneralBlock = cal_bookedSlots[dateStr] && cal_bookedSlots[dateStr].includes('blocked_day');
            let isProfBlock = cal_bookedSlots[dateStr] && cal_bookedSlots[dateStr].includes('blocked_day_prof');
            if (!globalSelectedProfessional || globalSelectedProfessional === 'columnas' || globalSelectedProfessional === 'Cualquiera (Sin preferencia)') {
                isProfBlock = false;
            }
            
            if (isGeneralBlock || isProfBlock) {
                hasBlocked = true;
            } else {
                hasUnblocked = true;
            }
        });

        if (btnBlock) btnBlock.classList.toggle('hidden', !hasUnblocked);
        if (btnUnblock) btnUnblock.classList.toggle('hidden', !hasBlocked);
    }
};

window.handleDayClick = function(date) {
    if (isMultiSelectMode) {
        const dStr = toYYYYMMDD(date);
        const index = selectedDates.indexOf(dStr);
        if (index > -1) selectedDates.splice(index, 1);
        else selectedDates.push(dStr);
        
        updateMultiSelectUI();
        cal_renderCalendar(); 
        return;
    }
    cal_selectDate(date); // Si no está en multiselección, se comporta normal
};

window.bulkAction = function(action) { // action = 'block_day' o 'unblock_day'
    if (selectedDates.length === 0) {
        showToast('Selecciona al menos un día.', 'error');
        return;
    }
    
    const actionText = action === 'block_day' ? 'Bloquear Todos' : 'Desbloquear Todos';
    const title = action === 'block_day' ? 'Bloqueo Múltiple' : 'Desbloqueo Múltiple';
    const msg = action === 'block_day' 
        ? `¿Bloquear los ${selectedDates.length} días seleccionados?` 
        : `¿Desbloquear los ${selectedDates.length} días seleccionados?`;
    const btnColor = action === 'block_day' ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600';
    
    showConfirm(title, msg, actionText, btnColor, () => {
        const promises = selectedDates.map(dateStr => {
            let bodyParams = `fecha=${dateStr}&action=${action}`;
            if (globalSelectedProfessional && globalSelectedProfessional !== 'columnas' && globalSelectedProfessional !== 'Cualquiera (Sin preferencia)') {
                bodyParams += `&profesional=${encodeURIComponent(globalSelectedProfessional)}`;
            }
            return fetch('backend/gestionar_turnos.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: bodyParams
            }).then(r => r.json());
        });

        return Promise.all(promises).then(() => {
            showToast(`Días ${action === 'block_day' ? 'bloqueados' : 'desbloqueados'} exitosamente`, 'success');
            toggleMultiSelectMode();
            cal_fetchBookedTimes();
        }).catch(() => showToast('Hubo errores al procesar la acción', 'error'));
    });
};

window.bloquearHorario = function(fecha, hora, prof = null) {
    showConfirm('Bloquear Horario', `¿Deseas bloquear las ${hora} del día ${fecha}?`, 'Bloquear', 'bg-red-500 hover:bg-red-600', () => {
        const formData = new FormData();
        formData.append('action', 'block_time');
        formData.append('fecha', fecha);
        formData.append('hora', hora);
        
        const profToBlock = prof || globalSelectedProfessional;
        if (profToBlock && profToBlock !== 'Cualquiera (Sin preferencia)' && profToBlock !== 'columnas') {
            formData.append('profesional', profToBlock);
        }

        return fetch('backend/gestionar_turnos.php', { method: 'POST', body: formData })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                showToast('Horario bloqueado', 'success');
                fetchAllAppointments().then(() => cal_fetchBookedTimes());
            } else {
                showToast(data.error || 'Error al bloquear', 'error');
            }
        }).catch(() => showToast('Error de red', 'error'));
    });
};

window.contactarWhatsApp = function(cel, nombre) {
    if (!cel) { showToast('Este cliente no tiene celular registrado.', 'error'); return; }
    let numero = cel.replace(/\D/g, '');
    let url = `https://wa.me/${numero}?text=Hola ${nombre}, te contacto desde la agenda de turnos.`;
    window.open(url, '_blank');
};

function toYYYYMMDD(date) {
    return new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
}

document.addEventListener('DOMContentLoaded', () => {
    if (typeof applyWebCustomization === 'function') applyWebCustomization();
    if (typeof fetchServices === 'function') fetchServices();
    
    if (isAdmin) {
        fetchAllAppointments(); 
        const adminMenu = document.getElementById('adminProfileMenu');
        if (adminMenu) adminMenu.classList.replace('hidden', 'flex');
        const adminControls = document.getElementById('adminControls');
        if (adminControls) {
            adminControls.classList.remove('hidden');
            if (adminControls.classList.contains('flex-wrap')) adminControls.classList.add('flex');
        }
    }
    
    const form = document.getElementById('weeklyBookingForm');
    if (form) {
        document.getElementById('prevWeek').addEventListener('click', () => { weekStartDate.setDate(weekStartDate.getDate() - 7); renderWeeklyCalendar(); });
        document.getElementById('nextWeek').addEventListener('click', () => { weekStartDate.setDate(weekStartDate.getDate() + 7); renderWeeklyCalendar(); });

        form.addEventListener('submit', function(e) {
            e.preventDefault();
            if (!weeklySelectedService) return showToast('Por favor, selecciona un servicio.', 'error');
            if (!cal2_selectedTime) return showToast('Por favor, selecciona un horario en la grilla.', 'error');
            
            const btn = document.getElementById('btnWeeklySubmit');
            const formData = new FormData(this);
            formData.append('negocio', negocioSlug);
            btn.disabled = true; btn.textContent = 'Enviando...';
            
            fetch('backend/enviar_turno.php', { method: 'POST', body: formData })
            .then(res => res.json()).then(data => {
                if (data.success) {
                    document.getElementById('bookingSuccessModal').classList.remove('hidden');
                    setTimeout(() => { document.getElementById('bookingSuccessModal').classList.remove('opacity-0'); document.getElementById('bookingSuccessModalContent').classList.remove('scale-95'); }, 10);
                } else showToast(data.error || 'Ocurrió un error.', 'error');
            }).catch(err => showToast('Error de conexión.', 'error')).finally(() => { btn.disabled = false; btn.innerHTML = 'Confirmar Reserva <span class="material-symbols-outlined text-xl">check_circle</span>'; });
        });
        
        const prevClientBtnWeekly = document.getElementById('previewClientBtnWeekly');
        if (prevClientBtnWeekly) {
            prevClientBtnWeekly.addEventListener('click', () => {
                isPreviewMode = !isPreviewMode;
                if (isPreviewMode) {
                    prevClientBtnWeekly.innerHTML = '<span class="material-symbols-outlined text-sm">visibility_off</span> Salir de Vista Cliente';
                    prevClientBtnWeekly.classList.replace('bg-white', 'bg-slate-800');
                    prevClientBtnWeekly.classList.replace('text-primary', 'text-white');
                } else {
                    prevClientBtnWeekly.innerHTML = '<span class="material-symbols-outlined text-sm">visibility</span> Vista Cliente';
                    prevClientBtnWeekly.classList.replace('bg-slate-800', 'bg-white');
                    prevClientBtnWeekly.classList.replace('text-white', 'text-primary');
                }
                initWizard();
            });
        }
        
        const adminPrevWBtn = document.getElementById('adminPrevWeekBtn');
        const adminNextWBtn = document.getElementById('adminNextWeekBtn');
        if (adminPrevWBtn) adminPrevWBtn.addEventListener('click', () => { weekStartDate.setDate(weekStartDate.getDate() - 7); renderAdminWeeklyGrid(); });
        if (adminNextWBtn) adminNextWBtn.addEventListener('click', () => { weekStartDate.setDate(weekStartDate.getDate() + 7); renderAdminWeeklyGrid(); });
    }
    
    // Funciones del calendario mensual interactivo
    const bookingForm = document.getElementById('bookingForm');
    const previewClientBtn = document.getElementById('previewClientBtn');
    
    if (previewClientBtn) {
        previewClientBtn.addEventListener('click', () => {
            isPreviewMode = !isPreviewMode;
            const shareBtn = document.querySelector('#adminControls button[onclick="copyMyLink()"]');
            const manageBtn = document.getElementById('manageServicesBtn');
            const multiSelectBtn = document.getElementById('btnMultiSelect');

            if (isPreviewMode) {
                // --- Entrando en Vista Cliente ---
                if(shareBtn) shareBtn.classList.add('hidden');
                if(manageBtn) manageBtn.classList.add('hidden');
                if(multiSelectBtn) multiSelectBtn.classList.add('hidden');

                previewClientBtn.innerHTML = '<span class="material-symbols-outlined text-[20px]">visibility_off</span> Salir de Vista Cliente';
                previewClientBtn.classList.replace('bg-white', 'bg-slate-800');
                previewClientBtn.classList.replace('text-slate-600', 'text-white');
                previewClientBtn.classList.remove('hover:text-primary');
                
                if (globalSelectedProfessional === 'columnas') {
                    globalSelectedProfessional = '';
                    cal_fetchBookedTimes();
                }
            } else {
                // --- Saliendo de Vista Cliente ---
                if(shareBtn) shareBtn.classList.remove('hidden');
                if(manageBtn) manageBtn.classList.remove('hidden');
                if(multiSelectBtn) multiSelectBtn.classList.remove('hidden');

                previewClientBtn.innerHTML = '<span class="material-symbols-outlined text-[20px]">visibility</span> Vista Cliente';
                previewClientBtn.classList.replace('bg-slate-800', 'bg-white');
                previewClientBtn.classList.replace('text-white', 'text-slate-600');
                previewClientBtn.classList.add('hover:text-primary');
            }
            populateCalendarViewFilter();
            updateServiceDropdown();
            updateProfServicesDisplay();
            cal_renderCalendar();
            if (cal_selectedDate) cal_selectDate(cal_selectedDate);
            else cal_selectDate(new Date());
        });
    }
    
    if (bookingForm) {
        const serviceSelect = document.getElementById('serviceSelect');
        const profSelect = document.getElementById('profesionalSelect');

        if (serviceSelect && profSelect) {
            serviceSelect.addEventListener('change', () => {
                const selectedServiceName = serviceSelect.value;
                const matchingServices = services.filter(s => s.nombre === selectedServiceName);
                const professionals = matchingServices.map(s => s.profesional).filter(p => p && p.trim() !== '');
                const uniqueProfessionals = [...new Set(professionals)];

                profSelect.innerHTML = '';
                if (uniqueProfessionals.length === 0) {
                    profSelect.innerHTML = '<option value="Cualquiera (Sin preferencia)" selected>Cualquiera (Sin preferencia)</option>';
                } else if (uniqueProfessionals.length === 1) {
                    profSelect.innerHTML = `<option value="${uniqueProfessionals[0]}" selected>${uniqueProfessionals[0]}</option>`;
                } else {
                    profSelect.innerHTML = '<option value="Cualquiera (Sin preferencia)" selected>Cualquiera (Sin preferencia)</option>';
                    uniqueProfessionals.forEach(prof => {
                        profSelect.innerHTML += `<option value="${prof}">${prof}</option>`;
                    });
                }
                
                if (globalSelectedProfessional && uniqueProfessionals.includes(globalSelectedProfessional)) {
                    profSelect.value = globalSelectedProfessional;
                } else if (uniqueProfessionals.length === 1) {
                    globalSelectedProfessional = uniqueProfessionals[0];
                    const globalFilter = document.getElementById('calendarViewFilter');
                    if (globalFilter) {
                        const optExists = Array.from(globalFilter.options).some(opt => opt.value === globalSelectedProfessional);
                        globalFilter.value = optExists ? globalSelectedProfessional : '';
                    }
                    updateProfServicesDisplay();
                } else {
                    globalSelectedProfessional = '';
                    const globalFilter = document.getElementById('calendarViewFilter');
                    if (globalFilter) globalFilter.value = '';
                    updateProfServicesDisplay();
                }
                
                cal_fetchBookedTimes();
                if (cal_selectedDate && (!isAdmin || isPreviewMode)) cal_renderTimeSlots();
            });
        }

        if (profSelect) {
            profSelect.addEventListener('change', (e) => {
                globalSelectedProfessional = e.target.value === 'Cualquiera (Sin preferencia)' ? '' : e.target.value;
                const globalFilter = document.getElementById('calendarViewFilter');
                if (globalFilter) {
                    const optExists = Array.from(globalFilter.options).some(opt => opt.value === globalSelectedProfessional);
                    globalFilter.value = optExists ? globalSelectedProfessional : '';
                }
                updateServiceDropdown();
                updateProfServicesDisplay();
                cal_fetchBookedTimes();
                if (cal_selectedDate && (!isAdmin || isPreviewMode)) cal_renderTimeSlots();
            });
        }

        const prevMonthBtn = document.getElementById('prevMonth');
        if (prevMonthBtn) prevMonthBtn.addEventListener('click', () => { cal_currentDate.setMonth(cal_currentDate.getMonth() - 1); cal_renderCalendar(); });
        
        const nextMonthBtn = document.getElementById('nextMonth');
        if (nextMonthBtn) nextMonthBtn.addEventListener('click', () => { cal_currentDate.setMonth(cal_currentDate.getMonth() + 1); cal_renderCalendar(); });

        bookingForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const msgDiv = document.getElementById('formMessage');
            
            if (!cal_selectedTime) {
                msgDiv.className = 'p-4 rounded-xl text-sm mt-2 font-medium bg-red-100 text-red-800';
                msgDiv.classList.remove('hidden');
                msgDiv.textContent = 'Por favor, selecciona un horario disponible.';
                return;
            }

            const btnSubmit = document.getElementById('btnSubmit');
            const formData = new FormData(this);
            formData.append('negocio', negocioSlug);
            
            btnSubmit.disabled = true;
            btnSubmit.textContent = 'Enviando...';
            
            fetch('backend/enviar_turno.php', { method: 'POST', body: formData })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    const modal = document.getElementById('bookingSuccessModal');
                    const content = document.getElementById('bookingSuccessModalContent');
                    if (modal && content) {
                        modal.classList.remove('hidden');
                        setTimeout(() => {
                            modal.classList.remove('opacity-0');
                            content.classList.remove('scale-95');
                        }, 10);
                    } else {
                        window.location.reload();
                    }
                } else {
                    msgDiv.className = 'p-4 rounded-xl text-sm mt-2 font-medium bg-red-100 text-red-800';
                    msgDiv.classList.remove('hidden');
                    msgDiv.textContent = data.error || 'Ocurrió un error.';
                }
            }).catch((err) => {
                msgDiv.className = 'p-4 rounded-xl text-sm mt-2 font-medium bg-red-100 text-red-800';
                msgDiv.classList.remove('hidden');
                msgDiv.textContent = 'Error de conexión. Intenta nuevamente.';
            }).finally(() => { btnSubmit.disabled = false; btnSubmit.textContent = 'Solicitar Turno'; });
        });

        cal_renderCalendar();
        cal_fetchBookedTimes();

        const manageServicesBtn = document.getElementById('manageServicesBtn');
        if(manageServicesBtn) manageServicesBtn.addEventListener('click', openServicesModal);
        
        const closeServicesBtn = document.getElementById('closeServicesModalBtn');
        if(closeServicesBtn) closeServicesBtn.addEventListener('click', closeServicesModal);
        
        const srvForm = document.getElementById('serviceForm');
        if (srvForm) srvForm.addEventListener('submit', handleServiceFormSubmit);
        
        const cancelEditBtn = document.getElementById('cancelEditBtn');
        if (cancelEditBtn) cancelEditBtn.addEventListener('click', (e) => { e.preventDefault(); resetServiceForm(); });
    }

    const manualTurnoForm = document.getElementById('manualTurnoForm');
    if (manualTurnoForm) {
        manualTurnoForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const btn = this.querySelector('button[type="submit"]');
            const origText = btn.textContent;
            btn.textContent = 'Guardando...';
            btn.disabled = true;

            fetch('backend/gestionar_turnos.php', {
                method: 'POST',
                body: new FormData(this)
            })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    showToast('Guardado correctamente', 'success');
                    closeManualTurnoModal();
                    fetchAllAppointments().then(() => cal_fetchBookedTimes());
                } else {
                    showToast(data.error || 'Ocurrió un error al guardar.', 'error');
                }
            })
            .catch(() => showToast('Error de conexión.', 'error'))
            .finally(() => {
                btn.textContent = origText;
                btn.disabled = false;
            });
        });
    }
});