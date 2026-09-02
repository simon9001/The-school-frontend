export interface UserAccountStats {
  total: number
  active: number
  suspended: number
  locked: number
  lockedOut: number
  mustChangePassword: number
  neverLoggedIn: number
  withFailedAttempts: number
}

export interface AccountFlag {
  id: number
  email: string
  fullName: string
  reason: string
  detail?: string
}

export interface RuntimeStatus {
  databaseReachable: boolean
  databaseLatencyMs: number | null
  uptimeSeconds: number
  nodeVersion: string
  heapUsedMb: number
  environment: string
}

export interface SystemHealth {
  runtime: RuntimeStatus
  users: UserAccountStats
  flaggedAccounts: AccountFlag[]
}

export interface RbacDrift {
  missingPermissions: string[]
  missingRoles: string[]
  missingRolePermissions: { roleCode: string; permissionCode: string }[]
  orphanPermissions: string[]
  orphanRoles: string[]
  orphanRolePermissions: { roleCode: string; permissionCode: string }[]
  inSync: boolean
}

export interface SegregationConflict {
  userId: number
  email: string
  fullName: string
  rule: string
  permissions: [string, string]
}

export interface RoleUsage {
  roleId: number
  code: string
  name: string
  userCount: number
}

export interface SystemRbacStatus {
  drift: RbacDrift
  conflicts: SegregationConflict[]
  roleUsage: RoleUsage[]
  catalogue: { permissions: number; roles: number }
}
