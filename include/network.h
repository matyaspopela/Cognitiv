#pragma once

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <time.h>
#include "config.h"

bool wifi_connect() {
    WiFi.persistent(false);
    WiFi.setAutoReconnect(false);
    WiFi.mode(WIFI_STA);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

    DBG_FMT("[wifi] connecting to %s\n", WIFI_SSID);
    unsigned long deadline = millis() + WIFI_TIMEOUT_MS;
    while (WiFi.status() != WL_CONNECTED && millis() < deadline) {
        delay(500);
    }

    if (WiFi.status() != WL_CONNECTED) {
        DBG("[wifi] timeout");
        return false;
    }

    DBG_FMT("[wifi] connected  IP=%s\n", WiFi.localIP().toString().c_str());
    return true;
}

void wifi_disconnect() {
    WiFi.disconnect(true);
    WiFi.mode(WIFI_OFF);
}

// sync clock before building the payload timestamp; returns false on timeout
bool ntp_sync() {
    configTime(0, 0, "pool.ntp.org", "time.nist.gov");
    unsigned long deadline = millis() + NTP_TIMEOUT_MS;
    time_t now = 0;
    while (millis() < deadline) {
        time(&now);
        if (now > 1000000000UL) {
            DBG_FMT("[ntp] synced  epoch=%lu\n", (unsigned long)now);
            return true;
        }
        delay(500);
    }
    DBG("[ntp] sync timeout");
    return false;
}

static bool build_payload(char* buf, size_t buf_size,
                           const char* mac,
                           float temp, float humidity,
                           uint16_t co2, uint32_t vbatt_mv) {
    time_t now;
    time(&now);

    JsonDocument doc;
    doc["mac_address"] = mac;
    doc["timestamp"]   = (long)now;
    doc["temperature"] = temp;
    doc["humidity"]    = humidity;
    doc["co2"]         = co2;
    doc["voltage"]     = vbatt_mv / 1000.0f;

    size_t written = serializeJson(doc, buf, buf_size);
    return (written > 0 && written < buf_size);
}

bool mqtt_publish(float temp, float humidity, uint16_t co2, uint32_t vbatt_mv) {
    String mac = WiFi.macAddress();

    char payload[256];
    if (!build_payload(payload, sizeof(payload), mac.c_str(),
                       temp, humidity, co2, vbatt_mv)) {
        DBG("[mqtt] payload overflow");
        return false;
    }
    DBG_FMT("[mqtt] payload: %s\n", payload);

    WiFiClientSecure tls_client;
    tls_client.setInsecure();

    PubSubClient mqtt(tls_client);
    mqtt.setServer(MQTT_BROKER_HOST, MQTT_BROKER_PORT);
    mqtt.setBufferSize(512);

    String client_id = "cognitiv_";
    client_id += mac;
    client_id.replace(":", "");

    for (int attempt = 1; attempt <= MQTT_RETRY_COUNT; attempt++) {
        DBG_FMT("[mqtt] attempt %d/%d\n", attempt, MQTT_RETRY_COUNT);

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

        bool published = mqtt.publish(MQTT_TOPIC, payload, false);
        mqtt.disconnect();

        if (published) {
            DBG("[mqtt] ok");
            return true;
        }

        if (attempt < MQTT_RETRY_COUNT) delay(MQTT_RETRY_DELAY_MS);
    }

    DBG("[mqtt] all attempts failed");
    return false;
}
