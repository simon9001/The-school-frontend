import { createApi } from '@reduxjs/toolkit/query/react'
import { authBaseQuery } from '../../apiDomain/authBaseQuery'
import type { ApiEnvelope } from '../../types/Types'
import type {
  Employee,
  NewEmployeeValues,
  NewPayrollRunValues,
  NewSalaryComponentValues,
  PayrollRun,
  PayrollRunWithPayslips,
  ProcessPayrollRunValues,
  SalaryComponent,
} from './types'

export const payrollApi = createApi({
  reducerPath: 'payrollApi',
  baseQuery: authBaseQuery,
  tagTypes: ['Employees', 'SalaryComponents', 'PayrollRuns'],
  endpoints: (builder) => ({
    getAllEmployees: builder.query<Employee[], void>({
      query: () => 'payroll/employees',
      transformResponse: (response: ApiEnvelope<Employee[]>) => response.data,
      providesTags: ['Employees'],
    }),
    createEmployee: builder.mutation<Employee, NewEmployeeValues>({
      query: (body) => ({ url: 'payroll/employees', method: 'POST', body }),
      transformResponse: (response: ApiEnvelope<Employee>) => response.data,
      invalidatesTags: ['Employees'],
    }),

    getSalaryComponents: builder.query<SalaryComponent[], number>({
      query: (employeeId) => `payroll/employees/${employeeId}/components`,
      transformResponse: (response: ApiEnvelope<SalaryComponent[]>) => response.data,
      providesTags: ['SalaryComponents'],
    }),
    addSalaryComponent: builder.mutation<SalaryComponent, { employeeId: number; values: NewSalaryComponentValues }>({
      query: ({ employeeId, values }) => ({ url: `payroll/employees/${employeeId}/components`, method: 'POST', body: values }),
      transformResponse: (response: ApiEnvelope<SalaryComponent>) => response.data,
      invalidatesTags: ['SalaryComponents'],
    }),

    getAllPayrollRuns: builder.query<PayrollRun[], void>({
      query: () => 'payroll/runs',
      transformResponse: (response: ApiEnvelope<PayrollRun[]>) => response.data,
      providesTags: ['PayrollRuns'],
    }),
    getPayrollRunById: builder.query<PayrollRunWithPayslips, number>({
      query: (id) => `payroll/runs/${id}`,
      transformResponse: (response: ApiEnvelope<PayrollRunWithPayslips>) => response.data,
      providesTags: ['PayrollRuns'],
    }),
    createPayrollRun: builder.mutation<PayrollRun, NewPayrollRunValues>({
      query: (body) => ({ url: 'payroll/runs', method: 'POST', body }),
      transformResponse: (response: ApiEnvelope<PayrollRun>) => response.data,
      invalidatesTags: ['PayrollRuns'],
    }),
    processPayrollRun: builder.mutation<PayrollRun, { id: number; values: ProcessPayrollRunValues }>({
      query: ({ id, values }) => ({ url: `payroll/runs/${id}/process`, method: 'POST', body: values }),
      transformResponse: (response: ApiEnvelope<PayrollRun>) => response.data,
      invalidatesTags: ['PayrollRuns'],
    }),
  }),
})

export const {
  useGetAllEmployeesQuery,
  useCreateEmployeeMutation,
  useGetSalaryComponentsQuery,
  useAddSalaryComponentMutation,
  useGetAllPayrollRunsQuery,
  useGetPayrollRunByIdQuery,
  useCreatePayrollRunMutation,
  useProcessPayrollRunMutation,
} = payrollApi
