document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('year').textContent = new Date().getFullYear();

    // Extraer el identificador del negocio desde la URL
    let negocioSlug = '';
    if (typeof window.NEGOCIO_SLUG !== 'undefined') {
        negocioSlug = window.NEGOCIO_SLUG;
    } else {
        const urlParams = new URLSearchParams(window.location.search);
        negocioSlug = urlParams.get('n');
        if (!negocioSlug) {
            const pathParts = window.location.pathname.split('/').filter(p => p && !p.includes('.html') && !p.includes('.php'));
            const ignoreDirs = ['backend', 'css', 'js', 'public', 'agendatina', 'calendario', 'web'];
            const validParts = pathParts.filter(p => !ignoreDirs.includes(p));
            if (validParts.length > 0) {
                negocioSlug = validParts[validParts.length - 1];
            }
        }
    }
    if (!negocioSlug) negocioSlug = '';
    const queryParam = negocioSlug ? `?n=${negocioSlug}` : '';

    // Cargar configuración de la web (Textos, logos, colores)
    fetch('backend/guardar_web.php' + queryParam)
        .then(res => res.json())
        .then(data => {
            if (data && !data.error) {
                // Redirigir al calendario si el plan no incluye la mini-web
                const planStr = (data.plan || '').toLowerCase();
                if (planStr.includes('básico') || planStr.includes('basico') || planStr.includes('simple') || planStr.includes('intermedio')) {
                    window.location.replace(`calendario.html${queryParam}`);
                    return;
                }

                // Actualizar enlaces al calendario usando la ruta dinámica
                const linkCalendario = `calendario.html${queryParam}`;
                document.getElementById('navReservarBtn').href = linkCalendario;
                document.getElementById('heroReservarBtn').href = linkCalendario;

                const title = data.titulo || 'Mi Negocio';
                document.title = title;
                document.getElementById('navTitle').textContent = title;
                document.getElementById('heroTitle').textContent = title;
                document.getElementById('footerName').textContent = title;

                if (data.subtitulo) {
                    document.getElementById('heroSubtitle').textContent = data.subtitulo;
                }

                if (data.fondo) {
                    document.getElementById('heroBackground').style.backgroundImage = `url('${data.fondo}')`;
                    document.getElementById('heroBackground').classList.remove('opacity-40');
                    document.getElementById('heroBackground').classList.add('opacity-50');
                }

                if (data.logo) {
                    document.getElementById('navIcon').classList.add('hidden');
                    const navLogo = document.getElementById('navLogo');
                    navLogo.src = data.logo;
                    navLogo.classList.remove('hidden');

                    const favicon = document.querySelector('link[rel="icon"]');
                    if (favicon) favicon.href = data.logo;
                }

                // Aplicar colores personalizados
                if (data.color_primario_web || data.color_secundario_web || data.color_fondo) {
                    const pColor = data.color_primario_web || data.color_primario || '#3b82f6';
                    const sColor = data.color_secundario_web || data.color_secundario || '#8b5cf6';
                    const style = document.getElementById('custom-styles');
                    let stylesHTML = `
                        .text-primary { color: ${pColor} !important; }
                        .bg-primary { background-color: ${pColor} !important; }
                        .border-primary { border-color: ${pColor} !important; }
                        .hover\\:bg-primary:hover { background-color: ${pColor} !important; }
                        .hover\\:shadow-primary\\/30:hover { --tw-shadow-color: ${pColor}4d !important; }
                        .text-secondary { color: ${sColor} !important; }
                        .bg-secondary { background-color: ${sColor} !important; }
                    `;
                    if (data.color_fondo) {
                        stylesHTML += `body, .bg-slate-50 { background-color: ${data.color_fondo} !important; }`;
                    }
                    style.innerHTML = stylesHTML;
                }

                if (data.alineacion_servicios) {
                    const styleAlign = document.createElement('style');
                    styleAlign.innerHTML = `.service-card { text-align: ${data.alineacion_servicios}; }`;
                    document.head.appendChild(styleAlign);
                }
            }
        })
        .catch(err => console.error('Error al cargar la configuración web:', err));

    // Cargar servicios
    fetch('backend/gestionar_servicios.php' + queryParam)
        .then(res => res.json())
        .then(data => {
            const grid = document.getElementById('servicesGrid');
            grid.innerHTML = '';

            if (!data || data.length === 0) {
                grid.innerHTML = '<p class="text-center text-slate-500 col-span-full py-10">No hay servicios disponibles por el momento.</p>';
                return;
            }

            window.webServicesData = data;

            data.forEach(service => {
                const precio = service.precio ? `<span class="font-bold text-lg text-primary">$${service.precio}</span>` : '';
                const imgs = [service.imagen1, service.imagen2, service.imagen3].filter(Boolean);
                let imagesHtml = `<div class="h-48 w-full bg-slate-100 flex items-center justify-center text-slate-400"><span class="material-symbols-outlined text-4xl">spa</span></div>`;
                if (imgs.length > 0) {
                    const imgsHtml = imgs.map((img, i) => `<img src="${img}" alt="${service.nombre}" class="card-carousel-img absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${i === 0 ? 'opacity-100' : 'opacity-0'}">`).join('');
                    const controls = imgs.length > 1
                        ? `<button type="button" onclick="prevCardImg(event, '${service.id}')" class="absolute left-2 top-1/2 -translate-y-1/2 bg-white/70 hover:bg-white rounded-full p-1.5 z-10"><span class="material-symbols-outlined">chevron_left</span></button>
                           <button type="button" onclick="nextCardImg(event, '${service.id}')" class="absolute right-2 top-1/2 -translate-y-1/2 bg-white/70 hover:bg-white rounded-full p-1.5 z-10"><span class="material-symbols-outlined">chevron_right</span></button>`
                        : '';
                    imagesHtml = `<div id="card-carousel-${service.id}" data-index="0" class="h-48 w-full bg-slate-200 overflow-hidden relative">${imgsHtml}${controls}</div>`;
                }

            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = service.descripcion || '';
            const plainTextDesc = tempDiv.textContent || tempDiv.innerText || 'Sin descripción detallada.';

                grid.innerHTML += `
                    <div onclick="openWebModalService('${service.id}')" class="service-card cursor-pointer bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                        ${imagesHtml}
                        <div class="p-6 flex flex-col flex-1">
                            <h3 class="text-xl font-bold text-slate-800 leading-tight mb-2">${service.nombre}</h3>
                            <div class="flex items-center gap-2 text-sm font-medium text-slate-500 mb-4"><span class="material-symbols-outlined text-base">schedule</span> ${service.duracion} min</div>
                        <div class="text-slate-500 text-sm mb-6 flex-1 line-clamp-3 overflow-hidden" style="display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical;" title="Clic para leer más">${plainTextDesc}</div>
                            <div class="flex items-center justify-between mt-auto pt-4 border-t border-slate-100">
                                ${precio}
                                <span class="text-primary font-bold text-sm flex items-center gap-1">Ver detalles <span class="material-symbols-outlined text-sm">visibility</span></span>
                            </div>
                        </div>
                    </div>
                `;
            });

            const cards = document.querySelectorAll('.service-card');
            const observer = new IntersectionObserver((entries) => {
                entries.forEach((entry, index) => {
                    if (entry.isIntersecting) {
                        setTimeout(() => {
                            entry.target.classList.add('is-visible');
                        }, index * 100);
                        observer.unobserve(entry.target);
                    }
                });
            }, { threshold: 0.1 });
            cards.forEach(card => {
                observer.observe(card);
            });

            setInterval(() => {
                document.querySelectorAll('[id^="card-carousel-"]').forEach(el => {
                    const imgs = el.querySelectorAll('.card-carousel-img');
                    if (imgs.length <= 1) return;
                    let idx = parseInt(el.dataset.index || '0', 10);
                    imgs[idx].classList.replace('opacity-100', 'opacity-0');
                    idx = (idx + 1) % imgs.length;
                    imgs[idx].classList.replace('opacity-0', 'opacity-100');
                    el.dataset.index = String(idx);
                });
            }, 30000);
        })
        .catch(err => {
            document.getElementById('servicesGrid').innerHTML = '<p class="text-center text-red-500 col-span-full py-10">Ocurrió un error al cargar los servicios.</p>';
        });
});
    
