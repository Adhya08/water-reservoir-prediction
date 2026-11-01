from typing import List, Optional
from fastapi import FastAPI, HTTPException, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import math

app = FastAPI(title="AquaPredict API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

router = APIRouter()

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

def rk4_step(t, h, dt, area, inflow_points, outflow_points):
    # Time is measured in hours. Convert m^3/s to m^3/hour using 3600.
    def f(time, level):
        qin = interpolate_value(inflow_points, time)
        qout = interpolate_value(outflow_points, time)
        return ((qin - qout) * 3600.0) / area

    k1 = f(t, h)
    k2 = f(t + dt/2, h + dt*k1/2)
    k3 = f(t + dt/2, h + dt*k2/2)
    k4 = f(t + dt, h + dt*k3)
    next_h = h + (dt/6.0) * (k1 + 2*k2 + 2*k3 + k4)
    return next_h, {"k1": k1, "k2": k2, "k3": k3, "k4": k4}

@router.get("/")
def root():
    return {"message": "AquaPredict API is running"}

@router.get("/health")
def health():
    return {"status": "ok"}

@router.post("/interpolate")
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

@router.post("/integrate")
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

@router.post("/simulate")
def simulate(req: SimulationRequest):
    rows = sorted_readings(req.readings)
    start = rows[0].time_hours
    initial = req.initial_level_m
    if initial is None:
        first_known = next((r.level_m for r in rows if r.level_m is not None), None)
        if first_known is None:
            raise HTTPException(status_code=400, detail="Provide an initial level or at least one known level reading.")
        initial = first_known

    inflow_points = [(r.time_hours, r.inflow_m3s) for r in rows]
    outflow_points = [(r.time_hours, r.outflow_m3s) for r in rows]
    end = start + req.duration_hours
    t, h = start, initial
    results = [{"time_hours": round(t, 6), "level_m": round(h, 6), "k_values": None}]
    while t < end - 1e-10:
        dt = min(req.step_hours, end - t)
        next_h, ks = rk4_step(t, h, dt, req.area_m2, inflow_points, outflow_points)
        t += dt
        h = next_h
        results.append({
            "time_hours": round(t, 6),
            "level_m": round(h, 6),
            "k_values": {k: round(v, 8) for k, v in ks.items()}
        })
    return {
        "method": "Runge-Kutta Fourth Order (RK4)",
        "assumption": "Constant reservoir surface area; flow rates are linearly interpolated between supplied readings and held constant beyond their endpoints.",
        "results": results
    }

@router.post("/error-analysis")
def error_analysis(req: ErrorRequest):
    if not req.pairs:
        raise HTTPException(status_code=400, detail="Add at least one actual/predicted pair.")
    results = []
    for p in req.pairs:
        absolute = abs(p.actual_m - p.predicted_m)
        percentage = None if p.actual_m == 0 else (absolute / abs(p.actual_m)) * 100
        results.append({
            "time_hours": p.time_hours,
            "actual_m": p.actual_m,
            "predicted_m": p.predicted_m,
            "absolute_error_m": round(absolute, 6),
            "percentage_error": None if percentage is None else round(percentage, 4)
        })
    mean_abs = sum(x["absolute_error_m"] for x in results) / len(results)
    valid_pct = [x["percentage_error"] for x in results if x["percentage_error"] is not None]
    return {
        "results": results,
        "mean_absolute_error_m": round(mean_abs, 6),
        "mean_percentage_error": None if not valid_pct else round(sum(valid_pct)/len(valid_pct), 4)
    }

app.include_router(router)
app.include_router(router, prefix="/api")
