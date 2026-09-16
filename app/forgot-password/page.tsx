'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Pre-login only. The reset form itself lives as a modal on /login so users
 * never leave the sign-in flow — visiting this URL while already
 * authenticated is treated as a stale tab and bounces back to the dashboard.
 */
export default function ForgotPasswordPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/dashboard');
    } else {
      router.replace('/login');
    }
  }, [isAuthenticated, router]);

  return null;
}