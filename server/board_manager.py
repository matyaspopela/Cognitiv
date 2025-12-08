import os
import re
import subprocess
from pathlib import Path
from typing import Tuple

PROJECT_ROOT = Path(__file__).resolve().parents[1]
CONFIG_DIR = PROJECT_ROOT / "include"
CONFIG_PATH = CONFIG_DIR / "config.h"
CONFIG_TEMPLATE_PATH = CONFIG_DIR / "config_template.h"


class BoardManagerError(Exception):
    """Base class for board manager errors."""


class ConfigWriteError(BoardManagerError):
    """Raised when the configuration file cannot be written."""


def _escape_define_value(value: str) -> str:
    return value.replace("\\", "\\\\").replace('"', r'\"')


def _load_config_source() -> str:
    if CONFIG_PATH.exists():
        return CONFIG_PATH.read_text(encoding="utf-8")
    if CONFIG_TEMPLATE_PATH.exists():
        return CONFIG_TEMPLATE_PATH.read_text(encoding="utf-8")
    raise ConfigWriteError("config.h or config_template.h not found in include/")


def _replace_define(content: str, key: str, value: str, is_string: bool = True) -> str:
    pattern = re.compile(rf"^\s*#define\s+{key}\s+.*$", re.MULTILINE)
    
    if is_string:
        replacement = f'#define {key} "{_escape_define_value(value)}"'
    else:
        # For numeric values (0, 1, or numbers)
        replacement = f'#define {key} {value}'

    if pattern.search(content):
        return pattern.sub(replacement, content, count=1)

    # Insert before closing #endif if we didn't find the define
    endif_index = content.rfind("#endif")
    if endif_index == -1:
        return content.rstrip() + "\n" + replacement + "\n"

    before = content[:endif_index].rstrip()
    after = content[endif_index:]
    return f"{before}\n{replacement}\n{after}"


def apply_wifi_credentials(
    ssid: str, 
    password: str, 
    device_id: str = None,
    enable_bundling: bool = None,
    enable_wifi_on_demand: bool = None,
    enable_deep_sleep: bool = None,
    deep_sleep_duration_seconds: int = None,
    enable_scheduled_shutdown: bool = None,
    shutdown_hour: int = None,
    shutdown_minute: int = None,
    wake_hour: int = None,
    wake_minute: int = None
) -> Path:
    if not ssid or not isinstance(ssid, str):
        raise ConfigWriteError("SSID is required to update config.h")

    base_content = _load_config_source()
    updated_content = _replace_define(base_content, "WIFI_SSID", ssid)

    password_value = password if password is not None else ""
    updated_content = _replace_define(updated_content, "WIFI_PASSWORD", password_value)

    if device_id:
        if not isinstance(device_id, str):
            raise ConfigWriteError("device_id must be a string")
        updated_content = _replace_define(updated_content, "DEVICE_ID", device_id)

    # Update bundling setting if provided
    if enable_bundling is not None:
        bundling_value = "1" if enable_bundling else "0"
        updated_content = _replace_define(updated_content, "ENABLE_BUNDLING", bundling_value, is_string=False)

    # Update WiFi-on-demand setting if provided
    if enable_wifi_on_demand is not None:
        wifi_on_demand_value = "1" if enable_wifi_on_demand else "0"
        updated_content = _replace_define(updated_content, "ENABLE_WIFI_ON_DEMAND", wifi_on_demand_value, is_string=False)
        
        # Auto-enable bundling if WiFi-on-demand is enabled
        if enable_wifi_on_demand:
            updated_content = _replace_define(updated_content, "ENABLE_BUNDLING", "1", is_string=False)
            # Auto-enable deep sleep
            updated_content = _replace_define(updated_content, "ENABLE_DEEP_SLEEP", "1", is_string=False)
            # Set deep sleep duration to 10 seconds if not specified
            if deep_sleep_duration_seconds is None:
                updated_content = _replace_define(updated_content, "DEEP_SLEEP_DURATION_US", "10000000", is_string=False)

    # Update deep sleep setting if provided
    if enable_deep_sleep is not None:
        deep_sleep_value = "1" if enable_deep_sleep else "0"
        updated_content = _replace_define(updated_content, "ENABLE_DEEP_SLEEP", deep_sleep_value, is_string=False)
    
    # Update deep sleep duration if provided (convert seconds to microseconds)
    if deep_sleep_duration_seconds is not None:
        try:
            duration_seconds = int(deep_sleep_duration_seconds)
            if duration_seconds < 10 or duration_seconds > 4260:
                raise ConfigWriteError("Deep sleep duration must be between 10 and 4260 seconds (71 minutes)")
            # Convert seconds to microseconds
            duration_microseconds = duration_seconds * 1000000
            updated_content = _replace_define(updated_content, "DEEP_SLEEP_DURATION_US", str(duration_microseconds), is_string=False)
        except (ValueError, TypeError) as exc:
            raise ConfigWriteError(f"Invalid deep sleep duration: {exc}") from exc

    # Update scheduled shutdown setting if provided
    if enable_scheduled_shutdown is not None:
        shutdown_value = "1" if enable_scheduled_shutdown else "0"
        updated_content = _replace_define(updated_content, "ENABLE_SCHEDULED_SHUTDOWN", shutdown_value, is_string=False)
    
    # Update shutdown time if provided
    if shutdown_hour is not None:
        try:
            hour = int(shutdown_hour)
            if hour < 0 or hour > 23:
                raise ConfigWriteError("Shutdown hour must be between 0 and 23")
            updated_content = _replace_define(updated_content, "SHUTDOWN_HOUR", str(hour), is_string=False)
        except (ValueError, TypeError) as exc:
            raise ConfigWriteError(f"Invalid shutdown hour: {exc}") from exc
    
    if shutdown_minute is not None:
        try:
            minute = int(shutdown_minute)
            if minute < 0 or minute > 59:
                raise ConfigWriteError("Shutdown minute must be between 0 and 59")
            updated_content = _replace_define(updated_content, "SHUTDOWN_MINUTE", str(minute), is_string=False)
        except (ValueError, TypeError) as exc:
            raise ConfigWriteError(f"Invalid shutdown minute: {exc}") from exc
    
    # Update wake time if provided
    if wake_hour is not None:
        try:
            hour = int(wake_hour)
            if hour < 0 or hour > 23:
                raise ConfigWriteError("Wake hour must be between 0 and 23")
            updated_content = _replace_define(updated_content, "WAKE_HOUR", str(hour), is_string=False)
        except (ValueError, TypeError) as exc:
            raise ConfigWriteError(f"Invalid wake hour: {exc}") from exc
    
    if wake_minute is not None:
        try:
            minute = int(wake_minute)
            if minute < 0 or minute > 59:
                raise ConfigWriteError("Wake minute must be between 0 and 59")
            updated_content = _replace_define(updated_content, "WAKE_MINUTE", str(minute), is_string=False)
        except (ValueError, TypeError) as exc:
            raise ConfigWriteError(f"Invalid wake minute: {exc}") from exc

    try:
        CONFIG_DIR.mkdir(parents=True, exist_ok=True)
        CONFIG_PATH.write_text(updated_content, encoding="utf-8")
    except OSError as exc:
        raise ConfigWriteError(f"Failed to write config.h: {exc}") from exc

    return CONFIG_PATH


