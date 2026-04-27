// backend/js/auth.js

document.addEventListener('DOMContentLoaded', () => {
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
        setTimeout(() => { modal.classList.remove('opacity-0'); content.classList.remove('scale-95'); }, 10);
    };

    window.closeForgotModal = function() {
        const modal = document.getElementById('forgotModal');
        const content = document.getElementById('forgotModalContent');
        if (!modal || !content) return;
        modal.classList.add('opacity-0');
        content.classList.add('scale-95');
        setTimeout(() => { modal.classList.add('hidden'); document.getElementById('forgotForm').reset(); document.getElementById('forgotMessage').classList.add('hidden'); }, 300);
    };
});