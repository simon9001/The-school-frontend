import React, { useState } from 'react'
import { useForm, type SubmitHandler } from 'react-hook-form'
import { useSelector } from 'react-redux'
import { Banknote, Plus, X, SaveIcon, XCircle, Pencil, PlayCircle } from 'lucide-react'
import { Toaster, toast } from 'sonner'
import DashboardLayout from '../../dashboardDesign/DashboardLayout'
import { useGetAllAccountsQuery } from '../finance/AccountApi'
import { useGetAllFundsQuery } from '../finance/FundApi'
import { useGetAllPeriodsQuery } from '../finance/PeriodApi'
import {
    useGetAllEmployeesQuery,
    useCreateEmployeeMutation,
    useGetSalaryComponentsQuery,
    useAddSalaryComponentMutation,
    useGetAllPayrollRunsQuery,
    useGetPayrollRunByIdQuery,
    useCreatePayrollRunMutation,
    useProcessPayrollRunMutation,
} from './PayrollApi'
import type { RootState } from '../../store/store'
import type { Employee, NewEmployeeValues, NewSalaryComponentValues, PayrollRunStatus, SalaryComponentType } from './types'

const formatMoney = (amount: string | number) =>
    Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const blank = <T extends string | undefined>(v: T) => (v ? v : undefined)

const RUN_BADGE: Record<PayrollRunStatus, string> = {
    draft: 'badge-ghost', processed: 'badge-info', posted: 'badge-success',
}
const COMPONENT_BADGE: Record<SalaryComponentType, string> = {
    basic: 'badge-info', allowance: 'badge-success', deduction: 'badge-warning',
}

// ==================== EMPLOYEES ====================

const NewEmployeeModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const [createEmployee] = useCreateEmployeeMutation()
    const { register, handleSubmit, formState: { errors } } = useForm<NewEmployeeValues>({ defaultValues: { employmentType: 'permanent' } })

    const onSubmit: SubmitHandler<NewEmployeeValues> = async (v) => {
        const id = toast.loading('Creating employee...')
        try {
            await createEmployee({
                ...v,
                idNumber: blank(v.idNumber), kraPin: blank(v.kraPin), nssfNo: blank(v.nssfNo), shifNo: blank(v.shifNo),
                jobTitle: blank(v.jobTitle), bankName: blank(v.bankName), bankAccountNo: blank(v.bankAccountNo),
            }).unwrap()
            toast.success('Employee created', { id })
            onClose()
        } catch (err) {
            toast.error((err as { data?: { error?: string } })?.data?.error ?? 'Failed to create employee', { id })
        }
    }

    return (
        <div className="modal modal-open">
            <div className="modal-box max-w-lg">
                <h2 className="text-xl font-bold text-green-800 mb-4">New Employee</h2>
                <form onSubmit={handleSubmit(onSubmit)}>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Staff No.</label>
                            <input className="input input-bordered w-full" {...register('staffNo', { required: 'Staff number is required' })} />
                            {errors.staffNo && <p className="text-red-500 text-sm">{errors.staffNo.message}</p>}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Full Name</label>
                            <input className="input input-bordered w-full" {...register('fullName', { required: 'Full name is required' })} />
                            {errors.fullName && <p className="text-red-500 text-sm">{errors.fullName.message}</p>}
                        </div>
                        <input className="input input-bordered w-full" placeholder="ID Number" {...register('idNumber')} />
                        <input className="input input-bordered w-full" placeholder="KRA PIN" {...register('kraPin')} />
                        <input className="input input-bordered w-full" placeholder="NSSF No." {...register('nssfNo')} />
                        <input className="input input-bordered w-full" placeholder="SHIF No." {...register('shifNo')} />
                        <input className="input input-bordered w-full" placeholder="Job Title" {...register('jobTitle')} />
                        <select className="select select-bordered w-full" {...register('employmentType')}>
                            <option value="permanent">Permanent</option>
                            <option value="contract">Contract</option>
                            <option value="casual">Casual</option>
                        </select>
                        <input className="input input-bordered w-full" placeholder="Bank Name" {...register('bankName')} />
                        <input className="input input-bordered w-full" placeholder="Bank Account No." {...register('bankAccountNo')} />
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700">Employment Date</label>
                            <input type="date" className="input input-bordered w-full" {...register('employmentDate', { required: true })} />
                        </div>
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

const EmployeeComponentsModal: React.FC<{ employee: Employee; onClose: () => void }> = ({ employee, onClose }) => {
    const { data: components, isLoading } = useGetSalaryComponentsQuery(employee.id)
    const [addComponent] = useAddSalaryComponentMutation()
    const { register, handleSubmit, reset } = useForm<NewSalaryComponentValues>({ defaultValues: { componentType: 'allowance', isPercentageOfBasic: false } })

    const onSubmit: SubmitHandler<NewSalaryComponentValues> = async (v) => {
        const id = toast.loading('Adding component...')
        try {
            await addComponent({ employeeId: employee.id, values: { ...v, amount: Number(v.amount), isPercentageOfBasic: Boolean(v.isPercentageOfBasic) } }).unwrap()
            toast.success('Component added', { id })
            reset({ componentType: 'allowance', isPercentageOfBasic: false })
        } catch (err) {
            toast.error((err as { data?: { error?: string } })?.data?.error ?? 'Failed to add component', { id })
        }
    }

    return (
        <div className="modal modal-open">
            <div className="modal-box max-w-lg">
                <h2 className="text-xl font-bold text-green-800 mb-1">{employee.fullName}</h2>
                <p className="text-sm text-gray-500 font-mono mb-4">{employee.staffNo}</p>

                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Salary Components</h3>
                {isLoading ? (
                    <div className="flex justify-center py-6"><span className="loading loading-spinner text-green-800"></span></div>
                ) : !components || components.length === 0 ? (
                    <div className="bg-gray-50 rounded-lg p-4 text-center text-sm text-gray-500 mb-4">No components defined yet — add a "basic" component first.</div>
                ) : (
                    <div className="space-y-1 mb-4">
                        {components.map((c) => (
                            <div key={c.id} className="flex items-center justify-between border border-gray-200 rounded-lg px-3 py-2">
                                <div className="flex items-center gap-2">
                                    <span className={`badge ${COMPONENT_BADGE[c.componentType]} badge-sm capitalize`}>{c.componentType}</span>
                                    <span className="text-sm text-gray-800">{c.name}</span>
                                </div>
                                <span className="text-sm font-mono">{c.isPercentageOfBasic ? `${c.amount}% of basic` : formatMoney(c.amount)}</span>
                            </div>
                        ))}
                    </div>
                )}

                <form onSubmit={handleSubmit(onSubmit)} className="border-t pt-4">
                    <div className="grid grid-cols-2 gap-2 mb-2">
                        <select className="select select-bordered select-sm" {...register('componentType', { required: true })}>
                            <option value="basic">Basic</option>
                            <option value="allowance">Allowance</option>
                            <option value="deduction">Deduction</option>
                        </select>
                        <input className="input input-bordered input-sm" placeholder="Name" {...register('name', { required: true })} />
                        <input type="number" step="0.01" className="input input-bordered input-sm" placeholder="Amount" {...register('amount', { required: true })} />
                        <label className="flex items-center gap-2 text-sm text-gray-600">
                            <input type="checkbox" className="checkbox checkbox-sm" {...register('isPercentageOfBasic')} /> % of basic
                        </label>
                    </div>
                    <button type="submit" className="btn btn-sm bg-green-800 hover:bg-green-900 text-white"><Plus size={14} /> Add Component</button>
                </form>

                <div className="flex justify-end mt-4"><button type="button" onClick={onClose} className="btn btn-ghost btn-sm"><X size={16} /> Close</button></div>
            </div>
        </div>
    )
}

const EmployeesPanel: React.FC<{ canManage: boolean }> = ({ canManage }) => {
    const { data: employees, isLoading, isError } = useGetAllEmployeesQuery()
    const [isAddOpen, setIsAddOpen] = useState(false)
    const [managing, setManaging] = useState<Employee | null>(null)

    return (
        <div>
            {canManage && (
                <div className="flex justify-end mb-4">
                    <button onClick={() => setIsAddOpen(true)} className="btn btn-sm bg-green-800 hover:bg-green-900 text-white flex items-center gap-2"><Plus size={14} /> New Employee</button>
                </div>
            )}
            {isLoading ? <div className="flex justify-center py-16"><span className="loading loading-spinner loading-lg text-green-800"></span></div>
            : isError ? <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center"><XCircle className="mx-auto text-red-500 mb-3" size={40} /><p className="text-red-700">Unable to load employees.</p></div>
            : !employees || employees.length === 0 ? <div className="bg-white rounded-lg shadow-sm p-8 text-center text-gray-500">No employees yet.</div>
            : (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <table className="table table-zebra w-full">
                        <thead><tr className="bg-gray-50"><th>Staff No.</th><th>Name</th><th>Job Title</th><th>Type</th><th>Status</th>{canManage && <th className="text-center">Manage</th>}</tr></thead>
                        <tbody>
                            {employees.map((e) => (
                                <tr key={e.id} className="hover:bg-gray-50">
                                    <td className="font-mono text-sm">{e.staffNo}</td>
                                    <td className="font-medium text-gray-800">{e.fullName}</td>
                                    <td className="text-sm text-gray-600">{e.jobTitle ?? '—'}</td>
                                    <td className="capitalize text-sm text-gray-600">{e.employmentType}</td>
                                    <td><span className={`badge ${e.status === 'active' ? 'badge-success' : 'badge-ghost'} capitalize`}>{e.status.replace('_', ' ')}</span></td>
                                    {canManage && <td className="text-center"><button onClick={() => setManaging(e)} className="btn btn-ghost btn-xs text-green-800"><Pencil size={14} /></button></td>}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            {isAddOpen && <NewEmployeeModal onClose={() => setIsAddOpen(false)} />}
            {managing && <EmployeeComponentsModal employee={managing} onClose={() => setManaging(null)} />}
        </div>
    )
}

// ==================== PAYROLL RUNS ====================

const NewRunModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const { data: periods } = useGetAllPeriodsQuery()
    const [createRun] = useCreatePayrollRunMutation()
    const { register, handleSubmit, formState: { errors } } = useForm<{ periodId: number; monthYear: string }>()

    const onSubmit: SubmitHandler<{ periodId: number; monthYear: string }> = async (v) => {
        const id = toast.loading('Creating payroll run...')
        try {
            await createRun({ periodId: Number(v.periodId), monthYear: v.monthYear }).unwrap()
            toast.success('Payroll run created', { id })
            onClose()
        } catch (err) {
            toast.error((err as { data?: { error?: string } })?.data?.error ?? 'Failed to create payroll run', { id })
        }
    }

    return (
        <div className="modal modal-open">
            <div className="modal-box">
                <h2 className="text-xl font-bold text-green-800 mb-4">New Payroll Run</h2>
                <form onSubmit={handleSubmit(onSubmit)}>
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700">Period</label>
                        <select className="select select-bordered w-full" {...register('periodId', { required: true })}>
                            <option value="">Select period</option>
                            {periods?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    </div>
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700">Month (YYYY-MM)</label>
                        <input className="input input-bordered w-full" placeholder="2026-08" {...register('monthYear', { required: true, pattern: { value: /^\d{4}-\d{2}$/, message: 'Format: YYYY-MM' } })} />
                        {errors.monthYear && <p className="text-red-500 text-sm">{errors.monthYear.message}</p>}
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

type ProcessFormValues = { fundId: number; salariesExpenseAccountId: number; payeAccountId: number; nssfAccountId: number; shifAccountId: number; otherDeductionsAccountId?: number; netPayAccountId: number; entryDate: string }

const RunDetailModal: React.FC<{ runId: number; canProcess: boolean; onClose: () => void }> = ({ runId, canProcess, onClose }) => {
    const { user } = useSelector((state: RootState) => state.authSlice)
    const { data: run, isLoading } = useGetPayrollRunByIdQuery(runId)
    const { data: accounts } = useGetAllAccountsQuery()
    const { data: funds } = useGetAllFundsQuery()
    const { data: employees } = useGetAllEmployeesQuery()
    const employeeName = (id: number) => employees?.find((e) => e.id === id)?.fullName ?? `#${id}`
    const [processRun] = useProcessPayrollRunMutation()
    const { register, handleSubmit } = useForm<ProcessFormValues>({ defaultValues: { entryDate: new Date().toISOString().slice(0, 10) } })
    const expenseAccounts = accounts?.filter((a) => a.type === 'expense')
    const liabilityAccounts = accounts?.filter((a) => a.type === 'liability')

    const onProcess: SubmitHandler<ProcessFormValues> = async (v) => {
        const id = toast.loading('Processing payroll...')
        try {
            await processRun({
                id: runId,
                values: {
                    fundId: Number(v.fundId),
                    salariesExpenseAccountId: Number(v.salariesExpenseAccountId),
                    payeAccountId: Number(v.payeAccountId),
                    nssfAccountId: Number(v.nssfAccountId),
                    shifAccountId: Number(v.shifAccountId),
                    otherDeductionsAccountId: v.otherDeductionsAccountId ? Number(v.otherDeductionsAccountId) : undefined,
                    netPayAccountId: Number(v.netPayAccountId),
                    entryDate: v.entryDate,
                    processedBy: user!.id,
                },
            }).unwrap()
            toast.success('Payroll processed and posted', { id })
        } catch (err) {
            toast.error((err as { data?: { error?: string } })?.data?.error ?? 'Failed to process payroll', { id })
        }
    }

    return (
        <div className="modal modal-open">
            <div className="modal-box max-w-2xl">
                {isLoading || !run ? <div className="flex justify-center py-12"><span className="loading loading-spinner text-green-800"></span></div> : (
                    <>
                        <div className="flex items-start justify-between mb-4">
                            <h2 className="text-xl font-bold text-green-800">Payroll — {run.monthYear}</h2>
                            <span className={`badge ${RUN_BADGE[run.status]} capitalize`}>{run.status}</span>
                        </div>

                        {run.payslips.length > 0 && (
                            <div className="overflow-x-auto scroll-fade-x border border-gray-200 rounded-lg mb-4">
                                <table className="table table-sm w-full">
                                    <thead><tr className="bg-gray-50"><th>Employee</th><th className="text-right">Gross</th><th className="text-right">PAYE</th><th className="text-right">NSSF</th><th className="text-right">SHIF</th><th className="text-right">Net Pay</th></tr></thead>
                                    <tbody>
                                        {run.payslips.map((p) => (
                                            <tr key={p.id}>
                                                <td>{employeeName(p.employeeId)}</td>
                                                <td className="text-right font-mono">{formatMoney(p.grossPay)}</td>
                                                <td className="text-right font-mono">{formatMoney(p.paye)}</td>
                                                <td className="text-right font-mono">{formatMoney(p.nssf)}</td>
                                                <td className="text-right font-mono">{formatMoney(p.shif)}</td>
                                                <td className="text-right font-mono font-semibold">{formatMoney(p.netPay)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {run.status === 'draft' && canProcess && (
                            <form onSubmit={handleSubmit(onProcess)} className="border-t pt-4">
                                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Process Payroll</h3>
                                <div className="grid grid-cols-2 gap-3 mb-3">
                                    <select className="select select-bordered select-sm" {...register('fundId', { required: true })}>
                                        <option value="">Fund</option>
                                        {funds?.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                                    </select>
                                    <input type="date" className="input input-bordered input-sm" {...register('entryDate', { required: true })} />
                                    <select className="select select-bordered select-sm" {...register('salariesExpenseAccountId', { required: true })}>
                                        <option value="">Salaries Expense Account</option>
                                        {expenseAccounts?.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                                    </select>
                                    <select className="select select-bordered select-sm" {...register('netPayAccountId', { required: true })}>
                                        <option value="">Net Pay Payable Account</option>
                                        {liabilityAccounts?.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                                    </select>
                                    <select className="select select-bordered select-sm" {...register('payeAccountId', { required: true })}>
                                        <option value="">PAYE Payable Account</option>
                                        {liabilityAccounts?.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                                    </select>
                                    <select className="select select-bordered select-sm" {...register('nssfAccountId', { required: true })}>
                                        <option value="">NSSF Payable Account</option>
                                        {liabilityAccounts?.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                                    </select>
                                    <select className="select select-bordered select-sm" {...register('shifAccountId', { required: true })}>
                                        <option value="">SHIF Payable Account</option>
                                        {liabilityAccounts?.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                                    </select>
                                    <select className="select select-bordered select-sm" {...register('otherDeductionsAccountId')}>
                                        <option value="">Other Deductions Account (if any)</option>
                                        {liabilityAccounts?.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                                    </select>
                                </div>
                                <button type="submit" className="btn btn-sm bg-green-800 hover:bg-green-900 text-white"><PlayCircle size={14} /> Process & Post</button>
                            </form>
                        )}
                    </>
                )}
                <div className="flex justify-end mt-4"><button type="button" onClick={onClose} className="btn btn-ghost btn-sm"><X size={16} /> Close</button></div>
            </div>
        </div>
    )
}

const PayrollRunsPanel: React.FC<{ canManage: boolean; canProcess: boolean }> = ({ canManage, canProcess }) => {
    const { data: runs, isLoading, isError } = useGetAllPayrollRunsQuery()
    const [isAddOpen, setIsAddOpen] = useState(false)
    const [viewing, setViewing] = useState<number | null>(null)

    return (
        <div>
            {canManage && (
                <div className="flex justify-end mb-4">
                    <button onClick={() => setIsAddOpen(true)} className="btn btn-sm bg-green-800 hover:bg-green-900 text-white flex items-center gap-2"><Plus size={14} /> New Payroll Run</button>
                </div>
            )}
            {isLoading ? <div className="flex justify-center py-16"><span className="loading loading-spinner loading-lg text-green-800"></span></div>
            : isError ? <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center"><XCircle className="mx-auto text-red-500 mb-3" size={40} /><p className="text-red-700">Unable to load payroll runs.</p></div>
            : !runs || runs.length === 0 ? <div className="bg-white rounded-lg shadow-sm p-8 text-center text-gray-500">No payroll runs yet.</div>
            : (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <table className="table table-zebra w-full">
                        <thead><tr className="bg-gray-50"><th>Month</th><th>Status</th><th className="text-center">View</th></tr></thead>
                        <tbody>
                            {runs.map((r) => (
                                <tr key={r.id} className="hover:bg-gray-50">
                                    <td className="font-medium text-gray-800">{r.monthYear}</td>
                                    <td><span className={`badge ${RUN_BADGE[r.status]} capitalize`}>{r.status}</span></td>
                                    <td className="text-center"><button onClick={() => setViewing(r.id)} className="btn btn-ghost btn-xs text-green-800"><Banknote size={14} /></button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            {isAddOpen && <NewRunModal onClose={() => setIsAddOpen(false)} />}
            {viewing !== null && <RunDetailModal runId={viewing} canProcess={canProcess} onClose={() => setViewing(null)} />}
        </div>
    )
}

// ==================== PAGE ====================

const PayrollPage: React.FC = () => {
    const { user } = useSelector((state: RootState) => state.authSlice)
    const canManage = user?.permissions.includes('payroll.manage') ?? false
    const canProcess = user?.permissions.includes('payroll.process') ?? false

    const [tab, setTab] = useState<'employees' | 'runs'>('employees')

    return (
        <DashboardLayout>
            <Toaster position="top-right" richColors />

            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-green-100 rounded-lg">
                    <Banknote className="text-green-800" size={24} />
                </div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Payroll</h1>
            </div>

            <div role="tablist" className="tabs tabs-boxed mb-4 w-fit">
                <a role="tab" className={`tab ${tab === 'employees' ? 'tab-active' : ''}`} onClick={() => setTab('employees')}>Employees</a>
                <a role="tab" className={`tab ${tab === 'runs' ? 'tab-active' : ''}`} onClick={() => setTab('runs')}>Payroll Runs</a>
            </div>

            {tab === 'employees' && <EmployeesPanel canManage={canManage} />}
            {tab === 'runs' && <PayrollRunsPanel canManage={canManage} canProcess={canProcess} />}
        </DashboardLayout>
    )
}

export default PayrollPage
