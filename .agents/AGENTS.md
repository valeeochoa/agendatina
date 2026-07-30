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
