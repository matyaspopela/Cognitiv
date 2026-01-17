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
    device_id: str = None
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
            cmd = f'{cmd_name} run -t upload'
        else:
            # On Unix-like systems, use list format
            cmd = [cmd_name, "run", "-t", "upload"]
        
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


def _update_device_id_in_config(device_id: str) -> Path:
    """Update only the DEVICE_ID in config.h (WiFi credentials come from env vars)."""
    if not device_id or not isinstance(device_id, str):
        raise ConfigWriteError("device_id must be a non-empty string")
    
    base_content = _load_config_source()
    updated_content = _replace_define(base_content, "DEVICE_ID", device_id)
    
    try:
        CONFIG_DIR.mkdir(parents=True, exist_ok=True)
        CONFIG_PATH.write_text(updated_content, encoding="utf-8")
    except OSError as exc:
        raise ConfigWriteError(f"Failed to write config.h: {exc}") from exc
    
    return CONFIG_PATH


def upload_firmware(
    ssid: str, 
    password: str, 
    device_id: str = None
) -> Tuple[int, str, str]:
    """
    Pass WiFi and MQTT credentials as environment variables and invoke PlatformIO upload.
    
    WiFi credentials are passed from the request, MQTT credentials from server environment.
    PlatformIO's build_flags pick these up via ${sysenv.VARIABLE_NAME}.
    
    DEVICE_ID is still written to config.h since it's not configured as an env var.

    Returns the (returncode, stdout, stderr) tuple from the PlatformIO run so callers
    can surface detailed feedback to the user interface.
    """
    if not ssid or not isinstance(ssid, str):
        raise ConfigWriteError("SSID is required for upload")
    
    # Pass credentials as environment variables for PlatformIO build
    extra_env = {
        # WiFi credentials from request
        'WIFI_SSID': ssid,
        'WIFI_PASSWORD': password if password else '',
        # MQTT credentials from server environment
        'MQTT_BROKER_HOST': os.getenv('MQTT_BROKER_HOST', ''),
        'MQTT_BROKER_PORT': os.getenv('MQTT_BROKER_PORT', '8883'),
        'MQTT_PUBLISH_USERNAME': os.getenv('MQTT_PUBLISH_USERNAME', ''),
        'MQTT_PUBLISH_PASSWORD': os.getenv('MQTT_PUBLISH_PASSWORD', ''),
        'MQTT_TOPIC': os.getenv('MQTT_TOPIC', ''),
    }
    
    # If device_id is provided, update config.h for DEVICE_ID
    # (DEVICE_ID isn't configured as an env variable in platformio.ini)
    if device_id:
        config_path = _update_device_id_in_config(device_id)
        if not config_path.exists():
            raise ConfigWriteError("Failed to prepare config.h for upload.")

    return run_platformio_upload(extra_env=extra_env)


