import './css/style.css'
import '@screenly/edge-apps/components'
import {
  getSettingWithDefault,
  setupErrorHandling,
  signalReady,
} from '@screenly/edge-apps'
import {
  loadAuth,
  saveAuth,
  clearAuth,
  requestDeviceCode,
  pollForToken,
  refreshAccessToken,
} from './auth'
import { getDashboardResults, AuthError } from './api'
import { renderDashboard, showScreen, showError } from './render'

async function startDeviceFlow(clientId: string): Promise<void> {
  const deviceCode = await requestDeviceCode(clientId)

  const authUrlEl = document.getElementById('auth-url')
  const userCodeEl = document.getElementById('user-code')
  const authStatusEl = document.getElementById('auth-status')

  if (authUrlEl) authUrlEl.textContent = deviceCode.verification_uri
  if (userCodeEl) userCodeEl.textContent = deviceCode.user_code
  if (authStatusEl) authStatusEl.textContent = 'Waiting for authorization...'

  showScreen('auth-screen')
  signalReady()

  const token = await pollForToken(
    clientId,
    deviceCode.device_code,
    deviceCode.interval
  )

  saveAuth({
    access_token: token.access_token,
    refresh_token: token.refresh_token,
    instance_url: token.instance_url,
  })
}

async function fetchAndRender(
  clientId: string,
  dashboardId: string
): Promise<void> {
  let auth = loadAuth()

  if (!auth) {
    await startDeviceFlow(clientId)
    auth = loadAuth()
  }

  if (!auth) {
    showError('Authentication failed. Please reload the page.')
    return
  }

  try {
    const results = await getDashboardResults(
      auth.instance_url,
      auth.access_token,
      dashboardId
    )
    renderDashboard(results)
    showScreen('dashboard-screen')
    signalReady()
  } catch (err) {
    if (!(err instanceof AuthError)) throw err

    try {
      const newToken = await refreshAccessToken(clientId, auth.refresh_token)
      saveAuth({
        access_token: newToken.access_token,
        refresh_token: auth.refresh_token,
        instance_url: auth.instance_url,
      })

      const results = await getDashboardResults(
        auth.instance_url,
        newToken.access_token,
        dashboardId
      )
      renderDashboard(results)
      showScreen('dashboard-screen')
      signalReady()
    } catch {
      clearAuth()
      showError('Session expired. Reload the page to re-authenticate.')
    }
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  setupErrorHandling()

  const clientId = getSettingWithDefault<string>('client_id', '')
  const dashboardId = getSettingWithDefault<string>('dashboard_id', '')
  const refreshInterval = getSettingWithDefault<number>('refresh_interval', 300)

  if (!clientId || !dashboardId) {
    showError('Please configure the Client ID and Dashboard ID in settings.')
    signalReady()
    return
  }

  await fetchAndRender(clientId, dashboardId)

  setInterval(async () => {
    try {
      await fetchAndRender(clientId, dashboardId)
    } catch (err) {
      console.error('Refresh failed:', err)
    }
  }, refreshInterval * 1000)
})
