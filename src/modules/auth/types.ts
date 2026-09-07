export type LoginFormValues = {
  email: string
  password: string
}

export interface PermissionDetail {
  code: string
  module: string
  description: string
}

export interface AuthenticatedUser {
  id: number
  email: string
  fullName: string
  phone?: string | null
  avatarUrl?: string | null
  status?: string
  lastLoginAt?: string | null
  createdAt?: string | null
  roles: string[]
  permissions: string[]
  /** Same grants as `permissions`, with the module and human-readable
   *  description each code carries in the backend's RBAC catalogue.
   *  Optional because a token issued before this field existed will not
   *  have it. */
  permissionDetails?: PermissionDetail[]
}

export interface LoginResult {
  token: string
  user: AuthenticatedUser
}

export interface UpdateProfileValues {
  fullName?: string
  phone?: string
  avatarUrl?: string | null
}

export interface ChangePasswordValues {
  currentPassword: string
  newPassword: string
}
