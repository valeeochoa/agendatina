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

## Personalización Avanzada de Colores según el Plan Contratado
- **Plan Básico / Simple / Demo**: Incluye 2 colores base de personalización (Color Principal y Color Secundario).
- **Plan Profesional (Intermedio)**: Incluye 2 colores base + **1 opción adicional de color personalizado (+1)** a elección del cliente (Color Terciario, Fondo del Header, Color de Títulos, Botones CTA, Fondo de Tarjetas o Efectos Hover). Total: 3 colores.
- **Plan Premium**: Incluye 2 colores base + **hasta 3 opciones adicionales de colores personalizados (+3)** a elección del cliente (Color Terciario, Fondo del Header, Color de Títulos, Botones CTA, Fondo de Tarjetas o Efectos Hover). Total: 5 colores.
- **Formato del Modal (+)**: Al presionar el botón `+` en `perfil.html`, se muestra un modal desplegable con las opciones de destino del nuevo color (Fondo del Header, Color de Títulos, Botones CTA, Fondo de Tarjetas, Color Terciario, Hover) y un selector cromático de color.

## Flujo de Trabajo en Entorno de Pruebas (`pruebas`)
- **REGLA EXPLICITA DEL USUARIO**: A partir de ahora, todo el desarrollo, modificaciones y despliegues se realizan sobre la rama **`pruebas`** (`git checkout pruebas` -> `git push origin pruebas` -> despliegue automático a `/public_html/pruebas/`).
- Únicamente se pasará/fusionará a la rama **`main`** (producción en `/public_html/`) cuando el usuario lo solicite explícitamente ("actualizar el sitio" / pasar a producción).

## Portal Alumno: Reservas con Pase y Sincronización de Historial (REGLA MEMORIZADA)
- **Causa del bloqueo "Reservando..." y ausencia en historial/pases**:
  1. En `backend/cliente_auth.php` (`mis_clases`), la consulta PDO no debe repetir el mismo nombre de marcador con nombre (ej. `:email` en el `WHERE` y en el `LEFT JOIN clientes_negocio`), ya que en MySQL/PDO genera error de parámetro inválido (`HY093`), provocando que la consulta caiga al bloque fallback y se pierdan pases, cupos o datos de la reserva.
  2. En `reservar_con_pase`, siempre resolver `id_negocio` mediante `negocio_ruta` o `id_servicio` si viene vacío o en `0`.
  3. La vinculación del alumno en `clientes_negocio` debe contemplar registros con `id_negocio = :id_negocio` o `id_negocio = 0` priorizando el negocio seleccionado (`ORDER BY (id_negocio = :id_negocio) DESC LIMIT 1`).
  4. En `alumno.html` (`bookStudentClass`), la promesa de `fetch` siempre debe restaurar el botón ("Agendarme en esta Clase") con manejo seguro de excepciones HTTP/JSON, sin quedarse nunca trabado en "Reservando...".

## Conexión a Base de Datos y Aislamiento de Entorno Demo (REGLA MEMORIZADA)
- **Causas del error "Error de conexión a la base de datos" en Demo y Portal de Alumnos**:
  1. **Ausencia de `.env` en subdirectorios de despliegue**: Como `.env` está en `.gitignore`, no se despliega automáticamente en carpetas como `/public_html/pruebas/`. Si `conexion.php` cae a valores por defecto locales (`root`/`""`), el servidor DonWeb/cPanel rechaza la conexión.
  2. **Inexistencia de base de datos física `_d`**: Agendatina maneja el modo Demo de forma lógica en la base principal (filas con token `demo-xxxx` y auto-limpieza). **No se debe conmutar `$dbname` a `_d` ni cambiar el usuario a `DB_DEMO_USER`**, ya que causaba caídas inmediatas por base/usuario inexistente.
  3. **Contaminación de sesión `is_demo`**: Al navegar por la demo, `$_SESSION['is_demo']` quedaba guardado e impedía el acceso a páginas públicas y al portal de alumnos.
- **Estrategia Obligatoria de Conexión en `backend/conexion.php`**:
  1. **Conexión Multicredencial Resiliente**: Intentar siempre en orden:
     - `[$host, $username, $password]` (cargados de `.env`).
     - `['localhost', 'c2771918_tina', '*2fo/45pobaLAfo']` (hosting DonWeb / cPanel).
     - `['127.0.0.1', 'c2771918_tina', '*2fo/45pobaLAfo']`.
     - `['localhost', 'root', '']` (desarrollo local XAMPP).
     - `['127.0.0.1', 'root', '']`.
  2. **Búsqueda multinivel en `backend/dotenv.php`**: Buscar `.env` en `dirname(__DIR__)` (`pruebas/`), `backend/`, `dirname(dirname(__DIR__))` (`public_html/`) y `DOCUMENT_ROOT`.
  3. **Limpieza de sesión demo**: Limpiar activamente `unset($_SESSION['is_demo'])` cuando se accede al portal de alumnos (`cliente_auth.php`, `alumno.html`) o a cualquier negocio real.




