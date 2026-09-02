import React from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Link, useNavigate } from 'react-router'
import { GraduationCap, LogOut, Menu } from 'lucide-react'
import type { RootState, AppDispatch } from '../store/store'
import { clearCredentials } from '../modules/auth/AuthSlice'
import GlobalSearchBar from './GlobalSearchBar'

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
        <nav className="navbar bg-white border-b border-gray-200 sticky top-0 z-50 px-3 sm:px-6 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 shrink-0">
                {onMenuClick && (
                    <button
                        onClick={onMenuClick}
                        className="btn btn-ghost btn-square btn-sm lg:hidden shrink-0"
                        aria-label="Open menu"
                    >
                        <Menu size={20} />
                    </button>
                )}
                <Link to="/" className="flex items-center gap-2 text-lg font-bold text-green-800 min-w-0">
                    <GraduationCap size={24} className="shrink-0" />
                    <span className="truncate">
                        <span className="sm:hidden">SMS</span>
                        <span className="hidden sm:inline">School Management System</span>
                    </span>
                </Link>
            </div>

            {/* Global User-Scoped Search Bar */}
            {isAuthenticated && (
                <div className="flex-1 flex justify-center max-w-lg mx-auto">
                    <GlobalSearchBar />
                </div>
            )}

            {isAuthenticated && user && (
                <div className="flex items-center gap-2 sm:gap-4 shrink-0 ml-auto">
                    <Link
                        to="/dashboard/profile"
                        className="flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-gray-100 transition-colors text-left"
                        title="View Profile"
                    >
                        <div className="w-8 h-8 rounded-lg bg-green-100 text-green-800 font-bold flex items-center justify-center overflow-hidden border border-green-200 shrink-0">
                            {user.avatarUrl ? (
                                <img src={user.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                            ) : (
                                <span className="text-xs">
                                    {user.fullName
                                        ?.split(' ')
                                        .map((n) => n[0])
                                        .slice(0, 2)
                                        .join('')
                                        .toUpperCase() || 'U'}
                                </span>
                            )}
                        </div>
                        <div className="hidden md:flex flex-col">
                            <span className="text-xs font-semibold text-gray-800 leading-tight truncate max-w-[140px]">
                                {user.fullName}
                            </span>
                            <span className="text-[10px] text-gray-500 capitalize">
                                {user.roles?.[0]?.replace(/_/g, ' ') || 'Staff'}
                            </span>
                        </div>
                    </Link>

                    <button
                        onClick={handleLogout}
                        className="btn btn-ghost btn-sm text-red-600 flex items-center gap-1 hover:bg-red-50"
                        title="Logout"
                    >
                        <LogOut size={16} />
                        <span className="hidden sm:inline">Logout</span>
                    </button>
                </div>
            )}
        </nav>
    )
}

export default Navbar
