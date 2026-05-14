import {
  Chart,
  registerables,
  type ArcElement,
  type ChartConfiguration,
} from 'chart.js'
import type {
  DashboardMetadataComponent,
  GaugeVisualizationProperties,
  ReportResult,
} from '../types'
import { renderEmpty } from './utils'

Chart.register(...registerables)

function drawGaugeNeedle(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  outerR: number,
  pct: number,
  value: number
): void {
  const angle = Math.PI + pct * Math.PI
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(cx, cy)
  ctx.lineTo(
    cx + outerR * 0.75 * Math.cos(angle),
    cy + outerR * 0.75 * Math.sin(angle)
  )
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = Math.max(2, outerR * 0.025)
  ctx.lineCap = 'round'
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(cx, cy, outerR * 0.06, 0, 2 * Math.PI)
  ctx.fillStyle = '#ffffff'
  ctx.fill()
  ctx.font = `bold ${Math.floor(outerR * 0.22)}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(String(value), cx, cy + outerR * 0.35)
  ctx.restore()
}

export function renderGauge(
  container: HTMLElement,
  componentId: string,
  reportResult: ReportResult,
  meta: DashboardMetadataComponent
): void {
  const value = Number(
    reportResult.factMap?.['T!T']?.aggregates?.[0]?.value ?? 0
  )
  const vizProps = meta.properties.visualizationProperties as
    | GaugeVisualizationProperties
    | undefined
  const breaks = vizProps?.breakPoints?.[0]?.breaks ?? []

  if (breaks.length === 0) {
    renderEmpty(container)
    return
  }

  const min = breaks[0].lowerBound
  const max = breaks[breaks.length - 1].upperBound
  const pct = Math.max(0, Math.min(1, (value - min) / (max - min)))

  const canvas = document.createElement('canvas')
  canvas.id = `chart-${componentId}`
  container.appendChild(canvas)

  const needlePlugin = {
    id: `gaugeNeedle-${componentId}`,
    afterDraw(chart: Chart) {
      const { ctx } = chart
      const arcEl = chart.getDatasetMeta(0).data[0] as ArcElement
      if (!arcEl) return
      drawGaugeNeedle(ctx, arcEl.x, arcEl.y, arcEl.outerRadius, pct, value)
    },
  }

  const gaugeConfig: ChartConfiguration<'doughnut'> = {
    type: 'doughnut',
    data: {
      datasets: [
        {
          data: breaks.map((b) => b.upperBound - b.lowerBound),
          backgroundColor: breaks.map((b) => `#${b.color}`),
          borderWidth: 0,
        },
      ],
    },
    options: {
      circumference: 180,
      rotation: -90,
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false },
      },
    },
    plugins: [needlePlugin],
  }
  new Chart(canvas, gaugeConfig)
}
