import { Chart, registerables } from 'chart.js'
import ChartDataLabels from 'chartjs-plugin-datalabels'
import type { ReportResult } from '../types'
import { renderEmpty } from './utils'

Chart.register(...registerables, ChartDataLabels)

Chart.defaults.animation = false

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
  'horizontal bar',
  'line',
  'pie',
  'donut',
  'doughnut',
])

function normalizeChartType(sfType: string): string {
  return sfType.trim().toLowerCase()
}

function mapChartType(sfType: string): 'bar' | 'line' | 'pie' | 'doughnut' {
  const t = normalizeChartType(sfType)
  if (t === 'donut') return 'doughnut'
  if (t === 'bar' || t === 'column' || t === 'horizontal bar') return 'bar'
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

function buildDatalabelsConfig(chartType: 'bar' | 'line' | 'pie' | 'doughnut') {
  const base = {
    color: '#ffffff' as const,
    font: { weight: 'bold' as const, size: 20 },
    formatter: (value: number) => (value === 0 ? '' : value.toLocaleString()),
  }
  if (chartType === 'bar') {
    return {
      ...base,
      anchor: 'end' as const,
      align: 'start' as const,
      clamp: true,
    }
  }
  if (chartType === 'line') {
    return {
      ...base,
      font: { weight: 'bold' as const, size: 15 },
      anchor: 'end' as const,
      align: 'top' as const,
      backgroundColor: 'rgba(0,0,0,0.55)',
      borderRadius: 3,
      padding: { top: 2, bottom: 2, left: 4, right: 4 },
    }
  }
  return { ...base, anchor: 'center' as const, align: 'center' as const }
}

function buildScalesConfig(chartType: 'bar' | 'line' | 'pie' | 'doughnut') {
  if (chartType !== 'bar' && chartType !== 'line') return undefined
  const axis = { ticks: { color: '#ffffff' }, grid: { color: '#ffffff22' } }
  return { x: axis, y: axis }
}

export function renderChart(
  container: HTMLElement,
  componentId: string,
  reportResult: ReportResult,
  sfType: string,
  title: string,
  showLabels: boolean = false
): void {
  const { labels, values } = extractChartData(reportResult)

  if (labels.length === 0) {
    renderEmpty(container)
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
