import { renderDashboard } from './dashboard'
import { renderReport } from './report'
import type { RenderableContent } from './index.types'

export type { RenderableContent } from './index.types'

function showDashboardContainer(): void {
  const el = document.getElementById('dashboard-container')
  if (el) el.style.display = 'flex'
}

export function renderContent(content: RenderableContent): void {
  if (content.contentType === 'dashboard') {
    renderDashboard(content.results, content.showLabels)
  } else {
    renderReport(content.contentId, content.results, content.showLabels)
  }

  showDashboardContainer()
}
