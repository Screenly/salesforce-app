import { Chart, registerables } from 'chart.js'
import type {
  DashboardResults,
  DashboardMetadataComponent,
  ComponentDataItem,
  ReportResult,
} from './types'

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

const CHART_TYPES = new Set([
  'bar',
  'horizontalbar',
  'verticalbar',
  'line',
  'pie',
  'donut',
  'doughnut',
])

function mapChartType(sfType: string): 'bar' | 'line' | 'pie' | 'doughnut' {
  const t = sfType.toLowerCase()
  if (t === 'donut') return 'doughnut'
  if (t === 'bar' || t === 'horizontalbar' || t === 'verticalbar') return 'bar'
  if (t === 'line') return 'line'
  if (t === 'pie') return 'pie'
  return 'bar'
}

function extractChartData(reportResult: ReportResult): {
  labels: string[]
  values: number[]
} {
  const factMap = reportResult.factMap ?? {}
  const labels: string[] = []
  const values: number[] = []

  for (const [key, entry] of Object.entries(factMap)) {
    if (key === 'T!T') continue
    const label = key.split('!')[0].replace(/_/g, ' ')
    const value = entry.aggregates?.[0]?.value ?? 0
    labels.push(label)
    values.push(Number(value))
  }

  return { labels, values }
}

function renderChart(
  container: HTMLElement,
  componentId: string,
  reportResult: ReportResult,
  sfType: string,
  title: string
): void {
  const { labels, values } = extractChartData(reportResult)

  if (labels.length === 0) {
    renderEmpty(container)
    return
  }

  const chartType = mapChartType(sfType)
  const canvas = document.createElement('canvas')
  canvas.id = `chart-${componentId}`
  container.appendChild(canvas)

  new Chart(canvas, {
    type: chartType,
    data: {
      labels,
      datasets: [
        {
          label: title,
          data: values,
          backgroundColor: CHART_COLORS,
          borderColor: chartType === 'line' ? CHART_COLORS[0] : CHART_COLORS,
          borderWidth: chartType === 'line' ? 2 : 1,
          fill: chartType === 'line' ? false : undefined,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#ffffff' } },
      },
      scales:
        chartType === 'bar' || chartType === 'line'
          ? {
              x: {
                ticks: { color: '#ffffff' },
                grid: { color: '#ffffff22' },
              },
              y: {
                ticks: { color: '#ffffff' },
                grid: { color: '#ffffff22' },
              },
            }
          : undefined,
    },
  })
}

function renderTable(
  container: HTMLElement,
  meta: DashboardMetadataComponent,
  reportResult: ReportResult
): void {
  const columns = meta.properties.tableColumns ?? []
  const columnInfo = reportResult.reportExtendedMetadata?.detailColumnInfo ?? {}
  const factMap = reportResult.factMap ?? {}
  const rows = Object.values(factMap).flatMap((entry) => entry.rows ?? [])

  if (rows.length === 0) {
    renderEmpty(container)
    return
  }

  const table = document.createElement('table')
  table.className = 'data-table'

  const thead = document.createElement('thead')
  const headerRow = document.createElement('tr')
  for (const col of columns) {
    const th = document.createElement('th')
    th.textContent = columnInfo[col.column]?.label ?? col.column
    headerRow.appendChild(th)
  }
  thead.appendChild(headerRow)
  table.appendChild(thead)

  const tbody = document.createElement('tbody')
  for (const row of rows) {
    const tr = document.createElement('tr')
    for (const cell of row.dataCells) {
      const td = document.createElement('td')
      td.textContent = String(cell.label ?? cell.value ?? '')
      tr.appendChild(td)
    }
    tbody.appendChild(tr)
  }
  table.appendChild(tbody)
  container.appendChild(table)
}

function renderEmpty(container: HTMLElement): void {
  const p = document.createElement('p')
  p.className = 'empty-state'
  p.textContent = 'No data available'
  container.appendChild(p)
}

function renderComponent(
  container: HTMLElement,
  meta: DashboardMetadataComponent,
  item: ComponentDataItem
): void {
  if (!item.reportResult || item.status.componentDataStatus === 'NO_DATA') {
    renderEmpty(container)
    return
  }

  const sfType = meta.properties.visualizationType ?? ''
  const title = meta.header ?? meta.title ?? ''

  if (CHART_TYPES.has(sfType.toLowerCase())) {
    renderChart(container, item.componentId, item.reportResult, sfType, title)
  } else {
    renderTable(container, meta, item.reportResult)
  }
}

export function renderDashboard(results: DashboardResults): void {
  const dashboardTitle = document.getElementById('dashboard-title')
  const chartsGrid = document.getElementById('charts-grid')

  if (!chartsGrid) return

  if (dashboardTitle) {
    dashboardTitle.textContent = results.dashboardMetadata?.name ?? 'Dashboard'
  }

  chartsGrid.innerHTML = ''

  const metaMap = new Map(
    results.dashboardMetadata.components.map((c) => [c.id, c])
  )

  for (const item of results.componentData) {
    const meta = metaMap.get(item.componentId)
    if (!meta) continue

    const card = document.createElement('div')
    card.className = 'chart-card'

    const title = document.createElement('h3')
    title.className = 'chart-title'
    title.textContent = meta.header ?? meta.title ?? ''
    card.appendChild(title)

    const contentContainer = document.createElement('div')
    contentContainer.className = 'chart-container'
    card.appendChild(contentContainer)

    renderComponent(contentContainer, meta, item)
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
