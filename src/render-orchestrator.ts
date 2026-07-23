import { reportError } from '@screenly/edge-apps/utils'
import {
  getDashboardResults,
  getReportResults,
  triggerDashboardRefresh,
  AuthError,
} from './api'
import { BackendServerError } from './credentials'
import type { RefreshToken, RuntimeState } from './credentials'
import { renderDashboard, renderReport, showScreen, showError } from './render'
import type {
  DashboardResults,
  ReportResult,
  SalesforceContentType,
} from './types'

export type RenderOutcome = 'shown' | 'skipped'

export function shouldSkipBackendError(
  error: unknown,
  displayErrors: boolean
): boolean {
  return error instanceof BackendServerError && !displayErrors
}

export function shouldSignalReady(
  outcome: RenderOutcome,
  hasRenderedOnce: boolean
): boolean {
  return outcome === 'shown' && !hasRenderedOnce
}

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

function handleError(message: string, displayErrors: boolean): void {
  if (displayErrors) throw new Error(message)
  showError(message)
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

function showContentFailure(ctx: RenderContext, err: unknown): RenderOutcome {
  handleError(toErrorMessage(err, 'Failed to load content.'), ctx.displayErrors)
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
    renderContentResults(ctx.contentId, content, ctx.showLabels)
    return { ok: true, outcome: 'shown' }
  } catch (err) {
    return { ok: false, error: err }
  }
}

function requireCredentials(ctx: RenderContext): CredentialsResult {
  const { accessToken, instanceUrl, credentialError } = ctx.getRuntimeState()

  if (accessToken && instanceUrl) {
    return { ok: true, accessToken, instanceUrl }
  }

  if (shouldSkipBackendError(credentialError, ctx.displayErrors)) {
    return { ok: false, outcome: 'skipped' }
  }

  handleError(credentialError!.message, ctx.displayErrors)
  return { ok: false, outcome: 'shown' }
}

function requireRefreshedCredentials(ctx: RenderContext): CredentialsResult {
  const { accessToken, instanceUrl } = ctx.getRuntimeState()

  if (!accessToken) {
    handleError('No access token.', ctx.displayErrors)
    return { ok: false, outcome: 'shown' }
  }
  if (!instanceUrl) {
    handleError('No instance URL available.', ctx.displayErrors)
    return { ok: false, outcome: 'shown' }
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
    if (shouldSkipBackendError(err, ctx.displayErrors)) {
      return 'skipped'
    }

    handleError(
      toErrorMessage(err, 'Session expired. Please re-authenticate.'),
      ctx.displayErrors
    )
    return 'shown'
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
    return showContentFailure(ctx, attempt.error)
  }

  if (!isRetry) return render(ctx, true)

  return showContentFailure(ctx, attempt.error)
}
