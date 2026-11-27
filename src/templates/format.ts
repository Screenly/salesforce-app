import { formatLocalizedDate } from '@screenly/edge-apps/utils'

// Formats a Salesforce refresh timestamp like "19 Feb 2025, 21:05" from "2025-02-19T21:05:00.000+0000".
export function formatAsOf(
  isoDate: string | null | undefined,
  locale: string,
  timeZone: string
): string | undefined {
  if (!isoDate) return undefined
  // Salesforce sends offsets without a colon ("...000+0000"), which is not
  // strict ISO 8601; add it so every engine parses the date the same way.
  const date = new Date(isoDate.replace(/([+-]\d{2})(\d{2})$/, '$1:$2'))
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
