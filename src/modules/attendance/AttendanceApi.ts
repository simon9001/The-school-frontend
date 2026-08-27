import { createApi } from '@reduxjs/toolkit/query/react'
import { authBaseQuery } from '../../apiDomain/authBaseQuery'
import type { ApiEnvelope } from '../../types/Types'
import type { AttendanceRecord, NewAttendanceValues } from './types'

// listByClassAndDate joins through students, so each row on the wire is
// wrapped as { record: AttendanceRecord } rather than a bare AttendanceRecord.
export interface ClassAttendanceRow {
  record: AttendanceRecord
}

export const attendanceApi = createApi({
  reducerPath: 'attendanceApi',
  baseQuery: authBaseQuery,
  tagTypes: ['Attendance'],
  endpoints: (builder) => ({
    getByStudent: builder.query<AttendanceRecord[], number>({
      query: (studentId) => `attendance/students/${studentId}`,
      transformResponse: (response: ApiEnvelope<AttendanceRecord[]>) => response.data,
      providesTags: ['Attendance'],
    }),

    getByClassAndDate: builder.query<ClassAttendanceRow[], { classId: number; date: string }>({
      query: ({ classId, date }) => ({ url: `attendance/classes/${classId}`, params: { date } }),
      transformResponse: (response: ApiEnvelope<ClassAttendanceRow[]>) => response.data,
      providesTags: ['Attendance'],
    }),

    markAttendance: builder.mutation<AttendanceRecord, NewAttendanceValues>({
      query: (body) => ({ url: 'attendance', method: 'POST', body }),
      transformResponse: (response: ApiEnvelope<AttendanceRecord>) => response.data,
      invalidatesTags: ['Attendance'],
    }),

    markAttendanceBulk: builder.mutation<AttendanceRecord[], NewAttendanceValues[]>({
      query: (records) => ({ url: 'attendance/bulk', method: 'POST', body: { records } }),
      transformResponse: (response: ApiEnvelope<AttendanceRecord[]>) => response.data,
      invalidatesTags: ['Attendance'],
    }),
  }),
})

export const {
  useGetByStudentQuery,
  useGetByClassAndDateQuery,
  useMarkAttendanceMutation,
  useMarkAttendanceBulkMutation,
} = attendanceApi
