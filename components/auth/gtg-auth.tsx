'use client'

import { useContext } from 'react'
import { AuthContext } from '@/contexts/AuthContext'

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    return { user: null }
  }
  return {
    user: context.user,
    menuContext: context.menuContext,
    isAuthenticated: context.isAuthenticated,
    login: context.login,
    logout: context.logout,
  }
}
