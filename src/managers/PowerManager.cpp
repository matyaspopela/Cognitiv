/*
 * PowerManager.cpp — RTC memory, quiet-hours logic, deep sleep
 */

#include "managers/PowerManager.h"
#include "managers/NetworkManager.h"
#include "config.h"

#include <ESP8266WiFi.h>
#include <user_interface.h>     // system_rtc_mem_read / write

// ─── CRC-32 (Castagnoli, no table – saves flash) ───────────────────────
static uint32_t crc32(const uint8_t *data, size_t len) {
    uint32_t crc = 0xFFFFFFFF;
    for (size_t i = 0; i < len; ++i) {
        crc ^= data[i];
        for (uint8_t b = 0; b < 8; ++b)
            crc = (crc & 1) ? (crc >> 1) ^ 0xEDB88320 : crc >> 1;
    }
    return ~crc;
}

namespace PowerManager {

// ════════════════════════════════════════════════════════════════════════
// RTC Persistence
// ════════════════════════════════════════════════════════════════════════

bool readRTC(RTCData &data) {
    // RTC user memory slot 0, sizeof(RTCData) bytes.
    if (!ESP.rtcUserMemoryRead(0, (uint32_t *)&data, sizeof(data))) {
        DBG("RTC read failed (hardware)");
        return false;
    }

    // Validate CRC over everything after the crc32 field.
    const uint8_t *payload = reinterpret_cast<const uint8_t *>(&data) + sizeof(data.crc32);
    uint32_t expected = crc32(payload, sizeof(data) - sizeof(data.crc32));

    if (data.crc32 != expected || data.magic != RTC_MAGIC) {
        DBG("RTC integrity FAIL  crc=%08X/%08X  magic=%08X/%08X",
            data.crc32, expected, data.magic, RTC_MAGIC);
        return false;
    }

    DBG("RTC OK  cycles=%u  target=%lu", data.sleep_cycles_remaining, data.quiet_wake_target);
    return true;
}

void writeRTC(const RTCData &data) {
    RTCData copy = data;
    copy.magic = RTC_MAGIC;

    const uint8_t *payload = reinterpret_cast<const uint8_t *>(&copy) + sizeof(copy.crc32);
    copy.crc32 = crc32(payload, sizeof(copy) - sizeof(copy.crc32));

    ESP.rtcUserMemoryWrite(0, (uint32_t *)&copy, sizeof(copy));
    DBG("RTC written  cycles=%u  target=%lu", copy.sleep_cycles_remaining, copy.quiet_wake_target);
}

void clearRTC() {
    RTCData blank{};
    blank.sleep_cycles_remaining = 0;
    blank.quiet_wake_target      = 0;
    writeRTC(blank);
    DBG("RTC cleared");
}

// ════════════════════════════════════════════════════════════════════════
// Quiet Hours
// ════════════════════════════════════════════════════════════════════════

bool isQuietHours(int hour, int minute) {
    if (!QUIET_HOURS_ENABLED) return false;

    // Overnight window: e.g. 16:00 → 07:55 (crosses midnight).
    int now_m   = hour * 60 + minute;
    int start_m = QUIET_START_HOUR * 60 + QUIET_START_MINUTE;
    int end_m   = QUIET_END_HOUR   * 60 + QUIET_END_MINUTE;

    if (start_m > end_m) {
        // Overnight: quiet if now >= start OR now < end.
        return (now_m >= start_m) || (now_m < end_m);
    }
    // Same-day: quiet if now >= start AND now < end.
    return (now_m >= start_m) && (now_m < end_m);
}

time_t calculateWakeTarget(time_t now) {
    struct tm t;
    localtime_r(&now, &t);

    t.tm_hour = QUIET_END_HOUR;
    t.tm_min  = QUIET_END_MINUTE;
    t.tm_sec  = 0;

    time_t target = mktime(&t);

    // If the computed target is in the past (we're past 07:55 today),
    // push it forward by one day.
    if (target <= now) {
        t.tm_mday += 1;
        target = mktime(&t);       // mktime normalises day overflow
    }

    DBG("Wake target = %lu  (%.0f s from now)", (unsigned long)target, difftime(target, now));
    return target;
}

// ════════════════════════════════════════════════════════════════════════
// Deep Sleep
// ════════════════════════════════════════════════════════════════════════

void deepSleep(uint32_t seconds) {
    // Guard: never sleep zero or negative (would effectively hang).
    if (seconds == 0) {
        DBG("SAFETY: sleep duration 0 → defaulting to %u s", SLEEP_INTERVAL_SEC);
        seconds = SLEEP_INTERVAL_SEC;
    }
    // Clamp to hardware ceiling.
    if (seconds > MAX_DEEP_SLEEP_SEC) {
        seconds = MAX_DEEP_SLEEP_SEC;
    }

    NetworkManager::shutdownWiFi();

    uint64_t us = (uint64_t)seconds * 1000000ULL;
    DBG("Entering deep sleep for %u s …", seconds);
    Serial.flush();
    ESP.deepSleep(us, WAKE_RF_DEFAULT);
    // Execution stops here.  Device resets on wake.
}

void deepSleepNormal() {
    deepSleep(SLEEP_INTERVAL_SEC);
}

}  // namespace PowerManager
