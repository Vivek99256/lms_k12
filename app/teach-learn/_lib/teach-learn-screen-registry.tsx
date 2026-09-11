'use client';

import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';

/**
 * Teach/Learn screens that a category page can render inline, keyed by the
 * route the menu's `link` resolves to — the same pattern as
 * app/fees/_lib/fees-screen-registry.tsx.
 *
 * These are the very same page components the standalone routes render. The
 * screen is reused, never reimplemented or copied.
 *
 * Loaded with next/dynamic so a category page only pulls in the screen
 * actually being viewed.
 *
 * A route absent from this map is not embeddable and stays a normal link —
 * the tab navigates to it as before.
 */

/**
 * Every screen below is a prop-less page component, so `object` is the widest
 * accurate prop type.
 */
type ScreenComponent = ComponentType<object>;

function screen(loader: () => Promise<{ default: ScreenComponent }>): ScreenComponent {
  return dynamic(loader, { ssr: false });
}

const TEACH_LEARN_SCREENS: Record<string, ScreenComponent> = {
  // Master Setup
  '/lms/global-mapping': screen(() => import('@/app/lms/global-mapping/page')),
  '/lms/leader-board-master': screen(() => import('@/app/lms/leader-board-master/page')),

  // Operations
  '/course-master': screen(() => import('@/app/course-master/page')),

  // Reports
  '/lms/student-analysis': screen(() => import('@/app/lms/student-analysis/page')),
  '/exam/progress-report': screen(() => import('@/app/exam/progress-report/page')),
  '/lms/question-wise-report': screen(() => import('@/app/lms/question-wise-report/page')),
  '/pal/report': screen(() => import('@/app/pal/report/page')),
};

/** Route keys are lower-cased and query/trailing slash stripped, as above. */
export function normalizeScreenRoute(route: string | null | undefined): string {
  const value = (route ?? '').trim().toLowerCase();
  if (!value) return '';
  const [path] = value.split('?');
  return path.replace(/\/+$/, '') || '/';
}

/** Whether a route can render inline on a category page. */
export function isEmbeddableTeachLearnScreen(route: string | null | undefined): boolean {
  const key = normalizeScreenRoute(route);
  return key !== '' && key in TEACH_LEARN_SCREENS;
}

/**
 * Renders the screen registered for `route`, or nothing when there is none.
 *
 * The lookup lives inside this component on purpose — see
 * fees-screen-registry.tsx's FeesScreenOutlet for the reasoning.
 */
export function TeachLearnScreenOutlet({ route }: { route: string | null | undefined }) {
  const key = normalizeScreenRoute(route);
  const Screen = key ? TEACH_LEARN_SCREENS[key] : undefined;

  if (!Screen) return null;

  return <Screen key={key} />;
}
