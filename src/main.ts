import './css/style.css'
import '@screenly/edge-apps/components'
import {
  getSettingWithDefault,
  initTokenRefreshLoop,
  setupErrorHandling,
  signalReady,
} from '@screenly/edge-apps'
import { setupSentry } from '@screenly/edge-apps/utils'
import { inferSalesforceContentType } from './content'
import { createCredentialManager } from './credentials'
import { render } from './render-orchestrator'
import type { RenderContext } from './render-orchestrator'

setupSentry('salesforce', {
  salesforce: { content_id: screenly.settings.content_id },
})

document.addEventListener('DOMContentLoaded', async () => {
  setupErrorHandling()

  const contentId = getSettingWithDefault<string>('content_id', '')
  const displayErrors =
    getSettingWithDefault<string>('display_errors', 'false') === 'true'
  const refreshInterval = getSettingWithDefault<number>('refresh_interval', 300)
  const showLabels =
    getSettingWithDefault<string>('show_labels', 'false') === 'true'

  const contentType = inferSalesforceContentType(contentId)

  const { refreshToken, getRuntimeState } = createCredentialManager(
    contentId,
    contentType,
    displayErrors
  )

  await refreshToken()

  initTokenRefreshLoop(refreshToken)

  const context: RenderContext = {
    contentId,
    contentType,
    getRuntimeState,
    refreshToken,
    displayErrors,
    showLabels,
  }

  render(context)

  signalReady()

  setInterval(async () => {
    try {
      await render(context)
    } catch (err) {
      console.error('Refresh failed:', err)
    }
  }, refreshInterval * 1000)
})
