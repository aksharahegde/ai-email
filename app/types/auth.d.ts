declare module '#auth-utils' {
  interface User {
    id: string
    email: string
    name: string
    picture?: string
  }

  interface UserSession {
    user: User
    loggedInAt: Date
  }

  interface SecureSessionData {
    accessToken: string
    refreshToken?: string
    expiresAt?: number
  }
}

export {}
