#include "PowerManager.h"
#include <ESP8266WiFi.h>

PowerManager::PowerManager() {}

void PowerManager::enterDeepSleep(unsigned long durationSeconds) {
  Serial.println("\n========================================");
  Serial.println("💤 ENTERING DEEP SLEEP");
  Serial.println("========================================");
  Serial.print("Duration: ");
  Serial.print(durationSeconds);
  Serial.println(" seconds");

  // Addresses audit finding 3.3 - WiFi Power Management
  // Explicitly turn off WiFi before deep sleep
  Serial.println("Shutting down WiFi...");
  WiFi.disconnect();
  WiFi.mode(WIFI_OFF);

  Serial.println("All systems shutting down...");
  Serial.println("========================================\n");

  // Longer delay to ensure WiFi and RF are fully powered down
  delay(500);

  // Enter deep sleep
  // Convert seconds to microseconds
  unsigned long durationUs = durationSeconds * 1000000UL;
  ESP.deepSleep(durationUs);

  // Code below never executes - ESP resets after wake
}

bool PowerManager::isInQuietHours(int gotoSleepHour, int gotoSleepMin,
                                  int wakeupHour, int wakeupMin) {
  time_t now = time(nullptr);

  // Check if time is valid (NTP synced)
  if (now < 1000000000) {
    Serial.println("⚠️  Time not synced, cannot check sleep schedule");
    return false;
  }

  struct tm *timeinfo = localtime(&now);
  int currentHour = timeinfo->tm_hour;
  int currentMin = timeinfo->tm_min;

  // Convert to minutes since midnight
  int currentTimeMinutes = currentHour * 60 + currentMin;
  int gotoSleepTimeMinutes = gotoSleepHour * 60 + gotoSleepMin;
  int wakeupTimeMinutes = wakeupHour * 60 + wakeupMin;

  Serial.print("Current time: ");
  Serial.print(currentHour);
  Serial.print(":");
  if (currentMin < 10)
    Serial.print("0");
  Serial.println(currentMin);

  Serial.print("Sleep schedule: ");
  Serial.print(gotoSleepHour);
  Serial.print(":");
  if (gotoSleepMin < 10)
    Serial.print("0");
  Serial.print(gotoSleepMin);
  Serial.print(" to ");
  Serial.print(wakeupHour);
  Serial.print(":");
  if (wakeupMin < 10)
    Serial.print("0");
  Serial.println(wakeupMin);

  // Handle overnight sleep period
  bool inQuietHours;
  if (gotoSleepTimeMinutes > wakeupTimeMinutes) {
    // Overnight: sleep if after gotosleep OR before wakeup
    inQuietHours = (currentTimeMinutes >= gotoSleepTimeMinutes) ||
                   (currentTimeMinutes < wakeupTimeMinutes);
  } else {
    // Same day: sleep if between gotosleep and wakeup
    inQuietHours = (currentTimeMinutes >= gotoSleepTimeMinutes) &&
                   (currentTimeMinutes < wakeupTimeMinutes);
  }

  if (inQuietHours) {
    Serial.println("📴 In quiet hours");
  } else {
    Serial.println("✓ Outside quiet hours");
  }

  return inQuietHours;
}

void PowerManager::enterQuietHoursSleep(int gotoSleepHour, int gotoSleepMin,
                                        int wakeupHour, int wakeupMin,
                                        unsigned long defaultSleepDurationUs) {
  // Calculate adaptive sleep duration
  unsigned long sleepDurationUs = defaultSleepDurationUs;
  time_t now = time(nullptr);

  if (now >= 1000000000) {
    struct tm *timeinfo = localtime(&now);
    int currentHour = timeinfo->tm_hour;
    int currentMin = timeinfo->tm_min;

    int minutesUntilWakeup =
        calculateMinutesUntilWakeup(currentHour, currentMin, gotoSleepHour,
                                    gotoSleepMin, wakeupHour, wakeupMin);

    int defaultSleepMinutes = defaultSleepDurationUs / (60 * 1000000UL);

    // Use adaptive sleep only if time until wakeup is less than default
    if (minutesUntilWakeup < defaultSleepMinutes && minutesUntilWakeup > 0) {
      sleepDurationUs = (unsigned long)minutesUntilWakeup * 60 * 1000000UL;
      Serial.print("⏰ Adaptive sleep: ");
      Serial.print(minutesUntilWakeup);
      Serial.println(" minutes until wakeup");
    }
  }

  Serial.println("\n========================================");
  Serial.println("💤 ENTERING QUIET HOURS DEEP SLEEP");
  Serial.println("========================================");
  Serial.print("Sleep duration: ");
  Serial.print(sleepDurationUs / 1000000);
  Serial.println(" seconds");
  Serial.println("All systems shutting down...");

  // Addresses audit finding 3.3 - WiFi Power Management
  Serial.println("WiFi: Shutting down...");
  WiFi.disconnect();
  WiFi.mode(WIFI_OFF);

  Serial.println("========================================\n");

  delay(100);

  // Enter deep sleep with RF disabled for power savings
  ESP.deepSleep(sleepDurationUs, WAKE_RF_DISABLED);
}

int PowerManager::calculateMinutesUntilWakeup(int currentHour, int currentMin,
                                              int gotoSleepHour,
                                              int gotoSleepMin, int wakeupHour,
                                              int wakeupMin) {
  int currentTimeMinutes = currentHour * 60 + currentMin;
  int wakeupTimeMinutes = wakeupHour * 60 + wakeupMin;
  int gotoSleepTimeMinutes = gotoSleepHour * 60 + gotoSleepMin;

  int minutesUntilWakeup;

  if (gotoSleepTimeMinutes > wakeupTimeMinutes) {
    // Overnight period
    if (currentTimeMinutes >= gotoSleepTimeMinutes) {
      // After gotosleep today, wakeup tomorrow
      minutesUntilWakeup = (24 * 60 - currentTimeMinutes) + wakeupTimeMinutes;
    } else {
      // Before wakeup today
      minutesUntilWakeup = wakeupTimeMinutes - currentTimeMinutes;
    }
  } else {
    // Same day period
    minutesUntilWakeup = wakeupTimeMinutes - currentTimeMinutes;
    if (minutesUntilWakeup < 0) {
      minutesUntilWakeup += 24 * 60; // Next day
    }
  }

  return minutesUntilWakeup;
}
