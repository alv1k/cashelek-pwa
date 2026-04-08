import { createContext, useContext, useState, type ReactNode } from 'react'

interface MockUser {
  uid: string
  email: string
}

interface AuthContextType {
  user: MockUser | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

// TODO: Replace with Firebase auth when credentials are configured
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<MockUser | null>({ uid: 'dev', email: 'dev@local' })
  const loading = false

  const login = async (_email: string, _password: string) => {
    setUser({ uid: 'dev', email: _email })
  }

  const logout = async () => {
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
