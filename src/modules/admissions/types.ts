export type AdmissionType = 'placement' | 'transfer' | 'direct'
export type AdmissionStatus = 'pending' | 'interview_scheduled' | 'admitted' | 'waitlisted' | 'rejected' | 'enrolled'
export type AdmissionBoardingStatus = 'day' | 'boarder'

export interface Admission {
  id: number
  applicationNo: string
  admissionType: AdmissionType
  status: AdmissionStatus

  firstName: string
  lastName: string
  otherNames: string | null
  gender: string | null
  dateOfBirth: string | null
  guardianName: string | null
  guardianPhone: string | null
  guardianEmail: string | null
  targetClassId: number
  boardingStatus: AdmissionBoardingStatus

  nemisUpi: string | null

  placementLetterRef: string | null
  kcpeKpseaIndexNo: string | null
  previousInstitutionCode: string | null

  previousSchoolName: string | null
  previousSchoolCode: string | null
  transferReason: string | null
  transferCertificateRef: string | null

  interviewDate: string | null
  interviewerId: number | null
  interviewScore: string | null
  interviewNotes: string | null

  decidedBy: number | null
  decidedAt: string | null
  rejectionReason: string | null

  studentId: number | null
  enrolledAt: string | null

  recordedBy: number
  createdAt: string
}

// ---- Applicant bio, shared by all three intake pathways ----
export type ApplicantBio = {
  firstName: string
  lastName: string
  otherNames?: string
  gender?: string
  dateOfBirth?: string
  guardianName?: string
  guardianPhone?: string
  guardianEmail?: string
  targetClassId: number
  boardingStatus: AdmissionBoardingStatus
  recordedBy: number
}

export type NewPlacementValues = ApplicantBio & {
  nemisUpi: string
  placementLetterRef: string
  kcpeKpseaIndexNo?: string
  previousInstitutionCode?: string
}

export type NewTransferValues = ApplicantBio & {
  nemisUpi: string
  previousSchoolName: string
  previousSchoolCode?: string
  transferReason?: string
  transferCertificateRef?: string
}

export type NewDirectValues = ApplicantBio

export type ScheduleInterviewValues = {
  interviewDate: string
  interviewerId: number
}

export type RecordInterviewResultValues = {
  interviewScore?: string
  interviewNotes?: string
}

export type DecideValues = {
  decision: 'admitted' | 'waitlisted' | 'rejected'
  decidedBy: number
  rejectionReason?: string
}

export type EnrollValues = {
  admissionNo: string
  admissionDate: string
  streamId?: number
}
