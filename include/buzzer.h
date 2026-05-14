#pragma once

#include <Arduino.h>
#include "config.h"

inline void buzzer_play_tune() {
    tone(PIN_BUZZER, 1200, 15);
    delay(35);
    noTone(PIN_BUZZER);
}
