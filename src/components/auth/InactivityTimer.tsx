import React, { useEffect, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { toast } from 'sonner'
import { clearCredentials } from '../../modules/auth/AuthSlice'
import type { AppDispatch, RootState } from '../../store/store'

interface InactivityTimerProps {
    /** Timeout in minutes. Defaults to 15 minutes. */
    timeoutMinutes?: number
}

const STORAGE_KEY = 'sms_last_activity'

export const InactivityTimer: React.FC<InactivityTimerProps> = ({ timeoutMinutes = 15 }) => {
    const timeoutMs = timeoutMinutes * 60 * 1000
    const { isAuthenticated } = useSelector((state: RootState) => state.authSlice)
    const dispatch = useDispatch<AppDispatch>()
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const logoutDueToInactivity = () => {
        sessionStorage.removeItem(STORAGE_KEY)
        dispatch(clearCredentials())
        toast.error('You have been logged out due to inactivity.')
    }

    const resetTimer = () => {
        if (!isAuthenticated) return

        const now = Date.now()
        sessionStorage.setItem(STORAGE_KEY, String(now))

        if (timerRef.current) {
            clearTimeout(timerRef.current)
        }

        timerRef.current = setTimeout(() => {
            logoutDueToInactivity()
        }, timeoutMs)
    }

    const checkInactivity = () => {
        if (!isAuthenticated) return
        const lastActiveStr = sessionStorage.getItem(STORAGE_KEY)
        if (lastActiveStr) {
            const lastActive = Number(lastActiveStr)
            if (Date.now() - lastActive >= timeoutMs) {
                logoutDueToInactivity()
                return
            }
        }
        resetTimer()
    }

    useEffect(() => {
        if (!isAuthenticated) {
            if (timerRef.current) clearTimeout(timerRef.current)
            sessionStorage.removeItem(STORAGE_KEY)
            return
        }

        // Initial activity check
        checkInactivity()

        const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click']
        const handleUserActivity = () => {
            resetTimer()
        }

        events.forEach((event) => {
            window.addEventListener(event, handleUserActivity, { passive: true })
        })

        // Check when tab becomes visible again
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                checkInactivity()
            }
        }
        document.addEventListener('visibilitychange', handleVisibilityChange)
        window.addEventListener('focus', checkInactivity)

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current)
            events.forEach((event) => {
                window.removeEventListener(event, handleUserActivity)
            })
            document.removeEventListener('visibilitychange', handleVisibilityChange)
            window.removeEventListener('focus', checkInactivity)
        }
    }, [isAuthenticated, timeoutMs])

    return null
}

export default InactivityTimer
