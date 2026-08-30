import { createApi } from '@reduxjs/toolkit/query/react'
import { authBaseQuery } from '../../apiDomain/authBaseQuery'
import type { ApiEnvelope } from '../../types/Types'
import type { Budget, BudgetVsActualRow, BudgetWithLines, NewBudgetLineValues, NewBudgetValues } from './types'

export const budgetApi = createApi({
  reducerPath: 'budgetApi',
  baseQuery: authBaseQuery,
  tagTypes: ['Budgets'],
  endpoints: (builder) => ({
    getAllBudgets: builder.query<Budget[], void>({
      query: () => 'budgets',
      transformResponse: (response: ApiEnvelope<Budget[]>) => response.data,
      providesTags: ['Budgets'],
    }),

    getBudgetById: builder.query<BudgetWithLines, number>({
      query: (id) => `budgets/${id}`,
      transformResponse: (response: ApiEnvelope<BudgetWithLines>) => response.data,
      providesTags: ['Budgets'],
    }),

    getBudgetVsActual: builder.query<BudgetVsActualRow[], number>({
      query: (id) => `budgets/${id}/budget-vs-actual`,
      transformResponse: (response: ApiEnvelope<BudgetVsActualRow[]>) => response.data,
    }),

    createBudget: builder.mutation<Budget, NewBudgetValues>({
      query: (body) => ({ url: 'budgets', method: 'POST', body }),
      transformResponse: (response: ApiEnvelope<Budget>) => response.data,
      invalidatesTags: ['Budgets'],
    }),

    addBudgetLine: builder.mutation<unknown, { budgetId: number; line: NewBudgetLineValues }>({
      query: ({ budgetId, line }) => ({ url: `budgets/${budgetId}/lines`, method: 'POST', body: line }),
      invalidatesTags: ['Budgets'],
    }),

    approveBudget: builder.mutation<Budget, { id: number; approvedBy: number }>({
      query: ({ id, approvedBy }) => ({ url: `budgets/${id}/approve`, method: 'POST', body: { approvedBy } }),
      transformResponse: (response: ApiEnvelope<Budget>) => response.data,
      invalidatesTags: ['Budgets'],
    }),
  }),
})

export const {
  useGetAllBudgetsQuery,
  useGetBudgetByIdQuery,
  useGetBudgetVsActualQuery,
  useCreateBudgetMutation,
  useAddBudgetLineMutation,
  useApproveBudgetMutation,
} = budgetApi
