import { useEffect, useRef } from 'react'
import * as d3 from 'd3'

const M = { top: 16, right: 24, bottom: 48, left: 52 }

export default function DistributionChart({ histogram, stats }) {
  const wrapRef = useRef(null)
  const svgRef  = useRef(null)

  useEffect(() => {
    if (!histogram?.counts?.length || !svgRef.current || !wrapRef.current) return

    const totalW = wrapRef.current.clientWidth || 900
    const totalH = 220
    const W = totalW - M.left - M.right
    const H = totalH - M.top  - M.bottom

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()
    svg.attr('width', totalW).attr('height', totalH)

    const g = svg.append('g').attr('transform', `translate(${M.left},${M.top})`)

    const { counts, years } = histogram
    const maxCount = Math.max(...counts)

    const x = d3.scaleBand()
      .domain(years.map(String))
      .range([0, W])
      .padding(0.08)

    const y = d3.scaleLinear()
      .domain([0, maxCount * 1.1])
      .range([H, 0])
      .nice()

    // Grid
    g.selectAll('.gy').data(y.ticks(4)).join('line')
      .attr('x1', 0).attr('x2', W)
      .attr('y1', d => y(d)).attr('y2', d => y(d))
      .attr('stroke', '#1e293b').attr('stroke-width', 1)

    // Bars — colour by year position (fast=green, slow=red)
    const maxYear = Math.max(...years)
    g.selectAll('rect').data(counts).join('rect')
      .attr('x', (_, i) => x(String(years[i])))
      .attr('y', d => y(d))
      .attr('width', x.bandwidth())
      .attr('height', d => H - y(d))
      .attr('fill', (_, i) => d3.interpolateRdYlGn(1 - (years[i] / maxYear) * 0.85))
      .attr('opacity', 0.75)
      .attr('rx', 2)

    // X-axis (show every 5 years to avoid crowding)
    const xAxis = d3.axisBottom(x)
      .tickValues(years.filter(yr => yr % 5 === 0).map(String))
      .tickFormat(d => `${d}y`)
    g.append('g').attr('transform', `translate(0,${H})`).call(xAxis)
      .call(ax => {
        ax.select('.domain').attr('stroke', '#334155')
        ax.selectAll('.tick line').attr('stroke', '#334155')
        ax.selectAll('text').attr('fill', '#94a3b8').attr('font-size', 11)
      })

    // Axis label
    g.append('text').attr('x', W / 2).attr('y', H + 40)
      .attr('text-anchor', 'middle').attr('fill', '#64748b').attr('font-size', 11)
      .text('Years to Retirement')

    // Percentile marker lines
    const markers = [
      { key: 'p10_years', label: 'p10', col: '#22c55e' },
      { key: 'p50_years', label: 'p50', col: '#3b82f6' },
      { key: 'median_years', label: 'med', col: '#3b82f6' },
      { key: 'p90_years', label: 'p90', col: '#f59e0b' },
    ]
    // prefer median_years over p50_years if both exist
    const seen = new Set()
    markers.forEach(({ key, label, col }) => {
      const val = stats?.[key]
      if (val == null || val === 0) return
      const yearKey = Math.round(val)
      if (seen.has(yearKey)) return
      seen.add(yearKey)
      const bx = x(String(yearKey))
      if (bx == null) return
      const cx = bx + x.bandwidth() / 2
      g.append('line').attr('x1', cx).attr('x2', cx).attr('y1', 0).attr('y2', H)
        .attr('stroke', col).attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '5,3').attr('opacity', 0.8)
      g.append('text').attr('x', cx + 3).attr('y', 10)
        .attr('fill', col).attr('font-size', 10).attr('font-weight', 600)
        .text(`${label} ${val.toFixed(1)}y`)
    })

  }, [histogram, stats])

  return (
    <div className="chart-card">
      <h2>Retirement Year Distribution</h2>
      <p className="chart-subtitle">
        How many of the 2,000 simulations retired at each year. Markers show key percentiles.
      </p>
      <div ref={wrapRef} style={{ width: '100%' }}>
        <svg ref={svgRef} style={{ display: 'block', width: '100%' }} />
      </div>
    </div>
  )
}
