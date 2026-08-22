'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export default function LoginPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, router]);

  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const result = await login(email, password);
      if (!result.success) {
        setError(result.error || 'Invalid credentials. Please try again.');
        setIsLoading(false);
        return;
      }
      localStorage.removeItem('selectedMenuBranch');
      setIsLoading(false);
      setShowSuccess(true);
      window.setTimeout(() => {
        router.replace('/dashboard');
      }, 1100);
    } catch {
      setError('Something went wrong. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className="h-screen flex overflow-hidden">
      {/* Left Side - Animated Branding / Illustration */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-[#1e3a8a] via-[#4169E1] to-[#3b82f6]">
        {/* Animated background orbs */}
        <div className="absolute inset-0">
          <div className="absolute top-[5%] left-[5%] w-[300px] h-[300px] bg-blue-400/40 rounded-full blur-[80px] animate-pulse" style={{ animationDuration: '4s' }} />
          <div className="absolute bottom-[10%] right-[5%] w-[350px] h-[350px] bg-blue-600/40 rounded-full blur-[100px] animate-pulse" style={{ animationDuration: '5s' }} />
          <div className="absolute top-[40%] left-[30%] w-[200px] h-[200px] bg-indigo-400/30 rounded-full blur-[60px] animate-pulse" style={{ animationDuration: '6s' }} />
        </div>

        {/* Animated floating shapes */}
        <div className="absolute inset-0 overflow-hidden">
          {/* Bouncing shapes */}
          <div className="absolute top-[15%] left-[15%] w-16 h-16 border-2 border-white/20 rounded-3xl rotate-12 animate-bounce" style={{ animationDuration: '3s' }} />
          <div className="absolute top-[55%] left-[55%] w-12 h-12 border-2 border-white/20 rounded-full animate-bounce" style={{ animationDuration: '4s' }} />
          <div className="absolute top-[25%] right-[20%] w-20 h-20 border-2 border-white/10 rounded-[2rem] -rotate-12 animate-bounce" style={{ animationDuration: '5s' }} />
          <div className="absolute bottom-[25%] left-[25%] w-14 h-14 border-2 border-white/20 rounded-2xl rotate-45 animate-bounce" style={{ animationDuration: '3.5s' }} />
          <div className="absolute top-[70%] right-[25%] w-10 h-10 bg-white/10 rounded-lg rotate-12 animate-bounce" style={{ animationDuration: '2.5s' }} />
          
          {/* Spinning shapes */}
          <div className="absolute top-[35%] left-[10%] w-8 h-8 border border-white/20 rounded-md animate-spin" style={{ animationDuration: '8s' }} />
          <div className="absolute bottom-[35%] right-[15%] w-6 h-6 border border-white/15 rounded-full animate-spin" style={{ animationDuration: '6s' }} />
          <div className="absolute top-[50%] right-[40%] w-10 h-10 border-2 border-white/10 rounded-xl animate-spin" style={{ animationDuration: '10s' }} />
          
          {/* Pulsing dots */}
          <div className="absolute top-[20%] left-[45%] w-3 h-3 bg-white/40 rounded-full animate-pulse" style={{ animationDuration: '2s' }} />
          <div className="absolute top-[65%] left-[20%] w-2 h-2 bg-blue-300/60 rounded-full animate-pulse" style={{ animationDuration: '1.5s' }} />
          <div className="absolute top-[40%] right-[15%] w-3 h-3 bg-white/30 rounded-full animate-pulse" style={{ animationDuration: '2.5s' }} />
          <div className="absolute bottom-[40%] left-[40%] w-2 h-2 bg-blue-200/50 rounded-full animate-pulse" style={{ animationDuration: '3s' }} />
          <div className="absolute bottom-[15%] right-[35%] w-3 h-3 bg-white/25 rounded-full animate-pulse" style={{ animationDuration: '2s' }} />
          
          {/* Drifting small shapes */}
          <div className="absolute top-[80%] left-[70%] w-4 h-4 bg-white/10 rounded animate-ping" style={{ animationDuration: '3s' }} />
          <div className="absolute top-[10%] left-[75%] w-3 h-3 border border-white/20 rounded-full animate-ping" style={{ animationDuration: '4s' }} />
          <div className="absolute bottom-[20%] left-[50%] w-5 h-5 bg-blue-400/20 rounded-lg animate-ping" style={{ animationDuration: '2.5s' }} />
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center items-center text-white h-full p-10 xl:p-14">
          {/* Logo with rotating ring */}
          <div className="relative mb-8">
            <div className="absolute inset-0 bg-white/20 rounded-2xl animate-spin" style={{ animationDuration: '12s' }} />
            <div className="absolute inset-1 bg-[#4169E1] rounded-xl" />
            <div className="relative w-11 h-11 bg-white rounded-xl flex items-center justify-center shadow-lg z-10">
              <svg className="w-5 h-5 text-[#4169E1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
          </div>

          {/* Headline */}
          <div className="text-center max-w-md">
            <h1 className="text-4xl xl:text-5xl font-bold leading-[1.1] mb-5">
              Learn without
              <br />
              <span className="bg-gradient-to-r from-blue-200 via-white to-blue-100 bg-clip-text text-transparent">boundaries.</span>
            </h1>
            <p className="text-base text-white/60 leading-relaxed">
              Access premium courses, track your progress, and connect with educators.
            </p>
          </div>

          {/* Animated chevrons */}
          <div className="flex gap-1 mt-8">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="w-2 h-2 bg-white/40 rounded-full animate-bounce"
                style={{ animationDuration: `${1.5 + i * 0.3}s`, animationDelay: `${i * 0.2}s` }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-white relative">
        {/* Subtle pattern */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, #4169E1 1px, transparent 0)',
          backgroundSize: '28px 28px',
        }} />

        <div className="w-full max-w-[400px] relative z-10">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center justify-center gap-3 mb-10">
            <div className="w-9 h-9 bg-gradient-to-br from-[#4169E1] to-blue-600 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <span className="text-lg font-bold text-gray-900">Teach Connect</span>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-1.5">Welcome back</h2>
            <p className="text-sm text-gray-500">Enter your credentials to access your account</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm flex items-center gap-2.5">
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">Email address</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50/50 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#4169E1]/20 focus:border-[#4169E1] transition-all text-sm"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50/50 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#4169E1]/20 focus:border-[#4169E1] transition-all text-sm pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <div className="relative">
                  <input type="checkbox" className="sr-only peer" />
                  <div className="w-5 h-5 rounded-md border border-gray-300 bg-white peer-checked:bg-[#4169E1] peer-checked:border-[#4169E1] transition-all flex items-center justify-center">
                    <svg className="w-3 h-3 text-white opacity-0 peer-checked:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
                <span className="text-sm text-gray-600">Remember me</span>
              </label>
              <button type="button" className="text-sm font-medium text-[#4169E1] hover:text-[#3658c7] transition-colors">Forgot password?</button>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-[#4169E1] to-blue-600 hover:from-[#3658c7] hover:to-blue-500 text-white font-semibold rounded-xl shadow-lg shadow-[#4169E1]/25 hover:shadow-xl hover:shadow-[#4169E1]/30 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Signing in...
                </>
              ) : (
                'Sign in'
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-7">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center">
              <span className="px-4 bg-white text-gray-400 text-xs uppercase tracking-wider">or</span>
            </div>
          </div>

          {/* Social Login */}
          <div className="grid grid-cols-1 gap-3">
            <button className="flex items-center justify-center gap-3 py-3 px-4 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300 transition-all group">
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900 transition-colors">Continue with Google</span>
            </button>
          </div>

          {/* Sign up link */}
          <p className="text-center text-sm text-gray-500 mt-7">
            Don&apos;t have an account?{' '}
            <button className="font-semibold text-[#4169E1] hover:text-[#3658c7] transition-colors">Sign up for free</button>
          </p>

          {/* Mock hint */}
          <p className="text-center text-[11px] text-gray-400 mt-5">
            Demo mode — use any email and password to sign in
          </p>
        </div>
      </div>

      {/* Post-submit success animation — checkmark draw-in, then redirect */}
      {showSuccess && (
        <div className="success-overlay fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-[#1e3a8a] via-[#4169E1] to-[#3b82f6]">
          <div className="flex flex-col items-center gap-5">
            <div className="relative flex h-24 w-24 items-center justify-center">
              <svg className="h-24 w-24 -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="4" />
                <circle
                  cx="50"
                  cy="50"
                  r="44"
                  fill="none"
                  stroke="white"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray="276.5"
                  className="animate-successRing"
                />
              </svg>
              <svg className="absolute h-10 w-10 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 12l5 5L20 6"
                  strokeDasharray="24"
                  className="animate-successCheck"
                />
              </svg>
            </div>
            <p className="animate-successText text-lg font-semibold text-white opacity-0">Signed in — taking you in</p>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .success-overlay {
          animation: fadeIn 0.25s ease-out;
        }
        @keyframes successRing {
          from { stroke-dashoffset: 276.5; }
          to { stroke-dashoffset: 0; }
        }
        @keyframes successCheck {
          0%, 40% { stroke-dashoffset: 24; opacity: 0; }
          55% { opacity: 1; }
          100% { stroke-dashoffset: 0; opacity: 1; }
        }
        @keyframes successText {
          0%, 45% { opacity: 0; transform: translateY(4px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .animate-successRing {
          animation: successRing 0.6s ease-out forwards;
        }
        .animate-successCheck {
          animation: successCheck 0.7s ease-out forwards;
        }
        .animate-successText {
          animation: successText 0.6s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
