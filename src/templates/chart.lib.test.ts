import '@screenly/edge-apps/test'
import { describe, test, expect } from 'bun:test'
import { extractChartData } from './chart.lib'
import type { ReportResult } from '../types'

const report = (factMap: Record<string, unknown>) =>
  ({
    factMap,
    groupingsDown: {
      groupings: [
        { key: '0', label: 'Open' },
        { key: '1', label: 'Closed' },
      ],
    },
  }) as unknown as ReportResult

describe('extractChartData total', () => {
  test('uses the grand total from T!T', () => {
    const data = extractChartData(
      report({
        '0!T': { aggregates: [{ value: 3 }] },
        '1!T': { aggregates: [{ value: 4 }] },
        'T!T': { aggregates: [{ value: 9 }] },
      })
    )
    expect(data.values).toEqual([3, 4])
    expect(data.total).toBe(9)
  })

  test('falls back to the sum of values when T!T is missing', () => {
    const data = extractChartData(
      report({
        '0!T': { aggregates: [{ value: 3 }] },
        '1!T': { aggregates: [{ value: 4 }] },
      })
    )
    expect(data.total).toBe(7)
  })
})
