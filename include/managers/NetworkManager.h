/*
 * NetworkManager.h — WiFi, MQTT/TLS and NTP for ESP8266
 *
 * Handles the full network lifecycle:
 *   connectWiFi()  → syncNTP()  → connectMQTT()  → publish()  → shutdown()
 *
 * Every operation has a hard timeout so we never block indefinitely
 * and drain the battery.
 */

#pragma once
#include <Arduino.h>

namespace NetworkManager {

/// Bring up WiFi STA, wait up to WIFI_TIMEOUT_MS.  Returns true on association.
bool connectWiFi();

/// Gracefully tear down WiFi radio; call before deep sleep.
void shutdownWiFi();

/// Start SNTP and block until a valid timestamp is obtained
/// (year ≥ 2025) or NTP_TIMEOUT_MS expires.  Returns true on sync.
bool syncNTP();

/// Connect to MQTT broker over TLS.  Returns true on CONNACK.
bool connectMQTT();

/// Build JSON payload and publish to the configured topic.
/// Returns true if PubSubClient::publish() reports success.
bool publish(uint16_t co2, float temperature, float humidity, float voltage);

/// Current Unix timestamp (valid only after syncNTP()).
time_t getTimestamp();

/// WiFi RSSI in dBm (diagnostic).
int getRSSI();

}  // namespace NetworkManager
