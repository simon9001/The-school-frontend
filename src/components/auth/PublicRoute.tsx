import React from 'react'
import { useSelector } from 'react-redux'
import type { RootState } from '../../store/store'
import { Navigate } from 'react-router'

interface PublicRouteProps {
    children: React.ReactNode
}

// Wraps /login — an already-authenticated user shouldn't see the login form.
const PublicRoute: React.FC<PublicRouteProps> = ({ children }) => {
    const { isAuthenticated } = useSelector((state: RootState) => state.authSlice)

    if (isAuthenticated) {
        return <Navigate to="/dashboard" replace />
    }

    return <>{children}</>
}

export default PublicRoute
