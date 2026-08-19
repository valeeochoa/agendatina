# Guía de Pruebas de Calidad: Planes, Prorrateo y Códigos de Descuento

Este documento detalla los escenarios de prueba paso a paso para verificar el correcto funcionamiento del módulo de **Mejora de Planes (Upgrade)**, **Prorrateo Financiero** y **Códigos de Descuento Promocionales** en Agendatina.

---

## Escenario 1: Gestión de Códigos de Descuento (SuperAdmin)

### Pasos:
1. Iniciar sesión como SuperAdmin e ingresar al panel (`admin/index.html`).
2. En la caja superior de tarifas, hacer clic en el botón **"Códigos de Descuento"**.
3. En el modal que se despliega:
   - Ingresar un código de prueba en mayúsculas (ej: `PROMO20`).
   - Establecer el porcentaje de descuento (ej: `20`).
   - Agregar una descripción opcional (ej: `Lanzamiento Redes Social`).
   - Hacer clic en **"Crear Código"**.
4. Verificar que el nuevo código aparezca en la tabla inferior con su estado **Activo** y `0 cuentas` usadas.
5. Hacer clic en el botón **"Desactivar"** para probar el cambio de estado y luego volver a hacer clic en **"Activar"**.

### Resultado Esperado:
- El código se guarda en la base de datos en mayúsculas.
- El estado cambia instantáneamente entre Activo e Inactivo.
- El contador general de códigos en la caja superior se actualiza.

---

## Escenario 2: Canje y Validaciones de Código en Registro (`registro.html`)

### Pasos:
1. Abrir la página de registro público ([`registro.html`](file:///c:/xampp/htdocs/agendatina/registro.html)).
2. Ir al bloque **"¿Tenés un código de descuento? (Opcional)"**.
3. **Prueba de error (Código inválido)**:
   - Escribir `CODIGOINVENTADO` y hacer clic en **"Validar"**.
   - *Resultado*: Muestra un mensaje en rojo indicando que el código no existe o no es válido.
4. **Prueba de éxito (Código válido)**:
   - Escribir `PROMO20` y hacer clic en **"Validar"**.
   - *Resultado*: El botón cambia a "Aplicado" en verde, muestra la leyenda `🏷️ Cupón PROMO20 (-20%)` y recalcula la vista previa de las tarifas de los 3 planes en pantalla.
5. Completar el formulario de registro y presionar **"Crear Mi Cuenta y Comenzar Prueba Gratis"**.
6. Volver al SuperAdmin (`admin/index.html`) y revisar el directorio de empresas:
   - La nueva cuenta debe mostrar la etiqueta destacada: `🏷️ Cupón: PROMO20 (-20%)`.
   - En el modal de códigos, el contador de `PROMO20` debe haber subido a `1 cuentas`.

---

## Escenario 3: Mejora de Plan durante Período de Prueba ($0 a pagar hoy)

### Pasos:
1. Iniciar sesión en la cuenta recién creada (que se encuentra en `estado_pago = 'prueba'`).
2. Dirigirse al panel de perfil ([`perfil.html`](file:///c:/xampp/htdocs/agendatina/perfil.html)).
3. En la sección de **Paleta de Colores de Marca**, presionar el botón `+` para agregar un 3º color personalizado.
4. Como la cuenta está en Plan Básico, se mostrará el aviso indicando que el plan incluye 2 colores. Hacer clic en **"Ver Planes y Actualizar"**.
5. En el modal **"Mejorar o Cambiar de Plan"**:
   - Seleccionar el **Plan Premium**.
   - Revisar el cuadro de **Desglose Económico de Facturación**.
6. Verificar que el desglose muestre:
   - Estado Actual: **Período de Prueba Activo**.
   - Información: **Conservás tus días restantes de prueba con las funciones del Plan Premium**.
   - Total a abonar HOY: **$0**.
7. Hacer clic en **"Activar Upgrade a Premium ($0 hoy)"**.

### Resultado Esperado:
- El plan se actualiza inmediatamente a **Premium** en la base de datos sin requerir subida de comprobante.
- Muestra el modal de confirmación con el mensaje *¡Plan Actualizado!*.
- La página se recarga y el badge muestra **Plan Premium**, habilitando de inmediato la adición de hasta 3 colores extras de marca.

---

## Escenario 4: Mejora de Plan en Cuenta Pagada (Prorrateo Financiero)

### Pasos:
1. En una cuenta que ya haya pagado su suscripción mensual (`estado_pago = 'activo'`) en Plan Básico (suponiendo que pasaron 5 días de su ciclo de 30 días, quedando 25 días restantes).
2. Ingresar a [`perfil.html`](file:///c:/xampp/htdocs/agendatina/perfil.html) y presionar **"Mejorar o Cambiar de Plan"**.
3. Seleccionar **Plan Premium**.
4. Revisar el desglose de facturación:
   - Muestra 5 días consumidos en Plan Básico y 25 días restantes en Plan Premium.
   - Aplica el crédito a favor por los 25 días no consumidos de Básico.
   - Suma el costo de Premium por los 25 días restantes.
   - Muestra la **diferencia prorrateada exact a abonar hoy**.
5. Hacer clic en **"Proceder al Pago ($XX.XXX)"**.

### Resultado Esperado:
- Redirige a [`pago.html?plan=Premium&monto=...`](file:///c:/xampp/htdocs/agendatina/pago.html).
- En `pago.html`, el título muestra **Upgrade a Plan Premium** y el monto refleja la diferencia calculada por el prorrateo.
- Al adjuntar el comprobante y enviarlo, el backend actualiza el plan a **Premium** y notifica al SuperAdmin indicando el upgrade.

---

## Escenario 5: Primera Facturación con Código de Descuento Aplicado

### Pasos:
1. Al vencer el período de prueba de una cuenta que se registró con el código `PROMO20`.
2. Ingresar a la sección de pago ([`pago.html`](file:///c:/xampp/htdocs/agendatina/pago.html)).
3. Verificar la tarjeta **Detalle de tu Plan**.

### Resultado Esperado:
- El total a abonar calcula la tarifa mensual del plan aplicando el **20% OFF** correspondiente al código promocional.
- La nota explicativa indica: `(Incluye 20% OFF por código PROMO20)`.
- El usuario adjunta su comprobante de transferencia y la solicitud queda registrada en el panel SuperAdmin para su aprobación.
