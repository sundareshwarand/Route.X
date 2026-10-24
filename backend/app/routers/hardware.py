import json
from datetime import timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import (
    EmergencyRequest,
    Junction,
    Ambulance,
    JunctionEvent,
    DeviceHeartbeat,
    RegisteredDevice,
    RequestStatus,
    RequestSource,
    SignalState,
    Direction,
    utc_now
)
from ..schemas import (
    LoRaPacketEvent,
    JunctionAcknowledge,
    JunctionHeartbeat,
    PendingCommandResponse
)
from ..services.coordination_service import (
    calculate_message_hash,
    detect_conflicts,
    check_and_expire_requests,
    validate_status_transition,
    get_next_scheduled_command,
    advance_junction_queue
)

from ..services.alert_service import create_nearby_alert_for_request
from ..services.ws_manager import ws_manager

router = APIRouter(prefix="/hardware", tags=["Hardware Gateway"])


@router.post("/event", status_code=status.HTTP_201_CREATED)
async def receive_hardware_event(
    event: LoRaPacketEvent,
    response: Response,
    db: Session = Depends(get_db)
):
    """
    Receives and processes decoded LoRa packet forwarded by junction gateway.
    Distinguishes verified physical hardware from simulated test events.
    """
    check_and_expire_requests(db)

    # 1. Validate CRC
    if not event.crc_valid:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Malformed packet: CRC validation failed"
        )

    # 2. Validate Junction and Ambulance
    junction = db.query(Junction).filter(Junction.id == event.junction_id).first()
    if not junction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Junction '{event.junction_id}' not found"
        )

    ambulance = db.query(Ambulance).filter(Ambulance.id == event.amb).first()
    if not ambulance:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Ambulance '{event.amb}' not found in registry"
        )

    # 3. Duplicate check via sequence and hash
    msg_hash = calculate_message_hash(event.amb, event.junction_id, event.dir.value, event.seq)
    now = utc_now()
    duplicate = db.query(EmergencyRequest).filter(
        EmergencyRequest.message_hash == msg_hash,
        EmergencyRequest.status.in_([RequestStatus.RECEIVED, RequestStatus.PRIORITY_ACTIVE]),
        EmergencyRequest.expires_at > now
    ).first()

    if duplicate:
        response.status_code = status.HTTP_200_OK
        return {
            "status": "DUPLICATE_IGNORED",
            "request_id": duplicate.id,
            "message": "Duplicate LoRa packet within active window ignored"
        }

    # 4. Record Junction Event log
    j_event = JunctionEvent(
        junction_id=junction.id,
        event_type="LORA_PACKET_RECEIVED",
        source="PHYSICAL_LORA_GATEWAY" if event.is_hardware_verified else "SIMULATED_GATEWAY",
        is_verified_hardware=event.is_hardware_verified,
        payload=json.dumps(event.model_dump()),
        timestamp=now
    )
    db.add(j_event)

    # 5. Create Request starting in RECEIVED state (as junction has already received LoRa packet)
    duration_secs = 20
    expires_at = now + timedelta(seconds=duration_secs)

    new_req = EmergencyRequest(
        id=event.id if len(event.id) > 10 else None,
        ambulance_id=event.amb,
        junction_id=junction.id,
        direction=event.dir,
        status=RequestStatus.RECEIVED,
        source=RequestSource.PHYSICAL_LORA if event.is_hardware_verified else RequestSource.SIMULATED_TEST,
        message_sequence_id=event.seq,
        message_hash=msg_hash,
        is_verified_hardware=event.is_hardware_verified,
        duration_seconds=duration_secs,
        requested_at=now,
        acknowledged_at=now,
        expires_at=expires_at
    )
    db.add(new_req)
    db.commit()
    db.refresh(new_req)

    # 6. Generate advisory nearby-vehicle alert
    create_nearby_alert_for_request(db, new_req, is_simulation=not event.is_hardware_verified)

    # 7. Notify dashboard
    await ws_manager.broadcast("LORA_EVENT_RECEIVED", {
        "request_id": new_req.id,
        "ambulance_id": new_req.ambulance_id,
        "junction_id": new_req.junction_id,
        "direction": new_req.direction.value,
        "is_hardware_verified": new_req.is_verified_hardware
    })

    return {
        "status": "PROCESSED",
        "request_id": new_req.id,
        "state": new_req.status.value,
        "direction": new_req.direction.value
    }


