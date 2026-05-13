import { getCorsProxyUrl } from '@screenly/edge-apps'
import type { DashboardResults } from './types'

const API_VERSION = 'v62.0'

function apiUrl(instanceUrl: string, path: string): string {
  const proxyUrl = getCorsProxyUrl()
  return `${proxyUrl}/${instanceUrl}/services/data/${API_VERSION}${path}`
}

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

  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`)
  return res.json() as Promise<T>
}

export async function getDashboardResults(
  instanceUrl: string,
  accessToken: string,
  dashboardId: string
): Promise<DashboardResults> {
  return apiFetch<DashboardResults>(
    instanceUrl,
    accessToken,
    `/analytics/dashboards/${dashboardId}/results`
  )
}
