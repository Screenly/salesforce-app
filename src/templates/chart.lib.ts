import { Chart } from 'chart.js'
import type { ReportResult } from '../types'
import type { ChartData, ChartKind } from './chart.types'
import type { ChartTheme } from './theme'

export function resetChartContainer(container: HTMLElement): void {
  const existingCanvas = container.querySelector('canvas')
  if (existingCanvas) Chart.getChart(existingCanvas)?.destroy()
  container.replaceChildren()
}

export const CHART_TYPES = new Set([
  'bar',
  'column',
  'line',
  'pie',
  'donut',
  'doughnut',
])

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

export function isCircularChart(chartKind: ChartKind): boolean {
  return chartKind === 'pie' || chartKind === 'doughnut'
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

  const grandTotal = Number(factMap['T!T']?.aggregates?.[0]?.value)
  const total = Number.isFinite(grandTotal)
    ? grandTotal
    : values.reduce((sum, value) => sum + value, 0)

  return { labels, values, total }
}

// Label of the grouping (e.g. "Status"), used as the legend or category axis title.
export function getGroupingLabel(
  reportResult: ReportResult,
  groupingName?: string
): string | undefined {
  const info = reportResult.reportExtendedMetadata?.groupingColumnInfo ?? {}
  const name =
    groupingName ??
    reportResult.reportMetadata?.groupingsDown?.[0]?.name ??
    Object.keys(info)[0]
  return name ? (info[name]?.label ?? undefined) : undefined
}

// Label of the measured value (e.g. "Record Count"), used as the value axis title.
export function getAggregateLabel(
  reportResult: ReportResult,
  aggregateName?: string
): string | undefined {
  const info = reportResult.reportExtendedMetadata?.aggregateColumnInfo ?? {}
  const name = aggregateName ?? reportResult.reportMetadata?.aggregates?.[0]
  return name ? (info[name]?.label ?? undefined) : undefined
}

export function buildDatalabelsConfig(chartType: ChartKind, theme: ChartTheme) {
  const base = {
    color: theme.dataLabel,
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
      backgroundColor: theme.dataLabelBackground,
      borderRadius: 3,
      padding: { top: 2, bottom: 2, left: 4, right: 4 },
    }
  }
  return {
    ...base,
    font: { weight: 'bold' as const, size: 16 },
    anchor: 'center' as const,
    align: 'center' as const,
  }
}

function withAlpha(hex: string, alpha: string): string {
  return /^#[0-9a-f]{6}$/i.test(hex) ? `${hex}${alpha}` : hex
}

// Circular charts colour each slice; bar, column and line charts are a single
// series in one colour, as on a native Salesforce dashboard.
export function buildDatasetStyle(chartKind: ChartKind, theme: ChartTheme) {
  const [primaryColor] = theme.palette

  if (isCircularChart(chartKind)) {
    return {
      backgroundColor: theme.palette,
      borderColor: theme.sliceBorder,
      borderWidth: 2,
      cutout: chartKind === 'doughnut' ? '60%' : undefined,
    }
  }
  if (chartKind === 'line') {
    return {
      borderColor: primaryColor,
      backgroundColor: withAlpha(primaryColor, '1f'),
      pointBackgroundColor: primaryColor,
      pointRadius: 4,
      borderWidth: 2,
      fill: 'origin' as const,
    }
  }
  return { backgroundColor: primaryColor, borderWidth: 0 }
}

export type LegendPosition = 'right' | 'bottom' | 'none'

export function parseLegendPosition(value: unknown): LegendPosition {
  return value === 'bottom' || value === 'none' ? value : 'right'
}

// Only circular charts get a legend, placed where the dashboard puts it
// (right by default), titled with the grouping, with round markers. Bar,
// column and line charts are a single series, which needs no legend.
export function buildLegendConfig(
  chartKind: ChartKind,
  theme: ChartTheme,
  groupingLabel?: string,
  position: LegendPosition = 'right'
) {
  return {
    display: isCircularChart(chartKind) && position !== 'none',
    position: position === 'bottom' ? ('bottom' as const) : ('right' as const),
    title: {
      display: Boolean(groupingLabel),
      text: groupingLabel ?? '',
      color: theme.mutedText,
    },
    labels: {
      color: theme.text,
      usePointStyle: true,
      pointStyle: 'circle' as const,
    },
  }
}

export type AxisTitles = {
  value?: string
  category?: string
}

export function buildScalesConfig(
  chartType: ChartKind,
  theme: ChartTheme,
  titles: AxisTitles = {}
) {
  if (!(['bar', 'horizontalBar', 'line'] as ChartKind[]).includes(chartType))
    return undefined

  const axisTitle = (text?: string) => ({
    display: Boolean(text),
    text: text ?? '',
    color: theme.mutedText,
  })
  const valueAxis = {
    beginAtZero: true,
    // Headroom so value labels above the tallest point are not clipped.
    grace: '8%',
    ticks: { color: theme.mutedText },
    grid: { color: theme.grid },
    border: { display: false },
    title: axisTitle(titles.value),
  }
  const categoryAxis = {
    ticks: { color: theme.text },
    grid: { display: false },
    title: axisTitle(titles.category),
  }

  // Salesforce draws the value axis of horizontal bar charts along the top.
  if (chartType === 'horizontalBar') {
    return { x: { ...valueAxis, position: 'top' as const }, y: categoryAxis }
  }
  return { x: categoryAxis, y: valueAxis }
}
