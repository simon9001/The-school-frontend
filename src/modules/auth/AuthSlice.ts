import { createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'
import type { AuthenticatedUser } from './types'

/** Why a session ended, when it was not the user's own doing. */
export type LogoutReason = 'expired' | 'inactive'

interface AuthState {
  isAuthenticated: boolean
  token: string | null
  user: AuthenticatedUser | null
  /**
   * Set when the session was ended for the user rather than by them, so the
   * login page can say why. Deliberately not persisted and not set by an
   * ordinary logout — landing on /login after clicking "Log out" should not
   * claim anything expired.
   */
  logoutReason: LogoutReason | null
}

const initialState: AuthState = {
  isAuthenticated: false,
  token: null,
  user: null,
  logoutReason: null,
}

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (state, action: PayloadAction<{ user: AuthenticatedUser; token: string }>) => {
      state.user = action.payload.user
      state.token = action.payload.token
      state.isAuthenticated = true
      state.logoutReason = null
    },
    clearCredentials: (state, action: PayloadAction<{ reason?: LogoutReason } | undefined>) => {
      state.user = null
      state.token = null
      state.isAuthenticated = false
      state.logoutReason = action.payload?.reason ?? null
    },

    /** Call once the reason has been shown, so it is not announced twice. */
    clearLogoutReason: (state) => {
      state.logoutReason = null
    },
    updateUserProfile: (state, action: PayloadAction<Partial<AuthenticatedUser>>) => {
      if (state.user) {
        state.user = { ...state.user, ...action.payload }
      }
    },
  },
})

export const { setCredentials, clearCredentials, clearLogoutReason, updateUserProfile } = authSlice.actions
export default authSlice.reducer
