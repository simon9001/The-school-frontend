import { createApi } from '@reduxjs/toolkit/query/react'
import { authBaseQuery } from '../../apiDomain/authBaseQuery'
import type { ApiEnvelope } from '../../types/Types'
import type { SystemHealth, SystemRbacStatus } from './types'

export const systemApi = createApi({
  reducerPath: 'systemApi',
  baseQuery: authBaseQuery,
  tagTypes: ['SystemHealth', 'SystemRbac'],
  endpoints: (builder) => ({
    getSystemHealth: builder.query<SystemHealth, void>({
      query: () => 'system/health',
      transformResponse: (response: ApiEnvelope<SystemHealth>) => response.data,
      providesTags: ['SystemHealth'],
    }),

    getSystemRbac: builder.query<SystemRbacStatus, void>({
      query: () => 'system/rbac',
      transformResponse: (response: ApiEnvelope<SystemRbacStatus>) => response.data,
      providesTags: ['SystemRbac'],
    }),
  }),
})

export const { useGetSystemHealthQuery, useGetSystemRbacQuery } = systemApi
