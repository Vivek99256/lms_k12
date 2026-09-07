'use client';

import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';

/**
 * Fees screens that a category page can render inline, keyed by the route the
 * menu's `link` resolves to.
 *
 * A category page shows its menus as tabs and renders the selected screen
 * underneath, rather than navigating away. That means the screen has to be a
 * component the category page can mount — so this maps each screen's route to
 * its existing page module.
 *
 * These are the very same page components the standalone routes render. The
 * screen is reused, never reimplemented or copied: /fees/collect and the
 * "Fees Collect" tab on /fees/transactional-data mount one module. Every one of
 * them is a prop-less client component that reads nothing from the route, which
 * is what makes mounting it under a different path safe.
 *
 * Loaded with next/dynamic so a category page only pulls in the screen actually
 * being viewed, instead of all twenty-six up front.
 *
 * A route absent from this map is not embeddable and stays a normal link — the
 * tab navigates to it as before. That covers "Fee documents", which belongs to
 * the Document Templates module and needs its own query string, and the handful
 * of Fees menus whose links still point at legacy Laravel route names with no
 * Next.js page yet.
 */

/**
 * Every screen below is a prop-less page component, so `object` is the widest
 * accurate prop type — and, unlike `Record<string, never>`, one that can
 * actually be rendered as JSX with no props.
 */
type ScreenComponent = ComponentType<object>;

function screen(loader: () => Promise<{ default: ScreenComponent }>): ScreenComponent {
  return dynamic(loader, { ssr: false });
}

const FEES_SCREENS: Record<string, ScreenComponent> = {
  // Master Setup
  '/fees/update-fees-breakoff': screen(() => import('@/app/fees/update-fees-breakoff/page')),
  '/fees/master/other-fees-title': screen(() => import('@/app/fees/master/other-fees-title/page')),
  '/fees/master/fees-config-master': screen(() => import('@/app/fees/master/fees-config-master/page')),
  '/fees/master/additional-fees-mapping': screen(() => import('@/app/fees/master/additional-fees-mapping/page')),
  '/fees/master/new-fees-title-master': screen(() => import('@/app/fees/master/new-fees-title-master/page')),
  '/fees/master/fees-breakoff': screen(() => import('@/app/fees/master/fees-breakoff/page')),
  '/fees/master/fees-receipt-book-master': screen(() => import('@/app/fees/master/fees-receipt-book-master/page')),

  // Transactional Data
  '/fees/collect': screen(() => import('@/app/fees/collect/page')),
  '/fees/online_fees_collect': screen(() => import('@/app/fees/online_fees_collect/page')),
  '/fees/cancel-refund': screen(() => import('@/app/fees/cancel-refund/page')),
  '/fees/circulars': screen(() => import('@/app/fees/circulars/page')),
  '/fees/other_fees_collect': screen(() => import('@/app/fees/other_fees_collect/page')),
  '/fees/other_fees_cancel': screen(() => import('@/app/fees/other_fees_cancel/page')),
  '/fees/nach_s1excel_export': screen(() => import('@/app/fees/NACH_s1excel_export/page')),
  '/fees/nach_s2excel_import': screen(() => import('@/app/fees/NACH_s2excel_import/page')),
  '/fees/nach_s3excel_export': screen(() => import('@/app/fees/NACH_s3excel_export/page')),
  '/fees/nach_s4excel_import': screen(() => import('@/app/fees/NACH_s4excel_import/page')),

  // Reports
  '/fees/reports/fees-collection': screen(() => import('@/app/fees/reports/fees-collection/page')),
  '/fees/reports/other-fees': screen(() => import('@/app/fees/reports/other-fees/page')),
  '/fees/reports/other-fees-cancel': screen(() => import('@/app/fees/reports/other-fees-cancel/page')),
  '/fees/reports/datewise-summary': screen(() => import('@/app/fees/reports/datewise-summary/page')),
  '/fees/reports/fees-structure': screen(() => import('@/app/fees/reports/fees-structure/page')),
  '/fees/reports/fees-cancel': screen(() => import('@/app/fees/reports/fees-cancel/page')),
  '/fees/reports/fees-type-wise': screen(() => import('@/app/fees/reports/fees-type-wise/page')),
  '/fees/reports/fees-defaulter': screen(() => import('@/app/fees/reports/fees-defaulter/page')),
  '/fees/reports/student-breakoff': screen(() => import('@/app/fees/reports/student-breakoff/page')),
};

/** Route keys are lower-cased and query/trailing slash stripped, as above. */
export function normalizeScreenRoute(route: string | null | undefined): string {
  const value = (route ?? '').trim().toLowerCase();
  if (!value) return '';
  const [path] = value.split('?');
  return path.replace(/\/+$/, '') || '/';
}

/** Whether a route can render inline on a category page. */
export function isEmbeddableFeesScreen(route: string | null | undefined): boolean {
  const key = normalizeScreenRoute(route);
  return key !== '' && key in FEES_SCREENS;
}

/**
 * Renders the screen registered for `route`, or nothing when there is none.
 *
 * The lookup lives inside this component on purpose. Doing it in the caller
 * would hand a component *value* around through render, which reads as a
 * component created on the fly even though the map is a module-level constant;
 * keeping it here means callers only ever render one static component, and the
 * `key` remounts the screen cleanly when the tab changes.
 */
export function FeesScreenOutlet({ route }: { route: string | null | undefined }) {
  const key = normalizeScreenRoute(route);
  const Screen = key ? FEES_SCREENS[key] : undefined;

  if (!Screen) return null;

  return <Screen key={key} />;
}
