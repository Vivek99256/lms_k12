import { ModuleIntelligenceScreen } from '@/app/modules/_components/module-intelligence-screen';

/**
 * `/modules/<module-slug>/intelligence` — THE Intelligence route.
 *
 * The slug is the module's `module_name` in `fees_menu_categories`, which is
 * also what its own `route` column already spells for the Intelligence
 * category. Every Intelligence entry point — the sidebar item, the module's
 * category bar, a typed URL — lands here, so there is one canonical address per
 * module rather than one per folder.
 *
 * The per-module folder routes (`/students/intelligence`, `/fees/intelligence`,
 * `/Transportation/intelligence`, …) still exist and still render, so links
 * already shared keep working. Nothing in the product navigates to them.
 *
 * A static segment wins over its dynamic sibling in Next, so this page — not
 * `[category]` — answers `/modules/<slug>/intelligence`.
 */
export default async function Page({
  params,
}: {
  params: Promise<{ module: string }>;
}) {
  const { module } = await params;
  return <ModuleIntelligenceScreen moduleSlug={module} />;
}
