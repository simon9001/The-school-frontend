import { configureStore } from '@reduxjs/toolkit'
import storage from 'redux-persist/es/storage'
import { persistReducer, persistStore, FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER } from 'redux-persist'
import authSlice from '../modules/auth/AuthSlice'
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

const authPersistConfig = {
  key: 'auth',
  storage,
  version: 1,
  whitelist: ['token', 'isAuthenticated', 'user'],
}

const persistedAuthReducer = persistReducer(authPersistConfig, authSlice)

export const store = configureStore({
  reducer: {
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

    authSlice: persistedAuthReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }).concat(AuthApi.middleware, accountApi.middleware, fundApi.middleware, periodApi.middleware, journalApi.middleware, dashboardApi.middleware, studentApi.middleware, admissionApi.middleware, feesApi.middleware, teacherApi.middleware, subjectApi.middleware, attendanceApi.middleware, timetableApi.middleware),
})

export const persistor = persistStore(store)

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
