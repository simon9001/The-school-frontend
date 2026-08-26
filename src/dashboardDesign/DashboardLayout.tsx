import React from 'react'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import Sidebar from './Sidebar'

interface DashboardLayoutProps {
    children: React.ReactNode
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
    return (
        <div className="min-h-screen bg-gray-50">
            <Navbar />

            <div className="flex">
                <Sidebar />

                <main className="flex-1 ml-64">
                    <div className="p-6 min-h-[calc(100vh-128px)]">
                        {children}
                    </div>
                </main>
            </div>

            <div className="ml-64">
                <Footer />
            </div>
        </div>
    )
}

export default DashboardLayout
