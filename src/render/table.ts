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

  const wrapper = document.createElement('div')
  wrapper.className = 'table-scroll w-full h-full overflow-auto'

  const table = document.createElement('table')
  table.className = 'data-table w-full border-collapse text-[#dadadb]'

  const thead = document.createElement('thead')
  const headerRow = document.createElement('tr')
  for (const col of detailColumns) {
    const th = document.createElement('th')
    th.className =
      'px-4 py-3 text-left text-xs font-semibold tracking-[0.08em] uppercase text-[#9d9d9f] whitespace-nowrap bg-[linear-gradient(#2a2a2a,#2a2a2a)] [background-size:100%_0.0625rem] bg-bottom bg-no-repeat'
    th.textContent = columnInfo[col]?.label ?? col
    headerRow.appendChild(th)
  }
  thead.appendChild(headerRow)
  table.appendChild(thead)

  const tbody = document.createElement('tbody')
  for (const row of rows) {
    const tr = document.createElement('tr')
    tr.className = 'group'
    for (let i = 0; i < detailColumns.length; i++) {
      const td = document.createElement('td')
      td.className =
        'px-4 py-3 text-[0.9rem] text-left whitespace-nowrap min-w-32 bg-[linear-gradient(#2a2a2a,#2a2a2a)] [background-size:100%_0.0625rem] bg-bottom bg-no-repeat group-last:bg-none'
      const cell = row.dataCells[i]
      td.textContent = cell ? String(cell.label ?? cell.value ?? '') : ''
      tr.appendChild(td)
    }
    tbody.appendChild(tr)
  }
  table.appendChild(tbody)
  wrapper.appendChild(table)
  container.appendChild(wrapper)
}
