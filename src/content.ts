import { reportError } from '@screenly/edge-apps/utils'
import {
  getDashboardResults,
  getReportResults,
  triggerDashboardRefresh,
} from './api'
import { readCachedContent, writeCachedContent } from './cache'
import type { RuntimeState } from './credentials'
import { showContent, type ContentToRender } from './render'
import type {
  DashboardResults,
  ReportResult,
  SalesforceContentType,
} from './types'

const DASHBOARD_PREFIX = '01Z'
const REPORT_PREFIX = '00O'

// https://help.salesforce.com/s/articleView?id=000386286&type=1
export function inferSalesforceContentType(
  contentId: string
): SalesforceContentType {
  const normalizedId = contentId.trim().toUpperCase()
  const prefix = normalizedId.slice(0, 3)

  if (prefix === DASHBOARD_PREFIX) return 'dashboard'
  if (prefix === REPORT_PREFIX) return 'report'

  throw new Error(
    `Unsupported content ID prefix "${prefix}". Use a dashboard ID starting with ${DASHBOARD_PREFIX} or a report ID starting with ${REPORT_PREFIX}.`
  )
}

export type RenderContext = {
  contentId: string
  contentType: SalesforceContentType
  getRuntimeState: () => RuntimeState
  displayErrors: boolean
  showLabels: boolean
}

type CredentialsResult =
  | { ok: true; accessToken: string; instanceUrl: string }
  | { ok: false }

type LoadAttempt =
  | { ok: true; content: ContentResults }
  | { ok: false; error: unknown }

type ContentResults =
  | { contentType: 'dashboard'; results: DashboardResults }
  | { contentType: 'report'; results: ReportResult }

async function fetchContentResults(
  contentType: SalesforceContentType,
  instanceUrl: string,
  accessToken: string,
  contentId: string
): Promise<ContentResults> {
  if (contentType === 'dashboard') {
    await triggerDashboardRefresh(instanceUrl, accessToken, contentId)
    const results = await getDashboardResults(
      instanceUrl,
      accessToken,
      contentId
    )
    return { contentType, results }
  }

  const results = await getReportResults(instanceUrl, accessToken, contentId)
  return { contentType, results }
}

async function loadContent(
  context: RenderContext,
  accessToken: string,
  instanceUrl: string
): Promise<LoadAttempt> {
  try {
    const content = await fetchContentResults(
      context.contentType,
      instanceUrl,
      accessToken,
      context.contentId
    )
    writeCachedContent(context.contentType, context.contentId, content.results)
    return { ok: true, content }
  } catch (err) {
    return { ok: false, error: err }
  }
}

function showCachedContent(context: RenderContext): void {
  const cached = readCachedContent(context.contentType, context.contentId)

  if (!cached) {
    throw new Error('No cached content found.')
  }

  showContent({
    contentType: context.contentType,
    contentId: context.contentId,
    results: cached,
    showLabels: context.showLabels,
  } as ContentToRender)
}

function handleContentFailure(context: RenderContext, err: unknown): void {
  if (context.displayErrors) {
    throw new Error(
      err instanceof Error ? err.message : 'Failed to load content.'
    )
  }
  showCachedContent(context)
}

function requireCredentials(context: RenderContext): CredentialsResult {
  const { accessToken, instanceUrl, credentialError } =
    context.getRuntimeState()

  if (accessToken && instanceUrl) {
    return { ok: true, accessToken, instanceUrl }
  }

  if (!context.displayErrors) {
    return { ok: false }
  }

  throw new Error(credentialError!.message)
}

export async function render(context: RenderContext): Promise<void> {
  const credentials = requireCredentials(context)
  if (!credentials.ok) return

  const attempt = await loadContent(
    context,
    credentials.accessToken,
    credentials.instanceUrl
  )

  if (attempt.ok) {
    showContent({
      ...attempt.content,
      contentId: context.contentId,
      showLabels: context.showLabels,
    })
    return
  }

  reportError(attempt.error, {
    source: 'salesforce-content',
    contentId: context.contentId,
    contentType: context.contentType,
  })
  handleContentFailure(context, attempt.error)
}
