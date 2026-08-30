export type UserStatus = 'active' | 'suspended' | 'locked'

export interface RoleSummary {
  id: number
  code: string
  name: string
}

export interface ManagedUser {
  id: number
  email: string
  fullName: string
  phone: string | null
  status: UserStatus
  mustChangePassword: boolean
  failedLoginAttempts: number
  lockedUntil: string | null
  lastLoginAt: string | null
  createdAt: string
  updatedAt: string
  roles: RoleSummary[]
}

export interface RoleWithPermissions {
  id: number
  code: string
  name: string
  description: string | null
  isSystemRole: boolean
  permissions: string[]
}

export interface AuditLogEntry {
  entry: {
    id: number
    userId: number | null
    action: string
    entityType: string
    entityId: string
    beforeData: unknown
    afterData: unknown
    ipAddress: string | null
    createdAt: string
  }
  actorEmail: string | null
  actorName: string | null
}

export type NewUserValues = {
  email: string
  fullName: string
  phone?: string
  password: string
  roleIds: number[]
}

export type UpdateUserValues = {
  fullName?: string
  phone?: string
  status?: UserStatus
}

export type ResetPasswordValues = {
  newPassword: string
}
