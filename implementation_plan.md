# Plan de Refactorización Arquitectónica de Agendatina

Este plan de implementación propone la reestructuración del backend del proyecto **Agendatina** para cumplir con los estándares recomendados en la auditoría técnica.

---

## Cambios Propuestos

### 1. Configuración de Entorno (.env)
- **[NEW] [dotenv.php](file:///c:/xampp/htdocs/agendatina/backend/dotenv.php):** Script ligero de parseo del archivo `.env` para evitar dependencias externas complejas.
- **[NEW] [.env](file:///c:/xampp/htdocs/agendatina/.env):** Archivo de configuración local para guardar las variables de base de datos (`DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASS`) y servidor SMTP.
- **[NEW] [.env.example](file:///c:/xampp/htdocs/agendatina/.env.example):** Plantilla vacía de variables de entorno para control de versiones.
- **[MODIFY] [conexion.php](file:///c:/xampp/htdocs/agendatina/backend/conexion.php):** Adaptado para cargar las variables del archivo `.env` y establecer las directivas de seguridad de sesiones.

### 2. Seguridad en Autenticación y Sesiones
- **[MODIFY] [conexion.php](file:///c:/xampp/htdocs/agendatina/backend/conexion.php):**
  - Configurar las directivas de las cookies de sesión (`cookie_httponly = true`, `cookie_samesite = "Lax"`).
  - Regenerar el ID de sesión tras inicios y cierres de sesión para evitar ataques de *Session Fixation*.
- **[NEW] [CSRF.php](file:///c:/xampp/htdocs/agendatina/backend/helpers/CSRF.php):** Clase helper para generar y verificar tokens CSRF en peticiones `POST`/`PUT`/`DELETE`.
- **[MODIFY] [conexion.php](file:///c:/xampp/htdocs/agendatina/backend/conexion.php):** Cargar de forma automática el chequeo de tokens CSRF para todas las peticiones modificadoras en el backend.

### 3. Autoloading de Clases
- **[MODIFY] [conexion.php](file:///c:/xampp/htdocs/agendatina/backend/conexion.php):** Registrar un autoloader simple de PHP (`spl_autoload_register`) que resuelva clases del directorio `backend/helpers/` automáticamente (ej. `FileUploader`, `CSRF`).

### 4. Gestión Unificada de Archivos
- **[NEW] [FileUploader.php](file:///c:/xampp/htdocs/agendatina/backend/helpers/FileUploader.php):** Clase centralizada de subida de imágenes y archivos. Implementará la validación de tipo MIME real, tamaño máximo y la optimización de resolución con conversión a WebP usando GD.
- **[MODIFY] [subir_logo.php](file:///c:/xampp/htdocs/agendatina/backend/subir_logo.php):** Refactorizado para usar el helper `FileUploader`.
- **[MODIFY] [subir_comprobante.php](file:///c:/xampp/htdocs/agendatina/backend/subir_comprobante.php):** Refactorizado para usar el helper `FileUploader`.

### 5. Control de Concurrencia y Migraciones
- **[MODIFY] [enviar_turno.php](file:///c:/xampp/htdocs/agendatina/backend/enviar_turno.php):** Asegurar que las consultas de bloqueo usen transacciones correctas y optimizar los bloqueos de fila (`FOR UPDATE`).
- **[NEW] [migrar.php](file:///c:/xampp/htdocs/agendatina/backend/migrar.php):** Script de consola o web de ejecución única para recrear o actualizar el esquema de la base de datos a partir del modelo unificado de tablas.

---

## Plan de Verificación

### Pruebas Manuales
- Verificar que el login, el cambio de perfil y las reservas de turnos sigan operando correctamente con la base de datos configurada a través de las variables de entorno del `.env`.
- Probar que un intento de POST malicioso sin token CSRF sea bloqueado por el servidor con código `403`.
- Intentar subir un logo inválido o pesado y verificar que la subida sea rechazada ordenadamente.
