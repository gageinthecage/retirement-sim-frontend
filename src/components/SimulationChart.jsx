import { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'

const M = { top: 16, right: 24, bottom: 52, left: 82 }

function fmtMoney(v) {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`
  return `$${v.toFixed(0)}`
}

// Map percentile_rank (0-100) to a colour.
// 0 = never retired (gray), low = red, mid = amber, high = green
function rankColor(prank, retired) {
  if (!retired) return '#475569'
  const t = prank / 100
  return d3.interpolateRdYlGn(t * 0.85 + 0.075) // avoid extreme ends
}

export default function SimulationChart({ paths, bands, monthsAxis, targetAmount, yMax }) {
  const wrapRef = useRef(null)
  const svgRef  = useRef(null)
  const [tooltip, setTooltip] = useState(null)

  useEffect(() => {
    if (!paths?.length || !svgRef.current || !wrapRef.current) return

    const totalW = wrapRef.current.clientWidth || 900
    const totalH = 480
    const W = totalW - M.left - M.right
    const H = totalH - M.top  - M.bottom

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()
    svg.attr('width', totalW).attr('height', totalH)

    const g = svg.append('g').attr('transform', `translate(${M.left},${M.top})`)

    // ── Scales ────────────────────────────────────────────────────────────
    const allYears  = paths.flatMap(p => p.years)
    const maxYear   = Math.max(...allYears, 1)
    // Scale Y based on the actual path values (paths are already truncated at
    // retirement), not the long-run yMax which can be hundreds of millions.
    const pathMax   = Math.max(...paths.flatMap(p => p.values), targetAmount ?? 0)
    const yCapValue = pathMax * 1.15

    const x = d3.scaleLinear().domain([0, maxYear]).range([0, W])
    const y = d3.scaleLinear().domain([0, yCapValue * 1.04]).range([H, 0]).nice()

    // ── Grid ──────────────────────────────────────────────────────────────
    const gridG = g.append('g')
    gridG.selectAll('.gx').data(x.ticks(8)).join('line')
      .attr('x1', d => x(d)).attr('x2', d => x(d))
      .attr('y1', 0).attr('y2', H)
      .attr('stroke', '#1e293b').attr('stroke-width', 1)
    gridG.selectAll('.gy').data(y.ticks(6)).join('line')
      .attr('x1', 0).attr('x2', W)
      .attr('y1', d => y(d)).attr('y2', d => y(d))
      .attr('stroke', '#1e293b').attr('stroke-width', 1)

    // ── Axes ──────────────────────────────────────────────────────────────
    const xAxis = d3.axisBottom(x).ticks(8).tickFormat(d => `${d}y`)
    const yAxis = d3.axisLeft(y).ticks(6).tickFormat(fmtMoney)

    g.append('g').attr('transform', `translate(0,${H})`).call(xAxis)
      .call(ax => {
        ax.select('.domain').attr('stroke', '#334155')
        ax.selectAll('.tick line').attr('stroke', '#334155')
        ax.selectAll('text').attr('fill', '#94a3b8').attr('font-size', 12)
      })

    g.append('g').call(yAxis)
      .call(ax => {
        ax.select('.domain').attr('stroke', '#334155')
        ax.selectAll('.tick line').attr('stroke', '#334155')
        ax.selectAll('text').attr('fill', '#94a3b8').attr('font-size', 12)
      })

    // Axis labels
    g.append('text').attr('x', W / 2).attr('y', H + 44)
      .attr('text-anchor', 'middle').attr('fill', '#64748b').attr('font-size', 12)
      .text('Years')
    g.append('text')
      .attr('transform', 'rotate(-90)').attr('x', -H / 2).attr('y', -68)
      .attr('text-anchor', 'middle').attr('fill', '#64748b').attr('font-size', 12)
      .text('Portfolio Value')

    // ── Percentile band shading ────────────────────────────────────────────
    if (bands && monthsAxis) {
      const bandYears = monthsAxis.map(m => m / 12)

      function buildArea(lo, hi) {
        return d3.area()
          .x((_, i) => x(bandYears[i]))
          .y0(d => y(bands[lo][d]))
          .y1(d => y(bands[hi][d]))
          .defined((_, i) => i < bandYears.length && bandYears[i] <= maxYear)
          .curve(d3.curveCatmullRom)(d3.range(bandYears.length))
      }

      g.append('path').attr('d', buildArea('p10', 'p90'))
        .attr('fill', '#3b82f6').attr('opacity', 0.05)
      g.append('path').attr('d', buildArea('p25', 'p75'))
        .attr('fill', '#3b82f6').attr('opacity', 0.08)

      // Median line
      const medLine = d3.line()
        .x((_, i) => x(bandYears[i]))
        .y(d => y(bands['p50'][d]))
        .defined((_, i) => bandYears[i] <= maxYear)
        .curve(d3.curveCatmullRom)
      g.append('path').attr('d', medLine(d3.range(bandYears.length)))
        .attr('fill', 'none').attr('stroke', '#3b82f6')
        .attr('stroke-width', 1.5).attr('opacity', 0.45)
        .attr('stroke-dasharray', '5,3')
    }

    // ── Clip ──────────────────────────────────────────────────────────────
    const clipId = `clip-${Math.random().toString(36).slice(2)}`
    g.append('defs').append('clipPath').attr('id', clipId)
      .append('rect').attr('width', W).attr('height', H)
    const area = g.append('g').attr('clip-path', `url(#${clipId})`)

    // ── Individual paths ───────────────────────────────────────────────────
    const lineGen = d3.line()
      .x(d => x(d[0]))
      .y(d => y(d[1]))
      .curve(d3.curveCatmullRom.alpha(0.5))

    // Sort so higher-percentile paths render on top
    const sorted = [...paths].sort((a, b) => a.percentile_rank - b.percentile_rank)

    const pathEls = area.selectAll('.sp')
      .data(sorted)
      .join('path')
      .attr('class', 'sp')
      .attr('d', d => lineGen(d.years.map((yr, i) => [yr, Math.min(d.values[i], yCapValue * 1.04)])))
      .attr('fill', 'none')
      .attr('stroke', d => rankColor(d.percentile_rank, d.final_year != null))
      .attr('stroke-width', 1)
      .attr('opacity', 0.28)

    // Highlighted path drawn over everything
    const highlight = area.append('path')
      .attr('fill', 'none').attr('stroke-width', 2.5).attr('opacity', 0)

    // ── Target line ───────────────────────────────────────────────────────
    if (targetAmount != null && targetAmount <= yCapValue * 1.04) {
      area.append('line')
        .attr('x1', 0).attr('x2', W)
        .attr('y1', y(targetAmount)).attr('y2', y(targetAmount))
        .attr('stroke', '#a78bfa').attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '7,4').attr('opacity', 0.8)
      area.append('text')
        .attr('x', W - 4).attr('y', y(targetAmount) - 6)
        .attr('text-anchor', 'end').attr('fill', '#a78bfa')
        .attr('font-size', 11).attr('font-weight', 600)
        .text(`Target ${fmtMoney(targetAmount)}`)
    }

    // ── Crosshair elements ────────────────────────────────────────────────
    const vLine = g.append('line')
      .attr('y1', 0).attr('y2', H)
      .attr('stroke', '#475569').attr('stroke-width', 1)
      .attr('stroke-dasharray', '4,3').attr('opacity', 0)
    const dot = g.append('circle').attr('r', 5)
      .attr('fill', '#0f172a').attr('stroke-width', 2).attr('opacity', 0)

    // ── Interaction ───────────────────────────────────────────────────────
    let activeIdx = -1

    g.append('rect').attr('width', W).attr('height', H)
      .attr('fill', 'transparent').style('cursor', 'crosshair')
      .on('mousemove', function (event) {
        const [mx, my] = d3.pointer(event)
        const yr = x.invert(mx)

        // Find nearest path by y-distance at this year
        let bestIdx = -1
        let bestDist = 40
        sorted.forEach((p, i) => {
          if (!p.years.length) return
          // Interpolate value at yr
          const lo = d3.bisectLeft(p.years, yr)
          if (lo === 0 || lo >= p.years.length) return
          const t = (yr - p.years[lo - 1]) / (p.years[lo] - p.years[lo - 1])
          const val = p.values[lo - 1] + t * (p.values[lo] - p.values[lo - 1])
          const dist = Math.abs(y(Math.min(val, yCapValue * 1.04)) - my)
          if (dist < bestDist) { bestDist = dist; bestIdx = i }
        })

        if (bestIdx === -1) {
          // drift off — keep previous highlight, just hide dot
          return
        }

        if (bestIdx !== activeIdx) {
          activeIdx = bestIdx
          pathEls.attr('opacity', 0.06).attr('stroke-width', 0.8)
          const p = sorted[bestIdx]
          const col = rankColor(p.percentile_rank, p.final_year != null)
          highlight
            .attr('d', lineGen(p.years.map((yrr, i) => [yrr, Math.min(p.values[i], yCapValue * 1.04)])))
            .attr('stroke', col).attr('opacity', 1)
          dot.attr('stroke', col)
        }

        // Update crosshair position & tooltip
        const p = sorted[bestIdx]
        const lo = d3.bisectLeft(p.years, yr)
        const clampLo = Math.max(1, Math.min(lo, p.years.length - 1))
        const t = (yr - p.years[clampLo - 1]) / (p.years[clampLo] - p.years[clampLo - 1]) || 0
        const val = p.values[clampLo - 1] + t * (p.values[clampLo] - p.values[clampLo - 1])
        const capVal = Math.min(val, yCapValue * 1.04)

        vLine.attr('x1', mx).attr('x2', mx).attr('opacity', 0.5)
        dot.attr('cx', mx).attr('cy', y(capVal)).attr('opacity', 1)

        const bounding = wrapRef.current.getBoundingClientRect()
        const svgBound = svgRef.current.getBoundingClientRect()
        setTooltip({
          x: mx + M.left,
          y: y(capVal) + M.top,
          containerW: totalW,
          year: yr,
          value: val,
          prank: p.percentile_rank,
          finalYear: p.final_year,
        })
      })
      .on('mouseleave', () => {
        activeIdx = -1
        pathEls.attr('opacity', 0.28).attr('stroke-width', 1)
        highlight.attr('opacity', 0)
        vLine.attr('opacity', 0)
        dot.attr('opacity', 0)
        setTooltip(null)
      })

  }, [paths, bands, monthsAxis, targetAmount, yMax])

  const tipLeft = tooltip
    ? (tooltip.x + 220 > tooltip.containerW ? tooltip.x - 220 : tooltip.x + 14)
    : 0

  return (
    <div className="chart-card">
      <h2>Simulation Paths</h2>
      <p className="chart-subtitle">
        Hover over any path to see its portfolio value and rarity. Colour indicates retirement speed.
      </p>
      <div className="legend">
        <span className="legend-item">
          <span className="legend-line" style={{ background: d3.interpolateRdYlGn(0.88) }} />
          Fast (top 25%)
        </span>
        <span className="legend-item">
          <span className="legend-line" style={{ background: d3.interpolateRdYlGn(0.5) }} />
          Median
        </span>
        <span className="legend-item">
          <span className="legend-line" style={{ background: d3.interpolateRdYlGn(0.12) }} />
          Slow (bottom 25%)
        </span>
        <span className="legend-item">
          <span className="legend-line" style={{ background: '#475569' }} />
          Never retired
        </span>
        <span className="legend-item">
          <span className="legend-line dashed" />
          Target
        </span>
        <span className="legend-item">
          <span className="legend-line" style={{ background: '#3b82f6', opacity: 0.5 }} />
          Median band (p25–p75)
        </span>
      </div>
      <div ref={wrapRef} style={{ position: 'relative', width: '100%' }}>
        <svg ref={svgRef} style={{ display: 'block', width: '100%' }} />
        {tooltip && (
          <div
            className="chart-tooltip"
            style={{
              left: tipLeft,
              top: Math.max(0, tooltip.y - 80),
              transform: 'translateY(-10px)',
            }}
          >
            <div className="tooltip-year">Year {tooltip.year.toFixed(1)}</div>
            <div className="tooltip-value">{fmtMoney(tooltip.value)}</div>
            <div className="tooltip-retired">
              {tooltip.finalYear != null
                ? `Retires in ${tooltip.finalYear.toFixed(1)} yrs`
                : 'Did not reach target'}
            </div>
            {tooltip.finalYear != null && (
              <>
                <div className="tooltip-pct-bar">
                  <div
                    className="tooltip-pct-fill"
                    style={{
                      width: `${tooltip.prank}%`,
                      background: rankColor(tooltip.prank, true),
                    }}
                  />
                </div>
                <div className="tooltip-pct-label">
                  Faster than {tooltip.prank.toFixed(0)}% of paths
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// expose for App legend
SimulationChart.rankColor = rankColor
