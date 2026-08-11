function loadAdminNavNotifsCount() {
    fetch('../backend/admin_notificaciones_api.php')
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

document.addEventListener('DOMContentLoaded', () => {
    loadAdminNavNotifsCount();
    setInterval(loadAdminNavNotifsCount, 15000);
});

window.loadAdminNavNotifsCount = loadAdminNavNotifsCount;
