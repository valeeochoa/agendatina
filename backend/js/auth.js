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

    // ---- Lógica para login.html ----
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const btnSubmit = document.getElementById('btnSubmit');
            const msgDiv = document.getElementById('loginMessage');

            btnSubmit.disabled = true;
            btnSubmit.textContent = 'Verificando...';
            msgDiv.classList.add('hidden');

            fetch('backend/login.php', { method: 'POST', body: new FormData(this) })
                .then(res => res.json())
                .then(data => {
                    if (data.success) {
                        sessionStorage.setItem('agendatina_session', 'active');
                        
                        // Redirección dinámica según el rol o la respuesta del servidor
                        if (data.redirect) {
                            window.location.href = data.redirect;
                        } else if (data.is_superadmin === true || data.role === 'superadmin') {
                            window.location.href = 'admin_agendatina/index.html';
                        } else {
                            window.location.href = 'dashboard.html'; // Acceso a dueños y empleados
                        }
                    } else {
                        msgDiv.textContent = data.error || 'Credenciales incorrectas.';
                        msgDiv.classList.remove('hidden');
                        btnSubmit.disabled = false;
                        btnSubmit.textContent = 'Ingresar al sistema';
                    }
                })
                .catch(error => {
                    msgDiv.textContent = 'Error de conexión con el servidor.';
                    msgDiv.classList.remove('hidden');
                    btnSubmit.disabled = false;
                    btnSubmit.textContent = 'Ingresar al sistema';
                });
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