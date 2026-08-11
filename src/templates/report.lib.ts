import { createRef } from 'lit-html/directives/ref.js'
import type { DashboardMetadataComponent, ReportResult } from '../types'
import type { Card } from './card.types'
import { mountChart } from './chart'
import { mapChartType } from './chart.lib'
import type { ChartKind } from './chart.types'
import { mountEmpty } from './empty'
import { mountStat } from './stat'
import { mountTable } from './table'

function hasReportDetailRows(reportResult: ReportResult): boolean {
  const rows = Object.values(reportResult.factMap ?? {}).flatMap(
    (entry) => entry.rows ?? []
  )
  const detailColumns = reportResult.reportMetadata?.detailColumns ?? []

  return (
    (reportResult.hasDetailRows ?? true) &&
    rows.length > 0 &&
    detailColumns.length > 0
  )
}

function hasGroupedReportData(reportResult: ReportResult): boolean {
  const groupings = reportResult.groupingsDown?.groupings ?? []
  const keys = Object.keys(reportResult.factMap ?? {})

  return groupings.length > 0 && keys.some((key) => key !== 'T!T')
}

export function getReportChartType(reportResult: ReportResult): string | null {
  const chartType = reportResult.reportMetadata?.chart?.chartType

  return chartType ? chartType : null
}

export function reportChartCard(
  contentId: string,
  reportResult: ReportResult,
  reportName: string,
  chartKind: ChartKind,
  showLabels: boolean
): Card | null {
  if (!hasGroupedReportData(reportResult)) return null

  return {
    title: reportName,
    cardClassName: 'report-chart-card',
    containerClassName: 'report-chart-container',
    gridStyle: 'grid-column: 1 / span 12',
    contentRef: createRef<HTMLDivElement>(),
    draw: (container) =>
      mountChart(
        container,
        contentId,
        reportResult,
        chartKind,
        reportName,
        showLabels
      ),
  }
}

export function reportTableCard(
  contentId: string,
  reportResult: ReportResult,
  reportName: string
): Card | null {
  if (!hasReportDetailRows(reportResult)) return null

  const meta: DashboardMetadataComponent = {
    id: contentId,
    header: reportName,
    title: reportName,
    reportId: contentId,
    type: 'Report',
    properties: {
      visualizationType: 'FlexTable',
      visualizationProperties: {},
      aggregates: [],
      groupings: null,
    },
  }

  return {
    title: `${reportName} Details`,
    cardClassName: 'report-table-card',
    gridStyle: 'grid-column: 1 / span 12',
    contentRef: createRef<HTMLDivElement>(),
    draw: (container) => mountTable(container, meta, reportResult),
  }
}

export function reportFallbackCard(
  reportName: string,
  aggregateLabel: string,
  aggregateValue: number | null
): Card {
  if (aggregateValue !== null) {
    return {
      title: reportName,
      cardClassName: 'report-stat-card',
      gridStyle: 'grid-column: 1 / span 12',
      contentRef: createRef<HTMLDivElement>(),
      draw: (container) =>
        mountStat(container, aggregateLabel, String(aggregateValue)),
    }
  }

  return {
    title: reportName,
    gridStyle: 'grid-column: 1 / span 12',
    contentRef: createRef<HTMLDivElement>(),
    draw: (container) => mountEmpty(container),
  }
}

export function buildReportCards(
  contentId: string,
  reportResult: ReportResult,
  reportName: string,
  showLabels: boolean
): Card[] {
  const cards = [
    reportChartCard(
      contentId,
      reportResult,
      reportName,
      mapChartType(getReportChartType(reportResult) ?? 'Column'),
      showLabels
    ),
    reportTableCard(contentId, reportResult, reportName),
  ].filter((card): card is Card => card !== null)

  if (cards.length > 0) return cards

  const aggregateLabel =
    reportResult.factMap?.['T!T']?.aggregates?.[0]?.label ??
    reportResult.reportMetadata?.aggregates?.[0] ??
    'Value'
  const aggregateValue =
    reportResult.factMap?.['T!T']?.aggregates?.[0]?.value ?? null

  return [reportFallbackCard(reportName, aggregateLabel, aggregateValue)]
}
