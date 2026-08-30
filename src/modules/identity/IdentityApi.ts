import { createApi } from '@reduxjs/toolkit/query/react'
import { authBaseQuery } from '../../apiDomain/authBaseQuery'
import type { ApiEnvelope } from '../../types/Types'
import type { AuditLogEntry, ManagedUser, NewUserValues, PermissionDef, ResetPasswordValues, RoleWithPermissions, UpdateUserValues } from './types'

export const identityApi = createApi({
  reducerPath: 'identityApi',
  baseQuery: authBaseQuery,
  tagTypes: ['Users', 'Roles', 'AuditLog'],
  endpoints: (builder) => ({
    getAllUsers: builder.query<ManagedUser[], void>({
      query: () => 'users',
      transformResponse: (response: ApiEnvelope<ManagedUser[]>) => response.data,
      providesTags: ['Users'],
    }),

    createUser: builder.mutation<ManagedUser, NewUserValues>({
      query: (body) => ({ url: 'users', method: 'POST', body }),
      transformResponse: (response: ApiEnvelope<ManagedUser>) => response.data,
      invalidatesTags: ['Users', 'AuditLog'],
    }),

    updateUser: builder.mutation<ManagedUser, { id: number; changes: UpdateUserValues }>({
      query: ({ id, changes }) => ({ url: `users/${id}`, method: 'PATCH', body: changes }),
      transformResponse: (response: ApiEnvelope<ManagedUser>) => response.data,
      invalidatesTags: ['Users', 'AuditLog'],
    }),

    resetPassword: builder.mutation<{ success: boolean }, { id: number; values: ResetPasswordValues }>({
      query: ({ id, values }) => ({ url: `users/${id}/reset-password`, method: 'POST', body: values }),
      transformResponse: (response: ApiEnvelope<{ success: boolean }>) => response.data,
      invalidatesTags: ['AuditLog'],
    }),

    assignRole: builder.mutation<ManagedUser, { userId: number; roleId: number }>({
      query: ({ userId, roleId }) => ({ url: `users/${userId}/roles`, method: 'POST', body: { roleId } }),
      transformResponse: (response: ApiEnvelope<ManagedUser>) => response.data,
      invalidatesTags: ['Users', 'AuditLog'],
    }),

    removeRole: builder.mutation<ManagedUser, { userId: number; roleId: number }>({
      query: ({ userId, roleId }) => ({ url: `users/${userId}/roles/${roleId}`, method: 'DELETE' }),
      transformResponse: (response: ApiEnvelope<ManagedUser>) => response.data,
      invalidatesTags: ['Users', 'AuditLog'],
    }),

    getAllRoles: builder.query<RoleWithPermissions[], void>({
      query: () => 'roles',
      transformResponse: (response: ApiEnvelope<RoleWithPermissions[]>) => response.data,
      providesTags: ['Roles'],
    }),

    getAllPermissions: builder.query<PermissionDef[], void>({
      query: () => 'roles/permissions',
      transformResponse: (response: ApiEnvelope<PermissionDef[]>) => response.data,
      providesTags: ['Roles'],
    }),

    getAuditLog: builder.query<AuditLogEntry[], { limit?: number } | void>({
      query: (args) => ({ url: 'audit-log', params: args?.limit ? { limit: args.limit } : {} }),
      transformResponse: (response: ApiEnvelope<AuditLogEntry[]>) => response.data,
      providesTags: ['AuditLog'],
    }),
  }),
})

export const {
  useGetAllUsersQuery,
  useCreateUserMutation,
  useUpdateUserMutation,
  useResetPasswordMutation,
  useAssignRoleMutation,
  useRemoveRoleMutation,
  useGetAllRolesQuery,
  useGetAllPermissionsQuery,
  useGetAuditLogQuery,
} = identityApi
