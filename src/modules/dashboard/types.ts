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

export type DashboardWidget =
  | { id: string; title: string; kind: 'stats'; stats: StatItem[] }
  | { id: string; title: string; kind: 'list'; emptyText: string; rows: ListRow[] }

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
