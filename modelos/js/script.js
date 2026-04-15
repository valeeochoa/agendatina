// script.js - Funciones para los modelos de demostración

document.addEventListener('DOMContentLoaded', () => {
    
    // 1. Prevenir el envío real de formularios (ya que son demos)
    const forms = document.querySelectorAll('.demo-form');
    forms.forEach(form => {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            
            // Cambiar el texto del botón temporalmente
            const btn = form.querySelector('button[type="submit"]');
            const originalText = btn.textContent;
            
            btn.textContent = 'Enviando...';
            btn.disabled = true;

            setTimeout(() => {
                alert('¡Esto es una demostración! En el plan real, esto enviará un email a tu casilla o un mensaje directo a tu WhatsApp.');
                btn.textContent = originalText;
                btn.disabled = false;
                form.reset();
                
                // Si estamos en el modelo 2, cerrar el modal
                if(typeof cerrarModal === 'function' && document.getElementById('productoModal') && !document.getElementById('productoModal').classList.contains('hidden')) {
                    cerrarModal();
                }
            }, 800);
        });
    });

    // 2. Smooth Scrolling para los enlaces internos
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            if(targetId === '#') return;
            
            const targetElement = document.querySelector(targetId);
            if(targetElement) {
                targetElement.scrollIntoView({
                    behavior: 'smooth'
                });
            }
        });
    });
});

// Funciones específicas para el Modelo 2 (Modal de Productos)
function abrirModalProducto(nombreProducto) {
    const modal = document.getElementById('productoModal');
    const tituloModal = document.getElementById('nombreProductoModal');
    const inputOculto = document.getElementById('inputProducto');

    if(modal && tituloModal && inputOculto) {
        tituloModal.textContent = nombreProducto;
        inputOculto.value = nombreProducto;
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
}

function cerrarModal() {
    const modal = document.getElementById('productoModal');
    if(modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}