# Cognitiv

IoT systém pro monitorování kvality vzduchu v místnostech — měří CO2, teplotu a vlhkost v reálném čase.

## O projektu

Cognitiv je řešení pro sledování kvality prostředí v učebnách, kancelářích nebo jakémkoli vnitřním prostoru. Systém využívá hardware založený na ESP8266, který sbírá data ze senzorů a odesílá je na cloudový server. Data si pak můžete prohlížet přes webový dashboard.

Měřené veličiny:
- **CO2** (ppm) — ukazuje, kdy je potřeba vyvětrat
- **Teplota** (°C)
- **Vlhkost** (%)

Systém zahrnuje vizuální upozornění (LED a displej) při překročení bezpečných hodnot CO2 a AI asistenta, který dokáže odpovídat na dotazy o naměřených datech.

## Funkce

- Měření v reálném čase s nastavitelným intervalem
- Webový dashboard s historickými grafy a statistikami
- Klasifikace kvality vzduchu (Dobrá / Střední / Vysoká / Kritická)
- Export dat do CSV
- Podpora více zařízení
- AI asistent pro analýzu dat
- Volitelný OLED displej pro lokální zobrazení
- LED indikátor varování při vysokém CO2

## Hardwarové požadavky

| Komponenta | Popis |
|------------|-------|
| ESP8266 deska | Modul ESP12-E nebo ESP12-S (např. LaskaKit AirBoard 8266) |
| SCD41 senzor | Senzor CO2, teploty a vlhkosti |
| OLED displej | Volitelně — 128x64 SSD1306 I2C displej |
| LED | Volitelně — pro indikaci varování CO2 |

Hardware se propojuje přes I2C pomocí LaskaKit μSup konektorů (nebo standardním I2C zapojením).

## Nasazení serveru na Render.com

Tato sekce popisuje, jak spustit backend server na platformě Render.com.

### 1. Příprava

Budete potřebovat:
- Účet na [Render.com](https://render.com/) (zdarma)
- Účet na [MongoDB Atlas](https://www.mongodb.com/atlas) (zdarma)
- Repozitář s projektem na GitHubu

### 2. Vytvoření MongoDB databáze

1. Přihlaste se do MongoDB Atlas
2. Vytvořte nový cluster (Free tier stačí)
3. V sekci **Database Access** vytvořte uživatele s heslem
4. V sekci **Network Access** přidejte IP adresu Render serveru
5. Klikněte na **Connect** → **Drivers** a zkopírujte connection string:
   ```
   mongodb+srv://uzivatel:heslo@cluster.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```

### 3. Vytvoření služby na Render

1. Přihlaste se na Render.com
2. Klikněte na **New** → **Web Service**
3. Propojte svůj GitHub repozitář
4. Nastavte:
   - **Name**: `cognitiv` (nebo jiný název)
   - **Environment**: `Python 3`
   - **Build Command**:
     ```bash
     cd frontend && npm install && npm run build && cd .. && pip install -r server/requirements.txt && cd server && python manage.py collectstatic --noinput
     ```
   - **Start Command**:
     ```bash
     cd server && gunicorn cognitiv.wsgi:application --bind 0.0.0.0:$PORT
     ```

### 4. Nastavení proměnných prostředí

V sekci **Environment** na Render přidejte tyto proměnné:

| Proměnná | Hodnota |
|----------|---------|
| `MONGO_URI` | Váš MongoDB connection string |
| `MONGO_DB_NAME` | `cognitiv` |
| `DJANGO_SECRET_KEY` | Náhodný řetězec (Render může vygenerovat) |
| `DEBUG` | `false` |
| `LOCAL_TIMEZONE` | `Europe/Prague` |
| `GEMINI_API_KEY` | API klíč pro AI asistenta (volitelné) |

### 5. Nasazení

Klikněte na **Create Web Service**. Render automaticky:
1. Naklonuje repozitář
2. Nainstaluje Node.js a Python závislosti
3. Sestaví frontend
4. Spustí Django server

Po dokončení získáte URL ve formátu `https://cognitiv.onrender.com`.

### 6. Konfigurace firmware

Upravte `include/config.h` a nastavte URL serveru:

```c
#define SERVER_URL "https://vase-sluzba.onrender.com/api/data"
```

## Lokální vývoj

### Požadavky

- [PlatformIO](https://platformio.org/) (pro nahrání firmware)
- [Python 3.11+](https://www.python.org/)
- [Node.js 18+](https://nodejs.org/)
- [MongoDB](https://www.mongodb.com/) (lokální nebo Atlas)

### Spuštění backendu

```bash
cd server
pip install -r requirements.txt
```

Vytvořte soubor `.env` nebo nastavte proměnné prostředí:

```
MONGO_URI=mongodb://localhost:27017/
MONGO_DB_NAME=cognitiv
DJANGO_SECRET_KEY=nejaky-tajny-klic
```

Spusťte server:

```bash
python manage.py runserver
```

### Spuštění frontendu

```bash
cd frontend
npm install
npm run dev
```

Dashboard bude dostupný na `http://localhost:5173`.

### Nahrání firmware

Nastavte WiFi přihlašovací údaje jako proměnné prostředí:

```bash
# Windows
set WIFI_SSID=NazevSite
set WIFI_PASSWORD=VaseHeslo

# Linux/Mac
export WIFI_SSID=NazevSite
export WIFI_PASSWORD=VaseHeslo
```

Nahrajte firmware:

```bash
pio run --target upload
```

## Konfigurace

### Firmware (`include/config.h`)

| Volba | Popis |
|-------|-------|
| `WIFI_SSID` | Název WiFi sítě (přes proměnnou prostředí) |
| `WIFI_PASSWORD` | Heslo WiFi (přes proměnnou prostředí) |
| `SERVER_URL` | URL API endpointu |
| `READING_INTERVAL_MS` | Interval měření (milisekundy) |

### Server (proměnné prostředí)

| Proměnná | Popis |
|----------|-------|
| `MONGO_URI` | MongoDB connection string |
| `MONGO_DB_NAME` | Název databáze |
| `DJANGO_SECRET_KEY` | Django secret key |
| `GEMINI_API_KEY` | API klíč pro AI asistenta |

## Struktura projektu

```
Cognitiv/
├── src/                    # Zdrojový kód firmware
│   └── main.cpp
├── include/                # Konfigurace firmware
│   └── config.h
├── server/                 # Django backend
│   ├── api/                # REST API endpointy
│   ├── cognitiv/           # Django nastavení
│   └── requirements.txt
├── frontend/               # React webová aplikace
│   └── src/
├── platformio.ini          # PlatformIO konfigurace
└── render.yaml             # Konfigurace pro Render.com
```

## Dokumentace

- [TECHNICALITIES.md](TECHNICALITIES.md) — Architektura systému a tok dat
- [CONNECTION_INFO.md](CONNECTION_INFO.md) — API endpointy a testování
- [PROJECT_SPECIFICATIONS.txt](PROJECT_SPECIFICATIONS.txt) — Kompletní technické specifikace

## 3D tištěný kryt

3D model krytu pro měřící stanici je dostupný na Printables:

https://www.printables.com/model/1516397-kryt-na-merici-stanici-cognitiv

Kryt je volně použitelný a modifikovatelný, ovšem je nutné zmínit autorství: **Matyáš Popela**.

## Stav projektu

Tento projekt je ve vývoji (work in progress). Příspěvky a zpětná vazba jsou vítány.
