import type {
  SalesforceContentType,
  DashboardResults,
  ReportResult,
} from './types'

const CACHE_PREFIX = 'salesforce-edge-app:v1:'

export type CachedCredentials = { accessToken: string; instanceUrl: string }

function getStorage(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null
    return localStorage
  } catch {
    return null
  }
}

function readJSON<T>(key: string): T | null {
  const storage = getStorage()
  if (!storage) return null

  try {
    const raw = storage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function writeJSON(key: string, value: unknown): void {
  const storage = getStorage()
  if (!storage) return

  try {
    storage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage disabled or quota exceeded; failover simply has nothing cached.
  }
}

export function readCachedCredentials(): CachedCredentials | null {
  return readJSON<CachedCredentials>(`${CACHE_PREFIX}credentials`)
}

export function writeCachedCredentials(value: CachedCredentials): void {
  writeJSON(`${CACHE_PREFIX}credentials`, value)
}

function contentKey(
  contentType: SalesforceContentType,
  contentId: string
): string {
  return `${CACHE_PREFIX}content:${contentType}:${contentId}`
}

export function readCachedContent(
  contentType: SalesforceContentType,
  contentId: string
): DashboardResults | ReportResult | null {
  return readJSON(contentKey(contentType, contentId))
}

export function writeCachedContent(
  contentType: SalesforceContentType,
  contentId: string,
  value: DashboardResults | ReportResult
): void {
  writeJSON(contentKey(contentType, contentId), value)
}
