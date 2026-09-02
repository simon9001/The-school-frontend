import React, { useEffect, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { apiDomain } from '../../apiDomain/ApiDomain'
import type { AppDispatch, RootState } from '../../store/store'
import { journalApi } from '../../modules/finance/JournalApi'
import { feesApi } from '../../modules/fees/FeesApi'
import { budgetApi } from '../../modules/budgets/BudgetApi'
import { procurementApi } from '../../modules/procurement/ProcurementApi'
import { payrollApi } from '../../modules/payroll/PayrollApi'
import { studentApi } from '../../modules/students/StudentApi'
import { admissionApi } from '../../modules/admissions/AdmissionApi'
import { grantApi } from '../../modules/grants/GrantApi'
import { assetApi } from '../../modules/assets/AssetApi'
import { inventoryApi } from '../../modules/inventory/InventoryApi'
import { dashboardApi } from '../../modules/dashboard/DashboardApi'
import { timetableApi } from '../../modules/timetable/TimetableApi'
import { attendanceApi } from '../../modules/attendance/AttendanceApi'

export const RealtimeSync: React.FC = () => {
  const { isAuthenticated, token } = useSelector((state: RootState) => state.authSlice)
  const dispatch = useDispatch<AppDispatch>()
  const eventSourceRef = useRef<EventSource | null>(null)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!isAuthenticated || !token) {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
      return
    }

    const connect = () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }

      // Base URL normalization
      const cleanBase = apiDomain.endsWith('/') ? apiDomain : `${apiDomain}/`
      const sseUrl = `${cleanBase}realtime/events?token=${encodeURIComponent(token)}`

      const es = new EventSource(sseUrl)
      eventSourceRef.current = es

      es.addEventListener('change', (event) => {
        try {
          const payload = JSON.parse(event.data) as { topic: string; action: string }
          const { topic } = payload

          // Invalidate relevant RTK Query slices based on topic signal
          switch (topic) {
            case 'journal':
              dispatch(journalApi.util.invalidateTags(['JournalEntries', 'TrialBalance']))
              dispatch(dashboardApi.util.invalidateTags(['DashboardSummary']))
              break

            case 'fees':
              dispatch(feesApi.util.invalidateTags(['FeeStructures', 'FeeInvoices', 'FeePayments']))
              dispatch(dashboardApi.util.invalidateTags(['DashboardSummary']))
              break

            case 'budgets':
              dispatch(budgetApi.util.invalidateTags(['Budgets']))
              dispatch(dashboardApi.util.invalidateTags(['DashboardSummary']))
              break

            case 'procurement':
              dispatch(
                procurementApi.util.invalidateTags([
                  'Requisitions',
                  'PurchaseOrders',
                  'Suppliers',
                  'SupplierInvoices',
                ]),
              )
              dispatch(dashboardApi.util.invalidateTags(['DashboardSummary']))
              break

            case 'payroll':
              dispatch(payrollApi.util.invalidateTags(['PayrollRuns', 'Employees']))
              dispatch(dashboardApi.util.invalidateTags(['DashboardSummary']))
              break

            case 'students':
              dispatch(studentApi.util.invalidateTags(['Students', 'Classes']))
              dispatch(dashboardApi.util.invalidateTags(['DashboardSummary']))
              break

            case 'admissions':
              dispatch(admissionApi.util.invalidateTags(['Admissions']))
              dispatch(dashboardApi.util.invalidateTags(['DashboardSummary']))
              break

            case 'grants':
              dispatch(grantApi.util.invalidateTags(['GrantTypes', 'GrantDisbursements']))
              dispatch(dashboardApi.util.invalidateTags(['DashboardSummary']))
              break

            case 'assets':
              dispatch(assetApi.util.invalidateTags(['AssetCategories', 'Assets']))
              dispatch(dashboardApi.util.invalidateTags(['DashboardSummary']))
              break

            case 'inventory':
              dispatch(inventoryApi.util.invalidateTags(['InventoryItems', 'StockMovements']))
              dispatch(dashboardApi.util.invalidateTags(['DashboardSummary']))
              break

            case 'attendance':
              dispatch(attendanceApi.util.invalidateTags(['Attendance']))
              break

            case 'timetable':
              dispatch(timetableApi.util.invalidateTags(['LessonPeriods', 'TimetableEntries']))
              break

            case 'dashboard':
              dispatch(dashboardApi.util.invalidateTags(['DashboardSummary']))
              break

            default:
              // Fallback refresh for general dashboard updates
              dispatch(dashboardApi.util.invalidateTags(['DashboardSummary']))
              break
          }
        } catch (err) {
          console.error('Error processing realtime SSE message:', err)
        }
      })

      es.onerror = () => {
        // EventSource auto-reconnects natively, but if it closes completely, retry in 5s
        if (es.readyState === EventSource.CLOSED) {
          reconnectTimeoutRef.current = setTimeout(() => {
            if (isAuthenticated) connect()
          }, 5000)
        }
      }
    }

    connect()

    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current)
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
    }
  }, [isAuthenticated, token, dispatch])

  return null
}

export default RealtimeSync
