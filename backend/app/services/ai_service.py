import logging
import os
from pathlib import Path
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field

from ..config import settings

logger = logging.getLogger("routex.ai")

# System safety directive prepended to every prompt
AI_SAFETY_DIRECTIVE = (
    "You are RouteX AI Advisor, an expert emergency transit and municipal traffic operations assistant. "
    "SAFETY DIRECTIVE: Your insights are STRICTLY ADVISORY. You NEVER directly actuate traffic signals, "
    "never bypass safety clearance intervals (such as mandatory 2.0s all-red phases), and never contradict "
    "deterministic conflict resolution protocols. Keep your analysis concise, professional, and operational."
)


class AIStatusResponse(BaseModel):
    is_configured: bool
    model: str
    provider: str = "Google Gemini"
    status_label: str
    disclaimer: str = (
        "RouteX AI Advisory insights are informational and supplementary. "
        "Deterministic traffic signal controllers and all-red clearance intervals remain authoritative."
    )


class RouteExplanationRequest(BaseModel):
    origin: str = Field(..., min_length=2, max_length=100)
    destination: str = Field(..., min_length=2, max_length=100)
    calculated_distance_meters: float = Field(..., ge=0)
    estimated_transit_seconds: float = Field(..., ge=0)
    route_junctions: List[str] = Field(..., min_length=1)
    congestion_detected: bool = False
    bottleneck_link: Optional[str] = None
    diversion_taken: bool = False
    priority_level: Optional[str] = "NORMAL"


class IncidentSummaryRequest(BaseModel):
    request_id: str = Field(..., min_length=1, max_length=64)
    ambulance_call_sign: str = Field(..., min_length=2, max_length=64)
    triage_priority: str = Field(..., min_length=2, max_length=32)
    start_junction: str = Field(..., min_length=2, max_length=32)
    target_junction: str = Field(..., min_length=2, max_length=32)
    total_duration_seconds: Optional[float] = 0.0
    status: str = Field(..., min_length=2, max_length=32)
    scheduling_reason: Optional[str] = None
    contending_vehicles_count: Optional[int] = 0


class AIAdvisoryResponse(BaseModel):
    status: str  # "SUCCESS", "UNCONFIGURED", "ERROR", "FALLBACK"
    is_configured: bool
    is_advisory: bool = True
    model_used: Optional[str] = None
    summary: str
    key_observations: List[str] = Field(default_factory=list)
    safety_recommendations: List[str] = Field(default_factory=list)
    raw_response: Optional[str] = None


