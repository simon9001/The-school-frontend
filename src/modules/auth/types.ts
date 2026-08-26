export type LoginFormValues = {
  email: string
  password: string
}

export interface AuthenticatedUser {
  id: number
  email: string
  fullName: string
  roles: string[]
  permissions: string[]
}

export interface LoginResult {
  token: string
  user: AuthenticatedUser
}
