# 🌟 Agendatina - Plataforma Integral de Gestión de Turnos y Reservas Online

Agendatina es una plataforma web SaaS diseñada para profesionales independientes, negocios de servicios y academias/estudios grupales que necesitan automatizar su agenda 24/7, gestionar turnos y asistencias, controlar cupos y membresías de alumnos, y contar con una página web pública personalizada con su propia identidad de marca.

---

## 📌 Tabla de Contenidos
1. [Stack Tecnológico](#-stack-tecnológico)
2. [Arquitectura del Sistema](#-arquitectura-del-sistema)
3. [Almacenamiento de Datos y Gestión de Estado](#-almacenamiento-de-datos-y-gestión-de-estado)
4. [Estructura del Proyecto y Directorios](#-estructura-del-proyecto-y-directorios)
5. [Modelo de Base de Datos y Tablas](#-modelo-de-base-de-datos-y-tablas)
6. [Roles, Permisos y Seguridad](#-roles-permisos-y-seguridad)
7. [Módulos Principales de la Plataforma](#-módulos-principales-de-la-plataforma)
8. [Estructura de Planes y Límites](#-estructura-de-planes-y-límites)
9. [Flujo de Despliegue y Ramas Git](#-flujo-de-despliegue-y-ramas-git)
10. [Archivos Protegidos de Subida Manual](#-archivos-protegidos-de-subida-manual)
11. [Guía de Instalación y Entorno Local (XAMPP)](#-guía-de-instalación-y-entorno-local-xampp)
12. [Hoja de Ruta y Funcionalidades Futuras](#-hoja-de-ruta-y-funcionalidades-futuras)

---

## 🛠️ Stack Tecnológico

| Capa | Tecnologías Utilizadas |
| :--- | :--- |
| **Frontend** | HTML5 Semántico, Vanilla JavaScript (ES6+ modular), Tailwind CSS, Google Fonts (*Fredoka*, *Inter*, *Manrope*, *Plus Jakarta Sans*), Material Symbols Outlined |
| **Backend** | PHP 8.x (Arquitectura basada en endpoints RESTful con respuestas JSON estandarizadas y consultas preparadas PDO) |
| **Base de Datos** | MySQL 8.x / MariaDB 10.4+ |
| **Servidor Web** | Apache 2.4+ / LiteSpeed Web Server con soporte `.htaccess` y mod_rewrite |
| **Notificaciones** | PHP `mail()` con cabeceras MIME HTML autenticadas |

---

## 🏛️ Arquitectura del Sistema

El sistema implementa una arquitectura desacoplada y orientada a servicios ligeros:

```
[ Cliente / Navegador Web ]
       │
       ▼ (Peticiones Fetch / AJAX con credenciales)
[ Servidor Apache / PHP (backend/*.php) ]
       │
       ├──► Sesión Servidor ($_SESSION + Cookie PHPSESSID)
       ├──► Capa de Conexión PDO Resiliente (conexion.php)
       │
       ▼ (Consultas SQL Preparadas)
[ Base de Datos MySQL (agendatina) ]
```

1. **Vistas Frontend (`*.html`)**: Interfaces limpias y responsivas sin frameworks pesados, optimizadas para carga ultrarrápida en móviles y escritorios.
2. **Controladores Backend (`backend/*.php`)**: Endpoints dedicados para cada entidad (`login.php`, `obtener_agenda.php`, `gestionar_clientes.php`, `guardar_reserva.php`, etc.). Retornan siempre `{ "success": true/false, "data": ..., "error": ... }`.
3. **Manejo de Rutas Amigables**: Redirección mediante `.htaccess` que mapea rutas de negocios tipo `agendatina.site/mi-negocio` directamente al turnero o a la miniweb `mi-web.html`.

---

## 💾 Almacenamiento de Datos y Gestión de Estado

### ¿Cómo guarda la información y gestiona las sesiones?

| Mecanismo | Uso en Agendatina | Persistencia |
| :--- | :--- | :--- |
| **MySQL Database** | **Fuente única de verdad**. Guarda cuentas de negocios, credenciales encriptadas (`password_hash`), turnos, historial, clientes, servicios, pases de alumnos y configuraciones de color. | Permanente en servidor |
| **Sesiones PHP (`$_SESSION`)** | **Autenticación y contexto seguro**. Almacena el `id_negocio`, `user_id`, `rol`, `email`, `plan` y token de sesión. Se enlaza con el navegador mediante la cookie segura estándar `PHPSESSID`. | Durante la sesión activa |
| **`localStorage`** | **Preferencias de interfaz y caché cliente**. Guarda estados de selectores de color en `perfil.html`, valores temporales del wizard de onboarding, filtros visuales y pre-llenado de datos de acceso rápido del alumno. | Permanente en el navegador |
| **`sessionStorage`** | **Estados volátiles de navegación**. Utilizado para redirecciones inmediatas tras login o selecciones de paso temporal entre pestañas. | Hasta cerrar la pestaña |

---

## 📂 Estructura del Proyecto y Directorios

```
agendatina/
├── index.html                   # Landing page principal y tabla comparativa
├── login.html                   # Inicio de sesión para administradores y profesionales
├── registro.html                # Formulario de alta de negocios con selector de plan y cupones
├── dashboard.html               # Panel general del negocio (métricas rápidas, accesos)
├── agenda.html                  # Agenda virtual (listado de turnos, confirmaciones, estados)
├── calendario.html              # Vista de calendario semanal / mensual para administradores
├── calendarioSemanal.html       # Vista pública semanal de reserva para clientes
├── calendarioMensual.html       # Vista pública mensual de reserva para clientes
├── mi-web.html                  # Miniweb pública personalizable del negocio
├── alumno.html                  # Portal del alumno (auto-reserva con pases, créditos)
├── clientes.html                # Directorio de clientes y gestión de pases de alumnos
├── equipo.html                  # Gestión de profesionales, roles y permisos individuales
├── estadisticas.html            # Reportes de facturación, demanda y utilización de pases
├── perfil.html                  # Ajustes de marca, horarios, paleta de colores y upgrade de plan
├── pago.html                    # Envío de comprobantes de suscripción y prorrateo
├── manual.html                  # Manual interactivo de usuario
├── terminos.html                # Términos y condiciones del servicio
├── demo.php                     # Inicializador de entorno demo aislado
│
├── admin/                       # Panel de SuperAdministrador (gestión global de cuentas y tarifas)
│   ├── index.html
│   └── ...
│
├── assets/
│   ├── css/global.css           # Estilos base y tokens visuales de Agendatina
│   └── js/
│       ├── script.js            # Controlador global de landing, carrusel y modales
│       ├── calendario.js        # Lógica de renderizado de turnos y grillas
│       ├── agenda.js            # Lógica de administración de turnos y filtros
│       ├── alumno.js            # Lógica del portal del alumno y pases
│       ├── clientes.js          # Gestión de clientes, pases y créditos
│       └── web.js               # Render de la página pública personalizada
│
├── backend/                     # Endpoints y lógica de negocio PHP
│   ├── conexion.php             # Conexión multicredencial resiliente a MySQL [PROTEGIDO]
│   ├── admin_auth.php           # Autenticación y middleware de SuperAdmin [PROTEGIDO]
│   ├── login.php                # Endpoint de inicio de sesión de comercios
│   ├── cliente_auth.php         # Endpoint de autenticación y pases para alumnos
│   ├── gestionar_clientes.php   # CRUD de clientes, pases, cupos y asistencias
│   ├── guardar_reserva.php      # Procesamiento y validación de turnos públicos
│   ├── cambiar_plan.php         # Procesador de upgrades y prorrateos de suscripción
│   ├── validar_cupon.php        # Validador de cupones de descuento promocionales
│   └── ...
│
├── public/                      # Mockups, logos y recursos estáticos
└── .agents/
    └── AGENTS.md                # Reglas operativas y directivas del proyecto
```

---

## 🗄️ Modelo de Base de Datos y Tablas

El esquema principal de la base de datos `agendatina` incluye las siguientes entidades relacionales:

1. **`negocios`**: Registro principal de comercios (`id_negocio`, `nombre`, `subdominio`, `plan`, `estado_pago`, `dias_prueba_restantes`, `cupon_aplicado`).
2. **`usuarios`**: Administradores y profesionales del negocio (`id_usuario`, `id_negocio`, `nombre`, `email`, `password`, `rol`, `permisos_json`).
3. **`servicios`**: Catálogo de prestaciones (`id_servicio`, `id_negocio`, `nombre`, `duracion`, `precio`, `cupo_maximo`, `modalidad_cupos`).
4. **`turnos`**: Reservas individuales y citas (`id_turno`, `id_negocio`, `id_servicio`, `id_profesional`, `fecha`, `hora`, `nombre_cliente`, `email`, `telefono`, `estado`).
5. **`clientes_negocio`**: Directorio de alumnos y clientes (`id_cliente`, `id_negocio`, `nombre`, `email`, `telefono`, `password_hash`, `estado_cuenta`).
6. **`pases_alumnos`**: Paquetes de clases y créditos (`id_pase`, `id_cliente`, `id_negocio`, `tipo_pase`, `creditos_totales`, `creditos_restantes`, `fecha_vencimiento`, `estado`).
7. **`asistencias_clases`**: Registro de cupos tomados por alumnos en clases grupales (`id_asistencia`, `id_turno`/`id_clase`, `id_cliente`, `fecha`, `presente`).
8. **`configuracion_web`**: Identidad visual (`id_negocio`, `color_primario`, `color_secundario`, `colores_adicionales_json`, `logo_url`, `whatsapp_contacto`, `mensaje_bienvenida`).
9. **`cupones_descuento`**: Códigos promocionales (`id_cupon`, `codigo`, `porcentaje_descuento`, `activo`, `usos`).
10. **`configuracion_tarifas`**: Precios globales de suscripción y descuentos definidos por el SuperAdmin.

---

## 👥 Roles, Permisos y Seguridad

1. **SuperAdministrador (`admin/`)**:
   - Control total de la plataforma: creación y congelamiento de negocios, configuración global de precios, gestión de cupones de descuento y aprobación de pagos.
2. **Dueño / Administrador del Negocio (`rol = 'admin'`)**:
   - Acceso completo a su panel: turnos, clientes, configuración de equipo, miniweb, reportes de facturación y pagos de suscripción.
3. **Profesional del Equipo (`rol = 'profesional'`)**:
   - Acceso parametrizado según la matriz de permisos individuales configurada en `equipo.html` (ver únicamente sus turnos, editar agenda, ver clientes, etc.).
4. **Alumno / Cliente (`portal alumno.html`)**:
   - Ingreso seguro con su correo y contraseña propia para auto-agendarse clases descontando créditos de su pase activo y consultar su historial.

---

## 💎 Estructura de Planes y Límites

| Funcionalidad | Plan Simple | Plan Profesional | Plan Premium |
| :--- | :---: | :---: | :---: |
| **Capacidad de Profesionales** | 1 Profesional | Hasta 20 Profesionales | Hasta 20 Profesionales |
| **Calendario de Reservas 24/7** | ✅ | ✅ | ✅ |
| **Notificaciones por Email** | ✅ | ✅ | ✅ |
| **Colores de Marca Personalizados** | 2 Colores Base | 3 Colores (+1 extra) | 5 Colores (+3 extras) |
| **Agenda Virtual con Filtros e Histórico** | ❌ | ✅ | ✅ |
| **Página Web Propia (`mi-web.html`)** | ❌ | ✅ | ✅ |
| **Roles y Permisos de Profesionales** | Estándar | Permisos Básicos | Roles Avanzados |
| **Métricas y Estadísticas** | ❌ | ✅ | ✅ |
| **Clases por Cupos y Portal Alumnos** | ❌ | ❌ | **✅ Exclusivo Premium** |

---

## 🌿 Flujo de Despliegue y Ramas Git

> **REGLA OBLIGATORIA DEL PROYECTO**:
> - Todo desarrollo activo, corrección de errores y pruebas se realiza sobre la rama **`pruebas`** (`git checkout pruebas` -> `git push origin pruebas`).
> - El repositorio se despliega automáticamente en el servidor de pruebas en `/public_html/pruebas/`.
> - La rama **`main`** corresponde exclusivamente a la versión de producción pública en `/public_html/` y solo se actualiza cuando el usuario lo solicita de forma expresa.

---

## 🔒 Archivos Protegidos de Subida Manual

Por motivos de seguridad y configuración de credenciales del servidor DonWeb / cPanel, los siguientes 2 archivos requieren subida manual directa si son alterados:
- **`backend/conexion.php`**
- **`backend/admin_auth.php`**

---

## 🚀 Guía de Instalación y Entorno Local (XAMPP)

1. Clonar el repositorio dentro del directorio web local:
   ```bash
   cd c:/xampp/htdocs
   git clone https://github.com/valeeochoa/agendatina.git
   cd agendatina
   git checkout pruebas
   ```
2. Importar el esquema de base de datos en MySQL / phpMyAdmin:
   - Crear base de datos: `agendatina`
   - Importar: `schema.sql` (o ejecutar `init_db.php`)
3. Iniciar módulos Apache y MySQL en el Panel de Control de XAMPP.
4. Abrir en el navegador:
   - Landing principal: `http://localhost/agendatina/index.html`
   - Portal de Alumnos: `http://localhost/agendatina/alumno.html`
   - Panel SuperAdmin: `http://localhost/agendatina/admin/index.html`

---

## 🔮 Hoja de Ruta y Funcionalidades Futuras

1. **Exportación de Historial a Excel / CSV**: Descarga en formato tabular de turnos y facturación desde `agenda.html`.
2. **Cobros y Señas con Mercado Pago**: Integración de Checkout Pro, QR y validación por Webhooks (`backend/mp_webhook.php`).
3. **Notificaciones Automatizadas por WhatsApp**: Envío de avisos y recordatorios automáticos vía Meta Cloud API.
4. **Facturación Electrónica ARCA (AFIP)**: Emisión legal de Facturas A, B y C con CAE y código QR normativo.

---

© 2026 **Agendatina**. Todos los derechos reservados.
