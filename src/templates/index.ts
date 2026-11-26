import { renderDashboard } from './dashboard'
import { renderReport } from './report'
import type { RenderableSalesforceContent, RenderOptions } from './index.types'
import { applyThemeMode, resolveThemeMode } from './theme'

export type { RenderableSalesforceContent } from './index.types'

function showDashboardContainer(): void {
  const el = document.getElementById('dashboard-container')
  if (el) el.style.display = 'flex'
}

export function renderSalesforceContent(
  content: RenderableSalesforceContent
): void {
  const theme = resolveThemeMode(
    content.themeSetting,
    content.contentType === 'dashboard' ? content.results : null
  )
  applyThemeMode(theme)

  const options: RenderOptions = {
    showLabels: content.showLabels,
    theme,
    locale: content.locale,
    timeZone: content.timeZone,
  }

  if (content.contentType === 'dashboard') {
    renderDashboard(content.results, options)
  } else {
    renderReport(content.contentId, content.results, options)
  }

  showDashboardContainer()
}
