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

---

## 🏋️‍♂️ Sistema de Cupos Limitados y Portal de Clientes (Clases, Pases y Membresías)

- **Descripción**: Módulo especializado para negocios que operan bajo modalidad de capacidad/cupo máximo por horario (ej: estudios de Pilates, Yoga, Gimnasios, Crossfit, Academias de Baile, Talleres y Cursos). Incorpora un **Portal de Clientes con Autenticación** donde los usuarios pueden gestionar sus reservas de acuerdo a los pases o créditos asignados por el establecimiento.

- **Puntos Clave y Arquitectura Propuesta**:

  ### 1. Alta y Registro de Clientes por el Profesional (Pre-Carga)
  - **Carga de Clientes**: El profesional o administrador registra a sus alumnos/clientes desde el panel ingresando su **Email**, Nombre completo, Teléfono y el **Pase / Paquete de Clases asignado** (ej: *Pase de 8 Clases Mensuales*, *Membresía Pase Libre*, *Pack de 4 Sesiones*).
  - **Estado del Usuario**: El sistema genera el perfil del cliente asociado al negocio en estado `pendiente_activacion`.

  ### 2. Primer Inicio de Sesión y Configuración de Contraseña (Onboarding Cliente)
  - **Detección Automática por Email**: Cuando el cliente ingresa por primera vez a la web del negocio o al portal de clientes y digita su correo electrónico, el sistema detecta de inmediato su pre-registro.
  - **Creación de Contraseña**: Se le presenta una pantalla especial de bienvenida: *"¡Tu cuenta ha sido creada por el negocio! Establece tu contraseña para acceder a tu panel"*.
  - **Confirmación Segura**: Define su clave personal de 6+ caracteres y obtiene acceso inmediato a su cuenta.

  ### 3. Portal Privado del Cliente (`mi-cuenta.html` / `portal-cliente`)
  - **📅 Calendario de Clases y Reserva por Cupos**:
    - Grilla semanal/mensual con disponibilidad en tiempo real (*Ej: "18:00 hs - Pilates Reformer (Quedan 2 cupos de 6)"*).
    - Botón de **"Reservar mi Lugar"** que valida automáticamente si el cliente dispone de créditos suficientes en su pase activo y descuenta 1 unidad al confirmar.
  - **💳 Estado de Créditos y Membresía**:
    - Medidor visual del paquete contratado (*Ej: "Te quedan 5 de 8 clases este mes"*).
    - Muestra la fecha de vencimiento y el día de renovación de su plan.
  - **📋 Historial de Reservas y Asistencia**:
    - Listado de próximas clases reservadas con opción de **"Cancelar Reserva"** (respetando la ventana de cancelación previa configurada por el negocio, ej: hasta 2 horas antes para reintegrar el crédito).
    - Historial con la trazabilidad de clases pasadas y su asistencia (*Asistió / Cancelado / Ausente*).
  - **💵 Gestión de Pagos e Historial de Facturas**:
    - Registro de pagos abonados por cuotas o paquetes con visualización de estado (*Al día / Cuota Vencida / Pendiente*).
    - Descarga de comprobantes y recibos digitales generados por el comercio.
  - **👤 Perfil de Usuario**:
    - Edición de teléfono WhatsApp, avatar y actualización de contraseña.

  ### 4. Panel de Control para el Profesional / Administrador
  - **Creación de Servicios Grupales por Cupo**: Definir la capacidad máxima de personas admitidas por bloque de horario (ej: 6 alumnos por clase de Pilates).
  - **Gestión de Créditos y Renovación de Pases**: Botón para sumar créditos manualmente, renovar la cuota mensual o pausar la membresía de un cliente.
  - **Toma de Asistencia en 1 Clic**: Grilla rápida para marcar el presente o ausente de los alumnos anotados en cada clase.

  ### 5. Estrategia Comercial e Integración en `index.html` (Planes y Ofertas)

  Para comunicar y comercializar esta nueva funcionalidad en la página principal (`index.html`), se proponen **3 alternativas estratégicas de negocio**:

  #### 💡 Opción A: Incluir como Funcionalidad Estrella del "Plan Premium" (Recomendada)
  - **Concepto**: El módulo de *Cupos Limitados, Clases y Portal de Clientes* se suma como el diferencial exclusivo y principal impulsor del **Plan Premium**.
  - **Impacto en `index.html`**:
    - Se agrega una insignia destacada en la tarjeta del Plan Premium: `🔥 Incluye Módulo de Clases, Cupos y Portal de Alumnos`.
    - En la tabla comparativa de características de `index.html`, se incluyen los ítems:
      - `[✓] Sistema de Clases Grupales y Control de Cupos`
      - `[✓] Portal de Alumnos Autogestionable (Login por Email)`
      - `[✓] Control de Pases, Membresías y Créditos`

  #### 💡 Opción B: Crear un Nuevo Plan Especializado ("Plan Academias & Gimnasios")
  - **Concepto**: Crear una cuarta opción o pestaña de plan en `index.html` orientada exclusivamente a establecimientos con modalidad de clases grupales (Gimnasios, Estudios de Pilates, Yoga, Crossfit, Escuelas de Danza, Academias, Talleres).
  - **Estructura de Tarifas en `index.html`**:
    1. **Plan Inicial / Básico**: Para profesionales individuales con agenda de turnos 1 a 1.
    2. **Plan Profesional**: Para negocios con equipo de trabajo y múltiples profesionales.
    3. **Plan Premium**: Para centros con personalización avanzada, reportes y marca completa.
    4. **Plan Academias & Cupos**: Dirigido a negocios de clases grupales. Incluye clientes ilimitados, gestión de pases mensuales, autenticación de alumnos y módulo de cobranzas.

  #### 💡 Opción C: Módulo Adicional tipo "Add-On"
  - **Concepto**: Permitir que cualquier comercio (de Plan Profesional o Premium) active el **"Módulo de Cupos y Portal de Clientes"** como una extensión adicional con un costo mensual extra.
  - **Impacto en `index.html`**:
    - Mantiene la tabla actual de 3 planes y añade un bloque informativo destacado en la landing titulado: `🧩 Módulos Adicionales: Potencia tu negocio con el Módulo de Clases y Membresías por Cupos`.

  ---

  > [!TIP]
  > **Recomendación de Implementación**: La **Opción A** es la más recomendada para incentivar a los clientes a migrar directamente hacia el **Plan Premium**, aumentando el valor percibido del software y simplificando la decisión de compra en `index.html`.