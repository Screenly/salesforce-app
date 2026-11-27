import '@screenly/edge-apps/test'
import { describe, expect, test } from 'bun:test'
import type { ReportResult } from '../types'
import {
  buildLegendConfig,
  extractChartData,
  getAggregateLabel,
  getGroupingLabel,
  parseLegendPosition,
} from './chart.lib'
import { CHART_THEMES } from './theme'

const REPORT: ReportResult = {
  factMap: {
    '0!T': { aggregates: [{ label: '3', value: 3 }] },
    '1!T': { aggregates: [{ label: '5', value: 5 }] },
    'T!T': { aggregates: [{ label: '8', value: 8 }] },
  },
  groupingsDown: {
    groupings: [
      { key: '0', label: 'New' },
      { key: '1', label: 'Closed' },
    ],
  },
  reportExtendedMetadata: {
    aggregateColumnInfo: {
      RowCount: { label: 'Record Count', dataType: 'int' },
      's!AMOUNT': { label: 'Sum of Amount', dataType: 'currency' },
    },
    groupingColumnInfo: {
      STATUS: { label: 'Status' },
      OWNER: { label: 'Owner' },
    },
  },
  reportMetadata: {
    aggregates: ['RowCount'],
    groupingsDown: [{ name: 'STATUS' }],
  },
}

describe('extractChartData', () => {
  test('uses the grand total from T!T', () => {
    expect(extractChartData(REPORT)).toEqual({
      labels: ['New', 'Closed'],
      values: [3, 5],
      total: 8,
    })
  })

  test('sums the values when there is no grand total', () => {
    const { 'T!T': _total, ...factMap } = REPORT.factMap
    expect(extractChartData({ ...REPORT, factMap }).total).toBe(8)
  })
})

describe('getGroupingLabel', () => {
  test('prefers the grouping named by the dashboard component', () => {
    expect(getGroupingLabel(REPORT, 'OWNER')).toBe('Owner')
  })

  test('falls back to the report grouping', () => {
    expect(getGroupingLabel(REPORT)).toBe('Status')
  })

  test('is undefined without grouping metadata', () => {
    expect(getGroupingLabel({ factMap: {} })).toBeUndefined()
  })
})

describe('getAggregateLabel', () => {
  test('prefers the aggregate named by the dashboard component', () => {
    expect(getAggregateLabel(REPORT, 's!AMOUNT')).toBe('Sum of Amount')
  })

  test('falls back to the first report aggregate', () => {
    expect(getAggregateLabel(REPORT)).toBe('Record Count')
  })

  test('is undefined without aggregate metadata', () => {
    expect(getAggregateLabel({ factMap: {} })).toBeUndefined()
  })
})

describe('legend position', () => {
  const theme = CHART_THEMES.light

  test('parses the dashboard legendPosition, defaulting to right', () => {
    expect(parseLegendPosition('bottom')).toBe('bottom')
    expect(parseLegendPosition('none')).toBe('none')
    expect(parseLegendPosition('right')).toBe('right')
    expect(parseLegendPosition(undefined)).toBe('right')
  })

  test('places the donut legend where the dashboard puts it', () => {
    expect(
      buildLegendConfig('doughnut', theme, 'Status', 'bottom')
    ).toMatchObject({ display: true, position: 'bottom' })
    expect(buildLegendConfig('doughnut', theme, 'Status', 'none').display).toBe(
      false
    )
  })

  test('never shows a legend for single-series charts', () => {
    expect(buildLegendConfig('bar', theme, 'Status', 'right').display).toBe(
      false
    )
  })
})
