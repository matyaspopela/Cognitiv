#ifndef POWER_MANAGER_H
#define POWER_MANAGER_H

#include <Arduino.h>
#include <time.h>

class PowerManager {
public:
  PowerManager();
  
  // Enter deep sleep (addresses audit finding 3.3 - WiFi shutdown)
  // This will properly shut down WiFi before entering sleep
  void enterDeepSleep(unsigned long durationSeconds);
  
  // Check if in quiet hours (sleep schedule)
  bool isInQuietHours(int gotoSleepHour, int gotoSleepMin, 
                     int wakeupHour, int wakeupMin);
  
  // Enter quiet hours deep sleep with adaptive duration
  void enterQuietHoursSleep(int gotoSleepHour, int gotoSleepMin,
                           int wakeupHour, int wakeupMin,
                           unsigned long defaultSleepDurationUs);
  
private:
  // Calculate minutes until wakeup time
  int calculateMinutesUntilWakeup(int currentHour, int currentMin,
                                 int gotoSleepHour, int gotoSleepMin,
                                 int wakeupHour, int wakeupMin);
};

#endif // POWER_MANAGER_H
