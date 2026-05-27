import { useState } from 'react'
import './App.css'
import SimulationForm from './components/SimulationForm'
import SimulationChart from './components/SimulationChart'
import DistributionChart from './components/DistributionChart'

// In development this falls back to localhost.
// Set VITE_API_URL in your Vercel/Netlify environment variables to your deployed backend URL.
const API = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'

function fmt(n, decimals = 1) {
  return n?.toFixed(decimals) ?? '—'
}

function fmtPct(n) {
  return n != null ? `${n.toFixed(1)}%` : '—'
}

export default function App() {
  const [result, setResult] = useState(null)
  const [params, setParams] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleSimulate(values) {
    setLoading(true)
    setError(null)
    setParams(values)
    try {
      const { starting, monthly, target } = values
      const url = `${API}/simulate?starting=${starting}&monthly=${monthly}&target=${target}`
      const res = await fetch(url, { method: 'POST' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.detail || `Server error ${res.status}`)
      }
      setResult(await res.json())
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const s = result?.stats ?? {}

  return (
    <div className="app">
      <header className="app-header">
        <h1>Retirement Portfolio Simulator</h1>
        <p>Monte Carlo · Geometric Brownian Motion · S&amp;P 500 historical parameters</p>
      </header>

      <SimulationForm onSimulate={handleSimulate} loading={loading} />

      {error && <div className="error-banner">{error}</div>}

      {result && (
        <>
          <div className="stats-row">
            <div className="stat-card">
              <div className="stat-label">Success Rate</div>
              <div className={`stat-value ${result.success_rate >= 80 ? 'green' : result.success_rate >= 50 ? 'amber' : 'red'}`}>
                {fmtPct(result.success_rate)}
              </div>
              <div className="stat-sub">reach target within {result.parameters?.annual_return_pct}% avg return</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Median Retirement</div>
              <div className="stat-value blue">{fmt(s.median_years)} <span style={{ fontSize: 14, fontWeight: 500 }}>yrs</span></div>
              <div className="stat-sub">50% of simulations</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Best 10% (p10)</div>
              <div className="stat-value green">{fmt(s.p10_years)} <span style={{ fontSize: 14, fontWeight: 500 }}>yrs</span></div>
              <div className="stat-sub">fastest paths</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Worst 10% (p90)</div>
              <div className="stat-value amber">{fmt(s.p90_years)} <span style={{ fontSize: 14, fontWeight: 500 }}>yrs</span></div>
              <div className="stat-sub">slowest successful paths</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Simulations Run</div>
              <div className="stat-value purple">{result.n_simulations?.toLocaleString()}</div>
              <div className="stat-sub">independent paths</div>
            </div>
          </div>

          <SimulationChart
            paths={result.individual_paths}
            bands={result.bands}
            monthsAxis={result.months_axis}
            targetAmount={params?.target}
            yMax={result.y_max}
          />

          <DistributionChart
            histogram={result.histogram}
            stats={s}
          />
        </>
      )}
    </div>
  )
}
