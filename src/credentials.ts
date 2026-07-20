import { getSettingWithDefault } from '@screenly/edge-apps'
import { reportError } from '@screenly/edge-apps/utils'
import type { SalesforceContentType } from './types'

export type RefreshToken = () => Promise<void>
export type RuntimeState = {
  accessToken: string | null
  instanceUrl: string | null
  credentialError: Error | null
}

// Distinguishes a Screenly backend outage (5xx) from an expected failure
// (e.g. "Salesforce integration is not connected", a 400) so callers can
// skip/ignore transient backend errors instead of showing them as content errors.
export class BackendServerError extends Error {}

async function fetchCredentials(): Promise<{
  token: string
  metadata?: Record<string, unknown>
}> {
  const response = await fetch(
    `${screenly.settings.screenly_oauth_tokens_url}access_token/`,
    {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${screenly.settings.screenly_app_auth_token}`,
      },
    }
  )

  if (response.status >= 500) {
    throw new BackendServerError(
      `Screenly's server had a problem (${response.status}).`
    )
  }

  const body = await response.json()

  if (!response.ok) {
    throw new Error(
      body?.error ??
        `Screenly returned an unexpected error (${response.status}).`
    )
  }

  const { token, metadata } = body
  return { token, metadata }
}

export function createCredentialManager(
  contentId: string,
  contentType: SalesforceContentType
): { refreshToken: RefreshToken; getRuntimeState: () => RuntimeState } {
  let accessToken: string | null =
    getSettingWithDefault('access_token', '') || null
  let instanceUrl: string | null = null
  let credentialError: Error | null = null
  let hasReportedCredentialError = false

  const refreshToken = async () => {
    try {
      const { token, metadata } = await fetchCredentials()
      const nextInstanceUrl = (metadata?.instance_url as string) ?? instanceUrl

      if (!token || !nextInstanceUrl) {
        throw new Error('No access token or instance URL available.')
      }

      accessToken = token
      instanceUrl = nextInstanceUrl
      credentialError = null
      hasReportedCredentialError = false
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      if (!hasReportedCredentialError) {
        reportError(error, {
          source: 'salesforce-credentials',
          contentId,
          contentType,
        })
        hasReportedCredentialError = true
      }
      credentialError = error
      throw error
    }
  }

  return {
    refreshToken,
    getRuntimeState: () => ({ accessToken, instanceUrl, credentialError }),
  }
}
