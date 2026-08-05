import { Chart, type ArcElement } from 'chart.js'
import type { GaugeBreak } from '../types'

export function drawGaugeNeedle(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  outerR: number,
  pct: number
): void {
  const safePct = Number.isFinite(pct) ? Math.max(0, Math.min(1, pct)) : 0
  const angle = Math.PI + safePct * Math.PI
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
  ctx.restore()
}

export function drawGaugeBreakLabels(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  min: number,
  max: number,
  breaks: GaugeBreak[]
): void {
  const range = max - min
  if (range <= 0) return

  const labelR = (outerR + innerR) / 2
  const fontSize = Math.max(13, Math.floor(outerR * 0.14))
  ctx.save()
  ctx.font = `bold ${fontSize}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  for (const b of breaks) {
    const midVal = (b.lowerBound + b.upperBound) / 2
    const pct = (midVal - min) / range
    const angle = Math.PI + pct * Math.PI
    const x = cx + labelR * Math.cos(angle)
    const y = cy + labelR * Math.sin(angle)

    ctx.fillStyle = '#ffffff'
    ctx.fillText(String(b.upperBound), x, y)
  }

  ctx.restore()
}

export function buildNeedlePlugin(
  componentId: string,
  min: number,
  max: number,
  breaks: GaugeBreak[],
  pct: number,
  showLabels: boolean
) {
  return {
    id: `gaugeNeedle-${componentId}`,
    afterDraw(chart: Chart) {
      const { ctx } = chart
      const arcEl = chart.getDatasetMeta(0).data[0] as ArcElement
      if (!arcEl) return
      if (showLabels) {
        drawGaugeBreakLabels(
          ctx,
          arcEl.x,
          arcEl.y,
          arcEl.outerRadius,
          arcEl.innerRadius,
          min,
          max,
          breaks
        )
      }
      drawGaugeNeedle(ctx, arcEl.x, arcEl.y, arcEl.outerRadius, pct)
    },
  }
}
