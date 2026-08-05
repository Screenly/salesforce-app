import { html, render as renderTemplate, type TemplateResult } from 'lit-html'
import type { DashboardMetadataComponent, ReportResult } from '../types'
import { emptyTemplate } from './empty'
import { extractTableColumns, extractTableRows } from './table.lib'
import type { TableColumn, TableRow } from './table.types'

function tableTemplate(
  columns: TableColumn[],
  rows: TableRow[]
): TemplateResult {
  return html`
    <div class="table-scroll">
      <table class="data-table">
        <thead>
          <tr>
            ${columns.map((column) => html`<th>${column.label}</th>`)}
          </tr>
        </thead>
        <tbody>
          ${rows.map(
            (row) => html`
              <tr class="group">
                ${row.map((cell) => html`<td>${cell}</td>`)}
              </tr>
            `
          )}
        </tbody>
      </table>
    </div>
  `
}

export function mountTable(
  container: HTMLElement,
  meta: DashboardMetadataComponent,
  reportResult: ReportResult
): void {
  const columns = extractTableColumns(meta, reportResult)
  const rows = extractTableRows(reportResult, columns)

  if (rows.length === 0 || columns.length === 0) {
    renderTemplate(emptyTemplate(), container)
    return
  }

  renderTemplate(tableTemplate(columns, rows), container)
}
