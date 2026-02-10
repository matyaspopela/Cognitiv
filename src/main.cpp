/*
 * main.cpp — Cognitiv Environmental Monitor  (ESP8266 + SCD41)
 *
 * Lifecycle (every boot from deep sleep):
 *
 *   1. Boot diagnostics (reset reason, voltage, RTC integrity)
 *   2. Quiet-mode fast path  → decrement counter → sleep again
 *   3. Quiet-mode sync wake  → NTP re-sync → precision sleep
 *   4. Normal path           → measure → transmit → check quiet → sleep 30 s
 *
 * loop() is intentionally empty; the device always deep-sleeps at the
 * end of setup().
 */

#include "config.h"
#include "managers/I2CManager.h"
#include "managers/SensorManager.h"
#include "managers/NetworkManager.h"
#include "managers/PowerManager.h"

#include <ESP8266WiFi.h>

// ════════════════════════════════════════════════════════════════════════
//  Forward declarations
// ════════════════════════════════════════════════════════════════════════
static void handleQuietMode(RTCData &rtc);
static void handleNormalCycle();
static void enterQuietMode();
static void emergencySleep(const char *reason);

// ════════════════════════════════════════════════════════════════════════
//  setup()  — the ENTIRE operational cycle lives here
// ════════════════════════════════════════════════════════════════════════
void setup() {
    // ── 1. Boot diagnostics ───────────────────────────────────────────
#if DEBUG_MODE
    Serial.begin(115200);
    delay(10);
    Serial.println();
    Serial.println(F("═══════════════════════════════════════════"));
    Serial.println(F("  Cognitiv Environmental Monitor  v2.0"));
    Serial.println(F("═══════════════════════════════════════════"));
    DBG("Reset reason: %s", ESP.getResetInfo().c_str());
    DBG("Free heap: %u bytes", ESP.getFreeHeap());
#endif

    // ── 2. Brownout protection ────────────────────────────────────────
    //    Read voltage BEFORE any heavy peripheral use.
    float voltage = SensorManager::readBatteryVoltage();
    if (voltage > 0.1f && voltage < MIN_OPERATING_VOLTAGE) {
        // Low battery: long sleep to protect the cell.
        DBG("LOW BATTERY %.2f V < %.2f V → emergency sleep", voltage, MIN_OPERATING_VOLTAGE);
        PowerManager::clearRTC();
        PowerManager::deepSleep(MAX_DEEP_SLEEP_SEC);
        return;  // unreachable
    }

    // ── 3. Check RTC for quiet-mode state ─────────────────────────────
    RTCData rtc{};
    bool rtcValid = PowerManager::readRTC(rtc);

    if (rtcValid && rtc.sleep_cycles_remaining > 0) {
        // We are mid-quiet-sleep.  Handle entirely without sensors/WiFi.
        handleQuietMode(rtc);
        return;  // unreachable (deep-sleeps inside)
    }

    // ── 4. Normal operational cycle ───────────────────────────────────
    handleNormalCycle();
    // unreachable (deep-sleeps inside)
}

// loop() is never reached in a deep-sleep architecture.
void loop() {}

// ════════════════════════════════════════════════════════════════════════
//  Quiet-mode handler
// ════════════════════════════════════════════════════════════════════════
static void handleQuietMode(RTCData &rtc) {
    if (rtc.sleep_cycles_remaining > 1) {
        // ── Intermediate chunk: just decrement and go back to sleep ──
        rtc.sleep_cycles_remaining--;
        PowerManager::writeRTC(rtc);

        DBG("Quiet intermediate  %u chunks remain → sleep %lu s",
            rtc.sleep_cycles_remaining, MAX_DEEP_SLEEP_SEC);
        PowerManager::deepSleep(MAX_DEEP_SLEEP_SEC);
        return;
    }

    // ── Last chunk → NTP sync wake ──────────────────────────────────
    DBG("Quiet sync wake – connecting for NTP correction");

    if (!NetworkManager::connectWiFi()) {
        // Can't sync; sleep a short fallback and try again.
        emergencySleep("WiFi failed during sync wake");
        return;
    }

    if (!NetworkManager::syncNTP()) {
        emergencySleep("NTP failed during sync wake");
        return;
    }

    time_t now    = NetworkManager::getTimestamp();
    time_t target = (time_t)rtc.quiet_wake_target;
    int32_t remaining = (int32_t)(target - now);

    DBG("NTP corrected wake  remaining=%d s", remaining);

    if (remaining <= 0) {
        // We've already passed the wake target — start measuring.
        PowerManager::clearRTC();
        DBG("Past wake target → starting normal cycle immediately");
        handleNormalCycle();
        return;
    }

    // Sleep the exact remaining duration (clamped inside deepSleep).
    PowerManager::clearRTC();   // Next wake is normal.
    PowerManager::deepSleep((uint32_t)remaining);
}

