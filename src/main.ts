import './css/style.css'
import '@screenly/edge-apps/components'
import {
  getCredentials,
  getSettingWithDefault,
  initTokenRefreshLoop,
  setupErrorHandling,
  signalReady,
} from '@screenly/edge-apps'
import { getDashboardResults } from './api'
import { renderDashboard, showScreen, showError } from './render'

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

  const refreshToken = async () => {
    const { token, metadata } = await getCredentials()
    accessToken = token
    instanceUrl = (metadata?.instance_url as string) ?? instanceUrl
  }

  if (!accessToken) {
    try {
      await refreshToken()
    } catch (err) {
      console.warn('Failed to fetch initial access token:', err)
    }
  }

  initTokenRefreshLoop(refreshToken)

  const fetchAndRender = async () => {
    if (!accessToken || !instanceUrl) {
      showError('No access token or instance URL available.')
      signalReady()
      return
    }

    const results = await getDashboardResults(
      instanceUrl,
      accessToken,
      dashboardId
    )
    renderDashboard(results)
    showScreen('dashboard-screen')
    signalReady()
  }

  await fetchAndRender()

  setInterval(async () => {
    try {
      await fetchAndRender()
    } catch (err) {
      console.error('Refresh failed:', err)
    }
  }, refreshInterval * 1000)
})
