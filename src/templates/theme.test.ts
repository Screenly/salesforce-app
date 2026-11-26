import '@screenly/edge-apps/test'
import { describe, expect, test } from 'bun:test'
import type { DashboardResults } from '../types'
import {
  applyThemeMode,
  resolveThemeMode,
  resolveThemeSetting,
  salesforceThemeMode,
} from './theme'

function dashboardWith(metadata: Record<string, unknown>): DashboardResults {
  return {
    dashboardMetadata: {
      name: 'Dashboard',
      id: '01Z',
      components: [],
      ...metadata,
    },
    componentData: [],
  } as DashboardResults
}

describe('resolveThemeSetting', () => {
  test('accepts light and dark in any case', () => {
    expect(resolveThemeSetting('light')).toBe('light')
    expect(resolveThemeSetting(' DARK ')).toBe('dark')
  })

  test('falls back to salesforce for anything else', () => {
    expect(resolveThemeSetting('salesforce')).toBe('salesforce')
    expect(resolveThemeSetting('')).toBe('salesforce')
    expect(resolveThemeSetting('purple')).toBe('salesforce')
    expect(resolveThemeSetting(undefined)).toBe('salesforce')
  })
})

describe('salesforceThemeMode', () => {
  test('reads dashboardTheme', () => {
    expect(salesforceThemeMode(dashboardWith({ dashboardTheme: 'DARK' }))).toBe(
      'dark'
    )
  })

  test('falls back to chartTheme', () => {
    expect(salesforceThemeMode(dashboardWith({ chartTheme: 'dark' }))).toBe(
      'dark'
    )
  })

  test('prefers dashboardTheme over chartTheme', () => {
    expect(
      salesforceThemeMode(
        dashboardWith({ dashboardTheme: 'light', chartTheme: 'dark' })
      )
    ).toBe('light')
  })

  test('defaults to light when no theme is set or there is no dashboard', () => {
    expect(salesforceThemeMode(dashboardWith({}))).toBe('light')
    expect(salesforceThemeMode(null)).toBe('light')
  })
})

describe('resolveThemeMode', () => {
  const darkDashboard = dashboardWith({ dashboardTheme: 'dark' })

  test('follows the dashboard for the salesforce setting', () => {
    expect(resolveThemeMode('salesforce', darkDashboard)).toBe('dark')
    expect(resolveThemeMode('salesforce', null)).toBe('light')
  })

  test('light and dark override the dashboard', () => {
    expect(resolveThemeMode('light', darkDashboard)).toBe('light')
    expect(resolveThemeMode('dark', dashboardWith({}))).toBe('dark')
  })
})

describe('applyThemeMode', () => {
  test('sets data-theme on the document element', () => {
    applyThemeMode('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
    applyThemeMode('light')
    expect(document.documentElement.dataset.theme).toBe('light')
  })
})
