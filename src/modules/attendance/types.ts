export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused'

export interface AttendanceRecord {
  id: number
  studentId: number
  attendanceDate: string
  status: AttendanceStatus
  remarks: string | null
  recordedBy: number
}

export type NewAttendanceValues = {
  studentId: number
  attendanceDate: string
  status: AttendanceStatus
  remarks?: string
  recordedBy: number
}
