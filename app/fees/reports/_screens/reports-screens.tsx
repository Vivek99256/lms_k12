'use client';

import { History } from 'lucide-react';

import type { ModuleStaticScreen } from '@/app/_components/module-category-page';
import FeesAuditTrailPage from '@/app/fees/audit-trail/page';

/**
 * Fees -> Reports tabs that are not menu records.
 *
 * "Audit trail" has no tblmenumaster row yet, so it is supplied here the way
 * Communication and AI Stack supply theirs. It mounts the same component the
 * standalone /fees/audit-trail route renders -- the screen is reused, not
 * copied.
 *
 * The moment a menu row pointing at /fees/audit-trail exists, drop this entry:
 * the route is already in fees-screen-registry, so the database menu will
 * render the identical tab and carry the menu rights a static tab cannot.
 */
export const FEES_REPORTS_SCREENS: ModuleStaticScreen[] = [
  {
    id: 'audit-trail',
    label: 'Audit Trail',
    icon: History,
    render: () => <FeesAuditTrailPage />,
  },
];
