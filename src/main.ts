import './css/style.css'
import '@screenly/edge-apps/components'
import {
  getSettingWithDefault,
  initTokenRefreshLoop,
  setupErrorHandling,
  signalReady,
} from '@screenly/edge-apps'
import { setupSentry } from '@screenly/edge-apps/utils'
import { inferSalesforceContentType, refresh } from './content'
import { createCredentialManager } from './credentials'

setupSentry('salesforce', {
  salesforce: { content_id: screenly.settings.content_id },
})

document.addEventListener('DOMContentLoaded', async () => {
  setupErrorHandling()

  const displayErrors =
    getSettingWithDefault<string>('display_errors', 'false') === 'true'
  const refreshInterval = getSettingWithDefault<number>('refresh_interval', 300)

  const contentType = inferSalesforceContentType()

  const { refreshToken, getRuntimeState } = createCredentialManager(
    contentType,
    displayErrors
  )

  await refreshToken()

  initTokenRefreshLoop(refreshToken)

  await refresh(getRuntimeState)

  signalReady()

  setInterval(() => refresh(getRuntimeState), refreshInterval * 1000)
})
