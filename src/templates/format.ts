import { formatLocalizedDate } from '@screenly/edge-apps/utils'

// Formats a Salesforce refresh timestamp like "19 Feb 2025, 21:05".
export function formatAsOf(
  isoDate: string | null | undefined,
  locale: string,
  timeZone: string
): string | undefined {
  if (!isoDate) return undefined
  const date = new Date(isoDate)
  if (Number.isNaN(date.getTime())) return undefined

  // Set every date field explicitly rather than relying on the helper's
  // defaults, so the footer always names the full refresh date.
  return formatLocalizedDate(date, locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  })
}
