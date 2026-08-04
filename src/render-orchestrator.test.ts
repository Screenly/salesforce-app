import { describe, test, expect, mock, beforeEach } from 'bun:test'

mock.module('@screenly/edge-apps', () => ({
  getSettingWithDefault: (_key: string, defaultValue: unknown) => defaultValue,
  getCorsProxyUrl: () => 'https://cors-proxy.example.com',
}))
mock.module('@screenly/edge-apps/utils', () => ({ reportError: () => {} }))

const readCachedContent = mock(() => null as unknown)
const writeCachedContent = mock(() => {})
mock.module('./cache', () => ({
  readCachedContent,
  writeCachedContent,
}))

const getDashboardResults = mock(async () => ({
  dashboardMetadata: { name: 'Dashboard', id: 'abc', components: [] },
  componentData: [],
}))
const getReportResults = mock(async () => ({ factMap: {} }))
const triggerDashboardRefresh = mock(async () => {})
mock.module('./api', () => ({
  getDashboardResults,
  getReportResults,
  triggerDashboardRefresh,
  AuthError: class AuthError extends Error {},
}))

const renderDashboard = mock(() => {})
const renderReport = mock(() => {})
const showScreen = mock(() => {})
mock.module('./render', () => ({
  renderDashboard,
  renderReport,
  showScreen,
}))

const { BackendServerError } = await import('./errors')
const { render, shouldSkipBackendError } = await import('./render-orchestrator')
const { AuthError } = await import('./api')

describe('shouldSkipBackendError', () => {
  test('skips a backend outage when display_errors is off', () => {
    expect(shouldSkipBackendError(new BackendServerError('boom'), false)).toBe(
      true
    )
  })

  test('does not skip a backend outage when display_errors is on', () => {
    expect(shouldSkipBackendError(new BackendServerError('boom'), true)).toBe(
      false
    )
  })

  test('does not skip a non-backend error', () => {
    expect(shouldSkipBackendError(new Error('not connected'), false)).toBe(
      false
    )
  })
})

const CONTENT_ID = '01Zg5000002iDwTEAU'
const CONTENT_TYPE = 'dashboard'
const ACCESS_TOKEN = 'abc'
const INSTANCE_URL = 'https://na1.salesforce.com'

function makeContext(overrides: Partial<Parameters<typeof render>[0]> = {}) {
  return {
    contentId: CONTENT_ID,
    contentType: CONTENT_TYPE,
    getRuntimeState: () => ({
      accessToken: ACCESS_TOKEN,
      instanceUrl: INSTANCE_URL,
      credentialError: null,
    }),
    refreshToken: async () => {},
    displayErrors: false,
    showLabels: false,
    ...overrides,
  }
}

beforeEach(() => {
  readCachedContent.mockClear()
  readCachedContent.mockReturnValue(null)
  writeCachedContent.mockClear()
  getDashboardResults.mockClear()
  getReportResults.mockClear()
  triggerDashboardRefresh.mockClear()
  renderDashboard.mockClear()
  renderReport.mockClear()
  showScreen.mockClear()
})

describe('render success', () => {
  test('renders live content and writes it to cache on success', async () => {
    const ctx = makeContext()

    const outcome = await render(ctx)

    expect(outcome).toBe('shown')
    expect(writeCachedContent).toHaveBeenCalledWith(
      CONTENT_TYPE,
      CONTENT_ID,
      expect.objectContaining({ dashboardMetadata: expect.anything() })
    )
    expect(renderDashboard).toHaveBeenCalled()
  })
})

describe('render content failover', () => {
  test('renders from cache and returns shown on a backend outage with a cache hit', async () => {
    getDashboardResults.mockImplementationOnce(async () => {
      throw new BackendServerError('down')
    })
    readCachedContent.mockReturnValue({
      dashboardMetadata: { name: 'Cached', id: 'abc', components: [] },
      componentData: [],
    })
    const ctx = makeContext({ displayErrors: false })

    const outcome = await render(ctx)

    expect(outcome).toBe('shown')
    expect(renderDashboard).toHaveBeenCalled()
  })

  test('returns skipped on a backend outage with no cache hit', async () => {
    getDashboardResults.mockImplementationOnce(async () => {
      throw new BackendServerError('down')
    })
    readCachedContent.mockReturnValue(null)
    const ctx = makeContext({ displayErrors: false })

    const outcome = await render(ctx)

    expect(outcome).toBe('skipped')
    expect(renderDashboard).not.toHaveBeenCalled()
  })

  test('shows the error instead of using the cache when display_errors is on', async () => {
    getDashboardResults.mockImplementationOnce(async () => {
      throw new BackendServerError('down')
    })
    readCachedContent.mockReturnValue({
      dashboardMetadata: { name: 'Cached', id: 'abc', components: [] },
      componentData: [],
    })
    const ctx = makeContext({ displayErrors: true })

    await expect(render(ctx)).rejects.toThrow('down')

    expect(readCachedContent).not.toHaveBeenCalled()
  })

  test('shows the error instead of using the cache for a non-backend error', async () => {
    getDashboardResults.mockImplementationOnce(async () => {
      throw new Error('some unrelated failure')
    })
    readCachedContent.mockReturnValue({
      dashboardMetadata: { name: 'Cached', id: 'abc', components: [] },
      componentData: [],
    })
    const ctx = makeContext({ displayErrors: false })

    await expect(render(ctx)).rejects.toThrow('some unrelated failure')

    expect(readCachedContent).not.toHaveBeenCalled()
  })
})

describe('render credential retry failover', () => {
  test('recovers via cache-populated credentials on an AuthError retry and returns shown', async () => {
    getDashboardResults.mockImplementationOnce(async () => {
      throw new AuthError('unauthorized')
    })

    // Credentials are present for the initial attempt; the retry's
    // refreshToken call fails, but the runtime state has already been
    // repopulated from cache (as credentials.ts's applyFailedRefresh does),
    // so the retry should proceed to render rather than abort.
    const ctx = makeContext({
      getRuntimeState: () => ({
        accessToken: ACCESS_TOKEN,
        instanceUrl: INSTANCE_URL,
        credentialError: null,
      }),
      refreshToken: async () => {
        throw new BackendServerError('down')
      },
    })

    const outcome = await render(ctx)

    expect(outcome).toBe('shown')
  })

  test('returns skipped on the AuthError retry path with no cached credentials', async () => {
    getDashboardResults.mockImplementationOnce(async () => {
      throw new AuthError('unauthorized')
    })

    let callCount = 0
    const ctx = makeContext({
      getRuntimeState: () => {
        callCount += 1
        // First call (the initial credentials check) succeeds so the
        // content fetch is attempted at all; subsequent calls (during the
        // retry) simulate no cached credentials being available.
        if (callCount === 1) {
          return {
            accessToken: ACCESS_TOKEN,
            instanceUrl: INSTANCE_URL,
            credentialError: null,
          }
        }
        return { accessToken: null, instanceUrl: null, credentialError: null }
      },
      refreshToken: async () => {
        throw new BackendServerError('down')
      },
    })

    const outcome = await render(ctx)

    expect(outcome).toBe('skipped')
  })
})
