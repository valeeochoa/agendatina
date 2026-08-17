<?php
// ==============================================================================
// CONFIGURACIÓN DE NOTIFICACIONES AUTOMÁTICAS POR WHATSAPP (META CLOUD API)
// Agendatina System - Versión Meta Graph API v20.0
// ==============================================================================

return [
    // Cambiar a true cuando hayas ingresado el Phone Number ID y Access Token de Meta
    'enabled'          => false, 

    // Meta Phone Number ID (ID del número de teléfono registrado en WhatsApp Business API)
    // Se obtiene en: Meta for Developers > Tu App > WhatsApp > Configuración de API
    'phone_number_id'  => 'INGRESAR_AQUI_PHONE_NUMBER_ID', 

    // Access Token de Meta (Token de Usuario de Sistema permanente con permiso whatsapp_business_messaging)
    // Se obtiene en: Meta Business Manager > Usuarios de Sistema > Generar nuevo Token
    'access_token'     => 'INGRESAR_AQUI_PERMANENT_ACCESS_TOKEN', 

    // ID de la cuenta de WhatsApp Business (WABA ID)
    'waba_id'          => 'INGRESAR_AQUI_WABA_ID', 

    // Nombre de la plantilla de mensaje aprobada en el Administrador de WhatsApp
    'template_name'    => 'nuevo_turno_notificacion', 

    // Código de idioma de la plantilla (es, es_AR, etc.)
    'language_code'    => 'es',

    // Versión de Meta Graph API
    'api_version'      => 'v20.0'
];
