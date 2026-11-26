import type { DashboardResults } from '../types'
import { mountCards } from './card'
import { buildDashboardCards, countUsedColumns } from './dashboard.lib'
import type { RenderOptions } from './index.types'

export function renderDashboard(
  results: DashboardResults,
  options: RenderOptions
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

  const cards = buildDashboardCards(results, options)
  mountCards(chartsGrid, cards)
}
