import type { SalesforceContentType } from './types'

const DASHBOARD_PREFIX = '01Z'
const REPORT_PREFIX = '00O'

// Salesforce documents record ID key prefixes in its "Salesforce Entity Key
// Prefix Decoder" table: 01Z = Dashboard, 00O = Report.
// https://help.salesforce.com/s/articleView?id=000385203&language=en_US&type=1
export function inferSalesforceContentType(
  contentId: string
): SalesforceContentType {
  const normalizedId = contentId.trim().toUpperCase()
  const prefix = normalizedId.slice(0, 3)

  if (prefix === DASHBOARD_PREFIX) return 'dashboard'
  if (prefix === REPORT_PREFIX) return 'report'

  throw new Error(
    `Unsupported Salesforce content ID prefix "${prefix}". Use a dashboard ID starting with ${DASHBOARD_PREFIX} or a report ID starting with ${REPORT_PREFIX}.`
  )
}
