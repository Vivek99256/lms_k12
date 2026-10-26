'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import LoginPage from '@/app/login/page';
import DashboardShell from './DashboardShell';
import StudentRouteGuard from './student/StudentRouteGuard';
import { isStudentProfile } from '@/lib/ai/adapters/shared-utils';
import { installErpAuthFetch } from '@/lib/erp-client';

// Module scope, so it is in place before any page's first fetch (see lib/erp-client.ts).
installErpAuthFetch();

/**
 * Routes that own the whole viewport and so render outside the dashboard
 * chrome (sidebar, header, level-3 subheader). The template designer is one:
 * it is a full-bleed canvas app with its own toolbar, and nesting it inside the
 * scrolling shell would leave it a fraction of the screen with two toolbars.
 * These routes still sit behind the same authentication gate.
 *
 * /mobile-bridge is the other reason this list exists: it is what the mobile apps open
 * (see MobileWebHandoffApiController), at phone width with no room to spare -- wrapping it
 * in the admin sidebar makes the page unusable.
 */
const FULL_BLEED_ROUTES = [
  '/document-templates/editor',
  '/mobile-bridge',
];

export default function ConditionalApp({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, menuContext } = useAuth();
  const pathname = usePathname() || '';
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  // The alumni portal is its own sign-in with its own tokens (see app/alumni-portal): it must not show the staff login, and it
  // never gets the staff sidebar. Matched as an exact path prefix so no other route is affected.
  if (pathname === '/alumni-portal' || pathname.startsWith('/alumni-portal/')) {
    return <>{children}</>;
  }

  // Parents pay school fees from a link the school sends them (app/pay): no account exists for them, so this page
  // is reachable signed out and never gets the staff sidebar. Matched as an exact path prefix, like the alumni portal.
  if (pathname === '/pay' || pathname.startsWith('/pay/')) {
    return <>{children}</>;
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  if (FULL_BLEED_ROUTES.some((route) => pathname.startsWith(route))) {
    return <>{children}</>;
  }

  // Students use the same shell as staff, so they see the same sidebar, category bar and
  // screen tabs, filtered by their menu rights; the guard keeps them off staff-only URLs.
  if (isStudentProfile(menuContext?.user_profile_name)) {
    return (
      <DashboardShell>
        <StudentRouteGuard>{children}</StudentRouteGuard>
      </DashboardShell>
    );
  }

  return <DashboardShell>{children}</DashboardShell>;
}
