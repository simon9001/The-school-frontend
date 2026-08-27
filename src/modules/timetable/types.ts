export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday'

export const DAYS_OF_WEEK: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

export interface LessonPeriod {
  id: number
  name: string
  startTime: string
  endTime: string
  sortOrder: number
}

export interface TimetableEntry {
  id: number
  classId: number
  streamId: number | null
  subjectId: number
  teacherId: number
  lessonPeriodId: number
  dayOfWeek: DayOfWeek
  periodId: number
}

export interface TeacherWorkload {
  teacherId: number
  periodId: number
  totalPeriodsPerWeek: number
  bySubject: { subjectId: number; periodsPerWeek: number }[]
}

export type NewLessonPeriodValues = {
  name: string
  startTime: string
  endTime: string
  sortOrder: number
}

export type NewTimetableEntryValues = {
  classId: number
  streamId?: number
  subjectId: number
  teacherId: number
  lessonPeriodId: number
  dayOfWeek: DayOfWeek
  periodId: number
}
