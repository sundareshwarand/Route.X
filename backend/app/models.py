import enum
import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    String,
    Integer,
    Boolean,
    DateTime,
    ForeignKey,
    Text,
    Enum as SQLEnum,
    Float
)
from sqlalchemy.orm import relationship
from .database import Base


def generate_uuid() -> str:
    return str(uuid.uuid4())


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    OPERATOR = "operator"
    DRIVER = "driver"
    CITIZEN = "citizen"


class AmbulanceStatus(str, enum.Enum):
    IDLE = "IDLE"
    EN_ROUTE = "EN_ROUTE"
    MAINTENANCE = "MAINTENANCE"


class SignalState(str, enum.Enum):
    NORMAL_CYCLE = "NORMAL_CYCLE"
    PRIORITY_ACTIVE = "PRIORITY_ACTIVE"
    FAILSAFE_ALL_RED = "FAILSAFE_ALL_RED"
    OFFLINE = "OFFLINE"


class Direction(str, enum.Enum):
    LEFT = "LEFT"
    STRAIGHT = "STRAIGHT"
    RIGHT = "RIGHT"


class RequestStatus(str, enum.Enum):
    PENDING = "PENDING"
    RECEIVED = "RECEIVED"
    PRIORITY_ACTIVE = "PRIORITY_ACTIVE"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    EXPIRED = "EXPIRED"
    CANCELLED = "CANCELLED"


class RequestSource(str, enum.Enum):
    PHYSICAL_LORA = "PHYSICAL_LORA"
    MOBILE_APP = "MOBILE_APP"
    SIMULATED_TEST = "SIMULATED_TEST"


class DeviceType(str, enum.Enum):
    ESP32_AMBULANCE = "esp32_ambulance"
    ESP8266_JUNCTION = "esp8266_junction"
    AMBULANCE = "AMBULANCE"
    TRAFFIC_JUNCTION = "TRAFFIC_JUNCTION"
    HOSPITAL = "HOSPITAL"
    OPERATOR = "OPERATOR"
    ADMIN = "ADMIN"


class AlertDeliveryStatus(str, enum.Enum):
    SENT = "SENT"
    DELIVERED = "DELIVERED"
    ACKNOWLEDGED = "ACKNOWLEDGED"
    EXPIRED = "EXPIRED"
    FAILED = "FAILED"


class TriagePriority(str, enum.Enum):
    CRITICAL = "CRITICAL"   # Life-threatening: cardiac arrest, severe trauma
    URGENT = "URGENT"       # Time-sensitive: stroke, severe respiratory
    STANDARD = "STANDARD"   # Routine transfer or non-life-threatening


class HospitalReadiness(str, enum.Enum):
    TRAUMA_READY = "TRAUMA_READY"
    CAPACITY_NOMINAL = "CAPACITY_NOMINAL"
    AMBULATORY_ONLY = "AMBULATORY_ONLY"
    DIVERTING = "DIVERTING"


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=generate_uuid)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String, nullable=False)
    role = Column(SQLEnum(UserRole), default=UserRole.CITIZEN, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=utc_now, nullable=False)


class Ambulance(Base):
    __tablename__ = "ambulances"

    id = Column(String, primary_key=True)  # e.g. "AMB-01"
    call_sign = Column(String, unique=True, nullable=False)
    plate_number = Column(String, nullable=False)
    vehicle_type = Column(String, default="Advanced Life Support")
    status = Column(SQLEnum(AmbulanceStatus), default=AmbulanceStatus.IDLE)
    base_station = Column(String, default="Central Station")
    assigned_driver_id = Column(String, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=utc_now, nullable=False)

    requests = relationship("EmergencyRequest", back_populates="ambulance")


class Junction(Base):
    __tablename__ = "junctions"

    id = Column(String, primary_key=True)  # e.g. "JNC-01"
    name = Column(String, nullable=False)
    code = Column(String, unique=True, nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    zone = Column(String, default="ZONE-CENTRAL", index=True)
    current_signal_state = Column(SQLEnum(SignalState), default=SignalState.NORMAL_CYCLE)
    active_direction = Column(SQLEnum(Direction), nullable=True)
    is_online = Column(Boolean, default=False)
    last_heartbeat = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utc_now, nullable=False)

    requests = relationship("EmergencyRequest", back_populates="junction")
    events = relationship("JunctionEvent", back_populates="junction")


