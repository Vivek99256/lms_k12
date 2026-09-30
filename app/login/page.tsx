'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import Script from 'next/script';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  BarChart3,
  BookOpen,
  CheckCircle2,
  Eye,
  EyeOff,
  GraduationCap,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

// Client IDs are public, but Next only inlines `NEXT_PUBLIC_*` values into the browser
// bundle. Reading it at module level lets the build substitute the literal.
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() || '';

const FIELD_CLASS =
  'w-full rounded-xl border border-gray-300 bg-white px-4 py-3.5 text-[15px] text-gray-900 placeholder-gray-400 ' +
  'transition-colors hover:border-gray-400 focus:border-[#4169E1] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#4169E1]/15';

const PRIMARY_BUTTON_CLASS =
  'flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#3658c7] to-[#4169E1] px-4 py-3.5 text-[15px] font-semibold text-white ' +
  'shadow-lg shadow-[#4169E1]/25 transition-all hover:shadow-xl hover:shadow-[#4169E1]/30 hover:brightness-110 active:scale-[0.99] ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4169E1] ' +
  'disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none';

const HIGHLIGHTS = [
  { icon: GraduationCap, title: 'Courses and lessons', text: 'Pick up where you left off, on any device.' },
  { icon: BarChart3, title: 'Progress at a glance', text: 'Grades, attendance and assessments in one place.' },
  { icon: Users, title: 'Stay connected', text: 'Message teachers, students and parents securely.' },
];

type GoogleId = {
  initialize: (config: {
    client_id: string;
    callback: (response: { credential?: string }) => void;
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
  }) => void;
  prompt: (listener?: (notification: { isNotDisplayed(): boolean; isSkippedMoment(): boolean }) => void) => void;
};

function getGoogleId(): GoogleId | undefined {
  return (window as unknown as { google?: { accounts?: { id?: GoogleId } } }).google?.accounts?.id;
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
    >
      <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}

function Spinner() {
  return <Loader2 size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />;
}

