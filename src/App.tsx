import { RouterProvider, createBrowserRouter, Navigate } from 'react-router'
import Login from './modules/auth/LoginPage'
import Dashboard from './modules/dashboard/DashboardPage'
import ComingSoon from './components/ComingSoon'
import AccessDenied from './components/AccessDenied'
import AccountsPage from './modules/finance/AccountsPage'
import FundsPage from './modules/finance/FundsPage'
import TrialBalancePage from './modules/finance/TrialBalancePage'
import StudentsPage from './modules/students/StudentsPage'
import AdmissionsPage from './modules/admissions/AdmissionsPage'
import FeesPage from './modules/fees/FeesPage'
import TeachersPage from './modules/teachers/TeachersPage'
import SubjectsPage from './modules/subjects/SubjectsPage'
import AttendancePage from './modules/attendance/AttendancePage'
import TimetablePage from './modules/timetable/TimetablePage'
import PrivateRoute from './components/auth/PrivateRoute'
import PublicRoute from './components/auth/PublicRoute'
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

    { path: '/dashboard', element: <PrivateRoute requiredPermission="dashboard.view"><Dashboard /></PrivateRoute> },
    { path: '/dashboard/finance/accounts', element: <PrivateRoute requiredPermission="ledger.journal.view"><AccountsPage /></PrivateRoute> },
    { path: '/dashboard/finance/funds', element: <PrivateRoute requiredPermission="ledger.journal.view"><FundsPage /></PrivateRoute> },
    { path: '/dashboard/finance/trial-balance', element: <PrivateRoute requiredPermission="ledger.journal.view"><TrialBalancePage /></PrivateRoute> },
    { path: '/dashboard/students', element: <PrivateRoute requiredPermission="students.view"><StudentsPage /></PrivateRoute> },
    { path: '/dashboard/admissions', element: <PrivateRoute requiredPermission="admissions.view"><AdmissionsPage /></PrivateRoute> },
    { path: '/dashboard/finance/fees', element: <PrivateRoute requiredPermission="fees.view"><FeesPage /></PrivateRoute> },
    { path: '/dashboard/academic/teachers', element: <PrivateRoute requiredPermission="teachers.view"><TeachersPage /></PrivateRoute> },
    { path: '/dashboard/academic/subjects', element: <PrivateRoute requiredPermission="subjects.view"><SubjectsPage /></PrivateRoute> },
    { path: '/dashboard/academic/attendance', element: <PrivateRoute requiredPermission="attendance.view"><AttendancePage /></PrivateRoute> },
    { path: '/dashboard/academic/timetable', element: <PrivateRoute requiredPermission="timetable.view"><TimetablePage /></PrivateRoute> },

    ...placeholderRoutes,
  ])

  return <RouterProvider router={router} />
}

export default App
