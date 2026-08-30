import { createApi } from '@reduxjs/toolkit/query/react'
import { authBaseQuery } from '../../apiDomain/authBaseQuery'
import type { ApiEnvelope } from '../../types/Types'
import type { GrantDisbursement, GrantType, NewDisbursementValues, NewGrantTypeValues } from './types'

export const grantApi = createApi({
  reducerPath: 'grantApi',
  baseQuery: authBaseQuery,
  tagTypes: ['GrantTypes', 'GrantDisbursements'],
  endpoints: (builder) => ({
    getAllGrantTypes: builder.query<GrantType[], void>({
      query: () => 'grants/types',
      transformResponse: (response: ApiEnvelope<GrantType[]>) => response.data,
      providesTags: ['GrantTypes'],
    }),

    createGrantType: builder.mutation<GrantType, NewGrantTypeValues>({
      query: (body) => ({ url: 'grants/types', method: 'POST', body }),
      transformResponse: (response: ApiEnvelope<GrantType>) => response.data,
      invalidatesTags: ['GrantTypes'],
    }),

    getAllDisbursements: builder.query<GrantDisbursement[], void>({
      query: () => 'grants/disbursements',
      transformResponse: (response: ApiEnvelope<GrantDisbursement[]>) => response.data,
      providesTags: ['GrantDisbursements'],
    }),

    recordDisbursement: builder.mutation<GrantDisbursement, NewDisbursementValues>({
      query: (body) => ({ url: 'grants/disbursements', method: 'POST', body }),
      transformResponse: (response: ApiEnvelope<GrantDisbursement>) => response.data,
      invalidatesTags: ['GrantDisbursements'],
    }),
  }),
})

export const {
  useGetAllGrantTypesQuery,
  useCreateGrantTypeMutation,
  useGetAllDisbursementsQuery,
  useRecordDisbursementMutation,
} = grantApi
