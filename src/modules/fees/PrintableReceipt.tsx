import React from 'react'
import { Printer, X } from 'lucide-react'
import type { FeePayment } from './types'
import type { Student } from '../students/types'

const formatMoney = (amount: string | number) =>
    Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const METHOD_LABEL: Record<string, string> = {
    cash: 'Cash',
    bank: 'Bank Deposit',
    mpesa: 'M-Pesa',
    cheque: 'Cheque',
}

interface PrintableReceiptProps {
    payment: FeePayment
    student: Student | undefined
    /** Shown as the receipt letterhead. */
    schoolName: string
    /** Full name of the officer who took the money, for the signature line. */
    receivedByName: string
    onClose: () => void
}

const PrintableReceipt: React.FC<PrintableReceiptProps> = ({ payment, student, schoolName, receivedByName, onClose }) => (
    <div className="modal modal-open">
        <div className="modal-box max-w-lg">
            <div className="print-region bg-white p-6">
                <div className="text-center border-b border-gray-300 pb-4 mb-4">
                    <h2 className="text-lg font-bold uppercase tracking-wide">{schoolName}</h2>
                    <p className="text-sm text-gray-600">Official Fee Receipt</p>
                </div>

                <div className="flex justify-between text-sm mb-4">
                    <span className="font-semibold">Receipt No.</span>
                    <span className="font-mono">{payment.receiptNo}</span>
                </div>

                <table className="w-full text-sm mb-6">
                    <tbody>
                        <tr>
                            <td className="py-1 text-gray-600">Student</td>
                            <td className="py-1 text-right font-medium">
                                {student ? `${student.firstName} ${student.lastName}` : `#${payment.studentId}`}
                            </td>
                        </tr>
                        <tr>
                            <td className="py-1 text-gray-600">Admission No.</td>
                            <td className="py-1 text-right font-mono">{student?.admissionNo ?? '—'}</td>
                        </tr>
                        <tr>
                            <td className="py-1 text-gray-600">Date</td>
                            <td className="py-1 text-right">{payment.paymentDate}</td>
                        </tr>
                        <tr>
                            <td className="py-1 text-gray-600">Method</td>
                            <td className="py-1 text-right">{METHOD_LABEL[payment.paymentMethod] ?? payment.paymentMethod}</td>
                        </tr>
                        {payment.referenceNo && (
                            <tr>
                                <td className="py-1 text-gray-600">Reference</td>
                                <td className="py-1 text-right font-mono">{payment.referenceNo}</td>
                            </tr>
                        )}
                    </tbody>
                </table>

                <div className="flex justify-between items-center border-t-2 border-gray-800 pt-3 mb-8">
                    <span className="font-bold">Amount Received</span>
                    <span className="font-bold font-mono text-lg">KES {formatMoney(payment.amount)}</span>
                </div>

                <div className="text-sm">
                    <div className="border-b border-gray-400 w-56 mb-1">&nbsp;</div>
                    <p className="text-gray-600">Received by: {receivedByName}</p>
                </div>
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

export default PrintableReceipt
