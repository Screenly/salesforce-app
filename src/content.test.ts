import { describe, expect, test } from 'bun:test'
import { inferSalesforceContentType } from './content'

describe('inferSalesforceContentType', () => {
  test('returns dashboard for 01Z prefix', () => {
    expect(inferSalesforceContentType('01Zg5000002iDwTEAU')).toBe('dashboard')
  })

  test('returns report for 00O prefix', () => {
    expect(inferSalesforceContentType('00Og5000004NOlhEAG')).toBe('report')
  })

  test('is case-insensitive', () => {
    expect(inferSalesforceContentType('01zg5000002iDwTEAU')).toBe('dashboard')
  })

  test('throws for unsupported prefix', () => {
    expect(() => inferSalesforceContentType('ABC123')).toThrow()
  })
})
