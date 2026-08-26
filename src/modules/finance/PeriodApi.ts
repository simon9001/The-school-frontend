import { createApi } from '@reduxjs/toolkit/query/react'
import { authBaseQuery } from '../../apiDomain/authBaseQuery'
import type { ApiEnvelope } from '../../types/Types'
import type { FiscalPeriod } from './types'

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
  }),
})

export const { useGetAllPeriodsQuery } = periodApi
