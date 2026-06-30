'use client';

import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import {API_BASE_URL} from '../app/components/utils/api_url';

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

  const login = useCallback(async (email: string, password: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/api-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, type: 'API' }),
      });
      const data = await res.json();
      if (res.ok && data) {
        const userData = {
          name: data.name || email.split('@')[0],
          email: data.email || email,
          avatar: data.avatar,
        };
        setUser(userData);
        setIsAuthenticated(true);
        localStorage.setItem('auth', JSON.stringify(userData));
        localStorage.setItem('userData', JSON.stringify(data.data || {}));
        return true;
      }
      return false;
    } catch {
      return false;
    }
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
