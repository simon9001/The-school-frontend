export type TeacherStatus = 'active' | 'on_leave' | 'left'

export interface Teacher {
  id: number
  staffNo: string
  fullName: string
  tscNumber: string | null
  employeeId: number | null
  email: string | null
  phone: string | null
  status: TeacherStatus
  createdAt: string
}

export type NewTeacherValues = {
  staffNo: string
  fullName: string
  tscNumber?: string
  employeeId?: number
  email?: string
  phone?: string
}

export type UpdateTeacherValues = Partial<NewTeacherValues> & {
  status?: TeacherStatus
}
