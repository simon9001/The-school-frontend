import React, { useEffect, useMemo, useState } from 'react'
import { useSelector } from 'react-redux'
import { CalendarDays, SaveIcon } from 'lucide-react'
import { Toaster, toast } from 'sonner'
import DashboardLayout from '../../dashboardDesign/DashboardLayout'
import { useGetAllClassesQuery, useGetStudentsByClassQuery, useGetAllStudentsQuery } from '../students/StudentApi'
import type { RootState } from '../../store/store'
import { useGetByClassAndDateQuery, useGetByStudentQuery, useMarkAttendanceBulkMutation } from './AttendanceApi'
import type { AttendanceStatus, NewAttendanceValues } from './types'

const todayIso = () => new Date().toISOString().slice(0, 10)

// Plain Tailwind color utilities — DaisyUI badge-* classes are scoped to
// `.badge` elements and render invisible on a bare `<select>`.
const STATUS_SELECT_CLASS: Record<AttendanceStatus, string> = {
    present: 'bg-green-600 text-white',
    absent: 'bg-red-500 text-white',
    late: 'bg-amber-500 text-white',
    excused: 'bg-blue-500 text-white',
}
const STATUS_BADGE_CLASS: Record<AttendanceStatus, string> = {
    present: 'badge-success',
    absent: 'badge-error',
    late: 'badge-warning',
    excused: 'badge-info',
}

// ---- Take Register tab ----

