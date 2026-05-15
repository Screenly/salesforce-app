import { describe, expect, test } from 'bun:test'
import { inferSalesforceContentType } from './content'

describe('inferSalesforceContentType', () => {
  test('detects dashboard IDs from the 01Z prefix', () => {
    expect(inferSalesforceContentType('01Z000000000001AAA')).toBe('dashboard')
  })

  test('detects report IDs from the 00O prefix', () => {
    expect(inferSalesforceContentType('00O000000000001AAA')).toBe('report')
  })

  test('normalizes whitespace and casing', () => {
    expect(inferSalesforceContentType('  00o000000000001aaa  ')).toBe('report')
  })

  test('throws for unsupported prefixes', () => {
    expect(() => inferSalesforceContentType('001000000000001AAA')).toThrow(
      'Unsupported Salesforce content ID prefix'
    )
  })
})
