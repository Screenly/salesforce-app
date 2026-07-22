import { getCorsProxyUrl } from '@screenly/edge-apps'
import type { DashboardResults, ReportResult } from './types'

const API_VERSION = 'v62.0'

function apiUrl(instanceUrl: string, path: string): string {
  const proxyUrl = getCorsProxyUrl()
  return `${proxyUrl}/${instanceUrl}/services/data/${API_VERSION}${path}`
}

export class AuthError extends Error {}

async function performApiRequest(
  instanceUrl: string,
  accessToken: string,
  path: string,
  method: string = 'GET'
): Promise<Response> {
  return fetch(apiUrl(instanceUrl, path), {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  })
}

function classifyApiResponse(res: Response, path: string): void {
  if (res.status === 401) throw new AuthError(`Unauthorized: ${path}`)
  if (res.status === 404)
    throw new Error(
      'The selected content could not be found. Please verify that it still exists in Salesforce.'
    )
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`)
}

async function apiFetch<T>(
  instanceUrl: string,
  accessToken: string,
  path: string
): Promise<T> {
  const res = await performApiRequest(instanceUrl, accessToken, path)
  classifyApiResponse(res, path)
  return res.json() as Promise<T>
}

export async function getDashboardResults(
  instanceUrl: string,
  accessToken: string,
  contentId: string
): Promise<DashboardResults> {
  const path = `/analytics/dashboards/${contentId}`

  await performApiRequest(instanceUrl, accessToken, path, 'PUT').catch(() => {})

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
