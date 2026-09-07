'use client';

import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { clearTeachAssistantStorage } from '@/lib/chatbot-storage';
import { API_BASE_URL } from '@/app/components/utils/api_url';

interface AuthContextType {
  isAuthenticated: boolean;
  user: { name: string; email: string; avatar?: string } | null;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  loginWithGoogle: (credential: string) => Promise<{ success: boolean; error?: string }>;
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
  refreshAcademicTerms: (syear: string) => Promise<void>;
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

  const persistLoginPayload = useCallback(
    (data: Record<string, unknown>) => {
      function getValue(obj: unknown, key: string): unknown {
        if (!obj || typeof obj !== 'object') return undefined;
        return (obj as Record<string, unknown>)[key];
      }

      const payload = (data.data as Record<string, unknown> | undefined) ?? data;
      const ctx = {
        sub_institute_id: Number(getValue(payload, 'sub_institute_id') ?? getValue(payload, 'subInstituteId') ?? 0),
        user_id: Number(getValue(payload, 'user_id') ?? getValue(payload, 'userId') ?? getValue(payload, 'id') ?? 0),
        user_profile_name: String(getValue(payload, 'user_profile_name') ?? getValue(payload, 'userProfileName') ?? getValue(payload, 'user_profile') ?? ''),
        user_profile_id: Number(getValue(payload, 'user_profile_id') ?? getValue(payload, 'userProfileId') ?? 0),
        client_id: Number(getValue(payload, 'client_id') ?? getValue(payload, 'clientId') ?? 0),
      };
      setMenuContext(ctx);
      localStorage.setItem(STORAGE_KEY_MENU, JSON.stringify(ctx));

      const fallbackEmail = String(getValue(data, 'email') ?? getValue(payload, 'email') ?? '');
      const userData = {
        name: String(getValue(data, 'name') ?? getValue(payload, 'name') ?? (fallbackEmail ? fallbackEmail.split('@')[0] : 'User')),
        email: String(getValue(data, 'email') ?? getValue(payload, 'email') ?? fallbackEmail),
        avatar: getValue(data, 'avatar') ?? getValue(payload, 'avatar'),
      };
      setUser(userData);
      setIsAuthenticated(true);
      localStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify(userData));
      localStorage.setItem(STORAGE_SESSION_DATE, getToday());

      const sessionPayload = {
        ...(payload as Record<string, unknown>),
        ...(Array.isArray(data.academicTerms) ? { academicTerms: data.academicTerms } : {}),
        ...(Array.isArray(data.academicYears) ? { academicYears: data.academicYears } : {}),
      };
      if (sessionPayload.logo) {
        (sessionPayload as Record<string, unknown>).logo = `${sessionPayload.host_name || ''}/admin_dep/images/${sessionPayload.logo}`;
      }
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(sessionPayload));
      setAcademicTerms(Array.isArray(data.academicTerms) ? (data.academicTerms as Array<Record<string, unknown>>) : []);
      setAcademicYears(Array.isArray(data.academicYears) ? (data.academicYears as Array<Record<string, unknown>>) : []);
      resetInactivityTimer();
    },
    [resetInactivityTimer]
  );

  const login = useCallback(async (email: string, password: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/api-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, type: 'API' }),
      });
      const data = await res.json();
      if (res.ok && data) {
        clearTeachAssistantStorage();
        persistLoginPayload(data as Record<string, unknown>);
        return { success: true };
      }
      return { success: false, error: data?.message || 'Invalid credentials. Please try again.' };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Network error. Please try again.';
      return { success: false, error: message };
    }
  }, [persistLoginPayload]);

  /**
   * Trade a Google ID token (from Google Identity Services) for an LMS session
   * by relaying it through our own /api/google-auth proxy, then persist the
   * same payload shape `login()` does so the post-login flow is identical.
   */
  const loginWithGoogle = useCallback(async (credential: string) => {
    try {
      const res = await fetch('/api/google-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data) {
        clearTeachAssistantStorage();
        persistLoginPayload(data as Record<string, unknown>);
        return { success: true };
      }
      return {
        success: false,
        error: data?.message || 'Unable to sign in with Google. Please try again.',
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Network error. Please try again.';
      return { success: false, error: message };
    }
  }, [persistLoginPayload]);

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

  /**
   * `academicTerms` only ever comes back from `login()`, scoped to the
   * syear active at login time — switching the year elsewhere in the app
   * (Header's year switcher) never refreshed it, so every term dropdown
   * went empty for any year other than the login one. Call this whenever
   * the selected year changes.
   */
  const refreshAcademicTerms = useCallback(async (syear: string) => {
    if (typeof window === 'undefined' || !syear) return;
    const subInstituteId = menuContext?.sub_institute_id;
    if (!subInstituteId) return;
    try {
      const query = new URLSearchParams({
        type: 'API',
        sub_institute_id: String(subInstituteId),
        syear,
      });
      const res = await fetch(`${API_BASE_URL}/api/academic-terms?${query.toString()}`);
      const data = await res.json();
      const terms = Array.isArray(data?.data) ? data.data : [];
      setAcademicTerms(terms);
      try {
        const stored = localStorage.getItem(STORAGE_KEY_USER);
        const parsed = stored ? JSON.parse(stored) : {};
        localStorage.setItem(STORAGE_KEY_USER, JSON.stringify({ ...parsed, academicTerms: terms }));
      } catch {}
    } catch {
      // Network/parse failure — leave the previously loaded terms in place.
    }
  }, [menuContext]);

  return (
    <AuthContext.Provider
      value={{ isAuthenticated, user, login, loginWithGoogle, logout, menuContext, academicTerms, academicYears, refreshAcademicTerms }}
    >
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
      login: async (): Promise<{ success: boolean; error?: string }> => ({ success: false }),
      loginWithGoogle: async (): Promise<{ success: boolean; error?: string }> => ({ success: false }),
      logout: () => {},
      menuContext: null,
      academicTerms: [],
      academicYears: [],
      refreshAcademicTerms: async () => {},
    };
  }
  return context;
}
