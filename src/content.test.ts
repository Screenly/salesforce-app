import '@screenly/edge-apps/test'
import { describe, test, expect, mock, beforeEach, afterEach } from 'bun:test'
import { setupScreenlyMock, resetScreenlyMock } from '@screenly/edge-apps/test'

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

const renderContent = mock(() => {})
mock.module('./templates', () => ({
  renderContent,
}))

const { refresh, inferSalesforceContentType } = await import('./content')

afterEach(() => {
  resetScreenlyMock()
})

describe('inferSalesforceContentType', () => {
  test('returns dashboard for 01Z prefix', () => {
    setupScreenlyMock({}, { content_id: '01Zg5000002iDwTEAU' })
    expect(inferSalesforceContentType()).toBe('dashboard')
  })

  test('returns report for 00O prefix', () => {
    setupScreenlyMock({}, { content_id: '00Og5000004NOlhEAG' })
    expect(inferSalesforceContentType()).toBe('report')
  })

  test('is case-insensitive', () => {
    setupScreenlyMock({}, { content_id: '01zg5000002iDwTEAU' })
    expect(inferSalesforceContentType()).toBe('dashboard')
  })

  test('throws for unsupported prefix', () => {
    setupScreenlyMock({}, { content_id: 'ABC123' })
    expect(() => inferSalesforceContentType()).toThrow()
  })
})

const CONTENT_ID = '01Zg5000002iDwTEAU'
const CONTENT_TYPE = 'dashboard'
const ACCESS_TOKEN = 'abc'
const INSTANCE_URL = 'https://na1.salesforce.com'

function getRuntimeState() {
  return {
    accessToken: ACCESS_TOKEN,
    instanceUrl: INSTANCE_URL,
    credentialError: null,
  }
}

beforeEach(() => {
  setupScreenlyMock({}, { content_id: CONTENT_ID })
  readCachedContent.mockClear()
  readCachedContent.mockReturnValue(null)
  writeCachedContent.mockClear()
  getDashboardResults.mockClear()
  getReportResults.mockClear()
  triggerDashboardRefresh.mockClear()
  renderContent.mockClear()
})

describe('render success', () => {
  test('renders live content and writes it to cache on success', async () => {
    await refresh(getRuntimeState)

    expect(writeCachedContent).toHaveBeenCalledWith(
      CONTENT_TYPE,
      CONTENT_ID,
      expect.objectContaining({ dashboardMetadata: expect.anything() })
    )
    expect(renderContent).toHaveBeenCalledWith(
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

    await expect(refresh(getRuntimeState)).rejects.toThrow(
      'No cached content found.'
    )

    expect(renderContent).not.toHaveBeenCalled()
  })

  test('shows the error instead of using the cache when display_errors is on', async () => {
    setupScreenlyMock({}, { content_id: CONTENT_ID, display_errors: 'true' })
    getDashboardResults.mockImplementationOnce(async () => {
      throw new Error('down')
    })
    readCachedContent.mockReturnValue({
      dashboardMetadata: { name: 'Cached', id: 'abc', components: [] },
      componentData: [],
    })

    await expect(refresh(getRuntimeState)).rejects.toThrow('down')

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

    await refresh(getRuntimeState)

    expect(renderContent).toHaveBeenCalledWith(
      expect.objectContaining({ contentType: 'dashboard' })
    )
  })
})
