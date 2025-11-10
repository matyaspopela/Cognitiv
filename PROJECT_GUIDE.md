# IoT Environmental Monitoring System
## Project Structure and File Guide

```
Cognitiv/
│
├── firmware/                          # ESP32 Arduino Code
│   ├── environmental_monitor.ino      # Main firmware file
│   └── config_template.h              # Configuration template
│
├── server/                            # Flask Backend Server
│   ├── server.py                      # Main server application
│   ├── requirements.txt               # Python dependencies
│   └── static/                        # Frontend files
│       └── dashboard.html             # Web dashboard
│
├── analysis/                          # Data Analysis Scripts
│   ├── data_quality.py                # Data quality checker
│   ├── visualize.py                   # Visualization generator
│   ├── prepare_ml.py                  # ML feature engineering
│   └── requirements.txt               # Python dependencies
│
├── docs/                              # Documentation
│   ├── QUICKSTART.md                  # Quick start guide
│   └── TROUBLESHOOTING.md             # Troubleshooting guide
│
└── README.md                          # Main documentation
```

## 📁 File Descriptions

### Firmware Files

#### `firmware/environmental_monitor.ino`
**Purpose**: Main ESP32 firmware
- Connects to WiFi
- Reads SHT40 and SCD41 sensors
- Displays data on T-Display
- Sends data to server via HTTP POST
- Handles errors and reconnection

**Key Functions**:
- `setup()`: Initializes hardware, sensors, WiFi
- `loop()`: Main loop, reads sensors at intervals
- `readSensors()`: Reads both sensors, validates data
- `sendDataToServer()`: Posts JSON to Flask server
- `displayReadings()`: Updates T-Display screen

**Configuration**:
```cpp
WIFI_SSID          // Your WiFi network name
WIFI_PASSWORD      // Your WiFi password
SERVER_URL         // Your PC's IP:port/data
DEVICE_ID          // Unique device identifier
READING_INTERVAL   // How often to read (milliseconds)
```

#### `firmware/config_template.h`
**Purpose**: Configuration template
- Copy this to `config.h` for private settings
- Add `config.h` to `.gitignore` to keep credentials private

### Server Files

#### `server/server.py`
**Purpose**: Flask REST API server
- Receives sensor data from ESP32
- Validates and stores data in MongoDB
- Serves dashboard web page
- Provides data API endpoints

**API Endpoints**:
- `POST /data`: Receive sensor data
- `GET /data`: Query stored data
- `GET /stats`: Get statistical summary
- `GET /status`: Server health check
- `GET /`: Serve dashboard

**Data Validation**:
- Checks required fields
- Validates data types
- Verifies realistic ranges
- Logs all transactions

#### `server/static/dashboard.html`
**Purpose**: Web visualization dashboard
- Real-time data display
- Historical charts (Chart.js)
- Statistics and air quality metrics
- Auto-refresh every 30 seconds
- Time range selection

**Features**:
- Current readings (large display)
- Min/Max/Average values
- Temperature/Humidity/CO2 graphs
- Air quality distribution
- Connection status indicators

### Analysis Files

#### `analysis/data_quality.py`
**Purpose**: Data quality assessment
- Checks for missing values
- Detects duplicate timestamps
- Identifies data gaps
- Finds statistical outliers
- Validates sensor agreement
- Checks value ranges
- Detects rapid changes

**Usage** (after exporting data from MongoDB, e.g., with `mongoexport`):
```bash
python data_quality.py ../sensor_data.csv
```

**Output**:
- Missing values report
- Duplicate check results
- Gap analysis
- Outlier detection
- Sensor agreement stats
- Summary statistics

#### `analysis/visualize.py`
**Purpose**: Advanced data visualization
- Time series plots
- Distribution histograms
- Hourly pattern analysis
- Correlation heatmaps
- Daily comparisons
- CO2 quality breakdown

**Usage** (after exporting data from MongoDB):
```bash
python visualize.py ../sensor_data.csv
```

