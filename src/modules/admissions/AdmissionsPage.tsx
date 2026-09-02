import React, { useState } from 'react'
import { useForm, type SubmitHandler } from 'react-hook-form'
import { useSelector } from 'react-redux'
import { UserSquare2, Plus, X, SaveIcon, XCircle, Eye } from 'lucide-react'
import { Toaster, toast } from 'sonner'
import DashboardLayout from '../../dashboardDesign/DashboardLayout'
import { useGetAllClassesQuery, useGetStreamsByClassQuery } from '../students/StudentApi'
import type { RootState } from '../../store/store'
import {
    useGetAllAdmissionsQuery,
    useCapturePlacementMutation,
    useCaptureTransferMutation,
    useApplyDirectMutation,
    useScheduleInterviewMutation,
    useRecordInterviewResultMutation,
    useDecideAdmissionMutation,
    useEnrollAdmissionMutation,
} from './AdmissionApi'
import type {
    Admission,
    AdmissionType,
    DecideValues,
    EnrollValues,
    NewDirectValues,
    NewPlacementValues,
    NewTransferValues,
    RecordInterviewResultValues,
    ScheduleInterviewValues,
} from './types'

const STATUS_BADGE: Record<string, string> = {
    pending: 'badge-ghost',
    interview_scheduled: 'badge-info',
    admitted: 'badge-success',
    waitlisted: 'badge-warning',
    rejected: 'badge-error',
    enrolled: 'badge-success',
}

const TYPE_LABEL: Record<AdmissionType, string> = {
    placement: 'Government Placement',
    transfer: 'Transfer',
    direct: 'Direct Application',
}

const blank = <T extends string | undefined>(v: T) => (v ? v : undefined)

// ---- New application modal — one shared bio section, tabbed by pathway ----

const NewApplicationModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const { user } = useSelector((state: RootState) => state.authSlice)
    const [pathway, setPathway] = useState<AdmissionType>('direct')
    const { data: classes } = useGetAllClassesQuery()

    const [capturePlacement] = useCapturePlacementMutation()
    const [captureTransfer] = useCaptureTransferMutation()
    const [applyDirect] = useApplyDirectMutation()

    const { register, handleSubmit, formState: { errors } } = useForm<NewPlacementValues & NewTransferValues & NewDirectValues>()

    const onSubmit: SubmitHandler<NewPlacementValues & NewTransferValues & NewDirectValues> = async (formValues) => {
        const loadingToastId = toast.loading('Recording application...')
        try {
            const common = {
                firstName: formValues.firstName,
                lastName: formValues.lastName,
                otherNames: blank(formValues.otherNames),
                gender: blank(formValues.gender),
                dateOfBirth: blank(formValues.dateOfBirth),
                guardianName: blank(formValues.guardianName),
                guardianPhone: blank(formValues.guardianPhone),
                guardianEmail: blank(formValues.guardianEmail),
                targetClassId: Number(formValues.targetClassId),
                boardingStatus: formValues.boardingStatus,
                recordedBy: user!.id,
            }

            if (pathway === 'placement') {
                await capturePlacement({
                    ...common,
                    nemisUpi: formValues.nemisUpi,
                    placementLetterRef: formValues.placementLetterRef,
                    kcpeKpseaIndexNo: blank(formValues.kcpeKpseaIndexNo),
                    previousInstitutionCode: blank(formValues.previousInstitutionCode),
                }).unwrap()
            } else if (pathway === 'transfer') {
                await captureTransfer({
                    ...common,
                    nemisUpi: formValues.nemisUpi,
                    previousSchoolName: formValues.previousSchoolName,
                    previousSchoolCode: blank(formValues.previousSchoolCode),
                    transferReason: blank(formValues.transferReason),
                    transferCertificateRef: blank(formValues.transferCertificateRef),
                }).unwrap()
            } else {
                await applyDirect(common).unwrap()
            }

            toast.success('Application recorded', { id: loadingToastId })
            onClose()
        } catch (err) {
            const message = (err as { data?: { error?: string } })?.data?.error ?? 'Failed to record application'
            toast.error(message, { id: loadingToastId })
        }
    }

    return (
        <div className="modal modal-open">
            <div className="modal-box max-w-2xl">
                <h2 className="text-xl font-bold text-green-800 mb-4">New Application</h2>

                <div role="tablist" className="tabs tabs-boxed mb-4 w-fit">
                    {(['direct', 'placement', 'transfer'] as AdmissionType[]).map((t) => (
                        <a key={t} role="tab" className={`tab ${pathway === t ? 'tab-active' : ''}`} onClick={() => setPathway(t)}>
                            {TYPE_LABEL[t]}
                        </a>
                    ))}
                </div>

                <form onSubmit={handleSubmit(onSubmit)}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">First Name</label>
                            <input className="input input-bordered w-full" {...register('firstName', { required: 'First name is required' })} />
                            {errors.firstName && <p className="text-red-500 text-sm">{errors.firstName.message}</p>}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Last Name</label>
                            <input className="input input-bordered w-full" {...register('lastName', { required: 'Last name is required' })} />
                            {errors.lastName && <p className="text-red-500 text-sm">{errors.lastName.message}</p>}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Other Names</label>
                            <input className="input input-bordered w-full" {...register('otherNames')} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Gender</label>
                            <select className="select select-bordered w-full" {...register('gender')}>
                                <option value="">—</option>
                                <option value="male">Male</option>
                                <option value="female">Female</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Date of Birth</label>
                            <input type="date" className="input input-bordered w-full" {...register('dateOfBirth')} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Boarding Status</label>
                            <select className="select select-bordered w-full" defaultValue="day" {...register('boardingStatus', { required: true })}>
                                <option value="day">Day</option>
                                <option value="boarder">Boarder</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Target Class</label>
                            <select className="select select-bordered w-full" {...register('targetClassId', { required: 'Target class is required' })}>
                                <option value="">Select class</option>
                                {classes?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                            {errors.targetClassId && <p className="text-red-500 text-sm">{errors.targetClassId.message}</p>}
                        </div>
                    </div>

                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Guardian</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                        <input className="input input-bordered w-full" placeholder="Name" {...register('guardianName')} />
                        <input className="input input-bordered w-full" placeholder="Phone" {...register('guardianPhone')} />
                        <input type="email" className="input input-bordered w-full sm:col-span-2" placeholder="Email" {...register('guardianEmail')} />
                    </div>

                    {pathway === 'placement' && (
                        <>
                            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Placement Details</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">NEMIS UPI</label>
                                    <input className="input input-bordered w-full" {...register('nemisUpi', { required: 'NEMIS UPI is required' })} />
                                    {errors.nemisUpi && <p className="text-red-500 text-sm">{errors.nemisUpi.message}</p>}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Placement Letter Ref.</label>
                                    <input className="input input-bordered w-full" {...register('placementLetterRef', { required: 'Placement letter reference is required' })} />
                                    {errors.placementLetterRef && <p className="text-red-500 text-sm">{errors.placementLetterRef.message}</p>}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">KCPE/KPSEA Index No.</label>
                                    <input className="input input-bordered w-full" {...register('kcpeKpseaIndexNo')} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Previous Institution Code</label>
                                    <input className="input input-bordered w-full" {...register('previousInstitutionCode')} />
                                </div>
                            </div>
                        </>
                    )}

                    {pathway === 'transfer' && (
                        <>
                            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Transfer Details</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">NEMIS UPI</label>
                                    <input className="input input-bordered w-full" {...register('nemisUpi', { required: 'NEMIS UPI is required' })} />
                                    {errors.nemisUpi && <p className="text-red-500 text-sm">{errors.nemisUpi.message}</p>}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Previous School Name</label>
                                    <input className="input input-bordered w-full" {...register('previousSchoolName', { required: 'Previous school is required' })} />
                                    {errors.previousSchoolName && <p className="text-red-500 text-sm">{errors.previousSchoolName.message}</p>}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Previous School Code</label>
                                    <input className="input input-bordered w-full" {...register('previousSchoolCode')} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Transfer Certificate Ref.</label>
                                    <input className="input input-bordered w-full" {...register('transferCertificateRef')} />
                                </div>
                                <div className="sm:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700">Reason for Transfer</label>
                                    <textarea className="textarea textarea-bordered w-full" {...register('transferReason')} />
                                </div>
                            </div>
                        </>
                    )}

                    {pathway === 'direct' && (
                        <p className="text-sm text-gray-500 mb-6">
                            Direct applications go through an interview before a decision is made — no additional fields needed here.
                        </p>
                    )}

                    <div className="flex justify-end gap-2">
                        <button type="button" onClick={onClose} className="btn btn-ghost">
                            <X size={16} /> Cancel
                        </button>
                        <button type="submit" className="btn bg-green-800 hover:bg-green-900 text-white">
                            <SaveIcon size={16} /> Save
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

// ---- Detail modal — record view + the one action valid for its current stage ----

const ScheduleInterviewForm: React.FC<{ admissionId: number; defaultInterviewerId: number; onDone: () => void }> = ({ admissionId, defaultInterviewerId, onDone }) => {
    const [scheduleInterview] = useScheduleInterviewMutation()
    const { register, handleSubmit } = useForm<ScheduleInterviewValues>({ defaultValues: { interviewerId: defaultInterviewerId } })

    const onSubmit: SubmitHandler<ScheduleInterviewValues> = async (values) => {
        const loadingToastId = toast.loading('Scheduling interview...')
        try {
            await scheduleInterview({ id: admissionId, values: { ...values, interviewerId: Number(values.interviewerId) } }).unwrap()
            toast.success('Interview scheduled', { id: loadingToastId })
            onDone()
        } catch (err) {
            const message = (err as { data?: { error?: string } })?.data?.error ?? 'Failed to schedule interview'
            toast.error(message, { id: loadingToastId })
        }
    }

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="border-t pt-4 mt-4">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Schedule Interview</h3>
            <div className="grid grid-cols-2 gap-4 mb-3">
                <div>
                    <label className="block text-sm font-medium text-gray-700">Interview Date</label>
                    <input type="date" className="input input-bordered w-full" {...register('interviewDate', { required: true })} />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Interviewer (User ID)</label>
                    <input type="number" className="input input-bordered w-full" {...register('interviewerId', { required: true })} />
                </div>
            </div>
            <button type="submit" className="btn btn-sm bg-green-800 hover:bg-green-900 text-white">Schedule</button>
        </form>
    )
}

const RecordResultForm: React.FC<{ admissionId: number; onDone: () => void }> = ({ admissionId, onDone }) => {
    const [recordInterviewResult] = useRecordInterviewResultMutation()
    const { register, handleSubmit } = useForm<RecordInterviewResultValues>()

    const onSubmit: SubmitHandler<RecordInterviewResultValues> = async (values) => {
        const loadingToastId = toast.loading('Recording result...')
        try {
            await recordInterviewResult({ id: admissionId, values: { interviewScore: blank(values.interviewScore), interviewNotes: blank(values.interviewNotes) } }).unwrap()
            toast.success('Interview result recorded', { id: loadingToastId })
            onDone()
        } catch (err) {
            const message = (err as { data?: { error?: string } })?.data?.error ?? 'Failed to record result'
            toast.error(message, { id: loadingToastId })
        }
    }

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="border-t pt-4 mt-4">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Record Interview Result</h3>
            <div className="grid grid-cols-2 gap-4 mb-3">
                <div>
                    <label className="block text-sm font-medium text-gray-700">Score</label>
                    <input className="input input-bordered w-full" {...register('interviewScore')} />
                </div>
                <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700">Notes</label>
                    <textarea className="textarea textarea-bordered w-full" {...register('interviewNotes')} />
                </div>
            </div>
            <button type="submit" className="btn btn-sm bg-green-800 hover:bg-green-900 text-white">Save Result</button>
        </form>
    )
}

