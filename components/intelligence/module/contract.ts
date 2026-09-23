import type { ReactNode } from 'react';

import type { ModuleIntelligencePayload } from './payload';

/**
 * What one module has to declare to get an Intelligence screen.
 *
 * ── THE DECISION THIS FILE ENCODES ──────────────────────────────────────────
 *
 * ONE RENDERER, MANY CONTRACTS — not one screen per module.
 *
 * Fees Intelligence is ~3,600 lines of React. Reproducing that for forty
 * modules gives forty screens that drift apart the first time anyone fixes a
 * severity colour in one of them. Instead, every module declares ~80 lines of
 * contract and `<ModuleIntelligence>` renders it. There is one renderer to fix,
 * one set of empty states to get right, and one place where the honesty rules
 * live.
 *
 * WHAT BELONGS HERE: presentation and wiring — which sections appear, in what
 * order, with what wording, against which endpoint.
 *
 * WHAT DOES NOT: facts and units. Whether a column is money or a head-count is
 * a property of the data, so the backend declares it in the payload. A contract
 * that could override the unit would let a screen render marks in rupees.
 *
 * ── WHY THE CONTRACT IS TYPESCRIPT AND NOT YAML ─────────────────────────────
 *
 * It was going to be YAML, for reviewability. TypeScript is just as reviewable
 * — an object literal with named fields — and it is type-checked, needs no
 * parser, no codegen step and no second source of truth for the shapes in
 * payload.ts. The generator emits this file directly.
 */

/* ------------------------------------------------------------------ sections */

/**
 * The eight standard sections, in the order they are read.
 *
 * They are the ladder from `docs` — coverage, position, distribution, signals,
 * reasoning, action, outcome, learning — and they are fixed. A module chooses
 * WHICH of them it has the data for and WHAT to call them; it does not invent a
 * ninth, because a section nobody else has is a bespoke card (see `extraCards`).
 */
export type SectionKey =
  | 'summary'
  | 'position'
  | 'breakdowns'
  | 'findings'
  | 'priorities'
  | 'recommendations'
  | 'decisions'
  | 'dataQuality'
  | 'learning'
  | 'integration'
  | 'workflow';

export interface SectionCopy {
  /** The small coloured overline: "Analytics", "Intelligence", "Ledger". */
  eyebrow: string;
  title: string;
  /**
   * One sentence saying what the reader is looking at and where it came from.
   *
   * Write it so it would still be true if the numbers were all zero — it
   * describes the section, not the finding.
   */
  description: string;
}

export interface SectionConfig {
  key: SectionKey;
  copy: SectionCopy;
  /**
   * Render the section even when its data block is unavailable, showing the
   * backend's reason. Default true, and it should stay true for anything a
   * reader would otherwise assume is clean: a missing Data quality section
   * reads as "no problems", which is a different claim from "not checked".
   */
  showWhenUnavailable?: boolean;
}

/* -------------------------------------------------------------- extra cards */

/**
 * A module-specific card, for data that genuinely has no generic shape.
 *
 * Fees' gateway reconciliation and NACH mandate coverage are the motivating
 * case: both are real intelligence, and neither is a metric, a breakdown or a
 * finding. THREE IS THE CAP, enforced at runtime by `defineContract`. Without a
 * cap this field becomes the whole screen again and the shared renderer stops
 * being shared.
 */
export interface ExtraCard {
  key: string;
  /** Which section this card is appended to. */
  section: SectionKey;
  render: (extras: Record<string, unknown>, payload: ModuleIntelligencePayload) => ReactNode;
}

/* ------------------------------------------------------------------ actions */

export type DecisionVerdict = 'approved' | 'rejected';

