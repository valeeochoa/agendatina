window.logoutDashboard = function() {
    if (typeof logout === 'function') logout();
};

document.addEventListener('DOMContentLoaded', () => {
    if (typeof loadDashboardData === 'function') {
        loadDashboardData();
    }
});

// Interceptamos la carga de datos para inyectar nuestras correcciones
const originalLoadDashboardData = window.loadDashboardData;
window.loadDashboardData = function() {
    // 1. Ejecutar la carga normal primero
    if (originalLoadDashboardData) originalLoadDashboardData();
    
    // 2. Asegurar que el enlace del calendario se actualice con la vista correcta
    setTimeout(() => {
        if (window.currentBusinessData && window.currentBusinessData.ruta) {
            const cardCalendario = document.getElementById('cardCalendario');
            const isWeekly = window.currentWebData?.tipo_calendario === 'semanal';
                const calPage = isWeekly ? 'calendarioSemanal.html' : 'calendarioMensual.html';
                if (cardCalendario) cardCalendario.href = calPage;
        }
        
        // 3. Gestionar permisos según el rol
        if (window.currentUserData) {
            const rol = window.currentUserData.rol_en_local;
            if (rol === 'profesional') {
                // Ocultar tarjetas administrativas al empleado
                ['cardCalendario', 'cardWeb', 'cardTeam'].forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.style.display = 'none';
                });
                
                // Ocultar Banner de pago y Ajustes Generales
                const banner = document.getElementById('subscriptionBanner');
                if (banner) banner.style.display = 'none';
                
                // Cambiar saludo y redireccionar enlace
                const subGreeting = document.getElementById('dashSubGreeting');
                if (subGreeting) subGreeting.textContent = 'Aquí puedes visualizar y gestionar tu propia lista de turnos asignados.';
            } else {
                // Si es dueño (admin), cargar la lista de profesionales para el límite
                loadTeamList();
            }
        }
    }, 200);
};

window.openTeamModal = function() {
    const modal = document.getElementById('teamModal');
    const content = document.getElementById('teamModalContent');
    if (!modal || !content) return;
    modal.classList.remove('hidden');
    setTimeout(() => { modal.classList.remove('opacity-0'); content.classList.remove('scale-95'); }, 10);
    loadTeamList();
};

window.closeTeamModal = function() {
    const modal = document.getElementById('teamModal');
    const content = document.getElementById('teamModalContent');
    if (!modal || !content) return;
    modal.classList.add('opacity-0');
    content.classList.add('scale-95');
    setTimeout(() => { modal.classList.add('hidden'); document.getElementById('teamForm').reset(); }, 300);
};

function loadTeamList() {
    fetch('backend/gestionar_profesionales.php').then(res=>res.json()).then(data => {
        if (data.success) {
            const limitEl = document.getElementById('teamLimitCount');
            if (limitEl) limitEl.textContent = data.limite;
            
            const list = document.getElementById('teamList');
            if (list) {
                list.innerHTML = '';
                if (data.data.length === 0) {
                    list.innerHTML = '<p class="text-sm text-slate-500 text-center py-4 border border-dashed border-slate-200 rounded-xl">No tienes cuentas de profesionales registradas.</p>';
                } else {
                    data.data.forEach(p => {
                        list.innerHTML += `
                            <div class="flex items-center justify-between p-4 border border-slate-100 rounded-xl bg-white shadow-sm hover:shadow-md transition-all">
                                <div>
                                    <p class="font-bold text-slate-800 text-sm flex items-center gap-1"><span class="material-symbols-outlined text-[16px] text-purple-600">badge</span> ${p.nombre_completo}</p>
                                    <p class="text-xs text-slate-500 mt-0.5">${p.email}</p>
                                </div>
                                <button onclick="deleteTeamMember(${p.id})" class="text-red-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-lg transition-colors" title="Revocar Acceso"><span class="material-symbols-outlined text-[20px] block">person_remove</span></button>
                            </div>
                        `;
                    });
                }
                const form = document.getElementById('teamForm');
                if (data.data.length >= parseInt(data.limite)) {
                    if (form) form.classList.add('hidden');
                } else {
                    if (form) form.classList.remove('hidden');
                }
            }
        }
    });
}

