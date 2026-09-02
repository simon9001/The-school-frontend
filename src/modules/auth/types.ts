export type LoginFormValues = {
  email: string
  password: string
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
