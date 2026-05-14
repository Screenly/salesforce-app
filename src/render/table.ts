import type { DashboardMetadataComponent, ReportResult } from '../types'
import { renderEmpty } from './utils'

export function renderTable(
  container: HTMLElement,
  meta: DashboardMetadataComponent,
  reportResult: ReportResult
): void {
  const columns = meta.properties.tableColumns ?? []
  const columnInfo = reportResult.reportExtendedMetadata?.detailColumnInfo ?? {}
  const factMap = reportResult.factMap ?? {}
  const rows = Object.values(factMap).flatMap((entry) => entry.rows ?? [])

  if (rows.length === 0) {
    renderEmpty(container)
    return
  }

  const table = document.createElement('table')
  table.className = 'data-table'

  const thead = document.createElement('thead')
  const headerRow = document.createElement('tr')
  for (const col of columns) {
    const th = document.createElement('th')
    th.textContent = columnInfo[col.column]?.label ?? col.column
    headerRow.appendChild(th)
  }
  thead.appendChild(headerRow)
  table.appendChild(thead)

  const tbody = document.createElement('tbody')
  for (const row of rows) {
    const tr = document.createElement('tr')
    for (const cell of row.dataCells) {
      const td = document.createElement('td')
      td.textContent = String(cell.label ?? cell.value ?? '')
      tr.appendChild(td)
    }
    tbody.appendChild(tr)
  }
  table.appendChild(tbody)
  container.appendChild(table)
}
