import React from 'react'
import { ShieldCheck } from 'lucide-react'
import type { PermissionDetail } from '../auth/types'

// Module codes are the backend's RBAC grouping (see rbac.ts). Anything not
// listed falls back to a title-cased version of the code itself, so a new
// backend module shows up sensibly here without a frontend change.
const MODULE_LABELS: Record<string, string> = {
  identity: 'Users & Roles',
  ledger: 'Ledger',
  budget: 'Budgets',
  fees: 'Fees',
  grants: 'Grants & Capitation',
  procurement: 'Procurement',
  payroll: 'Payroll',
  assets: 'Fixed Assets',
  inventory: 'Inventory',
  banking: 'Banking',
  reports: 'Reports',
  audit: 'Audit',
  communication: 'Communication',
  hr: 'HR',
  admissions: 'Admissions',
  academic_records: 'Student Records',
  exams: 'Exams',
  student_discipline: 'Student Conduct',
  welfare: 'Welfare & Facilities',
  academic_ops: 'Academic Operations',
  compliance: 'Compliance',
}

const labelFor = (module: string) =>
  MODULE_LABELS[module] ??
  module.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

const CapabilityCard: React.FC<{ permissions: PermissionDetail[] }> = ({ permissions }) => {
  const grouped = permissions.reduce<Record<string, PermissionDetail[]>>((acc, p) => {
    ;(acc[p.module] ??= []).push(p)
    return acc
  }, {})

  const modules = Object.keys(grouped).sort((a, b) => labelFor(a).localeCompare(labelFor(b)))

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
      <div className="flex items-center gap-2 border-b border-gray-100 pb-4">
        <ShieldCheck className="text-green-800" size={20} />
        <h2 className="text-lg font-bold text-gray-800">What You Can Do</h2>
        <span className="ml-auto text-xs text-gray-400">
          {permissions.length} {permissions.length === 1 ? 'capability' : 'capabilities'}
        </span>
      </div>

      {permissions.length === 0 ? (
        <p className="text-sm text-gray-500">
          No permissions are assigned to your account yet. Ask an administrator to assign you a role.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
          {modules.map((module) => (
            <div key={module}>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                {labelFor(module)}
              </h3>
              <ul className="space-y-1.5">
                {grouped[module].map((p) => (
                  <li key={p.code} className="text-sm text-gray-700 flex gap-2">
                    <span className="text-green-700 mt-0.5 shrink-0">&bull;</span>
                    <span>{p.description}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default CapabilityCard
