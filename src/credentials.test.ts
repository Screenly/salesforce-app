import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test'

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

function stubFetch(impl: () => Promise<unknown>) {
  const fetchMock = mock(impl)
  globalThis.fetch = fetchMock as unknown as typeof fetch
  return fetchMock
}

function fakeResponse(status: number, body: unknown) {
  return stubFetch(async () => ({
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  }))
}

function succeed() {
  fakeResponse(200, {
    token: 'abc',
    metadata: { instance_url: 'https://na1.salesforce.com' },
  })
}

function failWithNetworkError(message: string) {
  stubFetch(async () => {
    throw new Error(message)
  })
}

const originalFetch = globalThis.fetch

beforeEach(() => {
  ;(globalThis as Record<string, unknown>).screenly = {
    settings: {
      screenly_oauth_tokens_url: 'https://api.example.com/oauth/',
      screenly_app_auth_token: 'app-auth',
    },
  }
  reportError.mockClear()
})

afterEach(() => {
  globalThis.fetch = originalFetch
  delete (globalThis as Record<string, unknown>).screenly
})

describe('success', () => {
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

describe('backend outage errors', () => {
  async function expectBackendServerError() {
    const { refreshToken, getRuntimeState } = makeManager()

    await expect(refreshToken()).rejects.toBeInstanceOf(BackendServerError)
    expect(getRuntimeState().credentialError).toBeInstanceOf(BackendServerError)
    expect(reportError).toHaveBeenCalledTimes(1)
  }

  test('throws on a 5xx response, without parsing the body', async () => {
    const json = mock(async () => ({}))
    stubFetch(async () => ({ status: 503, ok: false, json }))

    await expectBackendServerError()
    expect(json).not.toHaveBeenCalled()
  })

  test('throws when the network request itself fails', async () => {
    stubFetch(async () => {
      throw new TypeError('Failed to fetch')
    })

    await expectBackendServerError()
  })

  test('throws on a 429 response', async () => {
    fakeResponse(429, undefined)

    await expectBackendServerError()
  })
})

describe('other errors', () => {
  test('throws and reports when the backend responds without a token', async () => {
    fakeResponse(200, { token: '', metadata: undefined })
    const { refreshToken, getRuntimeState } = makeManager()

    await expect(refreshToken()).rejects.toThrow(NO_CREDENTIALS_MESSAGE)
    expect(getRuntimeState().credentialError?.message).toBe(
      NO_CREDENTIALS_MESSAGE
    )
    expect(reportError).toHaveBeenCalledTimes(1)
  })

  test('surfaces the backend-provided reason for a non-5xx error response', async () => {
    fakeResponse(400, { error: 'Salesforce integration is not connected' })
    const { refreshToken, getRuntimeState } = makeManager()

    await expect(refreshToken()).rejects.toThrow(
      'Salesforce integration is not connected'
    )
    expect(getRuntimeState().credentialError?.message).toBe(
      'Salesforce integration is not connected'
    )
    expect(reportError).toHaveBeenCalledTimes(1)
  })

  test('falls back to a status-based message when the backend error is not a string', async () => {
    fakeResponse(400, {
      error: { message: 'Salesforce integration is not connected' },
    })
    const { refreshToken, getRuntimeState } = makeManager()

    await expect(refreshToken()).rejects.toThrow(
      'Screenly returned an unexpected error (400).'
    )
    expect(getRuntimeState().credentialError?.message).toBe(
      'Screenly returned an unexpected error (400).'
    )
    expect(reportError).toHaveBeenCalledTimes(1)
  })

  test('falls back to a status-based message when the error response body is not JSON', async () => {
    stubFetch(async () => ({
      status: 400,
      ok: false,
      json: async () => {
        throw new SyntaxError('Unexpected end of JSON input')
      },
    }))
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

describe('request', () => {
  test('requests the access token endpoint with the expected url and auth header', async () => {
    const fetchMock = fakeResponse(200, {
      token: 'abc',
      metadata: { instance_url: 'https://na1.salesforce.com' },
    })
    const { refreshToken } = makeManager()
    await refreshToken()

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.com/oauth/access_token/',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer app-auth',
        }),
      })
    )
  })
})
