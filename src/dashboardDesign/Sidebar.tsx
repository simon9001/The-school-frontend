import React from 'react'
import { Link, useLocation } from 'react-router'
import { useSelector } from 'react-redux'
import type { RootState } from '../store/store'
import { navigation } from './navigation'

interface SidebarProps {
    /** Whether the off-canvas drawer is open. Ignored at the `lg` breakpoint
     *  and above, where the sidebar is always visible in the layout. */
    isOpen: boolean
    onClose: () => void
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
    const location = useLocation()
    const { user } = useSelector((state: RootState) => state.authSlice)
    const permissions = user?.permissions ?? []

    const isActive = (path: string) => location.pathname === path

    // A nav item with no `permission` set is always visible; otherwise the
    // user needs that exact permission code to see it in the sidebar at all.
    const canSee = (permission?: string) => !permission || permissions.includes(permission)

    return (
        <aside
            className={`bg-white border-r border-gray-200 shadow-sm w-64 h-[calc(100vh-4rem)] fixed left-0 top-16 z-40 overflow-y-auto transition-transform duration-200 ease-in-out
                ${isOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}
        >
            <nav className="p-4 space-y-6">
                {navigation.map((section) => {
                    const visibleItems = section.items.filter((item) => canSee(item.permission))
                    if (visibleItems.length === 0) return null

                    return (
                        <div key={section.title}>
                            <h3 className="px-3 mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                                {section.title}
                            </h3>
                            <div className="space-y-1">
                                {visibleItems.map((item) => {
                                    const Icon = item.icon
                                    return (
                                        <Link
                                            key={item.path}
                                            to={item.path}
                                            onClick={onClose}
                                            className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${isActive(item.path)
                                                ? 'bg-green-800 text-white shadow-md'
                                                : 'text-gray-600 hover:bg-gray-100 hover:text-green-800'
                                                }`}
                                        >
                                            <span className="flex items-center gap-3">
                                                <Icon size={18} className="shrink-0" />
                                                {item.name}
                                            </span>
                                            {!item.built && (
                                                <span className="badge badge-ghost badge-xs text-[10px]">soon</span>
                                            )}
                                        </Link>
                                    )
                                })}
                            </div>
                        </div>
                    )
                })}
            </nav>
        </aside>
    )
}

export default Sidebar
