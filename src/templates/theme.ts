import type { DashboardResults } from '../types'

export type ThemeSetting = 'salesforce' | 'light' | 'dark'
export type ThemeMode = 'light' | 'dark'

export type ChartTheme = {
  palette: string[]
  text: string
  mutedText: string
  grid: string
  sliceBorder: string
  dataLabel: string
  dataLabelBackground?: string
  gaugeNeedle: string
}

// Default Salesforce Lightning dashboard chart palette.
const SALESFORCE_PALETTE = [
  '#3296ED',
  '#77B9F2',
  '#9D53F2',
  '#C398F5',
  '#26ABA4',
  '#4ED4CD',
  '#E3A51B',
  '#F4C55D',
  '#E1621C',
  '#F49756',
  '#D62E55',
  '#F27D9A',
]

export const CHART_THEMES: Record<ThemeMode, ChartTheme> = {
  light: {
    palette: SALESFORCE_PALETTE,
    text: '#181818',
    mutedText: '#444444',
    grid: '#e5e5e5',
    sliceBorder: '#ffffff',
    dataLabel: '#181818',
    gaugeNeedle: '#181818',
  },
  dark: {
    palette: SALESFORCE_PALETTE,
    text: '#f2f2f3',
    mutedText: '#c9c9cb',
    grid: '#ffffff22',
    sliceBorder: '#1a1a1a',
    dataLabel: '#ffffff',
    dataLabelBackground: 'rgba(0,0,0,0.55)',
    gaugeNeedle: '#ffffff',
  },
}

export function resolveThemeSetting(value: unknown): ThemeSetting {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return normalized === 'light' || normalized === 'dark'
    ? normalized
    : 'salesforce'
}

// Salesforce stores the theme chosen in the dashboard's properties. Read it
// defensively since the field name has varied between API versions.
export function salesforceThemeMode(
  results: DashboardResults | null | undefined
): ThemeMode {
  const metadata = (results?.dashboardMetadata ?? {}) as Record<string, unknown>
  const value = metadata.dashboardTheme ?? metadata.chartTheme
  return typeof value === 'string' && value.toLowerCase() === 'dark'
    ? 'dark'
    : 'light'
}

export function resolveThemeMode(
  setting: ThemeSetting,
  results?: DashboardResults | null
): ThemeMode {
  return setting === 'salesforce' ? salesforceThemeMode(results) : setting
}

export function applyThemeMode(theme: ThemeMode): void {
  document.documentElement.dataset.theme = theme
}