class Hospital(Base):
    __tablename__ = "hospitals"

    id = Column(String, primary_key=True)  # e.g. "HOSP-01"
    name = Column(String, nullable=False)
    junction_id = Column(String, ForeignKey("junctions.id"), nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    readiness_status = Column(SQLEnum(HospitalReadiness), default=HospitalReadiness.CAPACITY_NOMINAL)
    available_icu_beds = Column(Integer, default=5)
    total_icu_beds = Column(Integer, default=10)
    specialties = Column(String, default="Emergency Medicine")
    is_accepting_emergencies = Column(Boolean, default=True)
    created_at = Column(DateTime, default=utc_now, nullable=False)

    junction = relationship("Junction")


class RegisteredDevice(Base):
    __tablename__ = "registered_devices"

    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String, nullable=True)
    device_type = Column(SQLEnum(DeviceType), nullable=False)
    role = Column(String, default="AMBULANCE", nullable=False)
    hardware_id = Column(String, unique=True, index=True, nullable=False)  # MAC / unique serial
    device_key = Column(String, nullable=False)  # Device secret key for auth header
    junction_id = Column(String, ForeignKey("junctions.id"), nullable=True)
    ambulance_id = Column(String, ForeignKey("ambulances.id"), nullable=True)
    is_active = Column(Boolean, default=True)
    connection_status = Column(String, default="OFFLINE", nullable=False)
    health_status = Column(String, default="HEALTHY", nullable=False)
    last_seen_at = Column(DateTime, nullable=True)
    ip_address = Column(String, nullable=True)
    firmware_version = Column(String, default="1.0.0", nullable=True)
    created_at = Column(DateTime, default=utc_now)

    heartbeats = relationship("DeviceHeartbeat", back_populates="device")


class AmbulanceTelemetry(Base):
    __tablename__ = "ambulance_telemetry"

    id = Column(String, primary_key=True, default=generate_uuid)
    ambulance_id = Column(String, ForeignKey("ambulances.id"), nullable=False, index=True)
    hardware_id = Column(String, nullable=True, index=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    speed_kmh = Column(Float, default=0.0)
    heading_deg = Column(Float, default=0.0)
    emergency_active = Column(Boolean, default=False)
    target_junction_id = Column(String, nullable=True)
    target_direction = Column(String, nullable=True)
    battery_level = Column(Integer, nullable=True)
    is_stale = Column(Boolean, default=False)
    recorded_at = Column(DateTime, default=utc_now, index=True)


class EmergencyRequest(Base):
    __tablename__ = "emergency_requests"

    id = Column(String, primary_key=True, default=generate_uuid)
    ambulance_id = Column(String, ForeignKey("ambulances.id"), nullable=False)
    junction_id = Column(String, ForeignKey("junctions.id"), nullable=False)
    direction = Column(SQLEnum(Direction), nullable=False)
    status = Column(SQLEnum(RequestStatus), default=RequestStatus.PENDING, index=True)
    source = Column(SQLEnum(RequestSource), default=RequestSource.MOBILE_APP)
    
    # Conflict & Scheduling Management
    triage_priority = Column(SQLEnum(TriagePriority), default=TriagePriority.STANDARD, nullable=False)
    estimated_arrival_seconds = Column(Integer, default=0, nullable=False)
    scheduling_reason = Column(String, nullable=True)
    clearance_seconds = Column(Integer, default=3, nullable=False)

    # Message traceability & duplicate detection
    message_sequence_id = Column(Integer, nullable=True)
    message_hash = Column(String, index=True, nullable=True)
    is_verified_hardware = Column(Boolean, default=False)
    
    # Timings
    duration_seconds = Column(Integer, default=20)
    requested_at = Column(DateTime, default=utc_now, index=True)
    acknowledged_at = Column(DateTime, nullable=True)
    activated_at = Column(DateTime, nullable=True)
    expires_at = Column(DateTime, nullable=False)
    completed_at = Column(DateTime, nullable=True)
    
    cancellation_reason = Column(String, nullable=True)

    ambulance = relationship("Ambulance", back_populates="requests")
    junction = relationship("Junction", back_populates="requests")
    alerts = relationship("NearbyVehicleAlert", back_populates="request")


class JunctionEvent(Base):
    __tablename__ = "junction_events"

    id = Column(String, primary_key=True, default=generate_uuid)
    junction_id = Column(String, ForeignKey("junctions.id"), nullable=False)
    event_type = Column(String, index=True, nullable=False)
    source = Column(String, default="firmware")
    is_verified_hardware = Column(Boolean, default=False)
    payload = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=utc_now, index=True)

    junction = relationship("Junction", back_populates="events")