const TakeRegisterPanel: React.FC = () => {
    const { user } = useSelector((state: RootState) => state.authSlice)
    const canManage = user?.permissions.includes('attendance.manage') ?? false
    const { data: classes } = useGetAllClassesQuery()
    const [classId, setClassId] = useState('')
    const [date, setDate] = useState(todayIso())

    const { data: roster, isLoading: rosterLoading } = useGetStudentsByClassQuery(Number(classId), { skip: !classId })
    const { data: existing, isLoading: existingLoading } = useGetByClassAndDateQuery(
        { classId: Number(classId), date },
        { skip: !classId },
    )
    const [markBulk, { isLoading: isSaving }] = useMarkAttendanceBulkMutation()

    const [rows, setRows] = useState<Record<number, { status: AttendanceStatus; remarks: string }>>({})

    useEffect(() => {
        if (!roster) return
        const existingByStudent = new Map(existing?.map((r) => [r.record.studentId, r.record]) ?? [])
        const next: Record<number, { status: AttendanceStatus; remarks: string }> = {}
        for (const student of roster) {
            const existingRecord = existingByStudent.get(student.id)
            next[student.id] = { status: existingRecord?.status ?? 'present', remarks: existingRecord?.remarks ?? '' }
        }
        setRows(next)
    }, [roster, existing])

    const summary = useMemo(() => {
        const counts: Record<AttendanceStatus, number> = { present: 0, absent: 0, late: 0, excused: 0 }
        for (const r of Object.values(rows)) counts[r.status]++
        return counts
    }, [rows])

    const handleSave = async () => {
        if (!roster) return
        const loadingToastId = toast.loading('Saving register...')
        try {
            const records: NewAttendanceValues[] = roster.map((student) => ({
                studentId: student.id,
                attendanceDate: date,
                status: rows[student.id]?.status ?? 'present',
                remarks: rows[student.id]?.remarks || undefined,
                recordedBy: user!.id,
            }))
            await markBulk(records).unwrap()
            toast.success('Register saved', { id: loadingToastId })
        } catch {
            toast.error('Failed to save register', { id: loadingToastId })
        }
    }

    return (
        <div>
            <div className="flex items-center gap-3 mb-4 flex-wrap">
                <select value={classId} onChange={(e) => setClassId(e.target.value)} className="select select-bordered select-sm">
                    <option value="">Select class</option>
                    {classes?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input input-bordered input-sm" />
                {classId && (
                    <div className="flex items-center gap-2 text-xs text-gray-500 ml-auto">
                        <span className="badge badge-success badge-sm">{summary.present} present</span>
                        <span className="badge badge-error badge-sm">{summary.absent} absent</span>
                        <span className="badge badge-warning badge-sm">{summary.late} late</span>
                        <span className="badge badge-info badge-sm">{summary.excused} excused</span>
                    </div>
                )}
            </div>

            {!classId ? (
                <div className="bg-white rounded-lg shadow-sm p-8 text-center text-gray-500">Choose a class and date to take the register.</div>
            ) : rosterLoading || existingLoading ? (
                <div className="flex justify-center items-center py-16"><span className="loading loading-spinner loading-lg text-green-800"></span></div>
            ) : !roster || roster.length === 0 ? (
                <div className="bg-white rounded-lg shadow-sm p-8 text-center text-gray-500">No students in this class.</div>
            ) : (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto scroll-fade-x">
                        <table className="table table-zebra w-full">
                            <thead>
                                <tr className="bg-gray-50">
                                    <th>Admission No.</th>
                                    <th>Name</th>
                                    <th>Status</th>
                                    <th>Remarks</th>
                                </tr>
                            </thead>
                            <tbody>
                                {roster.map((student) => {
                                    const row = rows[student.id] ?? { status: 'present' as AttendanceStatus, remarks: '' }
                                    return (
                                        <tr key={student.id} className="hover:bg-gray-50">
                                            <td className="font-mono text-sm">{student.admissionNo}</td>
                                            <td className="font-medium text-gray-800">{student.firstName} {student.lastName}</td>
                                            <td>
                                                <select
                                                    value={row.status}
                                                    disabled={!canManage}
                                                    onChange={(e) => setRows((prev) => ({ ...prev, [student.id]: { ...row, status: e.target.value as AttendanceStatus } }))}
                                                    className={`select select-bordered select-xs capitalize border-none ${STATUS_SELECT_CLASS[row.status]}`}
                                                >
                                                    <option value="present">Present</option>
                                                    <option value="absent">Absent</option>
                                                    <option value="late">Late</option>
                                                    <option value="excused">Excused</option>
                                                </select>
                                            </td>
                                            <td>
                                                {row.status !== 'present' && (
                                                    <input
                                                        type="text"
                                                        value={row.remarks}
                                                        disabled={!canManage}
                                                        onChange={(e) => setRows((prev) => ({ ...prev, [student.id]: { ...row, remarks: e.target.value } }))}
                                                        className="input input-bordered input-xs w-full"
                                                        placeholder="Optional remarks"
                                                    />
                                                )}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                    {canManage && (
                        <div className="flex justify-end p-3 border-t border-gray-100">
                            <button onClick={handleSave} disabled={isSaving} className="btn bg-green-800 hover:bg-green-900 text-white btn-sm">
                                <SaveIcon size={14} /> {isSaving ? 'Saving...' : 'Save Register'}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

// ---- Student History tab ----

const StudentHistoryPanel: React.FC = () => {
    const { data: students } = useGetAllStudentsQuery()
    const [studentId, setStudentId] = useState('')
    const { data: records, isLoading } = useGetByStudentQuery(Number(studentId), { skip: !studentId })

    return (
        <div>
            <div className="mb-4">
                <select value={studentId} onChange={(e) => setStudentId(e.target.value)} className="select select-bordered select-sm">
                    <option value="">Select student</option>
                    {students?.map((s) => <option key={s.id} value={s.id}>{s.admissionNo} — {s.firstName} {s.lastName}</option>)}
                </select>
            </div>

            {!studentId ? (
                <div className="bg-white rounded-lg shadow-sm p-8 text-center text-gray-500">Choose a student to see their attendance history.</div>
            ) : isLoading ? (
                <div className="flex justify-center items-center py-16"><span className="loading loading-spinner loading-lg text-green-800"></span></div>
            ) : !records || records.length === 0 ? (
                <div className="bg-white rounded-lg shadow-sm p-8 text-center text-gray-500">No attendance records yet.</div>
            ) : (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <table className="table table-zebra w-full">
                        <thead>
                            <tr className="bg-gray-50"><th>Date</th><th>Status</th><th>Remarks</th></tr>
                        </thead>
                        <tbody>
                            {[...records].sort((a, b) => b.attendanceDate.localeCompare(a.attendanceDate)).map((r) => (
                                <tr key={r.id} className="hover:bg-gray-50">
                                    <td>{r.attendanceDate}</td>
                                    <td><span className={`badge ${STATUS_BADGE_CLASS[r.status]} capitalize`}>{r.status}</span></td>
                                    <td className="text-sm text-gray-600">{r.remarks ?? '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}

// ---- Page ----

const AttendancePage: React.FC = () => {
    const [tab, setTab] = useState<'register' | 'history'>('register')

    return (
        <DashboardLayout>
            <Toaster position="top-right" richColors />

            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-green-100 rounded-lg">
                    <CalendarDays className="text-green-800" size={24} />
                </div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Attendance</h1>
            </div>

            <div role="tablist" className="tabs tabs-boxed mb-4 w-fit">
                <a role="tab" className={`tab ${tab === 'register' ? 'tab-active' : ''}`} onClick={() => setTab('register')}>Take Register</a>
                <a role="tab" className={`tab ${tab === 'history' ? 'tab-active' : ''}`} onClick={() => setTab('history')}>Student History</a>
            </div>

            {tab === 'register' ? <TakeRegisterPanel /> : <StudentHistoryPanel />}
        </DashboardLayout>
    )
}

export default AttendancePage
