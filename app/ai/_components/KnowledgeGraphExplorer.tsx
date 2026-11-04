'use client';

/**
 * The centralized Knowledge Graph — behind the "Knowledge Graph" item in the
 * profile dropdown's AI and insights column (`/ai/knowledge-graph`).
 *
 * Thin wrapper: the actual 3-panel Gapstogrowth-explorer + Neo4j-Browser
 * rebuild lives in `CentralizedKnowledgeGraphExplorer`, shared verbatim with
 * the Organization Management module's own "Knowledge Graph" tab
 * (`/modules/organization-management/knowledge-graph`, via
 * `module-category-page.tsx`'s special case) — one implementation, two
 * existing doors, neither restricted to the other's scope. This entry point
 * passes no focus module: it opens on the full module tree unfocused.
 */

import CentralizedKnowledgeGraphExplorer from './CentralizedKnowledgeGraphExplorer';

export default function KnowledgeGraphExplorer() {
  return (
    <div className="h-full w-full">
      <CentralizedKnowledgeGraphExplorer />
    </div>
  );
}
