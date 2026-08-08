import '@screenly/edge-apps/test'
import {
  describe,
  test,
  expect,
  mock,
  beforeEach,
  afterEach,
  spyOn,
} from 'bun:test'
import { setupScreenlyMock, resetScreenlyMock } from '@screenly/edge-apps/test'
import * as utils from '@screenly/edge-apps/utils'

const readEdgeAppCache = spyOn(utils, 'readEdgeAppCache').mockReturnValue(null)
const writeEdgeAppCache = spyOn(utils, 'writeEdgeAppCache').mockImplementation(
  () => {}
)
const reportError = spyOn(utils, 'reportError').mockImplementation(() => {})

const CACHE_NAMESPACE = 'salesforce-edge-app:v1'

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
}))

const renderSalesforceContent = mock(() => {})
mock.module('./templates', () => ({
  renderSalesforceContent,
}))

const ACCESS_TOKEN = 'abc'
const INSTANCE_URL = 'https://na1.salesforce.com'

const refreshToken = mock(async () => {})
const getRuntimeState = mock(() => ({
  accessToken: ACCESS_TOKEN as string | null,
  instanceUrl: INSTANCE_URL as string | null,
  credentialError: null as Error | null,
}))
mock.module('./credentials', () => ({
  CACHE_NAMESPACE,
  refreshToken,
  getRuntimeState,
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

beforeEach(() => {
  setupScreenlyMock({}, { content_id: CONTENT_ID })
  readEdgeAppCache.mockClear()
  readEdgeAppCache.mockReturnValue(null)
  writeEdgeAppCache.mockClear()
  getDashboardResults.mockClear()
  getReportResults.mockClear()
  triggerDashboardRefresh.mockClear()
  renderSalesforceContent.mockClear()
  reportError.mockClear()
  refreshToken.mockClear()
  getRuntimeState.mockClear()
  getRuntimeState.mockReturnValue({
    accessToken: ACCESS_TOKEN,
    instanceUrl: INSTANCE_URL,
    credentialError: null,
  })
})

describe('render success', () => {
  test('renders live content and writes it to cache on success', async () => {
    await refresh()

    expect(writeEdgeAppCache).toHaveBeenCalledWith(
      CACHE_NAMESPACE,
      `content:${CONTENT_TYPE}:${CONTENT_ID}`,
      expect.objectContaining({ dashboardMetadata: expect.anything() })
    )
    expect(renderSalesforceContent).toHaveBeenCalledWith(
      expect.objectContaining({ contentType: 'dashboard' })
    )
  })
})

describe('render content failover', () => {
  test('throws an error when there is no cache hit', async () => {
    getDashboardResults.mockImplementationOnce(async () => {
      throw new Error('down')
    })
    readEdgeAppCache.mockReturnValue(null)

    await expect(refresh()).rejects.toThrow('No cached content found.')

    expect(renderSalesforceContent).not.toHaveBeenCalled()
    expect(reportError).toHaveBeenCalledWith(
      new Error('down'),
      expect.objectContaining({
        source: 'salesforce-content',
        contentId: CONTENT_ID,
        contentType: CONTENT_TYPE,
      })
    )
  })

  test('shows the error instead of using the cache when display_errors is on', async () => {
    setupScreenlyMock({}, { content_id: CONTENT_ID, display_errors: 'true' })
    getDashboardResults.mockImplementationOnce(async () => {
      throw new Error('down')
    })
    readEdgeAppCache.mockReturnValue({
      dashboardMetadata: { name: 'Cached', id: 'abc', components: [] },
      componentData: [],
    })

    await expect(refresh()).rejects.toThrow('down')

    expect(readEdgeAppCache).not.toHaveBeenCalled()
  })

  test('renders from cache on an error when display_errors is off', async () => {
    getDashboardResults.mockImplementationOnce(async () => {
      throw new Error('some unrelated failure')
    })
    readEdgeAppCache.mockReturnValue({
      dashboardMetadata: { name: 'Cached', id: 'abc', components: [] },
      componentData: [],
    })

    await refresh()

    expect(renderSalesforceContent).toHaveBeenCalledWith(
      expect.objectContaining({ contentType: 'dashboard' })
    )
  })
})
