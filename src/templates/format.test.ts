import '@screenly/edge-apps/test'
import { describe, expect, test } from 'bun:test'
import { formatAsOf } from './format'

// The separator between date and time ("," or "at") varies between ICU
// versions, so match the date and time parts rather than the exact string.
describe('formatAsOf', () => {
  test('includes the day, month, year and time of the refresh', () => {
    const formatted = formatAsOf('2025-02-19T21:05:00.000Z', 'en-US', 'UTC')
    expect(formatted).toMatch(/^Feb 19, 2025\b.*\b09:05\sPM$/)
  })

  test('formats in the given locale and time zone', () => {
    const formatted = formatAsOf(
      '2025-02-19T21:05:00.000Z',
      'en-GB',
      'Europe/Oslo'
    )
    expect(formatted).toMatch(/^19 Feb 2025\b.*\b22:05$/)
  })

  test('returns undefined for a missing or invalid date', () => {
    expect(formatAsOf(undefined, 'en-US', 'UTC')).toBeUndefined()
    expect(formatAsOf(null, 'en-US', 'UTC')).toBeUndefined()
    expect(formatAsOf('not a date', 'en-US', 'UTC')).toBeUndefined()
  })
})
