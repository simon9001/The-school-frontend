import React, { useState } from 'react'
import { useForm, type SubmitHandler } from 'react-hook-form'
import { useSelector } from 'react-redux'
import { GraduationCap, Plus, X, SaveIcon, XCircle, Search } from 'lucide-react'
import { Toaster, toast } from 'sonner'
import DashboardLayout from '../../dashboardDesign/DashboardLayout'
import type { RootState } from '../../store/store'
import {
    useGetAllClassesQuery,
    useGetStreamsByClassQuery,
    useGetAllStudentsQuery,
    useGetStudentsByClassQuery,
    useAddStudentMutation,
} from './StudentApi'
import type { NewStudentValues } from './types'

const STATUS_BADGE: Record<string, string> = {
    active: 'badge-success',
    transferred: 'badge-info',
    graduated: 'badge-info',
    withdrawn: 'badge-ghost',
    suspended: 'badge-warning',
    expelled: 'badge-error',
}

const StudentsPage: React.FC = () => {
    const { user } = useSelector((state: RootState) => state.authSlice)
    const canManage = user?.permissions.includes('students.manage') ?? false

    const [classFilter, setClassFilter] = useState<string>('')
    const [search, setSearch] = useState('')
    const [isAddModalOpen, setIsAddModalOpen] = useState(false)

    const { data: classes } = useGetAllClassesQuery()

    const allStudents = useGetAllStudentsQuery(undefined, { skip: !!classFilter })
    const byClassStudents = useGetStudentsByClassQuery(Number(classFilter), { skip: !classFilter })
    const { data: students, isLoading, isError } = classFilter ? byClassStudents : allStudents

    const [addStudent] = useAddStudentMutation()
    const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<NewStudentValues>()
    const selectedClassId = watch('classId')
    const { data: streamsForClass } = useGetStreamsByClassQuery(Number(selectedClassId), { skip: !selectedClassId })

    const classNameById = (id: number) => classes?.find((c) => c.id === id)?.name ?? `#${id}`

    const filteredStudents = students?.filter((s) => {
        if (!search) return true
        const q = search.toLowerCase()
        return (
            s.admissionNo.toLowerCase().includes(q) ||
            s.firstName.toLowerCase().includes(q) ||
            s.lastName.toLowerCase().includes(q)
        )
    })

    const onSubmit: SubmitHandler<NewStudentValues> = async (formValues) => {
        const loadingToastId = toast.loading('Enrolling student...')
        try {
            // Optional text/date/email fields arrive as '' when left blank in
            // the form, but the backend's zod schema rejects '' for .date()
            // and .email() (only `undefined` satisfies .optional()).
            const blankToUndefined = <T extends string | undefined>(v: T) => (v ? v : undefined)
            await addStudent({
                ...formValues,
                classId: Number(formValues.classId),
                streamId: formValues.streamId ? Number(formValues.streamId) : undefined,
                otherNames: blankToUndefined(formValues.otherNames),
                gender: blankToUndefined(formValues.gender),
                dateOfBirth: blankToUndefined(formValues.dateOfBirth),
                guardianName: blankToUndefined(formValues.guardianName),
                guardianPhone: blankToUndefined(formValues.guardianPhone),
                guardianEmail: blankToUndefined(formValues.guardianEmail),
            }).unwrap()
            toast.success('Student enrolled', { id: loadingToastId })
            reset()
            setIsAddModalOpen(false)
        } catch (err) {
            const message = (err as { data?: { error?: string } })?.data?.error ?? 'Failed to enroll student'
            toast.error(message, { id: loadingToastId })
        }
    }

    return (
        <DashboardLayout>
            <Toaster position="top-right" richColors />

            <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 rounded-lg">
                        <GraduationCap className="text-green-800" size={24} />
                    </div>
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Students</h1>
                </div>
                {canManage && (
                    <button onClick={() => setIsAddModalOpen(true)} className="btn bg-green-800 hover:bg-green-900 text-white flex items-center gap-2">
                        <Plus size={16} />
                        New Student
                    </button>
                )}
            </div>

            <div className="flex items-center gap-3 mb-4 flex-wrap">
                <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)} className="select select-bordered select-sm">
                    <option value="">All classes</option>
                    {classes?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <label className="input input-bordered input-sm flex items-center gap-2">
                    <Search size={14} className="text-gray-400" />
                    <input type="text" className="grow" placeholder="Search name or admission no." value={search} onChange={(e) => setSearch(e.target.value)} />
                </label>
            </div>

            {isLoading ? (
                <div className="flex justify-center items-center py-16">
                    <span className="loading loading-spinner loading-lg text-green-800"></span>
                </div>
            ) : isError ? (
                <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
                    <XCircle className="mx-auto text-red-500 mb-3" size={40} />
                    <p className="text-red-700">Unable to load students.</p>
                </div>
            ) : !filteredStudents || filteredStudents.length === 0 ? (
                <div className="bg-white rounded-lg shadow-sm p-8 text-center text-gray-500">No students found.</div>
            ) : (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto scroll-fade-x">
                        <table className="table table-zebra w-full">
                            <thead>
                                <tr className="bg-gray-50">
                                    <th>Admission No.</th>
                                    <th>Name</th>
                                    <th>Class</th>
                                    <th>Boarding</th>
                                    <th>Guardian</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredStudents.map((student) => (
                                    <tr key={student.id} className="hover:bg-gray-50">
                                        <td className="font-mono text-sm">{student.admissionNo}</td>
                                        <td className="font-medium text-gray-800">
                                            {student.firstName} {student.lastName}
                                            {student.otherNames && <span className="text-gray-500"> {student.otherNames}</span>}
                                        </td>
                                        <td>{classNameById(student.classId)}</td>
                                        <td className="capitalize text-sm text-gray-600">{student.boardingStatus}</td>
                                        <td className="text-sm text-gray-600">
                                            {student.guardianName ?? '—'}
                                            {student.guardianPhone && <div className="text-xs text-gray-400">{student.guardianPhone}</div>}
                                        </td>
                                        <td><span className={`badge ${STATUS_BADGE[student.status] ?? 'badge-ghost'} capitalize`}>{student.status}</span></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {isAddModalOpen && (
                <div className="modal modal-open">
                    <div className="modal-box max-w-2xl">
                        <h2 className="text-xl font-bold text-green-800 mb-4">New Student</h2>
                        <form onSubmit={handleSubmit(onSubmit)}>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                                <div>
                                    <label htmlFor="admissionNo" className="block text-sm font-medium text-gray-700">Admission No.</label>
                                    <input id="admissionNo" className="input input-bordered w-full" {...register('admissionNo', { required: 'Admission number is required' })} />
                                    {errors.admissionNo && <p className="text-red-500 text-sm">{errors.admissionNo.message}</p>}
                                </div>
                                <div>
                                    <label htmlFor="admissionDate" className="block text-sm font-medium text-gray-700">Admission Date</label>
                                    <input id="admissionDate" type="date" className="input input-bordered w-full" {...register('admissionDate', { required: 'Admission date is required' })} />
                                    {errors.admissionDate && <p className="text-red-500 text-sm">{errors.admissionDate.message}</p>}
                                </div>
                                <div>
                                    <label htmlFor="firstName" className="block text-sm font-medium text-gray-700">First Name</label>
                                    <input id="firstName" className="input input-bordered w-full" {...register('firstName', { required: 'First name is required' })} />
                                    {errors.firstName && <p className="text-red-500 text-sm">{errors.firstName.message}</p>}
                                </div>
                                <div>
                                    <label htmlFor="lastName" className="block text-sm font-medium text-gray-700">Last Name</label>
                                    <input id="lastName" className="input input-bordered w-full" {...register('lastName', { required: 'Last name is required' })} />
                                    {errors.lastName && <p className="text-red-500 text-sm">{errors.lastName.message}</p>}
                                </div>
                                <div>
                                    <label htmlFor="otherNames" className="block text-sm font-medium text-gray-700">Other Names</label>
                                    <input id="otherNames" className="input input-bordered w-full" {...register('otherNames')} />
                                </div>
                                <div>
                                    <label htmlFor="gender" className="block text-sm font-medium text-gray-700">Gender</label>
                                    <select id="gender" className="select select-bordered w-full" {...register('gender')}>
                                        <option value="">—</option>
                                        <option value="male">Male</option>
                                        <option value="female">Female</option>
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="dateOfBirth" className="block text-sm font-medium text-gray-700">Date of Birth</label>
                                    <input id="dateOfBirth" type="date" className="input input-bordered w-full" {...register('dateOfBirth')} />
                                </div>
                                <div>
                                    <label htmlFor="boardingStatus" className="block text-sm font-medium text-gray-700">Boarding Status</label>
                                    <select id="boardingStatus" className="select select-bordered w-full" defaultValue="day" {...register('boardingStatus', { required: true })}>
                                        <option value="day">Day</option>
                                        <option value="boarder">Boarder</option>
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="classId" className="block text-sm font-medium text-gray-700">Class</label>
                                    <select id="classId" className="select select-bordered w-full" {...register('classId', { required: 'Class is required' })}>
                                        <option value="">Select class</option>
                                        {classes?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                    {errors.classId && <p className="text-red-500 text-sm">{errors.classId.message}</p>}
                                </div>
                                <div>
                                    <label htmlFor="streamId" className="block text-sm font-medium text-gray-700">Stream</label>
                                    <select id="streamId" className="select select-bordered w-full" disabled={!selectedClassId} {...register('streamId')}>
                                        <option value="">{selectedClassId ? 'Select stream' : 'Choose a class first'}</option>
                                        {streamsForClass?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </div>
                            </div>

                            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Guardian</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                                <div>
                                    <label htmlFor="guardianName" className="block text-sm font-medium text-gray-700">Name</label>
                                    <input id="guardianName" className="input input-bordered w-full" {...register('guardianName')} />
                                </div>
                                <div>
                                    <label htmlFor="guardianPhone" className="block text-sm font-medium text-gray-700">Phone</label>
                                    <input id="guardianPhone" className="input input-bordered w-full" {...register('guardianPhone')} />
                                </div>
                                <div className="sm:col-span-2">
                                    <label htmlFor="guardianEmail" className="block text-sm font-medium text-gray-700">Email</label>
                                    <input id="guardianEmail" type="email" className="input input-bordered w-full" {...register('guardianEmail')} />
                                </div>
                            </div>

                            <div className="flex justify-end gap-2">
                                <button type="button" onClick={() => setIsAddModalOpen(false)} className="btn btn-ghost">
                                    <X size={16} /> Cancel
                                </button>
                                <button type="submit" className="btn bg-green-800 hover:bg-green-900 text-white">
                                    <SaveIcon size={16} /> Save
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </DashboardLayout>
    )
}

export default StudentsPage
