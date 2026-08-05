import { html, render as renderTemplate, type TemplateResult } from 'lit-html'

export function statTemplate(label: string, value: string): TemplateResult {
  return html`
    <div class="report-stat">
      <div class="report-stat-value">${value}</div>
      <div class="report-stat-label">${label}</div>
    </div>
  `
}

export function mountStat(
  container: HTMLElement,
  label: string,
  value: string
): void {
  renderTemplate(statTemplate(label, value), container)
}
