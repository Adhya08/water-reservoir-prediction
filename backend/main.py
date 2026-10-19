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

@app.get("/")
def root():
    return {"message": "AquaPredict API is running"}

@app.get("/health")
def health():
    return {"status": "ok"}
