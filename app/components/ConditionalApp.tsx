'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import LoginPage from '@/app/login/page';
import DashboardShell from './DashboardShell';

export default function ConditionalApp({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return <DashboardShell>{children}</DashboardShell>;
}
