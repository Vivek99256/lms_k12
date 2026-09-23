'use client';

import { isEmbeddableFeesScreen, FeesScreenOutlet } from '@/app/fees/_lib/fees-screen-registry';
import {
  isEmbeddableTeachLearnScreen,
  TeachLearnScreenOutlet,
} from '@/app/teach-learn/_lib/teach-learn-screen-registry';
import { GENERATED_MODULE_SCREENS } from '@/app/_lib/module-screens.generated';

/**
 * Which of a module's screens a category page can render inline, and how.
 *
 * Two layers, checked in order:
 *
 *  1. The module's own curated registry, if it has one. Fees and Teach/Learn
 *     each built a route -> page map before this was general, and they are
 *     consulted first so anything they deliberately map keeps resolving the way
 *     it does today.
 *  2. The generated app-wide map, which covers every page in the app that can
 *     be mounted. This is what lets all 64 modules' tabs open their screen in
 *     place — see scripts/generate-module-screens.mts.
 *
 * A route in neither layer is not embeddable. That is now the exception rather
 * than the rule: it means either no page exists for the menu's link (54 of the
 * seeded menus point at legacy Laravel route names with nothing behind them) or
 * the page is a server component that cannot be mounted client-side.
 */

export type ModuleScreenRegistry = {
  isEmbeddable: (route: string | null | undefined) => boolean;
  Outlet: (props: { route: string | null | undefined }) => React.ReactNode;
};

/** Lower-cased, query and trailing slash stripped — how the map is keyed. */
function normalizeScreenRoute(route: string | null | undefined): string {
  const value = (route ?? '').trim().toLowerCase();
  if (!value) return '';
  const [path] = value.split('?');

  return path.replace(/\/+$/, '') || '/';
}

function isGeneratedScreen(route: string | null | undefined): boolean {
  const key = normalizeScreenRoute(route);

  return key !== '' && key in GENERATED_MODULE_SCREENS;
}

/**
 * The lookup lives inside the component rather than in the caller so the
 * resolved component is a stable reference across renders — the same reason
 * FeesScreenOutlet does it this way. Keying the element on the route is what
 * forces a remount when the tab changes, instead of React reconciling two
 * different screens into one another's state.
 */
function GeneratedScreenOutlet({ route }: { route: string | null | undefined }) {
  const key = normalizeScreenRoute(route);
  const Screen = key ? GENERATED_MODULE_SCREENS[key] : undefined;

  if (!Screen) return null;

  return <Screen key={key} />;
}

const CURATED: Record<string, ModuleScreenRegistry> = {
  fees: { isEmbeddable: isEmbeddableFeesScreen, Outlet: FeesScreenOutlet },
  teach_learn: { isEmbeddable: isEmbeddableTeachLearnScreen, Outlet: TeachLearnScreenOutlet },
};

const GENERATED: ModuleScreenRegistry = {
  isEmbeddable: isGeneratedScreen,
  Outlet: GeneratedScreenOutlet,
};

export function getModuleScreenRegistry(moduleName: string | null | undefined): ModuleScreenRegistry {
  const curated = CURATED[(moduleName ?? '').trim()];

  if (!curated) return GENERATED;

  // Curated first, generated as the fallback, so a module with its own registry
  // gains every other mountable screen without losing its own mappings.
  return {
    isEmbeddable: (route) => curated.isEmbeddable(route) || GENERATED.isEmbeddable(route),
    Outlet: ({ route }) =>
      curated.isEmbeddable(route) ? curated.Outlet({ route }) : GENERATED.Outlet({ route }),
  };
}
