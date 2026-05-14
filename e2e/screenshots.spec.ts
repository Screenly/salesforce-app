import { test, type Browser } from '@playwright/test'
import {
  createMockScreenlyForScreenshots,
  FIXED_SCREENSHOT_DATE,
  getScreenshotsDir,
  RESOLUTIONS,
  setupClockMock,
  setupScreenlyJsMock,
} from '@screenly/edge-apps/test/screenshots'
import path from 'path'

const MOCK_INSTANCE_URL = 'https://mock.salesforce.com'
const MOCK_DASHBOARD_ID = '01Z000000000001AAA'
const MOCK_CLIENT_ID = 'mock-client-id'

const MOCK_AUTH = {
  access_token: 'mock-access-token',
  refresh_token: 'mock-refresh-token',
  instance_url: MOCK_INSTANCE_URL,
}

const SUMMARY_REPORT_RESULT = {
  factMap: {
    '0!T': { aggregates: [{ label: '42', value: 42 }] },
    '1!T': { aggregates: [{ label: '85', value: 85 }] },
    '2!T': { aggregates: [{ label: '31', value: 31 }] },
    'T!T': { aggregates: [{ label: '158', value: 158 }] },
  },
  groupingsDown: {
    groupings: [
      { key: '0', label: 'Prospect' },
      { key: '1', label: 'Customer - Direct' },
      { key: '2', label: 'Partner' },
    ],
  },
  groupingsAcross: { groupings: [] },
  reportExtendedMetadata: {
    aggregateColumnInfo: { RowCount: { dataType: 'int', label: 'Record Count' } },
    detailColumnInfo: {},
  },
  reportMetadata: { aggregates: ['RowCount'], detailColumns: [] },
}

const MOCK_DASHBOARD_RESPONSE = {
  componentData: [
    {
      componentId: 'comp-bar',
      reportResult: SUMMARY_REPORT_RESULT,
      status: { componentDataStatus: 'DATA', refreshStatus: 'IDLE' },
    },
    {
      componentId: 'comp-donut',
      reportResult: SUMMARY_REPORT_RESULT,
      status: { componentDataStatus: 'DATA', refreshStatus: 'IDLE' },
    },
    {
      componentId: 'comp-line',
      reportResult: {
        factMap: {
          '0!T': { aggregates: [{ label: '52000', value: 52000 }] },
          '1!T': { aggregates: [{ label: '61000', value: 61000 }] },
          '2!T': { aggregates: [{ label: '47000', value: 47000 }] },
          '3!T': { aggregates: [{ label: '73000', value: 73000 }] },
          '4!T': { aggregates: [{ label: '88000', value: 88000 }] },
          '5!T': { aggregates: [{ label: '95000', value: 95000 }] },
          'T!T': { aggregates: [{ label: '416000', value: 416000 }] },
        },
        groupingsDown: {
          groupings: [
            { key: '0', label: 'Jan' },
            { key: '1', label: 'Feb' },
            { key: '2', label: 'Mar' },
            { key: '3', label: 'Apr' },
            { key: '4', label: 'May' },
            { key: '5', label: 'Jun' },
          ],
        },
        groupingsAcross: { groupings: [] },
        reportExtendedMetadata: {
          aggregateColumnInfo: { SUM_AMOUNT: { dataType: 'currency', label: 'Amount' } },
          detailColumnInfo: {},
        },
        reportMetadata: { aggregates: ['SUM_AMOUNT'], detailColumns: [] },
      },
      status: { componentDataStatus: 'DATA', refreshStatus: 'IDLE' },
    },
    {
      componentId: 'comp-table',
      reportResult: {
        factMap: {
          'T!T': {
            aggregates: [{ label: '2', value: 2 }],
            rows: [
              {
                dataCells: [
                  { label: 'Acme Corp', value: '001000000000001' },
                  { label: 'Alice Smith', value: '005000000000001' },
                  { label: 'Hot', value: 'Hot' },
                ],
              },
              {
                dataCells: [
                  { label: 'Globex Inc', value: '001000000000002' },
                  { label: 'Bob Jones', value: '005000000000002' },
                  { label: 'Warm', value: 'Warm' },
                ],
              },
            ],
          },
        },
        groupingsDown: { groupings: [] },
        groupingsAcross: { groupings: [] },
        reportExtendedMetadata: {
          aggregateColumnInfo: {},
          detailColumnInfo: {
            'ACCOUNT.NAME': { label: 'Account Name', dataType: 'string' },
            'USERS.NAME': { label: 'Account Owner', dataType: 'string' },
            RATING: { label: 'Rating', dataType: 'picklist' },
          },
        },
        reportMetadata: {
          aggregates: [],
          detailColumns: ['ACCOUNT.NAME', 'USERS.NAME', 'RATING'],
        },
      },
      status: { componentDataStatus: 'DATA', refreshStatus: 'IDLE' },
    },
  ],
  dashboardMetadata: {
    name: 'Mock Dashboard',
    id: MOCK_DASHBOARD_ID,
    components: [
      {
        id: 'comp-bar',
        componentData: 0,
        header: 'Accounts by Type',
        title: null,
        reportId: '00O000000000001',
        type: 'Report',
        properties: {
          visualizationType: 'Bar',
          visualizationProperties: {},
          aggregates: [{ name: 'RowCount' }],
          groupings: [{ name: 'TYPE' }],
        },
      },
      {
        id: 'comp-donut',
        componentData: 1,
        header: 'Account Mix',
        title: null,
        reportId: '00O000000000001',
        type: 'Report',
        properties: {
          visualizationType: 'Donut',
          visualizationProperties: {},
          aggregates: [{ name: 'RowCount' }],
          groupings: [{ name: 'TYPE' }],
        },
      },
      {
        id: 'comp-line',
        componentData: 2,
        header: 'Monthly Revenue',
        title: null,
        reportId: '00O000000000003',
        type: 'Report',
        properties: {
          visualizationType: 'Line',
          visualizationProperties: {},
          aggregates: [{ name: 'SUM_AMOUNT' }],
          groupings: [{ name: 'CLOSE_DATE' }],
        },
      },
      {
        id: 'comp-table',
        componentData: 3,
        header: 'Account List',
        title: null,
        reportId: '00O000000000002',
        type: 'Report',
        properties: {
          visualizationType: 'FlexTable',
          visualizationProperties: {
            flexTableType: 'tabular',
            tableColumns: [
              { column: 'ACCOUNT.NAME', type: 'detail' },
              { column: 'USERS.NAME', type: 'detail' },
              { column: 'RATING', type: 'detail' },
            ],
          },
          aggregates: [],
          groupings: [],
        },
      },
    ],
    layout: {
      components: [
        { column: 0, row: 0, colspan: 4, rowspan: 8 },
        { column: 4, row: 0, colspan: 4, rowspan: 8 },
        { column: 8, row: 0, colspan: 4, rowspan: 8 },
        { column: 0, row: 8, colspan: 12, rowspan: 6 },
      ],
      numColumns: 12,
      rowHeight: 36,
      gridLayout: true,
    },
  },
}

