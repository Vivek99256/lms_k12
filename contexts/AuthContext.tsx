'use client';

import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
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

const STORAGE_KEY_AUTH = 'auth';
const STORAGE_KEY_MENU = 'menuContext';
const STORAGE_KEY_USER = 'userData';
const STORAGE_SESSION_DATE = 'sessionDate';
const INACTIVITY_TIMEOUT_MINUTES = 30;

function getToday() {
  return new Date().toISOString().split('T')[0];
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const getStoredAuth = () => {
    if (typeof window === 'undefined') return { isAuth: false, user: null as { name: string; email: string; avatar?: string } | null };
    try {
      const stored = localStorage.getItem(STORAGE_KEY_AUTH);
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
      const stored = localStorage.getItem(STORAGE_KEY_MENU);
      if (stored) return JSON.parse(stored);
    } catch {}
    return null;
  });

  const [academicTerms, setAcademicTerms] = useState<Array<Record<string, unknown>>>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem(STORAGE_KEY_USER);
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
      const stored = localStorage.getItem(STORAGE_KEY_USER);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed.academicYears)) return parsed.academicYears;
      }
    } catch {}
    return [];
  });

  const inactivityTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimeoutRef.current) clearTimeout(inactivityTimeoutRef.current);
    inactivityTimeoutRef.current = setTimeout(() => {
      localStorage.setItem(STORAGE_SESSION_DATE, '');
      setIsAuthenticated(false);
      setUser(null);
      setMenuContext(null);
      setAcademicTerms([]);
      setAcademicYears([]);
      localStorage.removeItem(STORAGE_KEY_AUTH);
      localStorage.removeItem(STORAGE_KEY_MENU);
      localStorage.removeItem(STORAGE_KEY_USER);
      localStorage.removeItem(STORAGE_SESSION_DATE);
    }, INACTIVITY_TIMEOUT_MINUTES * 60 * 1000);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;

    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    const handler = () => resetInactivityTimer();

    events.forEach(event => window.addEventListener(event, handler));
    resetInactivityTimer();

    return () => {
      events.forEach(event => window.removeEventListener(event, handler));
      if (inactivityTimeoutRef.current) clearTimeout(inactivityTimeoutRef.current);
    };
  }, [isAuthenticated, resetInactivityTimer]);

  const enforceDailyReset = useCallback(() => {
    if (typeof window === 'undefined') return;
    const storedDate = localStorage.getItem(STORAGE_SESSION_DATE);
    const today = getToday();
    if (storedDate && storedDate !== today) {
      localStorage.setItem(STORAGE_SESSION_DATE, '');
      setIsAuthenticated(false);
      setUser(null);
      setMenuContext(null);
      setAcademicTerms([]);
      setAcademicYears([]);
      localStorage.removeItem(STORAGE_KEY_AUTH);
      localStorage.removeItem(STORAGE_KEY_MENU);
      localStorage.removeItem(STORAGE_KEY_USER);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const interval = setInterval(() => {
      enforceDailyReset();
    }, 60000);
    return () => clearInterval(interval);
  }, [enforceDailyReset]);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/api-login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
          type: "API",
        }),
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
          user_id: Number(getValue(payload, 'user_id') ?? getValue(payload, 'userId') ?? getValue(payload, 'id') ?? 0),
          user_profile_name: String(getValue(payload, 'user_profile_name') ?? getValue(payload, 'userProfileName') ?? getValue(payload, 'user_profile') ?? ''),
          user_profile_id: Number(getValue(payload, 'user_profile_id') ?? getValue(payload, 'userProfileId') ?? 0),
          client_id: Number(getValue(payload, 'client_id') ?? getValue(payload, 'clientId') ?? 0),
        };
        setMenuContext(ctx);
        localStorage.setItem(STORAGE_KEY_MENU, JSON.stringify(ctx));

        const userData = {
          name: data.name || email.split('@')[0],
          email: data.email || email,
          avatar: data.avatar,
        };
        setUser(userData);
        setIsAuthenticated(true);
        localStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify(userData));
        localStorage.setItem(STORAGE_SESSION_DATE, getToday());
        const sessionPayload = { ...(data.data || data || {}), ...(data.academicTerms ? { academicTerms: data.academicTerms } : {}), ...(data.academicYears ? { academicYears: data.academicYears } : {}) };
        console.log('AuthContext sessionPayload before logo transform:', sessionPayload);
        if (sessionPayload.logo) {
          (sessionPayload as Record<string, unknown>).logo = `${(sessionPayload as Record<string, unknown>).host_name || ''}/admin_dep/images/${sessionPayload.logo}`;
        }
        console.log('AuthContext sessionPayload after logo transform:', sessionPayload);
        localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(sessionPayload));
        console.log('AuthContext saved to localStorage:', localStorage.getItem(STORAGE_KEY_USER));
        setAcademicTerms(Array.isArray(data.academicTerms) ? data.academicTerms : []);
        setAcademicYears(Array.isArray(data.academicYears) ? data.academicYears : []);
        resetInactivityTimer();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [resetInactivityTimer]);

  const logout = useCallback(() => {
    setIsAuthenticated(false);
    setUser(null);
    setMenuContext(null);
    setAcademicTerms([]);
    setAcademicYears([]);
    localStorage.removeItem(STORAGE_KEY_AUTH);
    localStorage.removeItem(STORAGE_KEY_MENU);
    localStorage.removeItem(STORAGE_KEY_USER);
    localStorage.removeItem(STORAGE_SESSION_DATE);
    if (inactivityTimeoutRef.current) clearTimeout(inactivityTimeoutRef.current);
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
