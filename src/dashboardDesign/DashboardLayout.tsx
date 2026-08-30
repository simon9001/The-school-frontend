import React, { useState } from 'react'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import Sidebar from './Sidebar'

interface DashboardLayoutProps {
    children: React.ReactNode
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false)

    return (
        <div className="min-h-screen bg-gray-50">
            <Navbar onMenuClick={() => setIsSidebarOpen(true)} />

            <div className="flex">
                <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

                {/* Dims and blocks the page behind the sidebar on mobile; the sidebar
                    itself is fixed/off-canvas below lg, so this is unnecessary (and
                    hidden) once the sidebar sits permanently in the flex row. */}
                {isSidebarOpen && (
                    <div
                        className="fixed inset-0 bg-black/40 z-30 lg:hidden"
                        onClick={() => setIsSidebarOpen(false)}
                        aria-hidden="true"
                    />
                )}

                <main className="flex-1 min-w-0 lg:ml-64">
                    <div className="p-4 sm:p-6 min-h-[calc(100vh-128px)]">
                        {children}
                    </div>
                </main>
            </div>

            <div className="lg:ml-64">
                <Footer />
            </div>
        </div>
    )
}

export default DashboardLayout
