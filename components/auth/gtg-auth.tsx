'use client'

import { useAuth as useAppAuth } from '@/contexts/AuthContext'

// `contexts/AuthContext`'s `AuthContext` value itself was never exported -
// only its `useAuth()` hook, which already returns safe defaults when
// there's no provider in the tree. This shim narrows that hook's shape to
// what G2G-ported code expects from `useAuth()`.
export function useAuth() {
  const context = useAppAuth()
  return {
    user: context.user,
    menuContext: context.menuContext,
    isAuthenticated: context.isAuthenticated,
    login: context.login,
    logout: context.logout,
  }
}
