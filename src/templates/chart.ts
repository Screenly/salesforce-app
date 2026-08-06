import { Chart, registerables } from 'chart.js'
import ChartDataLabels from 'chartjs-plugin-datalabels'
import type { ReportResult } from '../types'
import {
  buildDatalabelsConfig,
  buildScalesConfig,
  CHART_COLORS,
  extractChartData,
} from './chart.lib'
import type { ChartKind } from './chart.types'
import { mountEmpty } from './empty'

Chart.register(...registerables, ChartDataLabels)

Chart.defaults.animation = false

export function mountChart(
  container: HTMLElement,
  componentId: string,
  reportResult: ReportResult,
  chartKind: ChartKind,
  title: string,
  showLabels: boolean = false
): void {
  const { labels, values } = extractChartData(reportResult)

  if (labels.length === 0) {
    mountEmpty(container)
    return
  }

  const isHorizontalBar = chartKind === 'horizontalBar'
  const chartJsType = chartKind === 'horizontalBar' ? 'bar' : chartKind
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
  })
}
