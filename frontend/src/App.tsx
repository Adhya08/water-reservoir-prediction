import { useMemo, useState } from 'react'
import {
  LayoutDashboard, Database, TrendingUp, Calculator, ChartNoAxesCombined,
  Bell, FileText, Droplets, Play, Waves, Activity, AlertTriangle, CheckCircle2, Menu, X
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

export default function App() {
  const [active, setActive] = useState<NavKey>('Overview')
  const [readings, setReadings] = useState<Reading[]>(initialReadings)
  const [area, setArea] = useState(10000)
  const [duration, setDuration] = useState(6)
  const [step, setStep] = useState(1)
  const [prediction, setPrediction] = useState<any>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
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
      const pred = await api('/simulate', { readings, area_m2: area, duration_hours: duration, step_hours: step })
      setPrediction(pred)
      setMessage('Calculations completed successfully.')
    } catch (e: any) { setMessage(e.message || 'Could not complete calculations.') }
    finally { setBusy(false) }
  }

  const title = active

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
      <section className="page">
        <PageHeading eyebrow="LIVE SIMULATION OVERVIEW" title="Reservoir overview" desc="A consolidated view of water levels, flow rates and calculated trends."
          action={<button className="primary-btn" onClick={runAll} disabled={busy}><Play size={16}/>{busy ? 'Calculating…' : 'Run calculations'}</button>}/>
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
            {allAlerts.length ? <div className="alert-list">{allAlerts.slice(0,4).map((a:string,i:number)=><div className="alert-row" key={i}><AlertTriangle size={17}/><span>{a}</span></div>)}</div> : <div className="empty-state"><CheckCircle2 size={25}/><b>No active alerts</b><span>Current readings do not trigger configured demo rules.</span></div>}
          </Panel>
        </div>
      </section>
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
