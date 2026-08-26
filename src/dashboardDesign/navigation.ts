import type { LucideIcon } from 'lucide-react'
import {
    LayoutDashboard, BookOpen, Landmark, Wallet, Scale, PiggyBank, HandCoins,
    ShoppingCart, Banknote, Boxes, Package, University, GraduationCap, Users,
    CalendarDays, ClipboardCheck, ShieldAlert, ArrowUpDown, MessageSquare,
    Bell, UserSquare2, Briefcase, CalendarClock, FileSignature, Star,
    UserRoundCog, ClipboardList, Award, Home, HeartPulse, Bus,
    CalendarRange, Library, Trophy, FileCheck2, FileText, Settings,
} from 'lucide-react'

export interface NavItem {
    name: string
    path: string
    icon: LucideIcon
    /** Permission needed to see this item — omit for always-visible items. */
    permission?: string
    /** Set once a real page exists at `path`; otherwise routes to a "coming soon" placeholder. */
    built?: boolean
}

export interface NavSection {
    title: string
    items: NavItem[]
}

// Mirrors the backend's module grouping 1:1 (see project-documentation/09-rbac.md)
// so every permission the RBAC system defines has a home in the UI, even
// before the page behind it is built.
export const navigation: NavSection[] = [
    {
        title: 'Overview',
        items: [
            { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, permission: 'dashboard.view', built: true },
        ],
    },
    {
        title: 'Finance',
        items: [
            { name: 'Chart of Accounts', path: '/dashboard/finance/accounts', icon: BookOpen, permission: 'ledger.journal.view', built: true },
            { name: 'Funds / Voteheads', path: '/dashboard/finance/funds', icon: Landmark, permission: 'ledger.journal.view', built: true },
            { name: 'Journal Entries', path: '/dashboard/finance/journal', icon: Scale, permission: 'ledger.journal.view' },
            { name: 'Trial Balance', path: '/dashboard/finance/trial-balance', icon: Scale, permission: 'ledger.journal.view', built: true },
            { name: 'Budgets', path: '/dashboard/finance/budgets', icon: Wallet, permission: 'budget.view' },
            { name: 'Fees', path: '/dashboard/finance/fees', icon: HandCoins, permission: 'fees.view', built: true },
            { name: 'Grants / Capitation', path: '/dashboard/finance/grants', icon: PiggyBank, permission: 'grants.view' },
            { name: 'Procurement', path: '/dashboard/finance/procurement', icon: ShoppingCart, permission: 'procurement.view' },
            { name: 'Payroll', path: '/dashboard/finance/payroll', icon: Banknote, permission: 'payroll.view' },
            { name: 'Fixed Assets', path: '/dashboard/finance/assets', icon: Boxes, permission: 'assets.view' },
            { name: 'Inventory', path: '/dashboard/finance/inventory', icon: Package, permission: 'inventory.view' },
            { name: 'Banking', path: '/dashboard/finance/banking', icon: University, permission: 'banking.manage' },
        ],
    },
    {
        title: 'Students & Admissions',
        items: [
            { name: 'Admissions', path: '/dashboard/admissions', icon: UserSquare2, permission: 'admissions.view', built: true },
            { name: 'Students', path: '/dashboard/students', icon: GraduationCap, built: true },
        ],
    },
    {
        title: 'Academic',
        items: [
            { name: 'Teachers', path: '/dashboard/academic/teachers', icon: Users },
            { name: 'Subjects', path: '/dashboard/academic/subjects', icon: BookOpen },
            { name: 'Exams & Grading', path: '/dashboard/academic/exams', icon: ClipboardCheck },
            { name: 'Attendance', path: '/dashboard/academic/attendance', icon: CalendarDays },
            { name: 'Timetable', path: '/dashboard/academic/timetable', icon: CalendarRange, permission: 'timetable.view' },
            { name: 'Promotions', path: '/dashboard/academic/promotions', icon: ArrowUpDown },
            { name: 'Library', path: '/dashboard/academic/library', icon: Library, permission: 'library.view' },
            { name: 'Clubs & Competitions', path: '/dashboard/academic/clubs', icon: Trophy, permission: 'clubs.view' },
        ],
    },
    {
        title: 'Student Conduct',
        items: [
            { name: 'Discipline Log', path: '/dashboard/conduct/discipline', icon: ShieldAlert, permission: 'discipline.view' },
            { name: 'Conduct Points', path: '/dashboard/conduct/points', icon: Award, permission: 'conduct_points.view' },
            { name: 'Disciplinary Cases', path: '/dashboard/conduct/cases', icon: FileSignature, permission: 'disciplinary_cases.view' },
            { name: 'Counseling', path: '/dashboard/conduct/counseling', icon: HeartPulse, permission: 'counseling.access' },
        ],
    },
    {
        title: 'Welfare & Facilities',
        items: [
            { name: 'Boarding', path: '/dashboard/welfare/boarding', icon: Home, permission: 'boarding.view' },
            { name: 'Health', path: '/dashboard/welfare/health', icon: HeartPulse, permission: 'health.access' },
            { name: 'Transport', path: '/dashboard/welfare/transport', icon: Bus, permission: 'transport.view' },
        ],
    },
    {
        title: 'HR',
        items: [
            { name: 'Staff Registry', path: '/dashboard/hr/staff', icon: Briefcase, permission: 'staff.view' },
            { name: 'Leave', path: '/dashboard/hr/leave', icon: CalendarClock, permission: 'leave.view' },
            { name: 'Contracts', path: '/dashboard/hr/contracts', icon: FileSignature, permission: 'contracts.view' },
            { name: 'Appraisals', path: '/dashboard/hr/appraisals', icon: Star, permission: 'appraisals.view' },
            { name: 'Staff Discipline', path: '/dashboard/hr/discipline', icon: UserRoundCog, permission: 'staff_discipline.view' },
        ],
    },
    {
        title: 'Communication',
        items: [
            { name: 'Notices', path: '/dashboard/communication/notices', icon: MessageSquare, permission: 'notices.manage' },
            { name: 'Notifications', path: '/dashboard/communication/notifications', icon: Bell, permission: 'notifications.send' },
        ],
    },
    {
        title: 'Compliance',
        items: [
            { name: 'Regulatory Reports', path: '/dashboard/compliance/reports', icon: ClipboardList, permission: 'compliance.view' },
            { name: 'Documents', path: '/dashboard/compliance/documents', icon: FileText, permission: 'documents.view' },
            { name: 'Compliance Log', path: '/dashboard/compliance/audit', icon: FileCheck2, permission: 'audit.view' },
        ],
    },
    {
        title: 'Administration',
        items: [
            { name: 'Users & Roles', path: '/dashboard/admin/users', icon: Settings, permission: 'users.manage' },
        ],
    },
]
