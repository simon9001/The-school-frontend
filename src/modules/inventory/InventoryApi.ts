import { createApi } from '@reduxjs/toolkit/query/react'
import { authBaseQuery } from '../../apiDomain/authBaseQuery'
import type { ApiEnvelope } from '../../types/Types'
import type {
  InventoryItem,
  IssueStockValues,
  NewInventoryItemValues,
  ReceiveStockValues,
  StockMovement,
} from './types'

export const inventoryApi = createApi({
  reducerPath: 'inventoryApi',
  baseQuery: authBaseQuery,
  tagTypes: ['InventoryItems', 'StockMovements'],
  endpoints: (builder) => ({
    getAllInventoryItems: builder.query<InventoryItem[], void>({
      query: () => 'inventory/items',
      transformResponse: (response: ApiEnvelope<InventoryItem[]>) => response.data,
      providesTags: ['InventoryItems'],
    }),

    getInventoryItemById: builder.query<InventoryItem, number>({
      query: (id) => `inventory/items/${id}`,
      transformResponse: (response: ApiEnvelope<InventoryItem>) => response.data,
      providesTags: ['InventoryItems'],
    }),

    createInventoryItem: builder.mutation<InventoryItem, NewInventoryItemValues>({
      query: (body) => ({ url: 'inventory/items', method: 'POST', body }),
      transformResponse: (response: ApiEnvelope<InventoryItem>) => response.data,
      invalidatesTags: ['InventoryItems'],
    }),

    getMovementsByItem: builder.query<StockMovement[], number>({
      query: (itemId) => `inventory/items/${itemId}/movements`,
      transformResponse: (response: ApiEnvelope<StockMovement[]>) => response.data,
      providesTags: ['StockMovements'],
    }),

    receiveStock: builder.mutation<StockMovement, ReceiveStockValues>({
      query: (body) => ({ url: 'inventory/movements/receive', method: 'POST', body }),
      transformResponse: (response: ApiEnvelope<StockMovement>) => response.data,
      invalidatesTags: ['StockMovements'],
    }),

    issueStock: builder.mutation<StockMovement, IssueStockValues>({
      query: (body) => ({ url: 'inventory/movements/issue', method: 'POST', body }),
      transformResponse: (response: ApiEnvelope<StockMovement>) => response.data,
      invalidatesTags: ['StockMovements'],
    }),
  }),
})

export const {
  useGetAllInventoryItemsQuery,
  useGetInventoryItemByIdQuery,
  useCreateInventoryItemMutation,
  useGetMovementsByItemQuery,
  useReceiveStockMutation,
  useIssueStockMutation,
} = inventoryApi
