'use client';

import { useCallback, useState } from 'react';

import { FeesAgentControlCard } from '@/app/fees/ai-stack/_screens/fees-agent-control-card';
import { AgentManagement } from '@/app/enterprise-brain/automation/agents/_components/AgentManagement';

/**
 * Fees → AI Stack → Automations.
 *
 * The same two parts Teach/Learn's Automations screen is made of, and nothing else:
 *
 *   1. The module's sequential agent pipeline (Agent 1 ➔ Agent 2 ➔ Agent 3), each agent behind
 *      its own quality gate, shown agent by agent with what it does, what it ran, how it was
 *      tested, what it produced and what happens next.
 *   2. The shared Agent Management console scoped to `fees` — Agentic library, Agent dashboard,
 *      Create agent, Run log and Analysis — where every pipeline step is recorded.
 *
 * This file owns no agent logic. The pipeline runs on the backend; the console is the central
 * `AgentManagement` component, the same one Teach/Learn and Exam & Assessment mount.
 */

const MODULE = 'fees';

export function FeesAutomationsScreen() {
  // Remounts the console after a pipeline run so its Run Log and Analysis pick up the new steps.
  const [consoleKey, setConsoleKey] = useState(0);
  const refresh = useCallback(() => setConsoleKey((key) => key + 1), []);

  return (
    <div className="space-y-6">
      <FeesAgentControlCard onRan={refresh} />

      <div>
        <h3 className="mb-3 text-sm font-semibold tracking-tight text-slate-800">Fees agent management</h3>
        <AgentManagement key={consoleKey} moduleFilter={MODULE} embedded />
      </div>
    </div>
  );
}
