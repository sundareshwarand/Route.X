from datetime import datetime
from typing import Optional, List, Any
from pydantic import BaseModel, EmailStr, Field, ConfigDict
from .models import (
    UserRole,
    AmbulanceStatus,
    SignalState,
    Direction,
    RequestStatus,
    RequestSource,
    DeviceType,
    AlertDeliveryStatus,
    TriagePriority
)



# ===================== USER SCHEMAS =====================
class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    role: UserRole = UserRole.CITIZEN


class UserCreate(UserBase):
    password: str = Field(min_length=6)


class UserResponse(UserBase):
    id: str
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse


class TokenData(BaseModel):
    email: Optional[str] = None
    role: Optional[str] = None
    user_id: Optional[str] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


# ===================== AMBULANCE SCHEMAS =====================
class AmbulanceBase(BaseModel):
    id: str
    call_sign: str
    plate_number: str
    vehicle_type: str = "Advanced Life Support"
    status: AmbulanceStatus = AmbulanceStatus.IDLE
    base_station: str = "Central Station"
    assigned_driver_id: Optional[str] = None


class AmbulanceCreate(AmbulanceBase):
    pass


class AmbulanceStatusUpdate(BaseModel):
    status: AmbulanceStatus


class AmbulanceResponse(AmbulanceBase):
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ===================== JUNCTION SCHEMAS =====================
class JunctionBase(BaseModel):
    id: str
    name: str
    code: str
    latitude: float
    longitude: float
    zone: str = "ZONE-CENTRAL"


class JunctionCreate(JunctionBase):
    pass


class JunctionResponse(JunctionBase):
    current_signal_state: SignalState
    active_direction: Optional[Direction] = None
    is_online: bool
    last_heartbeat: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ===================== EMERGENCY REQUEST SCHEMAS =====================
class EmergencyRequestCreate(BaseModel):
    ambulance_id: str
    junction_id: str
    direction: Direction
    duration_seconds: int = Field(default=20, ge=5, le=120)
    source: RequestSource = RequestSource.MOBILE_APP
    triage_priority: TriagePriority = TriagePriority.STANDARD
    estimated_arrival_seconds: int = Field(default=0, ge=0)
    clearance_seconds: int = Field(default=3, ge=1, le=10)


class EmergencyRequestCancel(BaseModel):
    cancellation_reason: str = "Driver or Operator cancelled priority request."


class EmergencyRequestResponse(BaseModel):
    id: str
    ambulance_id: str
    junction_id: str
    direction: Direction
    status: RequestStatus
    source: RequestSource
    triage_priority: TriagePriority = TriagePriority.STANDARD
    estimated_arrival_seconds: int = 0
    scheduling_reason: Optional[str] = None
    clearance_seconds: int = 3
    message_sequence_id: Optional[int] = None
    is_verified_hardware: bool
    duration_seconds: int
    requested_at: datetime
    acknowledged_at: Optional[datetime] = None
    activated_at: Optional[datetime] = None
    expires_at: datetime
    completed_at: Optional[datetime] = None
    cancellation_reason: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)



# ===================== HARDWARE & GATEWAY SCHEMAS =====================
class LoRaPacketEvent(BaseModel):
    ver: int = 1
    id: str  # Packet/request UUID
    amb: str  # Ambulance ID e.g. "AMB-01"
    dir: Direction  # "LEFT", "STRAIGHT", "RIGHT"
    seq: int  # Sequence number
    ts: int  # Board timestamp/ticks
    junction_id: str  # Target junction or receiving junction ID
    rssi: Optional[int] = None
    snr: Optional[float] = None
    crc_valid: bool = True
    is_hardware_verified: bool = True


class JunctionAcknowledge(BaseModel):
    request_id: str
    junction_id: str
    status: RequestStatus  # e.g. RECEIVED or PRIORITY_ACTIVE or COMPLETED
    signal_state: SignalState  # e.g. PRIORITY_ACTIVE or NORMAL_CYCLE
    active_direction: Optional[Direction] = None
    execution_notes: Optional[str] = None
    is_hardware_verified: bool = True


