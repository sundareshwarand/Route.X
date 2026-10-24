import json
from datetime import timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import (
    JunctionEvent,
    EmergencyRequest,
    Junction,
    DeviceHeartbeat,
    RegisteredDevice,
    utc_now
)
from ..schemas import ReliabilityMetricSummary
from ..services.coordination_service import check_and_expire_requests

router = APIRouter(prefix="/reliability", tags=["Communication Reliability"])


def compute_reliability_metrics(db: Session, junction_id: Optional[str] = None) -> ReliabilityMetricSummary:
    check_and_expire_requests(db)
    now = utc_now()
    window = now - timedelta(hours=24)

    # 1. Query LoRa events in window
    event_query = db.query(JunctionEvent).filter(
        JunctionEvent.timestamp >= window,
        JunctionEvent.event_type.in_(["LORA_PACKET_RECEIVED", "LORA_PACKET_DUPLICATE", "LORA_PACKET_CRC_ERROR"])
    )
    if junction_id:
        event_query = event_query.filter(JunctionEvent.junction_id == junction_id)
    events = event_query.all()

    total_lora = len(events)
    crc_failures = sum(1 for e in events if e.event_type == "LORA_PACKET_CRC_ERROR")
    duplicate_packets = sum(1 for e in events if e.event_type == "LORA_PACKET_DUPLICATE")
    valid_packets = total_lora - crc_failures

    # Packet delivery rate
    if total_lora > 0:
        delivery_rate = round((valid_packets / total_lora) * 100.0, 1)
    else:
        delivery_rate = 100.0

    # Extract RSSI and SNR from verified hardware events
    hardware_events = [e for e in events if e.is_verified_hardware]
    rssi_values = []
    snr_values = []

    for e in hardware_events:
        if e.payload:
            try:
                data = json.loads(e.payload)
                if data.get("rssi") is not None:
                    rssi_values.append(float(data["rssi"]))
                if data.get("snr") is not None:
                    snr_values.append(float(data["snr"]))
            except Exception:
                pass

    avg_rssi = round(sum(rssi_values) / len(rssi_values), 1) if rssi_values else None
    avg_snr = round(sum(snr_values) / len(snr_values), 2) if snr_values else None

    # Ack latency from emergency requests
    req_query = db.query(EmergencyRequest).filter(
        EmergencyRequest.requested_at >= window,
        EmergencyRequest.acknowledged_at.isnot(None)
    )
    if junction_id:
        req_query = req_query.filter(EmergencyRequest.junction_id == junction_id)
    requests = req_query.all()

    latencies_ms = [
        (r.acknowledged_at - r.requested_at).total_seconds() * 1000.0
        for r in requests
        if r.acknowledged_at > r.requested_at
    ]
    avg_latency = round(sum(latencies_ms) / len(latencies_ms), 1) if latencies_ms else None

    # Heartbeat freshness
    heartbeat_freshness = None
    if junction_id:
        j = db.query(Junction).filter(Junction.id == junction_id).first()
        if j and j.last_heartbeat:
            hb_time = j.last_heartbeat.replace(tzinfo=now.tzinfo) if j.last_heartbeat.tzinfo is None else j.last_heartbeat
            heartbeat_freshness = max(0, int((now - hb_time).total_seconds()))
    else:
        latest_hb = db.query(DeviceHeartbeat).order_by(DeviceHeartbeat.recorded_at.desc()).first()
        if latest_hb:
            hb_time = latest_hb.recorded_at.replace(tzinfo=now.tzinfo) if latest_hb.recorded_at.tzinfo is None else latest_hb.recorded_at
            heartbeat_freshness = max(0, int((now - hb_time).total_seconds()))

    is_hw = len(hardware_events) > 0

    if is_hw:
        status_label = "OPTIMAL (HARDWARE VERIFIED)" if delivery_rate >= 90.0 else "DEGRADED (HIGH LOSS)"
    else:
        status_label = "ACTIVE BENCHMARK (SIMULATED STREAM)"

    notes = (
        f"Delivery rate: {delivery_rate}%. "
        f"Verified physical LoRa frames: {len(hardware_events)}/{total_lora}. "
        f"{'Physical RF telemetry active.' if is_hw else 'Advisory test stream active; connect physical ESP32/ESP8266 transceiver for live RF signal analysis.'}"
    )

    return ReliabilityMetricSummary(
        junction_id=junction_id,
        total_lora_packets=total_lora,
        valid_packets=valid_packets,
        crc_failures=crc_failures,
        duplicate_packets=duplicate_packets,
        packet_delivery_rate=delivery_rate,
        avg_hardware_rssi=avg_rssi,
        avg_hardware_snr=avg_snr,
        avg_ack_latency_ms=avg_latency,
        heartbeat_freshness_seconds=heartbeat_freshness,
        is_hardware_stream=is_hw,
        status_label=status_label,
        notes=notes
    )


@router.get("/summary", response_model=ReliabilityMetricSummary)
def get_system_reliability_summary(db: Session = Depends(get_db)):
    """
    Returns system-wide communication reliability metrics across all gateways.
    """
    return compute_reliability_metrics(db)


@router.get("/junction/{junction_id}", response_model=ReliabilityMetricSummary)
def get_junction_reliability(junction_id: str, db: Session = Depends(get_db)):
    """
    Returns junction-specific RF telemetry and communication health metrics.
    """
    junction = db.query(Junction).filter(Junction.id == junction_id).first()
    if not junction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Junction '{junction_id}' not found"
        )
    return compute_reliability_metrics(db, junction_id=junction_id)
