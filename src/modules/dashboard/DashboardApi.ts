import { createApi } from '@reduxjs/toolkit/query/react'
import { authBaseQuery } from '../../apiDomain/authBaseQuery'
import type { ApiEnvelope } from '../../types/Types'
import type { DashboardSummary } from './types'

export const dashboardApi = createApi({
  reducerPath: 'dashboardApi',
  baseQuery: authBaseQuery,
  endpoints: (builder) => ({
    getDashboardSummary: builder.query<DashboardSummary, { asOfDate?: string } | void>({
      query: (args) => ({
        url: 'dashboard/summary',
        params: args?.asOfDate ? { asOfDate: args.asOfDate } : {},
      }),
      transformResponse: (response: ApiEnvelope<DashboardSummary>) => response.data,
    }),
  }),
})

export const { useGetDashboardSummaryQuery } = dashboardApi
