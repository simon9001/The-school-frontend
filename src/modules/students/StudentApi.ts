import { createApi } from '@reduxjs/toolkit/query/react'
import { authBaseQuery } from '../../apiDomain/authBaseQuery'
import type { ApiEnvelope } from '../../types/Types'
import type { Class, NewStudentValues, Stream, Student } from './types'

export const studentApi = createApi({
  reducerPath: 'studentApi',
  baseQuery: authBaseQuery,
  tagTypes: ['Students', 'Classes', 'Streams'],
  endpoints: (builder) => ({
    getAllClasses: builder.query<Class[], void>({
      query: () => 'students/classes',
      transformResponse: (response: ApiEnvelope<Class[]>) => response.data,
      providesTags: ['Classes'],
    }),

    getStreamsByClass: builder.query<Stream[], number>({
      query: (classId) => `students/classes/${classId}/streams`,
      transformResponse: (response: ApiEnvelope<Stream[]>) => response.data,
      providesTags: ['Streams'],
    }),

    getAllStudents: builder.query<Student[], void>({
      query: () => 'students',
      transformResponse: (response: ApiEnvelope<Student[]>) => response.data,
      providesTags: ['Students'],
    }),

    getStudentsByClass: builder.query<Student[], number>({
      query: (classId) => `students/classes/${classId}/students`,
      transformResponse: (response: ApiEnvelope<Student[]>) => response.data,
      providesTags: ['Students'],
    }),

    getStudentById: builder.query<Student, number>({
      query: (id) => `students/${id}`,
      transformResponse: (response: ApiEnvelope<Student>) => response.data,
      providesTags: ['Students'],
    }),

    addStudent: builder.mutation<Student, NewStudentValues>({
      query: (newStudent) => ({
        url: 'students',
        method: 'POST',
        body: newStudent,
      }),
      transformResponse: (response: ApiEnvelope<Student>) => response.data,
      invalidatesTags: ['Students'],
    }),

    updateStudent: builder.mutation<Student, { id: number; changes: Partial<NewStudentValues> }>({
      query: ({ id, changes }) => ({
        url: `students/${id}`,
        method: 'PATCH',
        body: changes,
      }),
      transformResponse: (response: ApiEnvelope<Student>) => response.data,
      invalidatesTags: ['Students'],
    }),
  }),
})

export const {
  useGetAllClassesQuery,
  useGetStreamsByClassQuery,
  useGetAllStudentsQuery,
  useGetStudentsByClassQuery,
  useGetStudentByIdQuery,
  useAddStudentMutation,
  useUpdateStudentMutation,
} = studentApi
