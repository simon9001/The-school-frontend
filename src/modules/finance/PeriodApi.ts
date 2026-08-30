import { createApi } from '@reduxjs/toolkit/query/react'
import { authBaseQuery } from '../../apiDomain/authBaseQuery'
import type { ApiEnvelope } from '../../types/Types'
import type { FiscalPeriod, NewPeriodValues, UpdatePeriodValues } from './types'

export const periodApi = createApi({
  reducerPath: 'periodApi',
  baseQuery: authBaseQuery,
  tagTypes: ['Periods'],
  endpoints: (builder) => ({
    getAllPeriods: builder.query<FiscalPeriod[], void>({
      query: () => 'periods',
      transformResponse: (response: ApiEnvelope<FiscalPeriod[]>) => response.data,
      providesTags: ['Periods'],
    }),

    createPeriod: builder.mutation<FiscalPeriod, NewPeriodValues>({
      query: (body) => ({ url: 'periods', method: 'POST', body }),
      transformResponse: (response: ApiEnvelope<FiscalPeriod>) => response.data,
      invalidatesTags: ['Periods'],
    }),

    updatePeriod: builder.mutation<FiscalPeriod, { id: number; changes: UpdatePeriodValues }>({
      query: ({ id, changes }) => ({ url: `periods/${id}`, method: 'PATCH', body: changes }),
      transformResponse: (response: ApiEnvelope<FiscalPeriod>) => response.data,
      invalidatesTags: ['Periods'],
    }),

    // Closing is one-way — the backend rejects any further edit or posting
    // against a closed period, so the UI confirms before calling this.
    closePeriod: builder.mutation<FiscalPeriod, number>({
      query: (id) => ({ url: `periods/${id}/close`, method: 'POST' }),
      transformResponse: (response: ApiEnvelope<FiscalPeriod>) => response.data,
      invalidatesTags: ['Periods'],
    }),
  }),
})

export const {
  useGetAllPeriodsQuery,
  useCreatePeriodMutation,
  useUpdatePeriodMutation,
  useClosePeriodMutation,
} = periodApi
