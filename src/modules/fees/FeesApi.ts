import { createApi } from '@reduxjs/toolkit/query/react'
import { authBaseQuery } from '../../apiDomain/authBaseQuery'
import type { ApiEnvelope } from '../../types/Types'
import type {
  FeeInvoice,
  FeeInvoiceWithBalance,
  FeeInvoiceWithItems,
  FeePayment,
  FeeStructure,
  FeeStructureWithItems,
  NewFeeStructureValues,
  NewInvoiceValues,
  NewPaymentValues,
  PaymentRangeQuery,
} from './types'

export const feesApi = createApi({
  reducerPath: 'feesApi',
  baseQuery: authBaseQuery,
  tagTypes: ['FeeStructures', 'FeeInvoices', 'FeePayments'],
  endpoints: (builder) => ({
    getAllStructures: builder.query<FeeStructure[], void>({
      query: () => 'fees/structures',
      transformResponse: (response: ApiEnvelope<FeeStructure[]>) => response.data,
      providesTags: ['FeeStructures'],
    }),

    getStructureById: builder.query<FeeStructureWithItems, number>({
      query: (id) => `fees/structures/${id}`,
      transformResponse: (response: ApiEnvelope<FeeStructureWithItems>) => response.data,
      providesTags: ['FeeStructures'],
    }),

    createStructure: builder.mutation<FeeStructure, NewFeeStructureValues>({
      query: (body) => ({ url: 'fees/structures', method: 'POST', body }),
      transformResponse: (response: ApiEnvelope<FeeStructure>) => response.data,
      invalidatesTags: ['FeeStructures'],
    }),

    getAllInvoices: builder.query<FeeInvoiceWithBalance[], void>({
      query: () => 'fees/invoices',
      transformResponse: (response: ApiEnvelope<FeeInvoiceWithBalance[]>) => response.data,
      // FeePayments too: recording a payment must refresh the balance column,
      // and recordPayment already invalidates that tag.
      providesTags: ['FeeInvoices', 'FeePayments'],
    }),

    getInvoiceById: builder.query<FeeInvoiceWithItems, number>({
      query: (id) => `fees/invoices/${id}`,
      transformResponse: (response: ApiEnvelope<FeeInvoiceWithItems>) => response.data,
      providesTags: ['FeeInvoices'],
    }),

    getInvoicesByStudent: builder.query<FeeInvoice[], number>({
      query: (studentId) => `fees/students/${studentId}/invoices`,
      transformResponse: (response: ApiEnvelope<FeeInvoice[]>) => response.data,
      providesTags: ['FeeInvoices'],
    }),

    createInvoice: builder.mutation<FeeInvoice, NewInvoiceValues>({
      query: (body) => ({ url: 'fees/invoices', method: 'POST', body }),
      transformResponse: (response: ApiEnvelope<FeeInvoice>) => response.data,
      invalidatesTags: ['FeeInvoices'],
    }),

    recordPayment: builder.mutation<FeePayment, NewPaymentValues>({
      query: (body) => ({ url: 'fees/payments', method: 'POST', body }),
      transformResponse: (response: ApiEnvelope<FeePayment>) => response.data,
      invalidatesTags: ['FeeInvoices', 'FeePayments'],
    }),

    getPaymentsByStudent: builder.query<FeePayment[], number>({
      query: (studentId) => `fees/students/${studentId}/payments`,
      transformResponse: (response: ApiEnvelope<FeePayment[]>) => response.data,
      providesTags: ['FeePayments'],
    }),

    getPaymentsInRange: builder.query<FeePayment[], PaymentRangeQuery>({
      query: ({ from, to, method }) => {
        const params = new URLSearchParams()
        if (from) params.set('from', from)
        if (to) params.set('to', to)
        if (method) params.set('method', method)
        const qs = params.toString()
        return qs ? `fees/payments?${qs}` : 'fees/payments'
      },
      transformResponse: (response: ApiEnvelope<FeePayment[]>) => response.data,
      providesTags: ['FeePayments'],
    }),
  }),
})

export const {
  useGetAllStructuresQuery,
  useGetStructureByIdQuery,
  useCreateStructureMutation,
  useGetAllInvoicesQuery,
  useGetInvoiceByIdQuery,
  useGetInvoicesByStudentQuery,
  useCreateInvoiceMutation,
  useRecordPaymentMutation,
  useGetPaymentsByStudentQuery,
  useGetPaymentsInRangeQuery,
} = feesApi
