import type { ReportResult } from '../types'
import { mountCards } from './card'
import { buildReportCards } from './report.lib'

export function renderReport(
  contentId: string,
  reportResult: ReportResult,
  showLabels: boolean = false
): void {
  const dashboardTitle = document.getElementById('dashboard-title')
  const chartsGrid = document.getElementById('charts-grid')
  if (!chartsGrid) return

  const reportName = reportResult.reportMetadata?.name ?? `Report ${contentId}`

  if (dashboardTitle) {
    dashboardTitle.textContent = reportName
  }
  chartsGrid.style.gridTemplateColumns = 'repeat(12, 1fr)'
  chartsGrid.style.gridAutoRows = 'minmax(6rem, auto)'

  const cards = buildReportCards(
    contentId,
    reportResult,
    reportName,
    showLabels
  )
  mountCards(chartsGrid, cards)
}
