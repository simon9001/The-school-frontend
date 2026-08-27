import React, { useState } from 'react'
import { useForm, type SubmitHandler } from 'react-hook-form'
import { useSelector } from 'react-redux'
import { CalendarRange, Plus, X, SaveIcon, XCircle, Trash2 } from 'lucide-react'
import { Toaster, toast } from 'sonner'
import Swal from 'sweetalert2'
import DashboardLayout from '../../dashboardDesign/DashboardLayout'
import { useGetAllClassesQuery, useGetStreamsByClassQuery } from '../students/StudentApi'
import { useGetAllPeriodsQuery } from '../finance/PeriodApi'
import { useGetAllSubjectsQuery } from '../subjects/SubjectApi'
import { useGetAllTeachersQuery } from '../teachers/TeacherApi'
import type { RootState } from '../../store/store'
import {
    useGetLessonPeriodsQuery,
    useCreateLessonPeriodMutation,
    useGetClassTimetableQuery,
    useCreateEntryMutation,
    useDeleteEntryMutation,
    useGetTeacherWorkloadQuery,
} from './TimetableApi'
import { DAYS_OF_WEEK, type DayOfWeek, type NewLessonPeriodValues, type TimetableEntry } from './types'

const DAY_LABEL: Record<DayOfWeek, string> = {
    monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu', friday: 'Fri', saturday: 'Sat',
}

// ---- New Lesson Period modal ----

const NewLessonPeriodModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const [createLessonPeriod] = useCreateLessonPeriodMutation()
    const { register, handleSubmit, formState: { errors } } = useForm<NewLessonPeriodValues>()

    const onSubmit: SubmitHandler<NewLessonPeriodValues> = async (formValues) => {
        const loadingToastId = toast.loading('Creating lesson period...')
        try {
            await createLessonPeriod({ ...formValues, sortOrder: Number(formValues.sortOrder) }).unwrap()
            toast.success('Lesson period created', { id: loadingToastId })
            onClose()
        } catch (err) {
            const message = (err as { data?: { error?: string } })?.data?.error ?? 'Failed to create lesson period'
            toast.error(message, { id: loadingToastId })
        }
    }

    return (
        <div className="modal modal-open">
            <div className="modal-box">
                <h2 className="text-xl font-bold text-green-800 mb-4">New Lesson Period</h2>
                <form onSubmit={handleSubmit(onSubmit)}>
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700">Name</label>
                        <input className="input input-bordered w-full" placeholder="e.g. Period 1" {...register('name', { required: 'Name is required' })} />
                        {errors.name && <p className="text-red-500 text-sm">{errors.name.message}</p>}
                    </div>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Start Time</label>
                            <input type="time" className="input input-bordered w-full" {...register('startTime', { required: true })} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">End Time</label>
                            <input type="time" className="input input-bordered w-full" {...register('endTime', { required: true })} />
                        </div>
                    </div>
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700">Sort Order</label>
                        <input type="number" className="input input-bordered w-full" placeholder="1" {...register('sortOrder', { required: true })} />
                        <p className="text-xs text-gray-400 mt-1">Controls display order on the timetable grid (1, 2, 3...).</p>
                    </div>
                    <div className="flex justify-end gap-2">
                        <button type="button" onClick={onClose} className="btn btn-ghost"><X size={16} /> Cancel</button>
                        <button type="submit" className="btn bg-green-800 hover:bg-green-900 text-white"><SaveIcon size={16} /> Save</button>
                    </div>
                </form>
            </div>
        </div>
    )
}

// ---- Add Entry modal (opened by clicking an empty grid cell) ----

