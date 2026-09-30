// Interceptor global de Fetch para enviar automáticamente el CSRF Token en peticiones POST/PUT/DELETE del SuperAdmin
(function() {
    const originalFetch = window.fetch;
    window.fetch = function(url, options = {}) {
        options = options || {};
        const method = (options.method || 'GET').toUpperCase();
        if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
            const token = document.cookie.match(/csrf_token=([^;]+)/)?.[1];
            if (token) {
                if (!options.headers) {
                    options.headers = {};
                }
                if (options.headers instanceof Headers) {
                    if (!options.headers.has('X-CSRF-Token')) {
                        options.headers.append('X-CSRF-Token', token);
                    }
                } else if (Array.isArray(options.headers)) {
                    if (!options.headers.some(([k]) => k.toLowerCase() === 'x-csrf-token')) {
                        options.headers.push(['X-CSRF-Token', token]);
                    }
                } else {
                    if (!options.headers['X-CSRF-Token'] && !options.headers['x-csrf-token']) {
                        options.headers['X-CSRF-Token'] = token;
                    }
                }
            }
        }
        return originalFetch.call(this, url, options);
    };
})();

function loadAdminNavNotifsCount() {
    fetch('../backend/admin_notificaciones_api.php?t=' + Date.now())
        .then(r => r.json())
        .then(data => {
            if (data.success && data.counts) {
                const c = data.counts;

                // 1. Actualizar Badges dinámicos en el menú lateral del SuperAdmin
                updateSidebarBadge('navReportesCount', c.reportes, 'bg-red-500 text-white font-extrabold');
                updateSidebarBadge('navMejorasCount', c.mejoras, 'bg-blue-500 text-white font-extrabold');
                updateSidebarBadge('navComprobantesCount', c.comprobantes, 'bg-amber-500 text-slate-950 font-extrabold');
                updateSidebarBadge('navTareasCount', c.tareas, 'bg-purple-500 text-white font-extrabold');
                updateSidebarBadge('navNotificacionesCount', c.notificaciones, 'bg-orange-500 text-slate-950 font-extrabold');

                // 2. Calcular total global pendiente y actualizar el título de la pestaña (document.title)
                const totalUnread = (c.reportes || 0) + (c.comprobantes || 0) + (c.notificaciones || 0) + (c.mejoras || 0);
                
                let baseTitle = document.title.replace(/^\(\d+\)\s*/, '');
                if (totalUnread > 0) {
                    document.title = `(${totalUnread}) ${baseTitle}`;
                } else {
                    document.title = baseTitle;
                }
            }
        }).catch(() => {});
}

function updateSidebarBadge(id, count, bgClasses) {
    const el = document.getElementById(id);
    if (!el) return;
    if (count > 0) {
        el.textContent = count;
        el.className = `text-[11px] px-2 py-0.5 rounded-full ml-auto shadow-xs ${bgClasses}`;
    } else {
        el.textContent = '';
        el.className = '';
    }
}

function initAdminMobileNav() {
    const aside = document.querySelector('aside');
    if (!aside) return;

    aside.classList.add('transition-all', 'duration-300');

    // Buscar el contenedor de encabezado de marca
    const brandHeader = aside.querySelector('.border-b.border-slate-800') || aside.querySelector('div:first-child');
    if (!brandHeader) return;

    brandHeader.classList.add('flex', 'items-center', 'justify-between', 'gap-3');
    brandHeader.classList.remove('mb-8');
    brandHeader.classList.add('mb-3', 'md:mb-8');

    const nav = aside.querySelector('nav');
    const footerDiv = aside.querySelector('.border-t.border-slate-800:last-child') || aside.querySelector('div.pt-6');

    // Crear contenedor colapsable para mobile si no existe
    let collapsible = document.getElementById('adminMobileNavContent');
    if (!collapsible && nav) {
        collapsible = document.createElement('div');
        collapsible.id = 'adminMobileNavContent';
        collapsible.className = 'hidden md:flex flex-col justify-between flex-1 w-full space-y-4 md:space-y-0 transition-all duration-300 pt-2 md:pt-0';
        
        nav.parentNode.insertBefore(collapsible, nav);
        collapsible.appendChild(nav);
        if (footerDiv) {
            collapsible.appendChild(footerDiv);
        }
    }

    // Crear botón hamburguesa para celulares
    if (!document.getElementById('adminMobileNavToggle')) {
        const toggleBtn = document.createElement('button');
        toggleBtn.id = 'adminMobileNavToggle';
        toggleBtn.type = 'button';
        toggleBtn.className = 'md:hidden flex items-center justify-center p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-all border border-slate-700 active:scale-95 cursor-pointer ml-auto';
        toggleBtn.setAttribute('aria-label', 'Abrir Menú de Navegación');
        toggleBtn.innerHTML = '<span id="adminMobileNavIcon" class="material-symbols-outlined text-[24px]">menu</span>';

        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!collapsible) return;
            const isHidden = collapsible.classList.contains('hidden');
            const icon = document.getElementById('adminMobileNavIcon');
            if (isHidden) {
                collapsible.classList.remove('hidden');
                if (icon) icon.textContent = 'close';
                toggleBtn.classList.add('bg-[#d11149]', 'text-white', 'border-[#d11149]');
                toggleBtn.classList.remove('bg-slate-800', 'text-slate-300');
            } else {
                collapsible.classList.add('hidden');
                if (icon) icon.textContent = 'menu';
                toggleBtn.classList.remove('bg-[#d11149]', 'text-white', 'border-[#d11149]');
                toggleBtn.classList.add('bg-slate-800', 'text-slate-300');
            }
        });

        brandHeader.appendChild(toggleBtn);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initAdminMobileNav();
    loadAdminNavNotifsCount();
    setInterval(loadAdminNavNotifsCount, 15000);
});

window.loadAdminNavNotifsCount = loadAdminNavNotifsCount;
window.initAdminMobileNav = initAdminMobileNav;

