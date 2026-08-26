export interface Class {
  id: number
  name: string
  level: number
}

export interface Stream {
  id: number
  classId: number
  name: string
}

export type BoardingStatus = 'day' | 'boarder'
export type StudentStatus = 'active' | 'transferred' | 'graduated' | 'withdrawn' | 'suspended' | 'expelled'

export interface Student {
  id: number
  admissionNo: string
  nemisUpi: string | null
  firstName: string
  lastName: string
  otherNames: string | null
  gender: string | null
  dateOfBirth: string | null
  classId: number
  streamId: number | null
  boardingStatus: BoardingStatus
  guardianName: string | null
  guardianPhone: string | null
  guardianEmail: string | null
  admissionDate: string
  status: StudentStatus
  createdAt: string
  updatedAt: string
}

export type NewStudentValues = {
  admissionNo: string
  firstName: string
  lastName: string
  otherNames?: string
  gender?: string
  dateOfBirth?: string
  classId: number
  streamId?: number
  boardingStatus: BoardingStatus
  guardianName?: string
  guardianPhone?: string
  guardianEmail?: string
  admissionDate: string
}