**Output**: PNG files in `analysis/visualizations/`
- `time_series.png`: Full time series
- `distributions.png`: Value distributions
- `hourly_patterns.png`: Daily patterns
- `correlation_heatmap.png`: Sensor correlations
- `daily_comparison.png`: Day-over-day comparison
- `co2_quality_breakdown.png`: Air quality pie chart

#### `analysis/prepare_ml.py`
**Purpose**: ML feature engineering
- Creates 100+ derived features
- Time-based features (hour, day, etc.)
- Rolling statistics (moving averages)
- Lag features (previous values)
- Rate of change calculations
- Occupancy detection features
- Interaction features (dew point, etc.)
- Anomaly detection features

**Usage** (after exporting data from MongoDB):
```bash
python prepare_ml.py ../sensor_data.csv ml_features.csv
```

**Output**: `ml_features.csv` with 100+ columns
- Ready for scikit-learn
- Ready for TensorFlow/PyTorch
- Includes feature documentation

## 🔄 Data Flow

```
┌─────────────────────┐
│  ESP32 T-Display    │
│  ┌───────────────┐  │
│  │ Read Sensors  │  │ Every 60 seconds
│  │ - SHT40       │  │
│  │ - SCD41       │  │
│  └───────┬───────┘  │
│          │          │
│  ┌───────▼───────┐  │
│  │ Create JSON   │  │ Format data
│  └───────┬───────┘  │
│          │          │
│  ┌───────▼───────┐  │
│  │ HTTP POST     │  │ Send to server
│  └───────┬───────┘  │
└──────────┼──────────┘
           │ WiFi
           ▼
┌─────────────────────┐
│  Flask Server       │
│  ┌───────────────┐  │
│  │ Validate Data │  │ Check ranges
│  └───────┬───────┘  │
│          │          │
│  ┌───────▼───────┐  │
│  │ Insert into DB│  │ MongoDB Atlas
│  └───────┬───────┘  │
│          │          │
│  ┌───────▼───────┐  │
│  │ Return 200 OK │  │ Confirm receipt
│  └───────────────┘  │
└─────────────────────┘
           │
           │ HTTP GET
           ▼
┌─────────────────────┐
│  Web Dashboard      │
│  ┌───────────────┐  │
│  │ Fetch /data   │  │ Every 30 seconds
│  └───────┬───────┘  │
│          │          │
│  ┌───────▼───────┐  │
│  │ Update Charts │  │ Chart.js
│  └───────┬───────┘  │
│          │          │
│  ┌───────▼───────┐  │
│  │ Display Stats │  │ User sees
│  └───────────────┘  │
└─────────────────────┘
```

## 📊 Data Format

### JSON (ESP32 → Server)
```json
{
  "timestamp": 1699012345,
  "device_id": "livingroom_01",
  "temp_sht40": 22.50,
  "humidity_sht40": 45.20,
  "temp_scd41": 22.30,
  "humidity_scd41": 44.80,
  "co2": 650
}
```

### MongoDB Document (Server Storage)
```json
{
  "_id": "655f0c2b5f6f3c1a2b3d4e5f",
  "timestamp": "2024-11-03T10:30:00",
  "timestamp_str": "2024-11-03 10:30:00",
  "device_id": "livingroom_01",
  "temperature": 22.5,
  "humidity": 45.2,
  "co2": 650,
  "raw_payload": {
    "timestamp": 1699013400,
    "device_id": "livingroom_01",
    "temp_sht40": 22.5,
    "humidity_sht40": 45.2,
    "co2": 650
  }
}
```

### JSON (Server → Dashboard)
```json
{
  "status": "success",
  "count": 360,
  "data": [
    {
      "timestamp": "2024-11-03 10:30:00",
      "device_id": "livingroom_01",
      "temperature": 22.50,
      "humidity": 45.20,
      "co2": 650,
      "temp_avg": 22.50,
      "humidity_avg": 45.20
    }
  ]
}
```

## 🔧 Configuration Options

### ESP32 Firmware

| Setting | Default | Purpose |
|---------|---------|---------|
| READING_INTERVAL | 60000 | Milliseconds between readings |
| GMT_OFFSET_SEC | 0 | Timezone offset from UTC |
| NTP_SERVER | pool.ntp.org | Time synchronization server |

