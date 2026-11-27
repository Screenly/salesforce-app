import { Chart, registerables, type Plugin } from 'chart.js'
import ChartDataLabels from 'chartjs-plugin-datalabels'
import type { ReportResult } from '../types'
import {
  buildDatalabelsConfig,
  buildScalesConfig,
  CHART_COLORS,
  extractChartData,
  resetChartContainer,
} from './chart.lib'
import type { ChartKind } from './chart.types'
import { mountEmpty } from './empty'

Chart.register(...registerables, ChartDataLabels)

Chart.defaults.animation = false

// Draws the grand total in the hole of a donut chart, as Salesforce does.
function centerTotalPlugin(total: number): Plugin<'doughnut'> {
  return {
    id: 'centerTotal',
    afterDraw(chart) {
      const meta = chart.getDatasetMeta(0)
      const arc = meta.data[0] as unknown as
        { x: number; y: number; innerRadius: number } | undefined
      if (!arc || !arc.innerRadius) return

      const { ctx } = chart
      const text = total.toLocaleString()
      const font = (size: number) =>
        `bold ${size}px ${Chart.defaults.font.family}`
      // Start from half the hole radius, then shrink so the text stays
      // within 80% of the hole's width, however long the number is.
      const maxWidth = arc.innerRadius * 2 * 0.8
      let fontSize = Math.round(arc.innerRadius * 0.5)
      ctx.save()
      ctx.font = font(fontSize)
      const textWidth = ctx.measureText(text).width
      if (textWidth > maxWidth) {
        fontSize = Math.floor((fontSize * maxWidth) / textWidth)
        ctx.font = font(fontSize)
      }
      if (fontSize < 8) {
        ctx.restore()
        return
      }
      ctx.fillStyle = '#ffffff'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(text, arc.x, arc.y)
      ctx.restore()
    },
  }
}

export function mountChart(
  container: HTMLElement,
  componentId: string,
  reportResult: ReportResult,
  chartKind: ChartKind,
  title: string,
  showLabels: boolean = false
): void {
  const { labels, values, total } = extractChartData(reportResult)

  if (labels.length === 0) {
    mountEmpty(container)
    return
  }

  const isHorizontalBar = chartKind === 'horizontalBar'
  const chartJsType = chartKind === 'horizontalBar' ? 'bar' : chartKind

  resetChartContainer(container)

  const canvas = document.createElement('canvas')
  canvas.id = `chart-${componentId}`
  container.appendChild(canvas)

  new Chart(canvas, {
    type: chartJsType,
    data: {
      labels,
      datasets: [
        {
          label: title,
          data: values,
          backgroundColor: CHART_COLORS,
          borderColor: chartKind === 'line' ? CHART_COLORS[0] : CHART_COLORS,
          borderWidth: chartKind === 'line' ? 2 : 1,
          fill: chartKind === 'line' ? false : undefined,
        },
      ],
    },
    options: {
      indexAxis: isHorizontalBar ? 'y' : 'x',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#ffffff' } },
        datalabels: showLabels
          ? buildDatalabelsConfig(chartKind)
          : { display: false },
      },
      scales: buildScalesConfig(chartKind),
    },
    plugins: chartKind === 'doughnut' ? [centerTotalPlugin(total)] : [],
  })
}
