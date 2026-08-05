import { reportError } from '@screenly/edge-apps/utils'
import {
  getDashboardResults,
  getReportResults,
  triggerDashboardRefresh,
} from './api'
import { readCachedContent, writeCachedContent } from './cache'
import type { RuntimeState } from './credentials'
import { renderDashboard, renderReport, showDashboardContainer } from './render'
import type {
  DashboardResults,
  ReportResult,
  SalesforceContentType,
} from './types'

export type RenderOutcome = 'shown' | 'skipped'

export type RenderContext = {
  contentId: string
  contentType: SalesforceContentType
  getRuntimeState: () => RuntimeState
  displayErrors: boolean
  showLabels: boolean
}

type CredentialsResult =
  | { ok: true; accessToken: string; instanceUrl: string }
  | { ok: false; outcome: RenderOutcome }

type RenderAttempt =
  | { ok: true; outcome: RenderOutcome }
  | { ok: false; error: unknown }

type ContentResults =
  | { contentType: 'dashboard'; results: DashboardResults }
  | { contentType: 'report'; results: ReportResult }

async function fetchContentResults(
  contentType: SalesforceContentType,
  instanceUrl: string,
  accessToken: string,
  contentId: string
): Promise<ContentResults> {
  if (contentType === 'dashboard') {
    await triggerDashboardRefresh(instanceUrl, accessToken, contentId)
    const results = await getDashboardResults(
      instanceUrl,
      accessToken,
      contentId
    )
    return { contentType, results }
  }

  const results = await getReportResults(instanceUrl, accessToken, contentId)
  return { contentType, results }
}

function renderContentResults(
  contentId: string,
  content: ContentResults,
  showLabels: boolean
): void {
  if (content.contentType === 'dashboard') {
    renderDashboard(content.results, showLabels)
    return
  }

  renderReport(contentId, content.results, showLabels)
}

function toErrorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback
}

async function attemptRenderContent(
  context: RenderContext,
  accessToken: string,
  instanceUrl: string
): Promise<RenderAttempt> {
  try {
    const content = await fetchContentResults(
      context.contentType,
      instanceUrl,
      accessToken,
      context.contentId
    )
    writeCachedContent(context.contentType, context.contentId, content.results)
    renderContentResults(context.contentId, content, context.showLabels)
    return { ok: true, outcome: 'shown' }
  } catch (err) {
    return { ok: false, error: err }
  }
}

function buildContentResults(
  contentType: SalesforceContentType,
  results: DashboardResults | ReportResult
): ContentResults {
  return contentType === 'dashboard'
    ? { contentType: 'dashboard', results: results as DashboardResults }
    : { contentType: 'report', results: results as ReportResult }
}

function renderCachedContent(context: RenderContext): void {
  const cached = readCachedContent(context.contentType, context.contentId)

  if (!cached) {
    throw new Error('No cached content found.')
  }

  renderContentResults(
    context.contentId,
    buildContentResults(context.contentType, cached),
    context.showLabels
  )

  showDashboardContainer()
}

function handleContentFailure(context: RenderContext, err: unknown): void {
  if (context.displayErrors) {
    throw new Error(toErrorMessage(err, 'Failed to load content.'))
  }
  renderCachedContent(context)
}

function requireCredentials(context: RenderContext): CredentialsResult {
  const { accessToken, instanceUrl, credentialError } =
    context.getRuntimeState()

  if (accessToken && instanceUrl) {
    return { ok: true, accessToken, instanceUrl }
  }

  if (!context.displayErrors) {
    return { ok: false, outcome: 'skipped' }
  }

  throw new Error(credentialError!.message)
}

export async function render(context: RenderContext): Promise<void> {
  const credentials = requireCredentials(context)
  if (!credentials.ok) return

  const attempt = await attemptRenderContent(
    context,
    credentials.accessToken,
    credentials.instanceUrl
  )

  if (attempt.ok) {
    showDashboardContainer()
    return
  }

  reportError(attempt.error, {
    source: 'salesforce-content',
    contentId: context.contentId,
    contentType: context.contentType,
  })
  handleContentFailure(context, attempt.error)
}
