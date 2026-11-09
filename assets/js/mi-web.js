// Lógica para el Editor Visual de la Página Web (mi-web.html)

function formatDuracionText(minutosRaw) {
    const min = parseInt(minutosRaw, 10) || 0;
    if (min <= 0) return '15 min';
    const h = Math.floor(min / 60);
    const m = min % 60;
    if (h > 0 && m > 0) return `${h} h ${m} min`;
    if (h > 0 && m === 0) return h === 1 ? '1 hora' : `${h} horas`;
    return `${m} min`;
}

document.addEventListener('DOMContentLoaded', () => {
    // 0. Sincronización inmediata del Navbar y verificación de sesión
    fetch('backend/perfil.php')
        .then(res => res.json())
        .then(data => {
            if (!data || !data.success || !data.business) {
                const errReason = (data && data.error) ? data.error : 'Sin respuesta válida de sesión en mi-web';
                console.error('⚠️ [Error de Carga - Mi Web] No se pudo volver a cargar la información. Motivo:', errReason);
                window.location.href = 'login.html';
                return;
            }
            if (data && data.success && data.business) {
                const b = data.business;
                const isDemo = (b.is_demo === true) || (data.user && data.user.email === 'demo@agendatina.site') || (b.ruta === 'demo');
                
                // Badge modo demo
                const badge = document.getElementById('adminSessionBadge');
                const badgeText = document.getElementById('adminSessionBadgeText');
                if (badge && isDemo) {
                    badge.classList.remove('hidden');
                    badge.classList.add('flex');
                    if (badgeText) badgeText.textContent = 'Modo Demo';
                }

                // Sincronizar nombre del negocio en Navbar
                window.currentBusinessAdminName = (data.user && data.user.nombre_completo) ? data.user.nombre_completo : '';
                const bizName = b.nombre_fantasia || (isDemo ? 'Agendatina' : 'Mi Negocio');
                const navName = document.getElementById('navBusinessNameText');
                if (navName) navName.textContent = bizName;

                // Sincronizar logo en Navbar
                const logoUrl = b.logo || b.url_logo;
                const navLogo = document.getElementById('navBusinessLogoImg');
                const navIcon = document.getElementById('navBusinessIcon');
                if (logoUrl && navLogo) {
                    navLogo.src = logoUrl;
                    navLogo.classList.remove('hidden');
                    if (navIcon) navIcon.classList.add('hidden');
                }

                // Asegurar visibilidad de volver al panel, marca oficial y reportar error
                const btnVolver = document.getElementById('btnVolverPanel');
                if (btnVolver) {
                    btnVolver.classList.remove('hidden');
                    btnVolver.style.display = 'inline-flex';
                }
                const brand = document.getElementById('navAgendatinaBrand');
                if (brand) {
                    brand.classList.remove('hidden');
                    brand.style.display = 'inline-flex';
                }
                const sep = document.getElementById('navBrandSeparator');
                if (sep) {
                    sep.classList.remove('hidden');
                    sep.style.display = 'inline';
                }
                const btnReport = document.getElementById('navReportBugBtn');
                if (btnReport && !isDemo) {
                    btnReport.classList.remove('hidden');
                    btnReport.style.display = 'inline-flex';
                }
            }
        }).catch((err) => {
            console.error('⚠️ [Error de Carga - Mi Web] Desconexión de red o fallo al volver a cargar información:', err);
            if (sessionStorage.getItem('is_demo_user') === 'true' && !sessionStorage.getItem('demo_retry_attempted')) {
                sessionStorage.setItem('demo_retry_attempted', 'true');
                window.location.href = 'demo.php';
            } else {
                sessionStorage.removeItem('is_demo_user');
                sessionStorage.removeItem('demo_retry_attempted');
                window.location.href = 'login.html';
            }
        });

    const webTitulo = document.getElementById('webTitulo');
    if (!webTitulo) return; // Si no estamos en la página mi-web.html, no ejecutar.

    window.profesionalesWebData = [];
    window.cursosWebData = [];
    window.currentWebData = {};

    const webSubtitulo = document.getElementById('webSubtitulo');
    const webFondo = document.getElementById('webFondo');
    const webColorPrimario = document.getElementById('webColorPrimario');
    const webColorSecundario = document.getElementById('webColorSecundario');
    const webColorFondo = document.getElementById('webColorFondo');
    const webAlineacion = document.getElementById('webAlineacion');
    const webTextoLocal = document.getElementById('webTextoLocal');
    const webUbicacionMaps = document.getElementById('webUbicacionMaps');
    const webInstagramUrl = document.getElementById('webInstagramUrl');
    const webWhatsappContacto = document.getElementById('webWhatsappContacto');
    const saveWebDataBtn = document.getElementById('saveWebDataBtn');

    // Inicializar previsualizaciones de imágenes
    const fileInputs = ['webLogo', 'webFondoFile', 'cursoWebPhoto'];
    fileInputs.forEach(id => {
        const el = document.getElementById(id);
        if (el && typeof enableImagePreview === 'function') enableImagePreview(el);
    });
    const formServ = document.getElementById('serviceDetailForm');
    if (formServ && typeof enableImagePreview === 'function') {
        enableImagePreview(formServ.querySelector('input[name="foto_profesional_file"]'));
        enableImagePreview(formServ.querySelector('input[name="imagen1_file"]'));
        enableImagePreview(formServ.querySelector('input[name="imagen2_file"]'));
        enableImagePreview(formServ.querySelector('input[name="imagen3_file"]'));
    }

    // Funciones auxiliares para previsualización interactiva de Logo y Portada
    window.updateLogoPreview = function(src) {
        const previewBox = document.getElementById('webLogoPreviewBox');
        const emptyBox = document.getElementById('webLogoEmptyBox');
        const previewImg = document.getElementById('webLogoPreviewImg');
        if (src && previewBox && emptyBox && previewImg) {
            previewImg.src = src;
            previewBox.classList.remove('hidden');
            emptyBox.classList.add('hidden');
        } else if (previewBox && emptyBox) {
            previewBox.classList.add('hidden');
            emptyBox.classList.remove('hidden');
        }
    };

    window.updateFondoPreview = function(src) {
        const previewBox = document.getElementById('webFondoPreviewBox');
        const emptyBox = document.getElementById('webFondoEmptyBox');
        const previewImg = document.getElementById('webFondoPreviewImg');
        if (src && previewBox && emptyBox && previewImg) {
            previewImg.src = src;
            previewBox.classList.remove('hidden');
            emptyBox.classList.add('hidden');
        } else if (previewBox && emptyBox) {
            previewBox.classList.add('hidden');
            emptyBox.classList.remove('hidden');
        }
    };

    const webLogoInput = document.getElementById('webLogo');
    if (webLogoInput) {
        webLogoInput.addEventListener('change', function() {
            if (this.files && this.files[0]) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    window.updateLogoPreview(e.target.result);
                    const rm = document.getElementById('webLogoRemoved');
                    if (rm) rm.value = '0';
                };
                reader.readAsDataURL(this.files[0]);
            }
        });
    }

    const webFondoFileInput = document.getElementById('webFondoFile');
    if (webFondoFileInput) {
        webFondoFileInput.addEventListener('change', function() {
            if (this.files && this.files[0]) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    window.updateFondoPreview(e.target.result);
                    const rm = document.getElementById('webFondoRemoved');
                    if (rm) rm.value = '0';
                };
                reader.readAsDataURL(this.files[0]);
            }
        });
    }

    window.removeLogoAction = function() {
        const input = document.getElementById('webLogo');
        if (input) input.value = '';
        const rm = document.getElementById('webLogoRemoved');
        if (rm) rm.value = '1';
        window.updateLogoPreview(null);
        if (typeof showToast === 'function') showToast('Logo marcado para eliminar al guardar cambios', 'info');
    };

    window.removeFondoAction = function() {
        const input = document.getElementById('webFondoFile');
        if (input) input.value = '';
        const hiddenFondo = document.getElementById('webFondo');
        if (hiddenFondo) hiddenFondo.value = '';
        const rm = document.getElementById('webFondoRemoved');
        if (rm) rm.value = '1';
        window.updateFondoPreview(null);
        if (typeof showToast === 'function') showToast('Portada marcada para eliminar al guardar cambios', 'info');
    };

    // Live Components Preview de Paleta de Colores
    window.updateLiveComponentsPreview = function() {
        const p = document.getElementById('webColorPrimario')?.value || '#D11149';
        const s = document.getElementById('webColorSecundario')?.value || '#FC8712';
        const f = document.getElementById('webColorFondo')?.value || '#F8FAFC';

        const prevCard = document.getElementById('livePreviewCard');
        const prevBtn = document.getElementById('livePreviewBtn');
        const prevBadge = document.getElementById('livePreviewBadge');
        const prevPill = document.getElementById('livePreviewPill');

        if (prevCard) prevCard.style.backgroundColor = f;
        if (prevBtn) {
            prevBtn.style.backgroundColor = p;
            prevBtn.style.boxShadow = `0 4px 14px ${p}33`;
        }
        if (prevBadge) {
            prevBadge.style.backgroundColor = `${s}18`;
            prevBadge.style.color = s;
            prevBadge.style.borderColor = `${s}35`;
        }
        if (prevPill) {
            prevPill.style.backgroundColor = p;
        }
    };
    if (webAlineacion) {
        webAlineacion.addEventListener('change', () => {
            const alignVal = webAlineacion.value;
            if (typeof window.applyServiceAlignmentCSS === 'function') {
                window.applyServiceAlignmentCSS(alignVal);
            } else {
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
            }
        });
    }

    // 1. CARGAR DATOS WEB AL INICIAR
    fetch('backend/guardar_web.php')
        .then(async res => {
            const rawText = await res.text();
            try {
                return JSON.parse(rawText);
            } catch(e) {
                console.warn('⚠️ [Mi Web] Respuesta no JSON recibida de backend/guardar_web.php:', rawText.substring(0, 150));
                return null;
            }
        })
        .then(data => {
            if (!data) return;
            if (data && data.error) {
                if (data.error.toLowerCase().includes('inicia sesión') || data.error.toLowerCase().includes('autorizado')) {
                    window.location.href = 'login.html';
                }
                return;
            }
            if (data && !data.error) {
            if (data.ruta) {
                const btnVer = document.getElementById('btnVerMiPagina');
                if (btnVer) {
                    btnVer.href = 'web.html?n=' + encodeURIComponent(data.ruta) + '&from=mi-web&preview=1';
                    btnVer.removeAttribute('target');
                    btnVer.setAttribute('onclick', "sessionStorage.setItem('agendatina_nav_from', 'mi-web')");
                }
            }
                window.currentWebData = data;
                if (data.titulo) webTitulo.value = data.titulo;
                if (data.subtitulo) webSubtitulo.value = data.subtitulo;
                if (data.fondo && webFondo) {
                    webFondo.value = data.fondo;
                    window.updateFondoPreview(data.fondo);
                }
                if (data.logo) {
                    window.updateLogoPreview(data.logo);
                }
                if (data.texto_local && webTextoLocal) webTextoLocal.value = data.texto_local;
                if (data.ubicacion_maps && webUbicacionMaps) webUbicacionMaps.value = data.ubicacion_maps;
                if (data.instagram_url && webInstagramUrl) webInstagramUrl.value = data.instagram_url;
                if (data.whatsapp_contacto && webWhatsappContacto) webWhatsappContacto.value = data.whatsapp_contacto;
                if (data.alineacion_servicios && webAlineacion) {
                    webAlineacion.value = data.alineacion_servicios;
                    const event = new Event('change');
                    webAlineacion.dispatchEvent(event);
                }

                if (data.color_primario_web) webColorPrimario.value = data.color_primario_web;
                else if (data.color_primario) webColorPrimario.value = data.color_primario;
                
                if (data.color_secundario_web) webColorSecundario.value = data.color_secundario_web;
                else if (data.color_secundario) webColorSecundario.value = data.color_secundario;
                
                if (data.color_fondo) webColorFondo.value = data.color_fondo;

                // Actualizar previews de colores
                const hP = document.getElementById('hexPreviewPrimario'); if (hP) hP.textContent = webColorPrimario.value.toUpperCase();
                const hS = document.getElementById('hexPreviewSecundario'); if (hS) hS.textContent = webColorSecundario.value.toUpperCase();
                const hF = document.getElementById('hexPreviewFondo'); if (hF) hF.textContent = webColorFondo.value.toUpperCase();
                window.updateLiveComponentsPreview();

                if (data.profesionales_json) {
                    try { window.profesionalesWebData = JSON.parse(data.profesionales_json); } catch(e) { window.profesionalesWebData = []; }
                    if (!Array.isArray(window.profesionalesWebData)) window.profesionalesWebData = [];
                    if (Array.isArray(window.webServicesData) && window.webServicesData.length > 0 && typeof syncProfesionalesFromServices === 'function') {
                        syncProfesionalesFromServices(window.webServicesData);
                    } else {
                        renderProfesionalesWeb();
                    }
                } else {
                    if (Array.isArray(window.webServicesData) && window.webServicesData.length > 0 && typeof syncProfesionalesFromServices === 'function') {
                        syncProfesionalesFromServices(window.webServicesData);
                    } else {
                        renderProfesionalesWeb();
                    }
                }
                if (data.cursos_json) {
                    try { window.cursosWebData = JSON.parse(data.cursos_json); } catch(e) { window.cursosWebData = []; }
                    renderCursosWeb();
                }
            }
        })
        .catch(err => console.error('Error al cargar datos web:', err))
        .finally(() => {
            const loader = document.getElementById('webLoader');
            const mainContent = document.getElementById('webMainContent');
            if (loader && mainContent) {
                loader.classList.add('hidden');
                mainContent.classList.remove('hidden');
                setTimeout(() => mainContent.classList.remove('opacity-0'), 50);
            }
        });

    // 2. GUARDAR DATOS WEB
    saveWebDataBtn.addEventListener('click', async () => {
        saveWebDataBtn.textContent = 'Guardando...';
        saveWebDataBtn.disabled = true;

        const formData = new FormData();
        formData.append('titulo', webTitulo.value);
        formData.append('subtitulo', webSubtitulo.value);
        formData.append('color_primario_web', webColorPrimario.value);
        formData.append('color_secundario_web', webColorSecundario.value);
        formData.append('color_fondo', webColorFondo.value);
        
        if (webTextoLocal) formData.append('texto_local', webTextoLocal.value);
        if (webUbicacionMaps) formData.append('ubicacion_maps', webUbicacionMaps.value);
        if (webInstagramUrl) formData.append('instagram_url', webInstagramUrl.value);
        if (webWhatsappContacto) formData.append('whatsapp_contacto', webWhatsappContacto.value);
        formData.append('profesionales_json', JSON.stringify(window.profesionalesWebData));
        formData.append('cursos_json', JSON.stringify(window.cursosWebData));
        if (webAlineacion) formData.append('alineacion_servicios', webAlineacion.value);

        const webLogoInput = document.getElementById('webLogo');
        if (webLogoInput && webLogoInput.files && webLogoInput.files[0]) {
            formData.append('logo_file', webLogoInput.files[0]);
        }

        const webFondoInput = document.getElementById('webFondoFile');
        if (webFondoInput && webFondoInput.files && webFondoInput.files[0]) {
            formData.append('fondo_file', webFondoInput.files[0]);
        }

        if (document.getElementById('webLogoRemoved') && document.getElementById('webLogoRemoved').value === '1') {
            formData.append('remove_logo', '1');
        }
        if (document.getElementById('webFondoRemoved') && document.getElementById('webFondoRemoved').value === '1') {
            formData.append('remove_fondo', '1');
        }

        fetch('backend/guardar_web.php', { method: 'POST', body: formData })
        .then(async res => {
            const rawText = await res.text();
            try {
                return JSON.parse(rawText);
            } catch(e) {
                console.warn('⚠️ [Mi Web] Respuesta no JSON al guardar en backend/guardar_web.php:', rawText.substring(0, 150));
                return { success: false, error: 'Respuesta inesperada del servidor' };
            }
        })
        .then(data => {
            if (data.success) {
                saveWebDataBtn.textContent = '¡Guardado!';
                saveWebDataBtn.classList.replace('bg-green-600', 'bg-emerald-600');
                if (typeof showToast === 'function') showToast('Cambios guardados con éxito', 'success');
                
                try { if (typeof applyWebCustomization === 'function') applyWebCustomization(); } catch(e) { console.error(e); }
                try { if (typeof loadCustomization === 'function') loadCustomization(); } catch(e) { console.error(e); }
                
                setTimeout(() => {
                    saveWebDataBtn.textContent = 'Guardar Cambios';
                    saveWebDataBtn.classList.replace('bg-emerald-600', 'bg-green-600');
                    saveWebDataBtn.disabled = false;
                }, 2000);
            } else {
                if (typeof showToast === 'function') showToast(data.error || 'Error al guardar', 'error');
                saveWebDataBtn.textContent = 'Guardar Cambios';
                saveWebDataBtn.disabled = false;
            }
        })
        .catch(err => {
            console.error('Fetch error:', err);
            if (typeof showToast === 'function') showToast('Error al conectar con el servidor', 'error');
            saveWebDataBtn.textContent = 'Guardar Cambios';
            saveWebDataBtn.disabled = false;
        });
    });
    
    const navSaveWebDataBtn = document.getElementById('navSaveWebDataBtn');
    if (navSaveWebDataBtn) {
        navSaveWebDataBtn.addEventListener('click', () => saveWebDataBtn.click());
    }

    // Copiar enlace público de la web
    window.copyPublicWebLink = function() {
        const btnVer = document.getElementById('btnVerMiPagina');
        let url = btnVer ? btnVer.href : '';
        if (!url || url.includes('#')) {
            const ruta = window.currentWebData?.ruta || '';
            url = window.location.origin + window.location.pathname.replace('mi-web.html', 'web.html') + (ruta ? `?n=${encodeURIComponent(ruta)}` : '');
        }
        url = url.replace('&preview=1', '').replace('preview=1&', '').replace('?preview=1', '');
        navigator.clipboard.writeText(url).then(() => {
            if (typeof showToast === 'function') {
                showToast('¡Enlace de tu página web copiado al portapapeles!', 'success');
            } else {
                alert('¡Enlace copiado al portapapeles!');
            }
        }).catch(() => {
            prompt('Copia el enlace de tu web:', url);
        });
    };

    // ==========================================
    // SECCIÓN EQUIPO (PROFESIONALES)
    // ==========================================
    const profWebModal = document.getElementById('profWebModal');
    const profWebModalContent = document.getElementById('profWebModalContent');
    const profWebForm = document.getElementById('profWebForm');
    window.registeredTeamList = [];

    // Cargar profesionales e integrantes reales del negocio para el selector rápido
    async function loadRegisteredTeamForWeb() {
        try {
            const res = await fetch('backend/gestionar_profesionales.php');
            const data = await res.json();
            if (Array.isArray(data)) {
                window.registeredTeamList = data;
            } else if (data && Array.isArray(data.profesionales)) {
                window.registeredTeamList = data.profesionales;
            }
        } catch(e) {
            window.registeredTeamList = [];
        }

        // Si tenemos datos del dueño en sesión, asegurar que figure
        if (window.currentBusinessAdminName) {
            const adminExists = window.registeredTeamList.some(p => (p.nombre_completo || p.nombre || '').toLowerCase() === window.currentBusinessAdminName.toLowerCase());
            if (!adminExists) {
                window.registeredTeamList.unshift({
                    nombre_completo: window.currentBusinessAdminName,
                    rol_en_local: 'admin'
                });
            }
        }
    }
    loadRegisteredTeamForWeb();

    window.openProfWebModal = function(index = -1) {
        if (profWebForm) profWebForm.reset();
        document.getElementById('profWebIndex').value = index;

        const modalTitle = document.getElementById('profWebModalTitle');
        const quickSec = document.getElementById('profWebQuickSelectSection');
        const chipsContainer = document.getElementById('profWebRegisteredChips');

        if (index > -1 && window.profesionalesWebData[index]) {
            const p = window.profesionalesWebData[index];
            if (modalTitle) modalTitle.textContent = 'Editar Profesional';
            if (document.getElementById('profWebName')) document.getElementById('profWebName').value = p.nombre || '';
            if (document.getElementById('profWebDesc')) document.getElementById('profWebDesc').value = p.descripcion || '';
            if (document.getElementById('profWebPhoto')) document.getElementById('profWebPhoto').value = p.foto || '';
            if (document.getElementById('profWebPhotoBase64')) document.getElementById('profWebPhotoBase64').value = p.foto || '';
            if (quickSec) quickSec.classList.add('hidden');
        } else {
            if (modalTitle) modalTitle.textContent = 'Añadir al Equipo Web';
            if (document.getElementById('profWebDesc')) {
                document.getElementById('profWebDesc').value = 'Especialista en atención y servicios del equipo.';
            }

            // Filtrar profesionales del negocio que NO se hayan añadido aún a la web
            const alreadyAddedNames = (window.profesionalesWebData || []).map(p => (p.nombre || '').trim().toLowerCase());
            const availableProfs = (window.registeredTeamList || []).filter(p => {
                const name = (p.nombre_completo || p.nombre || '').trim().toLowerCase();
                return name && !alreadyAddedNames.includes(name);
            });

            if (quickSec && chipsContainer) {
                if (availableProfs.length > 0) {
                    chipsContainer.innerHTML = '';
                    availableProfs.forEach(p => {
                        const pName = p.nombre_completo || p.nombre;
                        const isAdminRole = (p.rol_en_local === 'admin');
                        const chip = document.createElement('button');
                        chip.type = 'button';
                        chip.className = 'inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-teal-50 border border-slate-200 hover:border-teal-300 rounded-xl text-xs font-bold text-slate-700 hover:text-teal-700 transition-all cursor-pointer shadow-2xs hover:scale-[1.02] active:scale-95';
                        chip.innerHTML = `
                            <span class="material-symbols-outlined text-[15px] ${isAdminRole ? 'text-primary' : 'text-teal-600'}">${isAdminRole ? 'shield_person' : 'person'}</span>
                            <span>${escapeHtml(pName)}</span>
                            ${isAdminRole ? '<span class="text-[9px] uppercase px-1.5 py-0.2 bg-rose-100 text-rose-700 rounded font-black">Admin</span>' : ''}
                        `;
                        chip.onclick = () => {
                            document.getElementById('profWebName').value = pName;
                            if (p.descripcion) document.getElementById('profWebDesc').value = p.descripcion;
                            if (p.foto) document.getElementById('profWebPhoto').value = p.foto;
                            if (typeof showToast === 'function') showToast(`Datos de ${pName} autocompletados`, 'info');
                        };
                        chipsContainer.appendChild(chip);
                    });
                    quickSec.classList.remove('hidden');
                } else {
                    quickSec.classList.add('hidden');
                }
            }
        }

        if (profWebModal && profWebModalContent) {
            profWebModal.classList.remove('hidden');
            setTimeout(() => { 
                profWebModal.classList.remove('opacity-0'); 
                profWebModalContent.classList.remove('scale-95'); 
            }, 10);
        }
    };

    window.closeProfWebModal = function() {
        if (profWebModal && profWebModalContent) {
            profWebModal.classList.add('opacity-0');
            profWebModalContent.classList.add('scale-95');
            setTimeout(() => profWebModal.classList.add('hidden'), 300);
        }
    };

    document.getElementById('addProfWebBtn')?.addEventListener('click', () => openProfWebModal(-1));

    profWebForm?.addEventListener('submit', function(e) {
        e.preventDefault();
        const index = parseInt(document.getElementById('profWebIndex').value);
        const prof = {
            nombre: document.getElementById('profWebName').value.trim(),
            descripcion: document.getElementById('profWebDesc').value.trim(),
            foto: document.getElementById('profWebPhoto').value.trim()
        };

        if (!prof.nombre) {
            if (typeof showToast === 'function') showToast('Ingresa el nombre del profesional', 'error');
            return;
        }
        
        let photoBase64 = document.getElementById('profWebPhotoBase64') ? document.getElementById('profWebPhotoBase64').value : '';

        const saveProf = (fotoToSave) => {
            prof.foto = fotoToSave;
            if (index > -1) {
                window.profesionalesWebData[index] = prof;
                if (typeof showToast === 'function') showToast('Profesional actualizado', 'success');
            } else {
                window.profesionalesWebData.push(prof);
                if (typeof showToast === 'function') showToast('Profesional añadido a la web', 'success');
            }
            renderProfesionalesWeb();
            closeProfWebModal();
        };

        const fileInput = document.getElementById('profWebPhotoFile');
        if (fileInput && fileInput.files && fileInput.files[0]) {
            const file = fileInput.files[0];
            if (file.size > 2 * 1024 * 1024) {
                if (typeof showToast === 'function') showToast('La foto es muy pesada (máx 2MB).', 'error');
                fileInput.value = ''; return;
            }
            const reader = new FileReader();
            reader.onload = (e) => saveProf(e.target.result);
            reader.readAsDataURL(file);
        } else {
            saveProf(prof.foto || photoBase64);
        }
    });

    window.deleteProfWeb = function(index) {
        const prof = window.profesionalesWebData[index];
        const name = prof ? (prof.nombre || 'este profesional') : 'este profesional';
        window.showWebConfirmModal({
            title: '¿Ocultar profesional de la web?',
            message: `¿Deseas quitar a <strong>${escapeHtml(name)}</strong> de la presentación de tu página web?<br><br><span class="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg block text-left"><strong>Nota:</strong> No se eliminará la cuenta del profesional ni su rol en el negocio; únicamente dejará de mostrarse ante los clientes en tu sitio web.</span>`,
            confirmText: 'Sí, quitar de la web',
            onConfirm: () => {
                window.profesionalesWebData.splice(index, 1);
                renderProfesionalesWeb();
                if (typeof showToast === 'function') showToast('Profesional quitado de la web', 'info');
            }
        });
    };

    function renderProfesionalesWeb() {
        const container = document.getElementById('profesionalesWebList');
        if (!container) return;
        container.innerHTML = '';

        if (!Array.isArray(window.profesionalesWebData) || window.profesionalesWebData.length === 0) {
            container.innerHTML = `
                <div class="col-span-full text-center p-8 bg-slate-50/80 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-2">
                    <div class="w-12 h-12 rounded-full bg-slate-200/70 text-slate-400 flex items-center justify-center">
                        <span class="material-symbols-outlined text-2xl">group_off</span>
                    </div>
                    <p class="font-extrabold text-sm text-slate-700">No has añadido profesionales a tu equipo</p>
                    <p class="text-xs text-slate-400 max-w-sm">Añade al personal o al administrador del equipo para que tus clientes conozcan a sus especialistas.</p>
                    <button type="button" onclick="openProfWebModal(-1)" class="mt-2 text-xs font-black text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer">
                        <span class="material-symbols-outlined text-base">add</span> Añadir el Primero
                    </button>
                </div>
            `;
            return;
        }

        window.profesionalesWebData.forEach((p, i) => {
            const img = p.foto 
                ? `<img src="${p.foto}" alt="${escapeHtml(p.nombre)}" class="w-14 h-14 rounded-2xl object-cover shrink-0 border border-slate-200 shadow-2xs">` 
                : `<div class="w-14 h-14 rounded-2xl bg-teal-50 text-teal-700 border border-teal-200 flex items-center justify-center shrink-0 font-bold shadow-2xs"><span class="material-symbols-outlined text-2xl">person</span></div>`;

            container.innerHTML += `
                <div class="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-md hover:border-slate-300 transition-all flex items-start justify-between gap-3 relative group">
                    <div class="flex items-start gap-3.5 min-w-0 flex-1">
                        ${img}
                        <div class="min-w-0 flex-1">
                            <div class="flex items-center gap-2">
                                <h4 class="font-extrabold text-slate-800 text-sm truncate">${escapeHtml(p.nombre)}</h4>
                                <span class="bg-slate-100 text-slate-600 border border-slate-200 text-[10px] font-bold px-2 py-0.2 rounded-full shrink-0">Personal</span>
                            </div>
                            <p class="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">${escapeHtml(p.descripcion || 'Especialista del equipo')}</p>
                        </div>
                    </div>
                    
                    <!-- Acciones: Editar y Quitar (-) con botón rojo visible -->
                    <div class="flex items-center gap-1.5 shrink-0 self-center">
                        <button type="button" onclick="openProfWebModal(${i})" class="w-8 h-8 flex items-center justify-center bg-slate-100 hover:bg-teal-50 text-slate-600 hover:text-teal-700 rounded-xl transition-all cursor-pointer" title="Editar presentación">
                            <span class="material-symbols-outlined text-[17px]">edit</span>
                        </button>
                        
                        <button type="button" onclick="deleteProfWeb(${i})" class="w-8 h-8 flex items-center justify-center bg-red-50 hover:bg-red-600 text-red-600 hover:text-white border border-red-200 hover:border-red-600 rounded-xl transition-all cursor-pointer shadow-2xs" title="Quitar de la web (no elimina la cuenta)">
                            <span class="material-symbols-outlined text-[17px] font-black">remove</span>
                        </button>
                    </div>
                </div>
            `;
        });
        
        makeSortable('profesionalesWebList', window.profesionalesWebData, renderProfesionalesWeb);
    }

    function syncProfesionalesFromServices(servicesList) {
        if (!Array.isArray(window.profesionalesWebData)) {
            window.profesionalesWebData = [];
        }

        let changed = false;

        // 1. Asegurar al Admin / Dueño del negocio si la lista está vacía
        if (window.profesionalesWebData.length === 0 && window.currentBusinessAdminName) {
            window.profesionalesWebData.push({
                nombre: window.currentBusinessAdminName,
                descripcion: 'Administrador / Profesional del equipo',
                foto: ''
            });
            changed = true;
        }

        // 2. Sincronizar profesionales con servicios asignados
        if (Array.isArray(servicesList) && servicesList.length > 0) {
            servicesList.forEach(s => {
                const pName = (s.profesional || '').trim();
                if (pName && pName !== 'Cualquiera' && !pName.includes('Sin preferencia') && !pName.includes('@')) {
                    const existingIndex = window.profesionalesWebData.findIndex(p => p.nombre && p.nombre.trim().toLowerCase() === pName.toLowerCase());
                    if (existingIndex === -1) {
                        window.profesionalesWebData.push({
                            nombre: pName,
                            descripcion: 'Especialista en servicios del equipo',
                            foto: s.foto_profesional || ''
                        });
                        changed = true;
                    } else if (s.foto_profesional && !window.profesionalesWebData[existingIndex].foto) {
                        window.profesionalesWebData[existingIndex].foto = s.foto_profesional;
                        changed = true;
                    }
                }
            });
        }

        if (changed || window.profesionalesWebData.length > 0) {
            renderProfesionalesWeb();
        }
    }

    // ==========================================
    // SECCIÓN CURSOS Y CERTIFICADOS
    // ==========================================
    const cursoWebModal = document.getElementById('cursoWebModal');
    const cursoWebModalContent = document.getElementById('cursoWebModalContent');
    const cursoWebForm = document.getElementById('cursoWebForm');

    window.openCursoWebModal = function(index = -1) {
        if (cursoWebForm) cursoWebForm.reset();
        document.getElementById('cursoWebIndex').value = index;
        if (index > -1 && window.cursosWebData[index]) {
            const c = window.cursosWebData[index];
            if (document.getElementById('cursoWebName')) document.getElementById('cursoWebName').value = c.nombre || '';
            if (document.getElementById('cursoWebDesc')) document.getElementById('cursoWebDesc').value = c.descripcion || '';
            if (document.getElementById('cursoWebPhotoBase64')) document.getElementById('cursoWebPhotoBase64').value = c.foto || '';
        } else {
            if (document.getElementById('cursoWebPhotoBase64')) document.getElementById('cursoWebPhotoBase64').value = '';
        }
        if (cursoWebModal && cursoWebModalContent) {
            cursoWebModal.classList.remove('hidden');
            setTimeout(() => { cursoWebModal.classList.remove('opacity-0'); cursoWebModalContent.classList.remove('scale-95'); }, 10);
            setTimeout(() => { 
                cursoWebModal.classList.remove('opacity-0'); 
                cursoWebModalContent.classList.remove('scale-95', 'animate-modal-pop'); 
                void cursoWebModalContent.offsetWidth;
                cursoWebModalContent.classList.add('animate-modal-pop');
            }, 10);
        }
    };

    window.closeCursoWebModal = function() {
        if (cursoWebModal && cursoWebModalContent) {
            cursoWebModal.classList.add('opacity-0');
            cursoWebModalContent.classList.remove('animate-modal-pop');
            cursoWebModalContent.classList.add('scale-95');
            setTimeout(() => cursoWebModal.classList.add('hidden'), 300);
        }
    };

    cursoWebForm?.addEventListener('submit', function(e) {
        e.preventDefault();
        const index = parseInt(document.getElementById('cursoWebIndex').value);
        const fileInput = document.getElementById('cursoWebPhoto');
        const name = document.getElementById('cursoWebName').value;
        const desc = document.getElementById('cursoWebDesc').value;
        let photoBase64 = document.getElementById('cursoWebPhotoBase64') ? document.getElementById('cursoWebPhotoBase64').value : '';

        const saveCurso = (base64Img) => {
            const curso = { nombre: name, descripcion: desc, foto: base64Img };
            if (index > -1) window.cursosWebData[index] = curso;
            else window.cursosWebData.push(curso);
            renderCursosWeb();
            closeCursoWebModal();
        };

        if (fileInput && fileInput.files && fileInput.files[0]) {
            const file = fileInput.files[0];
            if (file.size > 2 * 1024 * 1024) { // Límite de 2MB
                if (typeof showToast === 'function') {
                    showToast('La imagen del certificado es muy pesada (máx 2MB).', 'error');
                } else {
                    alert('La imagen del certificado es muy pesada (máx 2MB).');
                }
                fileInput.value = ''; // Limpiar el input
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => saveCurso(e.target.result);
            reader.readAsDataURL(file);
        } else {
            saveCurso(photoBase64);
        }
    });

    window.deleteCursoWeb = function(index) {
        const curso = window.cursosWebData[index];
        const name = curso ? (curso.nombre || 'este certificado') : 'este certificado';
        window.showWebConfirmModal({
            title: '¿Eliminar certificado / diploma?',
            message: `¿Estás seguro de que deseas eliminar <strong>${escapeHtml(name)}</strong> de tus certificaciones públicas?`,
            confirmText: 'Sí, eliminar',
            onConfirm: () => {
                window.cursosWebData.splice(index, 1);
                renderCursosWeb();
                if (typeof showToast === 'function') showToast('Certificado eliminado de la lista', 'info');
            }
        });
    };

    function renderCursosWeb() {
        const container = document.getElementById('cursosWebList');
        if(!container) return;
        container.innerHTML = '';
        if (window.cursosWebData.length === 0) {
            container.innerHTML = '<div class="col-span-full text-center p-6 text-slate-500 border border-dashed rounded-xl border-slate-300">No has añadido cursos o certificados.</div>';
            return;
        }
        window.cursosWebData.forEach((c, i) => {
            const img = c.foto ? `<img src="${c.foto}" alt="${c.nombre}" class="w-12 h-12 rounded-lg object-cover shrink-0">` : `<div class="w-12 h-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0"><span class="material-symbols-outlined">school</span></div>`;
            container.innerHTML += `
                <div class="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-start gap-4 relative group">
                    ${img}
                    <div class="flex-1">
                        <p class="font-bold text-slate-800">${c.nombre}</p>
                        <p class="text-xs text-slate-500 mt-1 line-clamp-2">${c.descripcion}</p>
                    </div>
                    <div class="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button type="button" onclick="openCursoWebModal(${i})" class="w-8 h-8 flex items-center justify-center bg-white rounded shadow text-blue-500 hover:text-blue-700"><span class="material-symbols-outlined text-[16px]">edit</span></button>
                        <button type="button" onclick="deleteCursoWeb(${i})" class="w-8 h-8 flex items-center justify-center bg-white rounded shadow text-red-500 hover:text-red-700"><span class="material-symbols-outlined text-[16px]">delete</span></button>
                    </div>
                </div>
            `;
        });
        
        makeSortable('cursosWebList', window.cursosWebData, renderCursosWeb);
    }

    // ==========================================
    // SECCIÓN SERVICIOS (MODAL ESPECÍFICO DE MI-WEB)
    // ==========================================
    const serviceModal = document.getElementById('serviceDetailModal');
    const serviceModalContent = document.getElementById('serviceDetailModalContent');
    const serviceForm = document.getElementById('serviceDetailForm');

    window.openServiceDetailModal = function(id = null) {
        if (serviceForm) serviceForm.reset();
        document.getElementById('serviceIdInput').value = '';
        document.getElementById('serviceModalTitle').textContent = 'Añadir Nuevo Servicio';
        if (document.getElementById('descEditor')) document.getElementById('descEditor').innerHTML = '';
        
        if (id && window.webServicesData) {
            const service = window.webServicesData.find(s => String(s.id) === String(id));
            if (service) {
                document.getElementById('serviceModalTitle').textContent = 'Editar Servicio';
                serviceForm.elements.id.value = service.id;
                serviceForm.elements.nombre.value = service.nombre;
                const d = parseInt(service.duracion, 10) || 0;
                if (document.getElementById('duracionH')) document.getElementById('duracionH').value = Math.floor(d / 60);
                if (document.getElementById('duracionM')) document.getElementById('duracionM').value = d % 60;
                serviceForm.elements.precio.value = service.precio;
                if (serviceForm.elements.capacidad) serviceForm.elements.capacidad.value = service.capacidad || 1;
                if (serviceForm.elements.profesional) serviceForm.elements.profesional.value = service.profesional || '';
                if (serviceForm.elements.email_profesional) serviceForm.elements.email_profesional.value = service.email_profesional || '';
                if (serviceForm.elements.foto_profesional) serviceForm.elements.foto_profesional.value = service.foto_profesional || '';
                if (document.getElementById('descEditor')) document.getElementById('descEditor').innerHTML = service.descripcion || '';
                if (document.getElementById('hiddenImagen1')) document.getElementById('hiddenImagen1').value = service.imagen1 || '';
                if (document.getElementById('hiddenImagen2')) document.getElementById('hiddenImagen2').value = service.imagen2 || '';
                if (document.getElementById('hiddenImagen3')) document.getElementById('hiddenImagen3').value = service.imagen3 || '';
            }
        }
        
        if (serviceModal && serviceModalContent) {
            serviceModal.classList.remove('hidden');
            setTimeout(() => { serviceModal.classList.remove('opacity-0'); serviceModalContent.classList.remove('scale-95'); }, 10);
            setTimeout(() => { 
                serviceModal.classList.remove('opacity-0'); 
                serviceModalContent.classList.remove('scale-95', 'animate-modal-pop');
                void serviceModalContent.offsetWidth;
                serviceModalContent.classList.add('animate-modal-pop');
            }, 10);
        }
    };

    document.getElementById('closeServiceModalBtn')?.addEventListener('click', () => {
        if (serviceModal && serviceModalContent) {
            serviceModal.classList.add('opacity-0');
            serviceModalContent.classList.remove('animate-modal-pop');
            serviceModalContent.classList.add('scale-95');
            setTimeout(() => serviceModal.classList.add('hidden'), 300);
        }
    });

    document.getElementById('addServiceBtn')?.addEventListener('click', () => openServiceDetailModal(null));

    serviceForm?.addEventListener('submit', (e) => {
        e.preventDefault();
        
        if(document.getElementById('descEditor')) document.getElementById('hiddenDesc').value = document.getElementById('descEditor').innerHTML;
        const h = parseInt(document.getElementById('duracionH') ? document.getElementById('duracionH').value : 0, 10) || 0;
        const m = parseInt(document.getElementById('duracionM') ? document.getElementById('duracionM').value : 0, 10) || 0;
        if (document.getElementById('duracionFinal')) document.getElementById('duracionFinal').value = (h * 60) + m;

        const submitBtn = serviceForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Guardando...';
        submitBtn.disabled = true;

        const formData = new FormData(serviceForm);

        fetch('backend/gestionar_servicios.php', { method: 'POST', body: formData })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                if (typeof showToast === 'function') showToast('Servicio guardado exitosamente', 'success');
                window.fetchAndRenderWebServices();
                document.getElementById('closeServiceModalBtn').click();
            } else {
                if (typeof showToast === 'function') showToast(data.error || 'Error al guardar el servicio', 'error');
            }
        })
        .catch(err => {
            if (typeof showToast === 'function') showToast('Error de conexión', 'error');
        })
        .finally(() => {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        });
    });

    window.fetchAndRenderWebServices = async () => {
        const servicesListContainer = document.getElementById('servicesList');
        if (!servicesListContainer) return;
        

        try {
            const response = await fetch('backend/gestionar_servicios.php');
            const data = await response.json();
            window.webServicesData = data;

            servicesListContainer.innerHTML = '';
            if (data.length === 0) {
                servicesListContainer.innerHTML = '<p class="text-sm text-slate-500 text-center w-full">Aún no hay servicios definidos para tu página web.</p>';
                return;
            }

            servicesListContainer.className = 'flex flex-wrap justify-center gap-4 w-full';

            data.forEach(service => {
                const serviceItemDiv = document.createElement('div');
                serviceItemDiv.className = 'service-item flex flex-col sm:flex-row sm:items-center justify-between bg-slate-50 p-4 rounded-lg cursor-pointer hover:bg-slate-100 w-full md:w-[calc(50%-1rem)] max-w-md shadow-sm border border-slate-200 gap-3 transition-colors group';
                serviceItemDiv.dataset.id = service.id;

                const precioText = service.precio ? ` • $${service.precio}` : '';
                const defaultIcon = `<div class="w-4 h-4 rounded-full bg-purple-200 text-purple-700 flex items-center justify-center shrink-0"><span class="material-symbols-outlined" style="font-size: 12px;">person</span></div>`;
                const profIcon = service.foto_profesional ? `<img src="${service.foto_profesional}" class="w-4 h-4 rounded-full object-cover border border-purple-200 shrink-0">` : defaultIcon;
                
                serviceItemDiv.innerHTML = `
                    <div class="flex-1">
                        <p class="font-bold text-slate-800">${service.nombre}</p>
                        <p class="text-sm text-slate-500 mt-1">${formatDuracionText(service.duracion)}${precioText}</p>
                        ${service.profesional ? `<div class="mt-2 flex flex-wrap items-center gap-2"><span class="bg-purple-100 text-purple-700 text-xs px-2 py-1 rounded-md inline-flex items-center gap-1">${profIcon} <span>${service.profesional}</span></span></div>` : ''}
                    </div>
                    <span class="material-symbols-outlined text-slate-400 self-end sm:self-auto group-hover:text-primary transition-colors">edit</span>
                `;
                
                serviceItemDiv.addEventListener('click', () => openServiceDetailModal(service.id));
                servicesListContainer.appendChild(serviceItemDiv);
            });
            
            if (typeof window.updateProfesionalesDatalist === 'function') {
                window.updateProfesionalesDatalist(data);
            }

            if (typeof syncProfesionalesFromServices === 'function') {
                syncProfesionalesFromServices(data);
            }

            makeServicesSortable();

        } catch (error) {
            console.error('Error al cargar los servicios:', error);
            servicesListContainer.innerHTML = '<p class="text-sm text-red-500">Error al cargar los servicios.</p>';
        }
    };

    // Iniciar carga de la lista
    if (document.getElementById('servicesList')) {
        window.fetchAndRenderWebServices();
    }
    
    // ==========================================
    // LÓGICA DE DRAG & DROP (ARRASTRAR Y SOLTAR)
    // ==========================================
    function makeSortable(containerId, arrayData, renderCallback) {
        const container = document.getElementById(containerId);
        if (!container) return;
        let draggedIndex = null;

        Array.from(container.children).forEach((item, index) => {
            item.draggable = true;
            item.classList.add('cursor-move');
            item.addEventListener('dragstart', function(e) {
                draggedIndex = index;
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', index);
                setTimeout(() => this.classList.add('opacity-50'), 0);
            });
            item.addEventListener('dragover', function(e) {
                e.preventDefault();
                this.classList.add('border-primary', 'border-dashed');
            });
            item.addEventListener('dragleave', function(e) {
                this.classList.remove('border-primary', 'border-dashed');
            });
            item.addEventListener('drop', function(e) {
                e.preventDefault();
                this.classList.remove('border-primary', 'border-dashed');
                const targetIndex = index;
                if (draggedIndex === null || draggedIndex === targetIndex) return;
                
                const itemToMove = arrayData.splice(draggedIndex, 1)[0];
                arrayData.splice(targetIndex, 0, itemToMove);
                renderCallback();
            });
            item.addEventListener('dragend', function() {
                this.classList.remove('opacity-50');
                draggedIndex = null;
            });
        });
    }

    function makeServicesSortable() {
        const container = document.getElementById('servicesList');
        if (!container) return;
        let draggedIndex = null;

        Array.from(container.children).forEach((item, index) => {
            item.draggable = true;
            item.classList.add('cursor-move');
            item.addEventListener('dragstart', function(e) {
                draggedIndex = index;
                e.dataTransfer.effectAllowed = 'move';
                setTimeout(() => this.classList.add('opacity-50'), 0);
            });
            item.addEventListener('dragover', function(e) { e.preventDefault(); this.classList.add('border-primary', 'border-dashed'); });
            item.addEventListener('dragleave', function(e) { this.classList.remove('border-primary', 'border-dashed'); });
            item.addEventListener('drop', function(e) {
                e.preventDefault();
                this.classList.remove('border-primary', 'border-dashed');
                const targetIndex = index;
                if (draggedIndex === null || draggedIndex === targetIndex) return;
                
                const itemToMove = window.webServicesData.splice(draggedIndex, 1)[0];
                window.webServicesData.splice(targetIndex, 0, itemToMove);
                
                const orderIds = window.webServicesData.map(s => s.id);
                fetch('backend/gestionar_servicios.php', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ action: 'reorder', order: orderIds }) });
                window.fetchAndRenderWebServices(false); // Re-render sin fetch
            });
            item.addEventListener('dragend', function() { this.classList.remove('opacity-50'); draggedIndex = null; });
        });
    }
});

