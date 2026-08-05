import type {
  DashboardResults,
  DashboardMetadataComponent,
  DashboardLayoutComponent,
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

function countUsedColumns(
  layout: DashboardResults['dashboardMetadata']['layout'],
  layoutComponents: DashboardLayoutComponent[]
): number {
  if (layoutComponents.length > 0) {
    return Math.max(...layoutComponents.map((c) => c.column + c.colspan))
  }
  return layout?.numColumns ?? 12
}

function initializeDashboardGrid(
  chartsGrid: HTMLElement,
  dashboardTitle: HTMLElement | null,
  results: DashboardResults
): void {
  if (dashboardTitle) {
    dashboardTitle.textContent = results.dashboardMetadata?.name ?? 'Dashboard'
  }

  chartsGrid.innerHTML = ''

  const layout = results.dashboardMetadata.layout
  const layoutComponents = layout?.components ?? []

  chartsGrid.style.gridTemplateColumns = `repeat(${countUsedColumns(layout, layoutComponents)}, 1fr)`
  chartsGrid.style.gridAutoRows = `${layout?.rowHeight ?? 36}px`
}

function renderDashboardComponents(
  chartsGrid: HTMLElement,
  results: DashboardResults,
  showLabels: boolean
): void {
  const layoutComponents = results.dashboardMetadata.layout?.components ?? []
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

function renderDashboard(
  results: DashboardResults,
  showLabels: boolean = false
): void {
  const { dashboardTitle, chartsGrid } = getDashboardElements()

  if (!chartsGrid) return

  initializeDashboardGrid(chartsGrid, dashboardTitle, results)
  renderDashboardComponents(chartsGrid, results, showLabels)
}

function renderReport(
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

function showDashboardContainer(): void {
  const el = document.getElementById('dashboard-container')
  if (el) el.style.display = 'flex'
}

export type ContentToRender =
  | {
      contentType: 'dashboard'
      contentId: string
      results: DashboardResults
      showLabels: boolean
    }
  | {
      contentType: 'report'
      contentId: string
      results: ReportResult
      showLabels: boolean
    }

export function showContent(content: ContentToRender): void {
  if (content.contentType === 'dashboard') {
    renderDashboard(content.results, content.showLabels)
  } else {
    renderReport(content.contentId, content.results, content.showLabels)
  }

  showDashboardContainer()
}
