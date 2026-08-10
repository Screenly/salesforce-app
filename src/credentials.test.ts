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
const readEdgeAppCache = spyOn(utils, 'readEdgeAppCache').mockReturnValue(null)
const writeEdgeAppCache = spyOn(utils, 'writeEdgeAppCache').mockImplementation(
  () => {}
)

const BASE_SETTINGS = {
  screenly_oauth_tokens_url: 'https://api.example.com/oauth/',
  screenly_app_auth_token: 'app-auth',
}

setupScreenlyMock({}, BASE_SETTINGS)

const {
  refreshToken,
  salesforceConnectionState,
  NO_CREDENTIALS_MESSAGE,
  CACHE_NAMESPACE,
  ScreenlyBackendError,
} = await import('./credentials')

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
  return fakeResponse(200, {
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
  setupScreenlyMock({}, BASE_SETTINGS)
  salesforceConnectionState.accessToken = ''
  salesforceConnectionState.instanceUrl = ''
  salesforceConnectionState.credentialError = null
  reportError.mockClear()
  readEdgeAppCache.mockClear()
  readEdgeAppCache.mockReturnValue(null)
  writeEdgeAppCache.mockClear()
})

afterEach(() => {
  globalThis.fetch = originalFetch
  resetScreenlyMock()
})

describe('credential caching before any successful refresh', () => {
  test('does not consult the cache when display_errors is on', async () => {
    setupScreenlyMock({}, { ...BASE_SETTINGS, display_errors: 'true' })
    salesforceConnectionState.accessToken = 'preexisting-token'
    salesforceConnectionState.instanceUrl = 'https://preexisting.salesforce.com'
    readEdgeAppCache.mockReturnValue({
      accessToken: 'cached-token',
      instanceUrl: 'https://cached.salesforce.com',
    })
    failWithNetworkError('network down')

    await expect(refreshToken()).rejects.toThrow(
      "Screenly's server could not be reached"
    )

    expect(readEdgeAppCache).not.toHaveBeenCalled()
    expect(salesforceConnectionState.accessToken).toBe('preexisting-token')
    expect(salesforceConnectionState.instanceUrl).toBe(
      'https://preexisting.salesforce.com'
    )
  })

  test('repopulates from cache once, then stops re-reading once an instance url is set', async () => {
    readEdgeAppCache.mockReturnValue({
      accessToken: 'cached-token',
      instanceUrl: 'https://cached.salesforce.com',
    })
    failWithNetworkError('network down')

    await refreshToken()
    expect(readEdgeAppCache).toHaveBeenCalledWith(
      CACHE_NAMESPACE,
      'credentials'
    )
    expect(readEdgeAppCache).toHaveBeenCalledTimes(1)
    expect(salesforceConnectionState.accessToken).toBe('cached-token')
    expect(salesforceConnectionState.instanceUrl).toBe(
      'https://cached.salesforce.com'
    )

    await expect(refreshToken()).rejects.toThrow(
      "Screenly's server could not be reached"
    )
    expect(readEdgeAppCache).toHaveBeenCalledTimes(1)
  })
})

describe('successful refresh', () => {
  test('stores the access token and instance url, and writes it to cache', async () => {
    succeed()
    await refreshToken()

    expect(salesforceConnectionState).toEqual({
      accessToken: 'abc',
      instanceUrl: 'https://na1.salesforce.com',
      credentialError: null,
    })
    expect(reportError).not.toHaveBeenCalled()
    expect(writeEdgeAppCache).toHaveBeenCalledWith(
      CACHE_NAMESPACE,
      'credentials',
      { accessToken: 'abc', instanceUrl: 'https://na1.salesforce.com' }
    )
  })

  test('requests the access token endpoint with the expected url and auth header', async () => {
    const fetchMock = succeed()

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

describe('failed refresh once a session is established', () => {
  beforeEach(async () => {
    succeed()
    await refreshToken()
    reportError.mockClear()
  })

  test('reports every failure, not just the first', async () => {
    failWithNetworkError('network down')

    await expect(refreshToken()).rejects.toThrow('network down')
    await expect(refreshToken()).rejects.toThrow('network down')

    expect(reportError).toHaveBeenCalledTimes(2)
  })

  async function expectRefreshFailure(message: string) {
    await expect(refreshToken()).rejects.toThrow(message)
    expect(salesforceConnectionState.credentialError?.message).toBe(message)
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

  test('wraps a network failure in a BackendError with the original error as its cause', async () => {
    const networkFailure = new TypeError('Failed to fetch')
    stubFetch(async () => {
      throw networkFailure
    })

    await expect(refreshToken()).rejects.toThrow(networkFailure.message)

    const { credentialError } = salesforceConnectionState
    expect(credentialError).toBeInstanceOf(ScreenlyBackendError)
    expect(credentialError?.cause).toBe(networkFailure)
  })

  test('throws on a 429 response', async () => {
    fakeResponse(429, undefined)

    await expectRefreshFailure("Screenly's server had a problem (429).")
  })

  test('throws and reports when the backend responds without a token', async () => {
    fakeResponse(200, { token: '', metadata: undefined })

    await expectRefreshFailure(NO_CREDENTIALS_MESSAGE)
  })

  test('surfaces the backend-provided reason for a non-5xx error response', async () => {
    fakeResponse(400, { error: 'Salesforce integration is not connected' })

    await expectRefreshFailure('Salesforce integration is not connected')
  })

  test('falls back to a status-based message when the backend error is not a string', async () => {
    fakeResponse(400, {
      error: { message: 'Salesforce integration is not connected' },
    })

    await expectRefreshFailure('Screenly returned an unexpected error (400).')
  })

  test('falls back to a status-based message when the error response body is not JSON', async () => {
    stubFetch(async () => ({
      status: 400,
      ok: false,
      json: async () => {
        throw new SyntaxError('Unexpected end of JSON input')
      },
    }))

    await expectRefreshFailure('Screenly returned an unexpected error (400).')
  })
})
