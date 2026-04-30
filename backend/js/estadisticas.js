let turnosChartInstance;
let serviciosChartInstance;
let ingresosChartInstance;
let ingresosSemanaChartInstance;

document.addEventListener('DOMContentLoaded', () => {
    // Seguridad: si no hay sesión, redirigir al login
    if (!sessionStorage.getItem('agendatina_session')) {
        fetch('backend/logout.php').then(() => window.location.href = 'login.html');
        return;
    }
    
    const fechaDesdeInput = document.getElementById('fechaDesde');
    const fechaHastaInput = document.getElementById('fechaHasta');
    const btnFiltrar = document.getElementById('btnFiltrar');
    const btnLimpiarFiltro = document.getElementById('btnLimpiarFiltro');

    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    fechaDesdeInput.value = firstDayOfMonth.toISOString().split('T')[0];
    fechaHastaInput.value = today.toISOString().split('T')[0];

    btnFiltrar.addEventListener('click', () => loadStatistics());
    btnLimpiarFiltro.addEventListener('click', () => {
        fechaDesdeInput.value = firstDayOfMonth.toISOString().split('T')[0];
        fechaHastaInput.value = today.toISOString().split('T')[0];
        loadStatistics();
    });
    
    loadStatistics();
});

function loadStatistics() {
    const fechaDesde = document.getElementById('fechaDesde').value;
    const fechaHasta = document.getElementById('fechaHasta').value;

    Promise.all([
        fetch('backend/obtener_agenda.php?historial=1').then(res => res.json()),
        fetch('backend/gestionar_servicios.php').then(res => res.json())
    ]).then(([turnos, servicios]) => {
        if (!Array.isArray(turnos) || !Array.isArray(servicios)) {
            console.error("Error al cargar datos para estadísticas");
            return;
        }

        const turnosFiltrados = turnos.filter(t => {
            if (fechaDesde && t.fecha < fechaDesde) return false;
            if (fechaHasta && t.fecha > fechaHasta) return false;
            return t.estado === 'confirmado';
        });

        // 1. Calcular Ingresos Totales del Mes
        const ingresosTotales = turnosFiltrados.reduce((total, turno) => {
            const servicio = servicios.find(s => s.nombre === turno.servicio);
            return total + (servicio ? parseFloat(servicio.precio) || 0 : 0);
        }, 0);
        document.getElementById('statIngresos').textContent = `$${ingresosTotales.toLocaleString('es-AR', {maximumFractionDigits: 0})}`;

        // 2. Total de Turnos del Mes
        document.getElementById('statTurnos').textContent = turnosFiltrados.length;

        // 3. Servicio Más Solicitado
        const conteoServicios = turnosFiltrados.reduce((acc, turno) => {
            acc[turno.servicio] = (acc[turno.servicio] || 0) + 1;
            return acc;
        }, {});
        const servicioMasSolicitado = Object.keys(conteoServicios).reduce((a, b) => conteoServicios[a] > conteoServicios[b] ? a : b, 'Ninguno');
        document.getElementById('statServicio').textContent = servicioMasSolicitado;

        // 4. Nuevos Clientes (aproximado, contando celulares únicos del mes)
        const clientesUnicos = new Set(turnosFiltrados.map(t => t.cliente_celular || t.celular));
        document.getElementById('statClientes').textContent = clientesUnicos.size;

        // 5. Gráfico de Turnos por Día (últimos 30 días)
        renderTurnosPorDiaChart(turnos, fechaDesde, fechaHasta);

        // 6. Gráfico de Torta de Servicios
        renderServiciosChart(conteoServicios);

        // 7. Calcular Ingresos por Servicio
        const ingresosPorServicio = turnosFiltrados.reduce((acc, turno) => {
            const servicio = servicios.find(s => s.nombre === turno.servicio);
            const precio = servicio ? parseFloat(servicio.precio) || 0 : 0;
            if (precio > 0) {
                acc[turno.servicio] = (acc[turno.servicio] || 0) + precio;
            }
            return acc;
        }, {});
        renderIngresosPorServicioChart(ingresosPorServicio);

        // 8. Gráfico de Ingresos por Semana
        renderIngresosPorSemanaChart(turnosFiltrados, servicios, fechaDesde, fechaHasta);

    }).catch(error => {
        console.error('Error al cargar las estadísticas:', error);
    });
}

