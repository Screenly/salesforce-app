import {
  getLocale,
  getSettingWithDefault,
  getTimeZone,
  readEdgeAppCache,
  reportError,
  writeEdgeAppCache,
} from '@screenly/edge-apps/utils'
import {
  getDashboardResults,
  getReportResults,
  triggerDashboardRefresh,
} from './api'
import {
  CACHE_NAMESPACE,
  refreshToken,
  salesforceConnectionState,
} from './credentials'
import {
  renderSalesforceContent,
  type RenderableSalesforceContent,
} from './templates'
import { resolveThemeSetting } from './templates/theme'
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

type LocaleContext = { locale: string; timeZone: string }

let localeContext: Promise<LocaleContext> | undefined

// Resolved once: the screen's locale and time zone do not change between refreshes.
function getLocaleContext(): Promise<LocaleContext> {
  localeContext ??= Promise.all([getLocale(), getTimeZone()])
    .then(([locale, timeZone]) => ({ locale, timeZone }))
    .catch(() => ({
      locale: navigator.language || 'en',
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }))
  return localeContext
}

type RenderContext = {
  contentId: string
  contentType: SalesforceContentType
  displayErrors: boolean
  showLabels: boolean
}

function contentCacheKey(
  contentType: SalesforceContentType,
  contentId: string
): string {
  return `content:${contentType}:${contentId}`
}

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

async function getContent(
  context: RenderContext,
  accessToken: string,
  instanceUrl: string
): Promise<DashboardResults | ReportResult> {
  try {
    const results = await fetchContentResults(
      context.contentType,
      instanceUrl,
      accessToken,
      context.contentId
    )
    writeEdgeAppCache(
      CACHE_NAMESPACE,
      contentCacheKey(context.contentType, context.contentId),
      results
    )
    return results
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err))
    reportError(error, {
      source: 'salesforce-content',
      contentId: context.contentId,
      contentType: context.contentType,
    })

    if (context.displayErrors) throw error
  }

  const cached = readEdgeAppCache<DashboardResults | ReportResult>(
    CACHE_NAMESPACE,
    contentCacheKey(context.contentType, context.contentId)
  )
  if (!cached) {
    throw new Error('No cached content found.')
  }

  return cached
}

export async function refresh(): Promise<void> {
  await refreshToken()

  const { accessToken, instanceUrl } = salesforceConnectionState

  const context: RenderContext = {
    contentId: getSettingWithDefault<string>('content_id', ''),
    contentType: inferSalesforceContentType(),
    displayErrors: getSettingWithDefault<boolean>('display_errors', false),
    showLabels: getSettingWithDefault<boolean>('show_labels', false),
  }

  const results = await getContent(context, accessToken, instanceUrl)
  const { locale, timeZone } = await getLocaleContext()

  renderSalesforceContent({
    contentType: context.contentType,
    contentId: context.contentId,
    results,
    showLabels: context.showLabels,
    themeSetting: resolveThemeSetting(
      getSettingWithDefault<string>('theme', 'salesforce')
    ),
    locale,
    timeZone,
  } as RenderableSalesforceContent)
}
