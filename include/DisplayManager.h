#ifndef DISPLAY_MANAGER_H
#define DISPLAY_MANAGER_H

#include <Adafruit_SSD1306.h>
#include "SensorManager.h"
#include "NetworkManager.h"

// Display color definitions (for monochrome OLED)
#ifndef TFT_BLACK
#define TFT_BLACK SSD1306_BLACK
#define TFT_WHITE SSD1306_WHITE
#define TFT_RED 0xF800
#define TFT_GREEN 0x07E0
#define TFT_YELLOW 0xFFE0
#define TFT_ORANGE 0xFD20
#define TFT_CYAN 0x07FF
#endif

class DisplayManager {
public:
  DisplayManager(Adafruit_SSD1306& display);
  
  // Initialize display
  bool init();
  
  // Display status messages
  void showStatus(const char* message, uint16_t color = TFT_WHITE);
  
  // Display sensor readings (normal mode)
  void showReadings(const SensorData& data, ConnectionState wifiState, 
                   ConnectionState serverState, uint16_t warningThreshold);
  
  // Display warning screen (high CO2)
  void showWarning(const SensorData& data);
  
  // Turn off display (for deep sleep)
  void turnOff();
  
  bool isInitialized() const;
  
private:
  Adafruit_SSD1306& display;
  bool displayInitialized;
  bool invertToggle; // For warning screen animation
};

#endif // DISPLAY_MANAGER_H