document.getElementById('teamForm')?.addEventListener('submit', function(e) {
    e.preventDefault();
    const btn = document.getElementById('btnTeamSubmit');
    const orig = btn.innerHTML;
    btn.disabled = true; btn.innerHTML = 'Creando Cuenta...';
    fetch('backend/gestionar_profesionales.php', { method: 'POST', body: new FormData(this) })
    .then(res=>res.json()).then(data => {
        if (data.success) {
            if(typeof showToast === 'function') showToast('Cuenta creada exitosamente', 'success');
            this.reset();
            loadTeamList();
        } else {
            if(typeof showToast === 'function') showToast(data.error, 'error'); else alert(data.error);
        }
    }).finally(() => { btn.disabled = false; btn.innerHTML = orig; });
});

window.deleteTeamMember = function(id) {
    if(confirm('¿Seguro que deseas eliminar a este profesional?\n\nPerderá el acceso instantáneamente a la plataforma.')) {
        fetch('backend/gestionar_profesionales.php?id=' + id, {method: 'DELETE'}).then(res=>res.json()).then(data => {
            if(data.success) { if(typeof showToast === 'function') showToast('Acceso Revocado', 'success'); loadTeamList(); }
            else { if(typeof showToast === 'function') showToast(data.error, 'error'); else alert(data.error); }
        });
    }
};

// ==========================================
// LÓGICA DE TOUR VIRTUAL (ONBOARDING)
// ==========================================
let currentTourStep = 0;
let currentTourTarget = null;
let tourResizeListener = null;

const tourSteps = [
    { target: 'cardCalendario', title: '1. Tu Motor Principal', text: 'Aquí definirás tus horarios de atención, el tipo de calendario (mensual o semanal) y los servicios que ofreces.', position: 'top' },
    { target: 'cardWeb', title: '2. Tu Vitrina Online', text: 'Personaliza la página pública que verán tus clientes al reservar. Sube fotos, certificados y cambia los colores.', position: 'top' },
    { target: 'cardAgenda', title: '3. Recepción de Turnos', text: 'En esta sección administrarás y confirmarás los turnos que tus clientes vayan solicitando en tu web.', position: 'top' },
    { target: 'navAvatar', title: '4. Tu Perfil y Logo', text: 'Haz clic en tus iniciales arriba a la derecha para modificar tu información personal y subir el logo de tu negocio.', position: 'bottom' }
];

window.startTour = function() {
    currentTourStep = 0;
    const overlay = document.getElementById('tourOverlay');
    const tooltip = document.getElementById('tourTooltip');
    const highlight = document.getElementById('tourHighlight');
    
    if(!overlay || !tooltip || !highlight) return;
    
    // Evitar scroll manual que desalinee el highlight
    document.body.style.overflow = 'hidden';

    overlay.classList.remove('hidden');
    highlight.classList.remove('hidden');
    tooltip.classList.remove('hidden');
    
    void overlay.offsetWidth; // Forzar Reflow para que las transiciones CSS funcionen
    overlay.classList.remove('opacity-0');
    
    showTourStep(currentTourStep);

    // Reposicionar dinámicamente si el usuario rota el teléfono o cambia el tamaño
    tourResizeListener = () => showTourStep(currentTourStep, false);
    window.addEventListener('resize', tourResizeListener);
    window.addEventListener('scroll', tourResizeListener, true);
};

window.endTour = function() {
    const overlay = document.getElementById('tourOverlay');
    const tooltip = document.getElementById('tourTooltip');
    const highlight = document.getElementById('tourHighlight');
    
    tooltip.classList.add('opacity-0', 'scale-95');
    tooltip.classList.remove('opacity-100', 'scale-100');
    highlight.classList.add('opacity-0');
    overlay.classList.add('opacity-0');

    document.body.style.overflow = '';
    window.removeEventListener('resize', tourResizeListener);
    window.removeEventListener('scroll', tourResizeListener, true);

    setTimeout(() => {
        overlay.classList.add('hidden');
        tooltip.classList.add('hidden');
        highlight.classList.add('hidden');
        currentTourTarget = null;
    }, 300);
};

window.nextTourStep = function() {
    currentTourStep++;
    if (currentTourStep >= tourSteps.length) {
        endTour();
        if (typeof showToast === 'function') showToast('¡Has completado el recorrido!', 'success');
    } else {
        showTourStep(currentTourStep);
    }
};

