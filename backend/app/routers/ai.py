import logging
from fastapi import APIRouter, Depends, HTTPException, status
from ..models import User
from ..auth import get_current_user
from ..services.ai_service import (
    ai_service,
    AIStatusResponse,
    RouteExplanationRequest,
    IncidentSummaryRequest,
    AIAdvisoryResponse
)

logger = logging.getLogger("routex.routers.ai")

router = APIRouter(prefix="/ai", tags=["AI Advisory Engine"])


@router.get("/status", response_model=AIStatusResponse)
def get_ai_service_status():
    """
    Returns public health and configuration status for the Google Gemini AI advisory module.
    Does NOT leak secrets, API keys, or operational telemetry.
    """
    return ai_service.get_status()


@router.post("/explain-route", response_model=AIAdvisoryResponse)
def explain_route(
    req: RouteExplanationRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Generates explainable operational analysis of a corridor selected by the Dijkstra routing engine.
    Strictly advisory; does not actuate traffic controllers.
    """
    try:
        return ai_service.explain_route(req)
    except Exception as e:
        logger.error("Error processing AI route explanation: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"AI advisory service encountered an error: {str(e)}"
        )


@router.post("/incident-summary", response_model=AIAdvisoryResponse)
def generate_incident_summary(
    req: IncidentSummaryRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Synthesizes a structured incident debrief for emergency corridor clearance.
    Strictly advisory; intended for municipal record keeping.
    """
    try:
        return ai_service.summarize_incident(req)
    except Exception as e:
        logger.error("Error processing AI incident summary: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"AI advisory service encountered an error: {str(e)}"
        )
