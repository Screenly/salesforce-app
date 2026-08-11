import { createRef } from 'lit-html/directives/ref.js'
import type {
  ComponentDataItem,
  DashboardLayoutComponent,
  DashboardMetadataComponent,
  DashboardResults,
} from '../types'
import type { Card } from './card.types'
import { CHART_TYPES, mapChartType } from './chart.lib'
import { mountChart } from './chart'
import { mountEmpty } from './empty'
import { mountGauge } from './gauge'
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

function drawDashboardComponent(
  container: HTMLElement,
  meta: DashboardMetadataComponent,
  item: ComponentDataItem,
  showLabels: boolean
): void {
  if (!item.reportResult || item.status.componentDataStatus === 'NO_DATA') {
    mountEmpty(container)
    return
  }

  const visualizationType = (meta.properties.visualizationType ?? '')
    .trim()
    .toLowerCase()
  const title = meta.header ?? meta.title ?? ''

  if (visualizationType === 'gauge') {
    mountGauge(container, item.componentId, item.reportResult, meta, showLabels)
  } else if (visualizationType === 'metric') {
    mountMetric(container, item.reportResult)
  } else if (CHART_TYPES.has(visualizationType)) {
    mountChart(
      container,
      item.componentId,
      item.reportResult,
      mapChartType(visualizationType),
      title,
      showLabels
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
  showLabels: boolean
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
          title: meta.header ?? meta.title ?? '',
          contentRef: createRef<HTMLDivElement>(),
          gridStyle: gridPlacement(position),
          draw: (container: HTMLElement) =>
            drawDashboardComponent(container, meta, item, showLabels),
        },
      ]
    })
}
