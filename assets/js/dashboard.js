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
        
        // 3. Gestionar permisos según el rol y verificación de correo (Modo DEMO oculta banners de verificación y pago)
        if (window.currentUserData) {
            const isDemo = (window.currentUserData.email && window.currentUserData.email.includes('demo')) ||
                           (window.currentBusinessData && (window.currentBusinessData.ruta === 'demo' || window.currentBusinessData.subdominio === 'demo' || window.currentBusinessData.is_demo === true));

            const vBanner = document.getElementById('verifyEmailBanner');
            const sBanner = document.getElementById('subscriptionBanner');

            if (isDemo) {
                if (vBanner) { vBanner.classList.add('hidden'); vBanner.style.setProperty('display', 'none', 'important'); }
                if (sBanner) { sBanner.classList.add('hidden'); sBanner.style.setProperty('display', 'none', 'important'); }
            } else {
                if (vBanner) {
                    const isVerified = parseInt(window.currentUserData.email_verificado || 0) === 1;
                    if (!isVerified) {
                        vBanner.classList.remove('hidden');
                        vBanner.style.display = 'flex';
                    } else {
                        vBanner.classList.add('hidden');
                        vBanner.style.display = 'none';
                    }
                }
            }

            // Cartel de bienvenida: En modo Demo muestra aviso demo + tour una sola vez por sesión; en cuentas reales muestra bienvenida una sola vez tras registro
            if (isDemo) {
                const demoNoticeShown = sessionStorage.getItem('agendatina_demo_notice_shown') === 'true';
                if (!demoNoticeShown) {
                    setTimeout(() => {
                        if (typeof window.openDemoWelcomeNoticeModal === 'function') {
                            window.openDemoWelcomeNoticeModal();
                        }
                    }, 400);
                }
            } else {
                const urlParams = new URLSearchParams(window.location.search);
                const hasWelcomeParam = urlParams.get('welcome') === '1' || sessionStorage.getItem('show_welcome_modal') === 'true';
                const bizId = (window.currentBusinessData && window.currentBusinessData.id) ? window.currentBusinessData.id : 'real_account';
                const key = 'agendatina_welcome_shown_' + bizId;
                const sessionKey = 'agendatina_real_welcome_shown_' + bizId;

                const alreadyShownInStorage = localStorage.getItem(key) === 'true';
                const alreadyShownInSession = sessionStorage.getItem(sessionKey) === 'true';

                // Limpiar el parámetro welcome=1 de la URL para que no persista al volver de otros segmentos
                if (urlParams.get('welcome') === '1') {
                    const cleanUrl = window.location.pathname;
                    window.history.replaceState({}, document.title, cleanUrl);
                }

                if (hasWelcomeParam && !alreadyShownInSession && !alreadyShownInStorage) {
                    sessionStorage.removeItem('show_welcome_modal');
                    sessionStorage.setItem(sessionKey, 'true');
                    localStorage.setItem(key, 'true');
                    setTimeout(() => {
                        if (typeof window.openWelcomeNewAccountModal === 'function') {
                            window.openWelcomeNewAccountModal(true);
                        }
                    }, 200);
                }
            }

            const rol = window.currentUserData.rol || window.currentUserData.rol_en_local;
            const perms = window.currentUserData.permisos || {};

            if (rol === 'profesional') {
                // Ocultar o mostrar tarjetas según permisos individuales
                if (perms.agenda === 0) {
                    ['cardAgenda', 'cardCalendario'].forEach(id => {
                        const el = document.getElementById(id);
                        if (el) el.style.display = 'none';
                    });
                }
                if (perms.web === 0) {
                    const elW = document.getElementById('cardWeb');
                    if (elW) elW.style.display = 'none';
                }
                if (perms.servicios === 0) {
                    const elS = document.getElementById('cardServicios');
                    if (elS) elS.style.display = 'none';
                }
                if (perms.estadisticas === 0) {
                    const elEst = document.getElementById('cardEstadisticas');
                    if (elEst) elEst.style.display = 'none';
                }
                if (perms.equipo === 0) {
                    const elT = document.getElementById('cardTeam');
                    if (elT) elT.style.display = 'none';
                }
                
                // Ocultar Banner de pago
                const banner = document.getElementById('subscriptionBanner');
                if (banner) banner.style.display = 'none';
                
                // Cambiar saludo
                const subGreeting = document.getElementById('dashSubGreeting');
                if (subGreeting) subGreeting.textContent = 'Aquí puedes visualizar las secciones y turnos habilitados por la administración.';
            } else {
                // Si es dueño (admin), cargar la lista de profesionales para el límite
                loadTeamList();
            }
        }
    }, 200);
};

