import { describe, test, expect, beforeEach, mock } from 'bun:test'

mock.module('@screenly/edge-apps', () => ({
  getSettingWithDefault: (_key: string, defaultValue: unknown) => defaultValue,
}))

const reportError = mock(() => {})
mock.module('@screenly/edge-apps/utils', () => ({ reportError }))

const { createCredentialManager, BackendServerError, NO_CREDENTIALS_MESSAGE } =
  await import('./credentials')

const CONTENT_ID = '01Zg5000002iDwTEAU'
const CONTENT_TYPE = 'dashboard'

function makeManager() {
  return createCredentialManager(CONTENT_ID, CONTENT_TYPE)
}

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

beforeEach(() => {
  ;(globalThis as Record<string, unknown>).screenly = {
    settings: {
      screenly_oauth_tokens_url: 'https://api.example.com/oauth/',
      screenly_app_auth_token: 'app-auth',
    },
  }
  reportError.mockClear()
})

describe('createCredentialManager > success', () => {
  test('stores the access token and instance url on success', async () => {
    succeed()
    const { refreshToken, getRuntimeState } = makeManager()
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
    const { refreshToken } = makeManager()

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
  test('throws and reports when the backend responds without a token', async () => {
    globalThis.fetch = fakeResponse(200, { token: '', metadata: undefined })
    const { refreshToken, getRuntimeState } = makeManager()

    await expect(refreshToken()).rejects.toThrow(NO_CREDENTIALS_MESSAGE)
    expect(getRuntimeState().credentialError?.message).toBe(
      NO_CREDENTIALS_MESSAGE
    )
    expect(reportError).toHaveBeenCalledTimes(1)
  })

  test('throws a BackendServerError on a 5xx response, without parsing the body', async () => {
    globalThis.fetch = fakeResponse(503, undefined)
    const { refreshToken, getRuntimeState } = makeManager()

    await expect(refreshToken()).rejects.toBeInstanceOf(BackendServerError)
    expect(getRuntimeState().credentialError).toBeInstanceOf(BackendServerError)
    expect(reportError).toHaveBeenCalledTimes(1)
  })

  test('surfaces the backend-provided reason for a non-5xx error response', async () => {
    globalThis.fetch = fakeResponse(400, {
      error: 'Salesforce integration is not connected',
    })
    const { refreshToken, getRuntimeState } = makeManager()

    await expect(refreshToken()).rejects.toThrow(
      'Salesforce integration is not connected'
    )
    expect(getRuntimeState().credentialError?.message).toBe(
      'Salesforce integration is not connected'
    )
    expect(reportError).toHaveBeenCalledTimes(1)
  })

  test('falls back to a status-based message when the error response body is not JSON', async () => {
    globalThis.fetch = mock(async () => ({
      status: 400,
      ok: false,
      json: async () => {
        throw new SyntaxError('Unexpected end of JSON input')
      },
    })) as unknown as typeof fetch
    const { refreshToken, getRuntimeState } = makeManager()

    await expect(refreshToken()).rejects.toThrow(
      'Screenly returned an unexpected error (400).'
    )
    expect(getRuntimeState().credentialError?.message).toBe(
      'Screenly returned an unexpected error (400).'
    )
    expect(reportError).toHaveBeenCalledTimes(1)
  })
})
