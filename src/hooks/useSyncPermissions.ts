import { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useMeQuery } from '../modules/auth/AuthApi'
import { updateUserProfile } from '../modules/auth/AuthSlice'
import type { AppDispatch, RootState } from '../store/store'

/**
 * Keeps the Redux auth copy of the signed-in user in step with the server.
 *
 * Every UI gate (useCan, Sidebar, PrivateRoute, FeesPage) reads
 * `state.authSlice.user.permissions`, but that slice is only ever written by
 * `setCredentials` at login — and it is persisted through redux-persist, so
 * even a reload rehydrates the copy captured at login. The backend re-resolves
 * permissions on every authenticated request, so a per-user override takes
 * effect server-side immediately; without this hook the client would not see
 * it until the user logged out and back in.
 *
 * Calling this from the dashboard shell means every navigation refetches /me
 * and pushes the fresh roles/permissions/permissionDetails into Redux, so a
 * granted or revoked permission reaches a live session without a re-login.
 *
 * The dispatch lives in an effect keyed on the query data (never during
 * render) so a new object identity cannot drive a render loop.
 */
export const useSyncPermissions = () => {
  const dispatch = useDispatch<AppDispatch>()
  // DashboardLayout is also rendered by the public NotFound page, so skip the
  // request when there is no token rather than firing a guaranteed 401.
  const isAuthenticated = useSelector((state: RootState) => state.authSlice.isAuthenticated)
  const { data } = useMeQuery(undefined, {
    skip: !isAuthenticated,
    refetchOnMountOrArgChange: true,
  })

  useEffect(() => {
    if (data) {
      dispatch(updateUserProfile(data))
    }
  }, [data, dispatch])
}

export default useSyncPermissions
