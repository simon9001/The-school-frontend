import { createApi } from '@reduxjs/toolkit/query/react'
import { authBaseQuery } from '../../apiDomain/authBaseQuery'
import type { ApiEnvelope } from '../../types/Types'
import type { AuthenticatedUser, ChangePasswordValues, LoginFormValues, LoginResult, UpdateProfileValues } from './types'

export const AuthApi = createApi({
  reducerPath: 'authApi',
  baseQuery: authBaseQuery,
  tagTypes: ['UserProfile'],
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
      providesTags: ['UserProfile'],
    }),

    updateProfile: builder.mutation<AuthenticatedUser, UpdateProfileValues>({
      query: (body) => ({
        url: 'auth/profile',
        method: 'PUT',
        body,
      }),
      transformResponse: (response: ApiEnvelope<AuthenticatedUser>) => response.data,
      invalidatesTags: ['UserProfile'],
    }),

    changePassword: builder.mutation<{ message: string }, ChangePasswordValues>({
      query: (body) => ({
        url: 'auth/change-password',
        method: 'PUT',
        body,
      }),
      transformResponse: (response: ApiEnvelope<{ message: string }>) => response.data,
    }),
  }),
})

export const { useLoginMutation, useMeQuery, useUpdateProfileMutation, useChangePasswordMutation } = AuthApi
