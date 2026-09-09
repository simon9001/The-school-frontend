import { RouterProvider, createBrowserRouter, Navigate } from 'react-router'
import Login from './modules/auth/LoginPage'
import Dashboard from './modules/dashboard/DashboardPage'
import ComingSoon from './components/ComingSoon'
import AccessDenied from './components/AccessDenied'
import NotFound from './components/NotFound'
import AccountsPage from './modules/finance/AccountsPage'
import FundsPage from './modules/finance/FundsPage'
import TrialBalancePage from './modules/finance/TrialBalancePage'
import JournalEntriesPage from './modules/finance/JournalEntriesPage'
import StudentsPage from './modules/students/StudentsPage'
import AdmissionsPage from './modules/admissions/AdmissionsPage'
import FeesPage from './modules/fees/FeesPage'
import FeeCounterPage from './modules/fees/FeeCounterPage'
import TeachersPage from './modules/teachers/TeachersPage'
import SubjectsPage from './modules/subjects/SubjectsPage'
import AttendancePage from './modules/attendance/AttendancePage'
import TimetablePage from './modules/timetable/TimetablePage'
import UsersPage from './modules/identity/UsersPage'
import RolesPage from './modules/identity/RolesPage'
import AuditLogPage from './modules/identity/AuditLogPage'
import BudgetsPage from './modules/budgets/BudgetsPage'
import GrantsPage from './modules/grants/GrantsPage'
import ProcurementPage from './modules/procurement/ProcurementPage'
import PayrollPage from './modules/payroll/PayrollPage'
import AssetsPage from './modules/assets/AssetsPage'
import InventoryPage from './modules/inventory/InventoryPage'
import FiscalPeriodsPage from './modules/finance/FiscalPeriodsPage'
import SystemHealthPage from './modules/system/SystemHealthPage'
import PrivateRoute from './components/auth/PrivateRoute'
import PublicRoute from './components/auth/PublicRoute'
import InactivityTimer from './components/auth/InactivityTimer'
import RealtimeSync from './components/auth/RealtimeSync'
import ProfilePage from './modules/profile/ProfilePage'
import { navigation } from './dashboardDesign/navigation'

function App() {
  // Every nav item without a real page yet gets a permission-gated
  // "coming soon" placeholder, generated from the same navigation.ts the
  // sidebar renders from — adding a real page later just means pointing
  // its entry at the real component and flipping `built: true`.
  const placeholderRoutes = navigation
    .flatMap((section) => section.items)
    .filter((item) => !item.built)
    .map((item) => ({
      path: item.path,
      element: (
        <PrivateRoute requiredPermission={item.permission}>
          <ComingSoon title={item.name} />
        </PrivateRoute>
      ),
    }))

  const router = createBrowserRouter([
    { path: '/', element: <Navigate to="/dashboard" replace /> },
    { path: '/login', element: <PublicRoute><Login /></PublicRoute> },

    { path: '/access-denied', element: <PrivateRoute><AccessDenied /></PrivateRoute> },
    { path: '/dashboard/profile', element: <PrivateRoute><ProfilePage /></PrivateRoute> },

    { path: '/dashboard', element: <PrivateRoute requiredPermission="dashboard.view"><Dashboard /></PrivateRoute> },
    { path: '/dashboard/finance/accounts', element: <PrivateRoute requiredPermission="ledger.journal.view"><AccountsPage /></PrivateRoute> },
    { path: '/dashboard/finance/funds', element: <PrivateRoute requiredPermission="ledger.journal.view"><FundsPage /></PrivateRoute> },
    { path: '/dashboard/finance/trial-balance', element: <PrivateRoute requiredPermission="ledger.journal.view"><TrialBalancePage /></PrivateRoute> },
    { path: '/dashboard/finance/journal', element: <PrivateRoute requiredPermission="ledger.journal.view"><JournalEntriesPage /></PrivateRoute> },
    { path: '/dashboard/students', element: <PrivateRoute requiredPermission="students.view"><StudentsPage /></PrivateRoute> },
    { path: '/dashboard/admissions', element: <PrivateRoute requiredPermission="admissions.view"><AdmissionsPage /></PrivateRoute> },
    { path: '/dashboard/finance/fees', element: <PrivateRoute requiredPermission="fees.view"><FeesPage /></PrivateRoute> },
    { path: '/dashboard/finance/counter', element: <PrivateRoute requiredPermission="fees.receipt.create"><FeeCounterPage /></PrivateRoute> },
    { path: '/dashboard/academic/teachers', element: <PrivateRoute requiredPermission="teachers.view"><TeachersPage /></PrivateRoute> },
    { path: '/dashboard/academic/subjects', element: <PrivateRoute requiredPermission="subjects.view"><SubjectsPage /></PrivateRoute> },
    { path: '/dashboard/academic/attendance', element: <PrivateRoute requiredPermission="attendance.view"><AttendancePage /></PrivateRoute> },
    { path: '/dashboard/academic/timetable', element: <PrivateRoute requiredPermission="timetable.view"><TimetablePage /></PrivateRoute> },
    { path: '/dashboard/admin/users', element: <PrivateRoute requiredPermission="users.manage"><UsersPage /></PrivateRoute> },
    { path: '/dashboard/admin/roles', element: <PrivateRoute requiredPermission="roles.manage"><RolesPage /></PrivateRoute> },
    { path: '/dashboard/admin/periods', element: <PrivateRoute requiredPermission="ledger.periods.manage"><FiscalPeriodsPage /></PrivateRoute> },
    { path: '/dashboard/admin/system', element: <PrivateRoute requiredPermission="users.manage"><SystemHealthPage /></PrivateRoute> },
    { path: '/dashboard/admin/audit-log', element: <PrivateRoute requiredPermission="audit.view"><AuditLogPage /></PrivateRoute> },
    { path: '/dashboard/finance/budgets', element: <PrivateRoute requiredPermission="budget.view"><BudgetsPage /></PrivateRoute> },
    { path: '/dashboard/finance/grants', element: <PrivateRoute requiredPermission="grants.view"><GrantsPage /></PrivateRoute> },
    { path: '/dashboard/finance/procurement', element: <PrivateRoute requiredPermission="procurement.view"><ProcurementPage /></PrivateRoute> },
    { path: '/dashboard/finance/payroll', element: <PrivateRoute requiredPermission="payroll.view"><PayrollPage /></PrivateRoute> },
    { path: '/dashboard/finance/assets', element: <PrivateRoute requiredPermission="assets.view"><AssetsPage /></PrivateRoute> },
    { path: '/dashboard/finance/inventory', element: <PrivateRoute requiredPermission="inventory.view"><InventoryPage /></PrivateRoute> },

    ...placeholderRoutes,

    // Must stay last: matches anything the routes above did not.
    { path: '*', element: <NotFound /> },
  ])

  return (
    <>
      <InactivityTimer timeoutMinutes={15} />
      <RealtimeSync />
      <RouterProvider router={router} />
    </>
  )
}

export default App
