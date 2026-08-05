import { html, render as renderTemplate, type TemplateResult } from 'lit-html'
import type { ReportResult } from '../types'
import { emptyTemplate } from './empty'

function metricTemplate(reportResult: ReportResult): TemplateResult {
  const entry = reportResult.factMap?.['T!T']

  if (!entry) {
    return emptyTemplate()
  }

  const value = entry.aggregates?.[0]?.value ?? 0

  return html`<div class="metric-value">${Number(value).toLocaleString()}</div>`
}

export function mountMetric(
  container: HTMLElement,
  reportResult: ReportResult
): void {
  renderTemplate(metricTemplate(reportResult), container)
}
