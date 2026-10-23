import { useMemo, useState } from 'react'
import {
  LayoutDashboard, Database, TrendingUp, Calculator, ChartNoAxesCombined,
  Bell, FileText, Droplets, Upload, Play, Download, Plus, RefreshCw,
  Activity, Waves, AlertTriangle, CheckCircle2, Menu, X
} from 'lucide-react'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, AreaChart, Area, BarChart, Bar
} from 'recharts'

type Reading = { time_hours: number; level_m: number | null; inflow_m3s: number; outflow_m3s: number }
type NavKey = 'Overview' | 'Reservoir Data' | 'Prediction' | 'Numerical Methods Lab' | 'Analytics' | 'Alerts' | 'Reports'
const API = 'http://localhost:8000'

const initialReadings: Reading[] = [
  { time_hours: 0, level_m: 45.0, inflow_m3s: 100, outflow_m3s: 80 },
  { time_hours: 1, level_m: 45.5, inflow_m3s: 120, outflow_m3s: 90 },
  { time_hours: 2, level_m: null, inflow_m3s: 110, outflow_m3s: 95 },
  { time_hours: 3, level_m: 46.2, inflow_m3s: 130, outflow_m3s: 100 },
  { time_hours: 4, level_m: 46.8, inflow_m3s: 125, outflow_m3s: 105 },
]

const navItems: { name: NavKey; icon: any }[] = [
  { name: 'Overview', icon: LayoutDashboard }, { name: 'Reservoir Data', icon: Database },
  { name: 'Prediction', icon: TrendingUp }, { name: 'Numerical Methods Lab', icon: Calculator },
  { name: 'Analytics', icon: ChartNoAxesCombined }, { name: 'Alerts', icon: Bell },
  { name: 'Reports', icon: FileText },
]