const DecideForm: React.FC<{ admissionId: number; defaultDecidedBy: number; onDone: () => void }> = ({ admissionId, defaultDecidedBy, onDone }) => {
    const [decideAdmission] = useDecideAdmissionMutation()
    const { register, handleSubmit, watch } = useForm<DecideValues>({ defaultValues: { decidedBy: defaultDecidedBy, decision: 'admitted' } })
    const decision = watch('decision')

    const onSubmit: SubmitHandler<DecideValues> = async (values) => {
        const loadingToastId = toast.loading('Recording decision...')
        try {
            await decideAdmission({ id: admissionId, values: { ...values, decidedBy: Number(values.decidedBy), rejectionReason: blank(values.rejectionReason) } }).unwrap()
            toast.success('Decision recorded', { id: loadingToastId })
            onDone()
        } catch (err) {
            const message = (err as { data?: { error?: string } })?.data?.error ?? 'Failed to record decision'
            toast.error(message, { id: loadingToastId })
        }
    }

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="border-t pt-4 mt-4">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Decide</h3>
            <div className="grid grid-cols-2 gap-4 mb-3">
                <div>
                    <label className="block text-sm font-medium text-gray-700">Decision</label>
                    <select className="select select-bordered w-full" {...register('decision', { required: true })}>
                        <option value="admitted">Admit</option>
                        <option value="waitlisted">Waitlist</option>
                        <option value="rejected">Reject</option>
                    </select>
                </div>
                {decision === 'rejected' && (
                    <div className="col-span-2">
                        <label className="block text-sm font-medium text-gray-700">Rejection Reason</label>
                        <textarea className="textarea textarea-bordered w-full" {...register('rejectionReason', { required: 'A reason is required to reject' })} />
                    </div>
                )}
            </div>
            <button type="submit" className="btn btn-sm bg-green-800 hover:bg-green-900 text-white">Submit Decision</button>
        </form>
    )
}

