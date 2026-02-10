#include "DisplayManager.h"

DisplayManager::DisplayManager(Adafruit_SSD1306& disp) 
  : display(disp),
    displayInitialized(false),
    invertToggle(false) {
}

bool DisplayManager::init() {
  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println("✗ SSD1306 display not found at 0x3C");
    displayInitialized = false;
    return false;
  }
  
  displayInitialized = true;
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(2);
  display.setCursor(0, 0);
  display.println("Environmental");
  display.setCursor(0, 20);
  display.println("Monitor");
  display.display();
  
  Serial.println("✓ Display initialized");
  return true;
}

void DisplayManager::showStatus(const char* message, uint16_t color) {
  if (!displayInitialized) {
    return;
  }
  
  (void)color; // Color parameter ignored for monochrome display
  
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(1);
  display.setCursor(0, 0);
  display.println(message);
  display.display();
}

void DisplayManager::showReadings(const SensorData& data, 
                                  ConnectionState wifiState,
                                  ConnectionState serverState,
                                  uint16_t warningThreshold) {
  if (!displayInitialized) {
    return;
  }
  
  // Check if warning screen should be shown
  if (data.co2 >= warningThreshold) {
    showWarning(data);
    return;
  }
  
  // Normal display mode
  display.invertDisplay(false);
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  
  // Title
  display.setTextSize(1);
  display.setCursor(0, 0);
  display.println("Monitor kvality");
  
  // CO2 reading
  display.setTextSize(1);
  display.setCursor(0, 18);
  display.print("CO2: ");
  display.print(data.co2);
  display.println(" ppm");
  
  // Temperature
  display.setTextSize(1);
  display.setCursor(0, 46);
  display.print("Teplota: ");
  display.print(data.temperature, 1);
  display.println(" C");
  
  // Connection status
  display.setCursor(0, 58);
  display.print("WiFi:");
  display.print(wifiState == CONNECTED ? "OK" : "ERR");
  display.print("  Srv:");
  display.print(serverState == CONNECTED ? "OK" : "ERR");
  
  display.display();
}

void DisplayManager::showWarning(const SensorData& data) {
  if (!displayInitialized) {
    return;
  }
  
  display.clearDisplay();
  
  // Warning header (yellow section on some OLED modules)
  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(2);
  display.setCursor(4, 4);
  display.println("POZOR");
  
  // Warning content
  display.setTextSize(1);
  display.setCursor(0, 28);
  display.print("CO2: ");
  display.print(data.co2);
  display.println(" ppm");
  display.setCursor(0, 40);
  display.println("Vyvetrejte mistnost.");
  
  // Toggle invert for flashing effect
  invertToggle = !invertToggle;
  display.invertDisplay(invertToggle);
  
  display.display();
}

void DisplayManager::turnOff() {
  if (displayInitialized) {
    display.clearDisplay();
    display.setTextSize(1);
    display.setCursor(0, 20);
    display.println("Sleeping...");
    display.display();
    delay(1000);
    display.clearDisplay();
    display.display();
    display.ssd1306_command(SSD1306_DISPLAYOFF);
    Serial.println("Display: Turned off");
  }
}

bool DisplayManager::isInitialized() const {
  return displayInitialized;
}
