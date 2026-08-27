export interface Subject {
  id: number
  code: string
  name: string
  isCompulsory: boolean
}

// CBC breaks a subject (learning area) into strands/sub-strands for
// competency-based assessment. Optional — an 8-4-4/KCSE-style subject
// simply has none and is assessed at the subject level only.
export interface SubjectStrand {
  id: number
  subjectId: number
  name: string
  description: string | null
}

export interface ClassSubject {
  id: number
  classId: number
  subjectId: number
}

export interface TeacherAssignment {
  id: number
  teacherId: number
  subjectId: number
  classId: number
  streamId: number | null
  periodId: number
}

export type NewSubjectValues = {
  code: string
  name: string
  isCompulsory: boolean
}

export type NewStrandValues = {
  subjectId: number
  name: string
  description?: string
}

export type NewOfferingValues = {
  classId: number
  subjectId: number
}

export type NewAssignmentValues = {
  teacherId: number
  subjectId: number
  classId: number
  streamId?: number
  periodId: number
}
