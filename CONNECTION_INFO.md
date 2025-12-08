# Connection Information & Server URLs

## Board Configuration

### WiFi Settings
- **SSID**: `gymzr hw`
- **Password**: `1ENO8VNG0BMD7EF`
- **Device ID**: `ESP8266A2`

### Server Endpoint
- **Server URL**: `https://cognitiv.onrender.com/api/data` ⚠️ **FIXED** (was missing `/api/` prefix)
- **Base URL**: `https://cognitiv.onrender.com`

### Current Configuration
- **Reading Interval**: 10 seconds (10000 ms)
- **Bundling**: DISABLED (immediate transmission)
- **Deep Sleep**: DISABLED
- **WiFi-on-Demand**: DISABLED
- **Timezone**: UTC (GMT offset: 0)

---

## Server API Endpoints

### Main Data Endpoint
```
POST https://cognitiv.onrender.com/api/data
GET  https://cognitiv.onrender.com/api/data
```
- **POST**: Send sensor data to server
- **GET**: Retrieve sensor data (with optional query params: `?hours=24&limit=1000&device_id=ESP8266A2`)

### Status & Health Check
```
GET https://cognitiv.onrender.com/api/status
```
- Check server and database connection status
- Returns: server status, database info, latest entry timestamp

### Statistics
```
GET https://cognitiv.onrender.com/api/stats?hours=24&device_id=ESP8266A2
```
- Get aggregated statistics for specified time period
- Query params:
  - `hours`: Number of hours to look back (default: 24)
  - `device_id`: Filter by device (optional)

### History Endpoints

#### Time Series Data
```
GET https://cognitiv.onrender.com/api/history/series?start=2024-01-01T00:00:00&end=2024-01-31T23:59:59&bucket=day&device_id=ESP8266A2
```
- Get aggregated time series data
- Query params:
  - `start`: ISO 8601 datetime (default: 30 days ago)
  - `end`: ISO 8601 datetime (default: now)
  - `bucket`: `hour`, `day`, `10min`, `raw`, or `none` (default: `day`)
  - `device_id`: Filter by device (optional)

#### Summary Statistics
```
GET https://cognitiv.onrender.com/api/history/summary?start=2024-01-01T00:00:00&end=2024-01-31T23:59:59&device_id=ESP8266A2
```
- Get summary statistics for time period
- Query params: Same as time series

#### CSV Export
```
GET https://cognitiv.onrender.com/api/history/export?start=2024-01-01T00:00:00&end=2024-01-31T23:59:59&device_id=ESP8266A2
```
- Export historical data as CSV file
- Query params: Same as time series

### Admin Endpoints (Authentication Required)

#### Admin Login
```
POST https://cognitiv.onrender.com/api/admin/login
Content-Type: application/json

{
  "username": "gymzr_admin",
  "password": "8266brainguard"
}
```

#### List All Devices
```
GET https://cognitiv.onrender.com/api/admin/devices
Headers: X-Admin-User: gymzr_admin
```

#### Device Statistics
```
GET https://cognitiv.onrender.com/api/admin/devices/{device_id}/stats
Headers: X-Admin-User: gymzr_admin
```

### Board Configuration Upload
```
POST https://cognitiv.onrender.com/api/connect/upload
Content-Type: application/json

{
  "boardName": "COM3",
  "ssid": "gymzr hw",
  "password": "1ENO8VNG0BMD7EF",
  "enableBundling": false,
  "enableDeepSleep": false,
  "enableWifiOnDemand": false
}
```

### AI Assistant
```
POST https://cognitiv.onrender.com/api/ai/chat
Content-Type: application/json

{
  "message": "What's the current CO2 level?",
  "device_id": "ESP8266A2"
}
```

### Debug Endpoint
```
GET https://cognitiv.onrender.com/api/debug/build-info
```
- Check React build directory location (for development)

---

## Data Format

### POST /api/data - Expected JSON Payload
```json
{
  "device_id": "ESP8266A2",
  "timestamp": 1704110400.0,
  "temperature": 23.5,
  "humidity": 45.2,
  "co2": 850
}
```

### Response Format (Success)
```json
{
  "status": "success",
  "message": "Data byla přijata a uložena.",
  "timestamp": "2024-01-01 12:00:00"
}
```

### Response Format (Error)
```json
{
  "status": "error",
  "error": "Error message description"
}
```

---

## Troubleshooting Checklist

### If Board Shows Server Error:

1. **Check Server Status**
   ```bash
   curl https://cognitiv.onrender.com/api/status
   ```

2. **Verify WiFi Connection**
   - Ensure SSID matches: `gymzr hw`
   - Check password: `1ENO8VNG0BMD7EF`
   - Verify WiFi signal strength

3. **Test Server Endpoint**
   ```bash
   curl -X POST https://cognitiv.onrender.com/api/data \
     -H "Content-Type: application/json" \
     -d '{
       "device_id": "ESP8266A2",
       "timestamp": 1704110400.0,
       "temperature": 23.5,
       "humidity": 45.2,
       "co2": 850
     }'
   ```

4. **Check Device Data**
   ```bash
   curl "https://cognitiv.onrender.com/api/data?device_id=ESP8266A2&hours=24"
   ```

5. **Verify MongoDB Connection** (if using admin endpoint)
   - Check if server can connect to MongoDB
   - Look for error messages in server logs

### Common Issues:

- **Server Unreachable**: Check if Render service is running
- **SSL/TLS Errors**: Ensure board supports BearSSL certificates
- **Timeout**: Server might be sleeping (Render free tier)
- **Data Validation Errors**: Check data format matches expected schema
- **MongoDB Connection**: Verify `MONGO_URI` environment variable is set on server

---

## Environment Variables (Server Side)

The server requires these environment variables:
- `MONGO_URI`: MongoDB connection string
- `MONGO_DB_NAME`: Database name (default: `cognitiv`)
- `MONGO_COLLECTION`: Collection name (default: `sensor_data`)
- `LOCAL_TIMEZONE`: Timezone (default: `Europe/Prague`)
- `DJANGO_SECRET_KEY`: Django secret key
- `DEBUG`: Set to `true` for debug mode

---

## Quick Test Commands

### Test Server Response
```bash
curl https://cognitiv.onrender.com/api/status
```

### Send Test Data
```bash
curl -X POST https://cognitiv.onrender.com/api/data \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": "ESP8266A2",
    "timestamp": '$(date +%s)',
    "temperature": 22.5,
    "humidity": 50.0,
    "co2": 450
  }'
```

### Get Latest Data
```bash
curl "https://cognitiv.onrender.com/api/data?device_id=ESP8266A2&hours=1&limit=10"
```

### Get Statistics
```bash
curl "https://cognitiv.onrender.com/api/stats?hours=24&device_id=ESP8266A2"
```

