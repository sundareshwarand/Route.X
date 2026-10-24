# RouteX Cloud Deployment Guide (Zero-Cost & Zero-Billing)

This guide walks you through deploying RouteX completely free of charge to the cloud without requiring a paid subscription, credit card prompt, or running your local laptop.

---

## Architecture Overview

```
                      +-----------------------------+
                      |   Cloudflare Pages / Vercel  |
                      |   (Free React + Vite Host)  |
                      |   https://routex.pages.dev  |
                      +--------------+--------------+
                                     |
               HTTPS REST API        |    WSS WebSocket Telemetry
                     +---------------+---------------+
                     |                               |
                     v                               v
       +-------------------------------------------------------------+
       |                        Render.com                           |
       |                (Free Python Web Service)                    |
       |             https://routex-backend.onrender.com             |
       |                                                             |
       |  - FastAPI (Python 3.12)                                    |
       |  - SQLite Persistent Database                               |
       |  - Mandatory 2.0s All-Red Clearance Safety Interlock        |
       |  - Dijkstra Routing Engine                                  |
       |  - Gemini AI Advisor (Advisory-Only, Read-Only)             |
       +-------------------------------------------------------------+
```

---

## Part 1: Deploy Backend to Render (Free Tier)

1. Sign up at [Render.com](https://render.com) using your GitHub account (No credit card required for free web services).
2. Click **New +** -> **Web Service**.
3. Select **Build and deploy from a Git repository** and connect your RouteX GitHub repo.
4. Configure the Web Service settings:
   - **Name**: `routex-backend` (or your choice)
   - **Region**: Oregon (US West) or Frankfurt (EU Central)
   - **Branch**: `main`
   - **Root Directory**: Leave blank (root of repo)
   - **Runtime**: `Python 3`
   - **Build Command**: `pip install -r backend/requirements.txt`
   - **Start Command**: `uvicorn backend.app.main:app --host 0.0.0.0 --port $PORT`
   - **Plan**: **Free** ($0 / month)
5. Under **Advanced** -> **Add Environment Variable**:
   - `ENVIRONMENT`: `production`
   - `CORS_ORIGINS`: `*` (or your frontend domain once deployed)
   - `SECRET_KEY`: (Click 'Generate' or enter a secure random string)
   - `DATABASE_URL`: `sqlite:///./routex.db`
   - `GEMINI_API_KEY`: *(Optional)* Your Google Gemini API Key
   - `GEMINI_MODEL`: `gemini-2.5-flash`
6. Click **Create Web Service**.
7. Once deployed, Render will provide a live URL, e.g.:
   `https://routex-backend.onrender.com`
8. Verify backend health by visiting in your browser:
   `https://routex-backend.onrender.com/health`
   You should see `{"status":"HEALTHY","system":"RouteX ...","database":"CONNECTED"}`.

---

## Part 2: Deploy Frontend to Cloudflare Pages (Free Tier)

1. Log into the [Cloudflare Dashboard](https://dash.cloudflare.com/) and go to **Workers & Pages** -> **Create application** -> **Pages** -> **Connect to Git**.
2. Select your RouteX repository.
3. Configure the build settings:
   - **Project Name**: `routex-dashboard`
   - **Framework Preset**: `Vite`
   - **Root Directory**: `dashboard`
   - **Build Command**: `npm run build`
   - **Build Output Directory**: `dist`
4. Under **Environment variables**:
   - `VITE_API_BASE_URL`: `https://routex-backend.onrender.com/api` (Use your actual Render URL + `/api`)
5. Click **Save and Deploy**.
6. Cloudflare will build the frontend and provide a free `*.pages.dev` URL.
7. Note: The WebSocket connection is **automatically derived** by RouteX as `wss://routex-backend.onrender.com/ws` — no extra manual configuration needed!

---

## Part 3: Deploy Frontend to Vercel (Alternative Free Option)

1. Log in to [Vercel](https://vercel.com) with GitHub.
2. Click **Add New** -> **Project** -> Import your RouteX repo.
3. Set **Root Directory** to `dashboard`.
4. Under **Environment Variables**:
   - Key: `VITE_API_BASE_URL`
   - Value: `https://routex-backend.onrender.com/api`
5. Click **Deploy**.

---

## Part 4: Testing Remote Access From Any Phone or Computer

1. Open your smartphone's browser (Chrome, Safari, Firefox).
2. Navigate to your Cloudflare Pages or Vercel URL.
3. Log in with the pre-seeded credentials:
   - **Operator**: `operator@routex.org` / `operator123`
   - **Admin**: `admin@routex.org` / `admin123`
   - **Driver**: `driver1@routex.org` / `driver123`
4. The map will load Leaflet OpenStreetMap tiles, live junction markers, and WebSocket connectivity.
5. In **Simulation Controls**, start any emergency corridor scenario to verify live signal preemption and vehicle tracking.

---

## Part 5: Security & Zero-Billing Checklist

- [x] Gemini API key is stored **exclusively** on the backend environment variables; it is never exposed in client bundles.
- [x] All-red 2.0-second safety clearance interval is enforced server-side by the deterministic Python state engine.
- [x] CORS is restricted via configurable `CORS_ORIGINS`.
- [x] Render Free Tier spins down after 15 minutes of inactivity and automatically wakes up on incoming request.
- [x] Zero credit cards or billing plans are required.
