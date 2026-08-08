# Reglas y Preferencias del Proyecto Agendatina

## Archivos de Subida Manual Obligatoria
- **`backend/conexion.php`**
- **`backend/admin_auth.php`**

> **REGLA IMPORTANTE**: Siempre notificar y avisar explícitamente al usuario cada vez que se realice cualquier modificación o ajuste en los archivos `backend/conexion.php` o `backend/admin_auth.php`, ya que el usuario debe subirlos manualmente al servidor de producción.

## Estilo Estándar del Logotipo Agendatina
En todas las vistas HTML de la plataforma (`index.html`, `login.html`, `registro.html`, `terminos.html`, `agenda.html`, `calendario.html`, `calendarioMensual.html`, `mi-web.html`, etc.), la tipografía del nombre de la marca debe usar la fuente **Fredoka** (`.font-brand`) con un grosor medio/semi-negrita (`font-semibold`):

```html
<span class="font-brand font-semibold text-2xl tracking-tight text-[#d11149]">Agenda<span class="text-[#fc8712]">tina</span></span>
```

## Modal de Confirmación para Acciones Destructivas y Eliminaciones
- **No utilizar `window.confirm()` ni `alert()` del navegador** para confirmar o notificar acciones destructivas (como eliminar o revocar cuentas/servicios).
- Siempre utilizar modales de confirmación visuales en HTML (Tailwind CSS) con diseño moderno, backdrop difuminado (`backdrop-blur`), icono representativo, botón de cancelación y botón de confirmación de acción (ej. rojo para eliminar/revocar).

## Comportamiento del Onboarding / Tour Virtual (`#onboardingWidget`)
- Mantener la lógica de auto-ocultar la sección "Primeros Pasos en Agendatina" (`#onboardingWidget`) cuando la cuenta real de negocio ya haya completado los 3 pasos iniciales (`hasConfig && hasServices && hasTurnos`).
- **REGLA EXPLICITA DEL USUARIO**: Si en el futuro el usuario solicita modificar la visibilidad de este bloque de Primeros Pasos / Tour Virtual, se le debe **recordar previamente que él solicitó explícitamente mantener esta regla** antes de realizar cualquier modificación.


