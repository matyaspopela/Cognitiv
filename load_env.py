Import("env")
import os
import codecs

# Load .env file and set environment variables
env_file = os.path.join(env.subst("$PROJECT_DIR"), ".env")

if os.path.exists(env_file):
    print(f"Loading environment variables from: {env_file}")
    # Use utf-8-sig encoding to automatically strip BOM if present
    with codecs.open(env_file, "r", encoding="utf-8-sig") as f:
        for line in f:
            line = line.strip()
            # Skip empty lines and comments
            if not line or line.startswith("#"):
                continue
            # Parse KEY=VALUE
            if "=" in line:
                key, value = line.split("=", 1)
                key = key.strip()
                value = value.strip()
                # Remove quotes if present
                if (value.startswith('"') and value.endswith('"')) or \
                   (value.startswith("'") and value.endswith("'")):
                    value = value[1:-1]
                os.environ[key] = value
                # Debug: show first few chars of value to verify it's set
                preview = value[:20] + "..." if len(value) > 20 else value
                print(f"  Set {key} = {preview}")
else:
    print(f"WARNING: .env file not found at {env_file}")
