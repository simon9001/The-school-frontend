import { createApi } from '@reduxjs/toolkit/query/react'
import { authBaseQuery } from '../../apiDomain/authBaseQuery'
import type { ApiEnvelope } from '../../types/Types'
import type { TrialBalanceResult } from './types'

export const journalApi = createApi({
  reducerPath: 'journalApi',
  baseQuery: authBaseQuery,
  endpoints: (builder) => ({
    getTrialBalance: builder.query<TrialBalanceResult, { asOfDate: string; fundId?: number }>({
      query: ({ asOfDate, fundId }) => ({
        url: 'reports/trial-balance',
        params: { asOfDate, ...(fundId ? { fundId } : {}) },
      }),
      transformResponse: (response: ApiEnvelope<TrialBalanceResult>) => response.data,
    }),
  }),
})

export const { useGetTrialBalanceQuery } = journalApi
