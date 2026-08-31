# 🚀 Plan de Cambios y Funcionalidades Futuras - Agendatina

Este documento registra las nuevas características, mejoras planificadas y solicitudes de clientes que se habilitarán o desplegarán en versiones posteriores de Agendatina.

---

## 📊 Exportación y Descarga del Historial de Turnos (Excel / CSV)

- **Descripción**: Permitir a los administradores del negocio descargar un reporte completo en formato Excel / CSV (`.csv` UTF-8) con el historial de todos los turnos registrados.
- **Estado Actual**: Función backend (`backend/obtener_agenda.php?historial=1`) y handler frontend (`descargarHistorialTurnos` en `assets/js/agenda.js`) desarrollados y listos. El botón en la interfaz visual de `agenda.html` fue ocultado temporalmente.
- **Campos Incluidos en el Reporte**:
  - ID del turno
  - Fecha y Hora
  - Nombre del Cliente
  - Teléfono / Celular de Contacto
  - Nombre del Servicio contratado
  - Profesional asignado
  - Estado del turno (Confirmado, Atendido, Pendiente, Cancelado)
- **Acción Pendiente**: Habilitar nuevamente el botón de descarga en `agenda.html` (en la barra superior o en el encabezado del *Historial*) cuando se lance el módulo de reportes o la función comercial para cuentas Premium.