window.openVerifyEmailModal = function() {
    const modal = document.getElementById('verifyEmailModal');
    if (modal) modal.classList.remove('hidden');
};

window.closeVerifyEmailModal = function() {
    const modal = document.getElementById('verifyEmailModal');
    if (modal) modal.classList.add('hidden');
};

window.resendVerifyCode = function(btn) {
    const orig = btn.innerHTML;
    btn.disabled = true;
    btn.textContent = 'Enviando...';
    
    fetch('backend/reenviar_codigo.php', { method: 'POST' })
    .then(res => res.json())
    .then(data => {
        const msg = document.getElementById('verifyEmailMsg');
        if (msg) {
            msg.className = data.success ? 'text-xs font-bold p-3 rounded-xl text-center bg-emerald-100 text-emerald-800' : 'text-xs font-bold p-3 rounded-xl text-center bg-red-100 text-red-800';
            msg.textContent = data.message || data.error;
            msg.classList.remove('hidden');
        }
    }).catch(() => {
        if (typeof showToast === 'function') showToast('Error de conexión.', 'error');
    }).finally(() => { btn.disabled = false; btn.innerHTML = orig; });
};

window.openTeamModal = function() {
    const modal = document.getElementById('teamModal');
    const content = document.getElementById('teamModalContent');
    if (!modal || !content) return;
    modal.classList.remove('hidden');
    setTimeout(() => { modal.classList.remove('opacity-0'); content.classList.remove('scale-95'); }, 10);
    setTimeout(() => { 
        modal.classList.remove('opacity-0'); 
        content.classList.remove('scale-95', 'animate-modal-pop');
        void content.offsetWidth;
        content.classList.add('animate-modal-pop');
    }, 10);
    loadTeamList();
};

