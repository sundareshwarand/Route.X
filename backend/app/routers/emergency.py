from datetime import timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import (
    EmergencyRequest,
    Ambulance,
    AmbulanceStatus,
    Junction,
    User,
    UserRole,
    RequestStatus,
    RequestSource,
    SignalState,
    AuditLog,
    utc_now
)
from ..schemas import (
    EmergencyRequestCreate,
    EmergencyRequestResponse,
    EmergencyRequestCancel,
    JunctionQueueResponse,
    JunctionQueueReorderRequest
)
from ..auth import get_current_user
from ..services.coordination_service import (
    calculate_message_hash,
    detect_conflicts,
    check_and_expire_requests,
    validate_status_transition,
    schedule_junction_queue,
    get_junction_queue_state,
    advance_junction_queue
)
from ..services.alert_service import create_nearby_alert_for_request
from ..services.ws_manager import ws_manager
from .analytics import append_audit_ledger_entry

router = APIRouter(prefix="/emergency", tags=["Emergency Requests"])




@router.post("/requests", response_model=EmergencyRequestResponse, status_code=status.HTTP_201_CREATED)
@router.post("/request", response_model=EmergencyRequestResponse, status_code=status.HTTP_201_CREATED)
async def create_emergency_request(
    req_in: EmergencyRequestCreate,
    current_user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Expire old requests first
    check_and_expire_requests(db)

    # 1. Validate ambulance and junction
    ambulance = db.query(Ambulance).filter(Ambulance.id == req_in.ambulance_id).first()
    if not ambulance:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Ambulance '{req_in.ambulance_id}' not found in registry"
        )

    if ambulance.status == AmbulanceStatus.MAINTENANCE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Ambulance '{req_in.ambulance_id}' is currently under MAINTENANCE and unavailable for dispatch."
        )

    junction = db.query(Junction).filter(Junction.id == req_in.junction_id).first()
    if not junction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Junction '{req_in.junction_id}' not found in registry"
        )

    # 2. Duplicate Detection
    msg_hash = calculate_message_hash(req_in.ambulance_id, req_in.junction_id, req_in.direction.value)
    now = utc_now()
    duplicate = db.query(EmergencyRequest).filter(
        EmergencyRequest.message_hash == msg_hash,
        EmergencyRequest.status.in_([RequestStatus.PENDING, RequestStatus.RECEIVED, RequestStatus.PRIORITY_ACTIVE]),
        EmergencyRequest.expires_at > now
    ).first()

    if duplicate:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Duplicate active emergency request detected for {req_in.ambulance_id} at {req_in.junction_id}. Request ID: {duplicate.id}"
        )

    # 3. Conflict Detection
    conflicts = detect_conflicts(db, req_in.junction_id, req_in.direction)
    is_conflicted = len(conflicts) > 0

    expires_at = now + timedelta(seconds=req_in.duration_seconds)
    
    # New request begins in PENDING status with configurable triage priority & clearance
    new_request = EmergencyRequest(
        ambulance_id=req_in.ambulance_id,
        junction_id=req_in.junction_id,
        direction=req_in.direction,
        status=RequestStatus.PENDING,
        source=req_in.source,
        triage_priority=req_in.triage_priority,
        estimated_arrival_seconds=req_in.estimated_arrival_seconds,
        clearance_seconds=req_in.clearance_seconds,
        message_hash=msg_hash,
        is_verified_hardware=False,
        duration_seconds=req_in.duration_seconds,
        requested_at=now,
        expires_at=expires_at
    )
    db.add(new_request)
    ambulance.status = AmbulanceStatus.EN_ROUTE
    db.commit()
    db.refresh(new_request)

    # Immediately run multi-ambulance queue scheduling to establish priority position & reasons
    schedule_junction_queue(db, req_in.junction_id)
    db.refresh(new_request)

    # Create associated advisory nearby-vehicle alert (clearly marked as test simulation)
    create_nearby_alert_for_request(db, new_request, is_simulation=True)

    # Log audit entry
    actor_id = current_user.id if current_user else "SYSTEM_APP"
    audit = AuditLog(
        actor_user_id=actor_id,
        actor_role=current_user.role.value if current_user else "DRIVER_OR_APP",
        action="CREATE_EMERGENCY_REQUEST",
        target_type="EmergencyRequest",
        target_id=new_request.id,
        details=f"Direction: {new_request.direction.value}, Triage: {new_request.triage_priority.value}, Junction: {new_request.junction_id}, Conflicted: {is_conflicted}"
    )
    db.add(audit)
    db.commit()

    # Append to tamper-evident cryptographic audit ledger
    append_audit_ledger_entry(
        db=db,
        event_type="EMERGENCY_REQUEST_INITIATED",
        actor=current_user.email if current_user else "MOBILE_APP",
        entity_id=new_request.id,
        payload={
            "ambulance_id": new_request.ambulance_id,
            "junction_id": new_request.junction_id,
            "direction": new_request.direction.value,
            "triage_priority": new_request.triage_priority.value,
            "scheduling_reason": new_request.scheduling_reason
        }
    )

    # Broadcast event via WebSockets

    await ws_manager.broadcast("EMERGENCY_REQUEST_CREATED", {
        "request_id": new_request.id,
        "ambulance_id": new_request.ambulance_id,
        "junction_id": new_request.junction_id,
        "direction": new_request.direction.value,
        "triage_priority": new_request.triage_priority.value,
        "status": new_request.status.value,
        "is_conflicted": is_conflicted,
        "scheduling_reason": new_request.scheduling_reason
    })

    return new_request


