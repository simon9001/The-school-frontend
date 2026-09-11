import React, { useState } from 'react'
import { Download, FileText, Table2 } from 'lucide-react'
import { useSelector } from 'react-redux'
import { schoolName } from '../config/school'
import { useCan } from '../hooks/usePermissions'
import type { RootState } from '../store/store'

export interface ReportColumn<T> {
    header: string
    /** Plain text for the CSV and PDF cells. */
    value: (row: T) => string | number
    /** Richer on-screen cell (badges, colouring). Falls back to value(). */
    render?: (row: T) => React.ReactNode
    align?: 'right'
    className?: string
}

interface PrintableReportProps<T> {
    title: string
    /** The filters the report was run with, so a printout is self-describing. */
    subtitle: string
    /** Base name for downloaded files, without extension. */
    filename: string
    columns: ReportColumn<T>[]
    rows: T[]
    /** One entry per column, shown as a totals row and appended to exports. */
    footerCells?: (string | number)[]
    emptyMessage: string
    /** On-screen content above the table: banners, summary cards. */
    children?: React.ReactNode
}

const cellText = <T,>(col: ReportColumn<T>, row: T) => String(col.value(row) ?? '')

// A field containing a comma, quote or newline has to be quoted or it shifts
// every column after it — student names and payment references both can.
const csvCell = (value: string | number) => {
    const s = String(value ?? '')
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

const saveBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
}

/**
 * Wraps a report table so it can be downloaded as PDF or CSV.
 *
 * Owns the table itself rather than taking it as children: the same column
 * definitions then drive the screen, the PDF and the CSV, so a column added
 * to one cannot silently go missing from the others.
 *
 * Deliberately offers no browser-print path. The app's print stylesheet works
 * by positioning `.print-region` absolutely, which most browsers clip at the
 * first page boundary — a multi-page report would print page one and lose the
 * rest with no warning. jsPDF paginates for itself and is unaffected, so PDF
 * is the only route to paper here. The letterhead and the 'Prepared by' line
 * live in the PDF's per-page hook below.
 */
function PrintableReport<T>({
    title,
    subtitle,
    filename,
    columns,
    rows,
    footerCells,
    emptyMessage,
    children,
}: PrintableReportProps<T>) {
    const { can } = useCan()
    const user = useSelector((state: RootState) => state.authSlice.user)
    const [busy, setBusy] = useState(false)

    const preparedBy = user?.fullName ?? '-'
    const printedAt = new Date().toLocaleString()
    const canExport = can('reports.export')

    const downloadCsv = () => {
        const lines = [
            columns.map((c) => csvCell(c.header)).join(','),
            ...rows.map((row) => columns.map((c) => csvCell(cellText(c, row))).join(',')),
        ]
        if (footerCells) lines.push(footerCells.map(csvCell).join(','))

        // Excel reads a CSV as the system codepage unless it sees a BOM, which
        // mangles any non-ASCII name in the export.
        const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' })
        saveBlob(blob, `${filename}.csv`)
    }

    const downloadPdf = async () => {
        setBusy(true)
        try {
            // Loaded on demand — jsPDF is far larger than the page that uses it,
            // and most sessions never export.
            const [{ default: JsPDF }, { default: autoTable }] = await Promise.all([
                import('jspdf'),
                import('jspdf-autotable'),
            ])

            const doc = new JsPDF({ orientation: columns.length > 6 ? 'landscape' : 'portrait' })
            const pageWidth = doc.internal.pageSize.getWidth()

            autoTable(doc, {
                head: [columns.map((c) => c.header)],
                body: rows.map((row) => columns.map((c) => cellText(c, row))),
                foot: footerCells ? [footerCells.map(String)] : undefined,
                startY: 34,
                margin: { top: 34, bottom: 22 },
                styles: { fontSize: 8, cellPadding: 2 },
                headStyles: { fillColor: [22, 101, 52], textColor: 255 },
                footStyles: { fillColor: [243, 244, 246], textColor: 20, fontStyle: 'bold' },
                columnStyles: Object.fromEntries(
                    columns.map((c, i) => [i, { halign: c.align === 'right' ? 'right' : 'left' }]),
                ),
                // Repeated per page so a detached page still identifies itself.
                didDrawPage: () => {
                    doc.setFontSize(13)
                    doc.text(schoolName.toUpperCase(), pageWidth / 2, 16, { align: 'center' })
                    doc.setFontSize(10)
                    doc.text(title, pageWidth / 2, 22, { align: 'center' })
                    doc.setFontSize(8)
                    doc.text(subtitle, pageWidth / 2, 27, { align: 'center' })

                    const pageHeight = doc.internal.pageSize.getHeight()
                    doc.setFontSize(7)
                    doc.text(`Prepared by: ${preparedBy}`, 14, pageHeight - 10)
                    doc.text(`Printed: ${printedAt}`, pageWidth - 14, pageHeight - 10, { align: 'right' })
                },
            })

            doc.save(`${filename}.pdf`)
        } finally {
            setBusy(false)
        }
    }

    return (
        <div>
            {canExport && (
                <div className="flex justify-end gap-2 mb-3">
                    <div className="dropdown dropdown-end">
                        <div
                            tabIndex={0}
                            role="button"
                            className="btn btn-sm bg-green-800 hover:bg-green-900 text-white"
                        >
                            <Download size={16} />
                            {busy ? 'Preparing...' : 'Download'}
                        </div>
                        <ul
                            tabIndex={0}
                            className="dropdown-content menu bg-white rounded-box z-10 w-44 p-2 shadow border border-gray-200"
                        >
                            <li>
                                <button onClick={downloadPdf} disabled={busy}>
                                    <FileText size={16} /> PDF
                                </button>
                            </li>
                            <li>
                                <button onClick={downloadCsv}>
                                    <Table2 size={16} /> CSV (Excel)
                                </button>
                            </li>
                        </ul>
                    </div>
                </div>
            )}

            {children}

            {rows.length === 0 ? (
                <div className="bg-white rounded-lg shadow-sm p-8 text-center text-gray-500">{emptyMessage}</div>
            ) : (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto scroll-fade-x">
                        <table className="table table-zebra w-full">
                            <thead>
                                <tr className="bg-gray-50">
                                    {columns.map((c) => (
                                        <th key={c.header} className={c.align === 'right' ? 'text-right' : undefined}>
                                            {c.header}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row, i) => (
                                    <tr key={i} className="hover:bg-gray-50">
                                        {columns.map((c) => (
                                            <td
                                                key={c.header}
                                                className={`${c.align === 'right' ? 'text-right ' : ''}${c.className ?? ''}`}
                                            >
                                                {c.render ? c.render(row) : cellText(c, row)}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                            {footerCells && (
                                <tfoot>
                                    <tr className="bg-gray-50 font-bold">
                                        {footerCells.map((cell, i) => (
                                            <td
                                                key={columns[i]?.header ?? i}
                                                className={columns[i]?.align === 'right' ? 'text-right font-mono' : undefined}
                                            >
                                                {cell}
                                            </td>
                                        ))}
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                </div>
            )}
        </div>
    )
}

export default PrintableReport
