import { createApi } from '@reduxjs/toolkit/query/react'
import { authBaseQuery } from '../../apiDomain/authBaseQuery'
import type { ApiEnvelope } from '../../types/Types'
import type {
  Admission,
  DecideValues,
  EnrollValues,
  NewDirectValues,
  NewPlacementValues,
  NewTransferValues,
  RecordInterviewResultValues,
  ScheduleInterviewValues,
} from './types'

export const admissionApi = createApi({
  reducerPath: 'admissionApi',
  baseQuery: authBaseQuery,
  tagTypes: ['Admissions'],
  endpoints: (builder) => ({
    getAllAdmissions: builder.query<Admission[], void>({
      query: () => 'admissions',
      transformResponse: (response: ApiEnvelope<Admission[]>) => response.data,
      providesTags: ['Admissions'],
    }),

    getAdmissionById: builder.query<Admission, number>({
      query: (id) => `admissions/${id}`,
      transformResponse: (response: ApiEnvelope<Admission>) => response.data,
      providesTags: ['Admissions'],
    }),

    capturePlacement: builder.mutation<Admission, NewPlacementValues>({
      query: (body) => ({ url: 'admissions/placements', method: 'POST', body }),
      transformResponse: (response: ApiEnvelope<Admission>) => response.data,
      invalidatesTags: ['Admissions'],
    }),

    captureTransfer: builder.mutation<Admission, NewTransferValues>({
      query: (body) => ({ url: 'admissions/transfers', method: 'POST', body }),
      transformResponse: (response: ApiEnvelope<Admission>) => response.data,
      invalidatesTags: ['Admissions'],
    }),

    applyDirect: builder.mutation<Admission, NewDirectValues>({
      query: (body) => ({ url: 'admissions/applications', method: 'POST', body }),
      transformResponse: (response: ApiEnvelope<Admission>) => response.data,
      invalidatesTags: ['Admissions'],
    }),

    scheduleInterview: builder.mutation<Admission, { id: number; values: ScheduleInterviewValues }>({
      query: ({ id, values }) => ({ url: `admissions/${id}/interview/schedule`, method: 'POST', body: values }),
      transformResponse: (response: ApiEnvelope<Admission>) => response.data,
      invalidatesTags: ['Admissions'],
    }),

    recordInterviewResult: builder.mutation<Admission, { id: number; values: RecordInterviewResultValues }>({
      query: ({ id, values }) => ({ url: `admissions/${id}/interview/result`, method: 'POST', body: values }),
      transformResponse: (response: ApiEnvelope<Admission>) => response.data,
      invalidatesTags: ['Admissions'],
    }),

    decideAdmission: builder.mutation<Admission, { id: number; values: DecideValues }>({
      query: ({ id, values }) => ({ url: `admissions/${id}/decide`, method: 'POST', body: values }),
      transformResponse: (response: ApiEnvelope<Admission>) => response.data,
      invalidatesTags: ['Admissions'],
    }),

    enrollAdmission: builder.mutation<Admission, { id: number; values: EnrollValues }>({
      query: ({ id, values }) => ({ url: `admissions/${id}/enroll`, method: 'POST', body: values }),
      transformResponse: (response: ApiEnvelope<Admission>) => response.data,
      invalidatesTags: ['Admissions'],
    }),
  }),
})

export const {
  useGetAllAdmissionsQuery,
  useGetAdmissionByIdQuery,
  useCapturePlacementMutation,
  useCaptureTransferMutation,
  useApplyDirectMutation,
  useScheduleInterviewMutation,
  useRecordInterviewResultMutation,
  useDecideAdmissionMutation,
  useEnrollAdmissionMutation,
} = admissionApi
