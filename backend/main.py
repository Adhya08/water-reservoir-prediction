from typing import List, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI(title="AquaPredict API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class Reading(BaseModel):
    time_hours: float = Field(ge=0)
    level_m: Optional[float] = None
    inflow_m3s: float = Field(ge=0)
    outflow_m3s: float = Field(ge=0)

class SimulationRequest(BaseModel):
    readings: List[Reading]
    area_m2: float = Field(gt=0)
    initial_level_m: Optional[float] = None
    duration_hours: float = Field(gt=0, le=720)
    step_hours: float = Field(gt=0, le=24)

class InterpolationRequest(BaseModel):
    readings: List[Reading]

class IntegrationRequest(BaseModel):
    readings: List[Reading]

class ErrorPair(BaseModel):
    time_hours: float
    actual_m: float
    predicted_m: float

class ErrorRequest(BaseModel):
    pairs: List[ErrorPair]

def sorted_readings(readings):
    rows = sorted(readings, key=lambda r: r.time_hours)
    if len(rows) < 2:
        raise HTTPException(status_code=400, detail="At least two readings are required.")
    if any(rows[i].time_hours == rows[i-1].time_hours for i in range(1, len(rows))):
        raise HTTPException(status_code=400, detail="Reading times must be unique.")
    return rows

@app.get("/")
def root():
    return {"message": "AquaPredict API is running"}

@app.get("/health")
def health():
    return {"status": "ok"}
