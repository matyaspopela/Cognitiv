/*
 * PowerManager.h — Deep sleep, Quiet Hours & RTC memory for ESP8266
 *
 * The ESP8266 can reliably sleep ~3.5 h max.  For the 16-hour quiet
 * window (16:00→07:55) we chain 2-hour chunks using an RTC-memory counter.
 * The final chunk does an NTP re-sync for drift correction.
 */

#pragma once
#include <Arduino.h>

// ─── RTC Persistent State ───────────────────────────────────────────────
struct RTCData {
    uint32_t crc32;                 // CRC of the bytes after this field
    uint32_t magic;                 // Must equal RTC_MAGIC to be valid
    uint32_t quiet_wake_target;     // Unix timestamp to resume measuring
    uint32_t sleep_cycles_remaining;// 2-hour chunks still to sleep
};

namespace PowerManager {

/// Load RTCData from RTC user memory.  Returns true if CRC + magic OK.
bool readRTC(RTCData &data);

/// Write RTCData (recalculates CRC automatically).
void writeRTC(const RTCData &data);

/// Reset RTC block to defaults (no quiet mode).
void clearRTC();

/// Returns true if the given hour:minute falls inside the quiet window.
bool isQuietHours(int hour, int minute);

/// Calculate the Unix-timestamp wake target for the next school morning.
time_t calculateWakeTarget(time_t now);

/// Enter deep sleep for `seconds` (clamped to MAX_DEEP_SLEEP_SEC).
/// WiFi is shut down before sleeping.  This function does NOT return.
void deepSleep(uint32_t seconds);

/// Convenience: enter deep sleep for the normal measurement interval.
void deepSleepNormal();

}  // namespace PowerManager
