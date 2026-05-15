import './css/style.css'
import '@screenly/edge-apps/components'
import {
  getCredentials,
  getSettingWithDefault,
  initTokenRefreshLoop,
  setupErrorHandling,
  signalReady,
} from '@screenly/edge-apps'
import { getDashboardResults, getReportResults, AuthError } from './api'
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

async function fetchAndRender(
  contentId: string,
  contentType: SalesforceContentType,
  getRuntimeState: () => RuntimeState,
  refreshToken: RefreshToken
): Promise<void> {
  let { accessToken, instanceUrl } = getRuntimeState()
  const { credentialError } = getRuntimeState()

  if (!accessToken || !instanceUrl) {
    showError(
      credentialError?.message ?? 'No access token or instance URL available.'
    )
    return
  }

  try {
    await loadAndRenderContent(contentType, instanceUrl, accessToken, contentId)
    showScreen('dashboard-screen')
    return
  } catch (err) {
    if (!(err instanceof AuthError)) {
      showError(err instanceof Error ? err.message : 'Failed to load content.')
      return
    }
  }

  try {
    await refreshToken()
    ;({ accessToken, instanceUrl } = getRuntimeState())

    if (!accessToken || !instanceUrl) {
      showError('No access token or instance URL available.')
      return
    }

    await loadAndRenderContent(contentType, instanceUrl, accessToken, contentId)
    showScreen('dashboard-screen')
  } catch (retryErr) {
    showError(
      retryErr instanceof Error
        ? retryErr.message
        : 'Session expired. Please re-authenticate.'
    )
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  setupErrorHandling()

  const contentId =
    getSettingWithDefault<string>('content_id', '') ||
    getSettingWithDefault<string>('dashboard_id', '')
  const contentTypeRaw = getSettingWithDefault<string>(
    'content_type',
    'dashboard'
  )
  const refreshInterval = getSettingWithDefault<number>('refresh_interval', 300)

  if (!contentId) {
    showError('Please configure the Salesforce Content ID in settings.')
    signalReady()
    return
  }

  if (contentTypeRaw !== 'dashboard' && contentTypeRaw !== 'report') {
    showError(
      `Invalid content type: "${contentTypeRaw}". Expected "dashboard" or "report".`
    )
    signalReady()
    return
  }

  const contentType = contentTypeRaw as SalesforceContentType

  let accessToken: string | null =
    getSettingWithDefault('access_token', '') || null
  let instanceUrl: string | null = null
  let credentialError: Error | null = null

  const refreshToken = async () => {
    const { token, metadata } = await getCredentials()
    accessToken = token
    instanceUrl = (metadata?.instance_url as string) ?? instanceUrl
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
    fetchAndRender(contentId, contentType, getRuntimeState, refreshToken)

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
