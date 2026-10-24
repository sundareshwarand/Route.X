import csv
import io
import json
import hashlib
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import (
    EmergencyRequest,
    Junction,
    NearbyVehicleAlert,
    AuditLedgerEntry,
    RequestStatus,
    SignalState,
    utc_now
)
from ..schemas import (
    AnalyticsSummary,
    AuditLedgerEntryResponse,
    AuditVerificationResponse
)
from ..services.coordination_service import check_and_expire_requests
from ..config import settings

router = APIRouter(prefix="/analytics", tags=["Analytics"])


def format_timestamp(dt: datetime) -> str:
    if dt.tzinfo is not None:
        dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt.strftime("%Y-%m-%dT%H:%M:%S")


def compute_entry_hash(sequence_number: int, prev_hash: str, event_type: str, entity_id: str, payload_json: str, timestamp_str: str) -> str:
    raw = f"{sequence_number}:{prev_hash}:{event_type}:{entity_id}:{payload_json}:{timestamp_str}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def append_audit_ledger_entry(
    db: Session,
    event_type: str,
    actor: str,
    entity_id: str,
    payload: dict
) -> AuditLedgerEntry:
    last_entry = db.query(AuditLedgerEntry).order_by(AuditLedgerEntry.sequence_number.desc()).first()
    seq = (last_entry.sequence_number + 1) if last_entry else 1
    prev_hash = last_entry.entry_hash if last_entry else "0" * 64
    now = utc_now()
    payload_str = json.dumps(payload, sort_keys=True)
    ts_str = format_timestamp(now)
    entry_hash = compute_entry_hash(seq, prev_hash, event_type, entity_id, payload_str, ts_str)

    entry = AuditLedgerEntry(
        sequence_number=seq,
        timestamp=now,
        event_type=event_type,
        actor=actor,
        entity_id=entity_id,
        payload_json=payload_str,
        previous_hash=prev_hash,
        entry_hash=entry_hash
    )

    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.get("/summary", response_model=AnalyticsSummary)
def get_analytics_summary(db: Session = Depends(get_db)):
    check_and_expire_requests(db)

    total_reqs = db.query(EmergencyRequest).count()
    completed_reqs = db.query(EmergencyRequest).filter(EmergencyRequest.status == RequestStatus.COMPLETED).count()
    failed_reqs = db.query(EmergencyRequest).filter(EmergencyRequest.status == RequestStatus.FAILED).count()
    expired_reqs = db.query(EmergencyRequest).filter(EmergencyRequest.status == RequestStatus.EXPIRED).count()
    cancelled_reqs = db.query(EmergencyRequest).filter(EmergencyRequest.status == RequestStatus.CANCELLED).count()
    active_reqs = db.query(EmergencyRequest).filter(
        EmergencyRequest.status.in_([RequestStatus.PENDING, RequestStatus.RECEIVED, RequestStatus.PRIORITY_ACTIVE])
    ).count()

    # Calculate average acknowledgment duration (requested_at to acknowledged_at)
    acked_reqs = db.query(EmergencyRequest).filter(
        EmergencyRequest.acknowledged_at.isnot(None)
    ).all()
    ack_durations = [
        (r.acknowledged_at - r.requested_at).total_seconds()
        for r in acked_reqs
        if r.acknowledged_at > r.requested_at
    ]
    avg_ack_duration = round(sum(ack_durations) / len(ack_durations), 2) if ack_durations else 0.0

    # Calculate average priority duration (activated_at to completed_at)
    completed_with_active = db.query(EmergencyRequest).filter(
        EmergencyRequest.activated_at.isnot(None),
        EmergencyRequest.completed_at.isnot(None)
    ).all()
    prio_durations = [
        (r.completed_at - r.activated_at).total_seconds()
        for r in completed_with_active
        if r.completed_at > r.activated_at
    ]
    avg_prio_duration = round(sum(prio_durations) / len(prio_durations), 2) if prio_durations else 0.0

    total_alerts = db.query(NearbyVehicleAlert).count()

    total_junctions = db.query(Junction).count()
    now = utc_now()
    threshold = timedelta(seconds=settings.HEARTBEAT_TIMEOUT_SECONDS)
    all_junctions = db.query(Junction).all()
    online_count = sum(
        1 for j in all_junctions
        if j.last_heartbeat and (now - (j.last_heartbeat.replace(tzinfo=now.tzinfo) if j.last_heartbeat.tzinfo is None else j.last_heartbeat)) < threshold
    )

    hardware_verified_count = db.query(EmergencyRequest).filter(EmergencyRequest.is_verified_hardware == True).count()
    simulated_count = total_reqs - hardware_verified_count

    return {
        "total_requests": total_reqs,
        "completed_requests": completed_reqs,
        "failed_requests": failed_reqs,
        "expired_requests": expired_reqs,
        "cancelled_requests": cancelled_reqs,
        "active_requests": active_reqs,
        "avg_ack_duration_seconds": avg_ack_duration,
        "avg_priority_duration_seconds": avg_prio_duration,
        "total_alerts_issued": total_alerts,
        "online_junctions_count": online_count,
        "total_junctions_count": total_junctions,
        "hardware_verified_requests_count": hardware_verified_count,
        "simulated_requests_count": simulated_count
    }


