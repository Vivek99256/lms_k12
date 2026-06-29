'use client';

import { createContext, useContext, useState, useCallback, useEffect } from 'react';

interface AuthContextType {
  isAuthenticated: boolean;
  user: { name: string; email: string; avatar?: string } | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const getStoredAuth = () => {
    if (typeof window === 'undefined') return { isAuth: false, user: null as { name: string; email: string; avatar?: string } | null };
    try {
      const stored = localStorage.getItem('auth');
      if (stored) return { isAuth: true, user: JSON.parse(stored) };
    } catch {}
    return { isAuth: false, user: null };
  };

  const [isAuthenticated, setIsAuthenticated] = useState(() => getStoredAuth().isAuth);
  const [user, setUser] = useState<{ name: string; email: string; avatar?: string } | null>(() => getStoredAuth().user);

  useEffect(() => {
    const stored = localStorage.getItem('auth');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setIsAuthenticated(true);
        setUser(parsed);
      } catch {}
    }
  }, []);

  const login = useCallback(async (email: string, _password: string) => {
    await new Promise((res) => setTimeout(res, 500));
    const trimmed = email.trim();
    if (trimmed) {
      const userData = { name: trimmed.split('@')[0], email: trimmed };
      setUser(userData);
      setIsAuthenticated(true);
      localStorage.setItem('auth', JSON.stringify(userData));
      return true;
    }
    return false;
  }, []);

  const logout = useCallback(() => {
    setIsAuthenticated(false);
    setUser(null);
    localStorage.removeItem('auth');
  }, []);

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    return {
      isAuthenticated: false,
      user: null,
      login: async () => false,
      logout: () => {},
    };
  }
  return context;
}