export interface ModuleIntelligenceActions {
  /**
   * Recompute this module's signals for the selected year.
   *
   * Optional: a module whose rules are not yet registered in
   * `IntelligencePipeline` has nothing to run, and the screen hides the button
   * rather than offering an action that silently does nothing.
   */
  run?: () => Promise<unknown>;
  /** Approve or reject a recommendation. Goes through the Brain's own endpoint. */
  decide?: (recommendationId: string, verdict: DecisionVerdict, rationale: string) => Promise<unknown>;
  /** Record what actually happened after an approved action. */
  recordOutcome?: (
    executionId: string,
    result: 'success' | 'partial' | 'failed',
    feedback: string,
    measured?: { before?: number; after?: number; unitsAffected?: number },
  ) => Promise<unknown>;
}

/* ----------------------------------------------------------------- contract */

export interface ModuleIntelligenceContract {
  /** Stable key, matching the module's route segment: 'fees', 'result'. */
  key: string;
  /** Tab and heading label: "Fees Intelligence". */
  label: string;
  /**
   * The module's own accent, applied as `--intel-accent`.
   *
   * Threading it through a CSS variable rather than hard-coding indigo is the
   * only reason the Fees screen's visual language survives being shared: Fees
   * keeps #5846EA, and a module with a different accent does not have to fork a
   * component to get it.
   */
  accent: string;
  /**
   * What one row of this module's grain is, in words — "one student's fee
   * account", "one student's result in one subject".
   *
   * Shown in the footer beside the source. It is the single most useful thing
   * for a reader deciding whether a number means what they assume, and writing
   * it forces whoever authors the contract to know the grain.
   */
  grain: string;
  /** Unit nouns for generic copy: "account" / "accounts", "student" / "students". */
  nouns: { singular: string; plural: string };

  /** Fetch the payload. The adapter lives here when the endpoint predates this shape. */
  load: () => Promise<ModuleIntelligencePayload>;
  actions?: ModuleIntelligenceActions;

  sections: SectionConfig[];
  /**
   * Metric keys promoted into the summary strip, in order.
   *
   * Six is the practical maximum before the strip stops being scannable; the
   * renderer takes the first six and ignores the rest rather than wrapping into
   * an unreadable second row.
   */
  summaryMetrics?: string[];

  /** Shown when `coverage.available` is false — the whole-screen empty state. */
  emptyState: { title: string; fallbackReason: string };

  extraCards?: ExtraCard[];
}

/* ------------------------------------------------------------------ helpers */

export const MAX_EXTRA_CARDS = 3;

/**
 * Default copy for the eight sections.
 *
 * A module overrides only what its own nouns change — Fees says "Financial
 * position", Result says "Academic position" — and inherits the rest, which is
 * what keeps forty screens reading like one product.
 */
export function defaultSections(): SectionConfig[] {
  return [
    {
      key: 'summary',
      copy: {
        eyebrow: 'Management summary',
        title: 'What is happening',
        description:
          'Composed from the same figures shown below. Every sentence is assembled server-side and is reproducible — no model wrote it.',
      },
    },
    {
      key: 'position',
      copy: {
        eyebrow: 'Analytics',
        title: 'Position',
        description:
          'What is true right now. Every figure is read from this year’s records at the moment you loaded the page.',
      },
    },
    {
      key: 'breakdowns',
      copy: {
        eyebrow: 'Analytics',
        title: 'Where it sits',
        description: 'The same totals, sliced the ways this module is actually managed.',
      },
    },
    {
      key: 'findings',
      copy: {
        eyebrow: 'Intelligence',
        title: 'What the Brain sees',
        description:
          'What the figures mean. Each finding states what happened, why it matters, and the evidence it rests on — nothing appears here without figures behind it.',
      },
    },
    {
      key: 'priorities',
      copy: {
        eyebrow: 'Intelligence',
        title: 'Priority attention',
        description: 'The findings worth acting on first, with the next step each one implies.',
      },
    },
    {
      key: 'recommendations',
      copy: {
        eyebrow: 'Action',
        title: 'What to consider doing',
        description:
          'Each recommendation names the finding it answers. Approving one records a decision against your name; it does not execute anything on its own.',
      },
    },
    {
      key: 'decisions',
      copy: {
        eyebrow: 'Ledger',
        title: 'Decisions and outcomes',
        description: 'What was decided, what was carried out, and what it actually achieved.',
      },
    },
    {
      key: 'dataQuality',
      copy: {
        eyebrow: 'Ledger',
        title: 'Data quality',
        description: 'Checks on the records themselves. Each one is an exact count against this year’s rows.',
      },
    },
    {
      key: 'learning',
      copy: {
        eyebrow: 'Memory',
        title: 'Organizational learning',
        description:
          'What earlier decisions in this module actually achieved, carried forward so the next decision is better informed.',
      },
    },
    {
      key: 'integration',
      copy: {
        eyebrow: 'Ecosystem',
        title: 'Module Integration',
        description: 'Cross-module data relationships, shared metrics, and verified entity connections for this module.',
      },
    },
    {
      key: 'workflow',
      copy: {
        eyebrow: 'Execution',
        title: 'Cross-Module Workflow',
        description: 'Multi-module operational workflows, trigger conditions, approval gates, and live execution history.',
      },
    },
  ];
}

