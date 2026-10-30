import time
import uuid
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from sqlalchemy import text
from .config import settings
from .database import engine, Base, SessionLocal, ensure_schema_compatibility
from .models import User, UserRole, Ambulance, Junction, SignalState, RegisteredDevice, DeviceType, Hospital, HospitalReadiness, utc_now
from .auth import hash_password, verify_password
from .services.ws_manager import ws_manager

from .routers import auth, ambulances, junctions, emergency, hardware, alerts, analytics, reliability, simulation, hospitals, ai


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("routex")


def seed_initial_data():
    """
    Seeds initial default users, ambulances, and junctions for immediate testing.
    Idempotent: Only creates missing entities; never modifies or resets existing user passwords.
    """
    db = SessionLocal()
    try:
        # 1. Seed Users (Check each individually; preserve existing accounts and passwords)
        from sqlalchemy import func
        seed_users = [
            ("operator@routex.org", "operator123", "Traffic Operations Commander", UserRole.OPERATOR),
            ("admin@routex.org", "admin123", "System Administrator", UserRole.ADMIN),
            ("driver1@routex.org", "driver123", "Ambulance Driver Mark", UserRole.DRIVER),
            ("citizen@routex.org", "citizen123", "Citizen Road User", UserRole.CITIZEN),
        ]
        users_added = 0
        for email, pwd, name, role in seed_users:
            existing = db.query(User).filter(func.lower(User.email) == email).first()
            if not existing:
                new_user = User(
                    email=email,
                    hashed_password=hash_password(pwd),
                    full_name=name,
                    role=role,
                    is_active=True,
                    created_at=utc_now()
                )
                db.add(new_user)
                users_added += 1
        if users_added > 0:
            db.commit()
            logger.info(f"Seeded {users_added} initial default user(s).")

        # 2. Seed Ambulances
        if not db.query(Ambulance).filter(Ambulance.id == "AMB-01").first():
            ambs = [
                Ambulance(id="AMB-01", call_sign="MEDIC-101", plate_number="DL-01-EM-4021", vehicle_type="Advanced Life Support", base_station="Metro City Hospital"),
                Ambulance(id="AMB-02", call_sign="RESCUE-202", plate_number="DL-01-EM-7890", vehicle_type="Trauma Critical Care", base_station="North Substation"),
                Ambulance(id="AMB-03", call_sign="PARAMEDIC-303", plate_number="DL-02-EM-1122", vehicle_type="Basic Life Support", base_station="East Health Depot")
            ]
            db.add_all(ambs)
            db.commit()
            logger.info("Default ambulances created.")

        # 3. Seed Junctions
        if not db.query(Junction).filter(Junction.id == "JNC-01").first():
            junctions_list = [
                Junction(id="JNC-01", name="Central Avenue - 5th Cross", code="CA-5C", latitude=28.6139, longitude=77.2090, zone="ZONE-CENTRAL", current_signal_state=SignalState.NORMAL_CYCLE, is_online=True, last_heartbeat=utc_now()),
                Junction(id="JNC-02", name="Metro Hospital Intersection", code="MH-INT", latitude=28.6180, longitude=77.2140, zone="ZONE-HOSPITAL", current_signal_state=SignalState.NORMAL_CYCLE, is_online=True, last_heartbeat=utc_now()),
                Junction(id="JNC-03", name="Ring Road Flyover Junction", code="RR-FJ", latitude=28.6220, longitude=77.2190, zone="ZONE-NORTH", current_signal_state=SignalState.NORMAL_CYCLE, is_online=True, last_heartbeat=utc_now()),
                Junction(id="JNC-04", name="Tech Boulevard Crossing", code="TB-CR", latitude=28.6250, longitude=77.2250, zone="ZONE-TECH", current_signal_state=SignalState.NORMAL_CYCLE, is_online=True, last_heartbeat=utc_now()),
                Junction(id="JNC-05", name="Emergency Trauma Corridor Exit", code="ETC-EX", latitude=28.6300, longitude=77.2300, zone="ZONE-HOSPITAL", current_signal_state=SignalState.NORMAL_CYCLE, is_online=True, last_heartbeat=utc_now())
            ]
            db.add_all(junctions_list)
            db.commit()
            logger.info("Default test junctions created.")

        # 4. Seed Registered Hardware Devices
        if not db.query(RegisteredDevice).filter(RegisteredDevice.hardware_id == "ESP32-AMB-01").first():
            dev1 = RegisteredDevice(
                device_type=DeviceType.ESP32_AMBULANCE,
                hardware_id="ESP32-AMB-01",
                device_key="dev-key-amb-secret-101",
                ambulance_id="AMB-01",
                is_active=True
            )
            dev2 = RegisteredDevice(
                device_type=DeviceType.ESP8266_JUNCTION,
                hardware_id="ESP8266-JNC-01",
                device_key="dev-key-jnc-secret-001",
                junction_id="JNC-01",
                is_active=True
            )
            db.add_all([dev1, dev2])
            db.commit()
            logger.info("Default registered hardware devices created.")

        # 5. Seed Municipal Receiving Hospitals
        if not db.query(Hospital).filter(Hospital.id == "HOSP-01").first():
            hospitals_list = [
                Hospital(
                    id="HOSP-01",
                    name="City Emergency Trauma Center",
                    junction_id="JNC-05",
                    latitude=28.6300,
                    longitude=77.2300,
                    readiness_status=HospitalReadiness.TRAUMA_READY,
                    available_icu_beds=12,
                    total_icu_beds=16,
                    specialties="Trauma Level 1, Neuro Surgery, Severe Resuscitation",
                    is_accepting_emergencies=True
                ),
                Hospital(
                    id="HOSP-02",
                    name="Metro General Hospital",
                    junction_id="JNC-02",
                    latitude=28.6180,
                    longitude=77.2140,
                    readiness_status=HospitalReadiness.CAPACITY_NOMINAL,
                    available_icu_beds=6,
                    total_icu_beds=10,
                    specialties="Cardiology, Stroke Unit, Urgent Care",
                    is_accepting_emergencies=True
                ),
                Hospital(
                    id="HOSP-03",
                    name="North Substation Staging Depot",
                    junction_id="JNC-03",
                    latitude=28.6220,
                    longitude=77.2190,
                    readiness_status=HospitalReadiness.AMBULATORY_ONLY,
                    available_icu_beds=2,
                    total_icu_beds=4,
                    specialties="Ambulatory Services, First Responder Staging",
                    is_accepting_emergencies=True
                )
            ]
            db.add_all(hospitals_list)
            db.commit()
            logger.info("Default receiving hospitals created.")
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Safe startup initialization
    try:
        logger.info(f"Starting RouteX backend service [env={settings.ENVIRONMENT}]...")
        Base.metadata.create_all(bind=engine)
        ensure_schema_compatibility()
        seed_initial_data()
        logger.info("RouteX startup: Database schema and seed data initialized successfully.")
    except Exception as e:
        logger.error(f"Fatal error during database startup: {e}")
        if settings.ENVIRONMENT.lower() == "production":
            raise e
    yield
    # Graceful shutdown cleanup
    logger.info("Initiating graceful shutdown of RouteX backend service...")
    try:
        engine.dispose()
        logger.info("Database engine connection pool disposed cleanly.")
    except Exception as e:
        logger.warning(f"Error during database pool cleanup on shutdown: {e}")
    logger.info("RouteX backend service shutdown complete.")


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Backend API and WebSocket Coordination Service for RouteX IoT Emergency Traffic Management",
    lifespan=lifespan
)

class DiagnosticLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        req_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())[:8]
        start_time = time.perf_counter()
        try:
            response = await call_next(request)
            duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
            response.headers["X-Request-ID"] = req_id
            # Safe diagnostic logging: never log authorization tokens or passwords
            logger.info(
                f"HTTP [{req_id}] {request.method} {request.url.path} "
                f"status={response.status_code} duration={duration_ms}ms"
            )
            return response
        except Exception as exc:
            duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
            logger.error(
                f"HTTP [{req_id}] {request.method} {request.url.path} "
                f"ERROR category={type(exc).__name__} duration={duration_ms}ms"
            )
            raise exc


# Middleware setup
app.add_middleware(DiagnosticLoggingMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Routers
app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(ambulances.router, prefix=settings.API_V1_STR)
app.include_router(junctions.router, prefix=settings.API_V1_STR)
app.include_router(emergency.router, prefix=settings.API_V1_STR)
app.include_router(hardware.router, prefix=settings.API_V1_STR)
app.include_router(alerts.router, prefix=settings.API_V1_STR)
app.include_router(analytics.router, prefix=settings.API_V1_STR)
app.include_router(reliability.router, prefix=settings.API_V1_STR)
app.include_router(simulation.router, prefix=settings.API_V1_STR)
app.include_router(hospitals.router, prefix=settings.API_V1_STR)
app.include_router(ai.router, prefix=settings.API_V1_STR)




@app.get("/")
def root():
    return {
        "status": "ONLINE",
        "system": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "docs": "/docs",
        "health": "/health"
    }


@app.get("/health")
def health_check():
    db_status = "CONNECTED"
    is_ready = True
    try:
        with SessionLocal() as db:
            db.execute(text("SELECT 1"))
    except Exception as e:
        logger.error(f"Health check DB probe error: {e}")
        db_status = f"ERROR: {type(e).__name__}"
        is_ready = False

    payload = {
        "status": "HEALTHY" if is_ready else "DEGRADED",
        "process": "ALIVE",
        "ready": is_ready,
        "database": db_status,
        "system": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
        "endpoints": {
            "api": settings.API_V1_STR,
            "ws": "/ws",
            "docs": "/docs",
            "ready": "/ready"
        }
    }
    return JSONResponse(status_code=200 if is_ready else 503, content=payload)


@app.get(f"{settings.API_V1_STR}/health")
def api_health_check():
    return health_check()


@app.get("/ready")
def readiness_check():
    try:
        with SessionLocal() as db:
            db.execute(text("SELECT 1"))
        return {
            "status": "READY",
            "process": "ALIVE",
            "database": "CONNECTED",
            "environment": settings.ENVIRONMENT
        }
    except Exception as e:
        logger.error(f"Readiness check failed: {e}")
        return JSONResponse(
            status_code=503,
            content={
                "status": "UNREADY",
                "process": "ALIVE",
                "database": f"ERROR: {type(e).__name__}",
                "detail": str(e)
            }
        )


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            # Echo ping/pong or client keepalive
            if data == "ping":
                await websocket.send_text('{"event": "pong"}')
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
