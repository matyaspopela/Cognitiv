# Audit Task 01: Implementation Steps

**Task:** Enable TLS Certificate Validation & NTP Time Sync
**Files to Create/Modify:**
- `include/certs.h` (New)
- `src/main.cpp` (Modify)

## Step 1: Create `include/certs.h`

Retrieve the **ISRG Root X1** certificate (standard for Let's Encrypt / HiveMQ Cloud).

```cpp
#ifndef CERTS_H
#define CERTS_H

// ISRG Root X1 (Let's Encrypt)
// Valid until: Mon, 04 Jun 2035 11:04:38 GMT
const char* HIVEMQ_ROOT_CA = \
"-----BEGIN CERTIFICATE-----\n" \
"MIIFazCCA1OgAwIBAgIRAIIQz7DSQONZRGPgu2OCiwAwDQYJKoZIhvcNAQELBQAw\n" \
"TzELMAkGA1UEBhMCVVMxKTAnBgNVBAoTIEludGVybmV0IFNlY3VyaXR5IFJlc2Vh\n" \
"cmNoIEdyb3VwMRUwEwYDVQQDEwxJU1JHIFJvb3QgWDEwHhcNMTUwNjA0MTEwNDM4\n" \
"WhcNMzUwNjA0MTEwNDM4WjBPMQswCQYDVQQGEwJVUzEpMCcGA1UEChMgSW50ZXJu\n" \
"ZXQgU2VjdXJpdHkgUmVzZWFyY2ggR3JvdXAxFTATBgNVBAMTDElTUkcgUm9vdCBY\n" \
"MTCCAiIwDQYJKoZIhvcNAQEBBQADggIPADCCAgoCggIBAK3oJHP0FDfzm54rVygc\n" \
"h77ct984kIxuPOZXoHj3dcKi/vVqbvYATyjb3miGbESTtrFj/RQSa78f0uoxmyF+\n" \
"0TM8ukj13Xnfs7j/EvEhmkvBioZxaUpmZmyPfjxwv60pIgbz5MDmgK7iS4+3mX6U\n" \
"A5/TR5d8mUgjU+g4rk8KB4Mu0UlXjIB0ttov0DiNewNwIRt18jA8+o+u3dpjq+sW\n" \
"T8KOEUt+zwvo/7V3LvSye0rgTBIlDHCNAymg4VMk7BPZ7hm/ELNKjD+Jo2FR3qyH\n" \
"B5T0Y3HsLuJvW5iB4YlcNHlsdu87kGJ55tukmi8mxdAQ4Q7e2RCOFvu396j3x+UC\n" \
"B5iPNgiV5+I3lg02dZ77DnKxHZu8A/lJBdiB3QW0KtZB6awBdpUKD9jf1b0SHzUv\n" \
"KBds0pjBqAlkd25HN7rOrFleaJ1/ctaJxQZBKT5ZPt0m9STJEadao0xAH0ahmbWn\n" \
"OlFls8u01UNe9sk7x0nfw/ZosU1qdo7246b0cnzwXqKmqv36kp8O6JqE1qI9AC8Q\n" \
"AStKKPTEp08N_D5hP438z6k2m5/5e70sNar4y5lFd6MSRA8b8y5d+30g9jA9r18\n" \
"XP+5Paag=-----END CERTIFICATE-----\n";

#endif
```

## Step 2: Update `src/main.cpp`

### 2.1 Include Headers
```cpp
#include "config.h"
#include "certs.h" // Add this
#include <time.h>  // Ensure time library is included
```

### 2.2 Add Time Sync Helper
Add this function before `setup()`:
```cpp
void setClock() {
  configTime(GMT_OFFSET_SEC, DAYLIGHT_OFFSET_SEC, NTP_SERVER);
  
  Serial.print("Waiting for NTP time sync: ");
  time_t now = time(nullptr);
  int attempts = 0;
  while (now < 8 * 3600 * 2 && attempts < 20) { // Check if time > Jan 1 1970 8am (approx)
    delay(500);
    Serial.print(".");
    now = time(nullptr);
    attempts++;
  }
  Serial.println("");
  
  if (attempts >= 20) {
    Serial.println("⚠️ NTP Sync Timeout - TLS may fail!");
  } else {
    struct tm timeinfo;
    gmtime_r(&now, &timeinfo);
    Serial.print("Current time: ");
    Serial.print(asctime(&timeinfo));
  }
}
```

### 2.3 Update `setup()`
Call `setClock()` **after** WiFi is connected and **before** initializing MQTT.

```cpp
  // ... (after WiFi connected check)
  
  // Initialize Time (Required for TLS)
  displayManager.showStatus("Syncing Time", TFT_YELLOW);
  setClock();

  // Initialize MQTT
  networkManager.initMQTT(MQTT_BROKER_HOST, MQTT_BROKER_PORT, MQTT_USERNAME,
                          MQTT_PASSWORD);
  
  // Enable TLS Verification
  networkManager.setCACertificate(HIVEMQ_ROOT_CA);
  
  // ...
```

## Step 3: Verification
Run `pio run -t upload` and monitor serial output to confirm time sync occurs before MQTT connection attempts.