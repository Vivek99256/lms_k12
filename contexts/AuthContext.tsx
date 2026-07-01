'use client';

import { createContext, useContext, useState, useCallback } from 'react';
import {API_BASE_URL} from '../app/components/utils/api_url';

interface AuthContextType {
  isAuthenticated: boolean;
  user: { name: string; email: string; avatar?: string } | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  menuContext: {
    sub_institute_id: number;
    user_id: number;
    user_profile_name: string;
    user_profile_id: number;
    client_id: number;
  } | null;
  academicTerms: Array<Record<string, unknown>>;
  academicYears: Array<Record<string, unknown>>;
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
  const [menuContext, setMenuContext] = useState<{
    sub_institute_id: number;
    user_id: number;
    user_profile_name: string;
    user_profile_id: number;
    client_id: number;
  } | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const stored = localStorage.getItem('menuContext');
      if (stored) return JSON.parse(stored);
    } catch {}
    return null;
  });

  const [academicTerms, setAcademicTerms] = useState<Array<Record<string, unknown>>>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem('userData');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed.academicTerms)) return parsed.academicTerms;
      }
    } catch {}
    return [];
  });

  const [academicYears, setAcademicYears] = useState<Array<Record<string, unknown>>>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem('userData');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed.academicYears)) return parsed.academicYears;
      }
    } catch {}
    return [];
  });

  const login = useCallback(async (email: string, password: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/api-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, type: 'API' }),
      });
      const data = await res.json();
      if (res.ok && data) {
        function getValue(obj: unknown, key: string): unknown {
          if (!obj || typeof obj !== 'object') return undefined;
          return (obj as Record<string, unknown>)[key];
        }

        const payload = data.data || data;
        const ctx = {
          sub_institute_id: Number(getValue(payload, 'sub_institute_id') ?? getValue(payload, 'subInstituteId') ?? 0),
          user_id: Number(getValue(payload, 'user_id') ?? getValue(payload, 'userId') ?? 0),
          user_profile_name: String(getValue(payload, 'user_profile_name') ?? getValue(payload, 'userProfileName') ?? getValue(payload, 'user_profile') ?? ''),
          user_profile_id: Number(getValue(payload, 'user_profile_id') ?? getValue(payload, 'userProfileId') ?? 0),
          client_id: Number(getValue(payload, 'client_id') ?? getValue(payload, 'clientId') ?? 0),
        };
        setMenuContext(ctx);
        localStorage.setItem('menuContext', JSON.stringify(ctx));

        const userData = {
          name: data.name || email.split('@')[0],
          email: data.email || email,
          avatar: data.avatar,
        };
        setUser(userData);
        setIsAuthenticated(true);
        localStorage.setItem('auth', JSON.stringify(userData));
        const sessionPayload = { ...(data.data || data || {}), ...(data.academicTerms ? { academicTerms: data.academicTerms } : {}), ...(data.academicYears ? { academicYears: data.academicYears } : {}) };
        if (sessionPayload.logo) {
          (sessionPayload as Record<string, unknown>).logo = `${(sessionPayload as Record<string, unknown>).host_name || ''}/admin_dep/images/${sessionPayload.logo}`;
        }
        localStorage.setItem('userData', JSON.stringify(sessionPayload));
        console.log('Session Data on Save:', sessionPayload);
        setAcademicTerms(Array.isArray(data.academicTerms) ? data.academicTerms : []);
        setAcademicYears(Array.isArray(data.academicYears) ? data.academicYears : []);
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
    setMenuContext(null);
    setAcademicTerms([]);
    setAcademicYears([]);
    localStorage.removeItem('auth');
    localStorage.removeItem('menuContext');
  }, []);

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, login, logout, menuContext, academicTerms, academicYears }}>
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
      menuContext: null,
      academicTerms: [],
      academicYears: [],
    };
  }
  return context;
}
