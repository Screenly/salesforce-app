import { getCorsProxyUrl } from '@screenly/edge-apps'
import type { DashboardResults, ReportResult } from './types'

const API_VERSION = 'v62.0'

function apiUrl(instanceUrl: string, path: string): string {
  const proxyUrl = getCorsProxyUrl()
  return `${proxyUrl}/${instanceUrl}/services/data/${API_VERSION}${path}`
}

export class AuthError extends Error {}

async function apiFetch<T>(
  instanceUrl: string,
  accessToken: string,
  path: string,
  method: 'GET' | 'PUT' = 'GET'
): Promise<T> {
  let response: Response
  try {
    response = await fetch(apiUrl(instanceUrl, path), {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    })
  } catch (err) {
    throw new Error(
      `Salesforce could not be reached (${err instanceof Error ? err.message : String(err)}).`,
      { cause: err }
    )
  }

  if (response.status === 401) throw new AuthError(`Unauthorized: ${path}`)
  if (response.status === 404)
    throw new Error(
      'The selected content could not be found. Please verify that it still exists in Salesforce.'
    )
  if (response.status >= 500 || response.status === 429)
    throw new Error(`Salesforce's API had a problem (${response.status}).`)
  if (!response.ok) throw new Error(`API error ${response.status}: ${path}`)

  return response.json() as Promise<T>
}

export async function triggerDashboardRefresh(
  instanceUrl: string,
  accessToken: string,
  contentId: string
): Promise<void> {
  const path = `/analytics/dashboards/${contentId}`
  await apiFetch(instanceUrl, accessToken, path, 'PUT').catch(() => {})
}

export async function getDashboardResults(
  instanceUrl: string,
  accessToken: string,
  contentId: string
): Promise<DashboardResults> {
  const path = `/analytics/dashboards/${contentId}`
  return apiFetch<DashboardResults>(instanceUrl, accessToken, path)
}

export async function getReportResults(
  instanceUrl: string,
  accessToken: string,
  contentId: string
): Promise<ReportResult> {
  const path = `/analytics/reports/${contentId}`
  return apiFetch<ReportResult>(instanceUrl, accessToken, path)
}
