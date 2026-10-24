@echo off
rem ==============================================================================
rem RouteX Persistent Backend Runner (Supervised Process for Task Scheduler)
rem ==============================================================================

set PROJECT_ROOT=C:\Users\Sundareshwaran\Desktop\Route.X
set BACKEND_DIR=%PROJECT_ROOT%\backend
set LOG_DIR=%PROJECT_ROOT%\logs
set PYTHON_EXE=C:\Users\Sundareshwaran\AppData\Local\Programs\Python\Python312\python.exe

if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

cd /d "%BACKEND_DIR%"
"%PYTHON_EXE%" -m uvicorn app.main:app --host 0.0.0.0 --port 8000 >> "%LOG_DIR%\routex_backend_stdout.log" 2>> "%LOG_DIR%\routex_backend_stderr.log"