const AddEntryModal: React.FC<{
    classId: number
    streamId: string
    periodId: number
    lessonPeriodId: number
    dayOfWeek: DayOfWeek
    lessonPeriodName: string
    onClose: () => void
}> = ({ classId, streamId, periodId, lessonPeriodId, dayOfWeek, lessonPeriodName, onClose }) => {
    const { data: subjects } = useGetAllSubjectsQuery()
    const { data: teachers } = useGetAllTeachersQuery()
    const [createEntry] = useCreateEntryMutation()
    const { register, handleSubmit, formState: { errors } } = useForm<{ subjectId: number; teacherId: number }>()

    const onSubmit: SubmitHandler<{ subjectId: number; teacherId: number }> = async (formValues) => {
        const loadingToastId = toast.loading('Scheduling lesson...')
        try {
            await createEntry({
                classId,
                streamId: streamId ? Number(streamId) : undefined,
                subjectId: Number(formValues.subjectId),
                teacherId: Number(formValues.teacherId),
                lessonPeriodId,
                dayOfWeek,
                periodId,
            }).unwrap()
            toast.success('Lesson scheduled', { id: loadingToastId })
            onClose()
        } catch (err) {
            const message = (err as { data?: { error?: string } })?.data?.error ?? 'Failed to schedule lesson'
            toast.error(message, { id: loadingToastId })
        }
    }

    return (
        <div className="modal modal-open">
            <div className="modal-box">
                <h2 className="text-xl font-bold text-green-800 mb-1">Schedule Lesson</h2>
                <p className="text-sm text-gray-500 mb-4">{DAY_LABEL[dayOfWeek]} — {lessonPeriodName}</p>
                <form onSubmit={handleSubmit(onSubmit)}>
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700">Subject</label>
                        <select className="select select-bordered w-full" {...register('subjectId', { required: 'Subject is required' })}>
                            <option value="">Select subject</option>
                            {subjects?.map((s) => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
                        </select>
                        {errors.subjectId && <p className="text-red-500 text-sm">{errors.subjectId.message}</p>}
                    </div>
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700">Teacher</label>
                        <select className="select select-bordered w-full" {...register('teacherId', { required: 'Teacher is required' })}>
                            <option value="">Select teacher</option>
                            {teachers?.map((t) => <option key={t.id} value={t.id}>{t.fullName}</option>)}
                        </select>
                        {errors.teacherId && <p className="text-red-500 text-sm">{errors.teacherId.message}</p>}
                    </div>
                    <div className="flex justify-end gap-2">
                        <button type="button" onClick={onClose} className="btn btn-ghost"><X size={16} /> Cancel</button>
                        <button type="submit" className="btn bg-green-800 hover:bg-green-900 text-white"><SaveIcon size={16} /> Schedule</button>
                    </div>
                </form>
            </div>
        </div>
    )
}

// ---- Class Timetable tab ----

const ClassTimetablePanel: React.FC = () => {
    const { user } = useSelector((state: RootState) => state.authSlice)
    const canManage = user?.permissions.includes('timetable.manage') ?? false

    const { data: classes } = useGetAllClassesQuery()
    const { data: subjects } = useGetAllSubjectsQuery()
    const { data: teachers } = useGetAllTeachersQuery()
    const { data: periods } = useGetAllPeriodsQuery()
    const { data: lessonPeriods } = useGetLessonPeriodsQuery()

    const [classId, setClassId] = useState('')
    const [streamId, setStreamId] = useState('')
    const [periodId, setPeriodId] = useState('')
    const { data: streamsForClass } = useGetStreamsByClassQuery(Number(classId), { skip: !classId })
    const { data: entries, isLoading } = useGetClassTimetableQuery(
        { classId: Number(classId), periodId: Number(periodId) },
        { skip: !classId || !periodId },
    )
    const [deleteEntry] = useDeleteEntryMutation()
    const [targetCell, setTargetCell] = useState<{ lessonPeriodId: number; dayOfWeek: DayOfWeek; lessonPeriodName: string } | null>(null)

    const subjectLabel = (id: number) => subjects?.find((s) => s.id === id)
    const teacherName = (id: number) => teachers?.find((t) => t.id === id)?.fullName ?? `#${id}`
    const entryAt = (lessonPeriodId: number, day: DayOfWeek): TimetableEntry | undefined =>
        entries?.find((e) => e.lessonPeriodId === lessonPeriodId && e.dayOfWeek === day)

    const handleDelete = (entry: TimetableEntry) => {
        Swal.fire({
            title: 'Remove this lesson?',
            text: `${subjectLabel(entry.subjectId)?.name ?? 'This lesson'} will be removed from the timetable.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#166534',
            cancelButtonColor: '#dc2626',
            confirmButtonText: 'Yes, remove',
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    await deleteEntry(entry.id).unwrap()
                    Swal.fire('Removed', '', 'success')
                } catch {
                    Swal.fire('Something went wrong', 'Please try again', 'error')
                }
            }
        })
    }

    return (
        <div>
            <div className="flex items-center gap-3 mb-4 flex-wrap">
                <select value={classId} onChange={(e) => { setClassId(e.target.value); setStreamId('') }} className="select select-bordered select-sm">
                    <option value="">Select class</option>
                    {classes?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <select value={streamId} onChange={(e) => setStreamId(e.target.value)} className="select select-bordered select-sm" disabled={!classId}>
                    <option value="">All streams</option>
                    {streamsForClass?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <select value={periodId} onChange={(e) => setPeriodId(e.target.value)} className="select select-bordered select-sm">
                    <option value="">Select term</option>
                    {periods?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
            </div>

            {!classId || !periodId ? (
                <div className="bg-white rounded-lg shadow-sm p-8 text-center text-gray-500">Choose a class and term to view its timetable.</div>
            ) : !lessonPeriods || lessonPeriods.length === 0 ? (
                <div className="bg-white rounded-lg shadow-sm p-8 text-center text-gray-500">No lesson periods defined yet — add some in the "Lesson Periods" tab first.</div>
            ) : isLoading ? (
                <div className="flex justify-center items-center py-16"><span className="loading loading-spinner loading-lg text-green-800"></span></div>
            ) : (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="table w-full">
                            <thead>
                                <tr className="bg-gray-50">
                                    <th className="whitespace-nowrap">Period</th>
                                    {DAYS_OF_WEEK.map((d) => <th key={d} className="text-center">{DAY_LABEL[d]}</th>)}
                                </tr>
                            </thead>
                            <tbody>
                                {lessonPeriods.map((lp) => (
                                    <tr key={lp.id}>
                                        <td className="whitespace-nowrap">
                                            <div className="font-medium text-gray-800 text-sm">{lp.name}</div>
                                            <div className="text-xs text-gray-400">{lp.startTime}–{lp.endTime}</div>
                                        </td>
                                        {DAYS_OF_WEEK.map((day) => {
                                            const entry = entryAt(lp.id, day)
                                            return (
                                                <td key={day} className="text-center align-top p-1">
                                                    {entry ? (
                                                        <div className="bg-green-50 border border-green-200 rounded-lg p-2 text-left relative group">
                                                            <div className="text-xs font-semibold text-green-800">{subjectLabel(entry.subjectId)?.code ?? entry.subjectId}</div>
                                                            <div className="text-xs text-gray-600">{teacherName(entry.teacherId)}</div>
                                                            {canManage && (
                                                                <button
                                                                    onClick={() => handleDelete(entry)}
                                                                    className="absolute top-1 right-1 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                                                    title="Remove"
                                                                >
                                                                    <Trash2 size={12} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    ) : canManage ? (
                                                        <button
                                                            onClick={() => setTargetCell({ lessonPeriodId: lp.id, dayOfWeek: day, lessonPeriodName: lp.name })}
                                                            className="w-full h-12 rounded-lg border border-dashed border-gray-200 text-gray-300 hover:border-green-400 hover:text-green-600 flex items-center justify-center"
                                                        >
                                                            <Plus size={14} />
                                                        </button>
                                                    ) : (
                                                        <div className="h-12"></div>
                                                    )}
                                                </td>
                                            )
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {targetCell && (
                <AddEntryModal
                    classId={Number(classId)}
                    streamId={streamId}
                    periodId={Number(periodId)}
                    lessonPeriodId={targetCell.lessonPeriodId}
                    dayOfWeek={targetCell.dayOfWeek}
                    lessonPeriodName={targetCell.lessonPeriodName}
                    onClose={() => setTargetCell(null)}
                />
            )}
        </div>
    )
}

// ---- Lesson Periods tab ----

const LessonPeriodsPanel: React.FC<{ onAdd: () => void }> = ({ onAdd }) => {
    const { user } = useSelector((state: RootState) => state.authSlice)
    const canManage = user?.permissions.includes('timetable.manage') ?? false
    const { data: lessonPeriods, isLoading, isError } = useGetLessonPeriodsQuery()

    return (
        <div>
            <div className="flex justify-end mb-4">
                {canManage && (
                    <button onClick={onAdd} className="btn btn-sm bg-green-800 hover:bg-green-900 text-white flex items-center gap-2">
                        <Plus size={14} /> New Lesson Period
                    </button>
                )}
            </div>
            {isLoading ? (
                <div className="flex justify-center items-center py-16"><span className="loading loading-spinner loading-lg text-green-800"></span></div>
            ) : isError ? (
                <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center"><XCircle className="mx-auto text-red-500 mb-3" size={40} /><p className="text-red-700">Unable to load lesson periods.</p></div>
            ) : !lessonPeriods || lessonPeriods.length === 0 ? (
                <div className="bg-white rounded-lg shadow-sm p-8 text-center text-gray-500">No lesson periods defined yet.</div>
            ) : (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <table className="table table-zebra w-full">
                        <thead>
                            <tr className="bg-gray-50"><th>Sort</th><th>Name</th><th>Start</th><th>End</th></tr>
                        </thead>
                        <tbody>
                            {lessonPeriods.map((lp) => (
                                <tr key={lp.id}>
                                    <td className="text-gray-400">{lp.sortOrder}</td>
                                    <td className="font-medium text-gray-800">{lp.name}</td>
                                    <td>{lp.startTime}</td>
                                    <td>{lp.endTime}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}

// ---- Teacher Workload tab ----

const WorkloadPanel: React.FC = () => {
    const { data: teachers } = useGetAllTeachersQuery()
    const { data: subjects } = useGetAllSubjectsQuery()
    const { data: periods } = useGetAllPeriodsQuery()
    const [teacherId, setTeacherId] = useState('')
    const [periodId, setPeriodId] = useState('')
    const { data: workload, isLoading } = useGetTeacherWorkloadQuery(
        { teacherId: Number(teacherId), periodId: Number(periodId) },
        { skip: !teacherId || !periodId },
    )

    const subjectLabel = (id: number) => subjects?.find((s) => s.id === id)

    return (
        <div>
            <div className="flex items-center gap-3 mb-4">
                <select value={teacherId} onChange={(e) => setTeacherId(e.target.value)} className="select select-bordered select-sm">
                    <option value="">Select teacher</option>
                    {teachers?.map((t) => <option key={t.id} value={t.id}>{t.fullName}</option>)}
                </select>
                <select value={periodId} onChange={(e) => setPeriodId(e.target.value)} className="select select-bordered select-sm">
                    <option value="">Select term</option>
                    {periods?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
            </div>

            {!teacherId || !periodId ? (
                <div className="bg-white rounded-lg shadow-sm p-8 text-center text-gray-500">Choose a teacher and term to see their weekly workload.</div>
            ) : isLoading ? (
                <div className="flex justify-center items-center py-16"><span className="loading loading-spinner loading-lg text-green-800"></span></div>
            ) : !workload ? (
                <div className="bg-white rounded-lg shadow-sm p-8 text-center text-gray-500">No data.</div>
            ) : (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <div className="text-3xl font-bold text-green-800 mb-1">{workload.totalPeriodsPerWeek}</div>
                    <div className="text-sm text-gray-500 mb-4">lesson periods per week</div>
                    {workload.bySubject.length === 0 ? (
                        <p className="text-sm text-gray-500">No lessons scheduled this term.</p>
                    ) : (
                        <div className="flex flex-wrap gap-2">
                            {workload.bySubject.map((s) => (
                                <span key={s.subjectId} className="badge badge-outline">
                                    {subjectLabel(s.subjectId)?.name ?? s.subjectId}: {s.periodsPerWeek}/wk
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

// ---- Page ----

const TimetablePage: React.FC = () => {
    const [tab, setTab] = useState<'timetable' | 'periods' | 'workload'>('timetable')
    const [isPeriodModalOpen, setIsPeriodModalOpen] = useState(false)

    return (
        <DashboardLayout>
            <Toaster position="top-right" richColors />

            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-green-100 rounded-lg">
                    <CalendarRange className="text-green-800" size={24} />
                </div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Timetable</h1>
            </div>

            <div role="tablist" className="tabs tabs-boxed mb-4 w-fit">
                <a role="tab" className={`tab ${tab === 'timetable' ? 'tab-active' : ''}`} onClick={() => setTab('timetable')}>Class Timetable</a>
                <a role="tab" className={`tab ${tab === 'periods' ? 'tab-active' : ''}`} onClick={() => setTab('periods')}>Lesson Periods</a>
                <a role="tab" className={`tab ${tab === 'workload' ? 'tab-active' : ''}`} onClick={() => setTab('workload')}>Teacher Workload</a>
            </div>

            {tab === 'timetable' && <ClassTimetablePanel />}
            {tab === 'periods' && <LessonPeriodsPanel onAdd={() => setIsPeriodModalOpen(true)} />}
            {tab === 'workload' && <WorkloadPanel />}

            {isPeriodModalOpen && <NewLessonPeriodModal onClose={() => setIsPeriodModalOpen(false)} />}
        </DashboardLayout>
    )
}

export default TimetablePage
