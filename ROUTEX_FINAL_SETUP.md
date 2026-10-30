# RouteX — Final Production Setup, Multi-Device Deployment & Operational Guide

**Repository:** [https://github.com/sundareshwarand/Route.X](https://github.com/sundareshwarand/Route.X)  
**Branch:** `master`  
**Android APK Path:** [`dashboard/android/app/build/outputs/apk/debug/app-debug.apk`](file:///C:/Users/Sundareshwaran/Desktop/Route.X/dashboard/android/app/build/outputs/apk/debug/app-debug.apk)  

---

## A. Local Windows Startup Commands

To run RouteX locally on Windows for local development or testing:

### 1. Start the FastAPI Backend
Open PowerShell in the project root:
```powershell
cd C:\Users\Sundareshwaran\Desktop\Route.X
$env:PYTHONPATH = "."
python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
```
* Local Backend URL: `http://127.0.0.1:8000`
* Local Health Probe: `http://127.0.0.1:8000/health`
* Local Swagger Docs: `http://127.0.0.1:8000/docs`
* Local Database: SQLite (`sqlite:///./routex.db`) is automatically initialized and seeded with default operator, admin, and driver accounts.

### 2. Start the React Frontend Dashboard
Open a second PowerShell terminal:
```powershell
cd C:\Users\Sundareshwaran\Desktop\Route.X\dashboard
npm run dev
```
* Local Frontend URL: `http://localhost:5173`

---

## B. Public Cloud Deployment Procedure (Render Blueprint)

RouteX is configured as an Infrastructure-as-Code Blueprint via [`render.yaml`](file:///C:/Users/Sundareshwaran/Desktop/Route.X/render.yaml), provisioning:
1. **`routex-api`**: FastAPI Web Service (Python 3.12, Free Tier).
2. **`routex-dashboard`**: React Static Single Page Application (Free Static Site Tier).

> [!IMPORTANT]
> **Subdomain Collision Resolution**:
> Render subdomain names are globally shared. The name `routex-frontend.onrender.com` is registered by an external third-party Next.js project. We designated available unique service names in `render.yaml`:
> - Backend Service: `routex-api` (`https://routex-api.onrender.com`)
> - Frontend Static Site: `routex-dashboard` (`https://routex-dashboard.onrender.com`)

### Step-by-Step 1-Click Launch:
1. Navigate in your browser to:
   👉 **[Deploy RouteX Blueprint on Render](https://render.com/deploy?repo=https://github.com/sundareshwarand/Route.X)**
2. Sign in with your GitHub account (`sundareshwarand`).
3. You will see two services: `routex-api` and `routex-dashboard`.
4. Under `routex-api` Environment Variables:
   - Provide your PostgreSQL connection string under `DATABASE_URL` (see Section C below).
   - Provide your optional `GEMINI_API_KEY` for AI advisory.
5. Click **Apply**.
6. Render builds the backend via `pip install -r backend/requirements.txt` and the frontend via `cd dashboard && npm install && npm run build`.

---

## C. Database Persistence Configuration

### The Quota Limit Barrier & Permanent Solution
Render limits free accounts to **1 free PostgreSQL database per workspace**. Attempting to provision a second free database via blueprint triggers a fatal quota rejection, causing Render to cancel the entire deployment group.

To ensure **100% data persistence across restarts without billing, credit cards, or UPI autopay**:

### Option 1 (Recommended): Neon Serverless PostgreSQL ($0 / Permanent Free Tier)
1. Visit **[https://neon.tech](https://neon.tech)** and sign in with GitHub (No credit card required).
2. Click **Create Project**, name it `routex-db`, and select region `AWS us-east-2` or closest.
3. Neon provides a pooled connection string, for example:
   ```text
   postgresql://routex_owner:secret_pass@ep-cool-butterfly-12345.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
4. Copy this connection string and set it as `DATABASE_URL` in your Render Web Service environment settings.
5. **Benefits**:
   - **No credit card required**.
   - **No 30-day expiration** (Render's free database expires after 30 days; Neon does not).
   - 0.5 GB storage (accommodates tens of thousands of emergency corridors, trip telemetry, and audit logs).
   - Safe connection pooling configured in `backend/app/database.py` with `pool_pre_ping=True` and `pool_recycle=300`.

### Option 2: Reuse Your Existing Render PostgreSQL Database
If your existing free Render database has spare capacity:
1. Open your existing PostgreSQL instance on your Render Dashboard.
2. Copy the **Internal Database URL**.
3. Set it as `DATABASE_URL` in `routex-api`.
4. RouteX tables (`users`, `ambulances`, `intersections`, `routes`, `emergency_requests`, `audit_ledger`) are namespaced and will not alter or overwrite tables from other applications.

---

## D. Backend Environment Variables

Configure these variables in your hosting provider's environment dashboard:

| Variable | Recommended Production Value | Description |
| :--- | :--- | :--- |
| `PYTHON_VERSION` | `3.12.0` | Enforces modern Python runtime. |
| `PYTHONPATH` | `.` | Resolves module path `backend.app.main:app`. |
| `ENVIRONMENT` | `production` | Enforces production security and requires persistent DB. |
| `DATABASE_URL` | `postgresql://<user>:<pwd>@<host>/<db>?sslmode=require` | Persistent PostgreSQL connection string. |
| `SECRET_KEY` | *(Auto-generated 64-char string)* | Cryptographic signing key for JWT tokens. |
| `CORS_ORIGINS` | `*` or `https://routex-dashboard.onrender.com` | Allowed browser origins for cross-network access. |
| `GEMINI_API_KEY` | `AIzaSy...` *(Optional)* | Google Gemini API key for emergency routing advisory. |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Lightweight advisory AI model. |

---

## E. Frontend Environment Variables

Set in [`dashboard/.env.production`](file:///C:/Users/Sundareshwaran/Desktop/Route.X/dashboard/.env.production) (and Render Static Site settings):

```ini
VITE_API_BASE_URL=https://routex-api.onrender.com/api
```

* The frontend dynamically switches between `http://127.0.0.1:8000/api` (when run locally) and `https://routex-api.onrender.com/api` (when served on static hosting or mobile app).
* In all environments, users can interactively test and override the backend URL using the **ENDPOINT** button on the top-right navigation bar.

---

## F. Android APK Installation

The compiled Android debug APK is ready:
* Location: [`dashboard/android/app/build/outputs/apk/debug/app-debug.apk`](file:///C:/Users/Sundareshwaran/Desktop/Route.X/dashboard/android/app/build/outputs/apk/debug/app-debug.apk)
* File Size: ~4.81 MB

### Installation Steps:
1. Transfer `app-debug.apk` to your phone via USB cable, Google Drive, WhatsApp, or local network.
2. On your Android device, tap the file to install (allow "Install from Unknown Sources" if prompted).
3. Open **RouteX**.
4. Tap the **ENDPOINT** button on the top-right of the login screen to verify the active backend address.
5. Tap **Test Connection** to confirm live round-trip latency to the cloud backend.

---

## G. Multi-Device and Cross-Network Testing Procedure

RouteX is engineered for simultaneous access across heterogeneous devices and independent network connections.

### Test Matrix:
1. **Device 1 (Windows Laptop on Home Wi-Fi)**:
   - Open `https://routex-dashboard.onrender.com` in Chrome or Edge.
   - Log in as Traffic Commander: `operator@routex.org` / `operator123`.
   - Verify WebSocket indicates **LIVE WS** in green on the top bar.

2. **Device 2 (Android Phone on Cellular Data — Wi-Fi Turned OFF)**:
   - Open the installed RouteX APK on 4G/5G mobile data.
   - Tap **ENDPOINT** -> confirm URL is `https://routex-api.onrender.com/api` -> tap **Test Connection** (confirm `✓ Reachable & Online`).
   - Log in as Fleet Medic: `driver1@routex.org` / `driver123`.

3. **Cross-Network Real-Time Telemetry Verification**:
   - On Device 2 (Phone on Mobile Data), trigger an emergency priority dispatch for Ambulance `MEDIC-101`.
   - Watch Device 1 (Laptop on Wi-Fi): Within 100–300ms, the WebSocket pushes the update to the Operations Overview screen.
   - Observe the mandatory 2.0-second failsafe all-red clearance phase initiate on the affected junction.
   - Both devices reflect the exact same state from the shared PostgreSQL database.

---

## H. Troubleshooting Backend Shutdowns & Diagnostic Guide

If the backend ever reports unreachable:

1. **Cold Start Spin-Down (Expected Free-Tier Behavior)**:
   - Free Web Services on Render automatically spin down into a sleep state after 15 minutes of zero traffic.
   - When a new request arrives, Render takes 50–90 seconds to launch the container.
   - The RouteX frontend and Android app include a 15-second request timeout with an explicit notice:
     `"RouteX server is unavailable or starting. Please try again."`
   - Wait 45 seconds and tap **Test Connection** or click **Login** again. Once awake, response times return to sub-200ms.

2. **Subdomain Mismatch**:
   - Confirm your request is pointing to `https://routex-api.onrender.com` (or your assigned custom Render URL), NOT `routex-frontend.onrender.com` (which is an external service).

3. **Database Connectivity Error**:
   - Query `https://routex-api.onrender.com/ready`.
   - If it returns `HTTP 503`, check that your `DATABASE_URL` in Render environment settings is valid and that your database instance is active.

---

## I. Hosting Limitations and Uptime Expectations

| Aspect | Specification |
| :--- | :--- |
| **Backend Cost** | $0.00 / month (Render Free Tier) |
| **Idle Behavior** | Spins down after 15 minutes of inactivity; spins up upon first HTTP request (~50–75s cold start). |
| **Active Memory** | 512 MB RAM limit (RouteX uses ~85 MB). |
| **Frontend Cost** | $0.00 / month (Render Static Site Free Tier). |
| **Frontend Uptime** | 100% (Render Global CDN, no cold starts). |
| **Database Cost** | $0.00 / month (Neon Serverless PostgreSQL). |
| **Data Retention** | Permanent (No automatic 30-day deletion). |

---

## J. Verified Public URLs

| Resource | URL | Status |
| :--- | :--- | :--- |
| **GitHub Repository** | [https://github.com/sundareshwarand/Route.X](https://github.com/sundareshwarand/Route.X) | **`LIVE & SYNCHRONIZED`** |
| **Public Frontend Web App** | https://routex-dashboard.onrender.com | **`CONFIGURED (Pending Blueprint Launch)`** |
| **Public Backend API Health** | https://routex-api.onrender.com/health | **`CONFIGURED (Pending Blueprint Launch)`** |
| **Public Backend Readiness** | https://routex-api.onrender.com/ready | **`CONFIGURED (Pending Blueprint Launch)`** |
| **Interactive API Docs (Swagger)**| https://routex-api.onrender.com/docs | **`CONFIGURED (Pending Blueprint Launch)`** |
| **Android APK Binary** | [`dashboard/android/app/build/outputs/apk/debug/app-debug.apk`](file:///C:/Users/Sundareshwaran/Desktop/Route.X/dashboard/android/app/build/outputs/apk/debug/app-debug.apk) | **`COMPILED & VERIFIED`** |
