import React from 'react'
import type { FieldErrors, UseFormRegister } from 'react-hook-form'
import type { Class, NewStudentValues, Stream } from './types'

interface StudentFormFieldsProps {
    register: UseFormRegister<NewStudentValues>
    errors: FieldErrors<NewStudentValues>
    classes?: Class[]
    streams?: Stream[]
    selectedClassId?: number | string
    /** Prefixes input ids so each form's labels point at its own inputs. */
    idPrefix: string
}

/** The student record fields, shared by the New Student and Edit Student forms. */
const StudentFormFields: React.FC<StudentFormFieldsProps> = ({ register, errors, classes, streams, selectedClassId, idPrefix }) => {
    const id = (name: string) => `${idPrefix}-${name}`

    return (
        <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                    <label htmlFor={id('admissionNo')} className="block text-sm font-medium text-gray-700">Admission No.</label>
                    <input id={id('admissionNo')} className="input input-bordered w-full" {...register('admissionNo', { required: 'Admission number is required' })} />
                    {errors.admissionNo && <p className="text-red-500 text-sm">{errors.admissionNo.message}</p>}
                </div>
                <div>
                    <label htmlFor={id('admissionDate')} className="block text-sm font-medium text-gray-700">Admission Date</label>
                    <input id={id('admissionDate')} type="date" className="input input-bordered w-full" {...register('admissionDate', { required: 'Admission date is required' })} />
                    {errors.admissionDate && <p className="text-red-500 text-sm">{errors.admissionDate.message}</p>}
                </div>
                <div>
                    <label htmlFor={id('firstName')} className="block text-sm font-medium text-gray-700">First Name</label>
                    <input id={id('firstName')} className="input input-bordered w-full" {...register('firstName', { required: 'First name is required' })} />
                    {errors.firstName && <p className="text-red-500 text-sm">{errors.firstName.message}</p>}
                </div>
                <div>
                    <label htmlFor={id('lastName')} className="block text-sm font-medium text-gray-700">Last Name</label>
                    <input id={id('lastName')} className="input input-bordered w-full" {...register('lastName', { required: 'Last name is required' })} />
                    {errors.lastName && <p className="text-red-500 text-sm">{errors.lastName.message}</p>}
                </div>
                <div>
                    <label htmlFor={id('otherNames')} className="block text-sm font-medium text-gray-700">Other Names</label>
                    <input id={id('otherNames')} className="input input-bordered w-full" {...register('otherNames')} />
                </div>
                <div>
                    <label htmlFor={id('gender')} className="block text-sm font-medium text-gray-700">Gender</label>
                    <select id={id('gender')} className="select select-bordered w-full" {...register('gender')}>
                        <option value="">—</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                    </select>
                </div>
                <div>
                    <label htmlFor={id('dateOfBirth')} className="block text-sm font-medium text-gray-700">Date of Birth</label>
                    <input id={id('dateOfBirth')} type="date" className="input input-bordered w-full" {...register('dateOfBirth')} />
                </div>
                <div>
                    <label htmlFor={id('boardingStatus')} className="block text-sm font-medium text-gray-700">Boarding Status</label>
                    <select id={id('boardingStatus')} className="select select-bordered w-full" defaultValue="day" {...register('boardingStatus', { required: true })}>
                        <option value="day">Day</option>
                        <option value="boarder">Boarder</option>
                    </select>
                </div>
                <div>
                    <label htmlFor={id('classId')} className="block text-sm font-medium text-gray-700">Class</label>
                    <select id={id('classId')} className="select select-bordered w-full" {...register('classId', { required: 'Class is required' })}>
                        <option value="">Select class</option>
                        {classes?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    {errors.classId && <p className="text-red-500 text-sm">{errors.classId.message}</p>}
                </div>
                <div>
                    <label htmlFor={id('streamId')} className="block text-sm font-medium text-gray-700">Stream</label>
                    <select id={id('streamId')} className="select select-bordered w-full" disabled={!selectedClassId} {...register('streamId')}>
                        <option value="">{selectedClassId ? 'Select stream' : 'Choose a class first'}</option>
                        {streams?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                </div>
            </div>

            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Guardian</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div>
                    <label htmlFor={id('guardianName')} className="block text-sm font-medium text-gray-700">Name</label>
                    <input id={id('guardianName')} className="input input-bordered w-full" {...register('guardianName')} />
                </div>
                <div>
                    <label htmlFor={id('guardianPhone')} className="block text-sm font-medium text-gray-700">Phone</label>
                    <input id={id('guardianPhone')} className="input input-bordered w-full" {...register('guardianPhone')} />
                </div>
                <div className="sm:col-span-2">
                    <label htmlFor={id('guardianEmail')} className="block text-sm font-medium text-gray-700">Email</label>
                    <input id={id('guardianEmail')} type="email" className="input input-bordered w-full" {...register('guardianEmail')} />
                </div>
            </div>
        </>
    )
}

export default StudentFormFields
