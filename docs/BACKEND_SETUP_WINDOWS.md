# RouteX — Windows 11 Persistent Backend Setup & Operations Guide

This comprehensive guide details how the RouteX FastAPI/Uvicorn backend operates persistently in the background on Windows 11, how automatic startup is configured, how to verify and pair your Android device over Wi-Fi, and how to maintain the server across everyday reboots and demonstrations.

---

## 1. Architecture & Background Execution Model

When developing mobile apps or preparing academic viva demonstrations, requiring an open VS Code window or terminal to keep the backend alive is fragile. 

RouteX provides a robust, zero-window background architecture:

```
┌────────────────────────────────────────────────────────┐
│  Windows 11 System Boot (Session 0, Before Logon)      │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│ Windows Task Scheduler: RouteX_FastAPI_Backend         │
│ - Trigger: AtStartup (Boot time, unattended)           │
│ - Principal: NT AUTHORITY\SYSTEM                       │
│ - Multi-Instance: IgnoreNew (Duplicate Prevention)     │
│ - Crash Supervision: RestartCount 3, 1 min interval    │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│ scripts/run_routex_server.bat                          │
│ - Supervised batch runner                              │
│ - Directory: C:\Users\Sundareshwaran\Desktop\Route.X\backend
│ - Executable: Python 3.12 (uvicorn app.main:app)       │
│ - Host: 0.0.0.0 | Port: 8000                           │
│ - Stdout: logs/routex_backend_stdout.log               │
│ - Stderr: logs/routex_backend_stderr.log               │
└──────────────────────────┬─────────────────────────────┘
                           │
             ┌─────────────┴─────────────┐
             ▼                           ▼
┌─────────────────────────┐ ┌─────────────────────────┐
│ React Web Dashboard     │ │ RouteX Android Mobile   │
│ http://localhost:5173   │ │ http://<PC_IP>:8000/api │
└─────────────────────────┘ └─────────────────────────┘
```

### User Sign-In (`AtLogOn`) vs System Startup (`AtStartup`)
* **User Sign-In (`AtLogOn` / Startup Folder)**:  
  Executes in your interactive user session only **after** you enter your Windows password and log in. If the PC restarts unattended, the backend remains offline until someone signs into Windows.
* **System Startup Before Sign-In (`AtStartup` / Task Scheduler)**:  
  Executes automatically at operating system boot in Session 0 under `NT AUTHORITY\SYSTEM`. Even while the PC rests at the Windows lock screen, the backend is running and reachable by your Android phone over Wi-Fi.

---

## 2. Directory of Control Files

All management scripts and configuration files are located in your RouteX workspace:

