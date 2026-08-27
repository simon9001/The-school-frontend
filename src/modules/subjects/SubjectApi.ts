import { createApi } from '@reduxjs/toolkit/query/react'
import { authBaseQuery } from '../../apiDomain/authBaseQuery'
import type { ApiEnvelope } from '../../types/Types'
import type {
  ClassSubject,
  NewAssignmentValues,
  NewOfferingValues,
  NewStrandValues,
  NewSubjectValues,
  Subject,
  SubjectStrand,
  TeacherAssignment,
} from './types'

export const subjectApi = createApi({
  reducerPath: 'subjectApi',
  baseQuery: authBaseQuery,
  tagTypes: ['Subjects', 'Strands', 'Offerings', 'Assignments'],
  endpoints: (builder) => ({
    getAllSubjects: builder.query<Subject[], void>({
      query: () => 'subjects',
      transformResponse: (response: ApiEnvelope<Subject[]>) => response.data,
      providesTags: ['Subjects'],
    }),

    addSubject: builder.mutation<Subject, NewSubjectValues>({
      query: (body) => ({ url: 'subjects', method: 'POST', body }),
      transformResponse: (response: ApiEnvelope<Subject>) => response.data,
      invalidatesTags: ['Subjects'],
    }),

    getStrandsBySubject: builder.query<SubjectStrand[], number>({
      query: (subjectId) => `subjects/${subjectId}/strands`,
      transformResponse: (response: ApiEnvelope<SubjectStrand[]>) => response.data,
      providesTags: ['Strands'],
    }),

    addStrand: builder.mutation<SubjectStrand, NewStrandValues>({
      query: (body) => ({ url: 'subjects/strands', method: 'POST', body }),
      transformResponse: (response: ApiEnvelope<SubjectStrand>) => response.data,
      invalidatesTags: ['Strands'],
    }),

    getOfferingsByClass: builder.query<ClassSubject[], number>({
      query: (classId) => `subjects/classes/${classId}/offerings`,
      transformResponse: (response: ApiEnvelope<ClassSubject[]>) => response.data,
      providesTags: ['Offerings'],
    }),

    offerToClass: builder.mutation<ClassSubject, NewOfferingValues>({
      query: (body) => ({ url: 'subjects/offerings', method: 'POST', body }),
      transformResponse: (response: ApiEnvelope<ClassSubject>) => response.data,
      invalidatesTags: ['Offerings'],
    }),

    getAssignmentsByClass: builder.query<TeacherAssignment[], { classId: number; periodId: number }>({
      query: ({ classId, periodId }) => ({ url: `subjects/classes/${classId}/assignments`, params: { periodId } }),
      transformResponse: (response: ApiEnvelope<TeacherAssignment[]>) => response.data,
      providesTags: ['Assignments'],
    }),

    assignTeacher: builder.mutation<TeacherAssignment, NewAssignmentValues>({
      query: (body) => ({ url: 'subjects/assignments', method: 'POST', body }),
      transformResponse: (response: ApiEnvelope<TeacherAssignment>) => response.data,
      invalidatesTags: ['Assignments'],
    }),
  }),
})

export const {
  useGetAllSubjectsQuery,
  useAddSubjectMutation,
  useGetStrandsBySubjectQuery,
  useAddStrandMutation,
  useGetOfferingsByClassQuery,
  useOfferToClassMutation,
  useGetAssignmentsByClassQuery,
  useAssignTeacherMutation,
} = subjectApi
