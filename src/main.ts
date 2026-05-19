import './css/style.css'
import '@screenly/edge-apps/components'
import {
  getSettingWithDefault,
  initTokenRefreshLoop,
  setupErrorHandling,
  signalReady,
} from '@screenly/edge-apps'
import { getDashboardResults, getReportResults, AuthError } from './api'
import { inferSalesforceContentType } from './content'
import { renderDashboard, renderReport, showScreen, showError } from './render'
import type { SalesforceContentType } from './types'

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
  contentId: string
): Promise<void> {
  if (contentType === 'dashboard') {
    const results = await getDashboardResults(
      instanceUrl,
      accessToken,
      contentId
    )
    renderDashboard(results)
    return
  }

  const results = await getReportResults(instanceUrl, accessToken, contentId)
  renderReport(contentId, results)
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
  displayErrors: boolean
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
    await loadAndRenderContent(contentType, instanceUrl, accessToken, contentId)
    showScreen('dashboard-screen')
    return
  } catch (err) {
    if (!(err instanceof AuthError)) {
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

    await loadAndRenderContent(contentType, instanceUrl, accessToken, contentId)
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

const getCredentials = async (
  tokenType: string = 'access_token'
): Promise<{ token: string; instanceUrl: string }> => {
  const response = await fetch(
    screenly.settings.screenly_oauth_tokens_url + tokenType + '/',
    {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${screenly.settings.screenly_app_auth_token}`,
      },
    }
  )

  const { token, instance_url } = await response.json()
  return { token, instanceUrl: instance_url }
}

document.addEventListener('DOMContentLoaded', async () => {
  setupErrorHandling()

  const contentId =
    getSettingWithDefault<string>('content_id', '') ||
    getSettingWithDefault<string>('dashboard_id', '')
  const refreshInterval = getSettingWithDefault<number>('refresh_interval', 300)
  const displayErrors =
    getSettingWithDefault<string>('display_errors', 'false') === 'true'

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

  const refreshToken = async () => {
    const credentials = await getCredentials()

    console.log('Renat!!!', credentials)

    accessToken = credentials.token
    instanceUrl = credentials.instanceUrl

    credentialError = null
  }

  try {
    await refreshToken()
  } catch (err) {
    credentialError = err instanceof Error ? err : new Error(String(err))
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
      displayErrors
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
