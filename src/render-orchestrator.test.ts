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
    const context = makeContext()

    await render(context)

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
    const context = makeContext({ displayErrors: false })

    await render(context)

    expect(renderDashboard).toHaveBeenCalled()
  })

  test('throws an error on a backend outage with no cache hit', async () => {
    getDashboardResults.mockImplementationOnce(async () => {
      throw new BackendServerError('down')
    })
    readCachedContent.mockReturnValue(null)
    const context = makeContext({ displayErrors: false })

    await expect(render(context)).rejects.toThrow('No cached content found.')

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
    const context = makeContext({ displayErrors: true })

    await expect(render(context)).rejects.toThrow('down')

    expect(readCachedContent).not.toHaveBeenCalled()
  })

  test('renders from cache on an error when display_errors is off', async () => {
    getDashboardResults.mockImplementationOnce(async () => {
      throw new Error('some unrelated failure')
    })
    readCachedContent.mockReturnValue({
      dashboardMetadata: { name: 'Cached', id: 'abc', components: [] },
      componentData: [],
    })
    const context = makeContext({ displayErrors: false })

    await render(context)

    expect(renderDashboard).toHaveBeenCalled()
  })
})
