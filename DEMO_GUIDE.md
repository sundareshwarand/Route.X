# RouteX — Demonstration & Viva Presentation Guide

This guide provides a structured, repeatable walkthrough for presenting the **RouteX** emergency traffic management system during college project evaluations, viva examinations, and technical project exhibitions.

---

## 1. Project Overview & Elevator Pitch (30 Seconds)

> **"RouteX is an IoT-enabled intelligent emergency traffic preemption and municipal coordination platform. It solves emergency transit delays at traffic signals by linking ambulances, intersection controllers, traffic command operators, and nearby road users into an authoritative real-time network. The system features non-preemptive all-red clearance intervals, Dijkstra corridor routing, multi-ambulance triage scheduling, and a tamper-evident SHA-256 audit ledger."**

---

## 2. System Architecture & Components

```
                   ┌────────────────────────────────────────┐
                   │    FastAPI Authoritative Backend       │
                   │  - In-Memory Simulation Engine         │
                   │  - Dijkstra Shortest Path Router       │
                   │  - Multi-Ambulance Triage Scheduler    │
                   │  - Real-Time WebSocket Push Hub        │
                   │  - Cryptographic SHA-256 Audit Ledger  │
                   └──────────────────┬─────────────────────┘
                                      │
            ┌─────────────────────────┼────────────────────────┐
            ▼                         ▼                        ▼
┌───────────────────────┐ ┌───────────────────────┐ ┌───────────────────────┐
│ React Web Dashboard   │ │ Flutter Mobile App    │ │ Physical Hardware     │
│ (Operations Command)  │ │ (Driver Companion)    │ │ (Benchtop Prototype)  │
│ - Leaflet / OSM Map   │ │ - Vector Route Canvas │ │ - ESP32 LoRa TX (433M)│
│ - Live Scenario Lab   │ │ - ETA & Transit Stepper│ │ - NodeMCU ESP8266 RX  │
│ - Incident Timeline   │ │ - 1-Tap Advisory ACK  │ │ - SSD1306 OLED Screen │
│ - Conflict Visualizer │ │ - Network Diagnostics │ │ - Boot-Safe Traffic LED│
└───────────────────────┘ └───────────────────────┘ └───────────────────────┘
```

---

## 3. Quick Start: Launching the Ecosystem

### Terminal 1: FastAPI Backend
```powershell
cd backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
- Core Endpoint: `http://localhost:8000/`
- Interactive Swagger API Documentation: `http://localhost:8000/docs`

### Terminal 2: React Operations Dashboard
```powershell
cd dashboard
npm run dev
```
- Web Operations Console: `http://localhost:5173`
- Default Operator Account: `operator@routex.org` / `operator123` (Quick-fill button available on login screen)

### Terminal 3: Flutter Mobile Companion (Web or Physical Android)
```powershell
cd mobile
flutter run -d chrome
```
- Default Driver Account: `driver1@routex.org` / `driver123` (Quick-fill button available on login screen)
- Android Release APK: `mobile/build/app/outputs/flutter-apk/app-release.apk` (51,019,868 bytes / ~48.66 MB)

---

## 4. 3–5 Minute Live Demonstration Sequence

### Step 1: Command Center Overview (0:00 – 1:00)
1. Open `http://localhost:5173` and click **Traffic Operator** to log in.
2. Highlight the **Municipal Emergency Transit Corridor Map**:
   - Point out the 5 municipal junctions (`JNC-01` Central Ave to `JNC-05` Emergency Trauma Corridor Exit) rendered over OpenStreetMap tiles (with Tactical Dark / Natural OSM palette toggle) and zero-billing architecture.
   - Point out the status strip: all 5 junctions online, Wi-Fi & LoRa mesh active, and `[SIMULATED DATA]` operational disclaimers clearly visible.

### Step 2: Scenario 1 — Standard Green Corridor Transit (1:00 – 2:00)
1. In the **Scenario Lab** toolbar, click **Execute Scenario** under **Standard Green Corridor**.
2. Observe the real-time state machine:
   - Ambulance `AMB-01` (`MEDIC-101`) begins transit from `JNC-01` towards `JNC-05` at 50 km/h.
   - As the vehicle approaches within **250 meters** of `JNC-02`, observe the junction signal transition to **FAILSAFE_ALL_RED** for 2.0 seconds (mandatory safety clearance).
   - After 2.0 seconds, the signal halo turns **PRIORITY GREEN** (`#34D399`).
   - As `AMB-01` clears the stop line, the junction cleanly reverts to **NORMAL_CYCLE** (blue/teal) and `JNC-03` initiates its clearance sequence.
