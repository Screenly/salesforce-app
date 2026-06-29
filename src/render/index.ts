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
import {
  createChartCard,
  renderMetric,
  renderReportContent,
  setupReportGrid,
} from './report'

function renderComponent(
  container: HTMLElement,
  meta: DashboardMetadataComponent,
  item: ComponentDataItem,
  showLabels: boolean
): void {
  if (!item.reportResult || item.status.componentDataStatus === 'NO_DATA') {
    renderEmpty(container)
    return
  }

  const sfType = meta.properties.visualizationType ?? ''
  const sfTypeLower = sfType.toLowerCase()
  const title = meta.header ?? meta.title ?? ''

  if (sfTypeLower === 'gauge') {
    renderGauge(
      container,
      item.componentId,
      item.reportResult,
      meta,
      showLabels
    )
  } else if (sfTypeLower === 'metric') {
    renderMetric(container, item.reportResult, meta)
  } else if (CHART_TYPES.has(sfTypeLower)) {
    renderChart(
      container,
      item.componentId,
      item.reportResult,
      sfType,
      title,
      showLabels
    )
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

export function renderDashboard(
  results: DashboardResults,
  showLabels: boolean = false
): void {
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

    renderComponent(contentContainer, meta, item, showLabels)
    chartsGrid.appendChild(card)
  }
}

export function renderReport(
  contentId: string,
  reportResult: ReportResult,
  showLabels: boolean = false
): void {
  const { dashboardTitle, chartsGrid } = getDashboardElements()

  if (!chartsGrid) return

  const reportName = reportResult.reportMetadata?.name ?? `Report ${contentId}`

  setupReportGrid(chartsGrid, dashboardTitle, reportName)
  renderReportContent(
    chartsGrid,
    contentId,
    reportResult,
    reportName,
    showLabels
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
