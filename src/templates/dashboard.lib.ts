import { createRef } from 'lit-html/directives/ref.js'
import type {
  ComponentDataItem,
  DashboardLayoutComponent,
  DashboardMetadataComponent,
  DashboardResults,
} from '../types'
import type { Card } from './card.types'
import { CHART_TYPES } from './chart.lib'
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
    return Math.max(...layoutComponents.map((c) => c.column + c.colspan))
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

  const sfType = meta.properties.visualizationType ?? ''
  const sfTypeLower = sfType.toLowerCase()
  const title = meta.header ?? meta.title ?? ''

  if (sfTypeLower === 'gauge') {
    mountGauge(container, item.componentId, item.reportResult, meta, showLabels)
  } else if (sfTypeLower === 'metric') {
    mountMetric(container, item.reportResult)
  } else if (CHART_TYPES.has(sfTypeLower)) {
    mountChart(
      container,
      item.componentId,
      item.reportResult,
      sfType,
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
  const metaMap = new Map(metaComponents.map((c) => [c.id, c]))

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
