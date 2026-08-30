import { createApi } from '@reduxjs/toolkit/query/react'
import { authBaseQuery } from '../../apiDomain/authBaseQuery'
import type { ApiEnvelope } from '../../types/Types'
import type { JournalEntry, JournalEntryWithLines, NewJournalEntryValues, TrialBalanceResult } from './types'

export const journalApi = createApi({
  reducerPath: 'journalApi',
  baseQuery: authBaseQuery,
  tagTypes: ['JournalEntries'],
  endpoints: (builder) => ({
    getTrialBalance: builder.query<TrialBalanceResult, { asOfDate: string; fundId?: number }>({
      query: ({ asOfDate, fundId }) => ({
        url: 'reports/trial-balance',
        params: { asOfDate, ...(fundId ? { fundId } : {}) },
      }),
      transformResponse: (response: ApiEnvelope<TrialBalanceResult>) => response.data,
    }),

    getAllJournalEntries: builder.query<JournalEntry[], void>({
      query: () => 'journal-entries',
      transformResponse: (response: ApiEnvelope<JournalEntry[]>) => response.data,
      providesTags: ['JournalEntries'],
    }),

    getJournalEntryById: builder.query<JournalEntryWithLines, number>({
      query: (id) => `journal-entries/${id}`,
      transformResponse: (response: ApiEnvelope<JournalEntryWithLines>) => response.data,
      providesTags: ['JournalEntries'],
    }),

    createManualJournalEntry: builder.mutation<JournalEntry, NewJournalEntryValues>({
      query: (body) => ({ url: 'journal-entries', method: 'POST', body }),
      transformResponse: (response: ApiEnvelope<JournalEntry>) => response.data,
      invalidatesTags: ['JournalEntries'],
    }),

    approveJournalEntry: builder.mutation<JournalEntry, { id: number; approverId: number }>({
      query: ({ id, approverId }) => ({ url: `journal-entries/${id}/approve`, method: 'POST', body: { approverId } }),
      transformResponse: (response: ApiEnvelope<JournalEntry>) => response.data,
      invalidatesTags: ['JournalEntries'],
    }),

    rejectJournalEntry: builder.mutation<JournalEntry, { id: number; approverId: number; reason: string }>({
      query: ({ id, approverId, reason }) => ({ url: `journal-entries/${id}/reject`, method: 'POST', body: { approverId, reason } }),
      transformResponse: (response: ApiEnvelope<JournalEntry>) => response.data,
      invalidatesTags: ['JournalEntries'],
    }),
  }),
})

export const {
  useGetTrialBalanceQuery,
  useGetAllJournalEntriesQuery,
  useGetJournalEntryByIdQuery,
  useCreateManualJournalEntryMutation,
  useApproveJournalEntryMutation,
  useRejectJournalEntryMutation,
} = journalApi
