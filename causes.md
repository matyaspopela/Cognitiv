Issue,Root Cause,Symptom,Fix
71-Minute Overflow,The internal 32-bit RTC timer overflows at ≈4.2×109μs.,Never wakes if sleep >71 min.,"Sleep in shorter cycles (e.g., 60 min) using RTC memory as a counter."
Variable Overflow,Using int or long instead of uint64_t for the microsecond count.,Wakes immediately or never.,Use ULL suffix: ESP.deepSleep(3600ULL * 1000000ULL);
Wake-up Power Surge,Waking triggers a 400mA Wi-Fi calibration spike.,Crashes during boot; LED might stay dim.,Add a 470μF capacitor across 3.3V and GND.
Floating Boot Pins,"GPIO0, 2, or 15 are floating or pulled to the wrong level.","Enters ""Flash Mode"" or ""SDIO Mode"" on wake.",Pull GPIO0/2 HIGH and GPIO15 LOW with 10k resistors.
Reset Signal Logic,GPIO16 pulse is too short for some specific board clones.,"Chip stays in ""Zombie"" mode.",Replace the wire with a Schottky diode (Cathode to GPIO16).
LDO Voltage Drop,"Battery voltage falls below the regulator's ""dropout"" limit.","Timer runs, but CPU can't execute code.",Use a Low Quiescent Current regulator (like the HT7333-1).
RF Calibration Loop,Radio fails to calibrate due to low power/interference.,"Stuck at boot, outputting gibberish.","Use ESP.deepSleep(time, WAKE_RF_DISABLED) to skip Wi-Fi."
PlatformIO Board Config,"Incorrect flash_mode (e.g., QIO vs DIO).",Hangs after waking from reset.,Set board_build.flash_mode = dio in platformio.ini.