### Flask Server

| Setting | Default | Purpose |
|---------|---------|---------|
| host | 0.0.0.0 | Listen on all interfaces |
| port | 5000 | Server port number |
| debug | True | Enable debug mode |
| MONGO_URI | (see `.env`) | MongoDB Atlas connection string |
| MONGO_DB_NAME | cognitiv | Database for sensor data |
| MONGO_COLLECTION | sensor_data | MongoDB collection name |

### Dashboard

| Setting | Default | Purpose |
|---------|---------|---------|
| Auto-refresh | 30 seconds | Data update frequency |
| Default time range | 24 hours | Initial chart range |
| Chart sample rate | 100 points | Max points per chart |

## 🎯 Use Cases

### 1. Home Monitoring
- Track indoor air quality
- Optimize ventilation
- Improve comfort
- Detect problems early

### 2. Office Environment
- Monitor CO2 for productivity
- Track HVAC performance
- Ensure healthy workspace
- Compare different rooms

### 3. Research & Education
- Collect environmental data
- Study patterns and trends
- Learn IoT development
- Experiment with ML

### 4. Smart Building
- Multiple room monitoring
- Automated HVAC control
- Energy optimization
- Occupancy detection

## 🚀 Extension Ideas

### Hardware Additions
- Add PM2.5 air quality sensor
- Add light sensor (lux)
- Add motion sensor (PIR)
- Add TVOC sensor
- Battery backup with solar

### Software Features
- Email/SMS alerts
- Machine learning predictions
- MQTT integration
- Home Assistant integration
- Mobile app (React Native)
- Database backend (PostgreSQL)
- Cloud sync (AWS, Azure)
- Multi-user accounts

### Analysis Improvements
- Anomaly detection ML
- Occupancy prediction
- Energy optimization
- Comfort recommendations
- Trend forecasting
- Weather correlation

## 📚 Learning Resources

### For ESP32
- [ESP32 Arduino Core Docs](https://docs.espressif.com/projects/arduino-esp32/)
- [SHT40 Datasheet](https://www.sensirion.com/sht4x)
- [SCD41 Datasheet](https://www.sensirion.com/scd4x)

### For Flask
- [Flask Quickstart](https://flask.palletsprojects.com/quickstart/)
- [Flask-CORS](https://flask-cors.readthedocs.io/)
- [REST API Design](https://restfulapi.net/)

### For Data Analysis
- [Pandas Tutorial](https://pandas.pydata.org/docs/user_guide/)
- [Matplotlib Guide](https://matplotlib.org/stable/tutorials/)
- [Scikit-learn](https://scikit-learn.org/stable/tutorial/)

### For Sensors
- [I2C Protocol](https://learn.sparkfun.com/tutorials/i2c)
- [CO2 Sensor Basics](https://www.co2meter.com/blogs/news/co2-concentration-levels)
- [Indoor Air Quality](https://www.epa.gov/indoor-air-quality-iaq)

## 🛠️ Development Tools

### Recommended
- **Arduino IDE 2.x**: Firmware development
- **VS Code**: Server/analysis development
- **Python 3.10+**: Server runtime
- **Git**: Version control
- **Postman**: API testing

### Optional
- **PlatformIO**: Advanced ESP32 development
- **Jupyter Notebook**: Data exploration
- **Docker**: Server containerization
- **Grafana**: Advanced dashboards

## 📝 Notes

### Performance
- ESP32 can handle ~1 reading/second, but 1/minute is recommended
- Server can handle 100s of devices simultaneously
- MongoDB Atlas scales to millions of records with minimal maintenance
- Dashboard optimized for modern browsers

### Limitations
- ESP32 WiFi range: ~50m indoors
- SCD41 warm-up: 60 seconds minimum
- Atlas free tier has connection and storage limits—monitor usage
- Browser chart performance: Auto-samples >100 points

### Best Practices
- Keep firmware simple and stable
- Log everything for debugging
- Backup MongoDB collections periodically (Atlas backups or `mongodump`)
- Document any modifications
- Test changes incrementally

---

**This system is designed for easy modification and extension. Start simple, add features as needed!**
