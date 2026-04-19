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
            const calPage = isWeekly ? 'calendarioSemanal' : 'calendarioMensual';
            if (cardCalendario) cardCalendario.href = `${window.currentBusinessData.ruta}/${calPage}`;
        }
    }, 200);
};