function showTourStep(index, doScroll = true) {
    const step = tourSteps[index];
    const target = document.getElementById(step.target);
    const tooltip = document.getElementById('tourTooltip');
    const highlight = document.getElementById('tourHighlight');
    const arrow = document.getElementById('tourArrow');

    if (!target) {
        if (doScroll) nextTourStep();
        return;
    }

    currentTourTarget = target;

    if (doScroll) {
        // Scrollear hacia el elemento dejándolo en el centro con un pequeño margen
        const rect = target.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        let targetY = rect.top + scrollTop - 120; // Offset para el navbar y padding
        if (step.position === 'bottom') targetY -= 200; // Si el tooltip va abajo, subimos más la pantalla
        
        window.scrollTo({ top: targetY, behavior: 'smooth' });
    }

    // Dar un tiempo (400ms) para que termine el smooth scroll antes de posicionar todo
    setTimeout(() => {
        const rect = target.getBoundingClientRect();
        
        // Posicionar y dar tamaño al marco iluminado (Highlight box)
        highlight.style.top = (rect.top - 8) + 'px';
        highlight.style.left = (rect.left - 8) + 'px';
        highlight.style.width = (rect.width + 16) + 'px';
        highlight.style.height = (rect.height + 16) + 'px';
        
        // Igualar el radio de borde para que no desentone con la tarjeta redonda
        const targetRadius = window.getComputedStyle(target).borderRadius;
        highlight.style.borderRadius = targetRadius && targetRadius !== '0px' ? targetRadius : '1.5rem';
        
        highlight.classList.remove('opacity-0');

        // Actualizar textos del tooltip
        document.getElementById('tourTitle').textContent = step.title;
        document.getElementById('tourText').textContent = step.text;
        document.getElementById('tourStepIndicator').textContent = `${index + 1}/${tourSteps.length}`;
        
        const nextBtn = document.getElementById('tourNextBtn');
        if (index === tourSteps.length - 1) {
            nextBtn.innerHTML = 'Finalizar <span class="material-symbols-outlined text-[16px]">check</span>';
        } else {
            nextBtn.innerHTML = 'Siguiente <span class="material-symbols-outlined text-[16px]">arrow_forward</span>';
        }

        // Posicionar el Tooltip (el cuadrito de diálogo)
        const tooltipRect = tooltip.getBoundingClientRect();
        let top, left;
        let arrowClass = '';

        if (step.position === 'top') {
            top = rect.top - tooltipRect.height - 25;
            left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
            arrowClass = 'bottom-[-6px] left-1/2 -translate-x-1/2 !border-t-0 !border-l-0 border-b border-r';
        } else if (step.position === 'bottom') {
            top = rect.bottom + 25;
            left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
            arrowClass = 'top-[-6px] left-1/2 -translate-x-1/2 !border-b-0 !border-r-0 border-t border-l';
        }

        // Correcciones de pantalla si el tooltip choca contra los bordes del celular
        if (left < 20) {
            left = Math.max(20, rect.left);
            arrowClass = arrowClass.replace('-translate-x-1/2', '').replace('left-1/2', 'left-8');
        } else if (left + tooltipRect.width > window.innerWidth - 20) {
            left = window.innerWidth - tooltipRect.width - 20;
            // Intentar alinear la flecha con el elemento
            const arrowOffset = (rect.left + rect.width / 2) - left;
            if (arrowOffset > 0 && arrowOffset < tooltipRect.width) {
                arrowClass = arrowClass.replace('-translate-x-1/2', '').replace('left-1/2', '');
                arrow.style.left = arrowOffset + 'px';
            } else {
                arrowClass = arrowClass.replace('-translate-x-1/2', '').replace('left-1/2', 'right-8');
                arrow.style.left = '';
            }
        } else {
            arrow.style.left = '';
        }

        // Fallback por si la pantalla es muy corta y el tooltip se recorta con el techo
        if (top < 10 && step.position === 'top') {
            top = rect.bottom + 25; // Forzarlo abajo
            arrowClass = 'top-[-6px] left-1/2 -translate-x-1/2 !border-b-0 !border-r-0 border-t border-l';
        }

        tooltip.style.top = top + 'px';
        tooltip.style.left = left + 'px';
        arrow.className = `absolute w-3 h-3 bg-white border border-slate-200 transform rotate-45 shadow-sm ${arrowClass}`;

        tooltip.classList.remove('opacity-0', 'scale-95');
        tooltip.classList.add('opacity-100', 'scale-100');
    }, doScroll ? 400 : 0); // Solo esperar si hubo scroll previo
}