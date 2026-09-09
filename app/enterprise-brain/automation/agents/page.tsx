'use client';

import { Boxes } from 'lucide-react';

import ScreenView from '../../_components/ScreenView';
import { Badge } from '@/components/ui/badge';
import { getRoadmapItem } from '@/lib/roadmap';

const AGENT_LIBRARY = 'ai.agentic-library';

/**
 * The Agentic Library.
 *
 * WHY THE NOTE IS NOT A "COMING SOON" BADGE
 *
 * This screen works. What is changing is where the library lives — it becomes a
 * shared service so K-12 and Enterprise Brain call the same agents — and the
 * note exists to state that decision to anyone looking, customers included.
 *
 * An earlier version used `ComingSoonBadge`, which renders a hammer for an
 * in-progress row. A construction icon on a working screen says "this feature
 * is not finished", which is both untrue here and the exact mislabelling the
 * per-framework badge decision was written to prevent. So this uses a neutral
 * outline `Badge`: it marks the screen as multi-module without implying the
 * screen itself is unbuilt.
 *
 * The wording still comes from `lib/roadmap`, so this note and the roadmap
 * screen cannot drift apart.
 */
export default function AgentsPage() {
  const item = getRoadmapItem(AGENT_LIBRARY);

  return (
    <ScreenView
      screen="agents"
      notice={
        <div className="flex flex-wrap items-start gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3">
          <Badge variant="outline" className="shrink-0 gap-1.5">
            <Boxes aria-hidden="true" />
            Multi-module
          </Badge>
          <p className="min-w-0 text-sm leading-6 text-gray-600">
            {item?.blurb ??
              'The agent library is becoming a shared service, so the same agents will serve K-12 and Enterprise Brain.'}
          </p>
        </div>
      }
    />
  );
}
