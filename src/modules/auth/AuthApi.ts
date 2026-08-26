import { createApi } from '@reduxjs/toolkit/query/react'
import { authBaseQuery } from '../../apiDomain/authBaseQuery'
import type { ApiEnvelope } from '../../types/Types'
import type { AuthenticatedUser, LoginFormValues, LoginResult } from './types'

export const AuthApi = createApi({
  reducerPath: 'authApi',
  baseQuery: authBaseQuery,
  endpoints: (builder) => ({
    // User login
    login: builder.mutation<LoginResult, LoginFormValues>({
      query: (credentials) => ({
        url: 'auth/login',
        method: 'POST',
        body: credentials,
      }),
      transformResponse: (response: ApiEnvelope<LoginResult>) => response.data,
    }),

    // Re-fetch the current user (e.g. on app load, to refresh permissions)
    me: builder.query<AuthenticatedUser, void>({
      query: () => 'auth/me',
      transformResponse: (response: ApiEnvelope<AuthenticatedUser>) => response.data,
    }),
  }),
})

export const { useLoginMutation, useMeQuery } = AuthApi
