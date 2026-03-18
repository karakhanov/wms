import { createContext, useContext, useState, useCallback } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [token, setTokenState] = useState(() => localStorage.getItem('wms_token'))
  const [user, setUser] = useState(() => {
    try {
      const u = localStorage.getItem('wms_user')
      return u ? JSON.parse(u) : null
    } catch {
      return null
    }
  })

  const setToken = useCallback((newToken, userData) => {
    setTokenState(newToken)
    setUser(userData)
    if (newToken) localStorage.setItem('wms_token', newToken)
    else localStorage.removeItem('wms_token')
    if (userData) localStorage.setItem('wms_user', JSON.stringify(userData))
    else localStorage.removeItem('wms_user')
  }, [])

  const logout = useCallback(() => setToken(null, null), [setToken])

  return (
    <AuthContext.Provider value={{ token, user, setToken, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) return { token: null, user: null, setToken: () => {}, logout: () => {} }
  return ctx
}
