'use client';

/**
 * Attendance → AI Stack → Automations.
 *
 * ONE VIEW OF THE ATTENDANCE AGENTS
 *
 *   1. The automation. Start it once and the four pipeline agents run in order, cycle after cycle,
 *      over the school's real attendance register — read the register, validate each at-risk
 *      student against the Knowledge Graph, analyse the absence patterns, draft follow-ups for
 *      class teachers — until Stop is pressed. See `module-agent-pipeline-card.tsx`.
 *   2. The final draft and every agent's execution history, from what the backend recorded.
 *   3. The central Agent Management console, scoped to Attendance: the pipeline agents and the
 *      three tool agents (Low Attendance Analyst, Student Attendance Reader, Attendance Note
 *      Drafter) with their run log and analysis. They run as the person who presses Run.
 *
 * There is no separate approval agent or approval queue here. A finished draft goes straight to
 * the Admin Dashboard, and no agent sends anything or changes a register.
 */

import { useCallback, useState } from 'react';

import { ModuleToolAgentsSection } from '@/app/_components/ai-stack/automations-screen';
import { ModuleAgentPipelineCard } from '@/app/_components/ai-stack/module-agent-pipeline-card';
import { PipelineOutputsPanel } from '@/app/_components/ai-stack/pipeline-outputs-panel';
import { AgentManagement } from '@/app/enterprise-brain/automation/agents/_components/AgentManagement';
import { ATTENDANCE_MODULE } from '@/lib/attendance/attendance-ai-stack';

export function AttendanceAutomationsScreen() {
  // Remount the dependants after a cycle so they pick up the steps and drafts it just made.
  const [refreshKey, setRefreshKey] = useState(0);
  const onRan = useCallback(() => setRefreshKey((key) => key + 1), []);

  return (
    <div className="space-y-6">
      <ModuleAgentPipelineCard
        module="attendance"
        title="Attendance automation"
        description="Four agents run in order, continuously, over this institute's real attendance register: read the register, validate each at-risk student's class and class teacher against the Knowledge Graph, analyse the absence patterns, then draft follow-ups for class teachers. Nothing is sent and no attendance is changed."
        withWindow
        onRan={onRan}
      />

      <PipelineOutputsPanel key={`outputs-${refreshKey}`} module="attendance" title="Final draft and agent history" />

      <ModuleToolAgentsSection
        moduleKey={ATTENDANCE_MODULE}
        label="Attendance"
        records="attendance records"
        onChanged={onRan}
      />

      <div>
        <h3 className="mb-3 text-sm font-semibold tracking-tight text-slate-800">Attendance agent management</h3>
        <AgentManagement key={`console-${refreshKey}`} moduleFilter={ATTENDANCE_MODULE} embedded />
      </div>
    </div>
  );
}
