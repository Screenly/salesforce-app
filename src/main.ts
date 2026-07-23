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
import { showError } from './render'
import { render, shouldSignalReady } from './render-orchestrator'
import type { RenderContext } from './render-orchestrator'
import type { SalesforceContentType } from './types'

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
    contentType,
    displayErrors
  )

  try {
    await refreshToken()
  } catch (err) {
    console.warn('Failed to fetch initial credentials:', err)
  }

  initTokenRefreshLoop(refreshToken)

  const ctx: RenderContext = {
    contentId,
    contentType,
    getRuntimeState,
    refreshToken,
    displayErrors,
    showLabels,
  }

  let hasRenderedOnce = false
  const run = async () => {
    const outcome = await render(ctx)
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
