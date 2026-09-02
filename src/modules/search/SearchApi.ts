import { createApi } from '@reduxjs/toolkit/query/react'
import { authBaseQuery } from '../../apiDomain/authBaseQuery'
import type { ApiEnvelope } from '../../types/Types'
import type { SearchResultItem } from './types'

export const searchApi = createApi({
  reducerPath: 'searchApi',
  baseQuery: authBaseQuery,
  endpoints: (builder) => ({
    search: builder.query<SearchResultItem[], string>({
      query: (q) => ({
        url: 'search',
        params: { q },
      }),
      transformResponse: (response: ApiEnvelope<SearchResultItem[]>) => response.data,
    }),
  }),
})

export const { useSearchQuery, useLazySearchQuery } = searchApi