window.closeTeamModal = function() {
    const modal = document.getElementById('teamModal');
    const content = document.getElementById('teamModalContent');
    if (!modal || !content) return;
    modal.classList.add('opacity-0');
    content.classList.remove('animate-modal-pop');
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
let legacyTourStep = 0;
let currentTourTarget = null;
let tourResizeListener = null;
let isAutoScrolling = false;

const legacyTourSteps = [
    { target: 'cardCalendario', title: '1. Gestionar Calendario', text: 'Define tus días de atención, franjas horarias de apertura/cierre, descansos y modalidad de turnos.', position: 'right' },
    { target: 'cardAgenda', title: '2. Mi Agenda Virtual', text: 'Administra y confirma turnos en tiempo real, filtra por cliente o servicio e interactúa con el historial y papelera.', position: 'right' },
    { target: 'cardWeb', title: '3. Mi Página Web', text: 'Personaliza la página pública que verán tus clientes al reservar. Sube fotos, logotipo y ajusta tus colores.', position: 'left' },
    { target: 'cardServicios', title: '4. Servicios', text: 'Carga todos los servicios de tu negocio, sus precios, duraciones en horas/minutos y profesionales asociados.', position: 'right' },
    { target: 'cardEquipo', title: '5. Equipo de Trabajo', text: 'Gestiona los profesionales de tu equipo, asigna servicios y administra cuentas de acceso.', position: 'right' },
    { target: 'cardEstadisticas', title: '6. Estadísticas', text: 'Visualiza el rendimiento de tu negocio, volumen de reservas e ingresos generados.', position: 'left' },
    { target: 'cardAjustes', title: '7. Ajustes', text: 'Configura colores de marca, modalidad de intervalo (por servicio o fija) y notificaciones por correo.', position: 'right' },
    { target: 'cardManual', title: '8. Manual de Uso', text: 'Guía interactiva completa con explicaciones paso a paso de cada módulo y alcance por plan.', position: 'left' },
    { target: 'cardFaq', title: '9. Consultas Frecuentes', text: 'Accede a preguntas frecuentes y respuestas rápidas sobre la plataforma.', position: 'left' },
    { target: 'cardMejora', title: '10. Sugerencias y Mejoras', text: 'Envía comentarios o sugerencias directamente a nuestro equipo de desarrollo.', position: 'top' },
    { target: 'navAvatar', title: '11. Mi Perfil', text: 'Haz clic en tu perfil para configurar tus datos de usuario, ver estadísticas rápidas y cambiar tu contraseña.', position: 'bottom' },
    { target: 'navNotifBtn', title: '12. Notificaciones 🔔', text: 'Consulta en tiempo real las notificaciones de nuevas reservas, cancelaciones o cambios en tus turnos.', position: 'bottom' },
    { target: 'navLogoutBtn', title: '13. Cerrar Sesión 🚪', text: 'Haz clic aquí para salir de tu cuenta de forma segura al finalizar tus tareas.', position: 'bottom' }
];

window.markOnboardingStepComplete = function(stepNumber, isCompleted) {
    const icon = document.getElementById(`step${stepNumber}Icon`);
    const text = document.getElementById(`step${stepNumber}Text`);
    if (!text) return;
    
    const desc = text.parentElement.nextElementSibling;
    const link = desc ? desc.nextElementSibling : null;

    if (isCompleted) {
        if (icon) {
            icon.innerHTML = '<span class="material-symbols-outlined text-white text-sm">check</span>';
            icon.className = 'w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-sm';
        }
        text.classList.add('line-through', 'text-slate-400');
        if (desc) desc.classList.add('line-through', 'opacity-50');
        if (link) link.style.display = 'none';
    } else {
        if (icon) {
            icon.innerHTML = stepNumber;
            icon.className = 'w-8 h-8 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-sm';
        }
        text.classList.remove('line-through', 'text-slate-400');
        if (desc) desc.classList.remove('line-through', 'opacity-50');
        if (link) link.style.display = '';
    }
};

window.openDemoWelcomeNoticeModal = function(force = false) {
    if (!force && sessionStorage.getItem('agendatina_demo_notice_shown') === 'true') {
        return;
    }
    sessionStorage.setItem('agendatina_demo_notice_shown', 'true');
    let modal = document.getElementById('demoNoticeModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'demoNoticeModal';
        modal.className = 'fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[250] flex items-center justify-center p-4 opacity-0 transition-opacity duration-300';
        modal.innerHTML = `
            <div class="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-lg w-full p-6 sm:p-8 text-center relative overflow-hidden transform scale-95 transition-transform duration-300" id="demoNoticeContent">
                <div class="absolute -top-12 -right-12 w-36 h-36 bg-gradient-to-br from-amber-400/20 to-orange-500/20 rounded-full blur-2xl pointer-events-none"></div>
                
                <div class="w-16 h-16 rounded-3xl bg-amber-50 text-[#fc8712] flex items-center justify-center mx-auto mb-4 shadow-sm border border-amber-200">
                    <span class="material-symbols-outlined text-4xl">visibility</span>
                </div>

                <span class="bg-amber-100 text-amber-900 border border-amber-300 text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider inline-block mb-3">Modo Demostración Activo</span>

                <h2 class="text-2xl sm:text-3xl font-extrabold text-slate-900 mb-2 tracking-tight">Estás en una cuenta DEMO 🚀</h2>
                <p class="text-xs sm:text-sm text-slate-600 mb-6 leading-relaxed">
                    Esta es una versión de prueba interactiva con todas las funciones del <strong>Plan Premium</strong> habilitadas para que explores la plataforma. A continuación puedes iniciar el tour guiado por la aplicación.
                </p>

                <div class="flex flex-col gap-3">
                    <button onclick="window.closeDemoNoticeAndStartTour()" style="background-color: #fc8712 !important; color: #ffffff !important;" class="w-full hover:opacity-90 font-extrabold py-3.5 px-6 rounded-2xl shadow-lg shadow-orange-500/25 hover:scale-[1.01] active:scale-95 transition-all flex items-center justify-center gap-2 text-sm cursor-pointer border-0">
                        <span class="material-symbols-outlined text-[20px]">explore</span> Entendido, iniciar Tour Virtual
                    </button>
                    <button onclick="window.closeDemoNoticeOnly()" class="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 px-6 rounded-2xl transition-all text-sm cursor-pointer border-0">
                        Explorar por mi cuenta
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    modal.classList.remove('hidden');
    modal.classList.add('flex');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        const content = document.getElementById('demoNoticeContent');
        if (content) content.classList.remove('scale-95');
    }, 10);
};

window.closeDemoNoticeOnly = function() {
    sessionStorage.setItem('agendatina_demo_notice_shown', 'true');
    const modal = document.getElementById('demoNoticeModal');
    if (modal) {
        modal.classList.add('opacity-0');
        const content = document.getElementById('demoNoticeContent');
        if (content) content.classList.add('scale-95');
        setTimeout(() => {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }, 250);
    }
};

window.closeDemoNoticeAndStartTour = function() {
    sessionStorage.setItem('agendatina_demo_notice_shown', 'true');
    const modal = document.getElementById('demoNoticeModal');
    if (modal) {
        modal.classList.add('opacity-0');
        const content = document.getElementById('demoNoticeContent');
        if (content) content.classList.add('scale-95');
        setTimeout(() => {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
            if (typeof window.startTour === 'function') {
                window.startTour();
            }
        }, 250);
    } else {
        if (typeof window.startTour === 'function') {
            window.startTour();
        }
    }
};

window.openWelcomeNewAccountModal = function(force = false) {
    // Si la cuenta es demo, NUNCA reabrir si ya se mostró en la sesión activa
    const isDemo = (window.currentUserData && (window.currentUserData.email === 'demo@agendatina.site' || window.currentUserData.email.includes('demo'))) || (window.currentBusinessData && (window.currentBusinessData.ruta === 'demo' || window.currentBusinessData.is_demo)) || sessionStorage.getItem('is_demo_user') === 'true';
    if (isDemo) {
        if (sessionStorage.getItem('agendatina_demo_notice_shown') !== 'true') {
            window.openDemoWelcomeNoticeModal();
        }
        return;
    }

    const modal = document.getElementById('welcomeNewAccountModal');
    const content = document.getElementById('welcomeNewAccountContent');
    if (!modal) return;

    const bizId = (window.currentBusinessData && window.currentBusinessData.id) ? window.currentBusinessData.id : null;
    if (bizId) {
        localStorage.setItem('agendatina_welcome_shown_' + bizId, 'true');
    }

    const bName = (window.currentBusinessData && window.currentBusinessData.nombre_fantasia) || (window.currentUserData && window.currentUserData.nombre_completo) || 'tu emprendimiento';
    const bNameEl = document.getElementById('welcomeBusinessName');
    if (bNameEl) bNameEl.textContent = bName;

    modal.classList.remove('hidden');
    modal.classList.add('flex');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        if (content) content.classList.remove('scale-95');
    }, 10);

    // Lanzar confeti de bienvenida 🎉 (Únicamente para cuentas reales)
    if (!isDemo && typeof confetti === 'function') {
        try {
            confetti({
                particleCount: 140,
                spread: 80,
                origin: { y: 0.55 },
                zIndex: 9999
            });
        } catch(eConfetti) {}
    }
};

window.closeWelcomeNewAccountModal = function() {
    const modal = document.getElementById('welcomeNewAccountModal');
    const content = document.getElementById('welcomeNewAccountContent');
    if (!modal) return;

    const bizId = (window.currentBusinessData && window.currentBusinessData.id) || 'real_business';
    localStorage.setItem('agendatina_welcome_shown_' + bizId, 'true');

    modal.classList.add('opacity-0');
    if (content) content.classList.add('scale-95');
    setTimeout(() => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }, 300);
};

window.startTour = function() {
    // Cerrar cartel de bienvenida
    window.closeWelcomeNewAccountModal();

    // Resetear checklist en modo demo
    if (window.currentUserData && window.currentUserData.email === 'demo@agendatina.site') {
        if (typeof window.markOnboardingStepComplete === 'function') {
            window.markOnboardingStepComplete(1, false);
            window.markOnboardingStepComplete(2, false);
            window.markOnboardingStepComplete(3, false);
        }
    }

    // Si no existen los elementos de onboarding en el DOM, los creamos dinámicamente
    if (!document.getElementById('tourOverlay')) {
        const onboardingContainer = document.createElement('div');
        onboardingContainer.id = 'tourOnboardingContainer';
        onboardingContainer.innerHTML = `
            <div id="tourOverlay" class="fixed inset-0 bg-slate-900/70 backdrop-blur-xs z-[200] transition-opacity duration-300 hidden opacity-0" onclick="endTour()"></div>
            <div id="tourHighlight" class="fixed pointer-events-none z-[201] bg-white border-2 border-primary transition-all duration-300 shadow-[0_0_30px_rgba(209,17,73,0.5)] hidden opacity-0"></div>
            <div id="tourTooltip" class="fixed bg-white rounded-3xl shadow-2xl p-6 border border-slate-100 max-w-sm w-[calc(100%-2rem)] sm:w-80 hidden z-[202] transition-all duration-300 opacity-0 scale-95">
                <div id="tourArrow" class="absolute w-3 h-3 bg-white border border-slate-200 transform rotate-45 shadow-sm"></div>
                <div class="relative z-10">
                    <h4 id="tourTitle" class="font-extrabold text-slate-800 text-base mb-2 font-display"></h4>
                    <p id="tourText" class="text-xs text-slate-500 mb-5 leading-relaxed"></p>
                    <div class="flex items-center justify-between border-t border-slate-100 pt-4 mt-2">
                        <span id="tourStepIndicator" class="text-xs font-bold text-slate-400"></span>
                        <div class="flex items-center gap-2">
                            <button onclick="endTour()" class="text-xs font-bold text-slate-400 hover:text-red-500 transition-colors px-3 py-2 rounded-lg hover:bg-slate-50">Omitir</button>
                            <button id="tourNextBtn" onclick="nextLegacyTourStep()" class="bg-primary hover:bg-primary/90 text-white font-bold text-xs py-2 px-4 rounded-xl transition-all shadow-md shadow-primary/20 flex items-center gap-1"></button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(onboardingContainer);
    }

    // Inyectar estilos de animación fluida para el tooltip si no existen
    if (!document.getElementById('tour-custom-animations')) {
        const style = document.createElement('style');
        style.id = 'tour-custom-animations';
        style.innerHTML = `
            @keyframes tourPop {
                0% { opacity: 0; transform: scale(0.85) translateY(15px); }
                60% { opacity: 1; transform: scale(1.03) translateY(-3px); }
                100% { opacity: 1; transform: scale(1) translateY(0); }
            }
            .animate-tour-pop {
                animation: tourPop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
            }
        `;
        document.head.appendChild(style);
    }

    legacyTourStep = 0;
    const overlay = document.getElementById('tourOverlay');
    const tooltip = document.getElementById('tourTooltip');
    const highlight = document.getElementById('tourHighlight');
    
    if(!overlay || !tooltip || !highlight) return;
    
    document.body.style.overflow = '';

    overlay.classList.remove('hidden');
    highlight.classList.remove('hidden');
    tooltip.classList.remove('hidden');
    
    void overlay.offsetWidth;
    overlay.classList.remove('opacity-0');
    
    showLegacyTourStep(legacyTourStep);

    tourResizeListener = () => {
        if (isAutoScrolling) return;
        showLegacyTourStep(legacyTourStep, false);
    };
    window.addEventListener('resize', tourResizeListener);
    window.addEventListener('scroll', tourResizeListener, true);
};

window.startGuidedVirtualTour = window.startTour;

window.endTour = function() {
    if (window.previousTourTarget) {
        window.previousTourTarget.style.position = '';
        window.previousTourTarget.style.zIndex = '';
        const nav = window.previousTourTarget.closest('nav');
        if (nav) nav.style.zIndex = '';
    }

    const overlay = document.getElementById('tourOverlay');
    const tooltip = document.getElementById('tourTooltip');
    const highlight = document.getElementById('tourHighlight');
    
    if (tooltip) {
        tooltip.classList.add('opacity-0', 'scale-95');
        tooltip.classList.remove('opacity-100', 'scale-100');
    }
    if (highlight) highlight.classList.add('opacity-0');
    if (overlay) overlay.classList.add('opacity-0');

    document.body.style.overflow = '';
    window.removeEventListener('resize', tourResizeListener);
    window.removeEventListener('scroll', tourResizeListener, true);
    isAutoScrolling = false;

    if (window.previousTourTarget) {
        window.previousTourTarget.style.zIndex = '';
        const nav = window.previousTourTarget.closest('nav');
        if (nav) nav.style.zIndex = '';
        window.previousTourTarget = null;
    }

    setTimeout(() => {
        if (overlay) overlay.classList.add('hidden');
        if (tooltip) tooltip.classList.add('hidden');
        if (highlight) highlight.classList.add('hidden');
        currentTourTarget = null;
    }, 300);
};

window.stopGuidedVirtualTour = window.endTour;

window.nextLegacyTourStep = function() {
    legacyTourStep++;
    if (legacyTourStep >= legacyTourSteps.length) {
        endTour();
        if (typeof showToast === 'function') showToast('¡Has completado el recorrido!', 'success');
    } else {
        showLegacyTourStep(legacyTourStep);
    }
};

window.nextTourStep = window.nextLegacyTourStep;

window.prevTourStep = function() {
    legacyTourStep = Math.max(0, legacyTourStep - 1);
    showLegacyTourStep(legacyTourStep);
};

function showLegacyTourStep(index, doScroll = true) {
    // Marcar dinámicamente los pasos a medida que se avanza en el recorrido
    if (window.currentUserData && window.currentUserData.email === 'demo@agendatina.site') {
        if (typeof window.markOnboardingStepComplete === 'function') {
            window.markOnboardingStepComplete(1, index >= 1);
            window.markOnboardingStepComplete(2, index >= 2);
            window.markOnboardingStepComplete(3, index >= 3);
        }
    }

    const step = legacyTourSteps[index];
    const target = document.getElementById(step.target);
    const tooltip = document.getElementById('tourTooltip');
    const highlight = document.getElementById('tourHighlight');
    const arrow = document.getElementById('tourArrow');

    if (!target || target.offsetParent === null || window.getComputedStyle(target).display === 'none') {
        if (doScroll) nextLegacyTourStep();
        return;
    }

    // Limpiar target anterior para que vuelva a oscurecerse
    if (window.previousTourTarget) {
        window.previousTourTarget.style.position = '';
        window.previousTourTarget.style.zIndex = '';
        const nav = window.previousTourTarget.closest('nav');
        if (nav) nav.style.zIndex = '';
    }

    currentTourTarget = target;
    window.previousTourTarget = target;

    // Elevar target actual sobre el marco blanco y fondo oscuro (z-index: 202 > highlight: 201 > overlay: 200)
    target.style.position = 'relative';
    target.style.zIndex = '202';
    const nav = target.closest('nav');
    if (nav) nav.style.zIndex = '202';

    const executeStep = () => {
        const rect = target.getBoundingClientRect();
        
        tooltip.classList.remove('hidden', 'scale-95', 'opacity-0');
        tooltip.classList.add('opacity-100', 'scale-100');
        const tWidth = tooltip.offsetWidth;
        const tHeight = tooltip.offsetHeight;
        
        highlight.style.top = (rect.top - 8) + 'px';
        highlight.style.left = (rect.left - 8) + 'px';
        highlight.style.width = (rect.width + 16) + 'px';
        highlight.style.height = (rect.height + 16) + 'px';
        const targetRadius = window.getComputedStyle(target).borderRadius;
        highlight.style.borderRadius = targetRadius && targetRadius !== '0px' ? targetRadius : '1.5rem';
        highlight.classList.remove('opacity-0');

        document.getElementById('tourTitle').textContent = step.title;
        
        const tourTextEl = document.getElementById('tourText');
        tourTextEl.textContent = step.text;
        
        if (step.target === 'cardWeb') {
            tourTextEl.style.textAlign = 'left';
        } else {
            tourTextEl.style.textAlign = '';
        }
        
        document.getElementById('tourStepIndicator').textContent = `${index + 1}/${legacyTourSteps.length}`;
        const nextBtn = document.getElementById('tourNextBtn');
        nextBtn.innerHTML = index === legacyTourSteps.length - 1 ? 'Finalizar <span class="material-symbols-outlined text-[16px]">check</span>' : 'Siguiente <span class="material-symbols-outlined text-[16px]">arrow_forward</span>';

        let pos = step.position;
        const gap = 20;
        const margin = 16;
        const ww = window.innerWidth;
        const wh = window.innerHeight;

        // Comprobamos dónde hay espacio suficiente
        const fitsLeft = (rect.left - gap - tWidth >= margin);
        const fitsRight = (rect.right + gap + tWidth <= ww - margin);
        const fitsTop = (rect.top - gap - tHeight >= margin + 90); // 90px extra por el navbar
        const fitsBottom = (rect.bottom + gap + tHeight <= wh - margin);

        // Fallback inteligente priorizando laterales antes que top/bottom
        if (pos === 'left' && !fitsLeft) pos = fitsRight ? 'right' : (fitsBottom ? 'bottom' : 'top');
        else if (pos === 'right' && !fitsRight) pos = fitsLeft ? 'left' : (fitsBottom ? 'bottom' : 'top');
        else if (pos === 'top' && !fitsTop) pos = fitsBottom ? 'bottom' : (fitsRight ? 'right' : 'left');
        else if (pos === 'bottom' && !fitsBottom) pos = fitsTop ? 'top' : (fitsRight ? 'right' : 'left');

        // Para la tarjeta web, asegurar que siempre quede al lado izquierdo si entra, sino a la derecha
        if (step.target === 'cardWeb') {
            if (fitsLeft) pos = 'left';
            else if (fitsRight) pos = 'right';
        }

        let top, left, arrowClass;
        arrow.style.left = '';
        arrow.style.top = '';

        if (pos === 'right') {
            top = rect.top + (rect.height / 2) - (tHeight / 2);
            left = rect.right + gap;
            arrowClass = 'top-1/2 left-[-6px] -translate-y-1/2 !border-t-0 !border-r-0 border-b border-l';
        } else if (pos === 'left') {
            top = rect.top + (rect.height / 2) - (tHeight / 2);
            left = rect.left - gap - tWidth;
            arrowClass = 'top-1/2 right-[-6px] -translate-y-1/2 !border-b-0 !border-l-0 border-t border-r';
        } else if (pos === 'top') {
            top = rect.top - gap - tHeight;
            left = rect.left + (rect.width / 2) - (tWidth / 2);
            arrowClass = 'bottom-[-6px] left-1/2 -translate-x-1/2 !border-t-0 !border-l-0 border-b border-r';
        } else {
            top = rect.bottom + gap;
            left = rect.left + (rect.width / 2) - (tWidth / 2);
            arrowClass = 'top-[-6px] left-1/2 -translate-x-1/2 !border-b-0 !border-r-0 border-t border-l';
        }

        if (pos === 'top' || pos === 'bottom') {
            if (left < margin) {
                const shift = margin - left;
                left = margin;
                arrowClass = arrowClass.replace('-translate-x-1/2', '').replace('left-1/2', '');
                arrow.style.left = Math.max(12, (tWidth / 2) - shift) + 'px';
            } else if (left + tWidth > ww - margin) {
                const shift = (left + tWidth) - (ww - margin);
                left = ww - margin - tWidth;
                arrowClass = arrowClass.replace('-translate-x-1/2', '').replace('left-1/2', '');
                arrow.style.left = Math.min(tWidth - 24, (tWidth / 2) + shift) + 'px';
            }
            if (top < 90) top = 90;
            if (top + tHeight > wh - margin) top = wh - margin - tHeight;
        } else if (pos === 'left' || pos === 'right') {
            let marginTop = 90; // Margen superior para esquivar el navbar
            if (top < marginTop) {
                const shift = marginTop - top;
                top = marginTop;
                arrowClass = arrowClass.replace('-translate-y-1/2', '').replace('top-1/2', '');
                arrow.style.top = Math.max(12, (tHeight / 2) - shift) + 'px';
            } else if (top + tHeight > wh - margin) {
                const shift = (top + tHeight) - (wh - margin);
                top = wh - margin - tHeight;
                arrowClass = arrowClass.replace('-translate-y-1/2', '').replace('top-1/2', '');
                arrow.style.top = Math.min(tHeight - 24, (tHeight / 2) + shift) + 'px';
            }
            if (left < margin) left = margin;
            if (left + tWidth > ww - margin) left = ww - margin - tWidth;
        }

        tooltip.style.top = top + 'px';
        tooltip.style.left = left + 'px';
        arrow.className = `absolute w-3 h-3 bg-white border border-slate-200 transform rotate-45 shadow-sm ${arrowClass}`;

        tooltip.classList.remove('opacity-0', 'scale-95', 'animate-tour-pop');
        void tooltip.offsetWidth; // Forzar reflow para reiniciar la animación en cada paso nuevo
        tooltip.classList.add('opacity-100', 'scale-100', 'animate-tour-pop');
    };

    if (doScroll) {
        isAutoScrolling = true;
        
        // Ocultar highlight y tooltip temporalmente durante la transición para un desplazamiento súper limpio
        tooltip.classList.add('opacity-0', 'scale-95');
        highlight.classList.add('opacity-0');
        
        const rect = target.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        let targetY = rect.top + scrollTop - 150;
        
        // Evitar scroll fuera de los límites de la página
        const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
        if (targetY > maxScroll) targetY = maxScroll;
        if (targetY < 0) targetY = 0;

        const currentScroll = window.pageYOffset || document.documentElement.scrollTop;
        if (Math.abs(currentScroll - targetY) < 5) {
            executeStep();
        } else {
            window.scrollTo({ top: targetY, behavior: 'smooth' });
            
            let scrollFinished = false;
            let scrollTimeout;
            
            const onScrollEnd = () => {
                if (scrollFinished) return;
                scrollFinished = true;
                window.removeEventListener('scrollend', onScrollEnd);
                clearTimeout(scrollTimeout);
                executeStep();
            };
            
            // Fallback de tiempo para navegadores que no soporten scrollend o si el scroll no se mueve
            scrollTimeout = setTimeout(onScrollEnd, 600);
            window.addEventListener('scrollend', onScrollEnd, { once: true });
        }
    } else {
        // requestAnimationFrame elimina cualquier parpadeo al hacer scroll manual
        requestAnimationFrame(executeStep);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const verifyForm = document.getElementById('verifyEmailForm');
    if (verifyForm) {
        verifyForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const btn = document.getElementById('btnSubmitVerify');
            const codeInput = document.getElementById('verifyCodeInput');
            const msgDiv = document.getElementById('verifyEmailMsg');
            const code = codeInput ? codeInput.value.trim() : '';

            btn.disabled = true;
            btn.textContent = 'Verificando...';

            fetch('backend/verificar_email.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ codigo: code })
            })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    msgDiv.className = 'text-xs font-bold p-3 rounded-xl text-center bg-emerald-100 text-emerald-800';
                    msgDiv.textContent = data.message || '¡Cuenta verificada exitosamente!';
                    msgDiv.classList.remove('hidden');
                    setTimeout(() => {
                        window.closeVerifyEmailModal();
                        const vBanner = document.getElementById('verifyEmailBanner');
                        if (vBanner) vBanner.classList.add('hidden');
                        if (typeof showToast === 'function') showToast('¡Cuenta activada con éxito!', 'success');
                    }, 1200);
                } else {
                    msgDiv.className = 'text-xs font-bold p-3 rounded-xl text-center bg-red-100 text-red-800';
                    msgDiv.textContent = data.error || 'Código inválido.';
                    msgDiv.classList.remove('hidden');
                }
            })
            .catch(() => {
                msgDiv.className = 'text-xs font-bold p-3 rounded-xl text-center bg-red-100 text-red-800';
                msgDiv.textContent = 'Error de conexión.';
                msgDiv.classList.remove('hidden');
            })
            .finally(() => { btn.disabled = false; btn.textContent = 'Verificar Cuenta'; });
        });
    }
});



// Tour Virtual Guiado Interactivo
window.startGuidedVirtualTour = window.startTour;
window.stopGuidedVirtualTour = window.endTour;

window.toggleOnboardingCollapse = function() {
    const body = document.getElementById('onboardingBody');
    const icon = document.getElementById('iconToggleOnboarding');
    if (!body || !icon) return;

    const isCollapsed = body.classList.contains('hidden');
    if (isCollapsed) {
        body.classList.remove('hidden');
        icon.textContent = 'remove';
        localStorage.setItem('onboarding_collapsed', 'false');
    } else {
        body.classList.add('hidden');
        icon.textContent = 'add';
        localStorage.setItem('onboarding_collapsed', 'true');
    }
};

// Detección automática al cargar dashboard.html
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (localStorage.getItem('onboarding_collapsed') === 'true') {
            const body = document.getElementById('onboardingBody');
            const icon = document.getElementById('iconToggleOnboarding');
            if (body) body.classList.add('hidden');
            if (icon) icon.textContent = 'add';
        }

        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('welcome') === '1' || sessionStorage.getItem('show_welcome_modal') === 'true') {
            sessionStorage.removeItem('show_welcome_modal');
            openWelcomeNewAccountModal();
        }
    }, 400);
});