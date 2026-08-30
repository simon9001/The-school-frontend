import React from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Link, useNavigate } from 'react-router'
import { GraduationCap, LogOut, Menu } from 'lucide-react'
import type { RootState, AppDispatch } from '../store/store'
import { clearCredentials } from '../modules/auth/AuthSlice'

interface NavbarProps {
    /** Omit on pages with no sidebar (e.g. the login screen) to hide the hamburger. */
    onMenuClick?: () => void
}

const Navbar: React.FC<NavbarProps> = ({ onMenuClick }) => {
    const { isAuthenticated, user } = useSelector((state: RootState) => state.authSlice)
    const dispatch = useDispatch<AppDispatch>()
    const navigate = useNavigate()

    const handleLogout = () => {
        dispatch(clearCredentials())
        navigate('/login')
    }

    return (
        <nav className="navbar bg-white border-b border-gray-200 sticky top-0 z-50 px-3 sm:px-6 gap-2">
            {onMenuClick && (
                <button
                    onClick={onMenuClick}
                    className="btn btn-ghost btn-square btn-sm lg:hidden shrink-0"
                    aria-label="Open menu"
                >
                    <Menu size={20} />
                </button>
            )}
            <div className="flex-1 min-w-0">
                <Link to="/" className="flex items-center gap-2 text-lg font-bold text-green-800 min-w-0">
                    <GraduationCap size={24} className="shrink-0" />
                    <span className="truncate">
                        <span className="sm:hidden">SMS</span>
                        <span className="hidden sm:inline">School Management System</span>
                    </span>
                </Link>
            </div>
            {isAuthenticated && user && (
                <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                    <span className="text-sm text-gray-600 hidden md:inline">{user.fullName}</span>
                    <button onClick={handleLogout} className="btn btn-ghost btn-sm text-red-600 flex items-center gap-1">
                        <LogOut size={16} />
                        <span className="hidden sm:inline">Logout</span>
                    </button>
                </div>
            )}
        </nav>
    )
}

export default Navbar
