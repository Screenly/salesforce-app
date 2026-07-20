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
import {
  BackendServerError,
  createCredentialManager,
  NO_CREDENTIALS_MESSAGE,
} from './credentials'
import type { RefreshToken, RuntimeState } from './credentials'
import { renderDashboard, renderReport, showScreen, showError } from './render'
import type { SalesforceContentType } from './types'

setupSentry('salesforce', {
  salesforce: { content_id: screenly.settings.content_id },
})

async function loadAndRenderContent(
  contentType: SalesforceContentType,
  instanceUrl: string,
  accessToken: string,
  contentId: string,
  showLabels: boolean
): Promise<void> {
  if (contentType === 'dashboard') {
    const results = await getDashboardResults(
      instanceUrl,
      accessToken,
      contentId
    )
    renderDashboard(results, showLabels)
    return
  }

  const results = await getReportResults(instanceUrl, accessToken, contentId)
  renderReport(contentId, results, showLabels)
}

function handleError(message: string, displayErrors: boolean): void {
  if (displayErrors) throw new Error(message)
  showError(message)
}

async function fetchAndRender(
  contentId: string,
  contentType: SalesforceContentType,
  getRuntimeState: () => RuntimeState,
  refreshToken: RefreshToken,
  displayErrors: boolean,
  showLabels: boolean,
  hasRenderedOnce: boolean
): Promise<boolean> {
  let { accessToken, instanceUrl } = getRuntimeState()
  const { credentialError } = getRuntimeState()

  if (!accessToken || !instanceUrl) {
    if (credentialError instanceof BackendServerError) return hasRenderedOnce

    handleError(
      credentialError?.message ?? NO_CREDENTIALS_MESSAGE,
      displayErrors
    )
    return true
  }

  try {
    await loadAndRenderContent(
      contentType,
      instanceUrl,
      accessToken,
      contentId,
      showLabels
    )
    showScreen('dashboard-screen')
    return true
  } catch (err) {
    if (!(err instanceof AuthError)) {
      reportError(err, { source: 'salesforce-content', contentId, contentType })
      handleError(
        err instanceof Error ? err.message : 'Failed to load content.',
        displayErrors
      )
      return true
    }
  }

  try {
    await refreshToken()
    ;({ accessToken, instanceUrl } = getRuntimeState())

    if (!accessToken) {
      handleError('No access token.', displayErrors)
      return true
    }
    if (!instanceUrl) {
      handleError('No instance URL available.', displayErrors)
      return true
    }

    await loadAndRenderContent(
      contentType,
      instanceUrl,
      accessToken,
      contentId,
      showLabels
    )
    showScreen('dashboard-screen')
    return true
  } catch (retryErr) {
    if (retryErr instanceof BackendServerError) return hasRenderedOnce

    handleError(
      retryErr instanceof Error
        ? retryErr.message
        : 'Session expired. Please re-authenticate.',
      displayErrors
    )
    return true
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

  let hasRenderedOnce = false
  const run = async () => {
    const rendered = await fetchAndRender(
      contentId,
      contentType,
      getRuntimeState,
      refreshToken,
      displayErrors,
      showLabels,
      hasRenderedOnce
    )
    if (rendered && !hasRenderedOnce) signalReady()
    hasRenderedOnce = hasRenderedOnce || rendered
    return rendered
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
