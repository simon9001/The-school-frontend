import React from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Link, useNavigate } from 'react-router'
import { GraduationCap, LogOut } from 'lucide-react'
import type { RootState, AppDispatch } from '../store/store'
import { clearCredentials } from '../modules/auth/AuthSlice'

const Navbar: React.FC = () => {
    const { isAuthenticated, user } = useSelector((state: RootState) => state.authSlice)
    const dispatch = useDispatch<AppDispatch>()
    const navigate = useNavigate()

    const handleLogout = () => {
        dispatch(clearCredentials())
        navigate('/login')
    }

    return (
        <nav className="navbar bg-white border-b border-gray-200 sticky top-0 z-50 px-6">
            <div className="flex-1">
                <Link to="/" className="flex items-center gap-2 text-lg font-bold text-green-800">
                    <GraduationCap size={24} />
                    School Management System
                </Link>
            </div>
            {isAuthenticated && user && (
                <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-600 hidden sm:inline">{user.fullName}</span>
                    <button onClick={handleLogout} className="btn btn-ghost btn-sm text-red-600 flex items-center gap-1">
                        <LogOut size={16} />
                        Logout
                    </button>
                </div>
            )}
        </nav>
    )
}

export default Navbar