class JunctionHeartbeat(BaseModel):
    hardware_id: str
    junction_id: str
    ip_address: Optional[str] = None
    free_heap: Optional[int] = None
    uptime_seconds: Optional[int] = None
    wifi_rssi: Optional[int] = None
    firmware_version: Optional[str] = "1.0.0"


class PendingCommandResponse(BaseModel):
    has_command: bool
    request_id: Optional[str] = None
    ambulance_id: Optional[str] = None
    direction: Optional[Direction] = None
    duration_seconds: Optional[int] = None
    expires_at: Optional[datetime] = None
    command_type: Optional[str] = None  # "ACTIVATE_PRIORITY" or "REVERT_NORMAL"


# ===================== MULTI-DEVICE CLOUD SCHEMAS =====================
class DeviceResponse(BaseModel):
    id: str
    hardware_id: str
    device_type: DeviceType
    name: Optional[str] = None
    role: str = "AMBULANCE"
    is_active: bool = True
    connection_status: str = "OFFLINE"
    health_status: str = "HEALTHY"
    last_seen_at: Optional[datetime] = None
    ip_address: Optional[str] = None
    firmware_version: Optional[str] = "1.0.0"
    junction_id: Optional[str] = None
    ambulance_id: Optional[str] = None
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class DeviceRegisterRequest(BaseModel):
    hardware_id: str
    device_type: DeviceType
    name: Optional[str] = None
    role: str = "AMBULANCE"
    device_key: Optional[str] = None
    junction_id: Optional[str] = None
    ambulance_id: Optional[str] = None


class AmbulanceTelemetryRequest(BaseModel):
    hardware_id: str
    device_key: str
    ambulance_id: str
    latitude: float
    longitude: float
    speed_kmh: float = 0.0
    heading_deg: float = 0.0
    emergency_active: bool = False
    target_junction_id: Optional[str] = None
    target_direction: Optional[Direction] = None
    battery_level: Optional[int] = None
    timestamp: Optional[datetime] = None
    idempotency_key: Optional[str] = None


class AmbulanceTelemetryResponse(BaseModel):
    status: str
    ambulance_id: str
    latitude: float
    longitude: float
    speed_kmh: float
    emergency_active: bool
    is_stale: bool
    server_time: datetime


# ===================== NEARBY VEHICLE ALERTS =====================
class NearbyVehicleAlertResponse(BaseModel):
    id: str
    request_id: str
    junction_id: str
    zone: str
    message: str
    approach_direction: Direction
    is_test_simulation: bool
    expires_at: datetime
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AlertDeliveryRecord(BaseModel):
    alert_id: str
    recipient_identifier: str
    delivery_status: AlertDeliveryStatus = AlertDeliveryStatus.SENT
    channel: str = "APP_ZONE_BROADCAST"


class AlertDeliveryAckRequest(BaseModel):
    client_identifier: str


class AlertDeliveryResponse(BaseModel):
    id: str
    alert_id: str
    recipient_identifier: str
    status: AlertDeliveryStatus
    retry_count: int
    failure_reason: Optional[str] = None
    acknowledged_at: Optional[datetime] = None
    recorded_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ClientSubscriptionCreate(BaseModel):
    client_uuid: str
    zone: str = "ZONE-CENTRAL"
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    is_simulation: bool = True


class ClientSubscriptionResponse(BaseModel):
    id: str
    client_uuid: str
    zone: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    is_simulation: bool
    last_active_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ProximityCheckRequest(BaseModel):
    client_latitude: float
    client_longitude: float
    max_radius_meters: float = Field(default=1000.0, ge=10.0, le=50000.0)


class ProximityCheckResponse(BaseModel):
    has_nearby_emergency: bool
    distance_meters: Optional[float] = None
    alert: Optional[NearbyVehicleAlertResponse] = None
    is_simulated_proximity: bool = True
    disclaimer: str = "Advisory test simulation only. Does not represent actual consumer vehicle detection."


