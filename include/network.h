/*
 * network.h — Cognitiv Firmware v2
 *
 * WiFi connection and MQTT TLS publish.
 *
 * Design choices:
 *   - WiFi.persistent(false)    : don't write credentials to NVS flash every cycle
 *   - WiFi.setAutoReconnect(false): we handle retries via deep sleep, not the driver
 *   - setInsecure()             : no cert pinning for v1; HiveMQ Cloud uses a public CA
 *   - mqtt.setBufferSize(512)   : explicit buffer — PubSubClient default varies by version
 *   - 3 MQTT retries, 1 s apart : covers TLS handshake race conditions on first connect
 */

#pragma once

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include "config.h"

// Connect to WiFi. Returns true when connected, false on timeout.
bool wifi_connect() {
    WiFi.persistent(false);
    WiFi.setAutoReconnect(false);
    WiFi.mode(WIFI_STA);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

    DBG_FMT("[wifi] connecting to %s", WIFI_SSID);
    unsigned long deadline = millis() + WIFI_TIMEOUT_MS;
    while (WiFi.status() != WL_CONNECTED && millis() < deadline) {
        delay(500);
        DBG(".");
    }
    DBG("");  // newline after the dots

    if (WiFi.status() != WL_CONNECTED) {
        DBG("[wifi] timeout — giving up");
        return false;
    }

    DBG_FMT("[wifi] connected  IP=%s\n", WiFi.localIP().toString().c_str());
    return true;
}

// Disconnect WiFi and power down the radio.
void wifi_disconnect() {
    WiFi.disconnect(true);
    WiFi.mode(WIFI_OFF);
    DBG("[wifi] disconnected");
}

// Build the JSON payload into buf.
// Returns false if the document overflowed the buffer (should never happen at 256 B).
static bool build_payload(char* buf, size_t buf_size,
                           const char* mac,
                           float temp, float humidity,
                           uint16_t co2, uint32_t vbatt_mv) {
    JsonDocument doc;
    doc["mac_address"] = mac;
    doc["temperature"] = serialized(String(temp, 1));       // 1 decimal place
    doc["humidity"]    = serialized(String(humidity, 1));
    doc["co2"]         = co2;
    doc["voltage"]     = serialized(String(vbatt_mv / 1000.0f, 2));  // volts, 2dp

    size_t written = serializeJson(doc, buf, buf_size);
    return (written > 0 && written < buf_size);
}

// Connect to the MQTT broker over TLS and publish one message.
// Retries up to MQTT_RETRY_COUNT times before giving up.
// Returns true if the message was accepted by the broker.
bool mqtt_publish(float temp, float humidity, uint16_t co2, uint32_t vbatt_mv) {
    String mac = WiFi.macAddress();

    char payload[256];
    if (!build_payload(payload, sizeof(payload), mac.c_str(),
                       temp, humidity, co2, vbatt_mv)) {
        DBG("[mqtt] payload build failed — buffer overflow");
        return false;
    }
    DBG_FMT("[mqtt] payload: %s\n", payload);

    WiFiClientSecure tls_client;
    tls_client.setInsecure();   // no cert pinning for v1

    PubSubClient mqtt(tls_client);
    mqtt.setServer(MQTT_BROKER_HOST, MQTT_BROKER_PORT);
    mqtt.setBufferSize(512);

    // Client ID = "cognitiv_" + MAC without colons
    String client_id = "cognitiv_";
    client_id += mac;
    client_id.replace(":", "");

    for (int attempt = 1; attempt <= MQTT_RETRY_COUNT; attempt++) {
        DBG_FMT("[mqtt] connect attempt %d/%d\n", attempt, MQTT_RETRY_COUNT);

        bool connected = mqtt.connect(
            client_id.c_str(),
            MQTT_PUBLISH_USERNAME,
            MQTT_PUBLISH_PASSWORD
        );

        if (!connected) {
            DBG_FMT("[mqtt] connect failed  state=%d\n", mqtt.state());
            if (attempt < MQTT_RETRY_COUNT) delay(MQTT_RETRY_DELAY_MS);
            continue;
        }

        bool published = mqtt.publish(MQTT_TOPIC, payload, /*retained=*/false);
        mqtt.disconnect();

        if (published) {
            DBG("[mqtt] published OK");
            return true;
        }

        DBG("[mqtt] publish failed");
        if (attempt < MQTT_RETRY_COUNT) delay(MQTT_RETRY_DELAY_MS);
    }

    DBG("[mqtt] all attempts failed");
    return false;
}
