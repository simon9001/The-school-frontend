import { createApi } from '@reduxjs/toolkit/query/react'
import { authBaseQuery } from '../../apiDomain/authBaseQuery'
import type { ApiEnvelope } from '../../types/Types'
import type { LessonPeriod, NewLessonPeriodValues, NewTimetableEntryValues, TeacherWorkload, TimetableEntry } from './types'

export const timetableApi = createApi({
  reducerPath: 'timetableApi',
  baseQuery: authBaseQuery,
  tagTypes: ['LessonPeriods', 'TimetableEntries'],
  endpoints: (builder) => ({
    getLessonPeriods: builder.query<LessonPeriod[], void>({
      query: () => 'timetable/lesson-periods',
      transformResponse: (response: ApiEnvelope<LessonPeriod[]>) => response.data,
      providesTags: ['LessonPeriods'],
    }),

    createLessonPeriod: builder.mutation<LessonPeriod, NewLessonPeriodValues>({
      query: (body) => ({ url: 'timetable/lesson-periods', method: 'POST', body }),
      transformResponse: (response: ApiEnvelope<LessonPeriod>) => response.data,
      invalidatesTags: ['LessonPeriods'],
    }),

    getClassTimetable: builder.query<TimetableEntry[], { classId: number; periodId: number }>({
      query: ({ classId, periodId }) => ({ url: `timetable/classes/${classId}`, params: { periodId } }),
      transformResponse: (response: ApiEnvelope<TimetableEntry[]>) => response.data,
      providesTags: ['TimetableEntries'],
    }),

    getTeacherTimetable: builder.query<TimetableEntry[], { teacherId: number; periodId: number }>({
      query: ({ teacherId, periodId }) => ({ url: `timetable/teachers/${teacherId}`, params: { periodId } }),
      transformResponse: (response: ApiEnvelope<TimetableEntry[]>) => response.data,
      providesTags: ['TimetableEntries'],
    }),

    getTeacherWorkload: builder.query<TeacherWorkload, { teacherId: number; periodId: number }>({
      query: ({ teacherId, periodId }) => ({ url: `timetable/teachers/${teacherId}/workload`, params: { periodId } }),
      transformResponse: (response: ApiEnvelope<TeacherWorkload>) => response.data,
      providesTags: ['TimetableEntries'],
    }),

    createEntry: builder.mutation<TimetableEntry, NewTimetableEntryValues>({
      query: (body) => ({ url: 'timetable/entries', method: 'POST', body }),
      transformResponse: (response: ApiEnvelope<TimetableEntry>) => response.data,
      invalidatesTags: ['TimetableEntries'],
    }),

    deleteEntry: builder.mutation<void, number>({
      query: (id) => ({ url: `timetable/entries/${id}`, method: 'DELETE' }),
      invalidatesTags: ['TimetableEntries'],
    }),
  }),
})

export const {
  useGetLessonPeriodsQuery,
  useCreateLessonPeriodMutation,
  useGetClassTimetableQuery,
  useGetTeacherTimetableQuery,
  useGetTeacherWorkloadQuery,
  useCreateEntryMutation,
  useDeleteEntryMutation,
} = timetableApi
