import React, { useState } from 'react'
import { useForm, type SubmitHandler } from 'react-hook-form'
import { useSelector } from 'react-redux'
import { Users, Plus, X, SaveIcon, XCircle, Search } from 'lucide-react'
import { Toaster, toast } from 'sonner'
import Swal from 'sweetalert2'
import DashboardLayout from '../../dashboardDesign/DashboardLayout'
import RowActions from '../../components/RowActions'
import type { RootState } from '../../store/store'
import { useGetAllTeachersQuery, useAddTeacherMutation, useUpdateTeacherMutation, useDeleteTeacherMutation } from './TeacherApi'
import type { NewTeacherValues, Teacher, TeacherStatus } from './types'

// Plain Tailwind color utilities, not DaisyUI badge-* classes — those are
// scoped to `.badge` elements and render invisible on a bare `<select>`.
const STATUS_SELECT_CLASS: Record<TeacherStatus, string> = {
    active: 'bg-green-600 text-white',
    on_leave: 'bg-amber-500 text-white',
    left: 'bg-gray-400 text-white',
}

const blank = <T extends string | undefined>(v: T) => (v ? v : undefined)

const TeachersPage: React.FC = () => {
    const { user } = useSelector((state: RootState) => state.authSlice)
    const canManage = user?.permissions.includes('teachers.manage') ?? false
    const canDelete = user?.permissions.includes('teachers.delete') ?? false

    const [search, setSearch] = useState('')
    const [isAddModalOpen, setIsAddModalOpen] = useState(false)

    const { data: teachers, isLoading, isError } = useGetAllTeachersQuery()
    const [addTeacher] = useAddTeacherMutation()
    const [updateTeacher] = useUpdateTeacherMutation()
    const [deleteTeacher] = useDeleteTeacherMutation()

    const { register, handleSubmit, reset, formState: { errors } } = useForm<NewTeacherValues>()

    const filtered = teachers?.filter((t) => {
        if (!search) return true
        const q = search.toLowerCase()
        return t.staffNo.toLowerCase().includes(q) || t.fullName.toLowerCase().includes(q)
    })

    const onSubmit: SubmitHandler<NewTeacherValues> = async (formValues) => {
        const loadingToastId = toast.loading('Adding teacher...')
        try {
            await addTeacher({
                ...formValues,
                tscNumber: blank(formValues.tscNumber),
                email: blank(formValues.email),
                phone: blank(formValues.phone),
            }).unwrap()
            toast.success('Teacher added', { id: loadingToastId })
            reset()
            setIsAddModalOpen(false)
        } catch (err) {
            const message = (err as { data?: { error?: string } })?.data?.error ?? 'Failed to add teacher'
            toast.error(message, { id: loadingToastId })
        }
    }

    const handleStatusChange = async (id: number, status: TeacherStatus) => {
        const loadingToastId = toast.loading('Updating status...')
        try {
            await updateTeacher({ id, changes: { status } }).unwrap()
            toast.success('Status updated', { id: loadingToastId })
        } catch {
            toast.error('Failed to update status', { id: loadingToastId })
        }
    }

    const confirmDelete = (teacher: Teacher) => {
        Swal.fire({
            title: 'Delete this teacher?',
            text: `"${teacher.fullName}" will be permanently removed. A teacher with subject assignments or timetable entries cannot be deleted; set their status to Left instead.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#b91c1c',
            cancelButtonColor: '#6b7280',
            confirmButtonText: 'Yes, delete',
        }).then(async (result) => {
            if (!result.isConfirmed) return
            try {
                await deleteTeacher(teacher.id).unwrap()
                Swal.fire('Deleted', `"${teacher.fullName}" was removed.`, 'success')
            } catch (err) {
                // A teacher with history is refused with a message naming what
                // blocks the delete; show that instead of a generic failure.
                const message = (err as { data?: { error?: string } })?.data?.error ?? 'Please try again'
                Swal.fire('Could not delete', message, 'error')
            }
        })
    }

    return (
        <DashboardLayout>
            <Toaster position="top-right" richColors />

            <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 rounded-lg">
                        <Users className="text-green-800" size={24} />
                    </div>
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Teachers</h1>
                </div>
                {canManage && (
                    <button onClick={() => setIsAddModalOpen(true)} className="btn bg-green-800 hover:bg-green-900 text-white flex items-center gap-2">
                        <Plus size={16} />
                        New Teacher
                    </button>
                )}
            </div>

            <div className="flex items-center gap-3 mb-4">
                <label className="input input-bordered input-sm flex items-center gap-2 max-w-xs">
                    <Search size={14} className="text-gray-400" />
                    <input type="text" className="grow" placeholder="Search name or staff no." value={search} onChange={(e) => setSearch(e.target.value)} />
                </label>
            </div>

            {isLoading ? (
                <div className="flex justify-center items-center py-16">
                    <span className="loading loading-spinner loading-lg text-green-800"></span>
                </div>
            ) : isError ? (
                <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
                    <XCircle className="mx-auto text-red-500 mb-3" size={40} />
                    <p className="text-red-700">Unable to load teachers.</p>
                </div>
            ) : !filtered || filtered.length === 0 ? (
                <div className="bg-white rounded-lg shadow-sm p-8 text-center text-gray-500">No teachers yet.</div>
            ) : (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto scroll-fade-x">
                        <table className="table table-zebra w-full">
                            <thead>
                                <tr className="bg-gray-50">
                                    <th>Staff No.</th>
                                    <th>Name</th>
                                    <th>TSC No.</th>
                                    <th>Contact</th>
                                    <th>Status</th>
                                    {canDelete && <th><span className="sr-only">Actions</span></th>}
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((teacher) => (
                                    <tr key={teacher.id} className="hover:bg-gray-50">
                                        <td className="font-mono text-sm">{teacher.staffNo}</td>
                                        <td className="font-medium text-gray-800">{teacher.fullName}</td>
                                        <td className="text-sm text-gray-600">{teacher.tscNumber ?? '—'}</td>
                                        <td className="text-sm text-gray-600">
                                            {teacher.email ?? '—'}
                                            {teacher.phone && <div className="text-xs text-gray-400">{teacher.phone}</div>}
                                        </td>
                                        <td>
                                            {canManage ? (
                                            <select
                                                value={teacher.status}
                                                onChange={(e) => handleStatusChange(teacher.id, e.target.value as TeacherStatus)}
                                                className={`select select-bordered select-xs capitalize border-none ${STATUS_SELECT_CLASS[teacher.status]}`}
                                            >
                                                <option value="active">Active</option>
                                                <option value="on_leave">On Leave</option>
                                                <option value="left">Left</option>
                                            </select>
                                            ) : (
                                                <span className={`badge capitalize border-none ${STATUS_SELECT_CLASS[teacher.status]}`}>{teacher.status.replace('_', ' ')}</span>
                                            )}
                                        </td>
                                        {canDelete && (
                                            <td>
                                                <RowActions label={teacher.fullName} canDelete onDelete={() => confirmDelete(teacher)} />
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
                    <div className="modal-box">
                        <h2 className="text-xl font-bold text-green-800 mb-4">New Teacher</h2>
                        <form onSubmit={handleSubmit(onSubmit)}>
                            <div className="mb-4">
                                <label htmlFor="staffNo" className="block text-sm font-medium text-gray-700">Staff No.</label>
                                <input id="staffNo" className="input input-bordered w-full" {...register('staffNo', { required: 'Staff number is required' })} />
                                {errors.staffNo && <p className="text-red-500 text-sm">{errors.staffNo.message}</p>}
                            </div>
                            <div className="mb-4">
                                <label htmlFor="fullName" className="block text-sm font-medium text-gray-700">Full Name</label>
                                <input id="fullName" className="input input-bordered w-full" {...register('fullName', { required: 'Full name is required' })} />
                                {errors.fullName && <p className="text-red-500 text-sm">{errors.fullName.message}</p>}
                            </div>
                            <div className="mb-4">
                                <label htmlFor="tscNumber" className="block text-sm font-medium text-gray-700">TSC Number</label>
                                <input id="tscNumber" className="input input-bordered w-full" {...register('tscNumber')} />
                                <p className="text-xs text-gray-400 mt-1">Leave blank for BOM-employed teaching staff.</p>
                            </div>
                            <div className="mb-4">
                                <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</label>
                                <input id="email" type="email" className="input input-bordered w-full" {...register('email')} />
                            </div>
                            <div className="mb-6">
                                <label htmlFor="phone" className="block text-sm font-medium text-gray-700">Phone</label>
                                <input id="phone" className="input input-bordered w-full" {...register('phone')} />
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

export default TeachersPage