| File Path | Purpose |
|---|---|
| [`scripts/run_routex_server.bat`](file:///c:/Users/Sundareshwaran/Desktop/Route.X/scripts/run_routex_server.bat) | Supervised batch runner executed by Task Scheduler. Keeps process attached for crash detection. |
| [`scripts/manage_routex_backend.ps1`](file:///c:/Users/Sundareshwaran/Desktop/Route.X/scripts/manage_routex_backend.ps1) | **Unified manager**: `status`, `start`, `stop`, `restart`, `logs`, `test-health`, and `uninstall`. |
| [`scripts/start_routex_backend.ps1`](file:///c:/Users/Sundareshwaran/Desktop/Route.X/scripts/start_routex_backend.ps1) | Standalone background starter with port duplicate check and 12s health verification. |
| [`scripts/stop_routex_backend.ps1`](file:///c:/Users/Sundareshwaran/Desktop/Route.X/scripts/stop_routex_backend.ps1) | Cleanly terminates Uvicorn process tree and frees port 8000. |
| [`scripts/restart_routex_backend.ps1`](file:///c:/Users/Sundareshwaran/Desktop/Route.X/scripts/restart_routex_backend.ps1) | Safe stop followed by fresh background launch. |
| [`scripts/check_routex_backend.ps1`](file:///c:/Users/Sundareshwaran/Desktop/Route.X/scripts/check_routex_backend.ps1) | Health diagnostics tool displaying PID, memory, LAN IP, and log excerpts. |
| [`scripts/verify_routex_startup.ps1`](file:///c:/Users/Sundareshwaran/Desktop/Route.X/scripts/verify_routex_startup.ps1) | **Read-only Startup Inspector**: Non-destructive PASS/WARN/FAIL status checker. |
| [`scripts/install_scheduled_task.bat`](file:///c:/Users/Sundareshwaran/Desktop/Route.X/scripts/install_scheduled_task.bat) | Batch launcher for registering the Task Scheduler service (Run as Administrator). |
| [`scripts/install_scheduled_task.ps1`](file:///c:/Users/Sundareshwaran/Desktop/Route.X/scripts/install_scheduled_task.ps1) | PowerShell script that creates the `AtStartup` scheduled task with crash restart policy. |
| [`scripts/uninstall_routex_service.ps1`](file:///c:/Users/Sundareshwaran/Desktop/Route.X/scripts/uninstall_routex_service.ps1) | Safe uninstaller removing task, startup files, and stopping running servers. |
| `logs/routex_backend_stdout.log` | Standard output stream log file. |
| `logs/routex_backend_stderr.log` | Standard error and Uvicorn server cycle log file. |

---

## 3. Daily Operations & Unified Manager

You do **not** need to open a terminal or run commands every time Windows boots. Once registered, the backend starts completely automatically.

When you want to inspect or manage the backend, use [`scripts/manage_routex_backend.ps1`](file:///c:/Users/Sundareshwaran/Desktop/Route.X/scripts/manage_routex_backend.ps1):

```powershell
# 1. Check live status, memory, and port listening
powershell -ExecutionPolicy Bypass -File "scripts\manage_routex_backend.ps1" -Action status

# 2. Test local and Wi-Fi health probes
powershell -ExecutionPolicy Bypass -File "scripts\manage_routex_backend.ps1" -Action test-health

# 3. View the last 25 lines of live stdout and stderr logs
powershell -ExecutionPolicy Bypass -File "scripts\manage_routex_backend.ps1" -Action logs

# 4. Gracefully restart the backend
powershell -ExecutionPolicy Bypass -File "scripts\manage_routex_backend.ps1" -Action restart

# 5. Stop the backend
powershell -ExecutionPolicy Bypass -File "scripts\manage_routex_backend.ps1" -Action stop

# 6. Start the backend manually (idempotent, checks for existing instances)
powershell -ExecutionPolicy Bypass -File "scripts\manage_routex_backend.ps1" -Action start
```

---

## 4. Registering the System-Startup Scheduled Task

Because registering a task that executes `AtStartup` under `NT AUTHORITY\SYSTEM` modifies `C:\Windows\System32\Tasks` and system registry keys, Windows requires **Elevated Administrator privileges** for this one-time step.

### Step 1: Open PowerShell as Administrator
1. Press the Windows key, type **PowerShell**.
2. Right-click **Windows PowerShell** $\rightarrow$ select **Run as Administrator**.

### Step 2: Execute Registration
```powershell
cd C:\Users\Sundareshwaran\Desktop\Route.X
powershell -ExecutionPolicy Bypass -File "scripts\install_scheduled_task.ps1" -TriggerType AtStartup
```
*(Alternatively: Right-click [`scripts/install_scheduled_task.bat`](file:///c:/Users/Sundareshwaran/Desktop/Route.X/scripts/install_scheduled_task.bat) in File Explorer and select **Run as administrator**).*

### Step 3: Verify Task in Task Scheduler
```powershell
Get-ScheduledTask -TaskName "RouteX_FastAPI_Backend" | Format-List TaskName, State, TaskPath
```

### Step 4: Remove the Old User Startup Launcher
To prevent duplicate Uvicorn instances when you log in, delete the old user-level VBS launcher:
```powershell
Remove-Item "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\RouteX_AutoStart.vbs" -Force -ErrorAction SilentlyContinue
```

---

## 5. Android Local Wi-Fi Pairing

### Step 1: Discover Your Current IPv4 Address
Run the health probe command:
```powershell
powershell -ExecutionPolicy Bypass -File "scripts\manage_routex_backend.ps1" -Action test-health
```
Note the detected Wi-Fi LAN IP (e.g., `192.168.1.14` or `192.168.1.5`).

### Step 2: Configure the RouteX Mobile App
1. Connect your Android handset to the **same Wi-Fi network** as your PC.
2. Launch the **RouteX** mobile app.
3. On the Login screen, tap the **Server Config gear icon** (top right) or navigate to Settings.
4. Set the API Base URL:
   ```text
   http://<YOUR_CURRENT_PC_IP>:8000/api
   ```
   *(e.g., `http://192.168.1.14:8000/api`)*
5. Tap **Save Endpoint**, then tap **Test Connection & Ping Server**.
6. When the connection indicator turns green (`Connected HTTP 200`), log in with:
   - **Email**: `driver1@routex.org`
   - **Password**: `driver123`

---

## 6. Windows Firewall Verification

RouteX requires inbound TCP traffic on port 8000 from local network devices.

### Existing Rules Audit
Windows 11 firewall rules were audited and confirmed to already allow port 8000 on Private and Any profiles:
- Rule: `SmartProcure FastAPI 8000` (Inbound Allow, Port 8000, Private & Any)
- Rule: `python.exe` (Inbound Allow)

> [!NOTE]
> Because existing inbound allow rules for port 8000 already exist and are active, **no firewall changes were made**. Your PC is already configured to accept LAN traffic on port 8000.

---

## 7. Troubleshooting & Recovery

| Issue | Cause | Recovery Step |
|---|---|---|
| **Port 8000 already in use** | A previous Python or Uvicorn instance remained running. | Run `powershell -File "scripts\manage_routex_backend.ps1" -Action restart`. The stop routine forcefully terminates old listeners before starting clean. |
| **Backend crash after code modification** | Syntax error or unhandled exception in `app/`. | Run `powershell -File "scripts\manage_routex_backend.ps1" -Action logs` to inspect traceback in `routex_backend_stderr.log`. Task Scheduler auto-restarts up to 3 times. |
| **Android cannot connect** | PC's Wi-Fi IP address changed after router reconnect. | Run `manage_routex_backend.ps1 -Action test-health`, find the new IP, and update it in your Android app settings. |
| **Android connection times out** | PC went to sleep or Wi-Fi network is marked "Public". | Ensure your Wi-Fi network profile in Windows Settings is set to **Private Network**, and sleep is set to **Never** while plugged in. |

---

## 8. Rollback / Complete Uninstallation

To cleanly remove the automatic startup configuration and stop all running processes:

```powershell
cd C:\Users\Sundareshwaran\Desktop\Route.X
powershell -ExecutionPolicy Bypass -File "scripts\manage_routex_backend.ps1" -Action uninstall
```

This command:
1. Terminates any running Uvicorn/Python process listening on port 8000.
2. Unregisters the `RouteX_FastAPI_Backend` Scheduled Task.
3. Deletes `RouteX_AutoStart.vbs` from the user Startup folder.
4. Leaves all project source code, database files, and logs intact.

---

## 9. Availability Limitations & Academic Boundary

> [!IMPORTANT]
> **PC Availability Dependency**:  
> The setup documented here runs on your physical Windows 11 PC. If the PC is shut down, enters sleep mode, or disconnects from Wi-Fi, the backend is unavailable and the Android mobile app will show a network connection error.

> [!TIP]
> **Long-Term Cloud Deployment Boundary (24/7 Access)**:  
> If you need the RouteX mobile app to work anywhere in the world 24/7 without keeping your personal PC turned on:
> 1. Deploy the FastAPI backend as a Docker container on a Linux VPS (DigitalOcean Droplet, AWS EC2, or Google Cloud Run).
> 2. Put Caddy or Nginx reverse proxy in front with automatic Let's Encrypt TLS (`https://api.routex.org`).
> 3. Store JWT secret keys and database URLs in cloud environment secrets.
> 4. Point the RouteX Android app to `https://api.routex.org/api`.

> [!CAUTION]
> **Academic Simulation Prototype**:  
> RouteX is an intelligent emergency traffic management academic simulation prototype with Dijkstra shortest-path calculations and simulated signal preemption. It must never be interfaced with live municipal traffic signal controllers or physical emergency dispatch networks.
