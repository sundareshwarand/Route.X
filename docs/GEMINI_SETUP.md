# RouteX — Google Gemini AI Advisory Activation Guide

This guide explains how to quickly and securely configure your Google Gemini API key for the **RouteX Intelligent Emergency Traffic Management System**.

---

## 1. Safety & Architecture Overview

- **Strictly Advisory**: The Gemini AI integration is non-actuating. It generates operational explanations of corridor selection and post-incident debriefs.
- **Safety Critical Invariants**: Deterministic signal controllers, 2.0-second all-red clearance intervals, and FIFO/triage queueing remain authoritative under all conditions.
- **Secret Hygiene**: Your API key is stored **only** in `backend/.env` on your local computer. It is never transmitted to the browser, never bundled into JavaScript, and ignored by Git.

---

## 2. Step 1: Obtain a Gemini API Key

1. Navigate to Google AI Studio: [https://aistudio.google.com/apikey](https://aistudio.google.com/apikey)
2. Sign in with your Google account.
3. Click **Create API key** (or select an existing project).
4. Copy the generated key.

---

## 3. Step 2: Run the Setup Helper Script

In a PowerShell terminal, run:

```powershell
powershell -ExecutionPolicy Bypass -File "C:\Users\Sundareshwaran\Desktop\Route.X\scripts\setup_routex_gemini.ps1"
```

The script will:
1. Locate `backend/.env` and verify Git ignore safety.
2. Prompt you to enter your Gemini API key securely (input characters are masked).
3. Validate that the input is non-empty and not a placeholder.
4. Save the key to `backend/.env` without echoing it back to the console.
5. Offer to automatically restart the backend service.

---

## 4. Step 3: Backend Restart (If not done automatically)

If you chose to restart manually, run:

```powershell
powershell -ExecutionPolicy Bypass -File "C:\Users\Sundareshwaran\Desktop\Route.X\scripts\manage_routex_backend.ps1" -Action restart
```

---

## 5. Step 4: Verify the Configuration

### A. Check AI Status Endpoint (Public)
Open in your browser or run:
```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/ai/status"
```
**Expected Response:**
```json
{
  "is_configured": true,
  "model": "gemini-2.5-flash",
  "provider": "Google Gemini",
  "status_label": "ACTIVE (Advisory Mode)",
  "disclaimer": "RouteX AI Advisory insights are informational and supplementary. Deterministic traffic signal controllers and all-red clearance intervals remain authoritative."
}
```

### B. View the Operations Dashboard
1. Ensure the dashboard is open at `http://localhost:5173`.
2. Navigate to **System Administration** (`Settings`).
3. Under the **Google Gemini AI Advisory Module** card, the status will display **`ONLINE & CONFIGURED`** (`GEMINI 2.5 FLASH`).
4. On the **Overview** page or **Route Planner**, the AI Insights panel will display live explainable route insights.

---

## 6. Troubleshooting & Fallback Behavior

| Issue | Cause | Resolution |
| :--- | :--- | :--- |
| **`UNCONFIGURED (Deterministic Only)`** | `backend/.env` is missing or `GEMINI_API_KEY` is empty. | Run `scripts/setup_routex_gemini.ps1` and restart the backend. |
| **HTTP 401 Unauthorized** | Attempted to call `/api/ai/explain-route` without Bearer token. | Normal behavior. Endpoints require an operator login token from `/api/auth/login`. |
| **Invalid Key / Quota Exhausted** | Google AI Studio key is invalid, revoked, or billing limit reached. | The system automatically falls back to **Deterministic Rule Engine** without crashing the backend or traffic controllers. Check quota at [Google AI Studio](https://aistudio.google.com/). |
| **Port 8000 Not Responding** | Backend is stopped. | Run `powershell -ExecutionPolicy Bypass -File scripts/manage_routex_backend.ps1 -Action start`. |
