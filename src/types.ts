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

export interface DashboardComponent {
  id: string
  name: string
  type: string // bar, line, pie, donut, etc.
}

export interface DashboardDescribe {
  id: string
  name: string
  components: DashboardComponent[]
}

export interface FactMapEntry {
  aggregates: { label: string; value: number }[]
  rows?: { dataCells: { label: string; value: number }[] }[]
}

export interface DashboardResults {
  dashboardMetadata: {
    name: string
    id: string
  }
  componentData: Record<
    string,
    {
      componentType: string
      title: string
      reportResult: {
        factMap: Record<string, FactMapEntry>
        groupingsDown?: { groupings: { label: string; key: string }[] }
        groupingsAcross?: { groupings: { label: string; key: string }[] }
      }
    }
  >
}

export interface StoredAuth {
  access_token: string
  refresh_token: string
  instance_url: string
}