export default function LoginPage() {
  const router = useRouter();
  const { isAuthenticated, login, loginWithGoogle } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);
  const googleInitialised = useRef(false);

  // One place decides where a signed-in user goes: a fresh login flips
  // `isAuthenticated`, and so does landing here with a live session.
  useEffect(() => {
    if (isAuthenticated) router.replace('/dashboard');
  }, [isAuthenticated, router]);

  useEffect(() => {
    router.prefetch('/dashboard');
  }, [router]);

  const finishSignIn = useCallback(() => {
    localStorage.removeItem('selectedMenuBranch');
    // Leave the button in its loading state; the effect above navigates away.
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    setError('');
    setIsLoading(true);
    try {
      const result = await login(email.trim(), password);
      if (!result.success) {
        setError(result.error || 'Your email or password is incorrect. Check them and try again.');
        setIsLoading(false);
        return;
      }
      finishSignIn();
    } catch {
      setError('We could not sign you in. Check your connection and try again.');
      setIsLoading(false);
    }
  };

  const handleGoogleCredential = useCallback(
    async (response: { credential?: string }) => {
      if (!response?.credential) {
        setError('Google sign-in was cancelled.');
        setIsGoogleLoading(false);
        return;
      }
      const result = await loginWithGoogle(response.credential);
      if (!result.success) {
        setError(result.error || 'We could not sign you in with Google. Try again.');
        setIsGoogleLoading(false);
        return;
      }
      finishSignIn();
    },
    [finishSignIn, loginWithGoogle]
  );

  const handleGoogleSignIn = () => {
    setError('');
    const google = getGoogleId();
    if (!google) {
      setError('Google sign-in did not load. Refresh the page and try again.');
      return;
    }
    setIsGoogleLoading(true);
    try {
      if (!googleInitialised.current) {
        google.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleGoogleCredential,
          auto_select: false,
          cancel_on_tap_outside: true,
        });
        googleInitialised.current = true;
      }
      // The prompt can be dismissed or suppressed without ever calling back, which
      // would leave the button spinning forever.
      google.prompt((n) => {
        if (n.isNotDisplayed() || n.isSkippedMoment()) setIsGoogleLoading(false);
      });
    } catch {
      setError('We could not start Google sign-in. Try again.');
      setIsGoogleLoading(false);
    }
  };

  const busy = isLoading || isGoogleLoading;

  return (
    <div className="flex min-h-dvh">
      {GOOGLE_CLIENT_ID && (
        <Script
          src="https://accounts.google.com/gsi/client"
          strategy="lazyOnload"
          onReady={() => setGoogleReady(true)}
        />
      )}

      {/* Brand panel — decorative rings are static; only the entrance uses motion. */}
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-[#1e3a8a] via-[#3557d4] to-[#4169E1] text-white lg:flex lg:w-1/2 lg:flex-col lg:justify-between lg:p-14 xl:p-20">
        <div aria-hidden="true" className="pointer-events-none absolute -right-32 -top-32 h-[420px] w-[420px] rounded-full border border-white/10" />
        <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-16 h-[260px] w-[260px] rounded-full border border-white/10" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-40 -left-40 h-[520px] w-[520px] rounded-full bg-white/5" />

        <div className="relative flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-[#4169E1] shadow-lg shadow-black/10">
            <BookOpen size={22} strokeWidth={2.25} aria-hidden="true" />
          </div>
          <span className="text-xl font-bold tracking-tight">Teach Connect</span>
        </div>

        <div className="relative max-w-lg">
          <p className="mb-4 text-4xl font-bold leading-[1.1] tracking-tight xl:text-5xl">Learn without boundaries.</p>
          <p className="mb-10 text-base leading-relaxed text-white/75">
            Access premium courses, track your progress, and connect with educators.
          </p>
          <ul className="space-y-5">
            {HIGHLIGHTS.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex items-start gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/15 ring-1 ring-white/20">
                  <Icon size={20} aria-hidden="true" />
                </span>
                <span>
                  <span className="block text-sm font-semibold">{title}</span>
                  <span className="block text-sm text-white/70">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative flex items-center gap-2 text-xs text-white/60">
          <ShieldCheck size={14} aria-hidden="true" />
          Your data is encrypted and only visible to your school.
        </p>
      </aside>

      <main className="flex flex-1 items-center justify-center bg-slate-50 px-4 py-10 sm:px-6">
        <div className="login-card w-full max-w-[460px] rounded-2xl border border-gray-200 bg-white p-7 shadow-xl shadow-slate-900/5 sm:p-10">
          <div className="mb-8 flex items-center justify-center gap-3 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#4169E1] text-white">
              <BookOpen size={18} strokeWidth={2.25} aria-hidden="true" />
            </div>
            <span className="text-lg font-bold text-gray-900">Teach Connect</span>
          </div>

          <div className="mb-8">
            <h1 className="mb-2 text-3xl font-bold tracking-tight text-gray-900">Welcome back</h1>
            <p className="text-[15px] text-gray-600">Sign in to continue to your account.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && <ErrorBanner message={error} />}

            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-gray-700">
                Email address
              </label>
              <div className="relative">
                <Mail size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  inputMode="email"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  autoFocus
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className={`${FIELD_CLASS} pl-11`}
                />
              </div>
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => setShowForgotModal(true)}
                  className="rounded text-sm font-medium text-[#4169E1] transition-colors hover:text-[#3658c7] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4169E1]"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`${FIELD_CLASS} pl-11 pr-12`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-lg text-gray-500 transition-colors hover:text-gray-700 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#4169E1]"
                >
                  {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={busy} className={PRIMARY_BUTTON_CLASS}>
              {isLoading ? (
                <>
                  <Spinner />
                  Signing in…
                </>
              ) : (
                'Sign in'
              )}
            </button>
          </form>

          {GOOGLE_CLIENT_ID && (
            <>
              <div className="my-6 flex items-center gap-4" role="separator" aria-label="or">
                <div className="h-px flex-1 bg-gray-200" />
                <span className="text-xs uppercase tracking-wider text-gray-500">or</span>
                <div className="h-px flex-1 bg-gray-200" />
              </div>

              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={busy || !googleReady}
                className="flex w-full items-center justify-center gap-3 rounded-xl border border-gray-300 bg-white px-4 py-3.5 text-[15px] font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4169E1] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isGoogleLoading ? (
                  <Spinner />
                ) : (
                  <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                )}
                {isGoogleLoading ? 'Connecting to Google…' : 'Continue with Google'}
              </button>
            </>
          )}
        </div>
      </main>

      {showForgotModal && (
        <ForgotPasswordModal defaultEmail={email} onClose={() => setShowForgotModal(false)} />
      )}

      <style jsx>{`
        @keyframes cardIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .login-card {
          animation: cardIn 0.35s cubic-bezier(0.2, 0, 0, 1) both;
        }
        @media (prefers-reduced-motion: reduce) {
          .login-card { animation: none; }
        }
      `}</style>
    </div>
  );
}