def run_platformio_upload(extra_env: dict | None = None) -> Tuple[int, str, str]:
    env = os.environ.copy()
    if extra_env:
        env.update(extra_env)

    # Try both 'pio' and 'platformio' commands (pio is the newer CLI)
    import sys
    is_windows = sys.platform.startswith('win')
    
    # Try pio first (newer CLI), then platformio
    for cmd_name in ['pio', 'platformio']:
        if is_windows:
            # On Windows with shell=True, use string format
            cmd = f'{cmd_name} run -d "{PROJECT_ROOT}" --target upload'
        else:
            # On Unix-like systems, use list format
            cmd = [cmd_name, "run", "-d", str(PROJECT_ROOT), "--target", "upload"]
        
        try:
            completed = subprocess.run(
                cmd,
                cwd=str(PROJECT_ROOT),
                capture_output=True,
                text=True,
                env=env,
                check=False,
                shell=is_windows,  # Use shell on Windows for better PATH resolution
            )
            # If command was found and executed (even if failed), return the result
            return completed.returncode, completed.stdout, completed.stderr
        except FileNotFoundError:
            # Command not found, try next one
            continue
        except Exception as exc:
            # Other error, return it
            return 1, "", str(exc)
    
    # Neither command found
    raise FileNotFoundError(
        "PlatformIO CLI not found. Please install PlatformIO Core. "
        "Tried commands: 'pio', 'platformio'"
    )


def summarize_logs(stdout: str, stderr: str, max_chars: int = 1200) -> str:
    combined = "\n".join(filter(None, [stdout.strip(), stderr.strip()]))

    if not combined:
        return "No build output returned."

    if len(combined) <= max_chars:
        return combined

    trimmed = combined[-max_chars:]
    return f"...{trimmed}"


def upload_firmware(
    ssid: str, 
    password: str, 
    device_id: str = None,
    enable_bundling: bool = None,
    enable_wifi_on_demand: bool = None,
    enable_deep_sleep: bool = None,
    deep_sleep_duration_seconds: int = None,
    enable_scheduled_shutdown: bool = None,
    shutdown_hour: int = None,
    shutdown_minute: int = None,
    wake_hour: int = None,
    wake_minute: int = None
) -> Tuple[int, str, str]:
    """
    Apply WiFi credentials, device ID, and feature flags to include/config.h and invoke PlatformIO upload.

    Returns the (returncode, stdout, stderr) tuple from the PlatformIO run so callers
    can surface detailed feedback to the user interface.
    """
    config_path = apply_wifi_credentials(
        ssid, 
        password, 
        device_id,
        enable_bundling,
        enable_wifi_on_demand,
        enable_deep_sleep,
        deep_sleep_duration_seconds,
        enable_scheduled_shutdown,
        shutdown_hour,
        shutdown_minute,
        wake_hour,
        wake_minute
    )
    if not config_path.exists():
        raise ConfigWriteError("Failed to prepare config.h for upload.")

    return run_platformio_upload()


