import React from 'react'
import { ShieldAlert } from 'lucide-react'
import DashboardLayout from '../dashboardDesign/DashboardLayout'

// Landing point for an authenticated user who hit a route their role's
// permissions don't cover. Deliberately NOT '/dashboard' — that route itself
// requires 'dashboard.view', so redirecting a user who lacks it back there
// would infinite-loop instead of showing them anything.
const AccessDenied: React.FC = () => {
    return (
        <DashboardLayout>
            <div className="flex flex-col items-center justify-center py-24 text-center">
                <ShieldAlert size={48} className="text-red-300 mb-4" />
                <h1 className="text-xl font-bold text-gray-700 mb-1">Access Denied</h1>
                <p className="text-gray-500 max-w-md">
                    Your account role doesn't include permission to view this page. If you believe this is a mistake, contact your system administrator.
                </p>
            </div>
        </DashboardLayout>
    )
}

export default AccessDenied
