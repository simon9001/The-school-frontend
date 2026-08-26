import React from 'react'
import { Construction } from 'lucide-react'
import DashboardLayout from '../dashboardDesign/DashboardLayout'

interface ComingSoonProps {
    title: string
}

// Placeholder for every module the backend already supports (see the
// backend's project-documentation/) but whose frontend page hasn't been
// built yet — keeps the sidebar honest about the system's full shape
// without shipping a broken link.
const ComingSoon: React.FC<ComingSoonProps> = ({ title }) => {
    return (
        <DashboardLayout>
            <div className="flex flex-col items-center justify-center py-24 text-center">
                <Construction size={48} className="text-gray-300 mb-4" />
                <h1 className="text-xl font-bold text-gray-700 mb-1">{title}</h1>
                <p className="text-gray-500 max-w-md">
                    The backend API for this module is fully built and tested — this page just hasn't been wired up on the frontend yet.
                </p>
            </div>
        </DashboardLayout>
    )
}

export default ComingSoon
