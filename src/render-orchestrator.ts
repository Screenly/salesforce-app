import { reportError } from '@screenly/edge-apps/utils'
import {
  getDashboardResults,
  getReportResults,
  triggerDashboardRefresh,
  AuthError,
} from './api'
import { readCachedContent, writeCachedContent } from './cache'
import type { RefreshToken, RuntimeState } from './credentials'
import { shouldSkipBackendError } from './errors'
import { renderDashboard, renderReport, showScreen } from './render'
import type {
  DashboardResults,
  ReportResult,
  SalesforceContentType,
} from './types'

export type RenderOutcome = 'shown' | 'skipped'

export { shouldSkipBackendError } from './errors'

export type RenderContext = {
  contentId: string
  contentType: SalesforceContentType
  getRuntimeState: () => RuntimeState
  refreshToken: RefreshToken
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

function reportContentRenderError(ctx: RenderContext, err: unknown): void {
  reportError(err, {
    source: 'salesforce-content',
    contentId: ctx.contentId,
    contentType: ctx.contentType,
  })
}

function showContentFailure(err: unknown): RenderOutcome {
  throw new Error(toErrorMessage(err, 'Failed to load content.'))
  return 'shown'
}

async function attemptRenderContent(
  ctx: RenderContext,
  accessToken: string,
  instanceUrl: string
): Promise<RenderAttempt> {
  try {
    const content = await fetchContentResults(
      ctx.contentType,
      instanceUrl,
      accessToken,
      ctx.contentId
    )
    writeCachedContent(ctx.contentType, ctx.contentId, content.results)
    renderContentResults(ctx.contentId, content, ctx.showLabels)
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

function renderCachedContent(ctx: RenderContext): RenderOutcome | null {
  const cached = readCachedContent(ctx.contentType, ctx.contentId)
  if (!cached) return null

  try {
    renderContentResults(
      ctx.contentId,
      buildContentResults(ctx.contentType, cached),
      ctx.showLabels
    )
  } catch {
    return null
  }

  showScreen('dashboard-screen')
  return 'shown'
}

function handleContentFailure(ctx: RenderContext, err: unknown): RenderOutcome {
  if (!shouldSkipBackendError(err, ctx.displayErrors)) {
    return showContentFailure(err)
  }
  return renderCachedContent(ctx) ?? 'skipped'
}

function requireCredentials(ctx: RenderContext): CredentialsResult {
  const { accessToken, instanceUrl, credentialError } = ctx.getRuntimeState()

  if (accessToken && instanceUrl) {
    return { ok: true, accessToken, instanceUrl }
  }

  if (shouldSkipBackendError(credentialError, ctx.displayErrors)) {
    return { ok: false, outcome: 'skipped' }
  }

  throw new Error(credentialError!.message)
}

function requireRefreshedCredentials(ctx: RenderContext): CredentialsResult {
  const { accessToken, instanceUrl } = ctx.getRuntimeState()

  if (!accessToken) {
    throw new Error('No access token.')
  }
  if (!instanceUrl) {
    throw new Error('No instance URL available.')
  }

  return { ok: true, accessToken, instanceUrl }
}

async function refreshCredentials(
  ctx: RenderContext
): Promise<RenderOutcome | null> {
  try {
    await ctx.refreshToken()
    return null
  } catch (err) {
    if (!shouldSkipBackendError(err, ctx.displayErrors)) {
      throw new Error(
        toErrorMessage(err, 'Session expired. Please re-authenticate.'),
        { cause: err }
      )
    }

    // A skippable error may still have recovered credentials from cache
    // (see credentials.ts's applyFailedRefresh), in which case the retry
    // should proceed to render instead of aborting.
    const { accessToken, instanceUrl } = ctx.getRuntimeState()
    return accessToken && instanceUrl ? null : 'skipped'
  }
}

async function resolveCredentials(
  ctx: RenderContext,
  isRetry: boolean
): Promise<CredentialsResult> {
  if (!isRetry) return requireCredentials(ctx)

  const refreshOutcome = await refreshCredentials(ctx)
  if (refreshOutcome) return { ok: false, outcome: refreshOutcome }

  return requireRefreshedCredentials(ctx)
}

export async function render(
  ctx: RenderContext,
  isRetry = false
): Promise<RenderOutcome> {
  const credentials = await resolveCredentials(ctx, isRetry)
  if (!credentials.ok) return credentials.outcome

  const attempt = await attemptRenderContent(
    ctx,
    credentials.accessToken,
    credentials.instanceUrl
  )
  if (attempt.ok) {
    showScreen('dashboard-screen')
    return attempt.outcome
  }

  if (!(attempt.error instanceof AuthError)) {
    reportContentRenderError(ctx, attempt.error)
    return handleContentFailure(ctx, attempt.error)
  }

  if (!isRetry) return render(ctx, true)

  return handleContentFailure(ctx, attempt.error)
}
