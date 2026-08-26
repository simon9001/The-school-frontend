import { createApi } from '@reduxjs/toolkit/query/react'
import { authBaseQuery } from '../../apiDomain/authBaseQuery'
import type { ApiEnvelope } from '../../types/Types'
import type { Account, NewAccountValues } from './types'

export const accountApi = createApi({
  reducerPath: 'accountApi',
  baseQuery: authBaseQuery,
  tagTypes: ['Accounts'],
  endpoints: (builder) => ({
    getAllAccounts: builder.query<Account[], void>({
      query: () => 'accounts',
      transformResponse: (response: ApiEnvelope<Account[]>) => response.data,
      providesTags: ['Accounts'],
    }),

    addAccount: builder.mutation<Account, NewAccountValues>({
      query: (newAccount) => ({
        url: 'accounts',
        method: 'POST',
        body: newAccount,
      }),
      transformResponse: (response: ApiEnvelope<Account>) => response.data,
      invalidatesTags: ['Accounts'],
    }),

    deactivateAccount: builder.mutation<Account, number>({
      query: (id) => ({
        url: `accounts/${id}/deactivate`,
        method: 'POST',
      }),
      transformResponse: (response: ApiEnvelope<Account>) => response.data,
      invalidatesTags: ['Accounts'],
    }),
  }),
})

export const { useGetAllAccountsQuery, useAddAccountMutation, useDeactivateAccountMutation } = accountApi