@router.get("/export/csv")
def export_analytics_csv(
    ambulance_id: Optional[str] = None,
    junction_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Exports timestamped emergency response lifecycle events, priority clearances,
    and operational latencies into standard CSV format for post-incident audits.
    """
    check_and_expire_requests(db)
    query = db.query(EmergencyRequest)

    if ambulance_id:
        query = query.filter(EmergencyRequest.ambulance_id == ambulance_id)
    if junction_id:
        query = query.filter(EmergencyRequest.junction_id == junction_id)
    if start_date:
        try:
            dt_start = datetime.fromisoformat(start_date)
            query = query.filter(EmergencyRequest.requested_at >= dt_start)
        except Exception:
            pass
    if end_date:
        try:
            dt_end = datetime.fromisoformat(end_date)
            query = query.filter(EmergencyRequest.requested_at <= dt_end)
        except Exception:
            pass

    records = query.order_by(EmergencyRequest.requested_at.desc()).limit(1000).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "request_id",
        "ambulance_id",
        "junction_id",
        "direction",
        "triage_priority",
        "status",
        "source",
        "is_hardware_verified",
        "duration_seconds",
        "clearance_seconds",
        "requested_at",
        "acknowledged_at",
        "activated_at",
        "completed_at",
        "ack_latency_seconds",
        "priority_duration_seconds",
        "scheduling_reason"
    ])

    for r in records:
        ack_latency = (
            round((r.acknowledged_at - r.requested_at).total_seconds(), 2)
            if r.acknowledged_at and r.acknowledged_at > r.requested_at else ""
        )
        prio_duration = (
            round((r.completed_at - r.activated_at).total_seconds(), 2)
            if r.completed_at and r.activated_at and r.completed_at > r.activated_at else ""
        )

        writer.writerow([
            r.id,
            r.ambulance_id,
            r.junction_id,
            r.direction.value if r.direction else "",
            r.triage_priority.value if r.triage_priority else "STANDARD",
            r.status.value if r.status else "",
            r.source.value if r.source else "",
            "YES" if r.is_verified_hardware else "NO (SIMULATED)",
            r.duration_seconds,
            r.clearance_seconds,
            r.requested_at.isoformat() if r.requested_at else "",
            r.acknowledged_at.isoformat() if r.acknowledged_at else "",
            r.activated_at.isoformat() if r.activated_at else "",
            r.completed_at.isoformat() if r.completed_at else "",
            ack_latency,
            prio_duration,
            r.scheduling_reason or ""
        ])

    csv_data = output.getvalue()
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="routex_response_analytics.csv"'}
    )


@router.get("/audit-ledger", response_model=List[AuditLedgerEntryResponse])
def get_audit_ledger(limit: int = 100, db: Session = Depends(get_db)):
    """
    Returns cryptographically chained audit ledger entries.
    """
    return db.query(AuditLedgerEntry).order_by(AuditLedgerEntry.sequence_number.asc()).limit(limit).all()


@router.get("/audit-ledger/verify", response_model=AuditVerificationResponse)
def verify_audit_ledger_chain(db: Session = Depends(get_db)):
    """
    Verifies cryptographic SHA-256 hash chaining across all audit ledger entries.
    Confirms post-incident data has not been tampered with or altered.
    """
    entries = db.query(AuditLedgerEntry).order_by(AuditLedgerEntry.sequence_number.asc()).all()
    if not entries:
        return AuditVerificationResponse(
            total_entries=0,
            is_ledger_intact=True,
            broken_sequence_index=None,
            message="Audit ledger is empty (no entries recorded yet)."
        )

    prev_hash = "0" * 64
    for idx, e in enumerate(entries):
        expected_seq = idx + 1
        if e.sequence_number != expected_seq:
            return AuditVerificationResponse(
                total_entries=len(entries),
                is_ledger_intact=False,
                broken_sequence_index=e.sequence_number,
                message=f"Sequence gap detected at index {idx+1}. Expected #{expected_seq}, found #{e.sequence_number}."
            )

        if e.previous_hash != prev_hash:
            return AuditVerificationResponse(
                total_entries=len(entries),
                is_ledger_intact=False,
                broken_sequence_index=e.sequence_number,
                message=f"Cryptographic hash chain broken at sequence #{e.sequence_number}. Previous hash mismatch."
            )

        calculated_hash = compute_entry_hash(
            e.sequence_number,
            e.previous_hash,
            e.event_type,
            e.entity_id,
            e.payload_json,
            format_timestamp(e.timestamp)
        )

        if e.entry_hash != calculated_hash:
            return AuditVerificationResponse(
                total_entries=len(entries),
                is_ledger_intact=False,
                broken_sequence_index=e.sequence_number,
                message=f"Cryptographic payload tampering detected at sequence #{e.sequence_number}."
            )

        prev_hash = e.entry_hash

    return AuditVerificationResponse(
        total_entries=len(entries),
        is_ledger_intact=True,
        broken_sequence_index=None,
        message=f"All {len(entries)} cryptographic audit ledger entries verified successfully. Hash chain intact."
    )


@router.get("/export")
def export_diagnostics_report(db: Session = Depends(get_db)) -> Dict[str, Any]:
    check_and_expire_requests(db)
    summary = get_analytics_summary(db)
    requests = db.query(EmergencyRequest).order_by(EmergencyRequest.requested_at.desc()).limit(50).all()
    junctions = db.query(Junction).all()
    
    return {
        "generated_at": utc_now().isoformat(),
        "system": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "metrics": summary,
        "junctions": [
            {
                "id": j.id,
                "name": j.name,
                "zone": j.zone,
                "signal_state": j.current_signal_state.value,
                "last_heartbeat": j.last_heartbeat.isoformat() if j.last_heartbeat else None
            }
            for j in junctions
        ],
        "recent_requests": [
            {
                "id": r.id,
                "ambulance_id": r.ambulance_id,
                "junction_id": r.junction_id,
                "direction": r.direction.value,
                "status": r.status.value,
                "source": r.source.value,
                "is_hardware_verified": r.is_verified_hardware,
                "requested_at": r.requested_at.isoformat()
            }
            for r in requests
        ]
    }

