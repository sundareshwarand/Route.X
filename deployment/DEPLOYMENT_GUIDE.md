# RouteX — Complete Open-Source Cloud Deployment & Cross-Network Android Guide

> **Zero-Cost & Zero-Billing Guarantee**: This deployment architecture uses 100% free-tier services that do not require entering credit card details or activating UPI Autopay. Your laptop does not need to stay on, and no router port-forwarding or local tunnels are required.

---

## 1. Architecture Overview & Open-Source Stack

```
           +-------------------------------------------------------+
           |                    Client Devices                     |
           |  - Android Phones (Installed APK / Mobile Data 4G/5G) |
           |  - Any Desktop / Laptop Browser (Any Wi-Fi Network)  |
           |  - Progressive Web App (PWA Standalone)               |
           +---------------------------+---------------------------+
                                       |
                   HTTPS (Port 443)    |    WSS (Secure WebSocket)
                                       v
         +-----------------------------------------------------------+
         |               Cloudflare Pages / Vercel                   |
         |         Global CDN Frontend (React 18 + Vite)             |
         |         URL: https://routex-dashboard.pages.dev           |
         +-----------------------------+-----------------------------+
                                       |
                   HTTPS REST API      |    WSS WebSocket Telemetry
                                       v
         +-----------------------------------------------------------+
         |                  Render.com Web Service                   |
         |                   (Python 3.12 + FastAPI)                 |
         |             URL: https://routex-backend.onrender.com      |
         |                                                           |
         |  - Dijkstra Corridor Routing Engine                       |
         |  - 2.0s Mandatory All-Red Safety Clearance State Machine   |
         |  - JWT Authentication (Operator / Driver role check)      |
         |  - Read-Only Gemini AI Advisory Engine (Deterministic FB) |
         +-----------------------------+-----------------------------+
                                       |
                                       v
         +-----------------------------------------------------------+
         |               Persistent Database Storage                 |
         |  Option A: Render Persistent Disk (/data/routex.db)       |
         |  Option B: Neon / Supabase Free Cloud PostgreSQL          |
         |  - SHA-256 Audit Ledger Integrity Preserved               |
         |  - Users, Fleet, Junctions, & Sensor Telemetry            |
         +-----------------------------------------------------------+
```

---

## 2. Free Tier Comparison & Real Operational Limitations

| Platform | Role | Cost | Credit Card Required? | Free Tier Limits & Caveats |
| :--- | :--- | :--- | :--- | :--- |
| **Render.com** | Backend (FastAPI) | $0.00 / mo | **No** | Spins down after 15 minutes of inactivity. First incoming request takes **30–50 seconds** to wake up ("cold start"). Free tier includes 750 free instance hours per month. |
| **Cloudflare Pages** | Frontend (React) | $0.00 / mo | **No** | Unlimited requests, unlimited bandwidth, zero sleep/cold-start, fast global CDN edge distribution. |
| **Vercel** (Alt.) | Frontend (React) | $0.00 / mo | **No** | 100 GB bandwidth / mo, automatic HTTPS SSL certificate. |
| **Neon.tech** | PostgreSQL Database | $0.00 / mo | **No** | 0.5 GB storage, serverless PostgreSQL with auto-sleep after 5 min inactivity (wakes in <1s). |
| **Capacitor Android** | Native Mobile App | $0.00 | **No** | Compiles locally to standalone `.apk` using Android SDK and Java. Zero cloud dependency. |

---

## 3. Step-by-Step Deployment Instructions

### Phase A: Push RouteX to GitHub

1. Ensure all changes are committed locally:
   ```powershell
   git add .
   git commit -m "feat: complete cloud deployment config and mobile android app"
   ```