// ════════════════════════════════════════════════════════════════════════
//  Normal cycle: Measure → Transmit → (maybe enter quiet) → Sleep 30 s
// ════════════════════════════════════════════════════════════════════════
static void handleNormalCycle() {
    // ── I2C Bus Recovery ──────────────────────────────────────────────
    I2CManager::recover();

    // Give the bus + sensor time to settle after recovery.
    delay(100);

    // Full bus scan for diagnostics (DEBUG builds only, still useful in production
    // when investigating field hardware).
    I2CManager::scanBus();

    // Probe sensor before committing time to WiFi.
    if (!I2CManager::devicePresent(SCD41_I2C_ADDR)) {
        emergencySleep("SCD41 not found on I2C bus");
        return;
    }

    // ── Sensor Acquisition ────────────────────────────────────────────
    if (!SensorManager::init()) {
        emergencySleep("SCD41 init failed");
        return;
    }

    if (!SensorManager::measure() || !SensorManager::isValid()) {
        emergencySleep("Sensor read failed or out of range");
        return;
    }

    uint16_t co2     = SensorManager::getCO2();
    float    temp    = SensorManager::getTemperature();
    float    hum     = SensorManager::getHumidity();
    float    voltage = SensorManager::readBatteryVoltage();

    // ── Network (only if sensor data is good) ─────────────────────────
    if (!NetworkManager::connectWiFi()) {
        emergencySleep("WiFi connect failed");
        return;
    }

    if (!NetworkManager::syncNTP()) {
        DBG("NTP sync failed – publishing without quiet-hours check");
        // Continue: data is still valuable even without time.
    }

    if (!NetworkManager::connectMQTT()) {
        emergencySleep("MQTT connect failed");
        return;
    }

    NetworkManager::publish(co2, temp, hum, voltage);
    DBG("RSSI = %d dBm", NetworkManager::getRSSI());

    // ── Quiet-hours check ─────────────────────────────────────────────
    time_t now = NetworkManager::getTimestamp();
    if (now > 1700000000L) {                    // Only if NTP succeeded
        struct tm ti;
        localtime_r(&now, &ti);
        if (PowerManager::isQuietHours(ti.tm_hour, ti.tm_min)) {
            DBG("Inside quiet window  %02d:%02d → entering quiet mode",
                ti.tm_hour, ti.tm_min);
            enterQuietMode();
            return;  // unreachable
        }
    }

    // ── Standard 30 s sleep ───────────────────────────────────────────
    PowerManager::clearRTC();
    PowerManager::deepSleepNormal();
}

// ════════════════════════════════════════════════════════════════════════
//  Enter quiet mode: calculate chunks and start the first long sleep
// ════════════════════════════════════════════════════════════════════════
static void enterQuietMode() {
    time_t now    = NetworkManager::getTimestamp();
    time_t target = PowerManager::calculateWakeTarget(now);

    uint32_t total_sec = (uint32_t)(target - now);
    // Reserve the last chunk for the NTP-sync wake.
    uint32_t chunks = total_sec / MAX_DEEP_SLEEP_SEC;
    if (chunks == 0) chunks = 1;    // At least one cycle.

    RTCData rtc{};
    rtc.quiet_wake_target      = (uint32_t)target;
    rtc.sleep_cycles_remaining = chunks;
    PowerManager::writeRTC(rtc);

    DBG("Quiet mode: %lu s total, %u chunks of %lu s",
        total_sec, chunks, MAX_DEEP_SLEEP_SEC);

    PowerManager::deepSleep(MAX_DEEP_SLEEP_SEC);
}

// ════════════════════════════════════════════════════════════════════════
//  Safety fallback
// ════════════════════════════════════════════════════════════════════════
static void emergencySleep(const char *reason) {
    DBG("EMERGENCY SLEEP: %s", reason);
    PowerManager::deepSleepNormal();
}
