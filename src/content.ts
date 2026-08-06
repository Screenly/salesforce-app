import { reportError, getSettingWithDefault } from '@screenly/edge-apps/utils'
import {
  getDashboardResults,
  getReportResults,
  triggerDashboardRefresh,
} from './api'
import { readCachedContent, writeCachedContent } from './cache'
import type { RuntimeState } from './credentials'
import { renderContent, type RenderableContent } from './templates'
import type {
  DashboardResults,
  ReportResult,
  SalesforceContentType,
} from './types'

const DASHBOARD_PREFIX = '01Z'
const REPORT_PREFIX = '00O'

// https://help.salesforce.com/s/articleView?id=000386286&type=1
export function inferSalesforceContentType(): SalesforceContentType {
  const contentId = getSettingWithDefault<string>('content_id', '')
  const normalizedId = contentId.trim().toUpperCase()
  const prefix = normalizedId.slice(0, 3)

  if (prefix === DASHBOARD_PREFIX) return 'dashboard'
  if (prefix === REPORT_PREFIX) return 'report'

  throw new Error(
    `Unsupported content ID prefix "${prefix}". Use a dashboard ID starting with ${DASHBOARD_PREFIX} or a report ID starting with ${REPORT_PREFIX}.`
  )
}

type RenderContext = {
  contentId: string
  contentType: SalesforceContentType
  runtimeState: RuntimeState
  displayErrors: boolean
  showLabels: boolean
}

type CredentialsResult =
  | { ok: true; accessToken: string; instanceUrl: string }
  | { ok: false }

async function fetchContentResults(
  contentType: SalesforceContentType,
  instanceUrl: string,
  accessToken: string,
  contentId: string
): Promise<DashboardResults | ReportResult> {
  if (contentType === 'dashboard') {
    await triggerDashboardRefresh(instanceUrl, accessToken, contentId)
    return getDashboardResults(instanceUrl, accessToken, contentId)
  }

  return getReportResults(instanceUrl, accessToken, contentId)
}

async function loadContent(
  context: RenderContext,
  accessToken: string,
  instanceUrl: string
): Promise<void> {
  const results = await fetchContentResults(
    context.contentType,
    instanceUrl,
    accessToken,
    context.contentId
  )
  writeCachedContent(context.contentType, context.contentId, results)
  renderContent({
    contentType: context.contentType,
    contentId: context.contentId,
    results,
    showLabels: context.showLabels,
  } as RenderableContent)
}

function showCachedContent(context: RenderContext): void {
  const cached = readCachedContent(context.contentType, context.contentId)

  if (!cached) {
    throw new Error('No cached content found.')
  }

  renderContent({
    contentType: context.contentType,
    contentId: context.contentId,
    results: cached,
    showLabels: context.showLabels,
  } as RenderableContent)
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
  const { accessToken, instanceUrl, credentialError } = context.runtimeState

  if (accessToken && instanceUrl) {
    return { ok: true, accessToken, instanceUrl }
  }

  if (!context.displayErrors) {
    return { ok: false }
  }

  throw new Error(credentialError!.message)
}

export async function refresh(
  getRuntimeState: () => RuntimeState
): Promise<void> {
  const context: RenderContext = {
    contentId: getSettingWithDefault<string>('content_id', ''),
    contentType: inferSalesforceContentType(),
    runtimeState: getRuntimeState(),
    displayErrors:
      getSettingWithDefault<string>('display_errors', 'false') === 'true',
    showLabels:
      getSettingWithDefault<string>('show_labels', 'false') === 'true',
  }

  const credentials = requireCredentials(context)
  if (!credentials.ok) return

  try {
    await loadContent(context, credentials.accessToken, credentials.instanceUrl)
  } catch (err) {
    reportError(err, {
      source: 'salesforce-content',
      contentId: context.contentId,
      contentType: context.contentType,
    })
    handleContentFailure(context, err)
  }
}
