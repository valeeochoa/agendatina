// backend/js/script.js

// ==========================================
// LÓGICA COMPARTIDA Y UTILIDADES
// ==========================================

window.confirmActionCallback = null;

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
    }, 10);
};

window.closeConfirm = function() {
    const modal = document.getElementById('confirmModal');
    const content = document.getElementById('confirmModalContent');
    if(modal) modal.classList.add('opacity-0');
    if(content) content.classList.add('scale-95');
    setTimeout(() => { if(modal) modal.classList.add('hidden'); }, 300);
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
            applyWebCustomization(); // Refrescar los colores en pantalla sin recargar
        } else {
            showToast(data.error || 'Error al guardar la configuración.', 'error');
        }
    })
    .catch(err => console.error('Error:', err))
    .finally(() => { if (submitBtn) submitBtn.innerHTML = originalText; });
}

// ==========================================
// LÓGICA DE PERFIL (ADMIN)
// ==========================================

function logout(redirect = 'login.html') {
    showConfirm('Cerrar sesión', '¿Estás seguro que deseas salir de tu cuenta?', 'Cerrar sesión', 'bg-red-600 hover:bg-red-700', () => {
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
    // SEGURIDAD: Cierra sesión si la pestaña fue cerrada previamente y se intenta reabrir sin login
    if (!sessionStorage.getItem('agendatina_session')) {
        fetch('backend/logout.php').then(() => window.location.href = 'login.html');
        return;
    }

    fetch('backend/perfil.php')
        .then(async res => {
            const text = await res.text();
            try {
                return JSON.parse(text);
            } catch (e) {
                console.error('Error PHP en perfil.php (Dashboard):', text);
                throw new Error('Respuesta no válida del servidor');
            }
        })
        .then(data => {
            if (data.success) {
                fetch('backend/guardar_web.php')
                .then(res => res.json())
                .then(webData => {
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
                    dashGreeting.textContent = `Hola, ${window.currentUserData.nombre_completo.split(' ')[0]}`;
                }
                if (dashSubGreeting && business.nombre_fantasia) {
                    dashSubGreeting.textContent = `Gestionemos juntos tu negocio ${business.nombre_fantasia}`;
                }

                window.currentCustomNotifs = data.notificaciones || [];

                // Animaciones de Bienvenida (Primer inicio) y Modo Demo
                if (sessionStorage.getItem('agendatina_demo_alert')) {
                    sessionStorage.removeItem('agendatina_demo_alert');
                    setTimeout(() => showWelcomeAnimation('Premium', true), 300);
        } else if (!localStorage.getItem('welcomed_' + (business.id || 'new'))) {
                    localStorage.setItem('welcomed_' + (business.id || 'new'), 'true');
                    setTimeout(() => showWelcomeAnimation(business.plan, false), 300);
                }
                
                // Modo DEMO: Ocultar botones de reporte y soporte
                if (window.currentUserData && window.currentUserData.email === 'demo@agendatina.site') {
                    const cardSupport = document.getElementById('cardSupport');
                    if (cardSupport) cardSupport.style.display = 'none';
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
                const navPlanName = document.getElementById('navPlanName');
                let displayPlan = business.plan || 'Plan Básico';
                if (!displayPlan.toLowerCase().includes('plan')) {
                    displayPlan = 'Plan ' + displayPlan.charAt(0).toUpperCase() + displayPlan.slice(1);
                }
                if (navPlanName) navPlanName.textContent = displayPlan;

                // Alerta si los días de trabajo están vacíos
                const configAlertBanner = document.getElementById('configAlertBanner');
                if (configAlertBanner) {
                    if (!webData.dias_trabajo || String(webData.dias_trabajo).trim() === '') {
                        configAlertBanner.classList.remove('hidden');
                        configAlertBanner.classList.add('flex');
                    } else {
                        configAlertBanner.classList.add('hidden');
                        configAlertBanner.classList.remove('flex');
                    }
                }

                // Configurar modal de pago con el plan correcto
                const paymentPlanName = document.getElementById('paymentPlanName');
                if (paymentPlanName) paymentPlanName.textContent = displayPlan;
                
                const paymentPrice = document.getElementById('paymentPrice');
                
                const planStr = (business.plan || '').toLowerCase();
                const dbStatus = business.estado_pago || 'prueba';

                if (paymentPrice) {
                    let basePrice = 10630; // Default a Simple
                    let oldPrice = 13288;
                    if (planStr.includes('intermedio')) { basePrice = 16450; oldPrice = 20563; }
                    if (planStr.includes('completo')) { basePrice = 22550; oldPrice = 28188; }
                    
                    let finalPrice = dbStatus === 'prueba' ? basePrice / 2 : basePrice;
                    let formattedPrice = finalPrice.toLocaleString('es-AR');
                    let formattedOldPrice = oldPrice.toLocaleString('es-AR');
                    
                    let discountBadge = dbStatus === 'prueba' 
                        ? '<span class="block text-sm font-bold text-emerald-500 mb-1">50% OFF - Primer Mes</span>' 
                        : `<div class="flex flex-wrap items-center justify-center gap-2 mb-1"><span class="text-sm text-slate-400 line-through font-medium">$${formattedOldPrice}</span><span class="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-md text-xs font-bold">-20% OFF</span></div>`;
                        
                    paymentPrice.innerHTML = `${discountBadge}$${formattedPrice} <span class="text-base font-normal text-slate-400">/mes</span>`;
                }
                
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
                        cardAgenda.style.display = 'none'; // Plan básico: Oculta Agenda y Web
                        cardWeb.style.display = 'none';
                    } else if (planStr.includes('intermedio')) {
                        cardWeb.style.display = 'none';    // Plan Intermedio: Oculta la Web Pública
                    }
                    
                    // Respaldo de seguridad por si el plan falló en cargar antes
                    if (data.plan) {
                        const navPlanName = document.getElementById('navPlanName');
                        if (navPlanName && (navPlanName.textContent === 'Cargando plan...' || navPlanName.textContent === 'Plan Básico')) {
                            let pName = data.plan;
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
                    plan: business.plan || 'Básico'
                };

                checkSubscription(subscriptionData);
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
                    }).catch(err => console.error('Error al cargar datos web:', err));
            } else if (data.error && data.error.toLowerCase().includes('inicia sesión')) {
                window.location.href = 'login.html';
            }
        })
        .catch(err => console.error('Error al cargar datos del dashboard:', err));
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

    let cycleStart = fechaAlta;
    let cycleDays = 30;
    let graceDays = 0;

    if (subscriptionData.status === 'activo' || subscriptionData.status === 'pagado') {
        if (lastPayment) cycleStart = lastPayment;
        cycleDays = 30;
        graceDays = 5;
    } else if (subscriptionData.status === 'prueba') {
        cycleDays = 15;
        graceDays = 0;
    } else if (subscriptionData.status === 'beta') {
        cycleDays = 30;
        graceDays = 5;
    }

    const cycleEnd = new Date(cycleStart);
    cycleEnd.setDate(cycleEnd.getDate() + cycleDays);

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

    if (subscriptionData.status === 'prueba') {
        if (diffToCycleEnd > 0) {
            isDashboardBannerHidden = false;
            dashBannerClass = 'mb-8 p-4 rounded-2xl shadow-sm flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between bg-blue-50 border border-blue-200 text-blue-800';
            dashIcon = 'schedule';
            dashMsg = `Estás en tu período de prueba. Te quedan ${diffToCycleEnd} días de acceso gratuito. Luego, deberás abonar el mes completo, el cual correrá a partir de ese momento.`;
            dashBtnText = 'Pagar ahora';
            subscriptionData.status = 'suspendido'; // Lo forzamos visualmente a suspendido
            isDashboardBannerHidden = false;
            dashBannerClass = 'mb-8 p-4 rounded-2xl shadow-sm flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between bg-red-50 border border-red-200 text-red-800';
            dashIcon = 'error';
            dashMsg = `Tu período de prueba ha finalizado. Debes abonar el mes completo para reactivar el servicio. El nuevo mes correrá a partir de que el pago sea aprobado.`;
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
            dashMsg = `Tu periodo beta ha finalizado. Tienes <strong>${diffToDeadline} días de gracia</strong> para abonar tu primer mes antes de que se suspenda el servicio.`;
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
            dashMsg = `Tu mes de servicio ha finalizado. Tienes <strong>${diffToDeadline} días de gracia</strong> para renovar tu suscripción y evitar interrupciones.`;
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
            dashMsg = `Tu último comprobante fue rechazado o tu cuenta registra un saldo pendiente. Aboná para reactivar el servicio.`;
            dashBtnText = 'Pagar Plan';
            dashBtnClass = 'bg-red-600 hover:bg-red-700 text-white';
            showActionBtn = true;
        }
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
        subActionBtn.onclick = () => window.location.href = 'pago.html';
    } else {
        subActionBtn.classList.add('hidden');
    }
}

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
    .then(res => res.json())
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
            else { notifState[n.id].title = n.title; notifState[n.id].text = n.text; notifState[n.id].link = n.link; }
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
                const onClickAction = n.link === '#' ? '' : `onclick="window.location.href='${n.link ? n.link : 'agenda.html'}'"`;
                const cursorStyle = n.link === '#' ? 'cursor-default' : 'cursor-pointer hover:bg-slate-100';
                const dot = n.read ? '' : '<span class="w-2 h-2 rounded-full bg-red-500 mt-2"></span>';
                
                notifList.innerHTML += `
                    <div class="p-3 ${cursorStyle} rounded-xl transition-colors flex gap-3 items-start relative group" ${onClickAction}>
                        <div class="${n.bg} ${n.color} p-2 rounded-lg flex-shrink-0 flex items-center justify-center">
                            <span class="material-symbols-outlined text-[18px]">${n.icon}</span>
                        </div>
                        <div class="flex-1 pr-6">
                            <p class="text-sm font-bold text-slate-800">${n.title}</p>
                            <p class="text-xs text-slate-500 leading-tight mt-0.5">${n.text}</p>
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
    }).catch(err => console.error('Error notificaciones:', err));
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
    let desc = `Para comenzar a recibir turnos, es fundamental que configures los horarios de atención y detalles de tu negocio en la sección de <strong>Ajustes</strong>.`;
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
                ${isDemo ? 'Entendido, explorar panel' : 'Ir a Ajustes del Calendario'}
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
}

function closeSupportModal() {
    const modal = document.getElementById('supportModal');
    const content = document.getElementById('supportModalContent');
    if (!modal || !content) return;
    modal.classList.add('opacity-0');
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
                if(document.getElementById('profTitulo')) document.getElementById('profTitulo').value = data.titulo || '';
                if(document.getElementById('profColor1')) document.getElementById('profColor1').value = data.color_primario || '#3b82f6';
                if(document.getElementById('profColor2')) document.getElementById('profColor2').value = data.color_secundario || '#8b5cf6';
                if(document.getElementById('profileColor')) document.getElementById('profileColor').value = data.color_primario || '#3b82f6';

                const displayName = data.titulo || (window.currentBusinessData && window.currentBusinessData.nombre_fantasia) || (window.currentUserData && window.currentUserData.nombre_completo) || 'Mi Negocio';
                
                const dashBusinessName = document.getElementById('dashboardBusinessName');
                if (dashBusinessName) dashBusinessName.textContent = displayName;
                
                const navBusinessName = document.getElementById('navBusinessName');
                const navBrandAccent = document.getElementById('navBrandAccent');
                if (navBusinessName && data.titulo) navBusinessName.textContent = data.titulo;
                if (navBrandAccent && data.titulo) navBrandAccent.textContent = '';
                
                if (data.color_primario && document.getElementById('navIcon')) {
                    document.getElementById('navIcon').style.color = data.color_primario;
                }
                if (data.color_secundario && navBrandAccent) {
                    navBrandAccent.style.color = data.color_secundario;
                }
                if ((data.color_primario || data.color_secundario) && !data.logo) {
                    const navAvatar = document.getElementById('navAvatar');
                    const c1 = data.color_primario || '#3b82f6';
                    const c2 = data.color_secundario || '#8b5cf6';
                    if (navAvatar) navAvatar.style.background = `linear-gradient(135deg, ${c1} 0%, ${c2} 100%)`;
                }
                if (data.logo) {
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
                
                if (data.color_primario) {
                    const style = document.getElementById('dynamic-dashboard-styles') || document.createElement('style');
                    style.id = 'dynamic-dashboard-styles';
                    style.innerHTML = `
                        .bg-primary { background-color: ${data.color_primario} !important; }
                        .text-primary { color: ${data.color_primario} !important; }
                        .border-primary { border-color: ${data.color_primario} !important; }
                    .hover\\:border-primary\\/50:hover { border-color: color-mix(in srgb, ${data.color_primario} 50%, transparent) !important; }
                    .hover\\:shadow-primary\\/20:hover { --tw-shadow-color: color-mix(in srgb, ${data.color_primario} 20%, transparent) !important; }
                    .bg-primary\\/10 { background-color: color-mix(in srgb, ${data.color_primario} 70%, transparent) !important; color: #ffffff !important; border-color: transparent !important; }
                    .text-primary { color: ${data.color_primario} !important; }
                    .signature-glow { background: linear-gradient(135deg, ${data.color_primario} 0%, ${data.color_secundario || '#8b5cf6'} 100%) !important; }
                    body, .bg-slate-50 { background-color: color-mix(in srgb, ${data.color_primario} 4%, #f8fafc) !important; }
                    `;
                    if (!document.getElementById('dynamic-dashboard-styles')) {
                        document.head.appendChild(style);
                    }
                }
                if (data.logo) {
                    const profilePreview = document.getElementById('profileLogoPreview');
                    if (profilePreview) { profilePreview.src = data.logo; profilePreview.classList.remove('hidden'); }
                    const webPreview = document.getElementById('webLogoPreview');
                    if (webPreview) { webPreview.src = data.logo; webPreview.classList.remove('hidden'); }
                }
            }
        })
        .catch(err => console.error('Error al cargar personalización:', err));
}

function openPaymentModal() {
    const modal = document.getElementById('paymentModal');
    const content = document.getElementById('paymentModalContent');
    if (!modal || !content) return;
    modal.classList.remove('hidden');
    setTimeout(() => { modal.classList.remove('opacity-0'); content.classList.remove('scale-95'); }, 10);
}

function closePaymentModal() {
    const modal = document.getElementById('paymentModal');
    const content = document.getElementById('paymentModalContent');
    if (!modal || !content) return;
    modal.classList.add('opacity-0');
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

function openProfileModal() {
    const modal = document.getElementById('profileModal');
    const content = document.getElementById('profileModalContent');
    if (!modal || !content) return;
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
    modal.classList.remove('hidden');
    setTimeout(() => { modal.classList.remove('opacity-0'); content.classList.remove('scale-95'); }, 10);
}

function closeProfileModal() {
    const modal = document.getElementById('profileModal');
    const content = document.getElementById('profileModalContent');
    if (!modal || !content) return;
    modal.classList.add('opacity-0');
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
    if(document.getElementById('configColorPrimario')) document.getElementById('configColorPrimario').value = c.color_primario || '#ec135b';
    if(document.getElementById('configColorSecundario')) document.getElementById('configColorSecundario').value = c.color_secundario || '#fce7f3';
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
    if(document.getElementById('configAnticipacionMin')) document.getElementById('configAnticipacionMin').value = parseInt(c.anticipacion_turno_min || 0, 10);
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
            document.getElementById('divIntervaloCustom').classList.add('hidden');
        } else if (c.intervalo_turnos === 'servicio') {
            selectInterval.value = 'servicio';
            document.getElementById('divIntervaloCustom').classList.add('hidden');
        } else {
            selectInterval.value = 'custom';
            document.getElementById('divIntervaloCustom').classList.remove('hidden');
            document.getElementById('inputIntervaloCustom').value = c.intervalo_turnos || 30;
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
    if (!isDemo) {
        setTimeout(() => {
            if (document.getElementById('firstSetupModal')) {
                const modal = document.getElementById('firstSetupModal');
                modal.classList.remove('hidden');
                setTimeout(() => modal.classList.remove('opacity-0'), 10);
            } else if (typeof window.openCalendarConfigModal === 'function' && document.getElementById('calendarConfigModal')) {
                window.openCalendarConfigModal();
            } else {
                    const calType = window.businessWebConfig?.tipo_calendario === 'semanal' ? 'calendarioSemanal.html' : 'calendarioMensual.html';
                    window.location.href = calType;
            }
        }, 120);
    }
}

window.closeCalendarConfigModal = function() {
    const modal = document.getElementById('calendarConfigModal');
    const content = document.getElementById('calendarConfigModalContent');
    if (!modal || !content) return;
    modal.classList.add('opacity-0');
    content.classList.add('scale-95');
    setTimeout(() => { modal.classList.add('hidden'); }, 300);
}

window.closeContactSuccessModal = function() {
    const modal = document.getElementById('contactSuccessModal');
    const content = document.getElementById('contactSuccessModalContent');
    if (modal && content) {
        modal.classList.add('opacity-0');
        content.classList.add('scale-95');
        setTimeout(() => { modal.classList.add('hidden'); }, 300);
    }
}

window.closeBookingSuccessModal = function() {
    const modal = document.getElementById('bookingSuccessModal');
    const content = document.getElementById('bookingSuccessModalContent');
    if (modal && content) {
        modal.classList.add('opacity-0');
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
};

window.closeReportErrorModal = function() {
    const modal = document.getElementById('reportErrorModal');
    const content = document.getElementById('reportErrorModalContent');
    if (!modal) return;
    modal.classList.add('opacity-0');
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
function cargarAgenda() {
    // Auto-refresco de la agenda en segundo plano cada 30 segundos
    if (!window.agendaPollingInterval) {
        window.agendaPollingInterval = setInterval(cargarAgenda, 30000);
    }

    fetch('backend/obtener_agenda.php')
    .then(res => res.json())
    .then(data => {
        if (data && data.error) {
            if (data.error.toLowerCase().includes('inicia sesión') || data.error.toLowerCase().includes('autorizado')) {
                window.location.href = 'login.html';
            } else {
                showToast(data.error, 'error');
            }
            return;
        }
        if (!Array.isArray(data)) return;

        // Evitar parpadeos: Solo re-renderizar si hubo un cambio real en los datos
        const newDataString = JSON.stringify(data);
        if (window.agendaLastDataString === newDataString) return;
        window.agendaLastDataString = newDataString;

        window.agendaData = data;
        
        if (typeof services === 'undefined' || services.length === 0) {
            fetch('backend/gestionar_servicios.php' + (typeof negocioSlug !== 'undefined' && negocioSlug ? `?n=${negocioSlug}` : ''))
            .then(res => res.json())
            .then(servData => {
                if (Array.isArray(servData)) services = servData;
                const currentSearch = document.getElementById('agendaSearchInput') ? document.getElementById('agendaSearchInput').value : '';
                    const currentProf = document.getElementById('agendaProfFilter') ? document.getElementById('agendaProfFilter').value : '';
                    renderAgendaTurnos(data, currentSearch, currentProf);
            })
                .catch(() => renderAgendaTurnos(data, document.getElementById('agendaSearchInput') ? document.getElementById('agendaSearchInput').value : '', document.getElementById('agendaProfFilter') ? document.getElementById('agendaProfFilter').value : ''));
        } else {
            const currentSearch = document.getElementById('agendaSearchInput') ? document.getElementById('agendaSearchInput').value : '';
                const currentProf = document.getElementById('agendaProfFilter') ? document.getElementById('agendaProfFilter').value : '';
                renderAgendaTurnos(data, currentSearch, currentProf);
        }
    }).catch(err => console.error(err));
}

function renderAgendaTurnos(data, searchTerm = '', profTerm = '') {
    if (!document.getElementById('agendaSearchContainer')) {
        const listPend = document.getElementById('lista-pendientes');
        if (listPend) {
            const searchContainer = document.createElement('div');
            searchContainer.id = 'agendaSearchContainer';
            searchContainer.className = 'mb-6 relative w-full';
            searchContainer.innerHTML = `
                <div class="flex flex-col sm:flex-row gap-3 w-full">
                    <div class="relative w-full sm:flex-1">
                        <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <span class="material-symbols-outlined text-slate-400 text-[20px]">search</span>
                        </div>
                        <input type="text" id="agendaSearchInput" class="w-full pl-12 pr-4 py-3.5 rounded-2xl border border-slate-200 bg-white shadow-sm focus:ring-2 focus:ring-primary outline-none transition-all text-sm font-medium text-slate-700 placeholder-slate-400" placeholder="Buscar por cliente, teléfono o servicio...">
                    </div>
                    <button onclick="descargarHistorialTurnos(this)" class="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-3.5 rounded-2xl font-bold text-sm transition-colors flex items-center justify-center gap-2 border border-slate-200 shadow-sm whitespace-nowrap shrink-0 w-full sm:w-auto" title="Descargar Historial Completo (CSV)">
                        <span class="material-symbols-outlined text-[20px]">download</span>
                        <span class="inline sm:hidden lg:inline">Historial</span>
                    </button>
                </div>
            `;
            
            // Colocar el buscador arriba de todo (antes de las pestañas si existen)
            const tabs = document.querySelector('[role="tablist"]') || document.querySelector('.flex.bg-slate-100.p-1') || listPend.parentElement;
            if (tabs && tabs.parentElement && tabs !== listPend.parentElement) {
                tabs.parentElement.insertBefore(searchContainer, tabs);
            } else {
                listPend.parentElement.insertBefore(searchContainer, listPend.parentElement.firstChild);
            }

            // Evento para filtrar en tiempo real
            document.getElementById('agendaSearchInput').addEventListener('input', (e) => {
                renderAgendaTurnos(window.agendaData, e.target.value, document.getElementById('agendaProfFilter').value);
                renderAgendaTurnos(window.agendaData, e.target.value, window.currentAgendaProfTerm || '');
            });
            
            document.getElementById('agendaProfFilter').addEventListener('change', (e) => {
                renderAgendaTurnos(window.agendaData, document.getElementById('agendaSearchInput').value, e.target.value);
            });
            
            if (searchTerm) {
                document.getElementById('agendaSearchInput').value = searchTerm;
            }
        }
    }
    
    // --- POBLAR SELECT DE PROFESIONALES DINÁMICAMENTE ---
    const profFilterEl = document.getElementById('agendaProfFilter');
    const profContainerEl = document.getElementById('agendaProfFilterContainer');
    
    if (profFilterEl && profContainerEl && data.length > 0) {
        const uniqueProfs = [...new Set(data.map(t => t.profesional).filter(p => p && p !== 'Cualquiera (Sin preferencia)'))].sort();
        
        if (uniqueProfs.length > 0) {
            profContainerEl.classList.remove('hidden');
            const currentProfsStr = uniqueProfs.join(',');
            
            if (profFilterEl.dataset.profs !== currentProfsStr) {
                const currentVal = profFilterEl.value;
                let optionsHtml = '<option value="">Todos los profesionales</option>';
                uniqueProfs.forEach(p => {
                    optionsHtml += `<option value="${p}">${p}</option>`;
                });
                profFilterEl.innerHTML = optionsHtml;
                profFilterEl.value = uniqueProfs.includes(currentVal) ? currentVal : '';
                profFilterEl.dataset.profs = currentProfsStr;
            }
        } else {
            profContainerEl.classList.add('hidden');
        }
    }

    let pendientes = data.filter(t => t.estado === 'pendiente');
    let confirmados = data.filter(t => t.estado === 'confirmado');
    
    if (searchTerm || profTerm) {
        const term = (searchTerm || '').toLowerCase();
        const filterFn = t => {
            let matchSearch = true;
            if (term) matchSearch = (t.cliente_nombre && t.cliente_nombre.toLowerCase().includes(term)) || (t.nombre && t.nombre.toLowerCase().includes(term)) || (t.apellido && t.apellido.toLowerCase().includes(term)) || (t.cliente_celular && t.cliente_celular.includes(term)) || (t.celular && t.celular.includes(term)) || (t.servicio && t.servicio.toLowerCase().includes(term));
            
            let matchProf = true;
            if (profTerm) matchProf = (t.profesional === profTerm);
            
            return matchSearch && matchProf;
        };
            
        pendientes = pendientes.filter(filterFn);
        confirmados = confirmados.filter(filterFn);
    }
    
        const urlParams = new URLSearchParams(window.location.search);
        const focusId = urlParams.get('focus');
        
        // Ordenar cronológicamente
        confirmados.sort((a, b) => (a.fecha + ' ' + a.hora).localeCompare(b.fecha + ' ' + b.hora));

        // DIBUJAR PENDIENTES
        const listPend = document.getElementById('lista-pendientes');
        if (listPend) {
        listPend.innerHTML = '';
        if (pendientes.length === 0) listPend.innerHTML = `<div class="bg-slate-50 p-6 rounded-2xl border border-slate-200 text-center"><p class="text-sm font-medium text-slate-400">${(searchTerm || profTerm) ? 'No se encontraron resultados con los filtros aplicados' : 'No hay turnos pendientes'}</p></div>`;
        
        pendientes.forEach(t => {
            const fParts = t.fecha.split('-');
            const fDisplay = fParts.length === 3 ? `${fParts[2]}/${fParts[1]}/${fParts[0]}` : t.fecha;
            const focusClass = focusId == t.id ? 'ring-4 ring-primary ring-offset-2 scale-[1.02] transition-transform duration-500' : '';
            listPend.innerHTML += `
                <div id="turno-${t.id}" class="bg-white border-l-4 border-amber-400 shadow-sm rounded-xl p-5 hover:shadow-md transition-all ${focusClass}">
                    <p class="text-xs font-bold text-amber-500 mb-2 uppercase tracking-wide">${fDisplay} • ${t.hora} hs</p>
                    <p class="text-base font-bold text-slate-800 mb-1">${t.cliente_nombre || (t.nombre + ' ' + (t.apellido || ''))}</p>
                    <div class="flex items-center gap-2 mb-1">
                        <p class="text-sm font-medium text-slate-600 flex items-center gap-1"><span class="material-symbols-outlined text-[16px]">call</span> ${t.cliente_celular || t.celular}</p>
                        <button onclick="contactarWhatsApp('${t.id}')" class="text-[#128C7E] hover:bg-[#25D366]/20 bg-[#25D366]/10 p-1.5 rounded-md transition-colors" title="Enviar WhatsApp"><span class="material-symbols-outlined text-[18px]">chat</span></button>
                    </div>
                    <p class="text-sm text-slate-500 mb-3 mt-2 flex items-center flex-wrap gap-1"><span class="material-symbols-outlined text-[14px]">spa</span> ${t.servicio} ${t.profesional && t.profesional !== 'Cualquiera (Sin preferencia)' ? '<span class="ml-2 px-2 py-0.5 bg-purple-100 text-purple-700 rounded-md text-xs font-semibold">👤 ' + t.profesional + '</span>' + buildProfessionalLinkButton(t.profesional) : ''}</p>
                    <div class="flex items-center gap-2 mt-2">
                        <button onclick="confirmarTurno('${t.id}')" class="flex-1 bg-amber-100 hover:bg-amber-200 text-amber-800 dark:bg-amber-500/20 dark:hover:bg-amber-500/40 dark:text-amber-400 text-sm font-bold py-2 rounded-lg transition-colors flex items-center justify-center gap-1">
                            <span class="material-symbols-outlined text-[18px]">check</span> Confirmar
                        </button>
                        <button onclick="cancelarTurno('${t.id}')" class="bg-slate-100 dark:bg-slate-800 hover:bg-red-100 dark:hover:bg-red-500/20 text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 text-sm font-bold py-2 px-3 rounded-lg transition-colors flex items-center justify-center" title="Rechazar solicitud">
                            <span class="material-symbols-outlined text-[18px]">close</span>
                        </button>
                    </div>
                </div>
            `;
        });
        }

        if (focusId) {
            setTimeout(() => {
                const el = document.getElementById('turno-' + focusId);
                if (el) el.scrollIntoView({behavior: 'smooth', block: 'center'});
            }, 500);
        }

        // DIBUJAR CONFIRMADOS
        const listConf = document.getElementById('lista-confirmados');
        if (listConf) {
        listConf.innerHTML = '';
        if (confirmados.length === 0) {
                listConf.innerHTML = `<div class="p-8 text-center text-sm font-medium text-slate-400 bg-slate-50 rounded-xl border border-slate-200">${(searchTerm || profTerm) ? 'No se encontraron resultados con los filtros aplicados' : 'Aún no tienes turnos confirmados.'}</div>`;
        } else {
            const gruposConf = {};
            confirmados.forEach(t => {
                if (!gruposConf[t.fecha]) gruposConf[t.fecha] = [];
                gruposConf[t.fecha].push(t);
            });

            const fechasConf = Object.keys(gruposConf).sort();
            fechasConf.forEach(fecha => {
                const [yyyy, mm, dd] = fecha.split('-');
                const dateObj = new Date(yyyy, mm - 1, dd);
                const esHoy = new Date().toDateString() === dateObj.toDateString();
                const formatFecha = `${dd}/${mm}/${yyyy}`;
                
                let htmlDia = `
                    <div class="mb-6">
                        <h3 class="font-bold text-slate-800 mb-3 flex items-center gap-2 ${esHoy ? 'text-primary' : ''}">
                            <span class="material-symbols-outlined text-[20px]">${esHoy ? 'today' : 'event'}</span> 
                            ${esHoy ? 'Hoy, ' + formatFecha : formatFecha}
                        </h3>
                        <div class="space-y-3">
                `;
                
                gruposConf[fecha].forEach(t => {
                    htmlDia += `
                        <div class="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:shadow-md transition-shadow">
                            <div>
                                <p class="text-xs font-bold text-green-600 mb-1 uppercase tracking-wide">${t.hora} hs</p>
                                <p class="text-base font-bold text-slate-800 mb-1">${t.cliente_nombre || (t.nombre + ' ' + (t.apellido || ''))}</p>
                                <p class="text-sm font-medium text-slate-600 mb-2 flex items-center gap-1"><span class="material-symbols-outlined text-[16px]">call</span> ${t.cliente_celular || t.celular}</p>
                                <div class="flex items-center flex-wrap gap-2">
                                    <span class="bg-blue-50 text-blue-700 font-medium px-2.5 py-1 rounded-md text-xs border border-blue-100">${t.servicio}</span>
                                    ${t.profesional && t.profesional !== 'Cualquiera (Sin preferencia)' ? `<span class="bg-purple-50 text-purple-700 font-medium px-2.5 py-1 rounded-md text-xs border border-purple-100">👤 ${t.profesional}</span>${buildProfessionalLinkButton(t.profesional)}` : ''}
                                </div>
                            </div>
                            <div class="flex flex-row sm:flex-col gap-2 mt-2 sm:mt-0 w-full sm:w-auto border-t sm:border-t-0 border-slate-100 pt-3 sm:pt-0">
                                <button onclick="contactarWhatsApp('${t.id}')" class="flex-1 sm:flex-none flex items-center justify-center gap-1 bg-[#25D366]/10 text-[#128C7E] hover:bg-[#25D366]/20 px-3 py-2 rounded-lg font-bold transition-colors text-sm"><span class="material-symbols-outlined text-[18px]">chat</span> Contactar</button>
                                <button onclick="recordatorioWhatsApp('${t.id}')" class="flex-1 sm:flex-none flex items-center justify-center gap-1 bg-blue-100 text-blue-700 hover:bg-blue-200 px-3 py-2 rounded-lg font-bold transition-colors text-sm" title="Enviar recordatorio"><span class="material-symbols-outlined text-[18px]">notifications_active</span> Recordar</button>
                                <button onclick="cancelarTurno('${t.id}')" class="flex-1 sm:flex-none flex items-center justify-center gap-1 text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-2 rounded-lg font-bold transition-colors text-sm" title="Cancelar turno">
                                    <span class="material-symbols-outlined text-[18px]">cancel</span> Cancelar
                                </button>
                            </div>
                        </div>
                    `;
                });
                
                htmlDia += `</div></div>`;
                listConf.innerHTML += htmlDia;
            });
        }
        }
    }

window.setAgendaProfFilter = function(profName) {
    window.currentAgendaProfTerm = profName;
    // Forzar actualización visual de las pestañas
    const tabsContainer = document.getElementById('profesionalesAgendaTabs');
    if (tabsContainer) tabsContainer.dataset.profs = '';
    renderAgendaTurnos(window.agendaData, document.getElementById('agendaSearchInput')?.value || '', profName);
};

window.descargarHistorialTurnos = function(btn) {
    const originalHtml = btn.innerHTML;
    btn.innerHTML = '<span class="material-symbols-outlined animate-spin text-[20px]">refresh</span>';
    btn.disabled = true;

    fetch('backend/obtener_agenda.php?historial=1')
    .then(res => res.json())
    .then(data => {
        if (!Array.isArray(data) || data.length === 0) {
            showToast('No hay turnos en el historial para exportar.', 'error');
            return;
        }

        const headers = ['ID', 'Fecha', 'Hora', 'Cliente', 'Celular', 'Servicio', 'Profesional', 'Estado'];
        const rows = data.map(t => {
            const nombreCliente = t.cliente_nombre || (t.nombre + ' ' + (t.apellido || ''));
            const celular = t.cliente_celular || t.celular || '';
            return [
                t.id,
                `"${t.fecha}"`,
                `"${t.hora}"`,
                `"${nombreCliente.replace(/"/g, '""')}"`,
                `"${celular}"`,
                `"${(t.servicio || '').replace(/"/g, '""')}"`,
                `"${(t.profesional || '').replace(/"/g, '""')}"`,
                `"${t.estado || ''}"`
            ].join(',');
        });

        const csvContent = [headers.join(','), ...rows].join('\n');
        const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const downloadUrl = URL.createObjectURL(blob);
        link.setAttribute("href", downloadUrl);
        link.setAttribute("download", `Historial_Turnos_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showToast('Historial descargado con éxito.', 'success');
    })
    .catch(err => {
        console.error(err);
        showToast('Error al descargar el historial.', 'error');
    })
    .finally(() => {
        btn.innerHTML = originalHtml;
        btn.disabled = false;
    });
};

function showToast(message, type = 'success') {
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
    
    requestAnimationFrame(() => {
        toast.classList.remove('translate-y-12', 'opacity-0');
    });
    
    setTimeout(() => {
        toast.classList.add('translate-y-12', 'opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function showConfirm(title, message, acceptText, acceptColorClass, callback, extraHtml = '') {
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmMessage').innerHTML = message + extraHtml;
    
    const btnAccept = document.getElementById('btnAcceptConfirm');
    btnAccept.textContent = acceptText;
    btnAccept.className = `px-4 py-2 text-sm font-semibold text-white rounded-lg transition-colors ${acceptColorClass}`;
    
    confirmActionCallback = callback;
    
    const modal = document.getElementById('confirmModal');
    const content = document.getElementById('confirmModalContent');
    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        content.classList.remove('scale-95');
    }, 10);
}

function closeConfirm() {
    const modal = document.getElementById('confirmModal');
    const content = document.getElementById('confirmModalContent');
    modal.classList.add('opacity-0');
    content.classList.add('scale-95');
    setTimeout(() => { modal.classList.add('hidden'); }, 300);
}

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

const carouselData = [
    { 
        title: 'Plan Simple', 
        desc: 'Calendario online para que tus clientes puedan solicitar turnos de forma rápida y organizada.', 
        oldPrice: '$13.288',
        price: '$10.630', 
        tag: 'Ideal para comenzar',
        mockupDesktop: 'public/mockup_calendar_computer.png',
        mockupMobile: 'public/mockup_calendar_phone.png',
        features: [
            'Calendario de turnos personalizado',
            'Logo y colores del negocio',
            'Configuración de días y horarios disponibles',
            'Notificaciones automáticas por email'
        ]
    },
    { 
        title: 'Plan Intermedio', 
        desc: 'Sistema de turnos con agenda virtual para administrar todas tus reservas desde un solo lugar.', 
        oldPrice: '$20.563',
        price: '$16.450', 
        tag: 'Más Elegido',
        mockupDesktop: 'public/mockup_miagenda_computer.png',
        mockupMobile: 'public/mockup_miagenda_phone.png',
        features: [
            'Todo lo del Plan Simple',
            'Agenda virtual con listado de reservas',
            'Visualización de turnos confirmados y pendientes',
            'Gestión manual de disponibilidad'
        ]
    },
    { 
        title: 'Plan Premium', 
        desc: 'Plataforma completa con turnero y mini página para mostrar tu negocio y captar más clientes.', 
        oldPrice: '$28.188',
        price: '$22.550', 
        tag: 'Presencia Online',
        mockupDesktop: 'public/mockup_miagenda_computer.png',
        mockupMobile: 'public/mockup_miagenda_phone.png',
        features: [
            'Todo lo del Plan Intermedio',
            'Mini página personalizada del negocio',
            'Imagen de portada destacada',
            'Listado de servicios y descripción'
        ]
    }
];

let currentCarouselIndex = 1;

window.setCarouselIndex = function(index) {
    const titleEl = document.getElementById('carouselTitle');
    if (!titleEl) return; // Salir si no estamos en la landing

    currentCarouselIndex = index;
    document.getElementById('carouselTitle').textContent = carouselData[index].title;
    document.getElementById('carouselDesc').textContent = carouselData[index].desc;
    
    // Renderizar Nuevo y Viejo Precio con el 20% OFF
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
    
    const actionBtn = document.getElementById('carouselActionBtn');
    if (actionBtn) {
        actionBtn.onclick = () => selectPlan(carouselData[index].title);
    }

    const dotsContainer = document.getElementById('carouselDots');
    if (dotsContainer) {
        const dots = dotsContainer.children;
        for (let i = 0; i < dots.length; i++) {
            dots[i].className = i === index ? 'w-8 h-2.5 rounded-full bg-primary transition-all' : 'w-2.5 h-2.5 rounded-full bg-slate-300 transition-all';
        }
    }
};

window.selectPlan = function(planName) {
    const planBox = document.getElementById('planSelectionBox');
    const planNameEl = document.getElementById('selectedPlanName');
    const inputPlan = document.getElementById('inputPlan');
    
    if (planBox && planNameEl && inputPlan) {
        planNameEl.textContent = planName;
        inputPlan.value = planName;
        planBox.classList.remove('hidden');
    }
    
    const contactSection = document.getElementById('contacto');
    if (contactSection) {
        contactSection.scrollIntoView({ behavior: 'smooth' });
    }
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
            setCarouselIndex(1); // Inicia en Plan Intermedio

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

function isAccountSuspended(dbStatus, lastPaymentStr, fechaAltaStr) {
    if (dbStatus === 'suspendido') return true;
    
    const today = new Date();
    
    if (dbStatus === 'prueba' || dbStatus === 'beta') {
        const fechaAlta = fechaAltaStr ? new Date(fechaAltaStr.replace(/-/g, '/')) : new Date();
        const trialEnd = new Date(fechaAlta);
        const days = dbStatus === 'beta' ? 30 : 15;
        trialEnd.setDate(trialEnd.getDate() + days);
        return today > trialEnd;
    } 
    
    if (dbStatus === 'activo' || dbStatus === 'pagado') {
        const lastPayment = lastPaymentStr ? new Date(lastPaymentStr.replace(/-/g, '/')) : new Date(0);
        const paymentDeadline = new Date(lastPayment);
        paymentDeadline.setDate(paymentDeadline.getDate() + 40); // 30 días de ciclo + 10 de gracia
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
                            alert('Tu cuenta está suspendida por falta de pago. Serás redirigido al panel de control para regularizar tu situación.');
                            window.location.href = 'dashboard.html';
                            return;
                        } else {
                            document.body.innerHTML = '<div style="display:flex; justify-content:center; align-items:center; height:100vh; background:#fff; color:#333; font-family:sans-serif; font-size:24px; font-weight:bold; margin:0;">Error</div>';
                            return;
                        }
                    }
                }

            if (data.hora_apertura || data.hora_cierre) {
                generateTimeSlots(data.hora_apertura || '09:00', data.hora_cierre || '18:00', data.intervalo_turnos ? parseInt(data.intervalo_turnos) : 30);
                if (cal_selectedDate) {
                    if (isAdmin && !isPreviewMode) {
                        renderAdminDayView(toYYYYMMDD(cal_selectedDate));
                    } else {
                        cal_renderTimeSlots();
                    }
                }
            }

                window.businessWebConfig = data;
                if (typeof cal_renderCalendar === 'function') cal_renderCalendar(); // Recargar si es necesario

                if (data.titulo) {
                    document.title = `${data.titulo} | Reservar Turno`;
                    
                    const words = data.titulo.trim().split(' ');
                    const navBusinessName = document.getElementById('navBusinessName');
                    const navBrandAccent = document.getElementById('navBrandAccent');
                    if (navBusinessName && navBrandAccent) {
                        navBusinessName.textContent = data.titulo;
                        navBrandAccent.textContent = '';
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

                if (data.profesionales_json && document.getElementById('publicProfesionalesList')) {
                    try {
                        const profs = JSON.parse(data.profesionales_json);
                        const container = document.getElementById('publicProfesionalesList');
                        container.innerHTML = '';
                        if (profs.length > 0) {
                            profs.forEach(p => {
                                const img = p.foto ? `<img src="${p.foto}" alt="${p.nombre}" class="w-32 h-32 rounded-full object-cover mx-auto mb-4 border-4 border-slate-100 shadow-md">` : `<div class="w-32 h-32 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4 border-4 border-slate-100 shadow-md"><span class="material-symbols-outlined text-5xl">person</span></div>`;
                                container.innerHTML += `
                                    <div class="bg-white rounded-3xl p-6 text-center border border-slate-100 shadow-sm hover:shadow-xl transition-all hover:-translate-y-1">
                                        ${img}
                                        <h3 class="text-xl font-bold text-slate-800">${p.nombre}</h3>
                                        <p class="text-sm text-slate-500 mt-3 leading-relaxed">${p.descripcion}</p>
                                    </div>
                                `;
                            });
                            const section = document.getElementById('sectionProfesionales');
                            if (section) section.classList.remove('hidden');
                        }
                    } catch (e) { console.error("Error parseando profesionales:", e); }
                }
                // ------------------------------------------------
                
                if (data.alineacion_servicios) {
                    const alignValue = data.alineacion_servicios;
                    const flexJustify = alignValue === 'center' ? 'center' : (alignValue === 'right' ? 'flex-end' : 'flex-start');
                    const alignStyle = document.createElement('style');
                    alignStyle.innerHTML = `
                        #publicServicesList { justify-content: ${flexJustify} !important; text-align: ${alignValue} !important; }
                        .service-card { text-align: ${alignValue} !important; align-items: ${alignValue === 'center' ? 'center' : (alignValue === 'right' ? 'flex-end' : 'flex-start')} !important; }
                    `;
                    document.head.appendChild(alignStyle);
                }

                if (!document.getElementById('agendatinaFooter') && (!isAdmin || isPreviewMode)) {
                    const footer = document.createElement('footer');
                    footer.id = 'agendatinaFooter';
                    footer.className = 'text-center py-6 mt-8 text-sm text-slate-500 w-full';
                    footer.innerHTML = 'Realizado con <a href="https://agendatina.site" target="_blank" class="font-bold text-primary hover:underline">Agendatina</a>';
                    
                    const main = document.querySelector('main') || document.body;
                    if (main === document.body) {
                        document.body.appendChild(footer);
                    } else {
                        main.parentElement.appendChild(footer);
                    }
                }
                if (data.logo) {
                    const favicon = document.querySelector('link[rel="icon"]');
                    if (favicon) favicon.href = data.logo;
                    
                    const navIconContainer = document.getElementById('navIconContainer');
                    const navLogoImg = document.getElementById('navLogoImg');
                    if (navIconContainer) navIconContainer.classList.add('hidden');
                    if (navLogoImg) { navLogoImg.src = data.logo; navLogoImg.classList.remove('hidden'); }
                }
                if (data.color_secundario) {
                    const navBrandAccent = document.getElementById('navBrandAccent');
                    if (navBrandAccent) navBrandAccent.style.color = data.color_secundario;
                }
                if (data.color_primario || data.color_secundario || data.color_fondo) {
                    const pColor = data.color_primario || '#3b82f6';
                    const sColor = data.color_secundario || '#fce7f3';
                    
                    // Eliminar la etiqueta de estilo anterior si existe (útil al guardar desde el panel admin)
                    const oldStyle = document.getElementById('dynamic-business-styles');
                    if (oldStyle) oldStyle.remove();

                    const style = document.createElement('style');
                    style.id = 'dynamic-business-styles';
                    
                    let styleHTML = `
                        :root {
                            --color-primario: ${pColor};
                            --color-secundario: ${sColor};
                        }
                        .bg-primary { background-color: var(--color-primario) !important; }
                        .text-primary { color: var(--color-primario) !important; }
                        .border-primary { border-color: var(--color-primario) !important; }
                        .ring-primary { --tw-ring-color: var(--color-primario) !important; }
                        
                        /* Forzar color en botones principales generales (Tailwind bg-blue-600) */
                        button[type="submit"], .bg-blue-600 { background-color: var(--color-primario) !important; }
                        button[type="submit"]:hover, .hover\\:bg-blue-700:hover { background-color: var(--color-primario) !important; filter: brightness(0.85); }
                        
                        /* Estilos para el calendario y horarios */
                        .calendar-day.selected { background-color: var(--color-primario) !important; color: #ffffff !important; }
                        .time-slot.selected { background-color: var(--color-primario) !important; color: #ffffff !important; border-color: var(--color-primario) !important; }
                    `;
                    if (data.color_fondo) {
                        styleHTML += `body, .bg-slate-100 { background-color: ${data.color_fondo} !important; }`;
                    }
                    style.innerHTML = styleHTML;
                    document.head.appendChild(style);
                }
            }
        })
        .catch(err => console.error('Error al cargar personalización:', err));
}