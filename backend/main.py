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

def interpolate_value(points, t):
    """Piecewise-linear interpolation; hold the nearest endpoint outside the data range."""
    if t <= points[0][0]:
        return points[0][1]
    if t >= points[-1][0]:
        return points[-1][1]
    for i in range(1, len(points)):
        t1, y1 = points[i-1]
        t2, y2 = points[i]
        if t <= t2:
            return y1 + ((t - t1) / (t2 - t1)) * (y2 - y1)
    return points[-1][1]

@app.get("/")
def root():
    return {"message": "AquaPredict API is running"}

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/interpolate")
def interpolate(req: InterpolationRequest):
    rows = sorted_readings(req.readings)
    known = [(r.time_hours, r.level_m) for r in rows if r.level_m is not None]
    if len(known) < 2:
        raise HTTPException(status_code=400, detail="At least two known water-level readings are required.")
    output = []
    for r in rows:
        estimated = r.level_m
        was_estimated = False
        if estimated is None:
            estimated = interpolate_value(known, r.time_hours)
            was_estimated = True
        output.append({
            "time_hours": r.time_hours,
            "original_level_m": r.level_m,
            "level_m": round(estimated, 6),
            "estimated": was_estimated
        })
    return {"results": output, "method": "Linear interpolation"}

@app.post("/integrate")
def integrate(req: IntegrationRequest):
    rows = sorted_readings(req.readings)
    total_in = 0.0
    total_out = 0.0
    intervals = []
    for i in range(1, len(rows)):
        prev, cur = rows[i-1], rows[i]
        dt_seconds = (cur.time_hours - prev.time_hours) * 3600.0
        in_volume = dt_seconds * (prev.inflow_m3s + cur.inflow_m3s) / 2.0
        out_volume = dt_seconds * (prev.outflow_m3s + cur.outflow_m3s) / 2.0
        total_in += in_volume
        total_out += out_volume
        intervals.append({
            "from_hours": prev.time_hours,
            "to_hours": cur.time_hours,
            "inflow_volume_m3": round(in_volume, 3),
            "outflow_volume_m3": round(out_volume, 3),
        })
    return {
        "method": "Composite trapezoidal rule",
        "total_inflow_m3": round(total_in, 3),
        "total_outflow_m3": round(total_out, 3),
        "net_volume_change_m3": round(total_in-total_out, 3),
        "intervals": intervals
    }