@router.get("/junction/{junction_id}/queue", response_model=JunctionQueueResponse)
def get_junction_queue(junction_id: str, db: Session = Depends(get_db)):
    """
    Returns the real-time queue state at a junction, including the active priority vehicle
    and pending vehicles ordered by triage priority and ETA with explicit scheduling reasons.
    """
    junction = db.query(Junction).filter(Junction.id == junction_id).first()
    if not junction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Junction '{junction_id}' not found"
        )
    return get_junction_queue_state(db, junction_id)


@router.post("/junction/{junction_id}/queue/reorder", response_model=JunctionQueueResponse)
async def reorder_junction_queue(
    junction_id: str,
    payload: JunctionQueueReorderRequest,
    current_user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Allows a traffic control operator to manually adjust queue priorities with a documented operational reason.
    """
    junction = db.query(Junction).filter(Junction.id == junction_id).first()
    if not junction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Junction '{junction_id}' not found"
        )

    for rank, req_id in enumerate(payload.request_ids):
        req = db.query(EmergencyRequest).filter(
            EmergencyRequest.id == req_id,
            EmergencyRequest.junction_id == junction_id,
            EmergencyRequest.status == RequestStatus.PENDING
        ).first()
        if req:
            req.scheduling_reason = f"Manual operator override #{rank+1}: {payload.reason}"
    db.commit()

    # Log audit entry
    actor_id = current_user.id if current_user else "DISPATCH_OPERATOR"
    audit = AuditLog(
        actor_user_id=actor_id,
        actor_role=current_user.role.value if current_user else "OPERATOR",
        action="REORDER_JUNCTION_QUEUE",
        target_type="Junction",
        target_id=junction_id,
        details=f"Reason: {payload.reason}, Reordered IDs: {payload.request_ids}"
    )
    db.add(audit)
    db.commit()

    state = get_junction_queue_state(db, junction_id)
    await ws_manager.broadcast("JUNCTION_QUEUE_UPDATED", {
        "junction_id": junction_id,
        "queue_length": state["queue_length"]
    })
    return state



@router.get("/requests", response_model=List[EmergencyRequestResponse])
def list_emergency_requests(
    ambulance_id: Optional[str] = None,
    junction_id: Optional[str] = None,
    status_filter: Optional[RequestStatus] = None,
    db: Session = Depends(get_db)
):
    check_and_expire_requests(db)
    query = db.query(EmergencyRequest)
    if ambulance_id:
        query = query.filter(EmergencyRequest.ambulance_id == ambulance_id)
    if junction_id:
        query = query.filter(EmergencyRequest.junction_id == junction_id)
    if status_filter:
        query = query.filter(EmergencyRequest.status == status_filter)
    return query.order_by(EmergencyRequest.requested_at.desc()).limit(100).all()


@router.get("/requests/{request_id}", response_model=EmergencyRequestResponse)
def get_emergency_request(request_id: str, db: Session = Depends(get_db)):
    check_and_expire_requests(db)
    req = db.query(EmergencyRequest).filter(EmergencyRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Emergency request not found")
    return req


@router.post("/requests/{request_id}/cancel", response_model=EmergencyRequestResponse)
async def cancel_emergency_request(
    request_id: str,
    payload: EmergencyRequestCancel,
    current_user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    req = db.query(EmergencyRequest).filter(EmergencyRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Emergency request not found")

    if not validate_status_transition(req.status, RequestStatus.CANCELLED):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot cancel request in terminal status '{req.status.value}'"
        )

    now = utc_now()
    req.status = RequestStatus.CANCELLED
    req.cancellation_reason = payload.cancellation_reason
    req.completed_at = now

    # If it was actively holding priority, safely reset junction signal to NORMAL_CYCLE
    junction = db.query(Junction).filter(Junction.id == req.junction_id).first()
    if junction and junction.current_signal_state == SignalState.PRIORITY_ACTIVE:
        other_active = db.query(EmergencyRequest).filter(
            EmergencyRequest.junction_id == junction.id,
            EmergencyRequest.status == RequestStatus.PRIORITY_ACTIVE,
            EmergencyRequest.id != req.id
        ).first()
        if not other_active:
            junction.current_signal_state = SignalState.NORMAL_CYCLE
            junction.active_direction = None

    # Revert ambulance to IDLE if no other active requests remain
    other_active_amb = db.query(EmergencyRequest).filter(
        EmergencyRequest.ambulance_id == req.ambulance_id,
        EmergencyRequest.id != req.id,
        EmergencyRequest.status.in_([RequestStatus.PENDING, RequestStatus.RECEIVED, RequestStatus.PRIORITY_ACTIVE]),
        EmergencyRequest.expires_at > now
    ).first()
    if not other_active_amb:
        amb = db.query(Ambulance).filter(Ambulance.id == req.ambulance_id).first()
        if amb and amb.status != AmbulanceStatus.MAINTENANCE:
            amb.status = AmbulanceStatus.IDLE

    db.commit()
    db.refresh(req)

    await ws_manager.broadcast("EMERGENCY_REQUEST_CANCELLED", {
        "request_id": req.id,
        "reason": payload.cancellation_reason
    })
    return req


@router.post("/requests/{request_id}/complete", response_model=EmergencyRequestResponse)
async def complete_emergency_request(
    request_id: str,
    current_user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Marks an emergency request as safely completed upon arrival at destination receiving facility.
    Safely releases any priority green holds and advances queue.
    """
    req = db.query(EmergencyRequest).filter(EmergencyRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Emergency request not found")

    now = utc_now()
    req.status = RequestStatus.COMPLETED
    req.completed_at = now

    junction = db.query(Junction).filter(Junction.id == req.junction_id).first()
    if junction and junction.current_signal_state == SignalState.PRIORITY_ACTIVE:
        other_active = db.query(EmergencyRequest).filter(
            EmergencyRequest.junction_id == junction.id,
            EmergencyRequest.status == RequestStatus.PRIORITY_ACTIVE,
            EmergencyRequest.id != req.id
        ).first()
        if not other_active:
            junction.current_signal_state = SignalState.NORMAL_CYCLE
            junction.active_direction = None

    # Revert ambulance to IDLE if no other active requests remain
    other_active_amb = db.query(EmergencyRequest).filter(
        EmergencyRequest.ambulance_id == req.ambulance_id,
        EmergencyRequest.id != req.id,
        EmergencyRequest.status.in_([RequestStatus.PENDING, RequestStatus.RECEIVED, RequestStatus.PRIORITY_ACTIVE]),
        EmergencyRequest.expires_at > now
    ).first()
    if not other_active_amb:
        amb = db.query(Ambulance).filter(Ambulance.id == req.ambulance_id).first()
        if amb and amb.status != AmbulanceStatus.MAINTENANCE:
            amb.status = AmbulanceStatus.IDLE

    db.commit()
    db.refresh(req)

    # Advance any waiting queue
    advance_junction_queue(db, req.junction_id)

    await ws_manager.broadcast("EMERGENCY_REQUEST_COMPLETED", {
        "request_id": req.id,
        "completed_at": now.isoformat()
    })
    return req

