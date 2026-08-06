import type { ReportResult } from '../types'
import type { ChartData, ChartKind } from './chart.types'

export const CHART_TYPES = new Set([
  'bar',
  'column',
  'line',
  'pie',
  'donut',
  'doughnut',
])

export const CHART_COLORS = [
  '#4F8EF7',
  '#AC1FFF',
  '#00C9A7',
  '#FFB347',
  '#FF6B6B',
  '#48DBFB',
  '#FF9FF3',
  '#54A0FF',
]

const VISUALIZATION_TYPE_TO_CHART_KIND: Record<string, ChartKind> = {
  donut: 'doughnut',
  bar: 'horizontalBar',
  column: 'bar',
  line: 'line',
  pie: 'pie',
}

export function mapChartType(visualizationType: string): ChartKind {
  const normalizedVisualizationType = visualizationType.trim().toLowerCase()
  return VISUALIZATION_TYPE_TO_CHART_KIND[normalizedVisualizationType] ?? 'bar'
}

export function extractChartData(reportResult: ReportResult): ChartData {
  const factMap = reportResult.factMap ?? {}
  const groupings = reportResult.groupingsDown?.groupings ?? []
  const groupingMap = new Map(
    groupings.map((grouping) => [grouping.key, grouping.label])
  )
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

export function buildDatalabelsConfig(chartType: ChartKind) {
  const base = {
    color: '#ffffff' as const,
    font: { weight: 'bold' as const, size: 20 },
    formatter: (value: number) => (value === 0 ? '' : value.toLocaleString()),
  }
  if (chartType === 'bar' || chartType === 'horizontalBar') {
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

export function buildScalesConfig(chartType: ChartKind) {
  if (!(['bar', 'horizontalBar', 'line'] as ChartKind[]).includes(chartType))
    return undefined
  const axis = { ticks: { color: '#ffffff' }, grid: { color: '#ffffff22' } }
  return { x: axis, y: axis }
}