const EnrollForm: React.FC<{ admission: Admission; onDone: () => void }> = ({ admission, onDone }) => {
    const [enrollAdmission] = useEnrollAdmissionMutation()
    const { data: streams } = useGetStreamsByClassQuery(admission.targetClassId)
    const { register, handleSubmit } = useForm<EnrollValues>({ defaultValues: { admissionDate: new Date().toISOString().slice(0, 10) } })

    const onSubmit: SubmitHandler<EnrollValues> = async (values) => {
        const loadingToastId = toast.loading('Enrolling student...')
        try {
            await enrollAdmission({ id: admission.id, values: { ...values, streamId: values.streamId ? Number(values.streamId) : undefined } }).unwrap()
            toast.success('Student enrolled', { id: loadingToastId })
            onDone()
        } catch (err) {
            const message = (err as { data?: { error?: string } })?.data?.error ?? 'Failed to enroll student'
            toast.error(message, { id: loadingToastId })
        }
    }

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="border-t pt-4 mt-4">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Enroll as Student</h3>
            <div className="grid grid-cols-2 gap-4 mb-3">
                <div>
                    <label className="block text-sm font-medium text-gray-700">Admission No.</label>
                    <input className="input input-bordered w-full" {...register('admissionNo', { required: true })} />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Admission Date</label>
                    <input type="date" className="input input-bordered w-full" {...register('admissionDate', { required: true })} />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Stream</label>
                    <select className="select select-bordered w-full" {...register('streamId')}>
                        <option value="">—</option>
                        {streams?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                </div>
            </div>
            <button type="submit" className="btn btn-sm bg-green-800 hover:bg-green-900 text-white">Enroll</button>
        </form>
    )
}

