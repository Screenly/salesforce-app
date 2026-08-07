import {
  getSettingWithDefault,
  readEdgeAppCache,
  reportError,
  writeEdgeAppCache,
} from '@screenly/edge-apps/utils'

export const CACHE_NAMESPACE = 'salesforce-edge-app:v1'

export type RefreshToken = () => Promise<void>
export type Credentials = { accessToken: string; instanceUrl: string }
export type RuntimeState = {
  accessToken: string | null
  instanceUrl: string | null
  credentialError: Error | null
}

export const NO_CREDENTIALS_MESSAGE =
  'No access token or instance URL available.'

export class ScreenlyBackendError extends Error {}

type CredentialsResponse = {
  token?: string
  metadata?: { instance_url?: string }
  error?: string
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

async function fetchCredentials(
  fallbackInstanceUrl: string | null
): Promise<{ token: string; instanceUrl: string }> {
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
    const cause = err instanceof Error ? err : new Error(String(err))
    throw new ScreenlyBackendError(
      `Screenly's server could not be reached (${cause.message}).`,
      { cause }
    )
  }

  const { token, metadata } = await parseCredentialsResponse(response)
  const instanceUrl = metadata?.instance_url ?? fallbackInstanceUrl

  if (!token || !instanceUrl) {
    throw new ScreenlyBackendError(NO_CREDENTIALS_MESSAGE)
  }

  return { token, instanceUrl }
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
  writeEdgeAppCache(CACHE_NAMESPACE, 'credentials', {
    accessToken: token,
    instanceUrl,
  })
}

function applyFailedRefresh(err: unknown): void {
  const error = err instanceof Error ? err : new Error(String(err))
  const displayErrors = getSettingWithDefault<boolean>('display_errors', false)

  reportError(error, { source: 'salesforce-credentials' })
  state.credentialError = error

  if (state.instanceUrl || displayErrors) {
    throw error
  }

  const cached = readEdgeAppCache<Credentials>(CACHE_NAMESPACE, 'credentials')
  if (cached) {
    state.accessToken = cached.accessToken
    state.instanceUrl = cached.instanceUrl
  }
}

export const refreshToken: RefreshToken = async () => {
  try {
    const { token, instanceUrl } = await fetchCredentials(state.instanceUrl)
    applySuccessfulRefresh(token, instanceUrl)
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
