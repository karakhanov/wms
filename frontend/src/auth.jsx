import { createContext, useContext, useState, useCallback } from 'react'
import { storageGet, storageSet, storageRemove } from './storage'
import { auth as authApi } from './api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [token, setTokenState] = useState(() => storageGet('wms_token'))
  const [user, setUser] = useState(() => {
    try {
      const u = storageGet('wms_user')
      return u ? JSON.parse(u) : null
    } catch {
      return null
    }
  })

  const setToken = useCallback((newToken, userData) => {
    setTokenState(newToken)
    setUser(userData)
    if (newToken) storageSet('wms_token', newToken)
    else storageRemove('wms_token')
    if (userData) storageSet('wms_user', JSON.stringify(userData))
    else storageRemove('wms_user')
  }, [])

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } catch {
      // noop: local logout still must complete
    }
    setToken(null, null)
  }, [setToken])

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