async function api(path: string, body: unknown) {
  const response = await fetch(`${API}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.detail || 'Request failed')
  return data
}

function downloadFile(filename: string, content: string, type = 'text/csv') {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

export default function App() {
  const [active, setActive] = useState<NavKey>('Overview')
  const [readings, setReadings] = useState<Reading[]>(initialReadings)
  const [area, setArea] = useState(10000)
  const [duration, setDuration] = useState(6)
  const [step, setStep] = useState(1)
  const [prediction, setPrediction] = useState<any>(null)
  const [interpolation, setInterpolation] = useState<any>(null)
  const [integration, setIntegration] = useState<any>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [tab, setTab] = useState<'rk4' | 'integration' | 'interpolation'>('rk4')
  const [mobileOpen, setMobileOpen] = useState(false)

  const validLevels = readings.filter(r => r.level_m !== null)
  const currentLevel = validLevels.at(-1)?.level_m ?? 0
  const latest = readings.at(-1)!
  const storage = Math.max(0, Math.min(100, currentLevel / 60 * 100))
  const chartData = useMemo(() => readings.map(r => ({
    time: `${r.time_hours}h`, level: r.level_m, inflow: r.inflow_m3s, outflow: r.outflow_m3s
  })), [readings])

  const allAlerts = [
    ...(currentLevel < 20 ? ['Water level is below the configured minimum threshold.'] : []),
    ...(currentLevel > 55 ? ['Water level is approaching the configured maximum threshold.'] : []),
    ...(readings.some(r => r.level_m === null) ? ['One or more water-level readings are missing. Run interpolation.'] : []),
    ...(latest.outflow_m3s > latest.inflow_m3s ? ['Outflow currently exceeds inflow; net storage is decreasing.'] : []),
  ]

  async function runAll() {
    setBusy(true); setMessage('')
    try {
      const [pred, interp, integ] = await Promise.all([
        api('/simulate', { readings, area_m2: area, duration_hours: duration, step_hours: step }),
        api('/interpolate', { readings }),
        api('/integrate', { readings }),
      ])
      setPrediction(pred); setInterpolation(interp); setIntegration(integ)
      setMessage('Calculations completed successfully.')
    } catch (e: any) { setMessage(e.message || 'Could not complete calculations.') }
    finally { setBusy(false) }
  }

  function updateReading(index: number, field: keyof Reading, value: string) {
    setReadings(old => old.map((r, i) => i !== index ? r : {
      ...r, [field]: field === 'level_m' && value === '' ? null : Number(value)
    }))
  }

  function addReading() {
    const last = readings.at(-1)!
    setReadings([...readings, { time_hours: last.time_hours + 1, level_m: null, inflow_m3s: last.inflow_m3s, outflow_m3s: last.outflow_m3s }])
  }

  function importCsv(file?: File) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const lines = String(reader.result).trim().split(/\r?\n/)
        const parsed = lines.slice(1).filter(Boolean).map(line => {
          const [time, level, inflow, outflow] = line.split(',').map(x => x.trim())
          return { time_hours: Number(time), level_m: level === '' ? null : Number(level), inflow_m3s: Number(inflow), outflow_m3s: Number(outflow) }
        })
        if (!parsed.length || parsed.some(r => !Number.isFinite(r.time_hours + r.inflow_m3s + r.outflow_m3s))) throw new Error('Invalid CSV')
        setReadings(parsed); setMessage(`Imported ${parsed.length} readings.`)
      } catch { setMessage('CSV format must be: time_hours,level_m,inflow_m3s,outflow_m3s') }
    }
    reader.readAsText(file)
  }

  function exportReadings() {
    const rows = ['time_hours,level_m,inflow_m3s,outflow_m3s', ...readings.map(r => `${r.time_hours},${r.level_m ?? ''},${r.inflow_m3s},${r.outflow_m3s}`)]
    downloadFile('aquapredict-readings.csv', rows.join('\n'))
  }

  const title = active
  const pageContent = () => {
    if (active === 'Overview') return <Overview currentLevel={currentLevel} storage={storage} latest={latest} chartData={chartData} prediction={prediction} alerts={allAlerts} onRun={runAll} busy={busy} />
    if (active === 'Reservoir Data') return <DataPage readings={readings} onChange={updateReading} onAdd={addReading} onImport={importCsv} onExport={exportReadings} />
    if (active === 'Prediction') return <PredictionPage area={area} setArea={setArea} duration={duration} setDuration={setDuration} step={step} setStep={setStep} onRun={runAll} busy={busy} prediction={prediction} />
    if (active === 'Numerical Methods Lab') return <MethodsPage tab={tab} setTab={setTab} prediction={prediction} interpolation={interpolation} integration={integration} onRun={runAll} busy={busy} />
    return <div className="empty-state">Module under development.</div>
  }

  return <div className="app-shell">
    <aside className={`sidebar ${mobileOpen ? 'open' : ''}`}>
      <div className="brand"><div className="brand-mark"><Droplets size={21}/></div><div><b>AquaPredict</b><small>RESERVOIR INTELLIGENCE</small></div><button className="mobile-close" onClick={() => setMobileOpen(false)}><X size={18}/></button></div>
      <div className="nav-label">WORKSPACE</div>
      <nav>{navItems.map(item => {
        const Icon = item.icon
        return <button key={item.name} className={`nav-item ${active === item.name ? 'active' : ''}`} onClick={() => { setActive(item.name); setMobileOpen(false) }}>
          <Icon size={18}/><span>{item.name}</span>
        </button>
      })}</nav>
      <div className="sidebar-bottom"><div className="online-dot"/> Prototype environment <small>v1.0.0</small></div>
    </aside>
    {mobileOpen && <div className="scrim" onClick={() => setMobileOpen(false)}/>}
    <main className="main">
      <header className="topbar">
        <button className="menu-button" onClick={() => setMobileOpen(true)}><Menu/></button>
        <div><span className="eyebrow">RESERVOIR MANAGEMENT / {active.toUpperCase()}</span><h1>{title}</h1></div>
        <div className="top-right"><span className="status-pill"><span className="online-dot"/> Demo mode</span><div className="avatar">AP</div></div>
      </header>
      {message && <div className="toast"><span>{message}</span><button onClick={() => setMessage('')}>×</button></div>}
      <section className="page">{pageContent()}</section>
      <footer className="footer">AquaPredict · Numerical Methods Project <span>Demo data only — not for operational dam control</span></footer>
    </main>
  </div>
}

function PageHeading({ eyebrow, title, desc, action }: any) {
  return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h2>{title}</h2><p>{desc}</p></div>{action}</div>
}
function Metric({ label, value, unit, icon: Icon, tone = 'blue', note }: any) {
  return <div className="metric-card"><div className={`metric-icon ${tone}`}><Icon size={19}/></div><div className="metric-label">{label}</div><div className="metric-value">{value}<small>{unit}</small></div><div className="metric-note">{note}</div></div>
}
function Panel({ title, subtitle, children, extra }: any) {
  return <div className="panel"><div className="panel-head"><div><h3>{title}</h3>{subtitle && <p>{subtitle}</p>}</div>{extra}</div>{children}</div>
}
function Overview({ currentLevel, storage, latest, chartData, prediction, alerts, onRun, busy }: any) {
  return <>
    <PageHeading eyebrow="LIVE SIMULATION OVERVIEW" title="Reservoir overview" desc="A consolidated view of water levels, flow rates and calculated trends."
      action={<button className="primary-btn" onClick={onRun} disabled={busy}><Play size={16}/>{busy ? 'Calculating…' : 'Run calculations'}</button>}/>
    <div className="metric-grid">
      <Metric label="Current water level" value={currentLevel.toFixed(2)} unit="m" icon={Waves} note="Latest known measurement"/>
      <Metric label="Storage indicator" value={storage.toFixed(1)} unit="%" icon={Droplets} tone="teal" note="Illustrative 60 m reference"/>
      <Metric label="Inflow rate" value={latest.inflow_m3s.toFixed(1)} unit="m³/s" icon={Activity} tone="green" note="Latest supplied reading"/>
      <Metric label="Outflow rate" value={latest.outflow_m3s.toFixed(1)} unit="m³/s" icon={TrendingUp} tone="amber" note="Latest supplied reading"/>
    </div>
    <div className="grid-two">
      <Panel title="Water level history" subtitle="Recorded readings; gaps remain visible">
        <div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><LineChart data={chartData}><CartesianGrid strokeDasharray="3 3" stroke="#e7edf2"/><XAxis dataKey="time"/><YAxis/><Tooltip/><Line dataKey="level" name="Water level (m)" stroke="#1686a5" strokeWidth={3} connectNulls={false} dot={{r:4}}/></LineChart></ResponsiveContainer></div>
      </Panel>
      <Panel title="Inflow vs outflow" subtitle="Flow rates in cubic metres per second">
        <div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" stroke="#e7edf2"/><XAxis dataKey="time"/><YAxis/><Tooltip/><Legend/><Bar dataKey="inflow" name="Inflow" fill="#159b8b" radius={[5,5,0,0]}/><Bar dataKey="outflow" name="Outflow" fill="#e4a34b" radius={[5,5,0,0]}/></BarChart></ResponsiveContainer></div>
      </Panel>
    </div>
    <div className="grid-two">
      <Panel title="Reservoir storage indicator" subtitle="Illustrative visual indicator; configure real capacity data for deployment">
        <div className="storage-layout"><div className="tank"><div className="tank-water" style={{height:`${storage}%`}}/><span>{storage.toFixed(0)}%</span></div><div><div className="big-number">{currentLevel.toFixed(2)} m</div><p className="muted">Latest known water level</p><div className="legend-line"><i className="dot teal-dot"/> Simulated reservoir level</div></div></div>
      </Panel>
      <Panel title="System alerts" subtitle="Generated from the current dataset">
        {alerts.length ? <div className="alert-list">{alerts.slice(0,4).map((a:string,i:number)=><div className="alert-row" key={i}><AlertTriangle size={17}/><span>{a}</span></div>)}</div> : <div className="empty-state"><CheckCircle2 size={25}/><b>No active alerts</b><span>Current readings do not trigger configured demo rules.</span></div>}
      </Panel>
    </div>
    {prediction && <Panel title="Latest prediction" subtitle="Run timestamp is not stored in this prototype"><div className="result-strip"><div><span>Predicted level at end of horizon</span><b>{prediction.results.at(-1).level_m.toFixed(3)} m</b></div><div><span>Prediction steps</span><b>{prediction.results.length - 1}</b></div><div><span>Method</span><b>RK4</b></div></div></Panel>}
  </>
}
function DataPage({ readings, onChange, onAdd, onImport, onExport }: any) {
  return <>
    <PageHeading eyebrow="DATA MANAGEMENT" title="Reservoir readings" desc="Add observations, import a CSV file and mark missing level values for interpolation."
      action={<><label className="secondary-btn file-btn"><Upload size={16}/>Import CSV<input type="file" accept=".csv,text/csv" onChange={e => onImport(e.target.files?.[0])}/></label><button className="primary-btn" onClick={onAdd}><Plus size={16}/>Add reading</button></>}/>
    <Panel title="Measurement dataset" subtitle="Time is measured in hours from the start of the simulation. Flow rates use m³/s.">
      <div className="table-scroll"><table><thead><tr><th>Time (hours)</th><th>Water level (m)</th><th>Inflow (m³/s)</th><th>Outflow (m³/s)</th><th>Data status</th></tr></thead><tbody>
        {readings.map((r:Reading,i:number)=><tr key={i}>
          <td><input className="cell-input" type="number" min="0" value={r.time_hours} onChange={e=>onChange(i,'time_hours',e.target.value)}/></td>
          <td><input className="cell-input" type="number" step="any" placeholder="Missing" value={r.level_m ?? ''} onChange={e=>onChange(i,'level_m',e.target.value)}/></td>
          <td><input className="cell-input" type="number" min="0" step="any" value={r.inflow_m3s} onChange={e=>onChange(i,'inflow_m3s',e.target.value)}/></td>
          <td><input className="cell-input" type="number" min="0" step="any" value={r.outflow_m3s} onChange={e=>onChange(i,'outflow_m3s',e.target.value)}/></td>
          <td>{r.level_m === null ? <span className="tag warning">Missing level</span> : <span className="tag success">Recorded</span>}</td>
        </tr>)}
      </tbody></table></div>
      <div className="panel-actions"><span className="muted">{readings.length} readings · Blank level values are allowed for interpolation.</span><button className="secondary-btn" onClick={onExport}><Download size={15}/>Export CSV</button></div>
    </Panel>
    <div className="info-box"><AlertTriangle size={18}/><div><b>Data validation note</b><p>Times must be unique and ordered for calculations. Inflow and outflow must be non-negative. At least two readings are needed for interpolation and integration.</p></div></div>
  </>
}
function PredictionPage({ area, setArea, duration, setDuration, step, setStep, onRun, busy, prediction }: any) {
  return <>
    <PageHeading eyebrow="FORECAST ENGINE" title="Prediction center" desc="Simulate future reservoir levels using the fourth-order Runge–Kutta method."/>
    <div className="grid-two">
      <Panel title="Simulation configuration" subtitle="Set the physical assumptions and prediction horizon">
        <div className="form-grid">
          <label>Reservoir surface area (m²)<input type="number" min="0.01" value={area} onChange={e=>setArea(Number(e.target.value))}/></label>
          <label>Prediction duration (hours)<select value={duration} onChange={e=>setDuration(Number(e.target.value))}><option value={6}>6 hours</option><option value={12}>12 hours</option><option value={24}>24 hours</option><option value={48}>48 hours</option></select></label>
          <label>RK4 step size (hours)<select value={step} onChange={e=>setStep(Number(e.target.value))}><option value={0.25}>0.25 hour</option><option value={0.5}>0.5 hour</option><option value={1}>1 hour</option><option value={2}>2 hours</option></select></label>
        </div>
        <button className="primary-btn full-btn" onClick={onRun} disabled={busy}><Play size={16}/>{busy ? 'Running numerical methods…' : 'Run prediction and methods'}</button>
        <div className="info-box compact"><Activity size={17}/><div><b>Model assumption</b><p>Constant reservoir surface area. Flow rates are linearly interpolated between readings and held at endpoint values outside the supplied time range.</p></div></div>
      </Panel>
      <Panel title="Prediction output" subtitle="RK4 calculated water levels">
        {prediction ? <div className="prediction-summary"><div className="big-number">{prediction.results.at(-1).level_m.toFixed(3)} <small>m</small></div><p className="muted">Predicted level at {prediction.results.at(-1).time_hours.toFixed(2)} hours</p><div className="result-strip"><div><span>Initial level</span><b>{prediction.results[0].level_m.toFixed(3)} m</b></div><div><span>Change</span><b>{(prediction.results.at(-1).level_m-prediction.results[0].level_m).toFixed(3)} m</b></div></div></div> : <div className="empty-state"><TrendingUp size={28}/><b>No prediction yet</b><span>Configure the simulation and run the calculation.</span></div>}
      </Panel>
    </div>
    {prediction && <Panel title="Predicted water-level curve" subtitle="Predicted values at each RK4 time step"><div className="chart-wrap tall"><ResponsiveContainer width="100%" height="100%"><LineChart data={predictedDataForChart(prediction)}><CartesianGrid strokeDasharray="3 3" stroke="#e7edf2"/><XAxis dataKey="time"/><YAxis/><Tooltip/><Line dataKey="level" name="Predicted level (m)" stroke="#1686a5" strokeWidth={3} dot={false}/></LineChart></ResponsiveContainer></div></Panel>}
  </>
}
function predictedDataForChart(pred:any) { return pred.results.map((r:any)=>({time:`${r.time_hours.toFixed(2)}h`,level:r.level_m})) }
function MethodsPage({ tab, setTab, prediction, interpolation, integration, onRun, busy }: any) {
  return <>
    <PageHeading eyebrow="ACADEMIC COMPUTATION" title="Numerical methods lab" desc="Inspect the three numerical techniques implemented in the reservoir model." action={<button className="secondary-btn" onClick={onRun} disabled={busy}><RefreshCw size={15}/>Recalculate all</button>}/>
    <div className="tabs"><button className={tab==='rk4'?'selected':''} onClick={()=>setTab('rk4')}>Runge–Kutta RK4</button><button className={tab==='integration'?'selected':''} onClick={()=>setTab('integration')}>Numerical integration</button><button className={tab==='interpolation'?'selected':''} onClick={()=>setTab('interpolation')}>Interpolation</button></div>
    {tab==='rk4' && <><Panel title="Runge–Kutta Fourth Order" subtitle="Solves dh/dt = 3600(Qin − Qout)/A when time is in hours"><div className="equation">hₙ₊₁ = hₙ + Δt/6 (k₁ + 2k₂ + 2k₃ + k₄)</div><p className="muted">Each RK4 step evaluates four intermediate slopes. The flow values at intermediate times are obtained by linear interpolation of the supplied inflow/outflow readings.</p>{prediction ? <div className="table-scroll"><table><thead><tr><th>Time (h)</th><th>Predicted level (m)</th><th>k1</th><th>k2</th><th>k3</th><th>k4</th></tr></thead><tbody>{prediction.results.slice(1,9).map((r:any,i:number)=><tr key={i}><td>{r.time_hours}</td><td>{r.level_m.toFixed(5)}</td><td>{r.k_values.k1.toFixed(5)}</td><td>{r.k_values.k2.toFixed(5)}</td><td>{r.k_values.k3.toFixed(5)}</td><td>{r.k_values.k4.toFixed(5)}</td></tr>)}</tbody></table></div> : <div className="empty-state">Run a prediction to view RK4 iterations.</div>}</Panel></>}
    {tab==='integration' && <><Panel title="Composite trapezoidal rule" subtitle="Approximates cumulative flow volume over the observation period"><div className="equation">∫ f(t) dt ≈ Σ (Δtᵢ / 2)(fᵢ + fᵢ₊₁)</div>{integration ? <><div className="metric-grid three"><Metric label="Total inflow" value={integration.total_inflow_m3.toLocaleString()} unit="m³" icon={Waves}/><Metric label="Total outflow" value={integration.total_outflow_m3.toLocaleString()} unit="m³" icon={Activity} tone="amber"/><Metric label="Net volume change" value={integration.net_volume_change_m3.toLocaleString()} unit="m³" icon={TrendingUp} tone="teal"/></div><div className="table-scroll"><table><thead><tr><th>Interval</th><th>Inflow volume (m³)</th><th>Outflow volume (m³)</th></tr></thead><tbody>{integration.intervals.map((r:any,i:number)=><tr key={i}><td>{r.from_hours}–{r.to_hours} h</td><td>{r.inflow_volume_m3.toLocaleString()}</td><td>{r.outflow_volume_m3.toLocaleString()}</td></tr>)}</tbody></table></div></> : <div className="empty-state">Run calculations to view integration results.</div>}</Panel></>}
    {tab==='interpolation' && <><Panel title="Linear interpolation" subtitle="Estimates a missing level between two known observations"><div className="equation">y = y₁ + [(x − x₁)/(x₂ − x₁)](y₂ − y₁)</div>{interpolation ? <div className="table-scroll"><table><thead><tr><th>Time (h)</th><th>Original level (m)</th><th>Result (m)</th><th>Type</th></tr></thead><tbody>{interpolation.results.map((r:any,i:number)=><tr key={i}><td>{r.time_hours}</td><td>{r.original_level_m ?? '—'}</td><td>{r.level_m.toFixed(4)}</td><td>{r.estimated?<span className="tag warning">Estimated</span>:<span className="tag success">Observed</span>}</td></tr>)}</tbody></table></div> : <div className="empty-state">Run calculations to estimate missing readings.</div>}</Panel></>}
  </>
}
