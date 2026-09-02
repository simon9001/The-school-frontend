import { useSelector } from 'react-redux'
import type { RootState } from '../store/store'

/**
 * Page-level permission checks. Routing and the sidebar are already gated
 * (PrivateRoute, Sidebar), but individual actions — buttons, tabs, table
 * columns — were not, so every role saw controls that return 403 on click.
 *
 * Mirrors the sidebar's rule exactly: a user has a permission only if the
 * exact code is in their granted list. No wildcards, no role-name checks.
 */
export const useCan = () => {
  const permissions = useSelector((state: RootState) => state.authSlice.user?.permissions) ?? []

  const can = (code: string) => permissions.includes(code)
  const canAny = (codes: string[]) => codes.some((code) => permissions.includes(code))

  return { can, canAny }
}