3. Show the **Live Incident Timeline**: microsecond timestamps recording `DISPATCH` $\rightarrow$ `ALL_RED_CLEARANCE` $\rightarrow$ `PRIORITY_GREEN` $\rightarrow$ `JUNCTION_CLEARED` $\rightarrow$ `NORMAL_REVERSION`.

### Step 3: Scenario 2 — Multi-Ambulance Priority Contention (2:00 – 3:00)
1. In the **Scenario Lab**, click **Execute Scenario** under **Multi-Ambulance Priority Contention**.
2. Explain the operational dilemma:
   - `AMB-01` (Critical Urgency, cardiac arrest) approaches `JNC-02` from the West.
   - `AMB-02` (Urgent, trauma care) approaches `JNC-02` from the North simultaneously.
3. Show the **Multi-Ambulance Conflict Matrix**:
   - `AMB-01` is granted Priority Green.
   - `AMB-02` is buffered into the junction's clearance queue (`WAITING_FOR_CLEARANCE`).
   - Emphasize the **non-preemption safety rule**: RouteX never abruptly cuts short an active green phase.
   - When `AMB-01` clears `JNC-02`, a **2.0-second All-Red Clearance Interval** is executed before `AMB-02` receives green.

### Step 4: Scenario 3 & 4 — Resiliency & Dynamic Rerouting (3:00 – 4:00)
1. Click **Communication Loss Failsafe**:
   - Watch `JNC-03` lose heartbeat at T+15s.
   - Observe the node transition autonomously to `FAILSAFE_ALL_RED` and trigger a warning event in the timeline.
   - At T+28s, watch the autonomous watchdog re-establish gateway telemetry and return to normal 4-phase cycling.
2. Click **Dynamic Congestion & Rerouting**:
   - A simulated gridlock bottleneck occurs on link `JNC-02` $\rightarrow$ `JNC-04`.
   - The Dijkstra engine dynamically recalculates the shortest path through `JNC-03` $\rightarrow$ `JNC-05` and updates the ETA countdown in real time.

### Step 5: Hospital Receiving Network & Algorithmic Route Comparison (4:00 – 4:45)
1. On the React Dashboard, click **Hospitals & Fleet Hub**:
   - Point out the registered receiving hospitals: `HOSP-01` (City Emergency Trauma Center, 12 ICU beds, Trauma Ready) and `HOSP-02` (Metro General Hospital, 6 ICU beds).
   - In the **Route Decision Support Sandbox**, select Origin `JNC-01` and Destination `HOSP-01`.
   - Check **Simulate Bottleneck (JNC-02 -> JNC-04 4.5x delay)** and click **Evaluate Route Alternatives**.
   - Review the mathematical comparison: Standard Dijkstra vs Traffic-Weighted Dijkstra, displaying distance, ETA in seconds, time saved, and the deterministic algorithm rationale.

### Step 6: Mobile App Dispatch, Route Preview & Trip Completion (4:45 – 5:30)
1. Switch to the Flutter mobile application (Chrome or physical Android phone).
2. Tap **Request Signal Priority**:
   - Select Origin Junction (`JNC-01`) and Receiving Hospital (`HOSP-01`).
   - Observe the live **Corridor Transit Preview** card with distance and ETA countdown.
   - Tap **Transmit Emergency Priority**.
3. On the **Emergency Transit Tracker**:
   - Observe the native **Emergency Route Canvas** showing real-time vector movement and distance countdown.
   - Demonstrate the **Complete Transit (Arrived at Hospital)** button: tap to confirm arrival, releasing signal holds safely and advancing the junction queue.
4. Tap **Advisories** tab: demonstrate 1-tap acknowledgment for nearby road users.
5. Tap **Settings** tab: show the **Test Connection & Ping Server** diagnostic tool measuring live round-trip latency in milliseconds.

---

## 5. Physical Android Device Installation (Same Wi-Fi)

The standalone release APK is pre-compiled and signed with Android debug keys:
- **APK Path**: `mobile/build/app/outputs/flutter-apk/app-release.apk`
- **File Size**: `51,019,868 bytes (~48.66 MB)`
- **Build Timestamp**: Stage 16 release (incorporating Hospital Selection, Corridor Preview & Trip Completion)

### Installation Instructions
1. **Via USB (ADB)**:
   ```powershell
   adb install -r mobile/build/app/outputs/flutter-apk/app-release.apk
   ```
2. **Via Direct File Transfer**:
   - Copy `app-release.apk` to your phone via USB cable, Google Drive, or local file sharing.
   - Tap the APK file on your Android device to install (enable "Install from Unknown Sources" if prompted).

