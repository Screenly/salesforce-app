import { getSettingWithDefault, reportError } from '@screenly/edge-apps/utils'
import { readCachedCredentials, writeCachedCredentials } from './cache'

export type RefreshToken = () => Promise<void>
export type RuntimeState = {
  accessToken: string | null
  instanceUrl: string | null
  credentialError: Error | null
}

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
    throw new Error(
      `Screenly's server could not be reached (${err instanceof Error ? err.message : String(err)}).`,
      { cause: err }
    )
  }
}

async function parseCredentialsResponse(response: Response): Promise<{
  token?: string
  metadata?: { instance_url?: string }
}> {
  if (response.status >= 500 || response.status === 429) {
    throw new Error(`Screenly's server had a problem (${response.status}).`)
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

const state: RuntimeState = {
  accessToken: getSettingWithDefault('access_token', '') || null,
  instanceUrl: null,
  credentialError: null,
}

function applySuccessfulRefresh(token: string, instanceUrl: string): void {
  state.accessToken = token
  state.instanceUrl = instanceUrl
  state.credentialError = null
  writeCachedCredentials({ accessToken: token, instanceUrl })
}

function applyFailedRefresh(err: unknown): void {
  const error = err instanceof Error ? err : new Error(String(err))
  const displayErrors = getSettingWithDefault<boolean>('display_errors', false)

  reportError(error, { source: 'salesforce-credentials' })
  state.credentialError = error

  if (state.instanceUrl || displayErrors) {
    throw error
  }

  const cached = readCachedCredentials()
  if (cached) {
    state.accessToken = cached.accessToken
    state.instanceUrl = cached.instanceUrl
  }
}

export const refreshToken: RefreshToken = async () => {
  try {
    const { token, metadata } = await fetchCredentials()
    const nextInstanceUrl = metadata?.instance_url ?? state.instanceUrl

    if (!token || !nextInstanceUrl) {
      throw new Error(NO_CREDENTIALS_MESSAGE)
    }

    applySuccessfulRefresh(token, nextInstanceUrl)
  } catch (err) {
    applyFailedRefresh(err)
  }
}

export function getRuntimeState(): RuntimeState {
  return {
    accessToken: state.accessToken,
    instanceUrl: state.instanceUrl,
    credentialError: state.credentialError,
  }
}
