'use client';

import {
  Boxes,
  Database,
  FileCheck2,
  GitBranch,
  LayoutDashboard,
  Lightbulb,
  ListChecks,
  Bot,
} from 'lucide-react';
import type { FeesStaticScreen } from '@/app/fees/_components/fees-category-page';
import { FeesPlaceholderScreen } from '@/app/fees/_components/fees-placeholder-screen';

/**
 * The Fees → Intelligence workspace tabs.
 *
 * These eight are new surfaces with no menu record and no backend behind them
 * yet, so each renders a static placeholder describing what the tab is for.
 * They are declared here rather than in the database precisely because they are
 * static: fees_menu_category_items points at real tblmenumaster rows, and there
 * is nothing real to point at until these are built.
 *
 * Any genuine Intelligence menu the user has rights to — "Fees Prediction"
 * today — still comes from the database and is appended after these tabs, so
 * the static scaffold never hides working functionality.
 *
 * When one of these is implemented for real, it replaces the placeholder body
 * here; if it also gains a menu record, drop it from this list and add the row
 * instead.
 */

export const FEES_INTELLIGENCE_SCREENS: FeesStaticScreen[] = [
  {
    id: 'data-injection',
    label: 'Data Injection',
    icon: Database,
    render: () => (
      <FeesPlaceholderScreen
        title="Data Injection"
        summary="Feed fees data into the intelligence layer and track what has been ingested."
        points={[
          'Sources to ingest: receipts, demand, break-offs, cancellations and refunds.',
          'Ingestion runs with their status, row counts and last-run time.',
          'Validation failures held for review before they reach the model.',
        ]}
      />
    ),
  },
  {
    id: 'overview',
    label: 'Overview',
    icon: LayoutDashboard,
    render: () => (
      <FeesPlaceholderScreen
        title="Overview"
        summary="A single read on how the fees intelligence layer is performing."
        points={[
          'Headline signals: collection risk, defaulter trend, forecast confidence.',
          'What changed since the previous period, and why.',
          'Health of the agents, integrations and workflows on the other tabs.',
        ]}
      />
    ),
  },
  {
    id: 'ai-agents',
    label: 'AI Agents',
    icon: Bot,
    render: () => (
      <FeesPlaceholderScreen
        title="AI Agents"
        summary="The agents that watch fees data and act on it."
        points={[
          'Agent roster with purpose, trigger and current state.',
          'Run history: what each agent looked at and what it concluded.',
          'Per-agent controls — enable, pause, and set escalation thresholds.',
        ]}
      />
    ),
  },
  {
    id: 'action-items',
    label: 'Action Items',
    icon: ListChecks,
    render: () => (
      <FeesPlaceholderScreen
        title="Action Items"
        summary="Work the intelligence layer has raised for a person to complete."
        points={[
          'Items with owner, due date and the finding that produced them.',
          'Filter by severity, category and status.',
          'Resolution trail, so a closed item still shows what was done.',
        ]}
      />
    ),
  },
  {
    id: 'module-integration',
    label: 'Module Integration',
    icon: Boxes,
    render: () => (
      <FeesPlaceholderScreen
        title="Module Integration"
        summary="How Fees intelligence connects to the rest of the ERP."
        points={[
          'Connected modules and the data each one contributes.',
          'Connection health and last successful sync.',
          'Field mapping between Fees and each connected module.',
        ]}
      />
    ),
  },
  {
    id: 'cross-module-workflows',
    label: 'Cross-Module Workflows',
    icon: GitBranch,
    render: () => (
      <FeesPlaceholderScreen
        title="Cross-Module Workflows"
        summary="Workflows that start in Fees and continue in another module."
        points={[
          'Workflow definitions with their trigger and the modules they span.',
          'In-flight runs and where each one is currently waiting.',
          'Failures and retries, with the step that stalled.',
        ]}
      />
    ),
  },
  {
    id: 'recommendations',
    label: 'Recommendations',
    icon: Lightbulb,
    render: () => (
      <FeesPlaceholderScreen
        title="Recommendations"
        summary="Suggested changes to fees setup and collection, with the reasoning behind each."
        points={[
          'Ranked recommendations with expected impact and confidence.',
          'The evidence each one is based on.',
          'Accept or dismiss, with the decision recorded on the next tab.',
        ]}
      />
    ),
  },
  {
    id: 'decision-record',
    label: 'Decision Record',
    icon: FileCheck2,
    render: () => (
      <FeesPlaceholderScreen
        title="Decision Record"
        summary="An audit trail of decisions taken on the intelligence layer's output."
        points={[
          'What was decided, by whom, and when.',
          'The recommendation or finding the decision responded to.',
          'Outcome after the fact, so decisions can be reviewed later.',
        ]}
      />
    ),
  },
];