### Connecting Phone to Development PC Backend
1. Connect both your PC and Android phone to the **same Wi-Fi network**.
2. Find your PC's local IPv4 address:
   ```powershell
   ipconfig
   ```
   *Look for `IPv4 Address` under your active Wi-Fi adapter (e.g., `192.168.1.105`).*
3. Start the FastAPI backend bound to all network interfaces (`0.0.0.0`):
   ```powershell
   cd backend
   python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
   ```
4. On your Android phone, launch **RouteX**:
   - Go to **Settings** (gear icon).
   - Enter your PC's IP: `http://192.168.1.105:8000/api`
   - Tap **Save Endpoint**, then tap **Test Connection & Ping Server**.
   - When the green indicator displays `Connected (HTTP 200) • xx ms latency`, log in and operate.

---

## 6. Troubleshooting Common Issues

| Symptom | Cause | Solution |
| :--- | :--- | :--- |
| **Phone shows "Connection failed"** | PC firewall blocking port 8000 | Open Windows Defender Firewall $\rightarrow$ Allow an app $\rightarrow$ Allow Python, or run: `netsh advfirewall firewall add rule name="RouteX" dir=in action=allow protocol=TCP localport=8000` |
| **Backend not reachable from phone** | Backend started on `localhost` (127.0.0.1) only | Start backend with `--host 0.0.0.0 --port 8000` so external LAN devices can reach it. |
| **Map shows dark grid without street names** | No internet connection on PC | CartoDB tiles require internet access to fetch vector tiles. In fully offline environments, the fallback vector grid displays junction pins and route lines. |
| **Login fails with "Invalid credentials"** | Incorrect email/password | Use demo accounts: `operator@routex.org` / `operator123` or `driver1@routex.org` / `driver123`. |

---

## 7. Current Project Status & Honest Disclaimers

### Explicit Operational Distinctions

| Domain | Tested & Verified State | What Is NOT Claimed |
| :--- | :--- | :--- |
| **1. Automated Tests vs Manual Checks** | **47 pytest** automated backend tests, **9 flutter** automated tests, and **Vite production bundle build** pass cleanly in CI-style headless execution. | Manual UI user checks (clicking buttons in browser/phone) are operational demonstration steps, separate from automated deterministic assertion suites. |
| **2. Simulated vs Physical Telemetry** | In-memory physics simulation engine interpolates 50 km/h vehicle velocity, 250m approach triggers, and 2.0s all-red clearance intervals with `[SIMULATED DATA]` labels. | No live GPS satellites or real-world connected vehicles are tracked. Physical LoRa RF packets (`RSSI -65 dBm`, `SNR 9.5 dB`) are simulated in pure software mode until hardware bench hookup. |
| **3. Seeded Hospital Data vs Live EHR** | Receiving hospitals (`HOSP-01`, `HOSP-02`, `HOSP-03`), trauma designations, and ICU bed capacities are authoritative seeded database profiles (`[SEEDED PROFILES]`). | Not integrated with live hospital electronic health record (EHR) feeds or municipal bed tracking APIs. Bed counts and trauma readiness are academic profiles for route comparison. |
| **4. APK Compilation vs Device Validation** | Release APK (`mobile/build/app/outputs/flutter-apk/app-release.apk`, 51,019,868 bytes) is cleanly compiled, debug-signed, and verified on disk. | APK compilation proves syntax, binary packaging, and dependency tree resolution. Running on a physical Android handset requires manual ADB install over local Wi-Fi. |

### Technical Summary
1. **Simulation & Operations Readiness**:
   - 100% complete and verified with **47 passing backend tests** (`pytest tests/ -v`), clean Vite production build (`npm run build`), and **9 passing Flutter unit & widget tests** (`flutter test`).
   - All 4 test scenarios execute end-to-end with deterministic physics, safe clearance intervals, and real-time WebSocket auto-reconnect sync.
   - Authoritative Hospital Registry, Dijkstra vs Traffic-Weighted Route Decision Support, Trip Completion workflow, and Fleet Maintenance Controls are fully operational.
2. **Physical Hardware Status (Bench Ready)**:
   - ESP32 ambulance transmitter (`firmware/esp32_ambulance_tx`) and NodeMCU ESP8266 junction gateway (`firmware/esp8266_junction_rx`) firmware files are verified and compile cleanly.
   - Preserved without modification for future physical bench integration.
   - Physical RF range, antenna SWR, and physical propagation delay measurements require physical hardware setup with SX1278 LoRa modules.
3. **Safety Boundary**:
   - RouteX is an educational prototype and simulation platform. It must never be connected to live municipal traffic infrastructure.

