'use client';

import { WorkflowConsole } from './_components/WorkflowConsole';

/**
 * Platform services -> Workflow.
 *
 * Module and component-wise approval configuration: every action that can pause
 * for a sign-off, and the chain each runs through here. Points come from the
 * registry; chains are this institute's own.
 */
export default function WorkflowPage() {
  return <WorkflowConsole />;
}
