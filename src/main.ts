import './css/style.css'
import '@screenly/edge-apps/components'
import {
  getSettingWithDefault,
  initTokenRefreshLoop,
  setupErrorHandling,
  signalReady,
} from '@screenly/edge-apps'
import { reportError, setupSentry } from '@screenly/edge-apps/utils'
import { getDashboardResults, getReportResults, AuthError } from './api'
import { inferSalesforceContentType } from './content'
import { createCredentialManager } from './credentials'
import type { RefreshToken, RuntimeState } from './credentials'
import { renderDashboard, renderReport, showScreen, showError } from './render'
import { shouldSkipBackendError, shouldSignalReady } from './render-decisions'
import type { RenderOutcome } from './render-decisions'
import type { SalesforceContentType } from './types'

setupSentry('salesforce', {
  salesforce: { content_id: screenly.settings.content_id },
})

type RenderContext = {
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

async function renderContent(
  contentType: SalesforceContentType,
  instanceUrl: string,
  accessToken: string,
  contentId: string,
  showLabels: boolean
): Promise<RenderOutcome> {
  if (contentType === 'dashboard') {
    const results = await getDashboardResults(
      instanceUrl,
      accessToken,
      contentId
    )
    renderDashboard(results, showLabels)
  } else {
    const results = await getReportResults(instanceUrl, accessToken, contentId)
    renderReport(contentId, results, showLabels)
  }

  showScreen('dashboard-screen')
  return 'shown'
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

async function attemptRenderContent(
  ctx: RenderContext,
  accessToken: string,
  instanceUrl: string
): Promise<RenderAttempt> {
  try {
    const outcome = await renderContent(
      ctx.contentType,
      instanceUrl,
      accessToken,
      ctx.contentId,
      ctx.showLabels
    )
    return { ok: true, outcome }
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

async function retryAfterRefresh(ctx: RenderContext): Promise<RenderOutcome> {
  const refreshOutcome = await refreshCredentials(ctx)
  if (refreshOutcome) return refreshOutcome

  const credentials = requireRefreshedCredentials(ctx)
  if (!credentials.ok) return credentials.outcome

  const attempt = await attemptRenderContent(
    ctx,
    credentials.accessToken,
    credentials.instanceUrl
  )
  if (attempt.ok) return attempt.outcome

  if (!(attempt.error instanceof AuthError)) {
    reportContentRenderError(ctx, attempt.error)
  }
  handleError(
    toErrorMessage(attempt.error, 'Failed to load content.'),
    ctx.displayErrors
  )
  return 'shown'
}

async function fetchAndRender(ctx: RenderContext): Promise<RenderOutcome> {
  const credentials = requireCredentials(ctx)
  if (!credentials.ok) return credentials.outcome

  const attempt = await attemptRenderContent(
    ctx,
    credentials.accessToken,
    credentials.instanceUrl
  )
  if (attempt.ok) return attempt.outcome

  if (!(attempt.error instanceof AuthError)) {
    reportContentRenderError(ctx, attempt.error)
    handleError(
      toErrorMessage(attempt.error, 'Failed to load content.'),
      ctx.displayErrors
    )
    return 'shown'
  }

  return retryAfterRefresh(ctx)
}

function createRenderer(ctx: RenderContext): {
  render: () => Promise<RenderOutcome>
} {
  return { render: () => fetchAndRender(ctx) }
}

document.addEventListener('DOMContentLoaded', async () => {
  setupErrorHandling()

  const contentId = getSettingWithDefault<string>('content_id', '')
  const displayErrors =
    getSettingWithDefault<string>('display_errors', 'false') === 'true'
  const refreshInterval = getSettingWithDefault<number>('refresh_interval', 300)
  const showLabels =
    getSettingWithDefault<string>('show_labels', 'false') === 'true'

  if (!contentId) {
    showError('Please configure the Salesforce Content ID in settings.')
    signalReady()
    return
  }

  let contentType: SalesforceContentType
  try {
    contentType = inferSalesforceContentType(contentId)
  } catch (err) {
    showError(err instanceof Error ? err.message : 'Unsupported content ID.')
    signalReady()
    return
  }

  const { refreshToken, getRuntimeState } = createCredentialManager(
    contentId,
    contentType
  )

  try {
    await refreshToken()
  } catch (err) {
    console.warn('Failed to fetch initial credentials:', err)
  }

  initTokenRefreshLoop(refreshToken)

  const { render } = createRenderer({
    contentId,
    contentType,
    getRuntimeState,
    refreshToken,
    displayErrors,
    showLabels,
  })

  let hasRenderedOnce = false
  const run = async () => {
    const outcome = await render()
    if (shouldSignalReady(outcome, hasRenderedOnce)) signalReady()
    hasRenderedOnce = hasRenderedOnce || outcome === 'shown'
  }

  await run()

  setInterval(async () => {
    try {
      await run()
    } catch (err) {
      console.error('Refresh failed:', err)
    }
  }, refreshInterval * 1000)
})
