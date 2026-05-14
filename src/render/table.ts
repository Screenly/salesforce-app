import type { DashboardMetadataComponent, ReportResult } from '../types'
import { renderEmpty } from './utils'

export function renderTable(
  container: HTMLElement,
  meta: DashboardMetadataComponent,
  reportResult: ReportResult
): void {
  const vizProps = meta.properties.visualizationProperties as
    | { tableColumns?: { column: string }[] }
    | undefined
  const vizTableColumns = vizProps?.tableColumns ?? []

  const detailColumns =
    reportResult.reportMetadata?.detailColumns ??
    vizTableColumns.map((c) => c.column)

  const columnInfo = reportResult.reportExtendedMetadata?.detailColumnInfo ?? {}
  const factMap = reportResult.factMap ?? {}
  const rows = Object.values(factMap).flatMap((entry) => entry.rows ?? [])

  if (rows.length === 0 || detailColumns.length === 0) {
    renderEmpty(container)
    return
  }

  const table = document.createElement('table')
  table.className = 'data-table'

  const thead = document.createElement('thead')
  const headerRow = document.createElement('tr')
  for (const col of detailColumns) {
    const th = document.createElement('th')
    th.textContent = columnInfo[col]?.label ?? col
    headerRow.appendChild(th)
  }
  thead.appendChild(headerRow)
  table.appendChild(thead)

  const tbody = document.createElement('tbody')
  for (const row of rows) {
    const tr = document.createElement('tr')
    for (let i = 0; i < detailColumns.length; i++) {
      const td = document.createElement('td')
      const cell = row.dataCells[i]
      td.textContent = cell ? String(cell.label ?? cell.value ?? '') : ''
      tr.appendChild(td)
    }
    tbody.appendChild(tr)
  }
  table.appendChild(tbody)
  container.appendChild(table)
}
