import { describe, test, expect, beforeEach, mock } from 'bun:test'

mock.module('@screenly/edge-apps', () => ({
  getSettingWithDefault: (_key: string, defaultValue: unknown) => defaultValue,
}))

const reportError = mock(() => {})
mock.module('@screenly/edge-apps/utils', () => ({ reportError }))

const { createCredentialManager, BackendServerError } =
  await import('./credentials')

const CONTENT_ID = '01Zg5000002iDwTEAU'
const CONTENT_TYPE = 'dashboard'

function fakeResponse(status: number, body: unknown): typeof fetch {
  return mock(async () => ({
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  })) as unknown as typeof fetch
}

function succeed() {
  globalThis.fetch = fakeResponse(200, {
    token: 'abc',
    metadata: { instance_url: 'https://na1.salesforce.com' },
  })
}

function failWithNetworkError(message: string) {
  globalThis.fetch = mock(async () => {
    throw new Error(message)
  }) as unknown as typeof fetch
}

function setScreenlySettings() {
  ;(globalThis as Record<string, unknown>).screenly = {
    settings: {
      screenly_oauth_tokens_url: 'https://api.example.com/oauth/',
      screenly_app_auth_token: 'app-auth',
    },
  }
}

describe('createCredentialManager > success', () => {
  beforeEach(() => {
    setScreenlySettings()
    reportError.mockClear()
  })

  test('stores the access token and instance url on success', async () => {
    succeed()
    const { refreshToken, getRuntimeState } = createCredentialManager(
      CONTENT_ID,
      CONTENT_TYPE
    )
    await refreshToken()

    expect(getRuntimeState()).toEqual({
      accessToken: 'abc',
      instanceUrl: 'https://na1.salesforce.com',
      credentialError: null,
    })
    expect(reportError).not.toHaveBeenCalled()
  })

  test('reports only the first of repeated failures, then again after a success', async () => {
    failWithNetworkError('network down')
    const { refreshToken } = createCredentialManager(CONTENT_ID, CONTENT_TYPE)

    await expect(refreshToken()).rejects.toThrow('network down')
    await expect(refreshToken()).rejects.toThrow('network down')
    expect(reportError).toHaveBeenCalledTimes(1)

    succeed()
    await refreshToken()

    failWithNetworkError('boom')
    await expect(refreshToken()).rejects.toThrow('boom')
    expect(reportError).toHaveBeenCalledTimes(2)
  })
})

describe('createCredentialManager > error responses', () => {
  beforeEach(() => {
    setScreenlySettings()
    reportError.mockClear()
  })

  test('throws and reports when the backend responds without a token', async () => {
    globalThis.fetch = fakeResponse(200, { token: '', metadata: undefined })
    const { refreshToken, getRuntimeState } = createCredentialManager(
      CONTENT_ID,
      CONTENT_TYPE
    )

    await expect(refreshToken()).rejects.toThrow(
      'No access token or instance URL available.'
    )
    expect(getRuntimeState().credentialError?.message).toBe(
      'No access token or instance URL available.'
    )
    expect(reportError).toHaveBeenCalledTimes(1)
  })

  test('throws a BackendServerError on a 5xx response, without parsing the body', async () => {
    globalThis.fetch = fakeResponse(503, undefined)
    const { refreshToken, getRuntimeState } = createCredentialManager(
      CONTENT_ID,
      CONTENT_TYPE
    )

    await expect(refreshToken()).rejects.toBeInstanceOf(BackendServerError)
    expect(getRuntimeState().credentialError).toBeInstanceOf(BackendServerError)
    expect(reportError).toHaveBeenCalledTimes(1)
  })

  test('surfaces the backend-provided reason for a non-5xx error response', async () => {
    globalThis.fetch = fakeResponse(400, {
      error: 'Salesforce integration is not connected',
    })
    const { refreshToken, getRuntimeState } = createCredentialManager(
      CONTENT_ID,
      CONTENT_TYPE
    )

    await expect(refreshToken()).rejects.toThrow(
      'Salesforce integration is not connected'
    )
    expect(getRuntimeState().credentialError?.message).toBe(
      'Salesforce integration is not connected'
    )
    expect(reportError).toHaveBeenCalledTimes(1)
  })
})