# ===================== ANALYTICS SCHEMAS =====================
class AnalyticsSummary(BaseModel):
    total_requests: int
    completed_requests: int
    failed_requests: int
    expired_requests: int
    cancelled_requests: int
    active_requests: int
    avg_ack_duration_seconds: float
    avg_priority_duration_seconds: float
    total_alerts_issued: int
    online_junctions_count: int
    total_junctions_count: int
    hardware_verified_requests_count: int
    simulated_requests_count: int


# ===================== HOSPITAL & ROUTING SCHEMAS =====================
class HospitalResponse(BaseModel):
    id: str
    name: str
    junction_id: str
    latitude: float
    longitude: float
    readiness_status: str
    available_icu_beds: int
    total_icu_beds: int
    specialties: List[str] = []
    is_accepting_emergencies: bool = True
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ShortestPathRequest(BaseModel):
    start_junction_id: str
    destination_junction_id: str


class ShortestPathResponse(BaseModel):
    start_junction: str
    destination_junction: str
    path: List[str]
    total_distance_meters: float
    estimated_travel_time_seconds: float
    junction_details: List[dict]


class CongestedEdge(BaseModel):
    from_junction: str
    to_junction: str
    congestion_multiplier: float = Field(default=2.5, ge=1.0, le=10.0)


class RouteComparisonRequest(BaseModel):
    start_junction_id: str
    destination_junction_id: Optional[str] = None
    destination_hospital_id: Optional[str] = None
    congested_edges: Optional[List[CongestedEdge]] = None


class RouteOption(BaseModel):
    name: str
    path: List[str]
    total_distance_meters: float
    estimated_travel_time_seconds: float
    has_congestion: bool
    congested_segments: List[str] = []
    junction_details: List[dict] = []


class RouteComparisonResponse(BaseModel):
    start_junction: str
    destination_junction: str
    destination_hospital: Optional[dict] = None
    standard_distance_route: RouteOption
    traffic_optimized_route: RouteOption
    time_saved_seconds: float
    recommendation: str
    decision_rationale: str
    algorithm_type: str = "Dijkstra Graph Shortest-Path / Weighted Edge Transit Model"
    is_simulated: bool = True


# ===================== QUEUE & CONFLICT SCHEMAS =====================
class JunctionQueueItem(BaseModel):
    request_id: str
    ambulance_id: str
    direction: Direction
    triage_priority: TriagePriority
    estimated_arrival_seconds: int
    scheduling_reason: Optional[str] = None
    status: RequestStatus
    requested_at: datetime
    is_active_priority: bool = False

    model_config = ConfigDict(from_attributes=True)


class JunctionQueueResponse(BaseModel):
    junction_id: str
    current_signal_state: SignalState
    active_direction: Optional[Direction] = None
    queue_length: int
    active_request: Optional[JunctionQueueItem] = None
    queued_requests: List[JunctionQueueItem]


class JunctionQueueReorderRequest(BaseModel):
    request_ids: List[str]
    reason: str = "Operator manual triage priority override"


# ===================== RELIABILITY MONITOR SCHEMAS =====================
class ReliabilityMetricSummary(BaseModel):
    junction_id: Optional[str] = None
    total_lora_packets: int
    valid_packets: int
    crc_failures: int
    duplicate_packets: int
    packet_delivery_rate: float
    avg_hardware_rssi: Optional[float] = None
    avg_hardware_snr: Optional[float] = None
    avg_ack_latency_ms: Optional[float] = None
    heartbeat_freshness_seconds: Optional[int] = None
    is_hardware_stream: bool
    status_label: str
    notes: str


# ===================== AUDIT LEDGER SCHEMAS =====================
class AuditLedgerEntryResponse(BaseModel):
    id: str
    sequence_number: int
    timestamp: datetime
    event_type: str
    actor: str
    entity_id: str
    payload_json: str
    previous_hash: str
    entry_hash: str

    model_config = ConfigDict(from_attributes=True)


class AuditVerificationResponse(BaseModel):
    total_entries: int
    is_ledger_intact: bool
    broken_sequence_index: Optional[int] = None
    message: str

