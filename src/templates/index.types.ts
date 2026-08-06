import type { DashboardResults, ReportResult } from '../types'

export type RenderableContent =
  | {
      contentType: 'dashboard'
      contentId: string
      results: DashboardResults
      showLabels: boolean
    }
  | {
      contentType: 'report'
      contentId: string
      results: ReportResult
      showLabels: boolean
    }
