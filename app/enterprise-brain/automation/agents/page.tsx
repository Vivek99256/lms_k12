'use client';

import { useState } from 'react';
import { Boxes } from 'lucide-react';

import ScreenView from '../../_components/ScreenView';
import { Badge } from '@/components/ui/badge';
import { getRoadmapItem } from '@/lib/roadmap';
import { AgentManagement } from './_components/AgentManagement';
import { AGENT_MODULES } from '@/lib/agents/registry';
import { ModulePicker } from '../../../ai/_components/ModulePicker';
import { DomainAgentPanel } from '../../../ai/_components/DomainAgentPanel';

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
  const [toolModule, setToolModule] = useState('');

  return (
    <div className="space-y-8">
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

      {/*
        Tool agents — the JSON-store-backed library `AgentManagement` already owns. A
        module's own AI Stack -> Automations tab embeds this identical component with
        `moduleFilter` set (see e.g. app/fees/ai-stack/_screens/fees-automations-screen.tsx);
        this is the same component, the same store, filtered the same way, just reachable
        centrally with a module to pick from instead of one baked into the embedding page.
      */}
      <section className="px-1">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">Tool agents, by module</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              The same agentic library a module&rsquo;s own AI Stack &rarr; Automations tab shows, scoped to one
              module at a time.
            </p>
          </div>
          <ModulePicker modules={AGENT_MODULES} value={toolModule} onChange={setToolModule} allowAll />
        </div>
        <AgentManagement moduleFilter={toolModule || undefined} embedded />
      </section>

      <DomainAgentPanel />
    </div>
  );
}
