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

    // Cargar configuración de la web y servicios en paralelo
    Promise.all([
        fetch('backend/guardar_web.php' + queryParam).then(res => res.json()),
        fetch('backend/gestionar_servicios.php' + queryParam).then(res => res.json())
    ])
    .then(([data, servicesData]) => {
        // --- 1. PROCESAR CONFIGURACIÓN WEB ---
            if (data && !data.error) {
                const planStr = (data.plan || '').toLowerCase();
                const calSegment = data.tipo_calendario === 'semanal' ? 'calendarioSemanal' : 'calendarioMensual';
                const cleanLink = negocioSlug ? `/${negocioSlug}/${calSegment}` : `${calSegment}.html${queryParam}`;

                // Redirigir al calendario si el plan no incluye la mini-web
                if (planStr.includes('básico') || planStr.includes('basico') || planStr.includes('simple') || planStr.includes('intermedio')) {
                    window.location.replace(cleanLink);
                    return;
                }

                // Actualizar enlaces al calendario usando la ruta dinámica
                document.getElementById('navReservarBtn').href = cleanLink;
                document.getElementById('heroReservarBtn').href = cleanLink;

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

                // Inyectar Secciones de Información Dinámica
                if (data.texto_local && document.getElementById('publicTextoLocal')) {
                    document.getElementById('publicTextoLocal').textContent = data.texto_local;
                    document.getElementById('sectionTextoLocal')?.classList.remove('hidden');
                }
                if (data.ubicacion_maps && document.getElementById('publicUbicacionMaps')) {
                    const mapsContainer = document.getElementById('publicUbicacionMaps');
                    if (data.ubicacion_maps.includes('<iframe')) {
                        mapsContainer.innerHTML = data.ubicacion_maps;
                    } else {
                        mapsContainer.innerHTML = `<a href="${data.ubicacion_maps}" target="_blank" class="text-primary hover:underline flex items-center gap-2 justify-center p-4 bg-slate-50 rounded-xl font-bold"><span class="material-symbols-outlined">map</span> Abrir en Google Maps</a>`;
                    }
                    document.getElementById('sectionUbicacionMaps')?.classList.remove('hidden');
                }
                if (data.cursos_html && document.getElementById('publicCursos')) {
                    document.getElementById('publicCursos').innerHTML = data.cursos_html;
                    document.getElementById('sectionCursos')?.classList.remove('hidden');
                }
                if (data.cursos_json && document.getElementById('publicCursosList')) {
                    try {
                        const cursos = JSON.parse(data.cursos_json);
                        const container = document.getElementById('publicCursosList');
                        container.innerHTML = '';
                        if (cursos.length > 0) {
                            cursos.forEach(c => {
                                const img = c.foto ? `<img src="${c.foto}" alt="${c.nombre}" class="w-full h-48 object-cover rounded-2xl mb-4 shadow-sm">` : '';
                                container.innerHTML += `<div class="bg-white rounded-3xl p-6 text-left border border-slate-100 shadow-sm hover:shadow-xl transition-all hover:-translate-y-1">${img}<h3 class="text-xl font-bold text-slate-800">${c.nombre}</h3>${c.descripcion ? `<p class="text-sm text-slate-500 mt-3 leading-relaxed">${c.descripcion}</p>` : ''}</div>`;
                            });
                            document.getElementById('sectionCursos')?.classList.remove('hidden');
                        }
                    } catch (e) {}
                }
                if (data.profesionales_json && document.getElementById('publicProfesionalesList')) {
                    try {
                        const profs = JSON.parse(data.profesionales_json);
                        const container = document.getElementById('publicProfesionalesList');
                        container.innerHTML = '';
                        if (profs.length > 0) {
                            profs.forEach(p => {
                                const img = p.foto ? `<img src="${p.foto}" alt="${p.nombre}" class="w-32 h-32 rounded-full object-cover mx-auto mb-4 border-4 border-slate-100 shadow-md">` : `<div class="w-32 h-32 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4 border-4 border-slate-100 shadow-md"><span class="material-symbols-outlined text-5xl">person</span></div>`;
                                container.innerHTML += `<div class="bg-white rounded-3xl p-6 text-center border border-slate-100 shadow-sm hover:shadow-xl transition-all hover:-translate-y-1">${img}<h3 class="text-xl font-bold text-slate-800">${p.nombre}</h3><p class="text-sm text-slate-500 mt-3 leading-relaxed">${p.descripcion}</p></div>`;
                            });
                            document.getElementById('sectionProfesionales')?.classList.remove('hidden');
                        }
                    } catch (e) {}
                }

                // Redes Sociales
                if ((data.instagram_url || data.whatsapp_contacto) && document.getElementById('publicSocialLinks')) {
                    const socialContainer = document.getElementById('publicSocialLinks');
                    socialContainer.innerHTML = '';
                    
                    if (data.instagram_url) {
                        socialContainer.innerHTML += `<a href="${data.instagram_url}" target="_blank" class="text-slate-400 hover:text-primary transition-colors flex items-center justify-center p-2" title="Instagram">
                            <svg class="w-7 h-7 fill-current" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
                        </a>`;
                    }
                    if (data.whatsapp_contacto) {
                        const waNum = data.whatsapp_contacto.replace(/\D/g, '');
                        socialContainer.innerHTML += `<a href="https://wa.me/${waNum}" target="_blank" class="text-slate-400 hover:text-emerald-500 transition-colors flex items-center justify-center p-2" title="WhatsApp">
                            <svg class="w-7 h-7 fill-current" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                        </a>`;
                    }
                    socialContainer.classList.remove('hidden');
                    socialContainer.classList.add('flex');
                }
            }

        // --- 2. PROCESAR SERVICIOS ---
            const grid = document.getElementById('servicesGrid');
            grid.innerHTML = '';

            if (!Array.isArray(servicesData) || servicesData.length === 0) {
                grid.innerHTML = '<p class="text-center text-slate-500 col-span-full py-10">No hay servicios disponibles por el momento.</p>';
            } else {
                window.webServicesData = servicesData;
                servicesData.forEach(service => {
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
            }

        // --- 3. OCULTAR PANTALLA DE CARGA ---
        const gl = document.getElementById('globalLoader');
        if (gl) {
            gl.classList.add('opacity-0');
            setTimeout(() => gl.classList.add('hidden'), 150);
        }
    })
    .catch(err => {
        console.error('Error al cargar datos:', err);
        const gl = document.getElementById('globalLoader');
        if (gl) {
            gl.classList.add('opacity-0');
            setTimeout(() => gl.classList.add('hidden'), 150);
        }
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
    document.getElementById('webServiceModalBtn').href = `calendarioMensual.html?n=${negocioSlug}&servicio=${encodeURIComponent(service.nombre)}`;
    const modal = document.getElementById('webServiceModal'); const content = document.getElementById('webServiceModalContent');
    modal.classList.remove('hidden'); setTimeout(() => { modal.classList.remove('opacity-0'); content.classList.remove('scale-95'); }, 10); document.body.style.overflow = 'hidden';
}
window.closeWebModalService = function() {
    const modal = document.getElementById('webServiceModal'); const content = document.getElementById('webServiceModalContent');
    modal.classList.add('opacity-0'); content.classList.add('scale-95'); setTimeout(() => { modal.classList.add('hidden'); document.body.style.overflow = ''; }, 300);
}