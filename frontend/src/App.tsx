import { useState } from 'react'
import {
  LayoutDashboard, Database, TrendingUp, Calculator, ChartNoAxesCombined,
  Bell, FileText, Droplets, Menu, X
} from 'lucide-react'

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
  const [mobileOpen, setMobileOpen] = useState(false)

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
      <section className="page">
        <div className="empty-state">Select a module from the workspace navigation.</div>
      </section>
      <footer className="footer">AquaPredict · Numerical Methods Project <span>Demo data only — not for operational dam control</span></footer>
    </main>
  </div>
}
