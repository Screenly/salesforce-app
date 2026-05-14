import type {
  DashboardResults,
  DashboardMetadataComponent,
  ComponentDataItem,
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

export function renderDashboard(results: DashboardResults): void {
  const dashboardTitle = document.getElementById('dashboard-title')
  const chartsGrid = document.getElementById('charts-grid')

  if (!chartsGrid) return

  if (dashboardTitle) {
    dashboardTitle.textContent = results.dashboardMetadata?.name ?? 'Dashboard'
  }

  chartsGrid.innerHTML = ''

  const metaMap = new Map(
    results.dashboardMetadata.components.map((c) => [c.id, c])
  )

  for (const item of results.componentData.filter(
    (x): x is ComponentDataItem => x !== null
  )) {
    const meta = metaMap.get(item.componentId)
    if (!meta) continue

    const card = document.createElement('div')
    card.className = 'chart-card'

    const title = document.createElement('h3')
    title.className = 'chart-title'
    title.textContent = meta.header ?? meta.title ?? ''
    card.appendChild(title)

    const contentContainer = document.createElement('div')
    contentContainer.className = 'chart-container'
    card.appendChild(contentContainer)

    renderComponent(contentContainer, meta, item)
    chartsGrid.appendChild(card)
  }
}

export function showScreen(screenId: string): void {
  const screens = ['auth-screen', 'dashboard-screen', 'error-screen']
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
