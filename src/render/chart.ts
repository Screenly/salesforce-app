import { Chart, registerables } from 'chart.js'
import type { ReportResult } from '../types'
import { renderEmpty } from './utils'

Chart.register(...registerables)

if (new URLSearchParams(window.location.search).get('animations') === 'false') {
  Chart.defaults.animation = false
}

const CHART_COLORS = [
  '#4F8EF7',
  '#AC1FFF',
  '#00C9A7',
  '#FFB347',
  '#FF6B6B',
  '#48DBFB',
  '#FF9FF3',
  '#54A0FF',
]

export const CHART_TYPES = new Set([
  'bar',
  'column',
  'line',
  'pie',
  'donut',
  'doughnut',
])

function mapChartType(sfType: string): 'bar' | 'line' | 'pie' | 'doughnut' {
  const t = sfType.toLowerCase()
  if (t === 'donut') return 'doughnut'
  if (t === 'bar' || t === 'column') return 'bar'
  if (t === 'line') return 'line'
  if (t === 'pie') return 'pie'
  return 'bar'
}

function extractChartData(reportResult: ReportResult): {
  labels: string[]
  values: number[]
} {
  const factMap = reportResult.factMap ?? {}
  const groupings = reportResult.groupingsDown?.groupings ?? []
  const groupingMap = new Map(groupings.map((g) => [g.key, g.label]))
  const labels: string[] = []
  const values: number[] = []

  for (const [key, entry] of Object.entries(factMap)) {
    if (key === 'T!T') continue
    const groupKey = key.split('!')[0]
    const label = groupingMap.get(groupKey) ?? groupKey.replace(/_/g, ' ')
    const value = entry.aggregates?.[0]?.value ?? 0
    labels.push(label)
    values.push(Number(value))
  }

  return { labels, values }
}

export function renderChart(
  container: HTMLElement,
  componentId: string,
  reportResult: ReportResult,
  sfType: string,
  title: string
): void {
  const { labels, values } = extractChartData(reportResult)

  if (labels.length === 0) {
    renderEmpty(container)
    return
  }

  const chartType = mapChartType(sfType)
  const isHorizontalBar = sfType.toLowerCase() === 'bar'
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
      },
      scales:
        chartType === 'bar' || chartType === 'line'
          ? {
              x: {
                ticks: { color: '#ffffff' },
                grid: { color: '#ffffff22' },
              },
              y: {
                ticks: { color: '#ffffff' },
                grid: { color: '#ffffff22' },
              },
            }
          : undefined,
    },
  })
}
