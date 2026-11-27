# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e/screenshots.spec.ts >> screenshot dashboard 480x800
- Location: e2e/screenshots.spec.ts:484:3

# Error details

```
Error: page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
Call log:
  - navigating to "/?animations=false", waiting until "load"

```

# Test source

```ts
  340 |       RowCount: { dataType: 'int', label: 'Record Count' },
  341 |     },
  342 |     detailColumnInfo: {
  343 |       DUE_DATE: { dataType: 'date', label: 'Last Activity' },
  344 |       'USERS.NAME': { dataType: 'string', label: 'Account Owner' },
  345 |       'ACCOUNT.NAME': { dataType: 'string', label: 'Account Name' },
  346 |       ADDRESS1_STATE: {
  347 |         dataType: 'string',
  348 |         label: 'Billing State/Province (text only)',
  349 |       },
  350 |       RATING: { dataType: 'picklist', label: 'Rating' },
  351 |       LAST_UPDATE: { dataType: 'date', label: 'Last Modified Date' },
  352 |     },
  353 |   },
  354 |   reportMetadata: {
  355 |     name: 'Dummy Accounts Report #1',
  356 |     chart: {
  357 |       chartType: 'Donut',
  358 |     },
  359 |     aggregates: ['RowCount'],
  360 |     detailColumns: [
  361 |       'DUE_DATE',
  362 |       'USERS.NAME',
  363 |       'ACCOUNT.NAME',
  364 |       'ADDRESS1_STATE',
  365 |       'RATING',
  366 |       'LAST_UPDATE',
  367 |     ],
  368 |     reportFormat: 'SUMMARY',
  369 |   },
  370 | }
  371 | 
  372 | const { screenlyJsContent: dashboardScreenlyJsContent } =
  373 |   createMockScreenlyForScreenshots(
  374 |     { coordinates: MOCK_COORDINATES, location: MOCK_LOCATION },
  375 |     {
  376 |       content_id: MOCK_DASHBOARD_ID,
  377 |       refresh_interval: '300',
  378 |       display_errors: 'false',
  379 |       screenly_oauth_tokens_url: 'http://localhost:3000/',
  380 |       screenly_app_auth_token: 'mock-token',
  381 |     }
  382 |   )
  383 | 
  384 | const { screenlyJsContent: reportScreenlyJsContent } =
  385 |   createMockScreenlyForScreenshots(
  386 |     { coordinates: MOCK_COORDINATES, location: MOCK_LOCATION },
  387 |     {
  388 |       content_id: MOCK_REPORT_ID,
  389 |       refresh_interval: '300',
  390 |       display_errors: 'false',
  391 |       screenly_oauth_tokens_url: 'http://localhost:3000/',
  392 |       screenly_app_auth_token: 'mock-token',
  393 |     }
  394 |   )
  395 | 
  396 | const { screenlyJsContent: dashboardLabelsScreenlyJsContent } =
  397 |   createMockScreenlyForScreenshots(
  398 |     { coordinates: MOCK_COORDINATES, location: MOCK_LOCATION },
  399 |     {
  400 |       content_id: MOCK_DASHBOARD_ID,
  401 |       refresh_interval: '300',
  402 |       display_errors: 'false',
  403 |       show_labels: 'true',
  404 |       screenly_oauth_tokens_url: 'http://localhost:3000/',
  405 |       screenly_app_auth_token: 'mock-token',
  406 |     }
  407 |   )
  408 | 
  409 | const { screenlyJsContent: reportLabelsScreenlyJsContent } =
  410 |   createMockScreenlyForScreenshots(
  411 |     { coordinates: MOCK_COORDINATES, location: MOCK_LOCATION },
  412 |     {
  413 |       content_id: MOCK_REPORT_ID,
  414 |       refresh_interval: '300',
  415 |       display_errors: 'false',
  416 |       show_labels: 'true',
  417 |       screenly_oauth_tokens_url: 'http://localhost:3000/',
  418 |       screenly_app_auth_token: 'mock-token',
  419 |     }
  420 |   )
  421 | 
  422 | type BrowserContext = Awaited<ReturnType<Browser['newContext']>>
  423 | 
  424 | async function takeScreenshot(
  425 |   browser: Browser,
  426 |   width: number,
  427 |   height: number,
  428 |   filename: string,
  429 |   screenlyJsContent: string,
  430 |   setup: (context: BrowserContext) => Promise<void>
  431 | ): Promise<void> {
  432 |   const screenshotsDir = getScreenshotsDir()
  433 |   const context = await browser.newContext({ viewport: { width, height } })
  434 |   const page = await context.newPage()
  435 | 
  436 |   await setupClockMock(page, FIXED_SCREENSHOT_DATE)
  437 |   await setupScreenlyJsMock(page, screenlyJsContent)
  438 |   await setup(context)
  439 | 
> 440 |   await page.goto('/?animations=false')
      |              ^ Error: page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
  441 |   await page.waitForLoadState('networkidle')
  442 | 
  443 |   await page.screenshot({
  444 |     path: path.join(screenshotsDir, filename),
  445 |     fullPage: false,
  446 |   })
  447 | 
  448 |   await context.close()
  449 | }
  450 | 
  451 | function mockCredentials(context: BrowserContext): Promise<void> {
  452 |   return context.route(/access_token\//, (route) =>
  453 |     route.fulfill({
  454 |       status: 200,
  455 |       contentType: 'application/json',
  456 |       body: JSON.stringify(MOCK_CREDENTIALS),
  457 |     })
  458 |   )
  459 | }
  460 | 
  461 | async function setupDashboardRoutes(context: BrowserContext): Promise<void> {
  462 |   await mockCredentials(context)
  463 |   await context.route(/analytics\/dashboards/, (route) =>
  464 |     route.fulfill({
  465 |       status: 200,
  466 |       contentType: 'application/json',
  467 |       body: JSON.stringify(MOCK_DASHBOARD_RESPONSE),
  468 |     })
  469 |   )
  470 | }
  471 | 
  472 | async function setupReportRoutes(context: BrowserContext): Promise<void> {
  473 |   await mockCredentials(context)
  474 |   await context.route(/analytics\/reports/, (route) =>
  475 |     route.fulfill({
  476 |       status: 200,
  477 |       contentType: 'application/json',
  478 |       body: JSON.stringify(MOCK_REPORT_RESPONSE),
  479 |     })
  480 |   )
  481 | }
  482 | 
  483 | for (const { width, height } of RESOLUTIONS) {
  484 |   test(`screenshot dashboard ${width}x${height}`, async ({ browser }) => {
  485 |     await takeScreenshot(
  486 |       browser,
  487 |       width,
  488 |       height,
  489 |       `dashboard-${width}x${height}.png`,
  490 |       dashboardScreenlyJsContent,
  491 |       (context) => setupDashboardRoutes(context)
  492 |     )
  493 |   })
  494 | }
  495 | 
  496 | for (const [width, height] of [
  497 |   [1920, 1080],
  498 |   [1080, 1920],
  499 | ]) {
  500 |   test(`screenshot dashboard-labels ${width}x${height}`, async ({
  501 |     browser,
  502 |   }) => {
  503 |     await takeScreenshot(
  504 |       browser,
  505 |       width,
  506 |       height,
  507 |       `dashboard-labels-${width}x${height}.png`,
  508 |       dashboardLabelsScreenlyJsContent,
  509 |       (context) => setupDashboardRoutes(context)
  510 |     )
  511 |   })
  512 | }
  513 | 
  514 | for (const [width, height] of [
  515 |   [3840, 2160],
  516 |   [2160, 3840],
  517 | ]) {
  518 |   test(`screenshot report ${width}x${height}`, async ({ browser }) => {
  519 |     await takeScreenshot(
  520 |       browser,
  521 |       width,
  522 |       height,
  523 |       `report-${width}x${height}.png`,
  524 |       reportScreenlyJsContent,
  525 |       (context) => setupReportRoutes(context)
  526 |     )
  527 |   })
  528 | }
  529 | 
  530 | for (const [width, height] of [
  531 |   [1920, 1080],
  532 |   [1080, 1920],
  533 | ]) {
  534 |   test(`screenshot report-labels ${width}x${height}`, async ({ browser }) => {
  535 |     await takeScreenshot(
  536 |       browser,
  537 |       width,
  538 |       height,
  539 |       `report-labels-${width}x${height}.png`,
  540 |       reportLabelsScreenlyJsContent,
```