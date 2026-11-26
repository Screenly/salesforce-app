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

  return formatLocalizedDate(date, locale, {
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  })
}
