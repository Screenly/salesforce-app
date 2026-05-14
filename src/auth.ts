import { getCorsProxyUrl } from '@screenly/edge-apps'
import type { DeviceCodeResponse, TokenResponse, StoredAuth } from './types'

const STORAGE_KEY = 'salesforce_auth'
const SF_TOKEN_URL = 'https://login.salesforce.com/services/oauth2/token'

export function loadAuth(): StoredAuth | null {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as StoredAuth
  } catch {
    return null
  }
}

export function saveAuth(auth: StoredAuth): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(auth))
}

export function clearAuth(): void {
  localStorage.removeItem(STORAGE_KEY)
}

export async function requestDeviceCode(
  clientId: string
): Promise<DeviceCodeResponse> {
  const proxyUrl = getCorsProxyUrl()
  const url = `${proxyUrl}/${SF_TOKEN_URL}`

  const body = new URLSearchParams({
    response_type: 'device_code',
    client_id: clientId,
    scope: 'api refresh_token',
  })

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (!res.ok) throw new Error(`Device code request failed: ${res.status}`)
  return res.json() as Promise<DeviceCodeResponse>
}

export async function pollForToken(
  clientId: string,
  deviceCode: string,
  interval: number
): Promise<TokenResponse> {
  const proxyUrl = getCorsProxyUrl()
  const url = `${proxyUrl}/${SF_TOKEN_URL}`

  return new Promise((resolve, reject) => {
    const poll = async () => {
      const body = new URLSearchParams({
        grant_type: 'device',
        client_id: clientId,
        code: deviceCode,
      })

      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: body.toString(),
        })

        const data = (await res.json()) as Record<string, string>

        if (data.access_token) {
          resolve(data as unknown as TokenResponse)
          return
        }

        if (data.error === 'authorization_pending') {
          setTimeout(poll, interval * 1000)
        } else if (data.error === 'slow_down') {
          setTimeout(poll, (interval + 5) * 1000)
        } else {
          reject(new Error(data.error ?? 'Unknown error during polling'))
        }
      } catch (err) {
        reject(err)
      }
    }

    setTimeout(poll, interval * 1000)
  })
}

export async function refreshAccessToken(
  clientId: string,
  refreshToken: string
): Promise<TokenResponse> {
  const proxyUrl = getCorsProxyUrl()
  const url = `${proxyUrl}/${SF_TOKEN_URL}`

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: clientId,
    refresh_token: refreshToken,
  })

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (!res.ok) throw new Error(`Token refresh failed: ${res.status}`)
  return res.json() as Promise<TokenResponse>
}
