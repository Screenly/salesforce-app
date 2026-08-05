import { Chart, registerables, type ChartConfiguration } from 'chart.js'
import type {
  DashboardMetadataComponent,
  GaugeVisualizationProperties,
  ReportResult,
} from '../types'
import { buildNeedlePlugin } from './gauge.lib'
import { mountEmpty } from './empty'

Chart.register(...registerables)

export function mountGauge(
  container: HTMLElement,
  componentId: string,
  reportResult: ReportResult,
  meta: DashboardMetadataComponent,
  showLabels: boolean = false
): void {
  const value = Number(
    reportResult.factMap?.['T!T']?.aggregates?.[0]?.value ?? 0
  )
  const vizProps = meta.properties.visualizationProperties as
    | GaugeVisualizationProperties
    | undefined
  const breaks = vizProps?.breakPoints?.[0]?.breaks ?? []

  if (breaks.length === 0) {
    mountEmpty(container)
    return
  }

  const min = breaks[0].lowerBound
  const max = breaks[breaks.length - 1].upperBound
  const pct = Math.max(0, Math.min(1, (value - min) / (max - min)))

  const canvas = document.createElement('canvas')
  canvas.id = `chart-${componentId}`
  container.appendChild(canvas)

  const needlePlugin = buildNeedlePlugin(
    componentId,
    min,
    max,
    breaks,
    pct,
    showLabels
  )

  const gaugeConfig: ChartConfiguration<'doughnut'> = {
    type: 'doughnut',
    data: {
      datasets: [
        {
          data: breaks.map((b) => b.upperBound - b.lowerBound),
          backgroundColor: breaks.map((b) => `#${b.color}`),
          borderWidth: 0,
        },
      ],
    },
    options: {
      circumference: 180,
      rotation: -90,
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false },
        datalabels: { display: false },
      },
    },
    plugins: [needlePlugin],
  }
  new Chart(canvas, gaugeConfig)
}
