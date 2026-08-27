import { createApi } from '@reduxjs/toolkit/query/react'
import { authBaseQuery } from '../../apiDomain/authBaseQuery'
import type { ApiEnvelope } from '../../types/Types'
import type { NewTeacherValues, Teacher, UpdateTeacherValues } from './types'

export const teacherApi = createApi({
  reducerPath: 'teacherApi',
  baseQuery: authBaseQuery,
  tagTypes: ['Teachers'],
  endpoints: (builder) => ({
    getAllTeachers: builder.query<Teacher[], void>({
      query: () => 'teachers',
      transformResponse: (response: ApiEnvelope<Teacher[]>) => response.data,
      providesTags: ['Teachers'],
    }),

    getTeacherById: builder.query<Teacher, number>({
      query: (id) => `teachers/${id}`,
      transformResponse: (response: ApiEnvelope<Teacher>) => response.data,
      providesTags: ['Teachers'],
    }),

    addTeacher: builder.mutation<Teacher, NewTeacherValues>({
      query: (newTeacher) => ({ url: 'teachers', method: 'POST', body: newTeacher }),
      transformResponse: (response: ApiEnvelope<Teacher>) => response.data,
      invalidatesTags: ['Teachers'],
    }),

    updateTeacher: builder.mutation<Teacher, { id: number; changes: UpdateTeacherValues }>({
      query: ({ id, changes }) => ({ url: `teachers/${id}`, method: 'PATCH', body: changes }),
      transformResponse: (response: ApiEnvelope<Teacher>) => response.data,
      invalidatesTags: ['Teachers'],
    }),
  }),
})

export const {
  useGetAllTeachersQuery,
  useGetTeacherByIdQuery,
  useAddTeacherMutation,
  useUpdateTeacherMutation,
} = teacherApi