let currentCarouselImg = 0;
let carouselInterval;

window.nextCardImg = function(e, id) {
    if (e) e.stopPropagation();
    const el = document.getElementById(`card-carousel-${id}`);
    if (!el) return;
    const imgs = el.querySelectorAll('.card-carousel-img');
    if (imgs.length <= 1) return;
    let idx = parseInt(el.dataset.index || '0', 10);
    imgs[idx].classList.replace('opacity-100', 'opacity-0');
    idx = (idx + 1) % imgs.length;
    imgs[idx].classList.replace('opacity-0', 'opacity-100');
    el.dataset.index = String(idx);
};

window.prevCardImg = function(e, id) {
    if (e) e.stopPropagation();
    const el = document.getElementById(`card-carousel-${id}`);
    if (!el) return;
    const imgs = el.querySelectorAll('.card-carousel-img');
    if (imgs.length <= 1) return;
    let idx = parseInt(el.dataset.index || '0', 10);
    imgs[idx].classList.replace('opacity-100', 'opacity-0');
    idx = (idx - 1 + imgs.length) % imgs.length;
    imgs[idx].classList.replace('opacity-0', 'opacity-100');
    el.dataset.index = String(idx);
};

window.nextServiceImg = function(e) {
    if(e) e.stopPropagation();
    const imgs = document.querySelectorAll('#webServiceModalImages .carousel-img');
    if(imgs.length <= 1) return;
    imgs[currentCarouselImg].classList.replace('opacity-100', 'opacity-0');
    currentCarouselImg = (currentCarouselImg + 1) % imgs.length;
    imgs[currentCarouselImg].classList.replace('opacity-0', 'opacity-100');
};

