import '@screenly/edge-apps/test'
import { describe, expect, test } from 'bun:test'
import type {
  ComponentDataItem,
  DashboardMetadataComponent,
  DashboardResults,
} from '../types'
import { buildDashboardCards } from './dashboard.lib'
import type { RenderOptions } from './index.types'

const OPTIONS: RenderOptions = {
  showLabels: false,
  theme: 'light',
  locale: 'en-US',
  timeZone: 'UTC',
}

function component(
  overrides: Partial<DashboardMetadataComponent>
): DashboardMetadataComponent {
  return {
    id: 'comp-1',
    header: 'Open Cases',
    title: 'Support',
    footer: null,
    reportId: '00O000000000001',
    type: 'Report',
    properties: {
      visualizationType: 'Donut',
      aggregates: [{ name: 'RowCount' }],
      groupings: [{ name: 'STATUS' }],
    },
    ...overrides,
  }
}

function data(status: Partial<ComponentDataItem['status']>): ComponentDataItem {
  return {
    componentId: 'comp-1',
    reportResult: null,
    status: {
      componentDataStatus: 'NO_DATA',
      refreshStatus: 'IDLE',
      ...status,
    },
  }
}

function dashboard(
  meta: DashboardMetadataComponent,
  item: ComponentDataItem
): DashboardResults {
  return {
    dashboardMetadata: { name: 'Dashboard', id: '01Z', components: [meta] },
    componentData: [item],
  }
}

describe('buildDashboardCards', () => {
  test('uses the header as the title and the title as the subtitle', () => {
    const [card] = buildDashboardCards(
      dashboard(component({}), data({})),
      OPTIONS
    )
    expect(card.title).toBe('Open Cases')
    expect(card.subtitle).toBe('Support')
  })

  test('uses the title without a subtitle when there is no header', () => {
    const [card] = buildDashboardCards(
      dashboard(component({ header: null }), data({})),
      OPTIONS
    )
    expect(card.title).toBe('Support')
    expect(card.subtitle).toBeUndefined()
  })

  test('maps the footer and formats refreshDate as the as-of time', () => {
    const [card] = buildDashboardCards(
      dashboard(
        component({ footer: 'Max 100 rows' }),
        data({ refreshDate: '2025-02-19T21:05:00.000Z' })
      ),
      OPTIONS
    )
    expect(card.footer).toBe('Max 100 rows')
    expect(card.asOf).toMatch(/^Feb 19, 2025\b.*\b09:05\sPM$/)
  })

  test('leaves footer and as-of empty when Salesforce omits them', () => {
    const meta = component({})
    delete meta.footer
    const [card] = buildDashboardCards(dashboard(meta, data({})), OPTIONS)
    expect(card.footer).toBeUndefined()
    expect(card.asOf).toBeUndefined()
  })
})
