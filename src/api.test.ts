import { describe, test, expect, mock, afterEach } from 'bun:test'

mock.module('@screenly/edge-apps', () => ({
  getCorsProxyUrl: () => 'https://cors-proxy.example.com',
}))

const {
  getDashboardResults,
  getReportResults,
  triggerDashboardRefresh,
  AuthError,
} = await import('./api')
const { BackendServerError } = await import('./errors')

const INSTANCE_URL = 'https://na1.salesforce.com'
const ACCESS_TOKEN = 'abc'
const CONTENT_ID = '01Zg5000002iDwTEAU'

const originalFetch = globalThis.fetch

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

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe('getDashboardResults', () => {
  test('resolves with the parsed body on success', async () => {
    const body = { dashboardMetadata: {}, componentData: [] }
    fakeResponse(200, body)

    const result = await getDashboardResults(
      INSTANCE_URL,
      ACCESS_TOKEN,
      CONTENT_ID
    )
    expect(result).toEqual(body)
  })

  test('rejects with BackendServerError on a 5xx response', async () => {
    fakeResponse(503, {})

    await expect(
      getDashboardResults(INSTANCE_URL, ACCESS_TOKEN, CONTENT_ID)
    ).rejects.toBeInstanceOf(BackendServerError)
  })

  test('rejects with BackendServerError on a 429 response', async () => {
    fakeResponse(429, {})

    await expect(
      getDashboardResults(INSTANCE_URL, ACCESS_TOKEN, CONTENT_ID)
    ).rejects.toBeInstanceOf(BackendServerError)
  })

  test('rejects with BackendServerError when the network request itself fails', async () => {
    stubFetch(async () => {
      throw new TypeError('Failed to fetch')
    })

    await expect(
      getDashboardResults(INSTANCE_URL, ACCESS_TOKEN, CONTENT_ID)
    ).rejects.toBeInstanceOf(BackendServerError)
  })

  test('rejects with AuthError on a 401 response', async () => {
    fakeResponse(401, {})

    await expect(
      getDashboardResults(INSTANCE_URL, ACCESS_TOKEN, CONTENT_ID)
    ).rejects.toBeInstanceOf(AuthError)
  })

  test('rejects with a not-found message on a 404 response', async () => {
    fakeResponse(404, {})

    await expect(
      getDashboardResults(INSTANCE_URL, ACCESS_TOKEN, CONTENT_ID)
    ).rejects.toThrow(
      'The selected content could not be found. Please verify that it still exists in Salesforce.'
    )
  })

  test('rejects with a generic error on other non-ok responses', async () => {
    fakeResponse(400, {})

    await expect(
      getDashboardResults(INSTANCE_URL, ACCESS_TOKEN, CONTENT_ID)
    ).rejects.toThrow(/API error 400/)
  })
})

describe('getReportResults', () => {
  test('resolves with the parsed body on success', async () => {
    const body = { factMap: {} }
    fakeResponse(200, body)

    const result = await getReportResults(
      INSTANCE_URL,
      ACCESS_TOKEN,
      CONTENT_ID
    )
    expect(result).toEqual(body)
  })

  test('rejects with BackendServerError on a 5xx response', async () => {
    fakeResponse(500, {})

    await expect(
      getReportResults(INSTANCE_URL, ACCESS_TOKEN, CONTENT_ID)
    ).rejects.toBeInstanceOf(BackendServerError)
  })

  test('rejects with BackendServerError on a 429 response', async () => {
    fakeResponse(429, {})

    await expect(
      getReportResults(INSTANCE_URL, ACCESS_TOKEN, CONTENT_ID)
    ).rejects.toBeInstanceOf(BackendServerError)
  })

  test('rejects with BackendServerError when the network request itself fails', async () => {
    stubFetch(async () => {
      throw new TypeError('Failed to fetch')
    })

    await expect(
      getReportResults(INSTANCE_URL, ACCESS_TOKEN, CONTENT_ID)
    ).rejects.toBeInstanceOf(BackendServerError)
  })

  test('rejects with AuthError on a 401 response', async () => {
    fakeResponse(401, {})

    await expect(
      getReportResults(INSTANCE_URL, ACCESS_TOKEN, CONTENT_ID)
    ).rejects.toBeInstanceOf(AuthError)
  })
})

describe('triggerDashboardRefresh', () => {
  test('swallows a network failure', async () => {
    stubFetch(async () => {
      throw new TypeError('Failed to fetch')
    })

    await expect(
      triggerDashboardRefresh(INSTANCE_URL, ACCESS_TOKEN, CONTENT_ID)
    ).resolves.toBeUndefined()
  })

  test('sends a PUT request to the dashboard path', async () => {
    const fetchMock = fakeResponse(200, {})

    await triggerDashboardRefresh(INSTANCE_URL, ACCESS_TOKEN, CONTENT_ID)

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(`/analytics/dashboards/${CONTENT_ID}`),
      expect.objectContaining({ method: 'PUT' })
    )
  })
})
