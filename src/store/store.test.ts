import { describe, it, expect, beforeEach } from 'vitest'
import { store } from './store'
import { setCredentials, clearCredentials } from '../modules/auth/AuthSlice'
import { AuthApi } from '../modules/auth/AuthApi'
import { studentApi } from '../modules/students/StudentApi'
import type { AuthenticatedUser } from '../modules/auth/types'

const ALICE: AuthenticatedUser = {
  id: 1,
  email: 'alice@school.test',
  fullName: 'Alice Bursar',
  roles: ['Bursar'],
  permissions: ['payroll.process'],
}

const BOB: AuthenticatedUser = {
  id: 2,
  email: 'bob@school.test',
  fullName: 'Bob Teacher',
  roles: ['Teacher'],
  permissions: ['attendance.record'],
}

async function signInAliceWithCachedData() {
  store.dispatch(setCredentials({ user: ALICE, token: 'token-for-alice' }))
  await store.dispatch(AuthApi.util.upsertQueryData('me', undefined, ALICE))
  await store.dispatch(
    studentApi.util.upsertQueryData('getAllStudents', undefined, [
      { id: 91, fullName: 'Alice-only Student' },
    ] as never),
  )
}

describe('store session isolation', () => {
  beforeEach(() => {
    store.dispatch(clearCredentials())
  })

  it('drops every cached response when the user logs out', async () => {
    await signInAliceWithCachedData()
    store.dispatch(clearCredentials())

    const state = store.getState() as Record<string, { queries?: object }>
    for (const [slice, value] of Object.entries(state)) {
      if (slice === 'authSlice') continue
      expect(Object.keys(value.queries ?? {})).toEqual([])
    }
    expect(JSON.stringify(state)).not.toContain('Alice')
  })

  it('keeps redux-persist bookkeeping so the session still persists after a logout', async () => {
    await signInAliceWithCachedData()
    store.dispatch(clearCredentials())
    const state = store.getState() as { authSlice: { _persist?: object } }
    expect(state.authSlice._persist).toBeTruthy()
  })

  it('drops the previous cache when someone signs in without logging out first', async () => {
    await signInAliceWithCachedData()
    store.dispatch(setCredentials({ user: BOB, token: 'token-for-bob' }))

    const state = store.getState() as { authSlice: { user: AuthenticatedUser | null } }
    expect(state.authSlice.user?.fullName).toBe('Bob Teacher')
    expect(JSON.stringify(state)).not.toContain('Alice')
  })
})
