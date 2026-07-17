import './css/style.css'
import '@screenly/edge-apps/components'
import {
  getCredentials,
  getSettingWithDefault,
  initTokenRefreshLoop,
  setupErrorHandling,
  signalReady,
} from '@screenly/edge-apps'
import { reportError, setupSentry } from '@screenly/edge-apps/utils'
import { getDashboardResults, getReportResults, AuthError } from './api'
import { inferSalesforceContentType } from './content'
import { renderDashboard, renderReport, showScreen, showError } from './render'
import type { SalesforceContentType } from './types'

setupSentry('salesforce', {
  salesforce: { content_id: screenly.settings.content_id },
})

type RefreshToken = () => Promise<void>
type RuntimeState = {
  accessToken: string | null
  instanceUrl: string | null
  credentialError: Error | null
}

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
  showLabels: boolean
): Promise<void> {
  let { accessToken, instanceUrl } = getRuntimeState()
  const { credentialError } = getRuntimeState()

  if (!accessToken || !instanceUrl) {
    handleError(
      credentialError?.message ?? 'No access token or instance URL available.',
      displayErrors
    )
    return
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
    return
  } catch (err) {
    if (!(err instanceof AuthError)) {
      reportError(err, { source: 'salesforce-content', contentId, contentType })
      handleError(
        err instanceof Error ? err.message : 'Failed to load content.',
        displayErrors
      )
      return
    }
  }

  try {
    await refreshToken()
    ;({ accessToken, instanceUrl } = getRuntimeState())

    if (!accessToken) {
      handleError('No access token.', displayErrors)
      return
    }
    if (!instanceUrl) {
      handleError('No instance URL available.', displayErrors)
      return
    }

    await loadAndRenderContent(
      contentType,
      instanceUrl,
      accessToken,
      contentId,
      showLabels
    )
    showScreen('dashboard-screen')
  } catch (retryErr) {
    handleError(
      retryErr instanceof Error
        ? retryErr.message
        : 'Session expired. Please re-authenticate.',
      displayErrors
    )
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

  let accessToken: string | null =
    getSettingWithDefault('access_token', '') || null
  let instanceUrl: string | null = null
  let credentialError: Error | null = null
  let hasReportedCredentialError = false

  const refreshToken = async () => {
    try {
      const { token, metadata } = await getCredentials()
      const nextInstanceUrl = (metadata?.instance_url as string) ?? instanceUrl

      if (!token || !nextInstanceUrl) {
        throw new Error('No access token or instance URL available.')
      }

      accessToken = token
      instanceUrl = nextInstanceUrl
      credentialError = null
      hasReportedCredentialError = false
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      if (!hasReportedCredentialError) {
        reportError(error, {
          source: 'salesforce-credentials',
          contentId,
          contentType,
        })
        hasReportedCredentialError = true
      }
      credentialError = error
      throw error
    }
  }

  try {
    await refreshToken()
  } catch (err) {
    console.warn('Failed to fetch initial credentials:', err)
  }

  initTokenRefreshLoop(refreshToken)

  const getRuntimeState = (): RuntimeState => ({
    accessToken,
    instanceUrl,
    credentialError,
  })

  const run = () =>
    fetchAndRender(
      contentId,
      contentType,
      getRuntimeState,
      refreshToken,
      displayErrors,
      showLabels
    )

  await run()
  signalReady()

  setInterval(async () => {
    try {
      await run()
    } catch (err) {
      console.error('Refresh failed:', err)
    }
  }, refreshInterval * 1000)
})
