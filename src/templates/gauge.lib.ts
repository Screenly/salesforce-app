import { Chart, type ArcElement } from 'chart.js'
import type { GaugeBreak } from '../types'

export function drawGaugeNeedle(
  context: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  outerRadius: number,
  percent: number
): void {
  const safePercent = Number.isFinite(percent)
    ? Math.max(0, Math.min(1, percent))
    : 0
  const angle = Math.PI + safePercent * Math.PI
  context.save()
  context.beginPath()
  context.moveTo(cx, cy)
  context.lineTo(
    cx + outerRadius * 0.75 * Math.cos(angle),
    cy + outerRadius * 0.75 * Math.sin(angle)
  )
  context.strokeStyle = '#ffffff'
  context.lineWidth = Math.max(2, outerRadius * 0.025)
  context.lineCap = 'round'
  context.stroke()
  context.beginPath()
  context.arc(cx, cy, outerRadius * 0.06, 0, 2 * Math.PI)
  context.fillStyle = '#ffffff'
  context.fill()
  context.restore()
}

export function drawGaugeBreakLabels(
  context: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  outerRadius: number,
  innerRadius: number,
  min: number,
  max: number,
  breaks: GaugeBreak[]
): void {
  const range = max - min
  if (range <= 0) return

  const labelRadius = (outerRadius + innerRadius) / 2
  const fontSize = Math.max(13, Math.floor(outerRadius * 0.14))
  context.save()
  context.font = `bold ${fontSize}px sans-serif`
  context.textAlign = 'center'
  context.textBaseline = 'middle'

  for (const gaugeBreak of breaks) {
    const midVal = (gaugeBreak.lowerBound + gaugeBreak.upperBound) / 2
    const percent = (midVal - min) / range
    const angle = Math.PI + percent * Math.PI
    const x = cx + labelRadius * Math.cos(angle)
    const y = cy + labelRadius * Math.sin(angle)

    context.fillStyle = '#ffffff'
    context.fillText(String(gaugeBreak.upperBound), x, y)
  }

  context.restore()
}

export function buildNeedlePlugin(
  componentId: string,
  min: number,
  max: number,
  breaks: GaugeBreak[],
  percent: number,
  showLabels: boolean
) {
  return {
    id: `gaugeNeedle-${componentId}`,
    afterDraw(chart: Chart) {
      const { ctx: context } = chart
      const arcEl = chart.getDatasetMeta(0).data[0] as ArcElement
      if (!arcEl) return
      if (showLabels) {
        drawGaugeBreakLabels(
          context,
          arcEl.x,
          arcEl.y,
          arcEl.outerRadius,
          arcEl.innerRadius,
          min,
          max,
          breaks
        )
      }
      drawGaugeNeedle(context, arcEl.x, arcEl.y, arcEl.outerRadius, percent)
    },
  }
}
