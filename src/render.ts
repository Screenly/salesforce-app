import { Chart, registerables } from 'chart.js'
import type { DashboardResults } from './types'

Chart.register(...registerables)

const CHART_COLORS = [
  '#4F8EF7',
  '#AC1FFF',
  '#00C9A7',
  '#FFB347',
  '#FF6B6B',
  '#48DBFB',
  '#FF9FF3',
  '#54A0FF',
]

const SUPPORTED_TYPES = new Set(['bar', 'line', 'pie', 'donut', 'doughnut'])

function mapChartType(sfType: string): 'bar' | 'line' | 'pie' | 'doughnut' {
  const t = sfType.toLowerCase()
  if (t === 'donut') return 'doughnut'
  if (t === 'bar' || t === 'horizontalbar' || t === 'verticalbar') return 'bar'
  if (t === 'line') return 'line'
  if (t === 'pie') return 'pie'
  return 'bar'
}

function extractChartData(
  componentData: DashboardResults['componentData'][string]
): { labels: string[]; values: number[] } {
  const factMap = componentData.reportResult?.factMap ?? {}
  const labels: string[] = []
  const values: number[] = []

  for (const [key, entry] of Object.entries(factMap)) {
    if (key === 'T!T') continue
    const label = key.split('!')[0].replace(/_/g, ' ')
    const value = entry.aggregates?.[0]?.value ?? 0
    labels.push(label)
    values.push(value)
  }

  return { labels, values }
}

function createChartCanvas(id: string): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.id = `chart-${id}`
  return canvas
}

function renderChart(
  container: HTMLElement,
  componentId: string,
  componentData: DashboardResults['componentData'][string]
): void {
  const { labels, values } = extractChartData(componentData)

  if (labels.length === 0) {
    const empty = document.createElement('p')
    empty.className = 'empty-state'
    empty.textContent = 'No data available'
    container.appendChild(empty)
    return
  }

  const sfType = componentData.componentType ?? 'bar'

  if (!SUPPORTED_TYPES.has(sfType.toLowerCase())) {
    const unsupported = document.createElement('p')
    unsupported.className = 'empty-state'
    unsupported.textContent = `Chart type "${sfType}" is not supported yet`
    container.appendChild(unsupported)
    return
  }

  const chartType = mapChartType(sfType)
  const canvas = createChartCanvas(componentId)
  container.appendChild(canvas)

  new Chart(canvas, {
    type: chartType,
    data: {
      labels,
      datasets: [
        {
          label: componentData.title ?? '',
          data: values,
          backgroundColor: CHART_COLORS,
          borderColor:
            chartType === 'line' ? CHART_COLORS[0] : CHART_COLORS,
          borderWidth: chartType === 'line' ? 2 : 1,
          fill: chartType === 'line' ? false : undefined,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: '#ffffff' },
        },
      },
      scales:
        chartType === 'bar' || chartType === 'line'
          ? {
              x: { ticks: { color: '#ffffff' }, grid: { color: '#ffffff22' } },
              y: { ticks: { color: '#ffffff' }, grid: { color: '#ffffff22' } },
            }
          : undefined,
    },
  })
}

export function renderDashboard(results: DashboardResults): void {
  const dashboardTitle = document.getElementById('dashboard-title')
  const chartsGrid = document.getElementById('charts-grid')

  if (!chartsGrid) return

  if (dashboardTitle) {
    dashboardTitle.textContent = results.dashboardMetadata?.name ?? 'Dashboard'
  }

  chartsGrid.innerHTML = ''

  for (const [id, componentData] of Object.entries(results.componentData)) {
    const card = document.createElement('div')
    card.className = 'chart-card'

    const title = document.createElement('h3')
    title.className = 'chart-title'
    title.textContent = componentData.title ?? ''
    card.appendChild(title)

    const chartContainer = document.createElement('div')
    chartContainer.className = 'chart-container'
    card.appendChild(chartContainer)

    renderChart(chartContainer, id, componentData)
    chartsGrid.appendChild(card)
  }
}

export function showScreen(screenId: string): void {
  const screens = ['auth-screen', 'dashboard-screen', 'error-screen']
  screens.forEach((id) => {
    const el = document.getElementById(id)
    if (el) el.style.display = id === screenId ? 'flex' : 'none'
  })
}

export function showError(message: string): void {
  showScreen('error-screen')
  const el = document.getElementById('error-message')
  if (el) el.textContent = message
}