class GeminiAIService:
    """
    Secure client service for Google Gemini API integration.
    Only passes minimal operational metadata; never transmits secrets or patient PII.
    """

    def __init__(self):
        self._client = None

    def _get_api_key(self) -> str:
        # Check settings first, then environment variable fallback
        key = settings.GEMINI_API_KEY or os.environ.get("GEMINI_API_KEY", "") or os.environ.get("ROUTEX_GEMINI_API_KEY", "")
        if not key:
            try:
                env_file = Path(__file__).resolve().parent.parent.parent / ".env"
                if env_file.exists():
                    with open(env_file, "r", encoding="utf-8") as f:
                        for line in f:
                            line = line.strip()
                            if line.startswith("GEMINI_API_KEY=") or line.startswith("ROUTEX_GEMINI_API_KEY="):
                                _, _, val = line.partition("=")
                                key = val.strip().strip('"').strip("'")
                                break
            except Exception:
                pass
        return key.strip()

    def is_configured(self) -> bool:
        key = self._get_api_key()
        if not key or len(key) < 10:
            return False
        lower_key = key.lower()
        if any(lower_key.startswith(p) for p in ["replace-", "your_", "placeholder", "dummy", "<", "entered_locally"]):
            return False
        return True

    def get_status(self) -> AIStatusResponse:
        configured = self.is_configured()
        return AIStatusResponse(
            is_configured=configured,
            model=settings.GEMINI_MODEL,
            provider="Google Gemini",
            status_label="ACTIVE (Advisory Mode)" if configured else "UNCONFIGURED (Deterministic Only)"
        )

    def _get_client(self):
        key = self._get_api_key()
        if not key:
            return None
        try:
            from google import genai
            return genai.Client(api_key=key)
        except Exception as e:
            logger.error("Failed to initialize Google GenAI Client: %s", str(e))
            return None

    def explain_route(self, req: RouteExplanationRequest) -> AIAdvisoryResponse:
        """
        Explains why a specific emergency route was chosen by the Dijkstra graph engine,
        highlighting bottleneck mitigations or corridor clearances.
        """
        if not self.is_configured():
            # Return graceful deterministic fallback explanation
            return self._build_deterministic_route_fallback(req, unconfigured=True)

        try:
            client = self._get_client()
            if not client:
                return self._build_deterministic_route_fallback(req, error="Client initialization failed")

            corridor_str = " -> ".join(req.route_junctions)
            prompt = (
                f"{AI_SAFETY_DIRECTIVE}\n\n"
                f"OPERATIONAL TELEMETRY:\n"
                f"- Origin: {req.origin}\n"
                f"- Destination: {req.destination}\n"
                f"- Calculated Dijkstra Distance: {req.calculated_distance_meters:.0f} meters\n"
                f"- Calculated Travel Time: {req.estimated_transit_seconds:.1f} seconds\n"
                f"- Corridor Junction Sequence: {corridor_str}\n"
                f"- Congestion Detected: {req.congestion_detected}\n"
                f"- Bottleneck Segment: {req.bottleneck_link or 'None'}\n"
                f"- Dynamic Diversion Triggered: {req.diversion_taken}\n"
                f"- Priority Level: {req.priority_level}\n\n"
                f"TASK:\n"
                f"Provide a concise operational route assessment (3 to 4 sentences). "
                f"Explain why this corridor was selected by the weighted graph engine, "
                f"how it avoids delay points or all-red conflicts, and one specific safety precaution for the traffic commander."
            )

            model_to_use = settings.GEMINI_MODEL
            try:
                response = client.models.generate_content(
                    model=model_to_use,
                    contents=prompt
                )
            except Exception as model_err:
                err_msg = str(model_err)
                if "no longer available" in err_msg or "404" in err_msg:
                    logger.info("Configured model %s unavailable, falling back to gemini-3.5-flash", model_to_use)
                    model_to_use = "gemini-3.5-flash"
                    response = client.models.generate_content(
                        model=model_to_use,
                        contents=prompt
                    )
                else:
                    raise model_err

            text_output = response.text if response and hasattr(response, "text") and response.text else ""
            if not text_output:
                return self._build_deterministic_route_fallback(req, error="Empty response from Gemini")

            # Parse observations and recommendations cleanly
            observations = [
                f"Optimal corridor path verified: {corridor_str}",
                f"Target transit duration: {req.estimated_transit_seconds:.0f}s over {req.calculated_distance_meters:.0f}m"
            ]
            if req.diversion_taken:
                observations.append(f"Dynamic detour active around bottleneck segment ({req.bottleneck_link})")

            recommendations = [
                "Verify downstream junction preemption 250m before vehicle arrival",
                "Maintain mandatory 2.0s all-red clearance interval before signal phase transition"
            ]

            return AIAdvisoryResponse(
                status="SUCCESS",
                is_configured=True,
                is_advisory=True,
                model_used=model_to_use,
                summary=text_output.strip(),
                key_observations=observations,
                safety_recommendations=recommendations
            )

        except Exception as e:
            logger.warning("Gemini API call failed for explain_route: %s", str(e))
            return self._build_deterministic_route_fallback(req, error=str(e))

    def summarize_incident(self, req: IncidentSummaryRequest) -> AIAdvisoryResponse:
        """
        Synthesizes a structured incident debrief for an emergency corridor transit.
        """
        if not self.is_configured():
            return self._build_deterministic_incident_fallback(req, unconfigured=True)

        try:
            client = self._get_client()
            if not client:
                return self._build_deterministic_incident_fallback(req, error="Client initialization failed")

            prompt = (
                f"{AI_SAFETY_DIRECTIVE}\n\n"
                f"INCIDENT TELEMETRY RECORD:\n"
                f"- Incident Request ID: {req.request_id}\n"
                f"- Unit Call Sign: {req.ambulance_call_sign}\n"
                f"- Triage Priority: {req.triage_priority}\n"
                f"- Transit Path: {req.start_junction} to {req.target_junction}\n"
                f"- Transit Duration: {req.total_duration_seconds:.1f}s\n"
                f"- Final Status: {req.status}\n"
                f"- Scheduling Note: {req.scheduling_reason or 'Direct green corridor granted'}\n"
                f"- Contending Units: {req.contending_vehicles_count}\n\n"
                f"TASK:\n"
                f"Generate a brief 3-sentence incident debrief for municipal traffic audit records. "
                f"Assess whether clearance sequencing was followed and note any queuing delay."
            )

            model_to_use = settings.GEMINI_MODEL
            try:
                response = client.models.generate_content(
                    model=model_to_use,
                    contents=prompt
                )
            except Exception as model_err:
                err_msg = str(model_err)
                if "no longer available" in err_msg or "404" in err_msg:
                    logger.info("Configured model %s unavailable, falling back to gemini-3.5-flash", model_to_use)
                    model_to_use = "gemini-3.5-flash"
                    response = client.models.generate_content(
                        model=model_to_use,
                        contents=prompt
                    )
                else:
                    raise model_err

            text_output = response.text if response and hasattr(response, "text") and response.text else ""
            if not text_output:
                return self._build_deterministic_incident_fallback(req, error="Empty response from Gemini")

            observations = [
                f"Emergency unit {req.ambulance_call_sign} [{req.triage_priority}] logged with status {req.status}",
                f"Corridor segment {req.start_junction} -> {req.target_junction} concluded in {req.total_duration_seconds:.0f}s"
            ]
            if req.contending_vehicles_count and req.contending_vehicles_count > 0:
                observations.append(f"Contention resolved with {req.contending_vehicles_count} waiting emergency vehicle(s)")

            recommendations = [
                "Archive SHA-256 audit entry to cryptographic chain",
                "Ensure signal controller reversion to normal 4-phase cycle has completed"
            ]

            return AIAdvisoryResponse(
                status="SUCCESS",
                is_configured=True,
                is_advisory=True,
                model_used=model_to_use,
                summary=text_output.strip(),
                key_observations=observations,
                safety_recommendations=recommendations
            )

        except Exception as e:
            logger.warning("Gemini API call failed for summarize_incident: %s", str(e))
            return self._build_deterministic_incident_fallback(req, error=str(e))

    def _build_deterministic_route_fallback(
        self, req: RouteExplanationRequest, unconfigured: bool = False, error: Optional[str] = None
    ) -> AIAdvisoryResponse:
        corridor_str = " -> ".join(req.route_junctions)
        if unconfigured:
            notice = "Gemini API key is unconfigured; providing rule-based advisory summary"
            summary = (
                f"[DETERMINISTIC CORRIDOR ANALYSIS] Corridor {corridor_str} was selected via Dijkstra graph evaluation "
                f"covering {req.calculated_distance_meters:.0f}m in an estimated {req.estimated_transit_seconds:.0f}s. "
                f"({notice})."
            )
            status = "UNCONFIGURED"
        else:
            notice = f"AI service notice: {error or 'Service unavailable'}; fallback applied"
            summary = (
                f"[DETERMINISTIC FALLBACK] Corridor {corridor_str} selected covering {req.calculated_distance_meters:.0f}m "
                f"in ~{req.estimated_transit_seconds:.0f}s. ({notice})."
            )
            status = "FALLBACK"

        observations = [
            f"Deterministic Dijkstra corridor path: {corridor_str}",
            f"Distance: {req.calculated_distance_meters:.0f}m | Estimated Transit Time: {req.estimated_transit_seconds:.0f}s"
        ]
        if req.diversion_taken:
            observations.append(f"Congestion avoidance active for segment: {req.bottleneck_link or 'Identified bottleneck'}")

        recommendations = [
            "Initiate approach verification 250m before vehicle arrival at stop line",
            "Mandate 2.0s all-red clearance phase prior to granting green preemption"
        ]

        return AIAdvisoryResponse(
            status=status,
            is_configured=False,
            is_advisory=True,
            model_used=None,
            summary=summary,
            key_observations=observations,
            safety_recommendations=recommendations
        )

    def _build_deterministic_incident_fallback(
        self, req: IncidentSummaryRequest, unconfigured: bool = False, error: Optional[str] = None
    ) -> AIAdvisoryResponse:
        if unconfigured:
            notice = "Gemini API key is unconfigured; deterministic summary generated"
            summary = (
                f"[DETERMINISTIC INCIDENT LOG] Request {req.request_id} for {req.ambulance_call_sign} ({req.triage_priority}) "
                f"from {req.start_junction} to {req.target_junction} concluded with status '{req.status}'. "
                f"({notice})."
            )
            status = "UNCONFIGURED"
        else:
            notice = f"AI service notice: {error or 'Unavailable'}; fallback applied"
            summary = (
                f"[DETERMINISTIC FALLBACK] Unit {req.ambulance_call_sign} concluded transit with status '{req.status}' "
                f"in {req.total_duration_seconds:.0f}s. ({notice})."
            )
            status = "FALLBACK"

        observations = [
            f"Unit {req.ambulance_call_sign} logged under priority {req.triage_priority}",
            f"Status: {req.status} | Total transit: {req.total_duration_seconds:.0f}s"
        ]
        recommendations = [
            "Log cryptographic SHA-256 audit record",
            "Verify signal controller cycle reversion to normal operation"
        ]

        return AIAdvisoryResponse(
            status=status,
            is_configured=False,
            is_advisory=True,
            model_used=None,
            summary=summary,
            key_observations=observations,
            safety_recommendations=recommendations
        )


ai_service = GeminiAIService()
