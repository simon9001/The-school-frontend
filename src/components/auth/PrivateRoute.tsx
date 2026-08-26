import React from 'react'
import { useSelector } from 'react-redux'
import type { RootState } from '../../store/store'
import { Navigate } from 'react-router'

interface PrivateRouteProps {
    children: React.ReactNode
    /** Omit for "just needs to be logged in"; set for a specific permission gate. */
    requiredPermission?: string
}

// Generalized guard for our permission-based RBAC (80 granular permission
// codes across 21 roles) — unlike a fixed 'admin'/'customer' role string,
// so this checks user.permissions.includes(requiredPermission) rather than
// a hardcoded role comparison. Individual page actions (buttons, forms)
// still do their own finer-grained permission checks beyond just routing.
const PrivateRoute: React.FC<PrivateRouteProps> = ({ children, requiredPermission }) => {
    const { isAuthenticated, user } = useSelector((state: RootState) => state.authSlice)

    if (!isAuthenticated || !user) {
        return <Navigate to="/login" replace />
    }

    if (requiredPermission && !user.permissions.includes(requiredPermission)) {
        return <Navigate to="/dashboard" replace />
    }

    return <>{children}</>
}

export default PrivateRoute