// Mounted only while open, so every opening starts from fresh state.
function ForgotPasswordModal({
  defaultEmail,
  onClose,
}: {
  defaultEmail: string;
  onClose: () => void;
}) {
  const [email, setEmail] = useState(defaultEmail);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    setError('');
    setIsLoading(true);
    try {
      const res = await fetch('/api/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      // Laravel returns { success: true|false, message }. Any 2xx without an explicit
      // `success: false` counts as sent — the endpoint once mailed through a non-API
      // controller, so an OK response is the reliable signal.
      if (res.ok && data?.success !== false) {
        setSuccess(true);
        return;
      }
      setError(data?.message || 'We could not send the reset link. Try again.');
    } catch {
      setError('We could not reach the server. Check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="forgot-password-title"
    >
      <div
        className="relative w-full max-w-[440px] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 rounded-full p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-2 focus-visible:outline-[#4169E1]"
        >
          <X size={18} aria-hidden="true" />
        </button>

        {success ? (
          <div className="p-8 text-center">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-green-50">
              <CheckCircle2 size={32} className="text-green-600" aria-hidden="true" />
            </div>
            <h2 id="forgot-password-title" className="mb-2 text-xl font-bold text-gray-900">
              Check your email
            </h2>
            <p className="mb-7 text-sm text-gray-600" role="status">
              If an account exists for <span className="font-semibold text-gray-800">{email}</span>, we&apos;ve sent password reset instructions.
            </p>
            <button type="button" onClick={onClose} autoFocus className={PRIMARY_BUTTON_CLASS}>
              Back to sign in
            </button>
          </div>
        ) : (
          <div className="p-8">
            <h2 id="forgot-password-title" className="mb-1.5 text-xl font-bold text-gray-900">
              Forgot your password?
            </h2>
            <p className="mb-6 text-sm text-gray-600">
              Enter the email tied to your account and we&apos;ll send you a reset link.
            </p>

            <form onSubmit={handleSubmit} className="space-y-5">
              {error && <ErrorBanner message={error} />}

              <div>
                <label htmlFor="forgot-email" className="mb-1.5 block text-sm font-medium text-gray-700">
                  Email address
                </label>
                <div className="relative">
                  <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                  <input
                    id="forgot-email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    autoCapitalize="none"
                    spellCheck={false}
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setError('');
                    }}
                    placeholder="you@example.com"
                    required
                    autoFocus
                    className={`${FIELD_CLASS} pl-11`}
                  />
                </div>
              </div>

              <button type="submit" disabled={isLoading} className={PRIMARY_BUTTON_CLASS}>
                {isLoading ? (
                  <>
                    <Spinner />
                    Sending reset link…
                  </>
                ) : (
                  'Send reset link'
                )}
              </button>

              <button
                type="button"
                onClick={onClose}
                className="flex w-full items-center justify-center gap-2 rounded text-sm font-medium text-gray-600 transition-colors hover:text-gray-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4169E1]"
              >
                <ArrowLeft size={14} aria-hidden="true" />
                Back to sign in
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
