import { useState } from 'react'

function NumericInput({ label, id, value, onChange, placeholder }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="input-wrap">
        <span className="dollar">$</span>
        <input
          id={id}
          type="number"
          min="0"
          step="any"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
        />
      </div>
    </div>
  )
}

export default function SimulationForm({ onSimulate, loading }) {
  const [starting, setStarting] = useState('')
  const [monthly, setMonthly] = useState('')
  const [target, setTarget] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    const s = parseFloat(starting)
    const m = parseFloat(monthly)
    const t = parseFloat(target)
    if (isNaN(s) || isNaN(m) || isNaN(t) || s < 0 || m < 0 || t <= 0) return
    onSimulate({ starting: s, monthly: m, target: t })
  }

  return (
    <form className="form-card" onSubmit={handleSubmit}>
      <div className="form-grid">
        <NumericInput
          label="Starting Amount"
          id="starting"
          value={starting}
          onChange={setStarting}
          placeholder="50,000"
        />
        <NumericInput
          label="Monthly Contribution"
          id="monthly"
          value={monthly}
          onChange={setMonthly}
          placeholder="1,000"
        />
        <NumericInput
          label="Target Amount"
          id="target"
          value={target}
          onChange={setTarget}
          placeholder="1,000,000"
        />
      </div>
      <button
        className="btn-simulate"
        type="submit"
        disabled={loading || !starting || !monthly || !target}
      >
        {loading && <span className="spinner" />}
        {loading ? 'Simulating…' : 'Run Simulation'}
      </button>
    </form>
  )
}
