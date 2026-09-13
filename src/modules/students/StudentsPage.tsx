import React, { useEffect, useState } from 'react'
import { useForm, type SubmitHandler } from 'react-hook-form'
import { useSelector } from 'react-redux'
import { GraduationCap, Plus, X, SaveIcon, XCircle, Search } from 'lucide-react'
import { Toaster, toast } from 'sonner'
import Swal from 'sweetalert2'
import DashboardLayout from '../../dashboardDesign/DashboardLayout'
import RowActions from '../../components/RowActions'
import type { RootState } from '../../store/store'
import {
    useGetAllClassesQuery,
    useGetStreamsByClassQuery,
    useGetAllStudentsQuery,
    useGetStudentsByClassQuery,
    useAddStudentMutation,
    useUpdateStudentMutation,
    useDeleteStudentMutation,
} from './StudentApi'
import StudentFormFields from './StudentFormFields'
import type { NewStudentValues, Student } from './types'

const STATUS_BADGE: Record<string, string> = {
    active: 'badge-success',
    transferred: 'badge-info',
    graduated: 'badge-info',
    withdrawn: 'badge-ghost',
    suspended: 'badge-warning',
    expelled: 'badge-error',
}

// Optional text/date/email fields arrive as '' when left blank in the form,
// but the backend's zod schema rejects '' for .date() and .email() (only
// `undefined` satisfies .optional()).
const blankToUndefined = <T extends string | undefined>(v: T) => (v ? v : undefined)

/** Normalises raw form values into the payload the add and edit calls send. */
const toStudentPayload = (formValues: NewStudentValues): NewStudentValues => ({
    ...formValues,
    classId: Number(formValues.classId),
    streamId: formValues.streamId ? Number(formValues.streamId) : undefined,
    otherNames: blankToUndefined(formValues.otherNames),
    gender: blankToUndefined(formValues.gender),
    dateOfBirth: blankToUndefined(formValues.dateOfBirth),
    guardianName: blankToUndefined(formValues.guardianName),
    guardianPhone: blankToUndefined(formValues.guardianPhone),
    guardianEmail: blankToUndefined(formValues.guardianEmail),
})

const serverMessage = (err: unknown, fallback: string) => (err as { data?: { error?: string } })?.data?.error ?? fallback