const DetailModal: React.FC<{ admission: Admission; onClose: () => void }> = ({ admission, onClose }) => {
    const { user } = useSelector((state: RootState) => state.authSlice)
    const { data: classes } = useGetAllClassesQuery()

    return (
        <div className="modal modal-open">
            <div className="modal-box max-w-xl">
                <div className="flex items-start justify-between mb-2">
                    <div>
                        <h2 className="text-xl font-bold text-green-800">{admission.firstName} {admission.lastName}</h2>
                        <p className="text-sm text-gray-500 font-mono">{admission.applicationNo}</p>
                    </div>
                    <span className={`badge ${STATUS_BADGE[admission.status] ?? 'badge-ghost'} capitalize`}>{admission.status.replace('_', ' ')}</span>
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-gray-600 mt-3">
                    <div><span className="text-gray-400">Pathway:</span> {TYPE_LABEL[admission.admissionType]}</div>
                    <div><span className="text-gray-400">Target Class:</span> {classes?.find((c) => c.id === admission.targetClassId)?.name ?? admission.targetClassId}</div>
                    <div><span className="text-gray-400">Boarding:</span> <span className="capitalize">{admission.boardingStatus}</span></div>
                    <div><span className="text-gray-400">Guardian:</span> {admission.guardianName ?? '—'}</div>
                    {admission.nemisUpi && <div className="col-span-2"><span className="text-gray-400">NEMIS UPI:</span> {admission.nemisUpi}</div>}
                    {admission.interviewDate && <div><span className="text-gray-400">Interview:</span> {admission.interviewDate}</div>}
                    {admission.interviewScore && <div><span className="text-gray-400">Score:</span> {admission.interviewScore}</div>}
                    {admission.status === 'rejected' && admission.rejectionReason && (
                        <div className="col-span-2 text-red-600"><span className="text-gray-400">Reason:</span> {admission.rejectionReason}</div>
                    )}
                    {admission.studentId && <div className="col-span-2 text-green-700">Enrolled as Student #{admission.studentId}</div>}
                </div>

                {admission.admissionType === 'direct' && admission.status === 'pending' && (
                    <ScheduleInterviewForm admissionId={admission.id} defaultInterviewerId={user!.id} onDone={onClose} />
                )}
                {admission.admissionType === 'direct' && admission.status === 'interview_scheduled' && !admission.interviewScore && (
                    <RecordResultForm admissionId={admission.id} onDone={onClose} />
                )}
                {(admission.status === 'pending' || admission.status === 'interview_scheduled' || admission.status === 'waitlisted') && admission.admissionType === 'direct' && (
                    <DecideForm admissionId={admission.id} defaultDecidedBy={user!.id} onDone={onClose} />
                )}
                {admission.status === 'admitted' && (
                    <EnrollForm admission={admission} onDone={onClose} />
                )}

                <div className="flex justify-end mt-4">
                    <button type="button" onClick={onClose} className="btn btn-ghost btn-sm">
                        <X size={16} /> Close
                    </button>
                </div>
            </div>
        </div>
    )
}

// ---- Page ----

const AdmissionsPage: React.FC = () => {
    const { data: admissions, isLoading, isError } = useGetAllAdmissionsQuery()
    const { data: classes } = useGetAllClassesQuery()
    const [statusFilter, setStatusFilter] = useState('')
    const [isAddModalOpen, setIsAddModalOpen] = useState(false)
    const [selected, setSelected] = useState<Admission | null>(null)

    const filtered = admissions?.filter((a) => !statusFilter || a.status === statusFilter)

    return (
        <DashboardLayout>
            <Toaster position="top-right" richColors />

            <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 rounded-lg">
                        <UserSquare2 className="text-green-800" size={24} />
                    </div>
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Admissions</h1>
                </div>
                <button onClick={() => setIsAddModalOpen(true)} className="btn bg-green-800 hover:bg-green-900 text-white flex items-center gap-2">
                    <Plus size={16} />
                    New Application
                </button>
            </div>

            <div className="flex items-center gap-3 mb-4">
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="select select-bordered select-sm">
                    <option value="">All statuses</option>
                    {Object.keys(STATUS_BADGE).map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                </select>
            </div>

            {isLoading ? (
                <div className="flex justify-center items-center py-16">
                    <span className="loading loading-spinner loading-lg text-green-800"></span>
                </div>
            ) : isError ? (
                <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
                    <XCircle className="mx-auto text-red-500 mb-3" size={40} />
                    <p className="text-red-700">Unable to load admissions.</p>
                </div>
            ) : !filtered || filtered.length === 0 ? (
                <div className="bg-white rounded-lg shadow-sm p-8 text-center text-gray-500">No applications yet.</div>
            ) : (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto scroll-fade-x">
                        <table className="table table-zebra w-full">
                            <thead>
                                <tr className="bg-gray-50">
                                    <th>Application No.</th>
                                    <th>Applicant</th>
                                    <th>Pathway</th>
                                    <th>Target Class</th>
                                    <th>Status</th>
                                    <th className="text-center">View</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((a) => (
                                    <tr key={a.id} className="hover:bg-gray-50">
                                        <td className="font-mono text-sm">{a.applicationNo}</td>
                                        <td className="font-medium text-gray-800">{a.firstName} {a.lastName}</td>
                                        <td><span className="badge badge-outline">{TYPE_LABEL[a.admissionType]}</span></td>
                                        <td>{classes?.find((c) => c.id === a.targetClassId)?.name ?? a.targetClassId}</td>
                                        <td><span className={`badge ${STATUS_BADGE[a.status] ?? 'badge-ghost'} capitalize`}>{a.status.replace('_', ' ')}</span></td>
                                        <td className="text-center">
                                            <button onClick={() => setSelected(a)} className="btn btn-ghost btn-xs text-green-800" title="View">
                                                <Eye size={14} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {isAddModalOpen && <NewApplicationModal onClose={() => setIsAddModalOpen(false)} />}
            {selected && <DetailModal admission={selected} onClose={() => setSelected(null)} />}
        </DashboardLayout>
    )
}

export default AdmissionsPage