// ==========================================
// PALETAS SUGERIDAS MÁS USADAS (mi-web.html)
// ==========================================
window.applySuggestedWebPalette = function(primario, secundario, fondo, paletteKey, btnEl) {
    const inputPrimario = document.getElementById('webColorPrimario');
    const inputSecundario = document.getElementById('webColorSecundario');
    const inputFondo = document.getElementById('webColorFondo');

    if (inputPrimario) {
        inputPrimario.value = primario;
        inputPrimario.dispatchEvent(new Event('input', { bubbles: true }));
        inputPrimario.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (inputSecundario) {
        inputSecundario.value = secundario;
        inputSecundario.dispatchEvent(new Event('input', { bubbles: true }));
        inputSecundario.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (inputFondo) {
        inputFondo.value = fondo;
        inputFondo.dispatchEvent(new Event('input', { bubbles: true }));
        inputFondo.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // Actualizar estado visual de las tarjetas sugeridas
    document.querySelectorAll('.suggested-palette-card').forEach(card => {
        card.classList.remove('ring-2', 'ring-primary', 'border-primary', 'bg-rose-50/20');
        const check = card.querySelector('.palette-active-check');
        if (check) check.remove();
    });

    if (btnEl) {
        btnEl.classList.add('ring-2', 'ring-primary', 'border-primary', 'bg-rose-50/20');
        const badge = document.createElement('span');
        badge.className = 'palette-active-check absolute top-2 right-2 flex items-center justify-center w-5 h-5 rounded-full bg-primary text-white text-[11px] shadow-xs';
        badge.innerHTML = '<span class="material-symbols-outlined text-[13px]">check</span>';
        btnEl.appendChild(badge);
    }

    if (typeof showToast === 'function') {
        showToast('Paleta aplicada. Recuerda hacer clic en "Guardar Cambios" para publicarla.', 'success');
    }
};

// ==========================================
// MODAL DE CONFIRMACIÓN MODERNO (mi-web.html)
// ==========================================
function escapeHtml(text) {
    if (!text) return '';
    return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

window.showWebConfirmModal = function({ title, message, confirmText, onConfirm }) {
    const modal = document.getElementById('webConfirmModal');
    const titleEl = document.getElementById('webConfirmModalTitle');
    const msgEl = document.getElementById('webConfirmModalMessage');
    const btnConfirm = document.getElementById('webConfirmModalBtn');
    if (!modal) {
        if (confirm(message ? message.replace(/<[^>]*>?/gm, '') : '¿Confirmar?')) {
            if (typeof onConfirm === 'function') onConfirm();
        }
        return;
    }
    if (titleEl) titleEl.textContent = title || '¿Confirmar acción?';
    if (msgEl) msgEl.innerHTML = message || '';
    if (btnConfirm) {
        btnConfirm.textContent = confirmText || 'Confirmar';
        btnConfirm.onclick = () => {
            closeWebConfirmModal();
            if (typeof onConfirm === 'function') onConfirm();
        };
    }
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        const content = document.getElementById('webConfirmModalContent');
        if (content) content.classList.remove('scale-95');
    }, 10);
};

window.closeWebConfirmModal = function() {
    const modal = document.getElementById('webConfirmModal');
    const content = document.getElementById('webConfirmModalContent');
    if (!modal) return;
    modal.classList.add('opacity-0');
    if (content) content.classList.add('scale-95');
    setTimeout(() => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }, 200);
};