class NearbyVehicleAlert(Base):
    __tablename__ = "nearby_vehicle_alerts"

    id = Column(String, primary_key=True, default=generate_uuid)
    request_id = Column(String, ForeignKey("emergency_requests.id"), nullable=False)
    junction_id = Column(String, ForeignKey("junctions.id"), nullable=False)
    zone = Column(String, nullable=False, index=True)
    message = Column(String, nullable=False)
    approach_direction = Column(SQLEnum(Direction), nullable=False)
    is_test_simulation = Column(Boolean, default=True)  # Clearly labels test/demo alerts
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=utc_now, index=True)

    request = relationship("EmergencyRequest", back_populates="alerts")
    deliveries = relationship("AlertDelivery", back_populates="alert")


class AlertDelivery(Base):
    __tablename__ = "alert_deliveries"

    id = Column(String, primary_key=True, default=generate_uuid)
    alert_id = Column(String, ForeignKey("nearby_vehicle_alerts.id"), nullable=False)
    recipient_user_id = Column(String, ForeignKey("users.id"), nullable=True)
    recipient_identifier = Column(String, nullable=False)
    status = Column(SQLEnum(AlertDeliveryStatus), default=AlertDeliveryStatus.SENT)
    delivery_channel = Column(String, default="APP_ZONE_BROADCAST")
    retry_count = Column(Integer, default=0, nullable=False)
    failure_reason = Column(String, nullable=True)
    acknowledged_at = Column(DateTime, nullable=True)
    recorded_at = Column(DateTime, default=utc_now)

    alert = relationship("NearbyVehicleAlert", back_populates="deliveries")


class ClientSubscription(Base):
    __tablename__ = "client_subscriptions"

    id = Column(String, primary_key=True, default=generate_uuid)
    client_uuid = Column(String, unique=True, index=True, nullable=False)
    zone = Column(String, default="ZONE-CENTRAL", index=True, nullable=False)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    is_simulation = Column(Boolean, default=True)  # Clearly labels test/simulation status
    last_active_at = Column(DateTime, default=utc_now, nullable=False)


class DeviceHeartbeat(Base):
    __tablename__ = "device_heartbeats"

    id = Column(String, primary_key=True, default=generate_uuid)
    device_id = Column(String, ForeignKey("registered_devices.id"), nullable=False)
    ip_address = Column(String, nullable=True)
    rssi = Column(Integer, nullable=True)
    free_heap = Column(Integer, nullable=True)
    uptime_seconds = Column(Integer, nullable=True)
    recorded_at = Column(DateTime, default=utc_now, index=True)

    device = relationship("RegisteredDevice", back_populates="heartbeats")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String, primary_key=True, default=generate_uuid)
    actor_user_id = Column(String, nullable=True)
    actor_role = Column(String, default="SYSTEM")
    action = Column(String, nullable=False)
    target_type = Column(String, nullable=False)
    target_id = Column(String, nullable=False)
    details = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=utc_now, index=True)


class AuditLedgerEntry(Base):
    """
    Append-only, tamper-evident cryptographic audit ledger.
    Each entry computes a SHA-256 hash chaining back to the previous entry hash.
    Documented for verifiable post-incident response analytics and integrity checking.
    """
    __tablename__ = "audit_ledger"

    id = Column(String, primary_key=True, default=generate_uuid)
    sequence_number = Column(Integer, unique=True, index=True, nullable=False)
    timestamp = Column(DateTime, default=utc_now, index=True, nullable=False)
    event_type = Column(String, index=True, nullable=False)
    actor = Column(String, default="SYSTEM", nullable=False)
    entity_id = Column(String, nullable=False)
    payload_json = Column(Text, nullable=False)
    previous_hash = Column(String, nullable=False)
    entry_hash = Column(String, index=True, nullable=False)

