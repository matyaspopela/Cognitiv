#pragma once

#include <Arduino.h>
#include "config.h"

void buzzer_play_tune() {
    // C5 → E5 → G5 → C6: ascending major arpeggio as button-confirm feedback.
    static const uint16_t notes[]     = {523, 659, 784, 1047};
    static const uint16_t durations[] = {80,  80,  80,  160};

    for (uint8_t i = 0; i < 4; i++) {
        tone(PIN_BUZZER, notes[i], durations[i]);
        delay(durations[i] + 20);
    }
    noTone(PIN_BUZZER);
}
