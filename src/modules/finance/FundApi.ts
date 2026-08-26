import { createApi } from '@reduxjs/toolkit/query/react'
import { authBaseQuery } from '../../apiDomain/authBaseQuery'
import type { ApiEnvelope } from '../../types/Types'
import type { Fund, NewFundValues } from './types'

export const fundApi = createApi({
  reducerPath: 'fundApi',
  baseQuery: authBaseQuery,
  tagTypes: ['Funds'],
  endpoints: (builder) => ({
    getAllFunds: builder.query<Fund[], void>({
      query: () => 'funds',
      transformResponse: (response: ApiEnvelope<Fund[]>) => response.data,
      providesTags: ['Funds'],
    }),

    addFund: builder.mutation<Fund, NewFundValues>({
      query: (newFund) => ({
        url: 'funds',
        method: 'POST',
        body: newFund,
      }),
      transformResponse: (response: ApiEnvelope<Fund>) => response.data,
      invalidatesTags: ['Funds'],
    }),

    deactivateFund: builder.mutation<Fund, number>({
      query: (id) => ({
        url: `funds/${id}/deactivate`,
        method: 'POST',
      }),
      transformResponse: (response: ApiEnvelope<Fund>) => response.data,
      invalidatesTags: ['Funds'],
    }),
  }),
})

export const { useGetAllFundsQuery, useAddFundMutation, useDeactivateFundMutation } = fundApi
