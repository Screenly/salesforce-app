import type { DashboardResults, ReportResult } from '../types'
import type { ThemeMode, ThemeSetting } from './theme'

export type RenderOptions = {
  showLabels: boolean
  theme: ThemeMode
  locale: string
  timeZone: string
}

export type RenderableSalesforceContent =
  | {
      contentType: 'dashboard'
      contentId: string
      results: DashboardResults
      showLabels: boolean
      themeSetting: ThemeSetting
      locale: string
      timeZone: string
    }
  | {
      contentType: 'report'
      contentId: string
      results: ReportResult
      showLabels: boolean
      themeSetting: ThemeSetting
      locale: string
      timeZone: string
    }
