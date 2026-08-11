import type { DashboardMetadataComponent, ReportResult } from '../types'
import type { TableColumn, TableRow } from './table.types'

export function extractTableColumns(
  meta: DashboardMetadataComponent,
  reportResult: ReportResult
): TableColumn[] {
  const vizProps = meta.properties.visualizationProperties as
    | { tableColumns?: { column: string }[] }
    | undefined
  const vizTableColumns = vizProps?.tableColumns ?? []

  const detailColumns =
    reportResult.reportMetadata?.detailColumns ??
    vizTableColumns.map((tableColumn) => tableColumn.column)

  const columnInfo = reportResult.reportExtendedMetadata?.detailColumnInfo ?? {}

  return detailColumns.map((key) => ({
    key,
    label: columnInfo[key]?.label ?? key,
  }))
}

export function extractTableRows(
  reportResult: ReportResult,
  columns: TableColumn[]
): TableRow[] {
  const factMap = reportResult.factMap ?? {}
  const rows = Object.values(factMap).flatMap((entry) => entry.rows ?? [])

  return rows.map((row) =>
    columns.map((_, index) => {
      const cell = row.dataCells[index]
      return cell ? String(cell.label ?? cell.value ?? '') : ''
    })
  )
}
