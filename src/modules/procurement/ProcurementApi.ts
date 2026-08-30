import { createApi } from '@reduxjs/toolkit/query/react'
import { authBaseQuery } from '../../apiDomain/authBaseQuery'
import type { ApiEnvelope } from '../../types/Types'
import type {
  GoodsReceivedNote,
  NewGrnValues,
  NewPurchaseOrderValues,
  NewRequisitionValues,
  NewSupplierInvoiceValues,
  NewSupplierPaymentValues,
  NewSupplierValues,
  PurchaseOrder,
  PurchaseOrderWithItems,
  Requisition,
  RequisitionWithItems,
  Supplier,
  SupplierInvoice,
  SupplierPayment,
} from './types'

export const procurementApi = createApi({
  reducerPath: 'procurementApi',
  baseQuery: authBaseQuery,
  tagTypes: ['Suppliers', 'Requisitions', 'PurchaseOrders', 'Grns', 'SupplierInvoices'],
  endpoints: (builder) => ({
    getAllSuppliers: builder.query<Supplier[], void>({
      query: () => 'procurement/suppliers',
      transformResponse: (response: ApiEnvelope<Supplier[]>) => response.data,
      providesTags: ['Suppliers'],
    }),
    createSupplier: builder.mutation<Supplier, NewSupplierValues>({
      query: (body) => ({ url: 'procurement/suppliers', method: 'POST', body }),
      transformResponse: (response: ApiEnvelope<Supplier>) => response.data,
      invalidatesTags: ['Suppliers'],
    }),

    getAllRequisitions: builder.query<Requisition[], void>({
      query: () => 'procurement/requisitions',
      transformResponse: (response: ApiEnvelope<Requisition[]>) => response.data,
      providesTags: ['Requisitions'],
    }),
    getRequisitionById: builder.query<RequisitionWithItems, number>({
      query: (id) => `procurement/requisitions/${id}`,
      transformResponse: (response: ApiEnvelope<RequisitionWithItems>) => response.data,
      providesTags: ['Requisitions'],
    }),
    createRequisition: builder.mutation<Requisition, NewRequisitionValues>({
      query: (body) => ({ url: 'procurement/requisitions', method: 'POST', body }),
      transformResponse: (response: ApiEnvelope<Requisition>) => response.data,
      invalidatesTags: ['Requisitions'],
    }),
    approveRequisition: builder.mutation<Requisition, { id: number; approvedBy: number }>({
      query: ({ id, approvedBy }) => ({ url: `procurement/requisitions/${id}/approve`, method: 'POST', body: { approvedBy } }),
      transformResponse: (response: ApiEnvelope<Requisition>) => response.data,
      invalidatesTags: ['Requisitions'],
    }),
    rejectRequisition: builder.mutation<Requisition, number>({
      query: (id) => ({ url: `procurement/requisitions/${id}/reject`, method: 'POST' }),
      transformResponse: (response: ApiEnvelope<Requisition>) => response.data,
      invalidatesTags: ['Requisitions'],
    }),

    getAllPurchaseOrders: builder.query<PurchaseOrder[], void>({
      query: () => 'procurement/purchase-orders',
      transformResponse: (response: ApiEnvelope<PurchaseOrder[]>) => response.data,
      providesTags: ['PurchaseOrders'],
    }),
    getPurchaseOrderById: builder.query<PurchaseOrderWithItems, number>({
      query: (id) => `procurement/purchase-orders/${id}`,
      transformResponse: (response: ApiEnvelope<PurchaseOrderWithItems>) => response.data,
      providesTags: ['PurchaseOrders'],
    }),
    createPurchaseOrder: builder.mutation<PurchaseOrder, NewPurchaseOrderValues>({
      query: (body) => ({ url: 'procurement/purchase-orders', method: 'POST', body }),
      transformResponse: (response: ApiEnvelope<PurchaseOrder>) => response.data,
      invalidatesTags: ['PurchaseOrders', 'Requisitions'],
    }),

    createGrn: builder.mutation<GoodsReceivedNote, NewGrnValues>({
      query: (body) => ({ url: 'procurement/goods-received-notes', method: 'POST', body }),
      transformResponse: (response: ApiEnvelope<GoodsReceivedNote>) => response.data,
      invalidatesTags: ['Grns', 'PurchaseOrders'],
    }),

    getAllSupplierInvoices: builder.query<SupplierInvoice[], void>({
      query: () => 'procurement/invoices',
      transformResponse: (response: ApiEnvelope<SupplierInvoice[]>) => response.data,
      providesTags: ['SupplierInvoices'],
    }),
    createSupplierInvoice: builder.mutation<SupplierInvoice, NewSupplierInvoiceValues>({
      query: (body) => ({ url: 'procurement/invoices', method: 'POST', body }),
      transformResponse: (response: ApiEnvelope<SupplierInvoice>) => response.data,
      invalidatesTags: ['SupplierInvoices'],
    }),
    createSupplierPayment: builder.mutation<SupplierPayment, NewSupplierPaymentValues>({
      query: (body) => ({ url: 'procurement/payments', method: 'POST', body }),
      transformResponse: (response: ApiEnvelope<SupplierPayment>) => response.data,
      invalidatesTags: ['SupplierInvoices'],
    }),
  }),
})

export const {
  useGetAllSuppliersQuery,
  useCreateSupplierMutation,
  useGetAllRequisitionsQuery,
  useGetRequisitionByIdQuery,
  useCreateRequisitionMutation,
  useApproveRequisitionMutation,
  useRejectRequisitionMutation,
  useGetAllPurchaseOrdersQuery,
  useGetPurchaseOrderByIdQuery,
  useCreatePurchaseOrderMutation,
  useCreateGrnMutation,
  useGetAllSupplierInvoicesQuery,
  useCreateSupplierInvoiceMutation,
  useCreateSupplierPaymentMutation,
} = procurementApi
