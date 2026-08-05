import '@screenly/edge-apps/test'
import {
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
  mock,
  spyOn,
} from 'bun:test'
import { setupScreenlyMock, resetScreenlyMock } from '@screenly/edge-apps/test'
import * as utils from '@screenly/edge-apps/utils'

const reportError = spyOn(utils, 'reportError').mockImplementation(() => {})

const readCachedCredentials = mock(
  () => null as { accessToken: string; instanceUrl: string } | null
)
const writeCachedCredentials = mock(() => {})
mock.module('./cache', () => ({
  readCachedCredentials,
  writeCachedCredentials,
}))

const { createCredentialManager, NO_CREDENTIALS_MESSAGE } =
  await import('./credentials')

const CONTENT_ID = '01Zg5000002iDwTEAU'
const CONTENT_TYPE = 'dashboard'

function makeManager(displayErrors = false) {
  return createCredentialManager(CONTENT_TYPE, displayErrors)
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
  setupScreenlyMock(
    {},
    {
      content_id: CONTENT_ID,
      screenly_oauth_tokens_url: 'https://api.example.com/oauth/',
      screenly_app_auth_token: 'app-auth',
    }
  )
  reportError.mockClear()
  readCachedCredentials.mockClear()
  readCachedCredentials.mockReturnValue(null)
  writeCachedCredentials.mockClear()
})

afterEach(() => {
  globalThis.fetch = originalFetch
  resetScreenlyMock()
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

describe('network and server errors', () => {
  async function expectRefreshFailure(message: string) {
    const { refreshToken, getRuntimeState } = makeManager()

    await expect(refreshToken()).rejects.toThrow(message)
    expect(getRuntimeState().credentialError?.message).toBe(message)
    expect(reportError).toHaveBeenCalledTimes(1)
  }

  test('throws on a 5xx response, without parsing the body', async () => {
    const json = mock(async () => ({}))
    stubFetch(async () => ({ status: 503, ok: false, json }))

    await expectRefreshFailure("Screenly's server had a problem (503).")
    expect(json).not.toHaveBeenCalled()
  })

  test('throws when the network request itself fails', async () => {
    stubFetch(async () => {
      throw new TypeError('Failed to fetch')
    })

    await expectRefreshFailure(
      "Screenly's server could not be reached (Failed to fetch)."
    )
  })

  test('throws on a 429 response', async () => {
    fakeResponse(429, undefined)

    await expectRefreshFailure("Screenly's server had a problem (429).")
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

describe('credential caching', () => {
  test('writes the fresh credentials to cache on a successful refresh', async () => {
    succeed()
    const { refreshToken } = makeManager()
    await refreshToken()

    expect(writeCachedCredentials).toHaveBeenCalledWith({
      accessToken: 'abc',
      instanceUrl: 'https://na1.salesforce.com',
    })
  })

  test('repopulates state from cache when a refresh fails and display_errors is off', async () => {
    readCachedCredentials.mockReturnValue({
      accessToken: 'cached-token',
      instanceUrl: 'https://cached.salesforce.com',
    })
    failWithNetworkError('network down')
    const { refreshToken, getRuntimeState } = makeManager(false)

    await expect(refreshToken()).rejects.toThrow(
      "Screenly's server could not be reached"
    )

    expect(getRuntimeState().accessToken).toBe('cached-token')
    expect(getRuntimeState().instanceUrl).toBe('https://cached.salesforce.com')
  })

  test('does not consult the cache when display_errors is on', async () => {
    readCachedCredentials.mockReturnValue({
      accessToken: 'cached-token',
      instanceUrl: 'https://cached.salesforce.com',
    })
    failWithNetworkError('network down')
    const { refreshToken, getRuntimeState } = makeManager(true)

    await expect(refreshToken()).rejects.toThrow(
      "Screenly's server could not be reached"
    )

    expect(readCachedCredentials).not.toHaveBeenCalled()
    expect(getRuntimeState().accessToken).toBeNull()
    expect(getRuntimeState().instanceUrl).toBeNull()
  })

  test('does not re-read the cache once state already has an instance url', async () => {
    readCachedCredentials.mockReturnValue({
      accessToken: 'cached-token',
      instanceUrl: 'https://cached.salesforce.com',
    })
    failWithNetworkError('network down')
    const { refreshToken } = makeManager(false)

    await expect(refreshToken()).rejects.toThrow(
      "Screenly's server could not be reached"
    )
    expect(readCachedCredentials).toHaveBeenCalledTimes(1)

    await expect(refreshToken()).rejects.toThrow(
      "Screenly's server could not be reached"
    )
    expect(readCachedCredentials).toHaveBeenCalledTimes(1)
  })
})
