'use client';

/**
 * Template Management — the listing.
 *
 * A static route, so it takes precedence over `app/ai/[capability]/page.tsx` for this
 * slug. Everything that page showed is still shown by the shared `CapabilityShell`;
 * this file only adds the listing underneath, exactly as `/ai/providers` and
 * `/ai/models` do.
 *
 * View and Edit are their own routes — `/ai/prompts/[id]` and `/ai/prompts/[id]/edit` —
 * rather than panels rendered under the table. See `TemplateList` for why.
 *
 * WHY THE ROUTE IS STILL `prompts`
 *
 * The capability's slug is its identifier, not its label. It is written into
 * `tblmenumaster` as `ai_intelligence.prompts` by
 * `2026_09_10_000001_add_ai_intelligence_menu`, resolved by `routeMapper`, and carried
 * by roughly 7,600 rights rows across the estate. Renaming the capability to Template
 * Management is a label change in the registry and one UPDATE to the menu row;
 * renaming the slug would be a route change, a migration against those rights, and a
 * dead bookmark for anyone who already had one.
 */

import { CapabilityShell } from '../_components/CapabilityShell';
import { TemplateList } from '../_components/TemplateList';

export default function AiTemplatesPage() {
  return (
    <CapabilityShell slug="prompts">
      <TemplateList />
    </CapabilityShell>
  );
}
