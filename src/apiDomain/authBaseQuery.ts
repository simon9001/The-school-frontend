import { fetchBaseQuery } from '@reduxjs/toolkit/query/react'
import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query'
import { apiDomain } from './ApiDomain'
import { clearCredentials } from '../modules/auth/AuthSlice'
import type { RootState } from '../store/store'

// Every features/api/*.ts file uses this instead of a bare fetchBaseQuery —
// it attaches the stored JWT so backend routes gated with requirePermission
// can identify the caller.
const rawBaseQuery = fetchBaseQuery({
  baseUrl: apiDomain,
  prepareHeaders: (headers, { getState }) => {
    const token = (getState() as RootState).authSlice.token
    if (token) headers.set('Authorization', `Bearer ${token}`)
    return headers
  },
})

/**
 * Ends the session when the backend says the token is no longer good.
 *
 * 401 means the token is missing, expired or revoked; 403 means the caller is
 * signed in but not allowed to do this one thing. Only the former is a session
 * problem — signing someone out because they opened a page they lack a
 * permission for would be its own bug. Clearing credentials is enough to get
 * them to the login screen: PrivateRoute redirects as soon as
 * `isAuthenticated` goes false, and the store drops every cached response.
 *
 * The `isAuthenticated` guard keeps a page that fires a dozen queries at once
 * from dispatching a dozen logouts off the same expiry.
 */
export const authBaseQuery: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  api,
  extraOptions,
) => {
  const result = await rawBaseQuery(args, api, extraOptions)

  if (result.error?.status === 401 && (api.getState() as RootState).authSlice.isAuthenticated) {
    api.dispatch(clearCredentials({ reason: 'expired' }))
  }

  return result
}