window.prevServiceImg = function(e) {
    if(e) e.stopPropagation();
    const imgs = document.querySelectorAll('#webServiceModalImages .carousel-img');
    if(imgs.length <= 1) return;
    imgs[currentCarouselImg].classList.replace('opacity-100', 'opacity-0');
    currentCarouselImg = (currentCarouselImg - 1 + imgs.length) % imgs.length;
    imgs[currentCarouselImg].classList.replace('opacity-0', 'opacity-100');
};

window.openWebModalService = function(id) {
    const service = window.webServicesData.find(s => s.id == id);
    if(!service) return;
    document.getElementById('webServiceModalTitle').textContent = service.nombre;
    document.getElementById('webServiceModalDuration').innerHTML = `<span class="material-symbols-outlined text-base">schedule</span> ${service.duracion} min`;
    document.getElementById('webServiceModalPrice').textContent = service.precio ? `$${service.precio}` : '';
    document.getElementById('webServiceModalDesc').innerHTML = service.descripcion || 'Sin descripción detallada.';
    const imgContainer = document.getElementById('webServiceModalImages');
    
    clearInterval(carouselInterval);
    currentCarouselImg = 0;
    
    if (service.imagen1 || service.imagen2 || service.imagen3) {
        let imgs = '';
        let count = 0;
        if(service.imagen1) { imgs += `<img src="${service.imagen1}" class="carousel-img absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${count===0?'opacity-100':'opacity-0'}">`; count++; }
        if(service.imagen2) { imgs += `<img src="${service.imagen2}" class="carousel-img absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${count===0?'opacity-100':'opacity-0'}">`; count++; }
        if(service.imagen3) { imgs += `<img src="${service.imagen3}" class="carousel-img absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${count===0?'opacity-100':'opacity-0'}">`; count++; }
        
        let controls = '';
        if (count > 1) {
            controls = `<button onclick="prevServiceImg(event)" class="absolute left-2 top-1/2 -translate-y-1/2 bg-white/50 hover:bg-white rounded-full p-1.5 z-10 transition-colors"><span class="material-symbols-outlined">chevron_left</span></button><button onclick="nextServiceImg(event)" class="absolute right-2 top-1/2 -translate-y-1/2 bg-white/50 hover:bg-white rounded-full p-1.5 z-10 transition-colors"><span class="material-symbols-outlined">chevron_right</span></button>`;
            carouselInterval = setInterval(() => { window.nextServiceImg(); }, 30000);
        }
        imgContainer.innerHTML = imgs + controls; imgContainer.classList.remove('hidden');
    } else { 
        imgContainer.classList.add('hidden'); 
    }
    const negocioSlug = new URLSearchParams(window.location.search).get('n') || (window.location.pathname.split('/').filter(p => p && !p.includes('.'))[0] || '');
    document.getElementById('webServiceModalBtn').href = `calendario.html?n=${negocioSlug}&servicio=${encodeURIComponent(service.nombre)}`;
    const modal = document.getElementById('webServiceModal'); const content = document.getElementById('webServiceModalContent');
    modal.classList.remove('hidden'); setTimeout(() => { modal.classList.remove('opacity-0'); content.classList.remove('scale-95'); }, 10); document.body.style.overflow = 'hidden';
}
window.closeWebModalService = function() {
    const modal = document.getElementById('webServiceModal'); const content = document.getElementById('webServiceModalContent');
    modal.classList.add('opacity-0'); content.classList.add('scale-95'); setTimeout(() => { modal.classList.add('hidden'); document.body.style.overflow = ''; }, 300);
}