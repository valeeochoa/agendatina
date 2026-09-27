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

    // Cargar configuración de la web, servicios y personal en paralelo
    Promise.all([
        fetch('backend/guardar_web.php' + queryParam).then(res => res.json()).catch(() => null),
        fetch('backend/gestionar_servicios.php' + queryParam).then(res => res.json()).catch(() => []),
        fetch('backend/obtener_personal.php' + queryParam).then(res => res.json()).catch(() => [])
    ])
    .then(([data, servicesData, personalData]) => {
        // --- 1. PROCESAR CONFIGURACIÓN WEB ---
            if (data && !data.error) {
                const planStr = (data.plan || '').toLowerCase();
                const calSegment = data.tipo_calendario === 'semanal' ? 'calendarioSemanal' : 'calendarioMensual';
                const cleanLink = negocioSlug ? `/${negocioSlug}/${calSegment}` : `${calSegment}.html${queryParam}`;

                const urlParams = new URLSearchParams(window.location.search);
                const isPreview = urlParams.has('preview') || urlParams.get('preview') === '1' || data.is_demo === true || window.location.pathname.endsWith('web.html');

                // Redirigir al calendario solo si es un cliente directo en una cuenta con plan simple sin miniweb
                if (!isPreview && (planStr.includes('básico') || planStr.includes('basico') || planStr.includes('simple'))) {
                    window.location.replace(cleanLink);
                    return;
                }

                // Actualizar enlaces al calendario usando la ruta dinámica
                if (data.modo_reservas === 'cupos_alumnos') {
                    const isAlumnoLoggedIn = !!sessionStorage.getItem('cliente_email');
                    const handleCuposClick = (e) => {
                        if (!isAlumnoLoggedIn) {
                            e.preventDefault();
                            if (typeof window.openContactoAlumnosModal === 'function') window.openContactoAlumnosModal();
                        }
                    };

                    const navBtn = document.getElementById('navReservarBtn');
                    const heroBtn = document.getElementById('heroReservarBtn');
                    const comoFuncionaBtn = document.getElementById('btnComoFuncionaReservar');
                    const stickyMobileBtn = document.getElementById('stickyMobileReservarBtn');

                    [navBtn, heroBtn, comoFuncionaBtn, stickyMobileBtn].forEach(btn => {
                        if (btn) {
                            btn.href = isAlumnoLoggedIn ? cleanLink : 'javascript:void(0)';
                            btn.addEventListener('click', handleCuposClick);
                        }
                    });
                } else {
                    const navBtn = document.getElementById('navReservarBtn');
                    const heroBtn = document.getElementById('heroReservarBtn');
                    const comoFuncionaBtn = document.getElementById('btnComoFuncionaReservar');
                    const stickyMobileBtn = document.getElementById('stickyMobileReservarBtn');

                    [navBtn, heroBtn, comoFuncionaBtn, stickyMobileBtn].forEach(btn => {
                        if (btn) btn.href = cleanLink;
                    });
                }

                // Verificar sesión del administrador: solo mostrar controles si es el dueño de ESTE negocio
                const btnVolverPanel = document.getElementById('btnVolverPanel');
                const navAgendatinaBrand = document.getElementById('navAgendatinaBrand');
                const navBrandSeparator = document.getElementById('navBrandSeparator');
                const navBizSeparator = document.getElementById('navBizSeparator');
                const adminSessionBadge = document.getElementById('adminSessionBadge');

                fetch('backend/perfil.php')
                .then(r => r.json())
                .then(perfilData => {
                    let isOwner = false;
                    let isDemo = false;
                    if (perfilData && perfilData.success && perfilData.business) {
                        const loggedRuta = (perfilData.business.ruta || '').toLowerCase().trim();
                        const currentRuta = (negocioSlug || data.ruta || '').toLowerCase().trim();
                        
                        isDemo = (perfilData.business.is_demo === true) || 
                                 (perfilData.user && perfilData.user.email === 'demo@agendatina.site') || 
                                 (data.is_demo === true);

                        if (isDemo || (currentRuta && loggedRuta === currentRuta) || (data.id_negocio && perfilData.business.id == data.id_negocio)) {
                            isOwner = true;
                        }
                    }

                    if (isOwner) {
                        if (btnVolverPanel) {
                            btnVolverPanel.classList.remove('hidden');
                            btnVolverPanel.style.display = 'inline-flex';
                            
                            const fromEditor = urlParams.get('from') === 'mi-web' || 
                                               urlParams.get('from') === 'editor' || 
                                               (document.referrer && document.referrer.includes('mi-web.html')) ||
                                               sessionStorage.getItem('agendatina_nav_from') === 'mi-web';
                            if (fromEditor) {
                                btnVolverPanel.href = 'mi-web.html';
                                btnVolverPanel.title = 'Volver al Editor Web';
                                const textSpan = btnVolverPanel.querySelector('.hidden.sm\\:inline') || btnVolverPanel.querySelector('#btnVolverText');
                                if (textSpan) textSpan.textContent = 'Volver al Editor';
                            } else {
                                btnVolverPanel.href = 'dashboard.html';
                                btnVolverPanel.title = 'Volver al Panel';
                                const textSpan = btnVolverPanel.querySelector('.hidden.sm\\:inline') || btnVolverPanel.querySelector('#btnVolverText');
                                if (textSpan) textSpan.textContent = 'Volver al panel';
                            }
                        }
                        if (navAgendatinaBrand) {
                            navAgendatinaBrand.classList.remove('hidden');
                            navAgendatinaBrand.style.display = 'inline-flex';
                        }
                        if (navBrandSeparator) {
                            navBrandSeparator.classList.remove('hidden');
                            navBrandSeparator.style.display = 'inline';
                        }
                        if (navBizSeparator) {
                            navBizSeparator.classList.remove('hidden');
                            navBizSeparator.style.display = 'inline';
                        }
                        if (isDemo && adminSessionBadge) {
                            adminSessionBadge.classList.remove('hidden');
                            adminSessionBadge.style.display = 'inline-flex';
                        }
                    } else {
                        // Visitante / Cliente / Dueño de otro negocio viendo este negocio:
                        // Ocultar TODO control administrativo y de Agendatina del navbar superior
                        if (btnVolverPanel) { btnVolverPanel.classList.add('hidden'); btnVolverPanel.style.display = 'none'; }
                        if (navAgendatinaBrand) { navAgendatinaBrand.classList.add('hidden'); navAgendatinaBrand.style.display = 'none'; }
                        if (navBrandSeparator) { navBrandSeparator.classList.add('hidden'); navBrandSeparator.style.display = 'none'; }
                        if (navBizSeparator) { navBizSeparator.classList.add('hidden'); navBizSeparator.style.display = 'none'; }
                        if (adminSessionBadge) { adminSessionBadge.classList.add('hidden'); adminSessionBadge.style.display = 'none'; }
                    }
                })
                .catch(() => {
                    if (btnVolverPanel) { btnVolverPanel.classList.add('hidden'); btnVolverPanel.style.display = 'none'; }
                    if (navAgendatinaBrand) { navAgendatinaBrand.classList.add('hidden'); navAgendatinaBrand.style.display = 'none'; }
                    if (navBrandSeparator) { navBrandSeparator.classList.add('hidden'); navBrandSeparator.style.display = 'none'; }
                    if (navBizSeparator) { navBizSeparator.classList.add('hidden'); navBizSeparator.style.display = 'none'; }
                    if (adminSessionBadge) { adminSessionBadge.classList.add('hidden'); adminSessionBadge.style.display = 'none'; }
                });

                const title = data.titulo || data.nombre_fantasia || '';
                if (title) {
                    document.title = title;
                    const navTitle = document.getElementById('navBusinessNameText') || document.getElementById('navTitle');
                    if (navTitle) navTitle.textContent = title;
                    
                    const heroTitle = document.getElementById('heroTitle');
                    if (heroTitle) heroTitle.textContent = title;
                    
                    const footerName = document.getElementById('footerName');
                    if (footerName) footerName.textContent = title;
                }

                if (data.subtitulo && document.getElementById('heroSubtitle')) {
                    document.getElementById('heroSubtitle').textContent = data.subtitulo;
                }

                if (data.fondo && document.getElementById('heroBackground')) {
                    document.getElementById('heroBackground').style.backgroundImage = `url('${data.fondo}')`;
                    document.getElementById('heroBackground').classList.remove('opacity-40');
                    document.getElementById('heroBackground').classList.add('opacity-50');
                }

                const navIcon = document.getElementById('navBusinessIcon') || document.getElementById('navIcon');
                const navLogo = document.getElementById('navBusinessLogoImg') || document.getElementById('navLogo');
                if (data.logo) {
                    if (navIcon) navIcon.classList.add('hidden');
                    if (navLogo) {
                        navLogo.src = data.logo;
                        navLogo.classList.remove('hidden');
                    }
                    const favicon = document.querySelector('link[rel="icon"]');
                    if (favicon) favicon.href = data.logo;
                } else if (title) {
                    if (navIcon) navIcon.classList.remove('hidden');
                    if (navLogo) navLogo.classList.add('hidden');
                }

                // Cargar datos dinámicos en la Barra de Atajos
                const infoStripHorarios = document.getElementById('infoStripHorarios');
                if (infoStripHorarios) {
                    if (data.hora_apertura && data.hora_cierre) {
                        infoStripHorarios.textContent = `${data.hora_apertura} a ${data.hora_cierre} hs`;
                    } else {
                        infoStripHorarios.textContent = 'Horarios Flexibles';
                    }
                }
                const infoStripWhatsApp = document.getElementById('infoStripWhatsApp');
                const floatingWpp = document.getElementById('btnFloatingWhatsApp');
                if (data.whatsapp_contacto) {
                    const waNum = data.whatsapp_contacto.replace(/\D/g, '');
                    const waUrl = `https://wa.me/${waNum}?text=Hola!%20Quisiera%20hacer%20una%20consulta.`;
                    if (infoStripWhatsApp) {
                        infoStripWhatsApp.href = waUrl;
                        infoStripWhatsApp.target = '_blank';
                        infoStripWhatsApp.textContent = data.whatsapp_contacto;
                    }
                    if (floatingWpp) {
                        floatingWpp.href = waUrl;
                        floatingWpp.classList.remove('hidden');
                        floatingWpp.style.display = 'inline-flex';
                    }
                } else {
                    if (infoStripWhatsApp) infoStripWhatsApp.textContent = 'Atención Online';
                }

                // Barra Móvil Flotante para Reservas en Scroll
                const stickyMobileBar = document.getElementById('stickyMobileBar');
                const stickyMobileBizName = document.getElementById('stickyMobileBizName');
                if (stickyMobileBizName) {
                    stickyMobileBizName.textContent = title || 'Reservá tu Turno';
                }
                if (stickyMobileBar) {
                    window.addEventListener('scroll', () => {
                        if (window.scrollY > 280) {
                            stickyMobileBar.classList.remove('translate-y-full');
                        } else {
                            stickyMobileBar.classList.add('translate-y-full');
                        }
                    }, { passive: true });
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
                    if (style) style.innerHTML = stylesHTML;
                }

                window.applyServiceAlignmentCSS = function(alignVal) {
                    if (!alignVal) alignVal = 'left';
                    const flexJustify = alignVal === 'center' ? 'center' : (alignVal === 'right' ? 'flex-end' : 'flex-start');
                    
                    let styleAlign = document.getElementById('agendatina-service-alignment');
                    if (!styleAlign) {
                        styleAlign = document.createElement('style');
                        styleAlign.id = 'agendatina-service-alignment';
                        document.head.appendChild(styleAlign);
                    }
                    styleAlign.innerHTML = `
                        #servicesGrid, #publicProfesionalesList, #publicCursosList {
                            display: flex !important;
                            flex-wrap: wrap !important;
                            justify-content: ${flexJustify} !important;
                            gap: 2rem !important;
                        }
                        #servicesGrid > div, 
                        #publicProfesionalesList > div, 
                        #publicCursosList > div,
                        .service-card, 
                        .card-servicio {
                            flex: 0 1 360px !important;
                            max-width: 100% !important;
                            width: 100% !important;
                        }
                        @media (min-width: 768px) {
                            #servicesGrid > div, 
                            #publicProfesionalesList > div, 
                            #publicCursosList > div,
                            .service-card, 
                            .card-servicio {
                                width: 360px !important;
                            }
                        }
                        .service-card .p-6, .card-servicio .p-6 {
                            text-align: left !important;
                        }
                        .service-card h3, .card-servicio h3,
                        .service-card p, .card-servicio p,
                        .service-card .line-clamp-3, .card-servicio .line-clamp-3 {
                            text-align: left !important;
                        }
                    `;
                };

                if (data.alineacion_servicios) {
                    window.applyServiceAlignmentCSS(data.alineacion_servicios);
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
                
                // Consolidar equipo / profesionales
                let allProfs = [];
                if (data.profesionales_json) {
                    try {
                        const parsed = JSON.parse(data.profesionales_json);
                        if (Array.isArray(parsed)) {
                            parsed.forEach(p => {
                                if (p.nombre && p.nombre.trim() !== '') {
                                    allProfs.push({
                                        nombre: p.nombre.trim(),
                                        descripcion: p.descripcion || 'Especialista del equipo',
                                        foto: p.foto || ''
                                    });
                                }
                            });
                        }
                    } catch (e) {}
                }
                
                if (Array.isArray(personalData) && personalData.length > 0) {
                    personalData.forEach(p => {
                        const name = p.nombre_completo || p.nombre;
                        if (name && !name.includes('@')) {
                            const exists = allProfs.some(existP => existP.nombre.toLowerCase() === name.trim().toLowerCase());
                            if (!exists) {
                                allProfs.push({
                                    nombre: name.trim(),
                                    descripcion: p.rol_en_local === 'admin' ? 'Administrador del local' : 'Especialista del equipo',
                                    foto: p.foto || ''
                                });
                            }
                        }
                    });
                }
                
                if (Array.isArray(servicesData) && servicesData.length > 0) {
                    servicesData.forEach(s => {
                        if (s.profesional && s.profesional.trim() !== '' && s.profesional !== 'Cualquiera (Sin preferencia)') {
                            const profName = s.profesional.trim();
                            if (!profName.includes('@')) {
                                const exists = allProfs.some(p => p.nombre && p.nombre.toLowerCase() === profName.toLowerCase());
                                if (!exists) {
                                    allProfs.push({
                                        nombre: profName,
                                        descripcion: 'Especialista del equipo',
                                        foto: s.foto_profesional || ''
                                    });
                                }
                            }
                        }
                    });
                }
                
                if (allProfs.length > 0 && document.getElementById('publicProfesionalesList')) {
                    const container = document.getElementById('publicProfesionalesList');
                    container.innerHTML = '';
                    allProfs.forEach(p => {
                        const img = p.foto ? `<img src="${p.foto}" alt="${p.nombre}" class="w-32 h-32 rounded-full object-cover mx-auto mb-4 border-4 border-slate-100 shadow-md">` : `<div class="w-32 h-32 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4 border-4 border-slate-100 shadow-md"><span class="material-symbols-outlined text-5xl">person</span></div>`;
                        container.innerHTML += `<div class="bg-white rounded-3xl p-6 text-center border border-slate-100 shadow-sm hover:shadow-xl transition-all hover:-translate-y-1">${img}<h3 class="text-xl font-bold text-slate-800">${p.nombre}</h3><p class="text-sm text-slate-500 mt-3 leading-relaxed">${p.descripcion || 'Profesional'}</p></div>`;
                    });
                    document.getElementById('sectionProfesionales')?.classList.remove('hidden');
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
                let pkgs = [];
                try {
                    pkgs = typeof service.precios_paquetes_json === 'string' ? JSON.parse(service.precios_paquetes_json || '[]') : (service.precios_paquetes_json || []);
                } catch(e) {}
                const tienePases = Array.isArray(pkgs) && pkgs.length > 0;
                const numPrecio = parseFloat(service.precio || 0);

                let precio = '';
                if (numPrecio > 0) {
                    precio = `<span class="font-bold text-lg text-primary">$${numPrecio.toLocaleString('es-AR')}</span>`;
                } else if (tienePases) {
                    const preciosValidos = pkgs.map(p => parseFloat(p.precio || 0)).filter(p => p > 0);
                    const minP = preciosValidos.length > 0 ? Math.min(...preciosValidos) : 0;
                    const txtPase = minP > 0 ? `Desde $${minP.toLocaleString('es-AR')} (Pases)` : 'Tarifas por Pases';
                    precio = `<span class="font-extrabold text-xs text-[#FC8712] bg-orange-50 border border-orange-200/80 px-2.5 py-1 rounded-xl inline-flex items-center gap-1 shadow-2xs"><span class="material-symbols-outlined text-[14px]">inventory_2</span> ${txtPase}</span>`;
                }
                const imgs = [service.imagen1, service.imagen2, service.imagen3].filter(Boolean);
                const svcIcon = service.icono || 'local_florist';
                let imagesHtml = `<div class="h-48 w-full bg-primary/10 flex items-center justify-center text-primary border-b border-primary/10"><span class="material-symbols-outlined text-6xl">${svcIcon}</span></div>`;
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

            const durFmt = (function(raw) {
                const min = parseInt(raw) || 0;
                if (min <= 0) return '15 min';
                const h = Math.floor(min / 60);
                const m = min % 60;
                if (h > 0 && m > 0) return `${h} h ${m} min`;
                if (h > 0) return h === 1 ? '1 hora' : `${h} horas`;
                return `${m} min`;
            })(service.duracion);

                let packagesBadgeHtml = '';
                try {
                    const pkgs = typeof service.precios_paquetes_json === 'string' ? JSON.parse(service.precios_paquetes_json || '[]') : (service.precios_paquetes_json || []);
                    if (Array.isArray(pkgs) && pkgs.length > 0) {
                        packagesBadgeHtml = '<div class="flex flex-wrap gap-1 mt-2 mb-3 w-full justify-start">' + pkgs.map(p => 
                            `<span class="bg-orange-50 text-[#FC8712] border border-orange-200/80 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold flex items-center gap-1"><span class="material-symbols-outlined text-[13px]">inventory_2</span> ${p.cupos} clases x $${parseFloat(p.precio).toLocaleString('es-AR')}</span>`
                        ).join('') + '</div>';
                    }
                } catch(e) {}

                grid.innerHTML += `
                    <div onclick="openWebModalService('${service.id}')" data-name="${(service.nombre || '').replace(/"/g, '&quot;')}" data-desc="${(plainTextDesc || '').replace(/"/g, '&quot;')}" class="service-card cursor-pointer bg-white rounded-3xl shadow-sm border border-slate-200/80 overflow-hidden flex flex-col hover:shadow-2xl hover:shadow-primary/10 hover:-translate-y-1.5 transition-all duration-300 group">
                        ${imagesHtml}
                        <div class="p-6 flex flex-col flex-1 items-start text-left">
                            <h3 class="text-xl font-bold text-slate-800 leading-tight mb-2 w-full text-left group-hover:text-primary transition-colors">${service.nombre}</h3>
                            <div class="flex items-center gap-1.5 text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1 rounded-xl mb-3"><span class="material-symbols-outlined text-[16px]">schedule</span> ${durFmt}</div>
                            ${packagesBadgeHtml}
                            <div class="text-slate-500 text-sm mb-6 flex-1 line-clamp-3 overflow-hidden w-full text-left leading-relaxed" style="display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical;" title="Clic para leer más">${plainTextDesc}</div>
                            <div class="flex items-center justify-between w-full mt-auto pt-4 border-t border-slate-100">
                                <div>${precio}</div>
                                <span class="text-primary font-bold text-xs sm:text-sm flex items-center gap-1 group-hover:translate-x-1 transition-transform">Ver detalles <span class="material-symbols-outlined text-base">arrow_forward</span></span>
                            </div>
                        </div>
                    </div>
                `;
            });

            // Activar buscador de servicios si hay más de 2 servicios
            if (servicesData.length > 2) {
                document.getElementById('serviceSearchWrapper')?.classList.remove('hidden');
            }

            window.filterWebServices = function(val) {
                val = (val || '').toLowerCase().trim();
                const cards = document.querySelectorAll('.service-card');
                const clearBtn = document.getElementById('clearSearchBtn');
                const countEl = document.getElementById('serviceSearchCount');
                if (clearBtn) clearBtn.classList.toggle('hidden', val === '');
                
                let visibleCount = 0;
                cards.forEach(card => {
                    const name = (card.dataset.name || '').toLowerCase();
                    const desc = (card.dataset.desc || '').toLowerCase();
                    const matches = !val || name.includes(val) || desc.includes(val);
                    card.style.display = matches ? '' : 'none';
                    if (matches) visibleCount++;
                });
                
                if (countEl) {
                    if (val !== '') {
                        countEl.textContent = `Mostrando ${visibleCount} de ${cards.length} servicios`;
                        countEl.classList.remove('hidden');
                    } else {
                        countEl.classList.add('hidden');
                    }
                }
                
                let noMatchMsg = document.getElementById('noServicesFoundMsg');
                if (visibleCount === 0 && cards.length > 0) {
                    if (!noMatchMsg && grid) {
                        noMatchMsg = document.createElement('div');
                        noMatchMsg.id = 'noServicesFoundMsg';
                        noMatchMsg.className = 'w-full max-w-md mx-auto py-12 text-center text-slate-500';
                        noMatchMsg.innerHTML = `
                            <span class="material-symbols-outlined text-5xl text-slate-300 mb-3">search_off</span>
                            <p class="font-bold text-slate-700 text-base">No encontramos servicios que coincidan con "${val}"</p>
                            <p class="text-xs text-slate-400 mt-1.5">Probá con otro término o limpiá el buscador.</p>
                            <button type="button" onclick="window.clearServiceSearch()" class="mt-4 px-5 py-2.5 bg-primary/10 hover:bg-primary/20 text-primary font-bold rounded-xl text-xs transition-all">Limpiar Búsqueda</button>
                        `;
                        grid.appendChild(noMatchMsg);
                    }
                } else if (noMatchMsg) {
                    noMatchMsg.remove();
                }
            };

            window.clearServiceSearch = function() {
                const input = document.getElementById('serviceSearchInput');
                if (input) input.value = '';
                window.filterWebServices('');
            };

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
    const durFmtModal = (function(raw) {
        const min = parseInt(raw) || 0;
        if (min <= 0) return '15 min';
        const h = Math.floor(min / 60);
        const m = min % 60;
        if (h > 0 && m > 0) return `${h} h ${m} min`;
        if (h > 0) return h === 1 ? '1 hora' : `${h} horas`;
        return `${m} min`;
    })(service.duracion);
    document.getElementById('webServiceModalDuration').innerHTML = `<span class="material-symbols-outlined text-base">schedule</span> ${durFmtModal}`;
    let packagesModalHtml = '';
    try {
        const pkgs = typeof service.precios_paquetes_json === 'string' ? JSON.parse(service.precios_paquetes_json || '[]') : (service.precios_paquetes_json || []);
        if (Array.isArray(pkgs) && pkgs.length > 0) {
            packagesModalHtml = '<div class="mt-4 p-4 bg-orange-50/90 border border-orange-200/90 rounded-2xl space-y-2 text-left"><span class="text-xs font-black text-slate-800 uppercase tracking-wider block flex items-center gap-1.5"><span class="material-symbols-outlined text-[#FC8712] text-[18px]">inventory_2</span> Paquetes de Pases Disponibles</span><div class="grid grid-cols-1 sm:grid-cols-2 gap-2">' + pkgs.map(p => 
                `<div class="bg-white p-3 rounded-xl border border-orange-200/70 shadow-2xs flex justify-between items-center"><div><span class="text-xs font-extrabold text-slate-800 block">${p.etiqueta || p.cupos + ' Clases'}</span><span class="text-[10px] font-bold text-slate-400 block">${p.cupos} clases / cupos</span></div><span class="text-sm font-black text-[#FC8712]">$${parseFloat(p.precio).toLocaleString('es-AR')}</span></div>`
            ).join('') + '</div></div>';
        }
    } catch(e) {}
    document.getElementById('webServiceModalDesc').innerHTML = (service.descripcion || 'Sin descripción detallada.') + packagesModalHtml;
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
        const modalIcon = service.icono || 'local_florist';
        imgContainer.innerHTML = `<div class="h-44 w-full bg-primary/10 flex items-center justify-center text-primary rounded-2xl border border-primary/20"><span class="material-symbols-outlined text-6xl">${modalIcon}</span></div>`;
        imgContainer.classList.remove('hidden'); 
    }
    const negocioSlug = new URLSearchParams(window.location.search).get('n') || (window.location.pathname.split('/').filter(p => p && !p.includes('.'))[0] || '');
    document.getElementById('webServiceModalBtn').href = `calendarioMensual.html?n=${negocioSlug}&servicio=${encodeURIComponent(service.nombre)}`;
    const modal = document.getElementById('webServiceModal'); const content = document.getElementById('webServiceModalContent');
    modal.classList.remove('hidden'); setTimeout(() => { modal.classList.remove('opacity-0'); content.classList.remove('scale-95'); }, 10); document.body.style.overflow = 'hidden';
}
window.closeWebModalService = function() {
    const modal = document.getElementById('webServiceModal'); const content = document.getElementById('webServiceModalContent');
    modal.classList.add('opacity-0'); content.classList.add('scale-95'); setTimeout(() => { modal.classList.add('hidden'); document.body.style.overflow = ''; }, 300);
};

window.openContactoAlumnosModal = function() {
    const modal = document.getElementById('modalContactoAlumnos');
    if (modal) modal.classList.remove('hidden');
};

window.closeContactoAlumnosModal = function() {
    const modal = document.getElementById('modalContactoAlumnos');
    if (modal) modal.classList.add('hidden');
};

window.submitContactoAlumno = function(e) {
    e.preventDefault();
    const btn = document.getElementById('btnContactoSubmit');
    if (btn) { btn.disabled = true; btn.textContent = 'Enviando...'; }

    const nombre = document.getElementById('alumnoNombre')?.value || '';
    const telefono = document.getElementById('alumnoTelefono')?.value || '';
    const email = document.getElementById('alumnoEmail')?.value || '';
    const mensaje = document.getElementById('alumnoMensaje')?.value || '';

    const formData = new FormData();
    formData.append('action', 'report_error');
    formData.append('tipo', 'Solicitud de Alta de Alumno');
    formData.append('nombre', nombre);
    formData.append('email', email);
    formData.append('telefono', telefono);
    formData.append('mensaje', `Solicitud de Alta de Alumno / Reserva Exclusiva.\nNombre: ${nombre}\nWhatsApp: ${telefono}\nEmail: ${email}\nConsulta: ${mensaje}`);

    fetch('backend/enviar_soporte.php', { method: 'POST', body: formData })
    .then(r => r.json())
    .then(d => {
        if (btn) { btn.disabled = false; btn.textContent = 'Enviar Datos de Contacto'; }
        if (typeof window.closeContactoAlumnosModal === 'function') window.closeContactoAlumnosModal();
        if (typeof showToast === 'function') showToast('Tus datos han sido enviados al negocio. Se contactarán a la brevedad.', 'success');
        else alert('Tus datos han sido enviados al establecimiento. Se contactarán a la brevedad.');
        e.target.reset();
    })
    .catch(() => {
        if (btn) { btn.disabled = false; btn.textContent = 'Enviar Datos de Contacto'; }
        if (typeof window.closeContactoAlumnosModal === 'function') window.closeContactoAlumnosModal();
        if (typeof showToast === 'function') showToast('Tus datos han sido registrados con éxito.', 'success');
        else alert('Tus datos han sido registrados con éxito.');
    });
};