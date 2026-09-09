// backend/js/auth.js

document.addEventListener('DOMContentLoaded', () => {
    // Inyectar estilos para animación pop
    if (!document.getElementById('global-modal-animations')) {
        const style = document.createElement('style');
        style.id = 'global-modal-animations';
        style.innerHTML = `
            @keyframes modalPop {
                0% { opacity: 0; transform: scale(0.85) translateY(15px); }
                60% { opacity: 1; transform: scale(1.03) translateY(-3px); }
                100% { opacity: 1; transform: scale(1) translateY(0); }
            }
            .animate-modal-pop {
                animation: modalPop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards !important;
            }
        `;
        document.head.appendChild(style);
    }

    // Helper para mostrar/ocultar contraseña
    window.togglePassVisibility = function(inputId, btn) {
        const input = document.getElementById(inputId);
        if (!input) return;
        if (input.type === 'password') {
            input.type = 'text';
            if (btn && btn.querySelector('span')) btn.querySelector('span').textContent = 'visibility_off';
        } else {
            input.type = 'password';
            if (btn && btn.querySelector('span')) btn.querySelector('span').textContent = 'visibility';
        }
    };

    // ---- Lógica para login.html ----
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const btnSubmit = document.getElementById('btnSubmit');
            const msgDiv = document.getElementById('loginMessage');

            btnSubmit.disabled = true;
            btnSubmit.innerHTML = '<span>Verificando...</span>';
            msgDiv.classList.add('hidden');

            const emailSubmitted = (loginForm.querySelector('input[name="username"]')?.value || '').trim();

            fetch('backend/login.php', { method: 'POST', body: new FormData(this) })
                .then(res => res.json())
                .then(data => {
                    if (data.require_first_password) {
                        // Usuario requiere establecer su contraseña por primera vez
                        btnSubmit.disabled = false;
                        btnSubmit.innerHTML = '<span>Ingresar al sistema</span><span class="material-symbols-outlined text-xl">arrow_forward</span>';
                        openFirstPasswordModal(data.email || emailSubmitted);
                        return;
                    }

                    if (data.multiple_businesses) {
                        // Usuario con múltiples negocios: Mostrar modal de selección
                        btnSubmit.disabled = false;
                        btnSubmit.innerHTML = '<span>Ingresar al sistema</span><span class="material-symbols-outlined text-xl">arrow_forward</span>';
                        openSelectBusinessModal(data.businesses || []);
                        return;
                    }

                    if (data.success) {
                        sessionStorage.setItem('agendatina_session', 'active');
                        
                        if (data.redirect) {
                            window.location.href = data.redirect;
                        } else if (data.is_superadmin === true || data.role === 'superadmin') {
                            window.location.href = 'admin/index.html';
                        } else {
                            window.location.href = 'dashboard.html';
                        }
                    } else {
                        msgDiv.textContent = data.error || 'Credenciales incorrectas.';
                        msgDiv.classList.remove('hidden');
                        btnSubmit.disabled = false;
                        btnSubmit.innerHTML = '<span>Ingresar al sistema</span><span class="material-symbols-outlined text-xl">arrow_forward</span>';
                    }
                })
                .catch(error => {
                    msgDiv.textContent = 'Error de conexión con el servidor.';
                    msgDiv.classList.remove('hidden');
                    btnSubmit.disabled = false;
                    btnSubmit.innerHTML = '<span>Ingresar al sistema</span><span class="material-symbols-outlined text-xl">arrow_forward</span>';
                });
        });
    }

    // ---- Lógica de Modal Primer Inicio / Establecer Contraseña ----
    const firstPassInput = document.getElementById('firstPassInput');
    const firstPassConfirmInput = document.getElementById('firstPassConfirmInput');
    const firstPassMatchStatus = document.getElementById('firstPassMatchStatus');

    function validatePasswordMatch() {
        if (!firstPassInput || !firstPassConfirmInput || !firstPassMatchStatus) return;
        const p1 = firstPassInput.value;
        const p2 = firstPassConfirmInput.value;

        if (p2.length === 0) {
            firstPassMatchStatus.classList.add('hidden');
            return;
        }

        firstPassMatchStatus.classList.remove('hidden');
        if (p1 === p2) {
            firstPassMatchStatus.textContent = '✓ Las contraseñas coinciden correctamente';
            firstPassMatchStatus.className = 'text-[11px] font-semibold mt-1 text-emerald-600';
        } else {
            firstPassMatchStatus.textContent = '✕ Las contraseñas no coinciden';
            firstPassMatchStatus.className = 'text-[11px] font-semibold mt-1 text-red-500';
        }
    }

    if (firstPassInput) firstPassInput.addEventListener('input', validatePasswordMatch);
    if (firstPassConfirmInput) firstPassConfirmInput.addEventListener('input', validatePasswordMatch);

    const firstPasswordForm = document.getElementById('firstPasswordForm');
    if (firstPasswordForm) {
        firstPasswordForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const btn = document.getElementById('btnFirstPassSubmit');
            const msg = document.getElementById('firstPasswordMessage');
            const p1 = firstPassInput.value.trim();
            const p2 = firstPassConfirmInput.value.trim();

            if (p1 !== p2) {
                msg.textContent = 'Las contraseñas no coinciden. Por favor verifica ambos campos.';
                msg.classList.remove('hidden');
                return;
            }
            if (p1.length < 6) {
                msg.textContent = 'La contraseña debe tener al menos 6 caracteres por seguridad.';
                msg.classList.remove('hidden');
                return;
            }

            btn.disabled = true;
            btn.innerHTML = '<span>Guardando clave...</span>';
            msg.classList.add('hidden');

            fetch('backend/establecer_primer_password.php', { method: 'POST', body: new FormData(this) })
                .then(r => r.json())
                .then(data => {
                    if (data.multiple_businesses) {
                        closeFirstPasswordModal();
                        openSelectBusinessModal(data.businesses || []);
                        return;
                    }

                    if (data.success) {
                        sessionStorage.setItem('agendatina_session', 'active');
                        window.location.href = data.redirect || 'dashboard.html';
                    } else {
                        msg.textContent = data.error || 'Error al guardar la contraseña.';
                        msg.classList.remove('hidden');
                        btn.disabled = false;
                        btn.innerHTML = '<span>Guardar Contraseña e Iniciar Sesión</span><span class="material-symbols-outlined text-lg">check_circle</span>';
                    }
                })
                .catch(() => {
                    msg.textContent = 'Error de conexión con el servidor.';
                    msg.classList.remove('hidden');
                    btn.disabled = false;
                    btn.innerHTML = '<span>Guardar Contraseña e Iniciar Sesión</span><span class="material-symbols-outlined text-lg">check_circle</span>';
                });
        });
    }

    window.openFirstPasswordModal = function(email) {
        const modal = document.getElementById('firstPasswordModal');
        const content = document.getElementById('firstPasswordModalContent');
        const emailInput = document.getElementById('firstPasswordEmail');
        if (emailInput) emailInput.value = email;
        if (!modal || !content) return;
        modal.classList.remove('hidden');
        setTimeout(() => {
            modal.classList.remove('opacity-0');
            content.classList.remove('scale-95', 'animate-modal-pop');
            void content.offsetWidth;
            content.classList.add('animate-modal-pop');
        }, 10);
    };

    window.closeFirstPasswordModal = function() {
        const modal = document.getElementById('firstPasswordModal');
        const content = document.getElementById('firstPasswordModalContent');
        if (!modal || !content) return;
        modal.classList.add('opacity-0');
        content.classList.remove('animate-modal-pop');
        content.classList.add('scale-95');
        setTimeout(() => { modal.classList.add('hidden'); }, 300);
    };

    // ---- Lógica de Modal Selección de Negocio (Multi-Negocio) ----
    window.openSelectBusinessModal = function(businesses) {
        const modal = document.getElementById('selectBusinessModal');
        const content = document.getElementById('selectBusinessModalContent');
        const container = document.getElementById('businessListContainer');
        if (!modal || !content || !container) return;

        container.innerHTML = '';
        businesses.forEach(b => {
            const card = document.createElement('div');
            card.className = 'flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-2xl cursor-pointer hover:border-purple-500 hover:bg-purple-50/50 hover:shadow-md transition-all group';
            
            const isOwner = b.rol === 'admin';
            const roleBadge = isOwner 
                ? '<span class="bg-purple-100 text-purple-700 text-[10px] font-extrabold px-2 py-0.5 rounded-lg border border-purple-200">Administrador / Dueño</span>' 
                : '<span class="bg-blue-100 text-blue-700 text-[10px] font-extrabold px-2 py-0.5 rounded-lg border border-blue-200">Profesional / Equipo</span>';

            card.innerHTML = `
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-purple-600 font-bold text-lg shrink-0 overflow-hidden shadow-xs">
                        ${b.logo ? `<img src="${b.logo}" class="w-full h-full object-cover">` : `<span class="material-symbols-outlined text-xl">storefront</span>`}
                    </div>
                    <div>
                        <h4 class="font-extrabold text-slate-800 text-sm group-hover:text-purple-700 transition-colors">${b.nombre}</h4>
                        <div class="mt-0.5">${roleBadge}</div>
                    </div>
                </div>
                <span class="material-symbols-outlined text-slate-300 group-hover:text-purple-600 transition-colors">arrow_forward_ios</span>
            `;

            card.onclick = function() {
                selectBusinessAndLogin(b.id_negocio);
            };

            container.appendChild(card);
        });

        modal.classList.remove('hidden');
        setTimeout(() => {
            modal.classList.remove('opacity-0');
            content.classList.remove('scale-95', 'animate-modal-pop');
            void content.offsetWidth;
            content.classList.add('animate-modal-pop');
        }, 10);
    };

    function selectBusinessAndLogin(idNegocio) {
        const msgDiv = document.getElementById('selectBusinessMessage');
        if (msgDiv) msgDiv.classList.add('hidden');

        fetch('backend/cambiar_negocio.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id_negocio: idNegocio })
        })
        .then(r => r.json())
        .then(data => {
            if (data.success) {
                sessionStorage.setItem('agendatina_session', 'active');
                window.location.href = data.redirect || 'dashboard.html';
            } else {
                if (msgDiv) {
                    msgDiv.textContent = data.error || 'Error al seleccionar el negocio.';
                    msgDiv.classList.remove('hidden');
                }
            }
        })
        .catch(() => {
            if (msgDiv) {
                msgDiv.textContent = 'Error de conexión al seleccionar el negocio.';
                msgDiv.classList.remove('hidden');
            }
        });
    }

    // ---- Lógica para Recuperar Contraseña (login.html) ----
    const forgotForm = document.getElementById('forgotForm');
    if (forgotForm) {
        forgotForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const btn = document.getElementById('btnForgotSubmit');
            const msgDiv = document.getElementById('forgotMessage');
            btn.disabled = true;
            btn.textContent = 'Enviando...';
            msgDiv.classList.add('hidden');

            fetch('backend/recuperar_password.php', { method: 'POST', body: new FormData(this) })
                .then(res => res.json())
                .then(data => {
                    msgDiv.classList.remove('hidden', 'bg-red-100', 'text-red-800', 'bg-green-100', 'text-green-800');
                    if (data.success) {
                        msgDiv.classList.add('bg-green-100', 'text-green-800');
                        msgDiv.textContent = 'Si el correo existe, recibirás un enlace de recuperación.';
                        forgotForm.reset();
                    } else {
                        msgDiv.classList.add('bg-red-100', 'text-red-800');
                        msgDiv.textContent = data.error || 'Error al procesar la solicitud.';
                    }
                })
                .catch(() => {
                    msgDiv.classList.remove('hidden');
                    msgDiv.classList.add('bg-red-100', 'text-red-800');
                    msgDiv.textContent = 'Error de conexión con el servidor.';
                })
                .finally(() => { btn.disabled = false; btn.textContent = 'Enviar enlace'; });
        });
    }

    window.openForgotModal = function(e) {
        if (e) e.preventDefault();
        const modal = document.getElementById('forgotModal');
        const content = document.getElementById('forgotModalContent');
        if (!modal || !content) return;
        modal.classList.remove('hidden');
    setTimeout(() => { 
        modal.classList.remove('opacity-0'); 
        content.classList.remove('scale-95', 'animate-modal-pop');
        void content.offsetWidth;
        content.classList.add('animate-modal-pop');
    }, 10);
    };

    window.closeForgotModal = function() {
        const modal = document.getElementById('forgotModal');
        const content = document.getElementById('forgotModalContent');
        if (!modal || !content) return;
        modal.classList.add('opacity-0');
    content.classList.remove('animate-modal-pop');
    content.classList.add('scale-95');
        setTimeout(() => { modal.classList.add('hidden'); document.getElementById('forgotForm').reset(); document.getElementById('forgotMessage').classList.add('hidden'); }, 300);
    };
});