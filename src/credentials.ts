import { getSettingWithDefault } from '@screenly/edge-apps'
import { reportError } from '@screenly/edge-apps/utils'
import { readCachedCredentials, writeCachedCredentials } from './cache'
import { BackendServerError, shouldSkipBackendError } from './errors'
import type { SalesforceContentType } from './types'

export type RefreshToken = () => Promise<void>
export type RuntimeState = {
  accessToken: string | null
  instanceUrl: string | null
  credentialError: Error | null
}

export { BackendServerError } from './errors'

export const NO_CREDENTIALS_MESSAGE =
  'No access token or instance URL available.'

type CredentialsResponse = {
  token?: string
  metadata?: { instance_url?: string }
  error?: string
}

async function requestCredentials(): Promise<Response> {
  try {
    return await fetch(
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
}

async function parseCredentialsResponse(response: Response): Promise<{
  token?: string
  metadata?: { instance_url?: string }
}> {
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

async function fetchCredentials(): Promise<{
  token?: string
  metadata?: { instance_url?: string }
}> {
  const response = await requestCredentials()
  return parseCredentialsResponse(response)
}

type CredentialManagerState = RuntimeState & {
  hasReportedCredentialError: boolean
}

export function createCredentialManager(
  contentId: string,
  contentType: SalesforceContentType,
  displayErrors: boolean
): { refreshToken: RefreshToken; getRuntimeState: () => RuntimeState } {
  const state: CredentialManagerState = {
    accessToken: getSettingWithDefault('access_token', '') || null,
    instanceUrl: null,
    credentialError: null,
    hasReportedCredentialError: false,
  }

  function applySuccessfulRefresh(token: string, instanceUrl: string): void {
    state.accessToken = token
    state.instanceUrl = instanceUrl
    state.credentialError = null
    state.hasReportedCredentialError = false
    writeCachedCredentials({ accessToken: token, instanceUrl })
  }

  function applyFailedRefresh(err: unknown): Error {
    const error = err instanceof Error ? err : new Error(String(err))

    if (!state.hasReportedCredentialError) {
      reportError(error, {
        source: 'salesforce-credentials',
        contentId,
        contentType,
      })
      state.hasReportedCredentialError = true
    }

    state.credentialError = error

    // Cache reads are gated on `!state.instanceUrl` so a manager that has
    // already recovered credentials (live or cached) never overwrites them
    // with a possibly-stale cache entry on a later failed refresh.
    if (state.instanceUrl || !shouldSkipBackendError(error, displayErrors)) {
      return error
    }

    const cached = readCachedCredentials()
    if (cached) {
      state.accessToken = cached.accessToken
      state.instanceUrl = cached.instanceUrl
    }

    return error
  }

  const refreshToken = async () => {
    try {
      const { token, metadata } = await fetchCredentials()
      const nextInstanceUrl = metadata?.instance_url ?? state.instanceUrl

      if (!token || !nextInstanceUrl) {
        throw new Error(NO_CREDENTIALS_MESSAGE)
      }

      applySuccessfulRefresh(token, nextInstanceUrl)
    } catch (err) {
      throw applyFailedRefresh(err)
    }
  }

  return {
    refreshToken,
    getRuntimeState: () => ({
      accessToken: state.accessToken,
      instanceUrl: state.instanceUrl,
      credentialError: state.credentialError,
    }),
  }
}
