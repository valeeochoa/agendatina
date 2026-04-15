// backend/js/mi-web.js
// Lógica para el Editor Visual de la Página Web (mi-web.html)

document.addEventListener('DOMContentLoaded', () => {
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
    const cursosEditor = document.getElementById('cursosEditor');
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

    // 1. CARGAR DATOS WEB AL INICIAR
    fetch('backend/guardar_web.php')
        .then(res => res.json())
        .then(data => {
            if (data && data.error) {
                if (data.error.toLowerCase().includes('inicia sesión') || data.error.toLowerCase().includes('autorizado')) {
                    window.location.href = 'login.html';
                }
                return;
            }
            if (data && !data.error) {
                window.currentWebData = data;
                if (data.titulo) webTitulo.value = data.titulo;
                if (data.subtitulo) webSubtitulo.value = data.subtitulo;
                if (data.fondo && webFondo) webFondo.value = data.fondo;
                if (data.texto_local && webTextoLocal) webTextoLocal.value = data.texto_local;
                if (data.ubicacion_maps && webUbicacionMaps) webUbicacionMaps.value = data.ubicacion_maps;
                if (data.cursos_html && cursosEditor) cursosEditor.innerHTML = data.cursos_html;
                if (data.alineacion_servicios && webAlineacion) webAlineacion.value = data.alineacion_servicios;

                if (data.color_primario_web) webColorPrimario.value = data.color_primario_web;
                else if (data.color_primario) webColorPrimario.value = data.color_primario;
                
                if (data.color_secundario_web) webColorSecundario.value = data.color_secundario_web;
                else if (data.color_secundario) webColorSecundario.value = data.color_secundario;
                
                if (data.color_fondo) webColorFondo.value = data.color_fondo;

                if (data.profesionales_json) {
                    try { window.profesionalesWebData = JSON.parse(data.profesionales_json); } catch(e) { window.profesionalesWebData = []; }
                    renderProfesionalesWeb();
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
        if (cursosEditor) formData.append('cursos_html', cursosEditor.innerHTML);
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

        fetch('backend/guardar_web.php', { method: 'POST', body: formData })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                saveWebDataBtn.textContent = '¡Guardado!';
                saveWebDataBtn.classList.replace('bg-green-600', 'bg-emerald-600');
                if (typeof showToast === 'function') showToast('Cambios guardados con éxito', 'success');
                if (typeof applyWebCustomization === 'function') applyWebCustomization();
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
            if (typeof showToast === 'function') showToast('Error de conexión', 'error');
            saveWebDataBtn.textContent = 'Guardar Cambios';
            saveWebDataBtn.disabled = false;
        });
    });

    // ==========================================
    // SECCIÓN EQUIPO (PROFESIONALES)
    // ==========================================
    const profWebModal = document.getElementById('profWebModal');
    const profWebModalContent = document.getElementById('profWebModalContent');
    const profWebForm = document.getElementById('profWebForm');

    window.openProfWebModal = function(index = -1) {
        if (profWebForm) profWebForm.reset();
        document.getElementById('profWebIndex').value = index;
        if (index > -1 && window.profesionalesWebData[index]) {
            const p = window.profesionalesWebData[index];
            if (document.getElementById('profWebName')) document.getElementById('profWebName').value = p.nombre || '';
            if (document.getElementById('profWebDesc')) document.getElementById('profWebDesc').value = p.descripcion || '';
            if (document.getElementById('profWebPhoto')) document.getElementById('profWebPhoto').value = p.foto || '';
        }
        if (profWebModal && profWebModalContent) {
            profWebModal.classList.remove('hidden');
            setTimeout(() => { profWebModal.classList.remove('opacity-0'); profWebModalContent.classList.remove('scale-95'); }, 10);
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
            nombre: document.getElementById('profWebName').value,
            descripcion: document.getElementById('profWebDesc').value,
            foto: document.getElementById('profWebPhoto').value
        };
        if (index > -1) window.profesionalesWebData[index] = prof;
        else window.profesionalesWebData.push(prof);
        renderProfesionalesWeb();
        closeProfWebModal();
    });

    window.deleteProfWeb = function(index) {
        if(confirm('¿Eliminar este profesional del equipo?')) {
            window.profesionalesWebData.splice(index, 1);
            renderProfesionalesWeb();
        }
    };

    function renderProfesionalesWeb() {
        const container = document.getElementById('profesionalesWebList');
        if(!container) return;
        container.innerHTML = '';
        if (window.profesionalesWebData.length === 0) {
            container.innerHTML = '<div class="col-span-full text-center p-6 text-slate-500 border border-dashed rounded-xl border-slate-300">No has añadido profesionales a tu equipo.</div>';
            return;
        }
        window.profesionalesWebData.forEach((p, i) => {
            const img = p.foto ? `<img src="${p.foto}" class="w-12 h-12 rounded-full object-cover shrink-0">` : `<div class="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0"><span class="material-symbols-outlined">person</span></div>`;
            container.innerHTML += `
                <div class="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-start gap-4 relative group">
                    ${img}
                    <div class="flex-1">
                        <p class="font-bold text-slate-800">${p.nombre}</p>
                        <p class="text-xs text-slate-500 mt-1 line-clamp-3">${p.descripcion}</p>
                    </div>
                    <div class="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button type="button" onclick="openProfWebModal(${i})" class="w-8 h-8 flex items-center justify-center bg-white rounded shadow text-blue-500 hover:text-blue-700"><span class="material-symbols-outlined text-[16px]">edit</span></button>
                        <button type="button" onclick="deleteProfWeb(${i})" class="w-8 h-8 flex items-center justify-center bg-white rounded shadow text-red-500 hover:text-red-700"><span class="material-symbols-outlined text-[16px]">delete</span></button>
                    </div>
                </div>
            `;
        });
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
        }
    };

    window.closeCursoWebModal = function() {
        if (cursoWebModal && cursoWebModalContent) {
            cursoWebModal.classList.add('opacity-0');
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
            const reader = new FileReader();
            reader.onload = (e) => saveCurso(e.target.result);
            reader.readAsDataURL(fileInput.files[0]);
        } else {
            saveCurso(photoBase64);
            }
        });

    window.deleteCursoWeb = function(index) {
        if(confirm('¿Eliminar este certificado?')) {
            window.cursosWebData.splice(index, 1);
            renderCursosWeb();
        }
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
        }
    };

    document.getElementById('closeServiceModalBtn')?.addEventListener('click', () => {
        if (serviceModal && serviceModalContent) {
            serviceModal.classList.add('opacity-0');
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
                        <p class="text-sm text-slate-500 mt-1">${service.duracion} min${precioText}</p>
                        ${service.profesional ? `<div class="mt-2 flex flex-wrap items-center gap-2"><span class="bg-purple-100 text-purple-700 text-xs px-2 py-1 rounded-md inline-flex items-center gap-1">${profIcon} <span>${service.profesional}</span></span></div>` : ''}
                    </div>
                    <span class="material-symbols-outlined text-slate-400 self-end sm:self-auto group-hover:text-primary transition-colors">edit</span>
                `;
                
                serviceItemDiv.addEventListener('click', () => openServiceDetailModal(service.id));
                servicesListContainer.appendChild(serviceItemDiv);
            });

        } catch (error) {
            console.error('Error al cargar los servicios:', error);
            servicesListContainer.innerHTML = '<p class="text-sm text-red-500">Error al cargar los servicios.</p>';
        }
    };

    // Iniciar carga de la lista
    if (document.getElementById('servicesList')) {
        window.fetchAndRenderWebServices();
    }
});
