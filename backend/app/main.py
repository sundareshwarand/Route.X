import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends
from fastapi.middleware.cors import CORSMiddleware
from .config import settings
from .database import engine, Base, SessionLocal
from .models import User, UserRole, Ambulance, Junction, SignalState, RegisteredDevice, DeviceType, Hospital, HospitalReadiness, utc_now
from .auth import hash_password
from .services.ws_manager import ws_manager

from .routers import auth, ambulances, junctions, emergency, hardware, alerts, analytics, reliability, simulation, hospitals, ai


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("routex")


def seed_initial_data():
    """
    Seeds initial default users, ambulances, and junctions for immediate testing.
    """
    db = SessionLocal()
    try:
        # 1. Seed Users
        if not db.query(User).filter(User.email == "operator@routex.org").first():
            operator = User(
                email="operator@routex.org",
                hashed_password=hash_password("operator123"),
                full_name="Traffic Operations Commander",
                role=UserRole.OPERATOR,
                is_active=True
            )
            admin = User(
                email="admin@routex.org",
                hashed_password=hash_password("admin123"),
                full_name="System Administrator",
                role=UserRole.ADMIN,
                is_active=True
            )
            driver = User(
                email="driver1@routex.org",
                hashed_password=hash_password("driver123"),
                full_name="Ambulance Driver Mark",
                role=UserRole.DRIVER,
                is_active=True
            )
            citizen = User(
                email="citizen@routex.org",
                hashed_password=hash_password("citizen123"),
                full_name="Citizen Road User",
                role=UserRole.CITIZEN,
                is_active=True
            )
            db.add_all([operator, admin, driver, citizen])
            db.commit()
            logger.info("Default seed users created successfully.")

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
    # Initialize DB schemas
    Base.metadata.create_all(bind=engine)
    seed_initial_data()
    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Backend API and WebSocket Coordination Service for RouteX IoT Emergency Traffic Management",
    lifespan=lifespan
)

# CORS setup
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
    return {
        "status": "HEALTHY",
        "system": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
        "database": "CONNECTED",
        "endpoints": {
            "api": settings.API_V1_STR,
            "ws": "/ws",
            "docs": "/docs"
        }
    }


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
