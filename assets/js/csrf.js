(function() {
    // Interceptor global de fetch para inyectar automáticamente el token CSRF
    const originalFetch = window.fetch;
    window.fetch = function(input, init) {
        init = init || {};
        
        // Solo inyectar token en métodos que modifican datos
        const isWrite = init.method && ['POST', 'PUT', 'DELETE'].includes(init.method.toUpperCase());
        
        // Leer el token de la cookie
        const csrfToken = document.cookie.match(/csrf_token=([^;]+)/)?.[1];
        
        if (isWrite && csrfToken) {
            init.headers = init.headers || {};
            if (init.headers instanceof Headers) {
                init.headers.set('X-CSRF-Token', csrfToken);
            } else if (Array.isArray(init.headers)) {
                init.headers.push(['X-CSRF-Token', csrfToken]);
            } else {
                init.headers['X-CSRF-Token'] = csrfToken;
            }
        }
        return originalFetch(input, init);
    };
})();
