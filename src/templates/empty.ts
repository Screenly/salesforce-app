import { html, render, type TemplateResult } from 'lit-html'

export function emptyTemplate(): TemplateResult {
  return html`<p class="empty-state">No data available</p>`
}

export function mountEmpty(container: HTMLElement): void {
  render(emptyTemplate(), container)
}
