import type { DashboardResults } from '../types'
import { mountCards } from './card'
import { buildDashboardCards, countUsedColumns } from './dashboard.lib'

export function renderDashboard(
  results: DashboardResults,
  showLabels: boolean = false
): void {
  const dashboardTitle = document.getElementById('dashboard-title')
  const chartsGrid = document.getElementById('charts-grid')
  if (!chartsGrid) return

  if (dashboardTitle) {
    dashboardTitle.textContent = results.dashboardMetadata?.name ?? 'Dashboard'
  }

  const layout = results.dashboardMetadata.layout
  const layoutComponents = layout?.components ?? []
  chartsGrid.style.gridTemplateColumns = `repeat(${countUsedColumns(layout, layoutComponents)}, 1fr)`
  chartsGrid.style.gridAutoRows = `${layout?.rowHeight ?? 36}px`

  const cards = buildDashboardCards(results, showLabels)
  mountCards(chartsGrid, cards)
}
