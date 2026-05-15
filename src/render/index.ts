import type {
  DashboardResults,
  DashboardMetadataComponent,
  ComponentDataItem,
  ReportResult,
} from '../types'
import { CHART_TYPES, renderChart } from './chart'
import { renderGauge } from './gauge'
import { renderTable } from './table'
import { renderEmpty } from './utils'

function renderComponent(
  container: HTMLElement,
  meta: DashboardMetadataComponent,
  item: ComponentDataItem
): void {
  if (!item.reportResult || item.status.componentDataStatus === 'NO_DATA') {
    renderEmpty(container)
    return
  }

  const sfType = meta.properties.visualizationType ?? ''
  const sfTypeLower = sfType.toLowerCase()
  const title = meta.header ?? meta.title ?? ''

  if (sfTypeLower === 'gauge') {
    renderGauge(container, item.componentId, item.reportResult, meta)
  } else if (CHART_TYPES.has(sfTypeLower)) {
    renderChart(container, item.componentId, item.reportResult, sfType, title)
  } else {
    renderTable(container, meta, item.reportResult)
  }
}

function getDashboardElements(): {
  dashboardTitle: HTMLElement | null
  chartsGrid: HTMLElement | null
} {
  return {
    dashboardTitle: document.getElementById('dashboard-title'),
    chartsGrid: document.getElementById('charts-grid'),
  }
}

function createChartCard(titleText: string): {
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

function appendReportCard(
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

function setupReportGrid(
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
  reportChartType: string
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
    reportChartType,
    reportName
  )
  return true
}

function renderReportFallbackChartCard(
  chartsGrid: HTMLElement,
  contentId: string,
  reportResult: ReportResult,
  reportName: string
): boolean {
  if (!hasGroupedReportData(reportResult)) {
    return false
  }

  const chartContainer = appendReportCard(chartsGrid, reportName, {
    cardClassName: 'report-chart-card',
    containerClassName: 'report-chart-container',
  })

  renderChart(chartContainer, contentId, reportResult, 'Column', reportName)
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

  const meta = {
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

export function renderDashboard(results: DashboardResults): void {
  const { dashboardTitle, chartsGrid } = getDashboardElements()

  if (!chartsGrid) return

  if (dashboardTitle) {
    dashboardTitle.textContent = results.dashboardMetadata?.name ?? 'Dashboard'
  }

  chartsGrid.innerHTML = ''

  const layout = results.dashboardMetadata.layout
  const rowHeight = layout?.rowHeight ?? 36
  const layoutComponents = layout?.components ?? []

  const usedColumns =
    layoutComponents.length > 0
      ? Math.max(...layoutComponents.map((c) => c.column + c.colspan))
      : (layout?.numColumns ?? 12)

  chartsGrid.style.gridTemplateColumns = `repeat(${usedColumns}, 1fr)`
  chartsGrid.style.gridAutoRows = `${rowHeight}px`

  const metaComponents = results.dashboardMetadata.components
  const metaMap = new Map(metaComponents.map((c) => [c.id, c]))

  for (const item of results.componentData.filter(
    (x): x is ComponentDataItem => x !== null
  )) {
    const meta = metaMap.get(item.componentId)
    if (!meta) continue

    const metaIndex = metaComponents.indexOf(meta)
    const pos = layoutComponents[metaIndex]

    const { card, contentContainer } = createChartCard(
      meta.header ?? meta.title ?? ''
    )

    if (pos) {
      card.style.gridColumn = `${pos.column + 1} / span ${pos.colspan}`
      card.style.gridRow = `${pos.row + 1} / span ${pos.rowspan}`
    }

    renderComponent(contentContainer, meta, item)
    chartsGrid.appendChild(card)
  }
}

export function renderReport(
  contentId: string,
  reportResult: ReportResult
): void {
  const { dashboardTitle, chartsGrid } = getDashboardElements()

  if (!chartsGrid) return

  const reportName = reportResult.reportMetadata?.name ?? `Report ${contentId}`
  const aggregateLabel =
    reportResult.factMap?.['T!T']?.aggregates?.[0]?.label ??
    reportResult.reportMetadata?.aggregates?.[0] ??
    'Value'
  const aggregateValue =
    reportResult.factMap?.['T!T']?.aggregates?.[0]?.value ?? null
  const reportChartType = getReportChartType(reportResult)

  setupReportGrid(chartsGrid, dashboardTitle, reportName)

  const renderedChart = reportChartType
    ? renderReportChartCard(
        chartsGrid,
        contentId,
        reportResult,
        reportName,
        reportChartType
      )
    : renderReportFallbackChartCard(
        chartsGrid,
        contentId,
        reportResult,
        reportName
      )
  const renderedTable = renderReportTableCard(
    chartsGrid,
    contentId,
    reportResult,
    reportName
  )

  if (renderedChart || renderedTable) {
    return
  }

  renderReportFallbackCard(
    chartsGrid,
    reportName,
    aggregateLabel,
    aggregateValue
  )
}

export function showScreen(screenId: string): void {
  const screens = ['dashboard-screen', 'error-screen']
  screens.forEach((id) => {
    const el = document.getElementById(id)
    if (el) el.style.display = id === screenId ? 'flex' : 'none'
  })
}

export function showError(message: string): void {
  showScreen('error-screen')
  const el = document.getElementById('error-message')
  if (el) el.textContent = message
}