const { screenlyJsContent } = createMockScreenlyForScreenshots(
  { coordinates: [37.3861, -122.0839], location: 'Silicon Valley, USA' },
  {
    client_id: MOCK_CLIENT_ID,
    dashboard_id: MOCK_DASHBOARD_ID,
    refresh_interval: '300',
    display_errors: 'false',
  }
)

async function takeScreenshot(
  browser: Browser,
  width: number,
  height: number,
  filename: string,
  setup: (context: Awaited<ReturnType<Browser['newContext']>>) => Promise<void>,
  waitFor: (page: Awaited<ReturnType<Awaited<ReturnType<Browser['newContext']>>['newPage']>>) => Promise<void>
): Promise<void> {
  const screenshotsDir = getScreenshotsDir()
  const context = await browser.newContext({ viewport: { width, height } })
  const page = await context.newPage()

  await setupClockMock(page, FIXED_SCREENSHOT_DATE)
  await setupScreenlyJsMock(page, screenlyJsContent)
  await setup(context)

  await page.goto('/?animations=false')
  await waitFor(page)

  await page.screenshot({
    path: path.join(screenshotsDir, filename),
    fullPage: false,
  })

  await context.close()
}

const AUTH_RESOLUTIONS = [
  { width: 3840, height: 2160 },
  { width: 2160, height: 3840 },
]

for (const { width, height } of AUTH_RESOLUTIONS) {
  test(`screenshot auth ${width}x${height}`, async ({ browser }) => {
    await takeScreenshot(
      browser,
      width,
      height,
      `auth-${width}x${height}.png`,
      async (context) => {
        await context.route(/oauth2\/token/, async (route) => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              device_code: 'mock-device-code',
              user_code: 'MOCK1234',
              verification_uri: 'https://login.salesforce.com/setup/connect',
              interval: 5,
              expires_in: 1800,
            }),
          })
        })
      },
      async (page) => {
        await page.waitForSelector('#auth-screen', { state: 'visible' })
      }
    )
  })
}

for (const { width, height } of RESOLUTIONS) {
  test(`screenshot ${width}x${height}`, async ({ browser }) => {
    await takeScreenshot(
      browser,
      width,
      height,
      `${width}x${height}.png`,
      async (context) => {
        await context.addInitScript((auth) => {
          localStorage.setItem('salesforce_auth', JSON.stringify(auth))
        }, MOCK_AUTH)
        await context.route(/analytics\/dashboards/, async (route) => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(MOCK_DASHBOARD_RESPONSE),
          })
        })
      },
      async (page) => {
        await page.waitForLoadState('networkidle')
      }
    )
  })
}
