import { describe, test, expect, mock, beforeEach } from 'bun:test'

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

const showContent = mock(() => {})
mock.module('./render', () => ({
  showContent,
}))

const { render, inferSalesforceContentType } = await import('./content')

describe('inferSalesforceContentType', () => {
  test('returns dashboard for 01Z prefix', () => {
    expect(inferSalesforceContentType('01Zg5000002iDwTEAU')).toBe('dashboard')
  })

  test('returns report for 00O prefix', () => {
    expect(inferSalesforceContentType('00Og5000004NOlhEAG')).toBe('report')
  })

  test('is case-insensitive', () => {
    expect(inferSalesforceContentType('01zg5000002iDwTEAU')).toBe('dashboard')
  })

  test('throws for unsupported prefix', () => {
    expect(() => inferSalesforceContentType('ABC123')).toThrow()
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
  showContent.mockClear()
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
    expect(showContent).toHaveBeenCalledWith(
      expect.objectContaining({ contentType: 'dashboard' })
    )
  })
})

describe('render content failover', () => {
  test('throws an error when there is no cache hit', async () => {
    getDashboardResults.mockImplementationOnce(async () => {
      throw new Error('down')
    })
    readCachedContent.mockReturnValue(null)
    const context = makeContext({ displayErrors: false })

    await expect(render(context)).rejects.toThrow('No cached content found.')

    expect(showContent).not.toHaveBeenCalled()
  })

  test('shows the error instead of using the cache when display_errors is on', async () => {
    getDashboardResults.mockImplementationOnce(async () => {
      throw new Error('down')
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

    expect(showContent).toHaveBeenCalledWith(
      expect.objectContaining({ contentType: 'dashboard' })
    )
  })
})
