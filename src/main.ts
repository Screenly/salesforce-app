import './css/style.css'
import '@screenly/edge-apps/components'
import {
  getCredentials,
  getSettingWithDefault,
  initTokenRefreshLoop,
  setupErrorHandling,
  signalReady,
} from '@screenly/edge-apps'
import { getDashboardResults, AuthError } from './api'
import { renderDashboard, showScreen, showError } from './render'

type RefreshToken = () => Promise<void>

async function fetchAndRender(
  instanceUrl: string | null,
  accessToken: string | null,
  credentialError: Error | null,
  dashboardId: string,
  refreshToken: RefreshToken
): Promise<void> {
  if (!accessToken || !instanceUrl) {
    showError(
      credentialError?.message ?? 'No access token or instance URL available.'
    )
    signalReady()
    return
  }

  try {
    const results = await getDashboardResults(
      instanceUrl,
      accessToken,
      dashboardId
    )
    renderDashboard(results)
    showScreen('dashboard-screen')
    signalReady()
  } catch (err) {
    if (!(err instanceof AuthError)) throw err

    try {
      await refreshToken()
      const results = await getDashboardResults(
        instanceUrl,
        accessToken,
        dashboardId
      )
      renderDashboard(results)
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

  const dashboardId = getSettingWithDefault<string>('dashboard_id', '')
  const refreshInterval = getSettingWithDefault<number>('refresh_interval', 300)

  if (!dashboardId) {
    showError('Please configure the Dashboard ID in settings.')
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

  const run = () =>
    fetchAndRender(
      instanceUrl,
      accessToken,
      credentialError,
      dashboardId,
      refreshToken
    )

  await run()

  setInterval(async () => {
    try {
      await run()
    } catch (err) {
      console.error('Refresh failed:', err)
    }
  }, refreshInterval * 1000)
})
