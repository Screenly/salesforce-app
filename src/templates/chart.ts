import { Chart, registerables } from 'chart.js'
import ChartDataLabels from 'chartjs-plugin-datalabels'
import type { ReportResult } from '../types'
import {
  buildDatalabelsConfig,
  buildScalesConfig,
  CHART_COLORS,
  extractChartData,
  mapChartType,
  normalizeChartType,
} from './chart.lib'
import { mountEmpty } from './empty'

Chart.register(...registerables, ChartDataLabels)

Chart.defaults.animation = false

export function mountChart(
  container: HTMLElement,
  componentId: string,
  reportResult: ReportResult,
  sfType: string,
  title: string,
  showLabels: boolean = false
): void {
  const { labels, values } = extractChartData(reportResult)

  if (labels.length === 0) {
    mountEmpty(container)
    return
  }

  const chartType = mapChartType(sfType)
  const normalizedType = normalizeChartType(sfType)
  const isHorizontalBar =
    normalizedType === 'bar' || normalizedType === 'horizontal bar'
  const canvas = document.createElement('canvas')
  canvas.id = `chart-${componentId}`
  container.appendChild(canvas)

  new Chart(canvas, {
    type: chartType,
    data: {
      labels,
      datasets: [
        {
          label: title,
          data: values,
          backgroundColor: CHART_COLORS,
          borderColor: chartType === 'line' ? CHART_COLORS[0] : CHART_COLORS,
          borderWidth: chartType === 'line' ? 2 : 1,
          fill: chartType === 'line' ? false : undefined,
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
          ? buildDatalabelsConfig(chartType)
          : { display: false },
      },
      scales: buildScalesConfig(chartType),
    },
  })
}
