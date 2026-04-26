#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"

if [[ ! -f "$ENV_FILE" ]]; then
    echo "error: .env not found at $ENV_FILE"
    exit 1
fi

while IFS= read -r line || [[ -n "$line" ]]; do
    # skip comments and blank lines
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    [[ -z "${line//[[:space:]]/}" ]] && continue

    # match KEY=VALUE (with optional spaces around =)
    [[ "$line" =~ ^[[:space:]]*([A-Za-z_][A-Za-z0-9_]*)[[:space:]]*=[[:space:]]*(.*) ]] || continue
    key="${BASH_REMATCH[1]}"
    value="${BASH_REMATCH[2]}"

    # strip surrounding single or double quotes
    if [[ "$value" =~ ^\'(.*)\'$ ]]; then
        value="${BASH_REMATCH[1]}"
    elif [[ "$value" =~ ^\"(.*)\"$ ]]; then
        value="${BASH_REMATCH[1]}"
    fi

    export "${key}=${value}"
done < "$ENV_FILE"

exec pio "$@"
