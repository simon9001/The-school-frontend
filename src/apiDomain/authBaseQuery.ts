import { fetchBaseQuery } from '@reduxjs/toolkit/query/react'
import { apiDomain } from './ApiDomain'
import type { RootState } from '../store/store'

// Every features/api/*.ts file uses this instead of a bare fetchBaseQuery —
// it attaches the stored JWT so backend routes gated with requirePermission
// can identify the caller.
export const authBaseQuery = fetchBaseQuery({
  baseUrl: apiDomain,
  prepareHeaders: (headers, { getState }) => {
    const token = (getState() as RootState).authSlice.token
    if (token) headers.set('Authorization', `Bearer ${token}`)
    return headers
  },
})
