import type { DashboardMetadataComponent, ReportResult } from '../types'
import { renderChart } from './chart'
import { renderTable } from './table'
import { renderEmpty } from './utils'

export function createChartCard(titleText: string): {
  card: HTMLDivElement
  contentContainer: HTMLDivElement
} {
  const card = document.createElement('div')
  card.className = 'chart-card'

  const title = document.createElement('h3')
  title.className = 'chart-title'
  title.textContent = titleText
  card.appendChild(title)

  const contentContainer = document.createElement('div')
  contentContainer.className = 'chart-container'
  card.appendChild(contentContainer)

  return { card, contentContainer }
}

export function appendReportCard(
  chartsGrid: HTMLElement,
  titleText: string,
  options?: {
    cardClassName?: string
    containerClassName?: string
  }
): HTMLDivElement {
  const { card, contentContainer } = createChartCard(titleText)
  card.style.gridColumn = '1 / span 12'

  if (options?.cardClassName) {
    card.classList.add(options.cardClassName)
  }

  if (options?.containerClassName) {
    contentContainer.classList.add(options.containerClassName)
  }

  chartsGrid.appendChild(card)
  return contentContainer
}

function renderStat(
  container: HTMLElement,
  label: string,
  value: string
): void {
  const stat = document.createElement('div')
  stat.className = 'report-stat'

  const statValue = document.createElement('div')
  statValue.className = 'report-stat-value'
  statValue.textContent = value

  const statLabel = document.createElement('div')
  statLabel.className = 'report-stat-label'
  statLabel.textContent = label

  stat.appendChild(statValue)
  stat.appendChild(statLabel)
  container.appendChild(stat)
}

export function renderMetric(
  container: HTMLElement,
  reportResult: ReportResult,
  _meta: DashboardMetadataComponent
): void {
  const entry = reportResult.factMap?.['T!T']

  if (!entry) {
    renderEmpty(container)
    return
  }

  const value = entry.aggregates?.[0]?.value ?? 0

  const el = document.createElement('div')
  el.className = 'metric-value'
  el.textContent = Number(value).toLocaleString()
  container.appendChild(el)
}

function hasReportDetailRows(reportResult: ReportResult): boolean {
  const rows = Object.values(reportResult.factMap ?? {}).flatMap(
    (entry) => entry.rows ?? []
  )
  const detailColumns = reportResult.reportMetadata?.detailColumns ?? []

  return (
    (reportResult.hasDetailRows ?? true) &&
    rows.length > 0 &&
    detailColumns.length > 0
  )
}

function hasGroupedReportData(reportResult: ReportResult): boolean {
  const groupings = reportResult.groupingsDown?.groupings ?? []
  const keys = Object.keys(reportResult.factMap ?? {})

  return groupings.length > 0 && keys.some((key) => key !== 'T!T')
}

function getReportChartType(reportResult: ReportResult): string | null {
  const chartType = reportResult.reportMetadata?.chart?.chartType

  return chartType ? chartType : null
}

export function setupReportGrid(
  chartsGrid: HTMLElement,
  dashboardTitle: HTMLElement | null,
  reportName: string
): void {
  if (dashboardTitle) {
    dashboardTitle.textContent = reportName
  }

  chartsGrid.innerHTML = ''
  chartsGrid.style.gridTemplateColumns = 'repeat(12, 1fr)'
  chartsGrid.style.gridAutoRows = 'minmax(6rem, auto)'
}

function renderReportChartCard(
  chartsGrid: HTMLElement,
  contentId: string,
  reportResult: ReportResult,
  reportName: string,
  chartType: string = 'Column',
  showLabels: boolean = false
): boolean {
  if (!hasGroupedReportData(reportResult)) {
    return false
  }

  const chartContainer = appendReportCard(chartsGrid, reportName, {
    cardClassName: 'report-chart-card',
    containerClassName: 'report-chart-container',
  })

  renderChart(
    chartContainer,
    contentId,
    reportResult,
    chartType,
    reportName,
    showLabels
  )
  return true
}

function renderReportTableCard(
  chartsGrid: HTMLElement,
  contentId: string,
  reportResult: ReportResult,
  reportName: string
): boolean {
  if (!hasReportDetailRows(reportResult)) {
    return false
  }

  const meta: DashboardMetadataComponent = {
    id: contentId,
    header: reportName,
    title: reportName,
    reportId: contentId,
    type: 'Report',
    properties: {
      visualizationType: 'FlexTable',
      visualizationProperties: {},
      aggregates: [],
      groupings: null,
    },
  }

  const tableContainer = appendReportCard(chartsGrid, `${reportName} Details`, {
    cardClassName: 'report-table-card',
  })

  renderTable(tableContainer, meta, reportResult)
  return true
}

function renderReportFallbackCard(
  chartsGrid: HTMLElement,
  reportName: string,
  aggregateLabel: string,
  aggregateValue: number | null
): void {
  if (aggregateValue !== null) {
    const statContainer = appendReportCard(chartsGrid, reportName, {
      cardClassName: 'report-stat-card',
    })

    renderStat(statContainer, aggregateLabel, String(aggregateValue))
    return
  }

  const emptyContainer = appendReportCard(chartsGrid, reportName)
  renderEmpty(emptyContainer)
}

export function renderReportContent(
  chartsGrid: HTMLElement,
  contentId: string,
  reportResult: ReportResult,
  reportName: string,
  showLabels: boolean
): void {
  const renderedChart = renderReportChartCard(
    chartsGrid,
    contentId,
    reportResult,
    reportName,
    getReportChartType(reportResult) ?? 'Column',
    showLabels
  )
  const renderedTable = renderReportTableCard(
    chartsGrid,
    contentId,
    reportResult,
    reportName
  )

  if (renderedChart || renderedTable) return

  const aggregateLabel =
    reportResult.factMap?.['T!T']?.aggregates?.[0]?.label ??
    reportResult.reportMetadata?.aggregates?.[0] ??
    'Value'
  const aggregateValue =
    reportResult.factMap?.['T!T']?.aggregates?.[0]?.value ?? null

  renderReportFallbackCard(
    chartsGrid,
    reportName,
    aggregateLabel,
    aggregateValue
  )
}
