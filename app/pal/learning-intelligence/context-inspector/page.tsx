'use client';

/**
 * Context Graph Inspector — soft-disabled.
 *
 * The working page (5-stage assembly view: Student State → Relevant
 * Context → Concept Relationships → Decision Inputs → Recommended Next
 * Action, reading EsoEngineController::contextInspector()) is built and
 * was verified compiling/building cleanly, but is not currently surfaced —
 * only the Knowledge Graph Explorer is live for now. This page no longer
 * reads `?learnerId=&conceptId=`, fetches anything, or offers a Refresh
 * action; it is a read-only notice, same as any other not-yet-exposed
 * screen (see components/ui/coming-soon.tsx for why this is the one house
 * pattern for that). The route, AssemblyPipeline.tsx and the data layer
 * are untouched, so re-enabling this is a matter of restoring the nav tab
 * (DashboardShell.tsx / routeMapper.ts) and the original page body.
 */

import { Magnet } from 'lucide-react';
import { ComingSoonPanel } from '@/components/ui/coming-soon';
import IconBadge from '../_components/IconBadge';
import { HEADER_WASH } from '../_components/design-system';

export default function ContextInspectorPage() {
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900 sm:px-6">
      <header className={`mx-auto mb-6 flex max-w-3xl items-center gap-3 rounded-2xl p-5 ${HEADER_WASH}`}>
        <IconBadge icon={Magnet} accent="brand" size="lg" />
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Context Graph Inspector</h1>
          <p className="mt-0.5 text-sm text-slate-500">How a learning decision was assembled.</p>
        </div>
      </header>

      <div className="mx-auto max-w-3xl">
        <ComingSoonPanel
          title="Not available yet"
          blurb="This view isn't turned on right now. The Knowledge Graph Explorer is the one Learning Intelligence screen currently available."
          status="in-progress"
          points={[
            'Student state and recent activity for one concept',
            'The concept’s real relationship graph',
            'The persisted decision and recommendation behind it, never a fabricated one',
          ]}
        />
      </div>
    </div>
  );
}
