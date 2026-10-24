# RouteX — IoT-Based Intelligent Emergency Traffic Management System

[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688?style=flat&logo=fastapi)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18.3+-61DAFB?style=flat&logo=react)](https://react.dev)
[![Flutter](https://img.shields.io/badge/Flutter-3.41+-02569B?style=flat&logo=flutter)](https://flutter.dev)
[![ESP32](https://img.shields.io/badge/ESP32-LoRa%20433MHz-E7352C?style=flat)](https://espressif.com)
[![NodeMCU](https://img.shields.io/badge/NodeMCU-ESP8266-green?style=flat)](https://nodemcu.com)

RouteX is a modular emergency traffic coordination ecosystem designed to eliminate intersection delays for emergency transit. It establishes a multi-tiered architecture linking:
- **Ambulance Unit (ESP32)**: Physical 3-button unit transmitting priority directional packets over LoRa (433 MHz SX1278).
- **Traffic Junction Gateway (NodeMCU ESP8266)**: LoRa receiver, SSD1306 OLED visualizer, and prototype signal outputs with safe failover and Wi-Fi backend synchronization.
- **Backend Core (FastAPI & SQLAlchemy)**: Request lifecycle engine, multi-ambulance conflict detection, Dijkstra shortest path routing, and WebSocket push stream.
- **Operations Dashboard (React + Vite + Tailwind)**: "Midnight Command" operations console featuring real-time 4-way intersection visualizer, live priority queue, and virtual hardware testing lab.
- **Mobile Application (Flutter & Dart)**: Cross-platform application for ambulance operators (tactile direction selectors and live status tracking) and surrounding road users (advisory warnings).

---

## 1. Safety Notice & Prototype Disclaimer

> [!CAUTION]
> **RESEARCH & PROTOTYPE NOTICE**:
> RouteX is a controlled experimental traffic management prototype developed for testing with breadboard LEDs, OLED displays, and RF transceivers. 
> 
> **DO NOT** connect prototype hardware directly to real-world municipal solid-state or electro-mechanical public traffic signal controllers. Connecting experimental microcontrollers to live public roads is hazardous and violates traffic safety statutes.

---

## 2. Monorepo Structure

```
Route.X/
├── backend/                      # Python FastAPI REST & WebSocket Backend
│   ├── app/
│   │   ├── config.py             # Settings & Environment Variables
│   │   ├── database.py           # SQLAlchemy Session Engine
│   │   ├── models.py             # 10 DB Models (Users, Junctions, Requests, etc.)
│   │   ├── schemas.py            # Pydantic v2 Validation Schemas
│   │   ├── auth.py               # JWT Authentication & Password Hashing
│   │   ├── main.py               # Entrypoint & Lifespan Seeder
│   │   ├── services/
│   │   │   ├── coordination_service.py # Request Lifecycle & Conflict Detection & Dijkstra
│   │   │   ├── alert_service.py        # Nearby-Vehicle Advisory Generator
│   │   │   └── ws_manager.py           # Real-Time WebSocket Connection Manager
│   │   └── routers/              # Modular API Routers
│   └── tests/                    # 56 Pytest Automated Integration, Safety & E2E Tests
├── dashboard/                    # React 18 + Vite + Tailwind CSS Operations Web App
│   ├── src/
│   │   ├── components/
│   │   │   ├── Overview.jsx              # Metrics & KPI Dashboard
│   │   │   ├── IntersectionVisualizer.jsx# Interactive SVG 4-Way Signal Visualizer
│   │   │   ├── ActiveRequests.jsx        # Live Request Queue & Operator Override
│   │   │   ├── JunctionMonitoring.jsx    # Fleet Telemetry & RSSI / Uptime
│   │   │   ├── RoutePlanner.jsx          # Dijkstra Shortest-Path Calculator
│   │   │   ├── NearbyVehicleAlerts.jsx   # Road User Advisory Feed & Test Dispatcher
│   │   │   ├── DiagnosticsTesting.jsx    # Virtual Hardware Lab (Simulates LoRa & ESP8266)
│   │   │   ├── AnalyticsReports.jsx      # Metrics Breakdown & JSON Audit Export
│   │   │   └── SystemSettings.jsx        # Backend Endpoint & Session Controls
│   │   └── App.jsx                       # Main Operations Shell
├── mobile/                       # Flutter Cross-Platform Mobile Application
│   ├── lib/
│   │   ├── theme/app_theme.dart  # Midnight Command UI System Palette
│   │   ├── services/api_service.dart # HTTP REST Client & SharedPreferences Token
│   │   ├── models/               # Request, Junction, Alert & User Models
│   │   ├── screens/
│   │   │   ├── splash_screen.dart        # RouteX Branding & Auth Check
│   │   │   ├── login_screen.dart         # Role-Aware Sign-In with Demo Fast-Fill
│   │   │   ├── driver_home_screen.dart   # Driver Hub & Emergency Priority Action
│   │   │   ├── request_form_screen.dart  # Oversized Tactile Direction Buttons (LEFT/STR/RIGHT)
│   │   │   ├── request_tracking_screen.dart # Live Stepper & Priority Countdown
│   │   │   ├── request_history_screen.dart  # Historical Transit Logs
│   │   │   ├── nearby_alerts_screen.dart    # Road-User Test Advisory Feed
│   │   │   ├── connection_status_screen.dart# Backend Ping & Gateway Reachability
│   │   │   └── settings_screen.dart      # Server Configuration & Logout
├── firmware/                     # Microcontroller Source Code (Arduino C++)
│   ├── ambulance_esp32/
│   │   └── ambulance_esp32.ino   # ESP32 3-Button Transmitter with CRC16
│   └── junction_esp8266/
│       └── junction_esp8266.ino  # NodeMCU HSPI Receiver + OLED + Boot-Safe LEDs
├── docs/
│   ├── hardware_wiring.md        # Complete Pinout & ESP8266 Conflict Resolution
│   └── api_spec.md               # REST & WebSocket API Documentation
├── .env.example                  # Environment Configuration Template
└── README.md                     # Documentation & Setup Guide
```

---

## 3. Quick Start & Execution Guide

### 3.1 Backend Setup & Execution
Requirements: Python 3.10+ (Verified on Python 3.12.10)

```powershell
# 1. Navigate to backend directory
cd backend

# 2. Install dependencies
pip install -r requirements.txt

# 3. Run automated test suite (14 Integration Scenarios)
python -m pytest tests -v

# 4. Start the backend development server
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
API Documentation will be live at: `http://localhost:8000/docs`

---

### 3.2 Operations Dashboard Setup & Execution
Requirements: Node.js 18+ (Verified on Node v24.13.1 / npm 11.8.0)

```powershell
# 1. Navigate to dashboard directory
cd dashboard

# 2. Install dependencies
npm install

# 3. Verify production build
npm run build

# 4. Launch Vite development server
npm run dev
```
Dashboard will be live at: `http://localhost:5173`

---

### 3.3 Flutter Mobile Application Setup & Execution (Mobile-App-Only Workflow)
Requirements: Flutter 3.20+ (Verified on Flutter 3.41.1 / Dart 3.11.0)

> [!NOTE]
> **Mobile-App-Only Workflow**:
> The RouteX Flutter mobile app is completely operational as a standalone client connecting to the FastAPI backend. You **do not** need physical ESP32, ESP8266, LoRa modules, OLED displays, or external traffic light LEDs connected to test or operate the mobile application.

```powershell
# 1. Navigate to mobile directory
cd mobile

# 2. Retrieve packages
flutter pub get

# 3. Verify static analysis (0 issues)
flutter analyze

# 4. Run automated test suite (6 passing tests)
flutter test

# 5. Launch mobile app on your desired target:
# Option A: Web Browser
flutter run -d chrome

# Option B: Windows Desktop
flutter run -d windows

# Option C: Connected Android Phone (via USB or Wi-Fi)
flutter run -d <device-id>
```

#### How to Test on a Physical Android Phone
1. **Launch the backend accessible to your local network**:
   ```powershell
   cd backend
   python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
   ```
2. **Connect your Android phone**:
   - Enable **Developer Options** and **USB Debugging** on the Android device.
   - Plug the phone into your PC via USB.
3. **Route network traffic (Choose Method A or B)**:
   - **Method A (ADB Port Reverse - Recommended)**:
     ```powershell
     adb reverse tcp:8000 tcp:8000
     ```
     In the app login screen, tap the ⚙️ icon and set URL to: `http://127.0.0.1:8000/api` (or `http://10.0.2.2:8000/api` for emulators).
   - **Method B (Local Wi-Fi Network)**:
     Ensure your phone and PC are connected to the same Wi-Fi network. Find your PC's IP (`ipconfig`, e.g., `192.168.1.100`). In the app, tap the ⚙️ icon and set URL to: `http://192.168.1.100:8000/api`.
4. **Build and install**:
   ```powershell
   cd mobile
   flutter run
   ```

---

### 3.4 Flashing Microcontroller Firmware
Install the Arduino IDE or PlatformIO:
- Install board packages: **esp32** by Espressif and **esp8266** by ESP8266 Community.
- Install libraries via Library Manager:
  - `LoRa` by Sandeep Mistry
  - `ArduinoJson` by Benoit Blanchon (v6 or v7)
  - `Adafruit SSD1306` & `Adafruit GFX Library`
- Open `firmware/ambulance_esp32/ambulance_esp32.ino` and upload to ESP32 DevKit v1.
- Open `firmware/junction_esp8266/junction_esp8266.ino`, update `WIFI_SSID`, `WIFI_PASSWORD`, and `BACKEND_HOST`, and upload to NodeMCU.

---

## 8. Cloud Integrations: Google Maps Platform & Google Gemini AI

RouteX integrates **Google Maps Platform** and **Google Gemini 2.5 Flash** to provide high-detail GIS corridor surveillance and explainable transit debriefs. Both cloud integrations are architected to fail safe: RouteX runs completely and immediately with its built-in interactive SVG vector canvas and deterministic rule engine if cloud credentials are absent or network connectivity drops.

### 8.1 Google Maps Platform Integration

- **SDK Loader**: `@googlemaps/js-api-loader` (Official Google Maps JavaScript API).
- **Arterial Visual Theme**: Custom **Midnight Obsidian** palette optimized for emergency operations consoles.
- **7 Explicit Map States Handled**:
  1. `CONFIGURED AND LOADED`: High-resolution vector map with live junction, hospital, and ambulance pins.
  2. `LOADING`: Pulse radar animation during SDK initialisation.
  3. `MISSING KEY`: Automatic transition to high-precision SVG vector canvas with setup instructions.
  4. `INVALID KEY OR API NOT ENABLED`: Detects `gm_authFailure` and displays Google Cloud Console activation guide.
  5. `BILLING/QUOTA ERROR`: Informative banner with quota tips.
  6. `NO JUNCTION COORDINATES`: Empty state handling with seeding instructions.
  7. `MAP LOAD FAILED`: Network failure handling with retry trigger.
- **Setup Instructions**:
  Create or edit `dashboard/.env.local`:
  ```bash
  VITE_GOOGLE_MAPS_API_KEY=AIzaSy...your_actual_key_here
  ```
  *(Note: `.env.local` is automatically excluded from version control).*

### 8.2 Google Gemini AI Advisory Integration

- **Model**: `gemini-2.5-flash` via the official `google-genai` Python SDK.
- **Strict Advisory Safety Invariant**: AI outputs are strictly supplementary. The AI model **never** actuates traffic hardware, never modifies the mandatory 2.0-second all-red clearance interval, and never overrides the deterministic Dijkstra graph or conflict matrix.
- **Endpoints**:
  - `GET /api/ai/status`: Public configuration state (does not leak keys).
  - `POST /api/ai/explain-route`: Plain-language explanation of corridor path selection and bottleneck avoidance.
  - `POST /api/ai/incident-summary`: Structured post-transit debrief and audit observations.
- **Deterministic Fallback**: If `GEMINI_API_KEY` is unset or authentication fails (e.g. 401 unauthenticated), RouteX transparently returns rule-based operational summaries without interrupting dispatch operations.
- **Setup Instructions**:
  Run the interactive PowerShell helper:
  ```powershell
  powershell -ExecutionPolicy Bypass -File "scripts\setup_routex_gemini.ps1"
  ```
  Or add directly to `backend/.env`:
  ```bash
  GEMINI_API_KEY=your_gemini_api_key_from_google_ai_studio
  ```

---

## 9. Verification & Automated Test Suites

- **Backend Pytest Suite**: 54 automated integration and unit tests covering authentication, Dijkstra routing, conflict resolution, LoRa packet validation, hospital registries, simulation scenarios, and AI fallbacks:
  ```powershell
  python -m pytest backend/tests/ -o pythonpath=backend -v
  ```
- **Frontend Production Build**: Zero-warning Vite production build:
  ```powershell
  npm --prefix dashboard run build
  ```


The backend automatically creates default demo users upon startup:

| Role | Email | Password | Access Level |
|:---|:---|:---|:---|
| **Traffic Operator** | `operator@routex.org` | `operator123` | Full dashboard operations, manual overrides |
| **System Admin** | `admin@routex.org` | `admin123` | Full administrative permissions |
| **Ambulance Driver** | `driver1@routex.org` | `driver123` | Mobile app priority dispatch, status tracking |
| **Citizen Road User** | `citizen@routex.org` | `citizen123` | Advisory nearby-vehicle alert view |

---

## 5. Hardware Wiring & Boot-Safe Conflict Resolution

For full wiring schematics and circuit diagrams, see [docs/hardware_wiring.md](docs/hardware_wiring.md).

### ESP8266 NodeMCU Conflict-Free Pin Table

| Pin | Function | Electrical Circuit & Boot Safety Rationale |
|:---|:---|:---|
| **GPIO 14 (D5)** | LoRa `SCK` | Hardware HSPI Clock |
| **GPIO 12 (D6)** | LoRa `MISO` | Hardware HSPI Data |
| **GPIO 13 (D7)** | LoRa `MOSI` | Hardware HSPI Data |
| **GPIO 16 (D0)** | LoRa `NSS` (CS) | Hardware HSPI Chip Select (Neutral at boot) |
| **GPIO 4 (D2)** | SSD1306 OLED `SDA` | I2C Data line |
| **GPIO 5 (D1)** | SSD1306 OLED `SCL` | I2C Clock line |
| **GPIO 15 (D8)** | Normal Red LED | **Active-HIGH** (Must be LOW at boot -> Wired through 330 Ω to GND) |
| **GPIO 0 (D3)** | Normal Green LED | **Active-LOW** (Must be HIGH at boot -> Wired Anode to 3.3V through 330 Ω) |
| **GPIO 2 (D4)** | Emergency Priority Green LED | **Active-LOW** (Must be HIGH at boot -> Wired Anode to 3.3V through 330 Ω) |

---

## 6. Request Lifecycle & Safety State Machine

RouteX enforces validated state progression. Status never advances to `RECEIVED` or `PRIORITY_ACTIVE` without verified controller acknowledgments:

```
[Driver / LoRa Request] 
          │
          ▼
     ( PENDING ) ──[Cancellation]──> ( CANCELLED )
          │
  [NodeMCU Poll / LoRa RX]
          │
          ▼
     ( RECEIVED ) ──[Timeout / Expire]──> ( EXPIRED )
          │
  [Hardware GPIO Confirmed Active]
          │
          ▼
  ( PRIORITY_ACTIVE ) ──[Operator Override]──> ( CANCELLED )
          │
  [Priority Interval Finished / Safe Reversion]
          │
          ▼
    ( COMPLETED )
```

---

## 7. Feature Implementation Status Matrix

### ✅ Implemented & Verified Working Features
- **FastAPI Backend Core**: JWT authentication, role guards, SQLite persistence with dynamic migration, and CORS middleware.
- **Request Lifecycle State Engine**: Validated state progression (`PENDING` -> `RECEIVED` -> `PRIORITY_ACTIVE` -> `COMPLETED`/`CANCELLED`/`EXPIRED`).
- **Duplicate & Malformed Packet Prevention**: Cryptographic message hashing, sequence number validation, and CRC16 rejection.
- **Nearby-Vehicle Alert System**:
  - Zone subscriptions (`/api/alerts/subscribe`), recipient delivery status tracking, and receipt confirmations (`/api/alerts/{id}/acknowledge`).
  - Coordinate proximity evaluation using the Haversine formula against simulated GPS coordinates (`/api/alerts/proximity-check`).
  - Mobile Road User advisory screen with interactive receipt confirmation badge.
  - Delivery retry handling and failure tracking.
- **Multi-Ambulance Conflict Management**:
  - Three-tier triage priority scoring: `CRITICAL` (weight 300), `URGENT` (weight 200), and `STANDARD` (weight 100) integrated into request submission and priority queue calculations.
  - Estimated arrival time (`estimated_arrival_seconds`) factoring into priority ordering.
  - Strict safe non-preemptive clearance intervals: active priority green phases cannot be aborted without a safe clearance sequence, including yellow and all-red transitions (`clearance_seconds`).
  - Transparent scheduling rationale recording (`scheduling_reason`) stored and displayed on dashboard and mobile tracking screens.
  - Live priority queue inspection (`GET /api/emergency/junction/{id}/queue`) and operator queue reordering (`POST /api/emergency/junction/{id}/queue/reorder`).
  - Separation of concerns: Dijkstra shortest-path route planning remains strictly decoupled from localized junction signal scheduling.
- **Communication Reliability Monitor**:
  - Comprehensive telemetry endpoint (`/api/reliability/summary` and `/api/reliability/junction/{id}`) computing:
    - Packet Delivery Rate (PDR) over a 24-hour window.
    - CRC error rejection count and duplicate frame count.
    - Average round-trip acknowledgment latency (ms).
    - Average RSSI (dBm) and SNR (dB).
    - Gateway heartbeat freshness and online/offline status.
  - Operations Dashboard "Reliability Monitor" panel with live RF telemetry gauges, frame statistics breakdown, and hardware vs. simulated stream distinction badges.
- **Evidence-Based Response Analytics & Cryptographic Audit Ledger**:
  - Direct incident response metrics CSV export (`GET /api/analytics/export/csv`).
  - Tamper-evident cryptographic audit ledger (`AuditLedgerEntry`) using SHA-256 hash chaining:
    - Each lifecycle event links cryptographically to the preceding entry's hash `sha256(prev_hash + sequence_number + action + entity_id + payload_hash + timestamp)`.
    - Live cryptographic verification endpoint (`GET /api/analytics/audit-ledger/verify`) validating sequence monotonicity and chain integrity.
    - Dashboard Audit Ledger viewer with instant verification inspector.
- **React Operations Dashboard**: "Midnight Command" UI, interactive SVG 4-way intersection visualizer, live priority queue with triage badges, RF reliability telemetry, and virtual hardware testing lab.
- **Flutter Mobile Application**: Tactile oversized LEFT, STRAIGHT, RIGHT direction controls, three-tier patient triage selector, live tracking with clearance rationale banner, citizen alert feed with ACK button, and connection diagnostics.
- **Microcontroller Firmware**: ESP32 button transmitter with debouncing and CRC16; NodeMCU ESP8266 receiver with OLED UI, boot-safe GPIO outputs, Wi-Fi reconnection, and watchdog feeding.
- **Automated Test Suite**: 27 backend pytest integration tests (100% pass rate) + Flutter widget test + 0-issue Flutter static analysis + clean Vite production build.

### ⚠️ Simulated & Test-Zone Features (Clearly Disclosed)
- **Nearby-Vehicle Alerts**: Advisory notifications dispatched to test zones (`ZONE-CENTRAL`, `ZONE-HOSPITAL`, etc.) and proximity tests evaluate simulated coordinates. Advisories are clearly labelled as **SIMULATED TEST ADVISORY** informing road users to yield safely; they do not represent real-time consumer vehicle detection or direct V2X telematics until certified onboard units are integrated.
- **GPS Coordinates**: Junction coordinates are statically mapped for demonstration rather than dynamic cellular GNSS streams.

### 🔮 Future Expansion (Phase B & C)
- **Cellular GNSS / Dynamic Geofencing**: Tracking active ambulance coordinates along transit corridors to dynamically broadcast advisories only to road users within 500 meters of the vehicle vector.
- **Standardized V2X / DSRC Integration**: Direct broadcast to dedicated connected vehicle onboard units (OBUs) following IEEE 802.11p / C-V2X standards.
- **Multi-Junction Green Wave Synchronization**: Dynamic multi-junction coordination triggering green waves along the entire Dijkstra-computed corridor ahead of the vehicle.

---

## 8. End-to-End Verification & Integration Test Report

### 8.1 Automated Test Execution Summary
- **Backend Pytest (`backend/tests/test_api.py`)**:
  - Ran 27 automated integration tests: **27 PASSED in 6.12s (100% success rate)**.
  - Verified Scenarios:
    1. Authentication & JWT Token Validation
    2. Invalid Login & Credential Rejection (401)
    3. Dijkstra Shortest-Path Graph Computation
    4. Mobile Request Lifecycle Flow (`PENDING` -> `RECEIVED` -> `PRIORITY_ACTIVE` -> `COMPLETED`)
    5. LoRa Packet Handling for LEFT approach
    6. LoRa Packet Handling for STRAIGHT approach
    7. LoRa Packet Handling for RIGHT approach
    8. Malformed Packet Rejection (CRC Failure -> 422)
    9. Duplicate Packet Detection & Active-Window Filter
    10. Conflicting Emergency Requests & Multi-Ambulance Queue Ordering
    11. Driver Request Cancellation & Safe Recovery
    12. NodeMCU Gateway Heartbeat & Online State Detection
    13. Advisory Nearby-Vehicle Alert Dispatch & Zone Expiry
    14. Analytics Summary Calculation & Full JSON Report Export
    15. Invalid Direction Rejection (`DIAGONAL_FLY` -> 422)
    16. Nonexistent Ambulance and Junction 404 Rejection
    17. Unauthorized Role Access Rejection (401)
    18. Request Command TTL Expiry & Automatic Signal Reversion
    19. Client Zone Subscription & Alert Delivery Acknowledgment Flow
    20. Haversine Proximity Check with Valid Simulated Coordinates
    21. Multi-Ambulance Urgency Triage & Queue Scheduling with Non-Preemption
    22. Manual Operator Queue Reordering & Audit Logging
    23. Communication Reliability Monitor (PDR, CRC errors, ACK latency, freshness)
    24. Incident Response CSV Export & SHA-256 Cryptographic Audit Ledger Verification
    25. Alert Delivery Retries, Retry Increment, and Automatic Transition to FAILED
    26. Analytics CSV Export Filters (Ambulance, Junction) & Missing Data Handling
    27. Tamper-Evident Audit Ledger Corruption & Mathematical Tamper Detection
- **Dashboard Production Build (`dashboard/`)**:
  - `npm run build`: Succeeded in **3.52s** (0 errors).
- **Flutter Mobile Analysis & Unit Tests (`mobile/`)**:
  - `flutter analyze`: **No issues found!** (0 errors, 0 warnings).
  - `flutter test`: **All 6 tests passed!** (App smoke test + JSON serialization tests for requests, routes, reliability, analytics, and audit ledger).

---

## 9. Stage 17: Final Acceptance, Release APK & Demonstration Readiness Matrix

### Core Component Verification Status

| Subsystem / Domain | Status | Scope & Evidence | Notes / Unresolved Items |
| :--- | :---: | :--- | :--- |
| **1. Automated Verification** | **PASS (100%)** | 47/47 pytest integration and E2E tests pass in 4.96s.<br>Vite React production build succeeds in 2.26s.<br>Flutter static analysis: 0 issues; 9 unit & widget tests pass. | Fully repeatable in local CI/CD environment with 0 regressions. |
| **2. Android Release APK** | **BUILT (48.66 MB)** | `flutter build apk --release` compiled cleanly.<br>Path: `mobile/build/app/outputs/flutter-apk/app-release.apk` (51,019,868 bytes).<br>Uses debug signing config for instant evaluation without certificate barriers. | Ready for installation on physical Android devices via ADB or direct transfer. |
| **3. Simulation & Scenario Lab** | **PASS** | Authoritative in-memory simulation engine (`/api/simulation/*`).<br>4 operational test scenarios (Standard Corridor, Multi-Ambulance Conflict, Comm Loss Failsafe, Gridlock Congestion).<br>Deterministic waypoint interpolation and safe 2s all-red clearance intervals.<br>Live asynchronous background ticker auto-broadcasts updates via WebSockets with automatic client reconnect. | Real-time continuous coordination across web dashboard and mobile app with identical authoritative state. |
| **4. Hospital Network & Fleet Controls** | **PASS** | Authoritative Hospital Registry with trauma readiness status and ICU bed capacity meters.<br>Dijkstra Shortest Path vs Congestion-Weighted route comparison engine.<br>Ambulance fleet status tracking (`IDLE`, `EN_ROUTE`, `MAINTENANCE`) and trip completion workflow. | Seeded demonstration registry with explicit disclosures; live operator status controls. |
| **5. Physical Hardware Compatibility** | **BENCH READY** | Firmware preserved for ESP32 and ESP8266 without changes.<br>Hardware API contracts backwards-compatible with physical LoRa packets. | Mobile-app-only & web dashboard workflow requires zero physical hardware attached. Physical Android device and benchtop LoRa hardware validation remain pending physical bench hookup. |

### Explicit Operational Distinctions

1. **Automated Tests vs Manual UI Checks**: 47 pytest tests, 9 Flutter tests, and the Vite production build execute in headless automated environments with deterministic assertions. Interactive browser/mobile user interactions are manual demo steps.
2. **Simulated Telemetry vs Physical Hardware**: All ambulance vehicle movements, GPS waypoints, signal preemption triggers, and RF metrics (`RSSI -65 dBm`, `SNR 9.5 dB`) are generated by the software simulation engine. No physical LoRa modules or live GPS receivers are connected.
3. **Seeded Hospital Data vs Live Municipal Telemetry**: Registered facilities (`HOSP-01` to `HOSP-03`) represent seeded academic demonstration profiles for route comparison; they are not live hospital electronic health record feeds.
4. **APK Compilation vs Physical Handset Validation**: Compilation of `app-release.apk` (51,019,868 bytes) proves successful compilation, tree-shaking, and manifest permissions (`INTERNET`, `cleartextTraffic`). Physical execution on a handheld device requires manual side-loading over Wi-Fi.

> [!TIP]
> For a complete 3–5 minute viva presentation sequence, Wi-Fi LAN pairing instructions for physical Android phones, and step-by-step scenario demonstrations, see the dedicated [DEMO_GUIDE.md](file:///c:/Users/Sundareshwaran/Desktop/Route.X/DEMO_GUIDE.md).

---

## 10. Tabletop Hardware Test Checklist & Demonstration Procedure

> [!CAUTION]
> **PRE-POWER-ON BENCH SAFETY CHECKLIST**:
> 1. **Antenna Connection**: Ensure 433 MHz helical/SMA antennas are firmly screwed into both SX1278 modules **BEFORE** powering up to prevent damage to RF power amplifier stages.
> 2. **Voltage Rails**: Verify with a digital multimeter that `VCC` supplied to the SX1278 is strictly **3.3V DC** (never connect to 5V; SX1278 is not 5V-tolerant).
> 3. **Boot Strapping Resistors (NodeMCU)**:
>    - `GPIO 15 (D8)`: Verify pull-down through 330 Ω resistor to GND (must read < 0.5V at boot).
>    - `GPIO 0 (D3)`: Verify pull-up through 330 Ω resistor to 3.3V (must read > 2.8V at boot).
>    - `GPIO 2 (D4)`: Verify pull-up through 330 Ω resistor to 3.3V (must read > 2.8V at boot).
> 4. **Isolation**: RouteX is strictly a benchtop laboratory demonstration. **DO NOT connect to public traffic controllers.**

### Phase 1: Virtual Hardware Simulation (No physical hardware required)
1. Launch the FastAPI backend:
   ```powershell
   cd backend && python -m uvicorn app.main:app --port 8000 --reload
   ```
2. Launch the Operations Dashboard:
   ```powershell
   cd dashboard && npm run dev
   ```
3. Open `http://localhost:5173` and click **Traffic Operator** to log in.
4. Go to **Virtual Hardware Lab**:
   - Under *Virtual ESP32 Ambulance Transmitter*, select Ambulance `AMB-01` and target junction `JNC-01`.
   - Click the physical-style button **STRAIGHT**.
   - Observe the live LoRa packet with CRC16 logged in the console.
5. Under *Virtual NodeMCU ESP8266 Gateway*:
   - Click **1. Poll Pending Queue**: Observe the command retrieved by the gateway.
   - Click **2. ACK Priority Active**: Observe the signal outputs switch to Priority Active.
6. Switch to the **Operations Overview** tab:
   - Observe the interactive 4-way intersection visualizer: South approach lights switch to Priority Green, emergency vehicle icon illuminates, and the countdown timer begins!

### Phase 2: Mobile App-to-Dashboard Transit
1. Run Flutter Mobile (`flutter run -d chrome` or on Android).
2. Click **Ambulance Driver** to log in.
3. Tap **REQUEST SIGNAL PRIORITY**, select target junction `JNC-01`, select triage level **URGENT**, and tap the oversized **LEFT** tactile button.
4. Observe the mobile screen enter the live transit tracker with real-time stepper (`PENDING` -> `RECEIVED`).
5. Observe the dashboard immediately show the active emergency request with urgency triage badge and scheduling rationale banner.

### Phase 3: Physical Microcontroller LoRa Verification (Bench Hardware)
1. Connect ESP32 Ambulance Unit via USB and open Serial Monitor at 115200 baud.
2. Press the physical **STRAIGHT** button on breadboard (`GPIO 33`).
3. Observe Serial output confirming LoRa transmission with CRC16 and sequence increment.
4. On the NodeMCU ESP8266 unit:
   - Observe the SSD1306 OLED display immediately update to show: `PRIORITY ACTIVE: 20s`, `AMB-01`, `DIRECTION: STRAIGHT`.
   - Observe the Emergency Priority Green LED (`GPIO 2`) illuminate.
   - Observe the Normal Green LED (`GPIO 0`) extinguish.
5. In the Web Dashboard: observe the live request appear labeled as **HW VERIFIED**.
6. On the Reliability Monitor tab: observe physical RF telemetry displaying live RSSI (e.g. `-65 dBm`), SNR (e.g. `9.2 dB`), and `ESP32+ESP8266 PHYSICAL RF` stream badge.
7. Wait 20 seconds without transmitting:
   - Observe the NodeMCU safely extinguish the Priority Green LED and re-illuminate the Normal Green LED.
   - Observe the OLED display return to `STATE: NORMAL CYCLE`.
   - Observe the Web Dashboard mark the transit as **COMPLETED**.

