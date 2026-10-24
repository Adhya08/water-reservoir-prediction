# AquaPredict — College Project Starter

A React + TypeScript frontend and Python FastAPI backend for a Water Reservoir Level Prediction System.

## Features included

- Dashboard with water-level, inflow and outflow visualizations
- Manual reservoir reading entry and CSV import/export
- RK4 water-level simulation
- Composite trapezoidal integration for cumulative inflow/outflow volumes
- Linear interpolation for missing water-level observations
- Prediction error analysis where actual readings exist at matching timestamps
- Rule-based demo alerts
- Text/CSV report export

## Requirements

- Python 3.10+
- Node.js 18+

## 1. Start the backend

Open a terminal in the project folder:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload
```

Backend runs at `http://localhost:8000`. API docs: `http://localhost:8000/docs`.

If PowerShell blocks virtual-environment activation, use:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\.venv\Scripts\Activate.ps1
```

## 2. Start the frontend

Open a second terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open the local URL printed by Vite, usually `http://localhost:5173`.

## 3. Load sample data

In the app, open **Reservoir Data → Import CSV** and select:

`sample-data/reservoir-readings.csv`

Or use the sample readings already loaded when the app first opens.

## Model assumptions and limitations

- Time is represented in hours from the start of the simulation.
- Inflow and outflow are in cubic metres per second (m³/s).
- Reservoir surface area is assumed constant (m²).
- RK4 uses `dh/dt = 3600 * (Qin - Qout) / A` because the integration time unit is hours while flow rates are per second.
- Flow rates are linearly interpolated between provided readings and held constant outside the supplied time range.
- The storage percentage card uses an illustrative 60 m reference, not a real capacity-volume curve. Configure a real level-storage relationship before using real reservoir data.
- This is an educational prototype, not a live dam-control or emergency warning system.
- Sensor connectivity is not implemented. The data model is ready to accept readings from a future sensor integration.

## Notes for the project team

1. Validate the numerical engine against hand-worked examples.
2. Add tests for interpolation, trapezoidal integration and RK4.
3. Use measured reservoir data only if you have a reliable source and permission.
4. Do not claim real-time sensor monitoring unless physical sensors are actually connected.
