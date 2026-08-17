<?php
/**
 * Helper para enviar notificaciones automáticas por WhatsApp a los negocios / profesionales
 * utilizando Meta Cloud API (Official WhatsApp Business Cloud API)
 */

function enviarNotificacionWhatsAppMeta($pdo, $id_negocio, $telefonoDestino, $nombreCliente, $fechaTurno, $horaTurno, $servicio, $profesional = '') {
    $configPath = __DIR__ . '/../config_whatsapp.php';
    if (!file_exists($configPath)) {
        return ['success' => false, 'error' => 'Archivo config_whatsapp.php no encontrado.'];
    }

    $config = require $configPath;
    if (empty($config['enabled']) || empty($config['phone_number_id']) || empty($config['access_token'])) {
        return ['success' => false, 'error' => 'API de WhatsApp de Meta inactiva o credenciales no configuradas.'];
    }

    // 1. Sanitizar número telefónico a formato internacional E.164 (Ej: 5491123456789)
    $phoneClean = preg_replace('/[^\d]/', '', $telefonoDestino);
    if (empty($phoneClean)) {
        return ['success' => false, 'error' => 'Número de teléfono inválido.'];
    }

    // 2. Control de cupo/bolsa mensual del negocio
    if ($pdo && $id_negocio) {
        try {
            $stmtQuota = $pdo->prepare("SELECT plan, notificaciones_wpp_usadas FROM negocios WHERE id = ?");
            $stmtQuota->execute([$id_negocio]);
            $bizData = $stmtQuota->fetch(PDO::FETCH_ASSOC);

            if ($bizData) {
                $plan = strtolower($bizData['plan'] ?? 'basico');
                if (strpos($plan, 'basico') !== false && strpos($plan, 'profesional') === false && strpos($plan, 'premium') === false) {
                    return ['success' => false, 'error' => 'El Plan Básico no incluye notificaciones automáticas vía WhatsApp.'];
                }
            }
        } catch (Exception $eQuota) {}
    }

    // 3. Construir endpoint de Meta Graph API y Payload JSON con la plantilla
    $url = "https://graph.facebook.com/" . $config['api_version'] . "/" . $config['phone_number_id'] . "/messages";

    $payload = [
        'messaging_product' => 'whatsapp',
        'recipient_type'    => 'individual',
        'to'                => $phoneClean,
        'type'              => 'template',
        'template'          => [
            'name'     => $config['template_name'],
            'language' => ['code' => $config['language_code']],
            'components' => [
                [
                    'type' => 'body',
                    'parameters' => [
                        ['type' => 'text', 'text' => (string)$nombreCliente],
                        ['type' => 'text', 'text' => (string)$servicio],
                        ['type' => 'text', 'text' => (string)$fechaTurno],
                        ['type' => 'text', 'text' => (string)$horaTurno]
                    ]
                ]
            ]
        ]
    ];

    // 4. Enviar Petición cURL a los servidores de Meta
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Authorization: Bearer ' . $config['access_token'],
        'Content-Type: application/json'
    ]);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 12);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlErr = curl_error($ch);
    curl_close($ch);

    if ($curlErr) {
        return ['success' => false, 'error' => 'Error de red cURL: ' . $curlErr];
    }

    $resData = json_decode($response, true);

    if ($httpCode >= 200 && $httpCode < 300 && isset($resData['messages'][0]['id'])) {
        // Descontar notificación consumida de la bolsa del negocio
        if ($pdo && $id_negocio) {
            try {
                $pdo->prepare("UPDATE negocios SET notificaciones_wpp_usadas = COALESCE(notificaciones_wpp_usadas, 0) + 1 WHERE id = ?")->execute([$id_negocio]);
            } catch (Exception $eUpd) {}
        }
        return ['success' => true, 'message_id' => $resData['messages'][0]['id']];
    } else {
        $metaMsg = $resData['error']['message'] ?? ($resData['error']['error_data']['details'] ?? 'Respuesta inválida de Meta');
        return ['success' => false, 'error' => "Meta API Error (HTTP $httpCode): " . $metaMsg];
    }
}
