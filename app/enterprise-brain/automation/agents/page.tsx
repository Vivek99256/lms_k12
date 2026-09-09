'use client';

import { AgentManagement } from './_components/AgentManagement';

/**
 * Enterprise Brain → Automation → Agent management.
 *
 * The central console. Every module's agents, one engine behind them
 * (lib/agents), one run log. A module's own screen shows the same component
 * scoped to itself; nothing is duplicated per module.
 */
export default function AgentsPage() {
  return <AgentManagement />;
}
