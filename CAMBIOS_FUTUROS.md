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

---

## 💳 Cobros y Transferencias Integradas con Mercado Pago

- **Descripción**: Permitir que los clientes abonen la seña o la totalidad del servicio al momento de reservar su turno utilizando Mercado Pago (Checkout Pro, QR o Link de Pago) o transferencia directa por Alias/CVU.
- **Puntos Clave a Considerar en el Desarrollo**:
  - **Credenciales por Comercio**: Almacenar `access_token` y `public_key` de Mercado Pago de manera independiente para cada negocio en la base de datos (o implementar flujo OAuth de Vendedores).
  - **Configuración de Seña**: Permitir definir desde *Ajustes* si el turno requiere pago previo (monto fijo o porcentaje ej: 30%, 50% o 100%) para quedar confirmado.
  - **Webhooks / IPN (`backend/mp_webhook.php`)**: Implementar un endpoint escuchador para recibir eventos de pago en tiempo real (`payment.created`, `payment.updated`) y actualizar automáticamente el estado del turno de *Pendiente de Pago* a *Confirmado*.
  - **Retención Temporal de Horario (Hold de Reserva)**: Bloquear el horario seleccionado durante 10 a 15 minutos mientras el cliente realiza el pago. Si la transacción no se completa en ese lapso, liberar el horario automáticamente.
  - **Comprobantes para Transferencia Bancaria**: Opción para que el cliente adjunte una foto/PDF del comprobante de transferencia al reservar cuando se elija la modalidad de Alias/CVU directo.

---

## 💬 Notificaciones y Recordatorios Automatizados vía WhatsApp

- **Descripción**: Enviar alertas automáticas por WhatsApp a los clientes y profesionales ante nuevos turnos, modificaciones, cancelaciones y recordatorios previos a la cita.
- **Puntos Clave a Considerar en el Desarrollo**:
  - **Integración API de WhatsApp**: Evaluar la API oficial de WhatsApp Business (Meta Cloud API) o proveedores de mensajería (Evolution API, UltraMsg, Twilio) para la transmisión segura de mensajes.
  - **Flujos de Notificación**:
    - **Confirmación Inmediata**: Enviar comprobante de reserva al cliente al agendar, incluyendo link para cancelar o reprogramar.
    - **Recordatorio Automático previo**: Ejecutar un script programado (Cron Job PHP) que envíe un mensaje de recordatorio 24 horas y/o 2 horas antes de la cita.
    - **Aviso al Profesional**: Enviar notificación al celular del profesional cuando le agenden o modifiquen un turno.
  - **Plantillas Personalizables con Variables**: Permitir editar el texto del mensaje usando etiquetas dinámicas (`{cliente}`, `{servicio}`, `{fecha}`, `{hora}`, `{profesional}`, `{direccion}`).
  - **Control por Comercio**: Interruptor de activación/desactivación del módulo en el panel del negocio para evitar envíos no deseados.

---

## 🧾 Facturación Electrónica Integrada con ARCA (Ex-AFIP)

- **Descripción**: Permitir la emisión automática o manual de comprobantes fiscales (Factura A, B, C y Notas de Crédito) validados legalmente por la Agencia de Recaudación y Control Aduanero (ARCA, ex-AFIP) al cobrar un turno o servicio.
- **Puntos Clave a Considerar en el Desarrollo**:
  - **Certificados y CUIT por Negocio**: Guardar de forma encriptada el certificado digital (`.crt`), clave privada (`.key`) y CUIT de cada comercio dado de alta en ARCA.
  - **Integración con Web Services de ARCA (WSAA y WSFEv1)**:
    - **WSAA**: Autenticación y obtención del Ticket de Acceso (TA).
    - **WSFEv1**: Solicitud de CAE (Código de Autorización Electrónico) y registro oficial del comprobante.
  - **Categorías de Comprobante**:
    - Factura C (Monotributo).
    - Facturas A y B (Responsables Inscriptos).
  - **Generación de Comprobantes PDF**: Renderizar el archivo PDF de la factura con el formato normativo vigente, incluyendo CUIT, CBU/Alias, CAE, fecha de vencimiento y el **código QR obligatorio de ARCA**.
  - **Modo Manual y Automático**: Botón rápido en la vista del turno para "Emitir Factura" y opción de auto-facturar turnos marcados como *Atendido / Cobrado*.