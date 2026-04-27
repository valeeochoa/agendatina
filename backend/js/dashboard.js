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