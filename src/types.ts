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

export interface GaugeBreak {
  color: string
  lowerBound: number
  upperBound: number
}

export interface GaugeVisualizationProperties {
  breakPoints: {
    aggregateName: string
    breaks: GaugeBreak[]
  }[]
  showPercentages: boolean
  showRange: boolean
  showTotal: boolean
}

export interface DashboardMetadataComponent {
  id: string
  header: string | null
  title: string | null
  reportId: string
  type: string
  properties: {
    visualizationType: string
    visualizationProperties?:
      | GaugeVisualizationProperties
      | { tableColumns?: { column: string; type: string }[] }
      | Record<string, unknown>
    aggregates: { name: string }[]
    groupings: { name: string }[] | null
  }
}

export interface DashboardLayoutComponent {
  row: number
  column: number
  rowspan: number
  colspan: number
}

export interface DashboardResults {
  dashboardMetadata: {
    name: string
    id: string
    components: DashboardMetadataComponent[]
    layout?: {
      components: DashboardLayoutComponent[]
      numColumns: number
      rowHeight: number
      gridLayout: boolean
    }
  }
  componentData: (ComponentDataItem | null)[]
}