/**
 * Build a contract, checking the rules that a type alone cannot.
 *
 * The extra-card cap is enforced HERE rather than left as a comment because a
 * comment does not survive the fifth module. Throwing at module-evaluation time
 * means the build fails, not a screen at runtime in front of a principal.
 */
export function defineContract(contract: ModuleIntelligenceContract): ModuleIntelligenceContract {
  const extras = contract.extraCards ?? [];

  if (extras.length > MAX_EXTRA_CARDS) {
    throw new Error(
      `Intelligence contract "${contract.key}" declares ${extras.length} extra cards; the cap is ${MAX_EXTRA_CARDS}. ` +
        'Fold the surplus into a breakdown or a finding — if it is genuinely neither, it probably belongs in the module itself rather than on its Intelligence screen.',
    );
  }

  const duplicateSection = contract.sections
    .map((section) => section.key)
    .find((key, index, keys) => keys.indexOf(key) !== index);

  if (duplicateSection) {
    throw new Error(
      `Intelligence contract "${contract.key}" declares section "${duplicateSection}" more than once.`,
    );
  }

  return contract;
}

/** Merge per-module copy overrides onto the defaults, preserving default order. */
export function sectionsWith(
  overrides: Partial<Record<SectionKey, Partial<SectionCopy>>>,
  omit: SectionKey[] = [],
): SectionConfig[] {
  return defaultSections()
    .filter((section) => !omit.includes(section.key))
    .map((section) => ({
      ...section,
      copy: { ...section.copy, ...(overrides[section.key] ?? {}) },
    }));
}

/* ----------------------------------------------------------- integrations & workflows */

export interface ModuleIntegrationItem {
  id: string;
  target_module: string;
  target_label: string;
  relationship: string;
  why_it_matters: string;
  status: 'available' | 'unavailable';
  record_count: number;
  metrics: Array<{ label: string; value: string }>;
  shared_entities: string[];
  route: string;
  reason?: string | null;
}

export interface ModuleIntegrationsResponse {
  module: string;
  module_label: string;
  academic_year: string | null;
  summary: {
    total_integrations: number;
    active_connections: number;
    headline: string;
  };
  integrations: ModuleIntegrationItem[];
}

export interface WorkflowStepItem {
  step_number: number;
  name: string;
  approver_type: string;
  approver: string;
  sla_hours: number;
}

export interface ModuleWorkflowItem {
  key: string;
  label: string;
  description: string;
  subject: string;
  module: string;
  component: string;
  involved_modules: string[];
  is_customized: boolean;
  status: string;
  steps: WorkflowStepItem[];
  trigger_capabilities: {
    can_trigger: boolean;
    requires_confirmation: boolean;
    destructive: boolean;
  };
}

export interface WorkflowRunItem {
  id: number;
  run_reference: string;
  workflow_key: string;
  status: string;
  current_step: string | null;
  initiated_by: string;
  started_at: string | null;
  finished_at: string | null;
}

export interface ModuleWorkflowsResponse {
  module: string;
  module_label: string;
  available_workflows_count: number;
  workflows: ModuleWorkflowItem[];
  recent_runs: WorkflowRunItem[];
}
