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

async function retryAfterRefresh(
  contentId: string,
  contentType: SalesforceContentType,
  getRuntimeState: () => RuntimeState,
  refreshToken: RefreshToken,
  displayErrors: boolean,
  showLabels: boolean
): Promise<RenderOutcome> {
  try {
    await refreshToken()
  } catch (retryErr) {
    if (shouldSkipBackendError(retryErr, displayErrors)) {
      return 'skipped'
    }

    handleError(
      retryErr instanceof Error
        ? retryErr.message
        : 'Session expired. Please re-authenticate.',
      displayErrors
    )
    return 'shown'
  }

  const { accessToken, instanceUrl } = getRuntimeState()

  if (!accessToken) {
    handleError('No access token.', displayErrors)
    return 'shown'
  }
  if (!instanceUrl) {
    handleError('No instance URL available.', displayErrors)
    return 'shown'
  }

  try {
    return await renderContent(
      contentType,
      instanceUrl,
      accessToken,
      contentId,
      showLabels
    )
  } catch (retryErr) {
    if (!(retryErr instanceof AuthError)) {
      reportError(retryErr, {
        source: 'salesforce-content',
        contentId,
        contentType,
      })
    }
    handleError(
      retryErr instanceof Error ? retryErr.message : 'Failed to load content.',
      displayErrors
    )
    return 'shown'
  }
}

async function fetchAndRender(
  contentId: string,
  contentType: SalesforceContentType,
  getRuntimeState: () => RuntimeState,
  refreshToken: RefreshToken,
  displayErrors: boolean,
  showLabels: boolean
): Promise<RenderOutcome> {
  const { accessToken, instanceUrl, credentialError } = getRuntimeState()

  if (!accessToken || !instanceUrl) {
    if (shouldSkipBackendError(credentialError, displayErrors)) {
      return 'skipped'
    }

    handleError(credentialError!.message, displayErrors)
    return 'shown'
  }

  try {
    return await renderContent(
      contentType,
      instanceUrl,
      accessToken,
      contentId,
      showLabels
    )
  } catch (err) {
    if (!(err instanceof AuthError)) {
      reportError(err, { source: 'salesforce-content', contentId, contentType })
      handleError(
        err instanceof Error ? err.message : 'Failed to load content.',
        displayErrors
      )
      return 'shown'
    }
  }

  return retryAfterRefresh(
    contentId,
    contentType,
    getRuntimeState,
    refreshToken,
    displayErrors,
    showLabels
  )
}

function createRenderer(
  contentId: string,
  contentType: SalesforceContentType,
  getRuntimeState: () => RuntimeState,
  refreshToken: RefreshToken,
  displayErrors: boolean,
  showLabels: boolean
): { render: () => Promise<RenderOutcome> } {
  return {
    render: () =>
      fetchAndRender(
        contentId,
        contentType,
        getRuntimeState,
        refreshToken,
        displayErrors,
        showLabels
      ),
  }
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

  const { render } = createRenderer(
    contentId,
    contentType,
    getRuntimeState,
    refreshToken,
    displayErrors,
    showLabels
  )

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
