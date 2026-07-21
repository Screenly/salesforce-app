import { getSettingWithDefault } from '@screenly/edge-apps'
import { reportError } from '@screenly/edge-apps/utils'
import type { SalesforceContentType } from './types'

export type RefreshToken = () => Promise<void>
export type RuntimeState = {
  accessToken: string | null
  instanceUrl: string | null
  credentialError: Error | null
}

export class BackendServerError extends Error {}

export const NO_CREDENTIALS_MESSAGE =
  'No access token or instance URL available.'

type CredentialsResponse = {
  token?: string
  metadata?: { instance_url?: string }
  error?: string
}

async function fetchCredentials(): Promise<{
  token?: string
  metadata?: { instance_url?: string }
}> {
  let response: Response
  try {
    response = await fetch(
      `${screenly.settings.screenly_oauth_tokens_url}access_token/`,
      {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${screenly.settings.screenly_app_auth_token}`,
        },
      }
    )
  } catch (err) {
    throw new BackendServerError(
      `Screenly's server could not be reached (${err instanceof Error ? err.message : String(err)}).`
    )
  }

  if (response.status >= 500 || response.status === 429) {
    throw new BackendServerError(
      `Screenly's server had a problem (${response.status}).`
    )
  }

  const body = (await response.json().catch(() => undefined)) as
    | CredentialsResponse
    | undefined

  if (!response.ok) {
    throw new Error(
      typeof body?.error === 'string'
        ? body.error
        : `Screenly returned an unexpected error (${response.status}).`
    )
  }

  const { token, metadata } = body ?? {}
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
      const nextInstanceUrl = metadata?.instance_url ?? instanceUrl

      if (!token || !nextInstanceUrl) {
        throw new Error(NO_CREDENTIALS_MESSAGE)
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