const StudentsPage: React.FC = () => {
    const { user } = useSelector((state: RootState) => state.authSlice)
    const permissions = user?.permissions ?? []
    // Adding belongs to students.manage (the Registrar); editing and deleting
    // are separate grants so the Dean can hold them without taking on admissions.
    const canManage = permissions.includes('students.manage')
    const canEdit = permissions.includes('students.edit')
    const canDelete = permissions.includes('students.delete')
    const showActions = canEdit || canDelete

    const [classFilter, setClassFilter] = useState<string>('')
    const [search, setSearch] = useState('')
    const [isAddModalOpen, setIsAddModalOpen] = useState(false)
    const [editingStudent, setEditingStudent] = useState<Student | null>(null)

    const { data: classes } = useGetAllClassesQuery()

    const allStudents = useGetAllStudentsQuery(undefined, { skip: !!classFilter })
    const byClassStudents = useGetStudentsByClassQuery(Number(classFilter), { skip: !classFilter })
    const { data: students, isLoading, isError } = classFilter ? byClassStudents : allStudents

    const [addStudent] = useAddStudentMutation()
    const [updateStudent] = useUpdateStudentMutation()
    const [deleteStudent] = useDeleteStudentMutation()

    const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<NewStudentValues>()
    const selectedClassId = watch('classId')
    const { data: streamsForClass } = useGetStreamsByClassQuery(Number(selectedClassId), { skip: !selectedClassId })

    const editForm = useForm<NewStudentValues>()
    const editClassId = editForm.watch('classId')
    const { data: streamsForEditClass } = useGetStreamsByClassQuery(Number(editClassId), { skip: !editingStudent || !editClassId })

    // Stream options load after the edit form opens, and a <select> cannot hold
    // a value it has no option for yet, so re-apply the student's stream once
    // the options for their own class have arrived.
    useEffect(() => {
        if (editingStudent && streamsForEditClass && Number(editClassId) === editingStudent.classId) {
            editForm.setValue('streamId', editingStudent.streamId ?? undefined)
        }
    }, [streamsForEditClass, editingStudent, editClassId, editForm])

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
            await addStudent(toStudentPayload(formValues)).unwrap()
            toast.success('Student enrolled', { id: loadingToastId })
            reset()
            setIsAddModalOpen(false)
        } catch (err) {
            toast.error(serverMessage(err, 'Failed to enroll student'), { id: loadingToastId })
        }
    }

    const openEdit = (student: Student) => {
        editForm.reset({
            admissionNo: student.admissionNo,
            admissionDate: student.admissionDate,
            firstName: student.firstName,
            lastName: student.lastName,
            otherNames: student.otherNames ?? '',
            gender: student.gender ?? '',
            dateOfBirth: student.dateOfBirth ?? '',
            boardingStatus: student.boardingStatus,
            classId: student.classId,
            streamId: student.streamId ?? undefined,
            guardianName: student.guardianName ?? '',
            guardianPhone: student.guardianPhone ?? '',
            guardianEmail: student.guardianEmail ?? '',
        })
        setEditingStudent(student)
    }

    const onEditSubmit: SubmitHandler<NewStudentValues> = async (formValues) => {
        if (!editingStudent) return
        const loadingToastId = toast.loading('Saving changes...')
        try {
            await updateStudent({ id: editingStudent.id, changes: toStudentPayload(formValues) }).unwrap()
            toast.success('Student updated', { id: loadingToastId })
            setEditingStudent(null)
        } catch (err) {
            toast.error(serverMessage(err, 'Failed to update student'), { id: loadingToastId })
        }
    }

    const confirmDelete = (student: Student) => {
        const name = `${student.firstName} ${student.lastName}`
        Swal.fire({
            title: 'Delete this student?',
            text: `"${name}" will be permanently removed. Only a student with no fees, attendance, results or other history can be deleted.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#b91c1c',
            cancelButtonColor: '#6b7280',
            confirmButtonText: 'Yes, delete',
        }).then(async (result) => {
            if (!result.isConfirmed) return
            try {
                await deleteStudent(student.id).unwrap()
                Swal.fire('Deleted', `"${name}" was removed.`, 'success')
            } catch (err) {
                // A student with history is refused with a message naming what
                // blocks the delete; show that instead of a generic failure.
                Swal.fire('Could not delete', serverMessage(err, 'Please try again'), 'error')
            }
        })
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
                                    {showActions && <th><span className="sr-only">Actions</span></th>}
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
                                        {showActions && (
                                            <td>
                                                <RowActions
                                                    label={`${student.firstName} ${student.lastName}`}
                                                    canEdit={canEdit}
                                                    canDelete={canDelete}
                                                    onEdit={() => openEdit(student)}
                                                    onDelete={() => confirmDelete(student)}
                                                />
                                            </td>
                                        )}
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
                            <StudentFormFields
                                idPrefix="add"
                                register={register}
                                errors={errors}
                                classes={classes}
                                streams={streamsForClass}
                                selectedClassId={selectedClassId}
                            />
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

            {editingStudent && (
                <div className="modal modal-open">
                    <div className="modal-box max-w-2xl">
                        <h2 className="text-xl font-bold text-green-800 mb-4">Edit Student</h2>
                        <form onSubmit={editForm.handleSubmit(onEditSubmit)}>
                            <StudentFormFields
                                idPrefix="edit"
                                register={editForm.register}
                                errors={editForm.formState.errors}
                                classes={classes}
                                streams={streamsForEditClass}
                                selectedClassId={editClassId}
                            />
                            <div className="flex justify-end gap-2">
                                <button type="button" onClick={() => setEditingStudent(null)} className="btn btn-ghost">
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
