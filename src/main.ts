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
import { inferSalesforceContentType } from './content'
import { renderDashboard, renderReport, showScreen, showError } from './render'

type RefreshToken = () => Promise<void>
type RuntimeState = {
  accessToken: string | null
  instanceUrl: string | null
  credentialError: Error | null
}

async function loadAndRenderContent(
  contentType: ReturnType<typeof inferSalesforceContentType>,
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
  getRuntimeState: () => RuntimeState,
  refreshToken: RefreshToken
): Promise<void> {
  const contentType = inferSalesforceContentType(contentId)
  let { accessToken, instanceUrl } = getRuntimeState()
  const { credentialError } = getRuntimeState()

  if (!accessToken || !instanceUrl) {
    showError(
      credentialError?.message ?? 'No access token or instance URL available.'
    )
    signalReady()
    return
  }

  try {
    await loadAndRenderContent(contentType, instanceUrl, accessToken, contentId)
    showScreen('dashboard-screen')
    signalReady()
  } catch (err) {
    if (!(err instanceof AuthError)) throw err

    try {
      await refreshToken()
      ;({ accessToken, instanceUrl } = getRuntimeState())

      if (!accessToken || !instanceUrl) {
        throw new Error('No access token or instance URL available.', {
          cause: err,
        })
      }

      await loadAndRenderContent(
        contentType,
        instanceUrl,
        accessToken,
        contentId
      )
      showScreen('dashboard-screen')
      signalReady()
    } catch (retryErr) {
      showError(
        retryErr instanceof Error
          ? retryErr.message
          : 'Session expired. Please re-authenticate.'
      )
      signalReady()
    }
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  setupErrorHandling()

  const contentId =
    getSettingWithDefault<string>('content_id', '') ||
    getSettingWithDefault<string>('dashboard_id', '')
  const refreshInterval = getSettingWithDefault<number>('refresh_interval', 300)

  if (!contentId) {
    showError('Please configure the Salesforce Content ID in settings.')
    signalReady()
    return
  }

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

  const run = () => fetchAndRender(contentId, getRuntimeState, refreshToken)

  await run()

  setInterval(async () => {
    try {
      await run()
    } catch (err) {
      console.error('Refresh failed:', err)
    }
  }, refreshInterval * 1000)
})
