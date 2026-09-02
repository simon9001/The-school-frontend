import React from 'react'
import { Printer, X } from 'lucide-react'
import type { FeeInvoice, FeePayment } from './types'
import type { Student } from '../students/types'

const formatMoney = (amount: string | number) =>
    Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

interface StatementLine {
    date: string
    reference: string
    description: string
    debit: number
    credit: number
}

interface PrintableStatementProps {
    student: Student
    invoices: FeeInvoice[]
    payments: FeePayment[]
    schoolName: string
    onClose: () => void
}

const PrintableStatement: React.FC<PrintableStatementProps> = ({ student, invoices, payments, schoolName, onClose }) => {
    // A statement reads as one chronological account: invoices debit the
    // student, payments credit them, and the balance is the running total —
    // which is what a parent asks to be shown.
    const lines: StatementLine[] = [
        ...invoices.map((inv) => ({
            date: inv.invoiceDate,
            reference: inv.invoiceNo,
            description: 'Fee invoice',
            debit: Number(inv.totalAmount),
            credit: 0,
        })),
        ...payments.map((p) => ({
            date: p.paymentDate,
            reference: p.receiptNo,
            description: `Payment — ${p.paymentMethod}`,
            debit: 0,
            credit: Number(p.amount),
        })),
    ].sort((a, b) => (a.date === b.date ? a.reference.localeCompare(b.reference) : a.date.localeCompare(b.date)))

    let running = 0

    return (
        <div className="modal modal-open">
            <div className="modal-box max-w-3xl">
                <div className="print-region bg-white p-6">
                    <div className="text-center border-b border-gray-300 pb-4 mb-4">
                        <h2 className="text-lg font-bold uppercase tracking-wide">{schoolName}</h2>
                        <p className="text-sm text-gray-600">Student Fee Statement</p>
                    </div>

                    <div className="flex justify-between text-sm mb-4">
                        <div>
                            <div className="font-semibold">{student.firstName} {student.lastName}</div>
                            <div className="text-gray-600 font-mono">{student.admissionNo}</div>
                        </div>
                        <div className="text-right text-gray-600">
                            Printed {new Date().toISOString().slice(0, 10)}
                        </div>
                    </div>

                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b-2 border-gray-800">
                                <th className="text-left py-2">Date</th>
                                <th className="text-left py-2">Reference</th>
                                <th className="text-left py-2">Description</th>
                                <th className="text-right py-2">Debit</th>
                                <th className="text-right py-2">Credit</th>
                                <th className="text-right py-2">Balance</th>
                            </tr>
                        </thead>
                        <tbody>
                            {lines.length === 0 ? (
                                <tr><td colSpan={6} className="text-center py-6 text-gray-400">No transactions.</td></tr>
                            ) : lines.map((line, i) => {
                                running += line.debit - line.credit
                                return (
                                    <tr key={i} className="border-b border-gray-100">
                                        <td className="py-1.5">{line.date}</td>
                                        <td className="py-1.5 font-mono text-xs">{line.reference}</td>
                                        <td className="py-1.5">{line.description}</td>
                                        <td className="py-1.5 text-right font-mono">{line.debit ? formatMoney(line.debit) : ''}</td>
                                        <td className="py-1.5 text-right font-mono">{line.credit ? formatMoney(line.credit) : ''}</td>
                                        <td className="py-1.5 text-right font-mono">{formatMoney(running)}</td>
                                    </tr>
                                )
                            })}
                        </tbody>
                        <tfoot>
                            <tr className="border-t-2 border-gray-800 font-bold">
                                <td colSpan={5} className="py-2">Balance Due</td>
                                <td className="py-2 text-right font-mono">KES {formatMoney(running)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                <div className="modal-action no-print">
                    <button onClick={onClose} className="btn btn-ghost">
                        <X size={16} /> Close
                    </button>
                    <button onClick={() => window.print()} className="btn bg-green-800 hover:bg-green-900 text-white">
                        <Printer size={16} /> Print
                    </button>
                </div>
            </div>
        </div>
    )
}

export default PrintableStatement
