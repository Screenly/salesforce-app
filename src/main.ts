import './css/style.css'
import '@screenly/edge-apps/components'
import {
  getSettingWithDefault,
  setupErrorHandling,
  signalReady,
} from '@screenly/edge-apps'
import { setupSentry } from '@screenly/edge-apps/utils'
import { refresh } from './content'

setupSentry('salesforce', {
  salesforce: { content_id: screenly.settings.content_id },
})

document.addEventListener('DOMContentLoaded', async () => {
  setupErrorHandling()

  const refreshInterval = getSettingWithDefault<number>('refresh_interval', 300)

  await refresh()

  signalReady()

  setInterval(refresh, refreshInterval * 1000)
})