function renderTurnosPorDiaChart(allTurnos, startDate, endDate) {
    const ctx = document.getElementById('turnosPorDiaChart').getContext('2d');
    const labels = [];
    const data = [];

    const start = new Date(startDate.replace(/-/g, '/') + ' 00:00:00');
    const end = new Date(endDate.replace(/-/g, '/') + ' 00:00:00');

    let currentDate = new Date(start);
    while (currentDate <= end) {
        labels.push(currentDate.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }));
        
        const fechaFiltro = currentDate.toISOString().split('T')[0];
        const turnosDelDia = allTurnos.filter(t => t.fecha === fechaFiltro && t.estado === 'confirmado').length;
        data.push(turnosDelDia);

        currentDate.setDate(currentDate.getDate() + 1);
    }

    if (turnosChartInstance) {
        turnosChartInstance.destroy();
    }

    turnosChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Turnos Confirmados',
                data: data,
                borderColor: '#D11149',
                backgroundColor: 'rgba(209, 17, 73, 0.1)',
                fill: true,
                tension: 0.4,
                borderWidth: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, ticks: { stepSize: 1 } }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });
}

function renderIngresosPorSemanaChart(turnosFiltrados, servicios, startDate, endDate) {
    const ctx = document.getElementById('ingresosPorSemanaChart')?.getContext('2d');
    if (!ctx) return;

    const start = new Date(startDate.replace(/-/g, '/') + ' 00:00:00');
    const end = new Date(endDate.replace(/-/g, '/') + ' 00:00:00');

    const weeks = [];
    let currentStart = new Date(start);
    let weekIndex = 1;

    // Dividir el rango total en bloques de 7 días
    while (currentStart <= end) {
        let currentEnd = new Date(currentStart);
        currentEnd.setDate(currentEnd.getDate() + 6);
        if (currentEnd > end) currentEnd = new Date(end);

        const labelInicio = currentStart.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });

        weeks.push({
            label: `S${weekIndex} (${labelInicio})`,
            start: new Date(currentStart),
            end: new Date(currentEnd),
            revenue: 0
        });

        currentStart.setDate(currentStart.getDate() + 7);
        weekIndex++;
    }

    // Sumar ingresos dentro de la semana correspondiente
    turnosFiltrados.forEach(t => {
        const tDate = new Date(t.fecha.replace(/-/g, '/') + ' 00:00:00');
        const servicio = servicios.find(s => s.nombre === t.servicio);
        const precio = servicio ? parseFloat(servicio.precio) || 0 : 0;

        if (precio > 0) {
            const week = weeks.find(w => tDate >= w.start && tDate <= w.end);
            if (week) week.revenue += precio;
        }
    });

    const labels = weeks.map(w => w.label);
    const data = weeks.map(w => w.revenue);

    if (ingresosSemanaChartInstance) ingresosSemanaChartInstance.destroy();

    ingresosSemanaChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{ label: 'Ingresos ($)', data: data, backgroundColor: 'rgba(252, 135, 18, 0.8)', borderColor: '#FC8712', borderWidth: 2, borderRadius: 6 }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: { y: { beginAtZero: true, ticks: { callback: function(value) { return '$' + value.toLocaleString('es-AR', {maximumFractionDigits: 0}); } } } },
            plugins: { legend: { display: false }, tooltip: { callbacks: { label: function(context) { return '$' + context.parsed.y.toLocaleString('es-AR', {maximumFractionDigits: 0}); } } } }
        }
    });
}

function renderIngresosPorServicioChart(ingresosData) {
    const ctx = document.getElementById('ingresosPorServicioChart')?.getContext('2d');
    if (!ctx) return;

    // Ordenar de mayor a menor para un mejor visual
    const sortedData = Object.entries(ingresosData).sort(([,a],[,b]) => b-a);
    const labels = sortedData.map(item => item[0]);
    const data = sortedData.map(item => item[1]);

    const backgroundColors = [
        '#D11149', '#FC8712', '#F44979', '#FF9D73', '#FCB0B3',
        '#4A90E2', '#50E3C2', '#B8E986', '#F8E71C', '#7B68EE'
    ];

    if (ingresosChartInstance) {
        ingresosChartInstance.destroy();
    }

    ingresosChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Ingresos ($)',
                data: data,
                backgroundColor: backgroundColors.map(c => c + 'E6'), // 90% opacity
                borderColor: backgroundColors,
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y', // Gráfico de barras horizontales
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return '$' + value.toLocaleString('es-AR', {maximumFractionDigits: 0});
                        }
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.x !== null) {
                                label += new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(context.parsed.x);
                            }
                            return label;
                        }
                    }
                }
            }
        }
    });
}

function renderServiciosChart(conteoServicios) {
    const ctx = document.getElementById('serviciosChart').getContext('2d');
    const labels = Object.keys(conteoServicios);
    const data = Object.values(conteoServicios);

    const backgroundColors = [
        '#D11149', '#FC8712', '#F44979', '#FF9D73', '#FCB0B3',
        '#4A90E2', '#50E3C2', '#B8E986', '#F8E71C', '#7B68EE'
    ];

    if (serviciosChartInstance) {
        serviciosChartInstance.destroy();
    }

    serviciosChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                label: 'Distribución de Servicios',
                data: data,
                backgroundColor: backgroundColors,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { padding: 15 } }
            }
        }
    });
}