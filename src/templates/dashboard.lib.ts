import { createRef } from 'lit-html/directives/ref.js'
import type {
  ComponentDataItem,
  DashboardLayoutComponent,
  DashboardMetadataComponent,
  DashboardResults,
} from '../types'
import type { Card } from './card.types'
import {
  CHART_TYPES,
  getAggregateLabel,
  getGroupingLabel,
  mapChartType,
  parseLegendPosition,
} from './chart.lib'
import { mountChart } from './chart'
import { mountEmpty } from './empty'
import { formatAsOf } from './format'
import { mountGauge } from './gauge'
import type { RenderOptions } from './index.types'
import { mountMetric } from './metric'
import { mountTable } from './table'

export function countUsedColumns(
  layout: DashboardResults['dashboardMetadata']['layout'],
  layoutComponents: DashboardLayoutComponent[]
): number {
  if (layoutComponents.length > 0) {
    return Math.max(
      ...layoutComponents.map(
        (component) => component.column + component.colspan
      )
    )
  }
  return layout?.numColumns ?? 12
}

function visualizationProperties(
  meta: DashboardMetadataComponent
): Record<string, unknown> {
  return (meta.properties.visualizationProperties ?? {}) as Record<
    string,
    unknown
  >
}

function drawDashboardComponent(
  container: HTMLElement,
  meta: DashboardMetadataComponent,
  item: ComponentDataItem,
  options: RenderOptions
): void {
  if (!item.reportResult || item.status.componentDataStatus === 'NO_DATA') {
    mountEmpty(container)
    return
  }

  const visualizationType = (meta.properties.visualizationType ?? '')
    .trim()
    .toLowerCase()
  const title = meta.header ?? meta.title ?? ''
  const vizProps = visualizationProperties(meta)
  // Values shown on the Salesforce dashboard are shown here too.
  const showLabels = options.showLabels || vizProps.showValues === true

  if (visualizationType === 'gauge') {
    mountGauge(
      container,
      item.componentId,
      item.reportResult,
      meta,
      showLabels,
      options.theme
    )
  } else if (visualizationType === 'metric') {
    mountMetric(container, item.reportResult)
  } else if (CHART_TYPES.has(visualizationType)) {
    mountChart(
      container,
      item.componentId,
      item.reportResult,
      mapChartType(visualizationType),
      {
        title,
        theme: options.theme,
        showLabels,
        showTotal: vizProps.showTotal !== false,
        legendPosition: parseLegendPosition(vizProps.legendPosition),
        valueLabel: getAggregateLabel(
          item.reportResult,
          meta.properties.aggregates?.[0]?.name
        ),
        groupingLabel: getGroupingLabel(
          item.reportResult,
          meta.properties.groupings?.[0]?.name
        ),
      }
    )
  } else {
    mountTable(container, meta, item.reportResult)
  }
}

function gridPlacement(position: DashboardLayoutComponent | undefined): string {
  if (!position) return 'grid-column: auto; grid-row: auto'

  const gridColumn = `${position.column + 1} / span ${position.colspan}`
  const gridRow = `${position.row + 1} / span ${position.rowspan}`
  return `grid-column: ${gridColumn}; grid-row: ${gridRow}`
}

export function buildDashboardCards(
  results: DashboardResults,
  options: RenderOptions
): Card[] {
  const layoutComponents = results.dashboardMetadata.layout?.components ?? []
  const metaComponents = results.dashboardMetadata.components
  const metaMap = new Map(
    metaComponents.map((component) => [component.id, component])
  )

  return results.componentData
    .filter((item): item is ComponentDataItem => item !== null)
    .flatMap((item) => {
      const meta = metaMap.get(item.componentId)
      if (!meta) return []

      const metaIndex = metaComponents.indexOf(meta)
      const position = layoutComponents[metaIndex]

      return [
        {
          // Salesforce shows the header as the card title and the title
          // underneath it as a subtitle.
          title: meta.header ?? meta.title ?? '',
          subtitle: meta.header ? (meta.title ?? undefined) : undefined,
          footer: meta.footer ?? undefined,
          asOf: formatAsOf(
            item.status.refreshDate,
            options.locale,
            options.timeZone
          ),
          contentRef: createRef<HTMLDivElement>(),
          gridStyle: gridPlacement(position),
          draw: (container: HTMLElement) =>
            drawDashboardComponent(container, meta, item, options),
        },
      ]
    })
}
