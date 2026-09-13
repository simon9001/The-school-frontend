import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { store } from '../store/store'
import { setCredentials, clearCredentials, clearLogoutReason } from '../modules/auth/AuthSlice'
import { studentApi } from '../modules/students/StudentApi'
import type { AuthenticatedUser } from '../modules/auth/types'

const ALICE: AuthenticatedUser = {
  id: 1,
  email: 'alice@school.test',
  fullName: 'Alice Bursar',
  roles: ['Bursar'],
  permissions: ['fees.view'],
}

const realFetch = globalThis.fetch

function respondWith(status: number, body: unknown) {
  globalThis.fetch = (async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    })) as typeof fetch
}

const fetchStudents = () =>
  store.dispatch(studentApi.endpoints.getAllStudents.initiate(undefined, { forceRefetch: true }))

describe('authBaseQuery session handling', () => {
  beforeEach(() => {
    store.dispatch(clearCredentials())
    store.dispatch(setCredentials({ user: ALICE, token: 'token-for-alice' }))
  })

  afterEach(() => {
    globalThis.fetch = realFetch
  })

  it('ends the session on a 401 and records why', async () => {
    respondWith(401, { success: false, error: 'Not authenticated' })
    await fetchStudents()

    const { authSlice } = store.getState() as { authSlice: { isAuthenticated: boolean; token: string | null; logoutReason: string | null } }
    expect(authSlice.isAuthenticated).toBe(false)
    expect(authSlice.token).toBeNull()
    expect(authSlice.logoutReason).toBe('expired')
  })

  it('leaves the session alone on a 403 permission denial', async () => {
    respondWith(403, { success: false, error: 'Missing required permission: payroll.process' })
    await fetchStudents()

    const { authSlice } = store.getState() as { authSlice: { isAuthenticated: boolean } }
    expect(authSlice.isAuthenticated).toBe(true)
  })

  it('reports no reason after a deliberate logout', () => {
    store.dispatch(clearCredentials())
    const { authSlice } = store.getState() as { authSlice: { logoutReason: string | null } }
    expect(authSlice.logoutReason).toBeNull()
  })

  it('clears the reason once it has been shown', async () => {
    respondWith(401, { success: false, error: 'Not authenticated' })
    await fetchStudents()
    store.dispatch(clearLogoutReason())
    const { authSlice } = store.getState() as { authSlice: { logoutReason: string | null } }
    expect(authSlice.logoutReason).toBeNull()
  })
})
