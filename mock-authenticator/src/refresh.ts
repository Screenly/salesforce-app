import { SF_TOKEN_URL } from './constants'
import { loadTokens, saveTokens } from './db'

const REFRESH_INTERVAL_MS = 25 * 60 * 1000

async function refreshTokens(): Promise<void> {
  const tokens = loadTokens()
  if (!tokens) return

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: process.env.SF_CLIENT_ID!,
    refresh_token: tokens.refresh_token,
  })

  const res = await fetch(SF_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (!res.ok) {
    console.error(`Token refresh failed: ${res.status}`)
    return
  }

  const data = (await res.json()) as { access_token: string }
  saveTokens({
    access_token: data.access_token,
    refresh_token: tokens.refresh_token,
    instance_url: tokens.instance_url,
  })

  console.log(`Access token refreshed at ${new Date().toISOString()}`)
}

export function startRefreshLoop(): void {
  setInterval(async () => {
    try {
      await refreshTokens()
    } catch (err) {
      console.error('Token refresh error:', err)
    }
  }, REFRESH_INTERVAL_MS)
}
