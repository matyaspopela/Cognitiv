#ifndef NETWORK_MANAGER_H
#define NETWORK_MANAGER_H

#include <ESP8266WiFi.h>
#include <PubSubClient.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>

// Connection status enum
enum ConnectionState { CONNECTING, CONNECTED, DISCONNECTED, ERROR };

class NetworkManager {
public:
  NetworkManager();
  
  // WiFi management
  bool connectWiFi(const char* ssid, const char* password);
  void disconnectWiFi();
  ConnectionState getWiFiState() const;
  String getMacAddress() const;
  
  // MQTT management
  bool initMQTT(const char* brokerHost, uint16_t brokerPort, 
                const char* username, const char* password);
  void setMQTTTopic(const char* topic);
  
  // TLS Certificate management (addresses audit finding 2.1)
  void setInsecureMode(); // For testing only - NOT recommended
  bool setCACertificate(const char* caCert); // Proper certificate validation
  
  // MQTT operations
  bool connectMQTT();
  bool reconnectMQTT(int maxAttempts = 3);
  bool isConnected(); // Removed const as PubSubClient::connected() is not const
  void loop(); // Call in main loop for MQTT keepalive
  
  // Data transmission (addresses audit finding 3.2 - heap fragmentation)
  // Serializes directly to MQTT without intermediate String allocation
  bool publishSensorData(unsigned long timestamp, const String& macAddress,
                        float temperature, float humidity, uint16_t co2, 
                        float voltage);
  
  ConnectionState getMQTTState() const;

private:
  WiFiClientSecure mqttSecureClient;
  PubSubClient mqttClient;
  
  String deviceMacAddress;
  String mqttTopic;
  
  // Connection states
  ConnectionState wifiState;
  ConnectionState mqttState;
  
  // MQTT credentials
  const char* brokerHost;
  uint16_t brokerPort;
  const char* mqttUsername;
  const char* mqttPassword;
  
  // Generate unique client ID from MAC
  String generateClientId();
};

#endif // NETWORK_MANAGER_H
