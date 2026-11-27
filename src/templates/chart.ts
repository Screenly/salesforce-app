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
      const fontSize = Math.max(14, Math.round(arc.innerRadius * 0.5))
      ctx.save()
      ctx.font = `bold ${fontSize}px ${Chart.defaults.font.family}`
      ctx.fillStyle = '#ffffff'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(total.toLocaleString(), arc.x, arc.y)
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
