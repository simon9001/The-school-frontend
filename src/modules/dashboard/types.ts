export type WidgetTone = 'default' | 'success' | 'warning' | 'danger'

export interface StatItem {
  label: string
  value: string
  tone?: WidgetTone
}

export interface ListRow {
  label: string
  sublabel?: string
  value?: string
  tone?: WidgetTone
}

export type ChartForm = 'line' | 'bar' | 'hbar'
export type ValueFormat = 'currency' | 'percent' | 'count'

export interface ChartSeries {
  key: string
  label: string
}

export interface SeriesPoint {
  label: string
  values: Record<string, number>
}

export type DashboardWidget =
  | { id: string; title: string; kind: 'stats'; stats: StatItem[] }
  | { id: string; title: string; kind: 'list'; emptyText: string; rows: ListRow[] }
  | {
      id: string
      title: string
      kind: 'series'
      form: ChartForm
      valueFormat: ValueFormat
      series: ChartSeries[]
      points: SeriesPoint[]
      emptyText: string
    }

export type DashboardSectionId = 'attention' | 'financial' | 'students' | 'hr' | 'welfare' | 'compliance' | 'general'

export interface DashboardSection {
  id: DashboardSectionId
  title: string
  widgets: DashboardWidget[]
}

export interface DashboardSummary {
  asOfDate: string
  sections: DashboardSection[]
}
