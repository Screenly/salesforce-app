import { getCorsProxyUrl } from '@screenly/edge-apps'
import type { DashboardResults } from './types'

const API_VERSION = 'v62.0'

function apiUrl(instanceUrl: string, path: string): string {
  const proxyUrl = getCorsProxyUrl()
  return `${proxyUrl}/${instanceUrl}/services/data/${API_VERSION}${path}`
}

export class AuthError extends Error {}

async function apiFetch<T>(
  instanceUrl: string,
  accessToken: string,
  path: string
): Promise<T> {
  const res = await fetch(apiUrl(instanceUrl, path), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  })

  if (res.status === 401) throw new AuthError(`Unauthorized: ${path}`)
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`)
  return res.json() as Promise<T>
}

export async function getDashboardResults(
  instanceUrl: string,
  accessToken: string,
  dashboardId: string
): Promise<DashboardResults> {
  const path = `/analytics/dashboards/${dashboardId}`

  await fetch(apiUrl(instanceUrl, path), {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  }).catch(() => {})

  return apiFetch<DashboardResults>(instanceUrl, accessToken, path)
}
