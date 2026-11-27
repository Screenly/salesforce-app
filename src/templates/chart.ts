import { Chart, registerables, type ArcElement, type Plugin } from 'chart.js'
import ChartDataLabels from 'chartjs-plugin-datalabels'
import type { ReportResult } from '../types'
import {
  buildDatalabelsConfig,
  buildDatasetStyle,
  buildLegendConfig,
  buildScalesConfig,
  extractChartData,
  isCircularChart,
  type LegendPosition,
  resetChartContainer,
} from './chart.lib'
import type { ChartKind } from './chart.types'
import { mountEmpty } from './empty'
import { CHART_THEMES, type ThemeMode } from './theme'

Chart.register(...registerables, ChartDataLabels)

Chart.defaults.animation = false
Chart.defaults.font.size = 14

function useDocumentFont(): void {
  const family = getComputedStyle(document.body).fontFamily
  if (family) Chart.defaults.font.family = family
}

export type ChartOptions = {
  title: string
  theme: ThemeMode
  showLabels: boolean
  // Draw the grand total in the middle of a donut, as Salesforce does.
  showTotal?: boolean
  // Measured value, e.g. "Record Count".
  valueLabel?: string
  // Grouping, e.g. "Status".
  groupingLabel?: string
  legendPosition?: LegendPosition
}

function centerTotalPlugin(total: number, color: string): Plugin<'doughnut'> {
  return {
    id: 'centerTotal',
    afterDraw(chart) {
      const arc = chart.getDatasetMeta(0).data[0] as ArcElement | undefined
      if (!arc || arc.innerRadius <= 0) return
      const { ctx } = chart
      const fontSize = Math.max(14, Math.round(arc.innerRadius * 0.42))
      ctx.save()
      ctx.font = `${fontSize}px ${Chart.defaults.font.family}`
      ctx.fillStyle = color
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(total.toLocaleString(), arc.x, arc.y)
      ctx.restore()
    },
  }
}

export function mountChart(
  container: HTMLElement,
  componentId: string,
  reportResult: ReportResult,
  chartKind: ChartKind,
  options: ChartOptions
): void {
  const { labels, values, total } = extractChartData(reportResult)

  if (labels.length === 0) {
    mountEmpty(container)
    return
  }

  const theme = CHART_THEMES[options.theme]
  const circular = isCircularChart(chartKind)
  const isHorizontalBar = chartKind === 'horizontalBar'

  resetChartContainer(container)
  useDocumentFont()

  const canvas = document.createElement('canvas')
  canvas.id = `chart-${componentId}`
  container.appendChild(canvas)

  const plugins =
    chartKind === 'doughnut' && options.showTotal
      ? [centerTotalPlugin(total, theme.text) as Plugin]
      : []

  new Chart(canvas, {
    type: isHorizontalBar ? 'bar' : chartKind,
    data: {
      labels,
      datasets: [
        {
          label: options.valueLabel ?? options.title,
          data: values,
          ...buildDatasetStyle(chartKind, theme),
        },
      ],
    },
    options: {
      indexAxis: isHorizontalBar ? 'y' : 'x',
      responsive: true,
      maintainAspectRatio: false,
      // Room for value labels above and beside the outermost points.
      layout: {
        padding: chartKind === 'line' ? { top: 24, right: 32, left: 16 } : 0,
      },
      plugins: {
        title: {
          display: circular && Boolean(options.valueLabel),
          text: options.valueLabel ?? '',
          color: theme.text,
          font: { size: 14, weight: 'normal' },
        },
        legend: buildLegendConfig(
          chartKind,
          theme,
          options.groupingLabel,
          options.legendPosition
        ),
        datalabels: options.showLabels
          ? buildDatalabelsConfig(chartKind, theme)
          : { display: false },
      },
      scales: buildScalesConfig(chartKind, theme, {
        value: options.valueLabel,
        category: options.groupingLabel,
      }),
    },
    plugins,
  })
}
