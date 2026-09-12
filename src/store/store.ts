import { combineReducers, configureStore } from '@reduxjs/toolkit'
import storageSession from 'redux-persist/es/storage/session'
import { persistReducer, persistStore, FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER } from 'redux-persist'
import authSlice, { clearCredentials, setCredentials } from '../modules/auth/AuthSlice'
import { AuthApi } from '../modules/auth/AuthApi'
import { accountApi } from '../modules/finance/AccountApi'
import { fundApi } from '../modules/finance/FundApi'
import { periodApi } from '../modules/finance/PeriodApi'
import { journalApi } from '../modules/finance/JournalApi'
import { dashboardApi } from '../modules/dashboard/DashboardApi'
import { studentApi } from '../modules/students/StudentApi'
import { admissionApi } from '../modules/admissions/AdmissionApi'
import { feesApi } from '../modules/fees/FeesApi'
import { teacherApi } from '../modules/teachers/TeacherApi'
import { subjectApi } from '../modules/subjects/SubjectApi'
import { attendanceApi } from '../modules/attendance/AttendanceApi'
import { timetableApi } from '../modules/timetable/TimetableApi'
import { identityApi } from '../modules/identity/IdentityApi'
import { budgetApi } from '../modules/budgets/BudgetApi'
import { grantApi } from '../modules/grants/GrantApi'
import { procurementApi } from '../modules/procurement/ProcurementApi'
import { payrollApi } from '../modules/payroll/PayrollApi'
import { assetApi } from '../modules/assets/AssetApi'
import { inventoryApi } from '../modules/inventory/InventoryApi'
import { systemApi } from '../modules/system/SystemApi'
import { searchApi } from '../modules/search/SearchApi'

const authPersistConfig = {
  key: 'auth',
  storage: storageSession,
  version: 1,
  whitelist: ['token', 'isAuthenticated', 'user'],
}

const persistedAuthReducer = persistReducer(authPersistConfig, authSlice)

const combinedReducer = combineReducers({
  [AuthApi.reducerPath]: AuthApi.reducer,
  [accountApi.reducerPath]: accountApi.reducer,
  [fundApi.reducerPath]: fundApi.reducer,
  [periodApi.reducerPath]: periodApi.reducer,
  [journalApi.reducerPath]: journalApi.reducer,
  [dashboardApi.reducerPath]: dashboardApi.reducer,
  [studentApi.reducerPath]: studentApi.reducer,
  [admissionApi.reducerPath]: admissionApi.reducer,
  [feesApi.reducerPath]: feesApi.reducer,
  [teacherApi.reducerPath]: teacherApi.reducer,
  [subjectApi.reducerPath]: subjectApi.reducer,
  [attendanceApi.reducerPath]: attendanceApi.reducer,
  [timetableApi.reducerPath]: timetableApi.reducer,
  [identityApi.reducerPath]: identityApi.reducer,
  [budgetApi.reducerPath]: budgetApi.reducer,
  [grantApi.reducerPath]: grantApi.reducer,
  [procurementApi.reducerPath]: procurementApi.reducer,
  [payrollApi.reducerPath]: payrollApi.reducer,
  [assetApi.reducerPath]: assetApi.reducer,
  [inventoryApi.reducerPath]: inventoryApi.reducer,
  [systemApi.reducerPath]: systemApi.reducer,
  [searchApi.reducerPath]: searchApi.reducer,

  authSlice: persistedAuthReducer,
})

/**
 * Logging out must empty the RTK Query caches, not just the auth slice.
 *
 * Every `*Api` slice above caches server responses in this same store, and
 * RTK Query keeps an entry for `keepUnusedDataFor` (60s by default) after the
 * last component unsubscribes. Logout navigates within the SPA, so the store
 * is never rebuilt — which meant the next person to sign in within that window
 * got the previous user's cached students, fees and `/me` profile rendered
 * instantly while the refetch was still in flight. Via `useSyncPermissions`
 * that stale `/me` was even merged into the new session's user, so the
 * previous user's name and permissions briefly became theirs.
 *
 * Resetting at the root covers all of them at once, including any api slice
 * added later — nothing to remember to wire up.
 *
 * Both ends of the session boundary need it. Logout is the obvious one, but
 * signing in also has to start from an empty cache: nothing forces a user to
 * log out before someone else logs in on the same tab (an expired token or a
 * bookmarked /login both land there with the previous user's cache intact).
 */
const rootReducer: typeof combinedReducer = (state, action) => {
  if ((action.type === clearCredentials.type || action.type === setCredentials.type) && state) {
    // Hand the next pass the auth slice only: every other slice is cache and
    // re-initialises empty. Auth is kept rather than dropped so redux-persist's
    // own `_persist` bookkeeping survives (without it the slice silently stops
    // being written to sessionStorage); `clearCredentials` nulls the
    // credentials inside it as usual (and `setCredentials` writes the new
    // user into it).
    const authOnly = { authSlice: state.authSlice } as ReturnType<typeof combinedReducer>
    return combinedReducer(authOnly, action)
  }
  return combinedReducer(state, action)
}

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }).concat(AuthApi.middleware, accountApi.middleware, fundApi.middleware, periodApi.middleware, journalApi.middleware, dashboardApi.middleware, studentApi.middleware, admissionApi.middleware, feesApi.middleware, teacherApi.middleware, subjectApi.middleware, attendanceApi.middleware, timetableApi.middleware, identityApi.middleware, budgetApi.middleware, grantApi.middleware, procurementApi.middleware, payrollApi.middleware, assetApi.middleware, inventoryApi.middleware, systemApi.middleware, searchApi.middleware),
})

export const persistor = persistStore(store)

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