2. Create a new repository on [GitHub](https://github.com/new) named `Route.X` (Private or Public).
3. Link and push your local repository:
   ```powershell
   git remote add origin https://github.com/<YOUR_GITHUB_USERNAME>/Route.X.git
   git branch -M main
   git push -u origin main
   ```

---

### Phase B: Deploy Backend on Render (Free Python Service)

1. Sign in to [Render.com](https://render.com) using your GitHub account.
2. In the Render Dashboard, click **New +** -> **Web Service**.
3. Select **Build and deploy from a Git repository** and connect your `Route.X` repository.
4. Fill in the service configuration:
   - **Name**: `routex-backend`
   - **Region**: Oregon (US West) or Frankfurt (EU Central)
   - **Branch**: `main`
   - **Root Directory**: *(leave completely blank)*
   - **Runtime**: `Python 3`
   - **Build Command**: `pip install -r backend/requirements.txt`
   - **Start Command**: `uvicorn backend.app.main:app --host 0.0.0.0 --port $PORT`
   - **Instance Type**: **Free** ($0 / month)
5. Expand **Advanced** -> Click **Add Environment Variable**:
   - `ENVIRONMENT` = `production`
   - `CORS_ORIGINS` = `*` *(or your frontend URL once generated)*
   - `SECRET_KEY` = *(Click "Generate" or enter a secure random 32-character string)*
   - `DATABASE_URL` = `sqlite:///./routex.db` *(or PostgreSQL connection string, see Phase D)*
   - `GEMINI_API_KEY` = *(Optional: paste your Google AI Studio key)*
   - `GEMINI_MODEL` = `gemini-2.5-flash`
6. Click **Create Web Service**.
7. Render will build and deploy the container. Once finished, copy your service's live HTTPS URL:
   `https://<YOUR_RENDER_SERVICE_NAME>.onrender.com`
8. **Verify Health**: Visit `https://<YOUR_RENDER_SERVICE_NAME>.onrender.com/health` in your browser.
   Expected response:
   ```json
   {
     "status": "HEALTHY",
     "system": "RouteX - Intelligent Emergency Traffic Management System",
     "version": "1.0.0",
     "environment": "production",
     "database": "CONNECTED",
     "endpoints": {
       "api": "/api",
       "ws": "/ws",
       "docs": "/docs"
     }
   }
   ```

---

### Phase C: Deploy Frontend on Cloudflare Pages (Free Static Hosting)

1. Sign in to [Cloudflare Dashboard](https://dash.cloudflare.com/) -> Navigate to **Workers & Pages**.
2. Click **Create application** -> Tab **Pages** -> **Connect to Git**.
3. Authorize GitHub and select your `Route.X` repository.
4. Configure Build settings:
   - **Project Name**: `routex-dashboard`
   - **Framework preset**: `Vite`
   - **Root directory**: `dashboard`
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
5. Under **Environment variables (production)**, add:
   - Variable name: `VITE_API_BASE_URL`
   - Value: `https://<YOUR_RENDER_SERVICE_NAME>.onrender.com/api`
     *(Note: Do not include a trailing slash; append `/api`)*
6. Click **Save and Deploy**.
7. Cloudflare Pages builds in ~45 seconds and gives you a free HTTPS domain:
   `https://routex-dashboard.pages.dev`
8. **WebSocket Auto-Derivation**: RouteX automatically translates `https://` into `wss://` and targets `/ws` on the backend host (`wss://<YOUR_RENDER_SERVICE_NAME>.onrender.com/ws`). No secondary configuration is required.

---

### Phase D: Persistent Database Options (Preventing Data Loss)

By default, Render's free tier uses an ephemeral filesystem where SQLite resets upon service restarts or sleep wake-ups.

#### Option 1: Free Serverless PostgreSQL via Neon.tech (Recommended)
1. Sign up at [Neon.tech](https://neon.tech) (100% Free, no credit card required).
2. Create a project named `routex-db`.
3. Copy the Postgres connection string:
   `postgresql://neondb_owner:password@ep-xyz.us-east-2.aws.neon.tech/neondb?sslmode=require`
4. In Render Dashboard -> `routex-backend` -> **Environment**:
   - Change `DATABASE_URL` to your Neon PostgreSQL connection string.
5. Click **Save Changes**. RouteX automatically initializes all tables (`users`, `ambulances`, `junctions`, `emergency_requests`, `audit_ledger`) on startup without deleting data.

#### Option 2: Render Persistent Disk (Paid $0.25/GB/mo if chosen, or Starter plan)
- If using a persistent disk mounted at `/data`, set `DATABASE_URL` = `sqlite:////data/routex.db`. RouteX's database module automatically ensures directory `/data` exists.

---

## 4. Android Mobile Application (.APK)

### Pre-Built Verified Artifact

The native debug APK has been compiled and verified using Android SDK 36 and Java 21 LTS:
- **Location**: `dashboard/android/app/build/outputs/apk/debug/app-debug.apk`
- **Package ID**: `org.routex.app`
- **Application Name**: `RouteX`
- **File Size**: `4.51 MB` (4,518,721 bytes)

### How to Install the APK on Any Android Device

1. **Option 1: Via USB Transfer / Google Drive / Email**:
   - Copy `app-debug.apk` to your phone via USB cable or upload it to your Google Drive.
   - On your Android phone, tap `app-debug.apk` to install.
   - If prompted: Allow *"Install unknown apps"* from your browser/files app.
2. **Option 2: Via ADB (Command Line)**:
   - Connect phone via USB with USB Debugging enabled.
   - Run:
     ```powershell
     & "C:\Users\Sundareshwaran\AppData\Local\Android\Sdk\platform-tools\adb.exe" install -r dashboard/android/app/build/outputs/apk/debug/app-debug.apk
     ```

### Dynamic Cloud Server Selection in the Android App

The installed APK has an interactive **Server Endpoint Selector** on the login screen:
1. Open the **RouteX** app on your phone (using mobile data 4G/5G or any Wi-Fi).
2. Tap the top-right button displaying **ENDPOINT: ...** (with the gear icon).
3. Enter your deployed cloud backend URL:
   `https://routex-backend.onrender.com/api`
4. Tap **Apply URL**.
5. Log in with the pre-seeded credentials:
   - **Operator**: `operator@routex.org` / `operator123`
   - **Medic Driver**: `driver1@routex.org` / `driver123`
6. The app instantly connects over HTTPS and opens live WebSocket telemetry (`wss://`) across cellular networks without needing your laptop running!

---

## 5. Rebuilding Frontend & APK for Updates

If you modify UI code or change your default cloud URL:

```powershell
# 1. Rebuild Web Application
cd dashboard
npm run build

# 2. Sync to Android Native Shell
npx cap sync android

# 3. Compile Native Android APK
$env:JAVA_HOME = "C:\Program Files\Java\jdk-21.0.11"
cd android
.\gradlew.bat assembleDebug
```

The fresh APK will immediately appear at `dashboard/android/app/build/outputs/apk/debug/app-debug.apk`.

---

## 6. Verification Checklist & Security Rules

- [x] **Zero Localhost References**: Production builds never force `localhost` or local IPs.
- [x] **Safe Protocol Negotiation**: Automatic translation between `https://` -> `wss://` and `http://` -> `ws://`.
- [x] **Zero Secrets in Frontend**: `GEMINI_API_KEY`, database passwords, and JWT secrets exist solely in backend environment variables.
- [x] **Strict Role Enforcement**: Driver accounts cannot reorder emergency priority queues or alter physical signal actuators.
- [x] **Mandatory 2.0s Clearance**: All-red failsafe interval cannot be bypassed or shortened by AI or clients.
- [x] **SHA-256 Audit Ledger**: All emergency preemptions and queue modifications are cryptographically chained and tamper-checked.
