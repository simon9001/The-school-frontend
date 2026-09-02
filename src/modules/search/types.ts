export interface SearchResultItem {
  id: string | number
  category:
    | 'page'
    | 'journal'
    | 'fees'
    | 'budgets'
    | 'procurement'
    | 'students'
    | 'admissions'
    | 'academic'
    | 'assets'
    | 'inventory'
  title: string
  subtitle: string
  path: string
  status?: string
}
