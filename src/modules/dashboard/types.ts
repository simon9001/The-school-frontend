export interface DashboardSummary {
  asOfDate: string
  financial: {
    totalDebit: number
    totalCredit: number
    isBalanced: boolean
    totalInvoiced: number
    invoiceCountByStatus: { status: string; count: number }[]
  }
  enrollment: {
    totalActiveStudents: number
    byClass: { classId: number; className: string; count: number }[]
  }
  academic: {
    totalExamsRecorded: number
    mostRecentExam: { examId: number; examName: string; overallMeanMarks: number } | null
  }
}
