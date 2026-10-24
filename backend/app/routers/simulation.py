from typing import Optional
from fastapi import APIRouter, HTTPException, status, Body
from pydantic import BaseModel, Field
from ..services.simulation_service import simulation_service
from ..services.ws_manager import ws_manager

router = APIRouter(prefix="/simulation", tags=["Simulation Engine"])


class StartSimulationRequest(BaseModel):
    scenario: str = Field(default="STANDARD_CORRIDOR", description="Operational test scenario name")
    speed_multiplier: float = Field(default=1.0, ge=0.5, le=10.0, description="Simulation speed factor")


class SpeedRequest(BaseModel):
    speed_multiplier: float = Field(default=1.0, ge=0.5, le=10.0)


class StepRequest(BaseModel):
    dt: float = Field(default=1.0, ge=0.1, le=10.0, description="Delta time in seconds to advance simulation")


@router.get("/status")
def get_simulation_status():
    """Returns the authoritative real-time state of the simulation engine."""
    return simulation_service.get_status()


@router.post("/start")
async def start_simulation(payload: Optional[StartSimulationRequest] = Body(default=None)):
    scenario = payload.scenario if payload else "STANDARD_CORRIDOR"
    speed = payload.speed_multiplier if payload else 1.0
    status_data = simulation_service.start_scenario(scenario, speed)
    await ws_manager.broadcast("SIMULATION_STATE_CHANGE", status_data)
    return status_data


@router.post("/pause")
async def pause_simulation():
    status_data = simulation_service.pause()
    await ws_manager.broadcast("SIMULATION_STATE_CHANGE", status_data)
    return status_data


@router.post("/resume")
async def resume_simulation():
    status_data = simulation_service.resume()
    await ws_manager.broadcast("SIMULATION_STATE_CHANGE", status_data)
    return status_data


@router.post("/reset")
async def reset_simulation():
    status_data = simulation_service.reset()
    await ws_manager.broadcast("SIMULATION_STATE_CHANGE", status_data)
    return status_data


@router.post("/speed")
async def change_simulation_speed(payload: SpeedRequest):
    status_data = simulation_service.set_speed(payload.speed_multiplier)
    await ws_manager.broadcast("SIMULATION_STATE_CHANGE", status_data)
    return status_data


@router.post("/step")
async def step_simulation(payload: Optional[StepRequest] = Body(default=None)):
    dt = payload.dt if payload else 1.0
    status_data = simulation_service.tick(dt)
    await ws_manager.broadcast("SIMULATION_TICK", status_data)
    return status_data


@router.post("/scenario/{scenario_name}")
async def trigger_scenario(scenario_name: str, speed_multiplier: Optional[float] = 1.0):
    valid_scenarios = ["STANDARD_CORRIDOR", "MULTI_AMBULANCE_CONFLICT", "COMM_LOSS_FAILSAFE", "GRIDLOCK_CONGESTION"]
    if scenario_name not in valid_scenarios:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid scenario name. Available scenarios: {', '.join(valid_scenarios)}"
        )
    status_data = simulation_service.start_scenario(scenario_name, speed_multiplier or 1.0)
    await ws_manager.broadcast("SIMULATION_STATE_CHANGE", status_data)
    return status_data
