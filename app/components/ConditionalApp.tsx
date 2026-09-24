'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import LoginPage from '@/app/login/page';
import DashboardShell from './DashboardShell';

/**
 * Routes that own the whole viewport and so render outside the dashboard
 * chrome (sidebar, header, level-3 subheader). The template designer is one:
 * it is a full-bleed canvas app with its own toolbar, and nesting it inside the
 * scrolling shell would leave it a fraction of the screen with two toolbars.
 * These routes still sit behind the same authentication gate.
 *
 * /mobile/custom and /mobile-bridge are the other reason this list exists at
 * all: they're what Flutter's WebView actually opens (see MobileWebHandoffApiController
 * / DynamicWebScreen), at phone width with no room to spare -- wrapping them
 * in the admin sidebar doesn't just look wrong, it makes the page unusable.
 * The Mobile Page Builder editor is the same phone-frame-canvas case as the
 * document-template editor above.
 */
const FULL_BLEED_ROUTES = [
  '/document-templates/editor',
  '/mobile/custom',
  '/mobile-bridge',
  '/general/mobile_page_builder/',
];

export default function ConditionalApp({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const pathname = usePathname() || '';
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  if (FULL_BLEED_ROUTES.some((route) => pathname.startsWith(route))) {
    return <>{children}</>;
  }

  return <DashboardShell>{children}</DashboardShell>;
}
