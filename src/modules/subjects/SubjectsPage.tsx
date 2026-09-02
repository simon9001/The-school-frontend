import React, { useState } from 'react'
import { useForm, type SubmitHandler } from 'react-hook-form'
import { useSelector } from 'react-redux'
import { BookOpen, Plus, X, SaveIcon, XCircle, ListTree } from 'lucide-react'
import { Toaster, toast } from 'sonner'
import DashboardLayout from '../../dashboardDesign/DashboardLayout'
import type { RootState } from '../../store/store'
import { useGetAllClassesQuery, useGetStreamsByClassQuery } from '../students/StudentApi'
import { useGetAllPeriodsQuery } from '../finance/PeriodApi'
import { useGetAllTeachersQuery } from '../teachers/TeacherApi'
import {
    useGetAllSubjectsQuery,
    useAddSubjectMutation,
    useGetStrandsBySubjectQuery,
    useAddStrandMutation,
    useGetOfferingsByClassQuery,
    useOfferToClassMutation,
    useGetAssignmentsByClassQuery,
    useAssignTeacherMutation,
} from './SubjectApi'
import type { NewAssignmentValues, NewOfferingValues, NewStrandValues, NewSubjectValues, Subject } from './types'

const blank = <T extends string | undefined>(v: T) => (v ? v : undefined)

// ---- New Subject modal ----

const NewSubjectModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const [addSubject] = useAddSubjectMutation()
    const { register, handleSubmit, formState: { errors } } = useForm<NewSubjectValues>({ defaultValues: { isCompulsory: true } })

    const onSubmit: SubmitHandler<NewSubjectValues> = async (formValues) => {
        const loadingToastId = toast.loading('Creating subject...')
        try {
            await addSubject(formValues).unwrap()
            toast.success('Subject created', { id: loadingToastId })
            onClose()
        } catch (err) {
            const message = (err as { data?: { error?: string } })?.data?.error ?? 'Failed to create subject'
            toast.error(message, { id: loadingToastId })
        }
    }

    return (
        <div className="modal modal-open">
            <div className="modal-box">
                <h2 className="text-xl font-bold text-green-800 mb-4">New Subject</h2>
                <form onSubmit={handleSubmit(onSubmit)}>
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700">Code</label>
                        <input className="input input-bordered w-full" {...register('code', { required: 'Code is required' })} />
                        {errors.code && <p className="text-red-500 text-sm">{errors.code.message}</p>}
                    </div>
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700">Name</label>
                        <input className="input input-bordered w-full" {...register('name', { required: 'Name is required' })} />
                        {errors.name && <p className="text-red-500 text-sm">{errors.name.message}</p>}
                    </div>
                    <div className="mb-6 flex items-center gap-2">
                        <input id="isCompulsory" type="checkbox" className="checkbox checkbox-sm" defaultChecked {...register('isCompulsory')} />
                        <label htmlFor="isCompulsory" className="text-sm text-gray-700">Compulsory subject</label>
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

// ---- Strands modal (CBC) ----

const StrandsModal: React.FC<{ subject: Subject; onClose: () => void }> = ({ subject, onClose }) => {
    const { user } = useSelector((state: RootState) => state.authSlice)
    const canManage = user?.permissions.includes('subjects.manage') ?? false
    const { data: strands, isLoading } = useGetStrandsBySubjectQuery(subject.id)
    const [addStrand] = useAddStrandMutation()
    const { register, handleSubmit, reset, formState: { errors } } = useForm<NewStrandValues>()

    const onSubmit: SubmitHandler<NewStrandValues> = async (formValues) => {
        const loadingToastId = toast.loading('Adding strand...')
        try {
            await addStrand({ subjectId: subject.id, name: formValues.name, description: blank(formValues.description) }).unwrap()
            toast.success('Strand added', { id: loadingToastId })
            reset()
        } catch (err) {
            const message = (err as { data?: { error?: string } })?.data?.error ?? 'Failed to add strand'
            toast.error(message, { id: loadingToastId })
        }
    }

    return (
        <div className="modal modal-open">
            <div className="modal-box max-w-lg">
                <h2 className="text-xl font-bold text-green-800 mb-1">{subject.name} — Strands</h2>
                <p className="text-sm text-gray-500 mb-4">Competency strands for CBC assessment. Leave empty for a subject graded at the whole-subject level (8-4-4/KCSE style).</p>

                {isLoading ? (
                    <div className="flex justify-center py-6"><span className="loading loading-spinner text-green-800"></span></div>
                ) : !strands || strands.length === 0 ? (
                    <div className="bg-gray-50 rounded-lg p-4 text-center text-sm text-gray-500 mb-4">No strands defined yet.</div>
                ) : (
                    <ul className="mb-4 divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden">
                        {strands.map((s) => (
                            <li key={s.id} className="px-3 py-2">
                                <div className="font-medium text-gray-800 text-sm">{s.name}</div>
                                {s.description && <div className="text-xs text-gray-500">{s.description}</div>}
                            </li>
                        ))}
                    </ul>
                )}

                {canManage && (
                    <form onSubmit={handleSubmit(onSubmit)} className="border-t pt-4">
                        <div className="flex gap-2">
                            <div className="flex-1">
                                <input className="input input-bordered input-sm w-full" placeholder="Strand name" {...register('name', { required: true })} />
                                {errors.name && <p className="text-red-500 text-xs mt-1">Strand name is required</p>}
                            </div>
                            <button type="submit" className="btn btn-sm bg-green-800 hover:bg-green-900 text-white">
                                <Plus size={14} /> Add
                            </button>
                        </div>
                        <input className="input input-bordered input-sm w-full mt-2" placeholder="Description (optional)" {...register('description')} />
                    </form>
                )}

                <div className="flex justify-end mt-4">
                    <button type="button" onClick={onClose} className="btn btn-ghost btn-sm"><X size={16} /> Close</button>
                </div>
            </div>
        </div>
    )
}

// ---- Class Offerings tab ----

const OfferingsPanel: React.FC = () => {
    const { user } = useSelector((state: RootState) => state.authSlice)
    const canManage = user?.permissions.includes('subjects.manage') ?? false
    const { data: classes } = useGetAllClassesQuery()
    const { data: subjects } = useGetAllSubjectsQuery()
    const [classId, setClassId] = useState<string>('')
    const { data: offerings, isLoading } = useGetOfferingsByClassQuery(Number(classId), { skip: !classId })
    const [offerToClass] = useOfferToClassMutation()
    const { register, handleSubmit, reset } = useForm<NewOfferingValues>()

    const onSubmit: SubmitHandler<NewOfferingValues> = async (formValues) => {
        const loadingToastId = toast.loading('Offering subject...')
        try {
            await offerToClass({ classId: Number(classId), subjectId: Number(formValues.subjectId) }).unwrap()
            toast.success('Subject offered to class', { id: loadingToastId })
            reset()
        } catch (err) {
            const message = (err as { data?: { error?: string } })?.data?.error ?? 'Failed to offer subject'
            toast.error(message, { id: loadingToastId })
        }
    }

    const subjectLabel = (id: number) => subjects?.find((s) => s.id === id)
    const offeredIds = new Set(offerings?.map((o) => o.subjectId))
    const availableSubjects = subjects?.filter((s) => !offeredIds.has(s.id))

    return (
        <div>
            <div className="mb-4">
                <select value={classId} onChange={(e) => setClassId(e.target.value)} className="select select-bordered select-sm">
                    <option value="">Select a class</option>
                    {classes?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
            </div>

            {!classId ? (
                <div className="bg-white rounded-lg shadow-sm p-8 text-center text-gray-500">Choose a class to see and manage its subject offerings.</div>
            ) : isLoading ? (
                <div className="flex justify-center items-center py-16"><span className="loading loading-spinner loading-lg text-green-800"></span></div>
            ) : (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                    <div className="flex flex-wrap gap-2 mb-4">
                        {offerings && offerings.length > 0 ? offerings.map((o) => {
                            const s = subjectLabel(o.subjectId)
                            return <span key={o.id} className="badge badge-outline">{s?.code ?? o.subjectId} — {s?.name ?? ''}</span>
                        }) : <span className="text-sm text-gray-500">No subjects offered to this class yet.</span>}
                    </div>
                    {canManage && (
                        <form onSubmit={handleSubmit(onSubmit)} className="flex gap-2 border-t pt-4">
                            <select className="select select-bordered select-sm flex-1" {...register('subjectId', { required: true })}>
                                <option value="">Select subject to offer</option>
                                {availableSubjects?.map((s) => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
                            </select>
                            <button type="submit" className="btn btn-sm bg-green-800 hover:bg-green-900 text-white"><Plus size={14} /> Offer</button>
                        </form>
                    )}
                </div>
            )}
        </div>
    )
}

// ---- Teacher Assignments tab ----

const AssignmentsPanel: React.FC = () => {
    const { user } = useSelector((state: RootState) => state.authSlice)
    const canManage = user?.permissions.includes('subjects.manage') ?? false
    const { data: classes } = useGetAllClassesQuery()
    const { data: subjects } = useGetAllSubjectsQuery()
    const { data: teachers } = useGetAllTeachersQuery()
    const { data: periods } = useGetAllPeriodsQuery()
    const [classId, setClassId] = useState<string>('')
    const [periodId, setPeriodId] = useState<string>('')
    const { data: streamsForClass } = useGetStreamsByClassQuery(Number(classId), { skip: !classId })
    const { data: assignments, isLoading } = useGetAssignmentsByClassQuery(
        { classId: Number(classId), periodId: Number(periodId) },
        { skip: !classId || !periodId },
    )
    const [assignTeacher] = useAssignTeacherMutation()
    const { register, handleSubmit, reset } = useForm<NewAssignmentValues>()

    const onSubmit: SubmitHandler<NewAssignmentValues> = async (formValues) => {
        const loadingToastId = toast.loading('Assigning teacher...')
        try {
            await assignTeacher({
                teacherId: Number(formValues.teacherId),
                subjectId: Number(formValues.subjectId),
                classId: Number(classId),
                streamId: formValues.streamId ? Number(formValues.streamId) : undefined,
                periodId: Number(periodId),
            }).unwrap()
            toast.success('Teacher assigned', { id: loadingToastId })
            reset()
        } catch (err) {
            const message = (err as { data?: { error?: string } })?.data?.error ?? 'Failed to assign teacher'
            toast.error(message, { id: loadingToastId })
        }
    }

    const teacherName = (id: number) => teachers?.find((t) => t.id === id)?.fullName ?? `#${id}`
    const subjectLabel = (id: number) => subjects?.find((s) => s.id === id)
    const streamName = (id: number | null) => (id ? streamsForClass?.find((s) => s.id === id)?.name : null)

    return (
        <div>
            <div className="flex items-center gap-3 mb-4">
                <select value={classId} onChange={(e) => setClassId(e.target.value)} className="select select-bordered select-sm">
                    <option value="">Select class</option>
                    {classes?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <select value={periodId} onChange={(e) => setPeriodId(e.target.value)} className="select select-bordered select-sm">
                    <option value="">Select period</option>
                    {periods?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
            </div>

            {!classId || !periodId ? (
                <div className="bg-white rounded-lg shadow-sm p-8 text-center text-gray-500">Choose a class and period to see and manage teacher assignments.</div>
            ) : isLoading ? (
                <div className="flex justify-center items-center py-16"><span className="loading loading-spinner loading-lg text-green-800"></span></div>
            ) : (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                    {assignments && assignments.length > 0 ? (
                        <table className="table table-sm w-full mb-4">
                            <thead>
                                <tr className="bg-gray-50"><th>Subject</th><th>Teacher</th><th>Stream</th></tr>
                            </thead>
                            <tbody>
                                {assignments.map((a) => {
                                    const s = subjectLabel(a.subjectId)
                                    return (
                                        <tr key={a.id}>
                                            <td>{s?.code ?? a.subjectId} — {s?.name ?? ''}</td>
                                            <td>{teacherName(a.teacherId)}</td>
                                            <td>{streamName(a.streamId) ?? <span className="text-gray-400">All streams</span>}</td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    ) : (
                        <p className="text-sm text-gray-500 mb-4">No teacher assignments for this class/period yet.</p>
                    )}

                    {canManage && (
                        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 sm:grid-cols-4 gap-2 border-t pt-4">
                            <select className="select select-bordered select-sm" {...register('subjectId', { required: true })}>
                                <option value="">Subject</option>
                                {subjects?.map((s) => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
                            </select>
                            <select className="select select-bordered select-sm" {...register('teacherId', { required: true })}>
                                <option value="">Teacher</option>
                                {teachers?.map((t) => <option key={t.id} value={t.id}>{t.fullName}</option>)}
                            </select>
                            <select className="select select-bordered select-sm" {...register('streamId')}>
                                <option value="">All streams</option>
                                {streamsForClass?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                            <button type="submit" className="btn btn-sm bg-green-800 hover:bg-green-900 text-white"><Plus size={14} /> Assign</button>
                        </form>
                    )}
                </div>
            )}
        </div>
    )
}

// ---- Page ----

const SubjectsPage: React.FC = () => {
    const { user } = useSelector((state: RootState) => state.authSlice)
    const canManage = user?.permissions.includes('subjects.manage') ?? false
    const [tab, setTab] = useState<'subjects' | 'offerings' | 'assignments'>('subjects')
    const [isAddModalOpen, setIsAddModalOpen] = useState(false)
    const [strandsSubject, setStrandsSubject] = useState<Subject | null>(null)

    const { data: subjects, isLoading, isError } = useGetAllSubjectsQuery()

    return (
        <DashboardLayout>
            <Toaster position="top-right" richColors />

            <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 rounded-lg">
                        <BookOpen className="text-green-800" size={24} />
                    </div>
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Subjects</h1>
                </div>
                {tab === 'subjects' && canManage && (
                    <button onClick={() => setIsAddModalOpen(true)} className="btn bg-green-800 hover:bg-green-900 text-white flex items-center gap-2">
                        <Plus size={16} /> New Subject
                    </button>
                )}
            </div>

            <div role="tablist" className="tabs tabs-boxed mb-4 w-fit">
                <a role="tab" className={`tab ${tab === 'subjects' ? 'tab-active' : ''}`} onClick={() => setTab('subjects')}>Subjects</a>
                <a role="tab" className={`tab ${tab === 'offerings' ? 'tab-active' : ''}`} onClick={() => setTab('offerings')}>Class Offerings</a>
                <a role="tab" className={`tab ${tab === 'assignments' ? 'tab-active' : ''}`} onClick={() => setTab('assignments')}>Teacher Assignments</a>
            </div>

            {tab === 'subjects' && (
                isLoading ? (
                    <div className="flex justify-center items-center py-16"><span className="loading loading-spinner loading-lg text-green-800"></span></div>
                ) : isError ? (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center"><XCircle className="mx-auto text-red-500 mb-3" size={40} /><p className="text-red-700">Unable to load subjects.</p></div>
                ) : !subjects || subjects.length === 0 ? (
                    <div className="bg-white rounded-lg shadow-sm p-8 text-center text-gray-500">No subjects yet.</div>
                ) : (
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                        <div className="overflow-x-auto scroll-fade-x">
                            <table className="table table-zebra w-full">
                                <thead>
                                    <tr className="bg-gray-50">
                                        <th>Code</th>
                                        <th>Name</th>
                                        <th>Compulsory</th>
                                        <th className="text-center">CBC Strands</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {subjects.map((s) => (
                                        <tr key={s.id} className="hover:bg-gray-50">
                                            <td className="font-mono text-sm">{s.code}</td>
                                            <td className="font-medium text-gray-800">{s.name}</td>
                                            <td>{s.isCompulsory ? <span className="badge badge-success">Yes</span> : <span className="badge badge-ghost">No</span>}</td>
                                            <td className="text-center">
                                                <button onClick={() => setStrandsSubject(s)} className="btn btn-ghost btn-xs text-green-800" title="Manage strands">
                                                    <ListTree size={14} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )
            )}

            {tab === 'offerings' && <OfferingsPanel />}
            {tab === 'assignments' && <AssignmentsPanel />}

            {isAddModalOpen && <NewSubjectModal onClose={() => setIsAddModalOpen(false)} />}
            {strandsSubject && <StrandsModal subject={strandsSubject} onClose={() => setStrandsSubject(null)} />}
        </DashboardLayout>
    )
}

export default SubjectsPage
