export interface DeviceCodeResponse {
  device_code: string
  user_code: string
  verification_uri: string
  interval: number
  expires_in: number
}

export interface TokenResponse {
  access_token: string
  refresh_token: string
  instance_url: string
  token_type: string
  issued_at: string
}

export interface FactMapEntry {
  aggregates: { label: string; value: number }[]
  rows?: { dataCells: { label: string; value: unknown }[] }[]
}

export interface ReportResult {
  factMap: Record<string, FactMapEntry>
  groupingsDown?: { groupings: { label: string; key: string }[] }
  groupingsAcross?: { groupings: { label: string; key: string }[] }
  reportExtendedMetadata?: {
    detailColumnInfo?: Record<string, { label: string; dataType: string }>
    aggregateColumnInfo?: Record<string, { label: string; dataType: string }>
  }
  reportMetadata?: {
    detailColumns?: string[]
    aggregates?: string[]
  }
}

export interface ComponentDataItem {
  componentId: string
  reportResult: ReportResult | null
  status: {
    componentDataStatus: string
    refreshStatus: string
  }
}

export interface DashboardMetadataComponent {
  id: string
  header: string | null
  title: string | null
  reportId: string
  type: string
  properties: {
    visualizationType: string
    aggregates: { name: string }[]
    groupings: { name: string }[]
    tableColumns?: { column: string; type: string }[]
  }
}

export interface DashboardResults {
  dashboardMetadata: {
    name: string
    id: string
    components: DashboardMetadataComponent[]
  }
  componentData: (ComponentDataItem | null)[]
}

export interface StoredAuth {
  access_token: string
  refresh_token: string
  instance_url: string
}