@router.get("/pending-commands/{junction_id}", response_model=PendingCommandResponse)
def get_pending_commands_for_junction(junction_id: str, db: Session = Depends(get_db)):
    """
    Poll endpoint called by NodeMCU ESP8266 to retrieve waiting emergency transit commands.
    Respects multi-ambulance triage priority and non-preempting safe clearance sequences.
    """
    check_and_expire_requests(db)
    now = utc_now()

    pending_req = get_next_scheduled_command(db, junction_id)

    if not pending_req:
        return {"has_command": False}

    # If in PENDING, transition to RECEIVED as the junction gateway has fetched it
    if pending_req.status == RequestStatus.PENDING:
        pending_req.status = RequestStatus.RECEIVED
        pending_req.acknowledged_at = now
        db.commit()

    return {
        "has_command": True,
        "request_id": pending_req.id,
        "ambulance_id": pending_req.ambulance_id,
        "direction": pending_req.direction,
        "duration_seconds": pending_req.duration_seconds,
        "expires_at": pending_req.expires_at,
        "command_type": "ACTIVATE_PRIORITY"
    }


@router.post("/acknowledge")
async def acknowledge_command_execution(
    ack: JunctionAcknowledge,
    db: Session = Depends(get_db)
):
    """
    Called by NodeMCU ESP8266 when physical signal LEDs have switched state.
    Updates request lifecycle and junction state strictly upon confirmation.
    """
    check_and_expire_requests(db)
    req = db.query(EmergencyRequest).filter(EmergencyRequest.id == ack.request_id).first()
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")

    junction = db.query(Junction).filter(Junction.id == ack.junction_id).first()
    if not junction:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Junction not found")

    now = utc_now()

    # Validate state transition
    if not validate_status_transition(req.status, ack.status):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid transition from {req.status.value} to {ack.status.value}"
        )

    req.status = ack.status
    if ack.status == RequestStatus.PRIORITY_ACTIVE:
        req.activated_at = now
        junction.current_signal_state = SignalState.PRIORITY_ACTIVE
        junction.active_direction = ack.active_direction or req.direction
    elif ack.status in [RequestStatus.COMPLETED, RequestStatus.FAILED]:
        req.completed_at = now
        junction.current_signal_state = SignalState.NORMAL_CYCLE
        junction.active_direction = None
        # Advance queue to make next waiting vehicle available with safe clearance
        advance_junction_queue(db, ack.junction_id)

    if ack.is_hardware_verified:
        req.is_verified_hardware = True

    # Log junction event
    j_event = JunctionEvent(
        junction_id=junction.id,
        event_type=f"SIGNAL_STATE_{ack.status.value}",
        source="PHYSICAL_NODE_MCU" if ack.is_hardware_verified else "SIMULATION_TEST",
        is_verified_hardware=ack.is_hardware_verified,
        payload=json.dumps(ack.model_dump()),
        timestamp=now
    )
    db.add(j_event)
    db.commit()

    # Broadcast state change to dashboard
    await ws_manager.broadcast("SIGNAL_STATE_CHANGED", {
        "junction_id": junction.id,
        "signal_state": junction.current_signal_state.value,
        "active_direction": junction.active_direction.value if junction.active_direction else None,
        "request_id": req.id,
        "status": req.status.value,
        "is_hardware_verified": ack.is_hardware_verified
    })

    return {
        "status": "ACK_RECORDED",
        "request_id": req.id,
        "current_status": req.status.value,
        "junction_signal": junction.current_signal_state.value
    }


@router.post("/heartbeat")
def receive_heartbeat(
    hb: JunctionHeartbeat,
    db: Session = Depends(get_db)
):
    """
    Heartbeat and health telemetry from junction gateway.
    """
    now = utc_now()
    junction = db.query(Junction).filter(Junction.id == hb.junction_id).first()
    if junction:
        junction.is_online = True
        junction.last_heartbeat = now

    # Check registered device or create entry
    dev = db.query(RegisteredDevice).filter(RegisteredDevice.hardware_id == hb.hardware_id).first()
    if dev:
        record = DeviceHeartbeat(
            device_id=dev.id,
            ip_address=hb.ip_address,
            rssi=hb.wifi_rssi,
            free_heap=hb.free_heap,
            uptime_seconds=hb.uptime_seconds,
            recorded_at=now
        )
        db.add(record)

    db.commit()
    return {"status": "HEARTBEAT_ACK", "junction_id": hb.junction_id, "timestamp": now.isoformat()}
