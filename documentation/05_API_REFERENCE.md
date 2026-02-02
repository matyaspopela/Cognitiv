# 5. API Reference

The Cognitiv API is RESTful and serves JSON. All endpoints are prefixed with `/api`.

## 📡 Sensor Data

### `GET /api/data`
Retrieve raw sensor data for a device.

**Parameters:**
-   `device_id` (string, required): MAC address or Device ID.
-   `hours` (int, optional): Lookback window in hours (default: 24).
-   `limit` (int, optional): Max records to return (default: 1000).

**Response:**
```json
{
  "status": "success",
  "data": [
    {
      "timestamp": "2023-10-27 08:30:00",
      "co2": 850,
      "temperature": 22.4,
      "humidity": 45.1
    },
    ...
  ]
}
```

### `POST /api/data`
Ingest a new reading (typically used by MQTT service, but accessible via HTTP).

**Payload:**
```json
{
  "mac_address": "A0:20:...",
  "co2": 850,
  "temperature": 22.1,
  "humidity": 45.0
}
```

### `GET /api/stats`
Get statistical summary (Min/Max/Avg) for a time period.

**Parameters:**
-   `device_id` (required)
-   `hours` (default: 24)

---

## 📜 Historical & Annotated

### `GET /api/history/series`
Get aggregated time-series data (bucketed).

**Parameters:**
-   `device_id` (required)
-   `start` (ISO Date)
-   `end` (ISO Date)
-   `bucket` (string): `hour`, `day`, `10min`.

### `GET /api/annotated/heatmap`
Get data formatted for the "School Week" heatmap visualization.

**Parameters:**
-   `room` (string, required): Room code (e.g., "b4").

---

## 🧪 DataLab API

### `POST /api/datalab/preview`
Get a count estimate and first 10 rows for a given set of filters.

### `GET /api/datalab/export`
Stream a full dataset in CSV or PDF format.

**Parameters:**
-   `start`, `end` (ISO Date)
-   `rooms` (comma-separated list)
-   `format` (string): `csv` or `pdf`

### `GET /api/datalab/presets`
List all saved query presets.

### `POST /api/datalab/presets`
Save current filter configuration as a preset.

---

## ⚙️ Administration

### `GET /api/admin/devices`
List all registered devices and their status.
*(Requires Admin Authentication)*

### `POST /api/admin/devices/<mac>/rename`
Set a friendly display name for a device.

**Payload:** `{"name": "Chemistry Lab"}`

### `POST /api/admin/whitelist/toggle`
Enable or disable the global MAC address whitelist.

---

## 🤖 System Status

### `GET /api/status`
Check server health, DB connection, and latest data timestamp.

```json
{
  "status": "online",
  "database": "cognitiv",
  "data_points": 15420,
  "server_time": "2023-10-27 09:00:00"
}
```
