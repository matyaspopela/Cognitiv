#include "NetworkManager.h"

NetworkManager::NetworkManager() 
  : mqttClient(mqttSecureClient),
    wifiState(DISCONNECTED),
    mqttState(DISCONNECTED),
    brokerHost(nullptr),
    brokerPort(0),
    mqttUsername(nullptr),
    mqttPassword(nullptr) {
}

bool NetworkManager::connectWiFi(const char* ssid, const char* password) {
  Serial.print("WiFi: Connecting to ");
  Serial.println(ssid);
  
  wifiState = CONNECTING;
  
  WiFi.mode(WIFI_STA);
  WiFi.persistent(false); // CRITICAL FIX: Disable flash writes (audit finding 2.1)
  WiFi.disconnect();
  delay(100);
  
  WiFi.begin(ssid, password);
  
  int attempts = 0;
  int maxAttempts = 20;
  
  while (WiFi.status() != WL_CONNECTED && attempts < maxAttempts) {
    delay(500);
    Serial.print(".");
    attempts++;
    
    if (attempts % 10 == 0) {
      Serial.print(" [");
      Serial.print(attempts * 500 / 1000);
      Serial.print("s]");
    }
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n✓ WiFi connected!");
    Serial.print("IP address: ");
    Serial.println(WiFi.localIP());
    Serial.print("Signal strength: ");
    Serial.print(WiFi.RSSI());
    Serial.println(" dBm");
    
    // Cache MAC address
    deviceMacAddress = WiFi.macAddress();
    Serial.print("Device MAC: ");
    Serial.println(deviceMacAddress);
    
    wifiState = CONNECTED;
    return true;
  } else {
    Serial.println("\n✗ WiFi connection failed!");
    Serial.print("Status code: ");
    Serial.println(WiFi.status());
    wifiState = ERROR;
    return false;
  }
}

void NetworkManager::disconnectWiFi() {
  WiFi.disconnect();
  WiFi.mode(WIFI_OFF); // Addresses audit finding 3.3 - explicit WiFi shutdown
  wifiState = DISCONNECTED;
  Serial.println("WiFi: Disconnected and powered off");
}

ConnectionState NetworkManager::getWiFiState() const {
  return wifiState;
}

String NetworkManager::getMacAddress() const {
  return deviceMacAddress;
}

bool NetworkManager::initMQTT(const char* host, uint16_t port, 
                               const char* username, const char* password) {
  brokerHost = host;
  brokerPort = port;
  mqttUsername = username;
  mqttPassword = password;
  
  mqttClient.setServer(brokerHost, brokerPort);
  
  Serial.print("MQTT: Initialized for ");
  Serial.print(brokerHost);
  Serial.print(":");
  Serial.println(brokerPort);
  
  return true;
}

void NetworkManager::setMQTTTopic(const char* topic) {
  mqttTopic = String(topic);
}

void NetworkManager::setInsecureMode() {
  // WARNING: This disables certificate validation (audit finding 2.1)
  // Only use for testing!
  mqttSecureClient.setInsecure();
  Serial.println("⚠️  MQTT: TLS certificate validation DISABLED (insecure mode)");
}

bool NetworkManager::setCACertificate(const char* caCert) {
  // Addresses audit finding 2.1 - proper certificate validation
  BearSSL::X509List* cert = new BearSSL::X509List(caCert);
  mqttSecureClient.setTrustAnchors(cert);
  Serial.println("✓ MQTT: TLS certificate validation ENABLED");
  return true;
}

bool NetworkManager::connectMQTT() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("MQTT: WiFi not connected");
    mqttState = ERROR;
    return false;
  }
  
  Serial.print("MQTT: Connecting to ");
  Serial.print(brokerHost);
  Serial.print(":");
  Serial.println(brokerPort);
  
  String clientId = generateClientId();
  
  if (mqttClient.connect(clientId.c_str(), mqttUsername, mqttPassword)) {
    Serial.println("✓ MQTT connected!");
    mqttState = CONNECTED;
    return true;
  } else {
    Serial.print("✗ MQTT connection failed, rc=");
    Serial.print(mqttClient.state());
    Serial.println(" (see PubSubClient.h for error codes)");
    mqttState = ERROR;
    return false;
  }
}

bool NetworkManager::reconnectMQTT(int maxAttempts) {
  if (WiFi.status() != WL_CONNECTED) {
    return false;
  }
  
  int attempts = 0;
  
  while (!mqttClient.connected() && attempts < maxAttempts) {
    attempts++;
    Serial.print("MQTT: Reconnection attempt ");
    Serial.print(attempts);
    Serial.print("/");
    Serial.println(maxAttempts);
    
    if (connectMQTT()) {
      return true;
    }
    
    if (attempts < maxAttempts) {
      delay(2000);
    }
  }
  
  return false;
}

bool NetworkManager::isConnected() {
  return mqttClient.connected();
}

void NetworkManager::loop() {
  if (mqttClient.connected()) {
    mqttClient.loop();
  }
}

bool NetworkManager::publishSensorData(unsigned long timestamp, 
                                       const String& macAddress,
                                       float temperature, float humidity, 
                                       uint16_t co2, float voltage) {
  // Addresses audit finding 3.2 - avoid heap fragmentation
  // Serialize directly to a static buffer instead of using String
  
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("MQTT: WiFi not connected");
    return false;
  }
  
  if (!mqttClient.connected()) {
    Serial.println("MQTT: Not connected, attempting reconnection...");
    if (!reconnectMQTT()) {
      Serial.println("MQTT: Reconnection failed");
      return false;
    }
  }
  
  // Use static buffer for JSON (avoids String allocation)
  StaticJsonDocument<300> doc;
  doc["timestamp"] = timestamp;
  doc["mac_address"] = macAddress;
  doc["temperature"] = round(temperature * 100) / 100.0;
  doc["humidity"] = round(humidity * 100) / 100.0;
  doc["co2"] = co2;
  doc["voltage"] = round(voltage * 100) / 100.0;
  
  // Serialize to static buffer
  char buffer[300];
  size_t n = serializeJson(doc, buffer);
  
  Serial.print("MQTT: Publishing to ");
  Serial.print(mqttTopic);
  Serial.print(": ");
  Serial.println(buffer);
  
  bool success = mqttClient.publish(mqttTopic.c_str(), buffer);
  
  if (success) {
    Serial.println("✓ MQTT publish successful");
    mqttState = CONNECTED;
    return true;
  } else {
    Serial.println("✗ MQTT publish failed");
    mqttState = ERROR;
    
    // Retry once
    if (reconnectMQTT(1)) {
      success = mqttClient.publish(mqttTopic.c_str(), buffer);
      if (success) {
        Serial.println("✓ MQTT publish successful after reconnection");
        mqttState = CONNECTED;
        return true;
      }
    }
    return false;
  }
}

ConnectionState NetworkManager::getMQTTState() const {
  return mqttState;
}

String NetworkManager::generateClientId() {
  String clientId = "ESP8266_";
  if (deviceMacAddress.length() > 0) {
    clientId += deviceMacAddress;
    clientId.replace(":", "");
  } else {
    clientId += String(random(0xffff), HEX);
  }
  return clientId;
}
