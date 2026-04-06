/*
 * NetworkManager.cpp — WiFi + TLS-MQTT + NTP for ESP8266
 */

#include "managers/NetworkManager.h"
#include "config.h"

#include <ESP8266WiFi.h>
#include <WiFiClientSecure.h>   // BearSSL on ESP8266
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <time.h>

// ─── Static objects (created once, reused) ──────────────────────────────
namespace {
    BearSSL::WiFiClientSecure secureClient;
    PubSubClient              mqtt(secureClient);
    bool                      mqttConfigured = false;
}

namespace NetworkManager {

// ════════════════════════════════════════════════════════════════════════
//  WiFi
// ════════════════════════════════════════════════════════════════════════

bool connectWiFi() {
    // Prevent flash wear from persistent WiFi config writes.
    WiFi.persistent(false);
    WiFi.mode(WIFI_STA);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

    DBG("Connecting to \"%s\" …", WIFI_SSID);

    unsigned long t0 = millis();
    while (WiFi.status() != WL_CONNECTED) {
        if (millis() - t0 > WIFI_TIMEOUT_MS) {
            DBG("WiFi TIMEOUT after %u ms", WIFI_TIMEOUT_MS);
            return false;
        }
        delay(100);
    }

    DBG("WiFi OK  IP=%s  RSSI=%d dBm",
        WiFi.localIP().toString().c_str(), WiFi.RSSI());
    return true;
}

void shutdownWiFi() {
    WiFi.disconnect(true);
    WiFi.mode(WIFI_OFF);
    WiFi.forceSleepBegin();
    delay(1);
    DBG("WiFi radio OFF");
}

int getRSSI() {
    return WiFi.RSSI();
}

// ════════════════════════════════════════════════════════════════════════
//  NTP
// ════════════════════════════════════════════════════════════════════════

bool syncNTP() {
    configTime(UTC_OFFSET_SEC, DST_OFFSET_SEC, NTP_SERVER_1, NTP_SERVER_2);

    DBG("Waiting for NTP sync …");
    unsigned long t0 = millis();
    time_t now = time(nullptr);

    while (now < 1700000000L) {                 // ~2024-01-01 sanity floor
        if (millis() - t0 > NTP_TIMEOUT_MS) {
            DBG("NTP TIMEOUT");
            return false;
        }
        delay(200);
        now = time(nullptr);
    }

    struct tm *ti = localtime(&now);
    DBG("NTP synced  %04d-%02d-%02d %02d:%02d:%02d",
        ti->tm_year + 1900, ti->tm_mon + 1, ti->tm_mday,
        ti->tm_hour, ti->tm_min, ti->tm_sec);
    return true;
}

time_t getTimestamp() {
    return time(nullptr);
}

// ════════════════════════════════════════════════════════════════════════
//  MQTT over TLS
// ════════════════════════════════════════════════════════════════════════

bool connectMQTT() {
    if (!mqttConfigured) {
        // Skip certificate validation (use fingerprint in production).
        secureClient.setInsecure();
        mqtt.setServer(MQTT_BROKER_HOST, MQTT_BROKER_PORT);
        mqtt.setBufferSize(512);
        mqttConfigured = true;
    }

    // Build a unique client ID from the MAC.
    String clientId = F("cognitiv_");
    clientId += WiFi.macAddress();
    clientId.replace(":", "");

    DBG("MQTT connecting as \"%s\" to %s:%d …",
        clientId.c_str(), MQTT_BROKER_HOST, MQTT_BROKER_PORT);

    unsigned long t0 = millis();
    while (!mqtt.connected()) {
        if (mqtt.connect(clientId.c_str(), MQTT_USERNAME, MQTT_PASSWORD)) {
            break;
        }
        if (millis() - t0 > MQTT_TIMEOUT_MS) {
            DBG("MQTT TIMEOUT  state=%d", mqtt.state());
            return false;
        }
        delay(500);
    }

    DBG("MQTT connected");
    return true;
}

// ════════════════════════════════════════════════════════════════════════
//  Publish
// ════════════════════════════════════════════════════════════════════════

bool publish(uint16_t co2, float temperature, float humidity, float voltage) {
    StaticJsonDocument<256> doc;

    doc["timestamp"]   = (unsigned long)time(nullptr);
    doc["mac_address"] = WiFi.macAddress();
    doc["temperature"] = serialized(String(temperature, 2));
    doc["humidity"]    = serialized(String(humidity,    2));
    doc["co2"]         = co2;
    doc["voltage"]     = serialized(String(voltage,     2));

    char payload[256];
    size_t len = serializeJson(doc, payload, sizeof(payload));

    DBG("PUB %s  (%u bytes)", MQTT_TOPIC, len);
    DBG("    %s", payload);

    bool ok = mqtt.publish(MQTT_TOPIC, payload);
    if (!ok) {
        DBG("MQTT publish FAILED  state=%d", mqtt.state());
    }
    return ok;
}

}  // namespace NetworkManager
