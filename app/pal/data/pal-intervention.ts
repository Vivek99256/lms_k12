import { buildSessionContext, readNumber, readString } from '@/lib/erp-client';
import type { ConceptDiagnosticResult } from '@/app/pal/data/pal-diagnostic';
import type { V4Cluster, V4Plateau, V4Risk, V4Velocity } from '@/app/pal/data/pal-v4';
import type { GovernanceReport, RecommendationStatus } from '@/lib/intelligence/types';

/**
 * When a learner stops being the engine's problem and becomes a person's.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS EXISTS AT ALL
 * ---------------------------------------------------------------------------
 * PAL's failure branch is a loop: reteach -> the same content -> practice ->
 * check -> fail -> reteach. Nothing in it ever ends, and nothing in it ever
 * tells anybody. A learner can sit in that loop for a term and no teacher is
 * informed, no record is written, and nothing can be shown to a parent to
 * evidence that the school noticed.
 *
 * The detection for it already exists and is stranded. V4Risk carries
 * `triggerIntervention` and is rendered as three read-only cards with nothing
 * attached to them. V4Velocity.remediationCycles is fetched, mapped, and read
 * by nothing at all. BR-06 in lib/process/sop-catalog.ts says escalation after
 * two remediation cycles is MANDATORY and system-enforced. This module is
 * where those signals finally meet a person.
 *
 * ---------------------------------------------------------------------------
 * TIER 2, NOT TIER 1
 * ---------------------------------------------------------------------------
 * The engine already repairs what it can by itself: remediate_prerequisite,
 * serve_contrast_pair, reteach. That is Tier 1, it is automatic, and it stays
 * exactly as it is. This is Tier 2: a person opens it and a person closes it.
 *
 * The distinction is load-bearing because the two failure modes are different.
 * Tier 1 fixes a gap inside the content path. Tier 2 exists for the gaps that
 * are not in the content path at all - a prerequisite two chapters back, a
 * language barrier, attendance, anxiety, a mistagged diagnostic - and no
 * amount of re-teaching fixes any of those.
 *
 * ---------------------------------------------------------------------------
 * THE ENGINE NEVER OPENS A CASE
 * ---------------------------------------------------------------------------
 * The pure half below produces CANDIDATES. Opening a case is a write against a
 * learner-visible record, which BR-07 reserves to an explicit human action.
 * So the triggers here are evidence handed to a teacher, never a decision
 * taken on their behalf.
 */

// ---------------------------------------------------------------------------
// The pure half. No fetching below this line until the transport section.
// ---------------------------------------------------------------------------

/**
 * BR-06, as a number.
 *
 * "A misconception marked persistent after two remediation cycles must be
 * escalated to the teacher for re-teach." - lib/process/sop-catalog.ts.
 *
 * This module does not choose a threshold; it names the one the SOP already
 * fixed. The counter that operationalises it is already on the wire:
 * V4Velocity.remediationCycles.
 */
export const REMEDIATION_CYCLES_BEFORE_ESCALATION = 2;

/** Consecutive failed Check gates before a person is asked to look. */
export const FAILED_CHECKS_BEFORE_ESCALATION = 2;

/**
 * A ladder this flat, with answers actually on it, is not slow progress - it
 * is no progress. Paired with needsRemediation below so that a learner two
 * questions into a concept is never labelled stuck.
 */
export const FLAT_LADDER_PROGRESS_PCT = 25;

export type InterventionTriggerKind =
  | 'repeated_remediation'
  | 'persistent_misconception'
  | 'failed_checks'
  | 'risk_signal'
  | 'flat_progress'
  | 'learner_raised';

export type InterventionSeverity = 'low' | 'medium' | 'high';

export interface InterventionTrigger {
  kind: InterventionTriggerKind;
  /** One sentence that the learner and the teacher both read. */
  summary: string;
  severity: InterventionSeverity;
  /** The business rule this encodes, where there is one. */
  ruleId: 'BR-06' | null;
  /** Field-level provenance, the same discipline as pal-feedback.ts. */
  evidence: { label: string; source: string }[];
}

/**
 * Everything any PAL surface can tell us about whether a learner is stuck.
 *
 * Every field is optional, exactly like ConceptCompletionSignals: a screen
 * passes whatever its own payload carries and the rules decide on what they
 * actually got.
 *
 * A MISSING field and a field whose value is null both mean "not measured",
 * and neither can ever produce a trigger. pal-v4.ts is deliberately nullable
 * for this reason - its own comment says an unassessed learner is not a slow
 * one - and coercing a null to zero here would escalate a learner nobody has
 * assessed yet.
 */
export interface InterventionSignals {
  conceptId?: string | null;
  conceptName?: string | null;
  result?: ConceptDiagnosticResult | null;
  risks?: V4Risk[];
  clusters?: V4Cluster[];
  velocity?: V4Velocity | null;
  plateau?: V4Plateau | null;
  /** Consecutive failed Check gates, from the caller's own count. */
  failedChecks?: number;
  /** The learner pressed "I'm still stuck". Evidence in its own right. */
  learnerRaised?: boolean;
}

function severityFromRiskLevel(level: string): InterventionSeverity {
  const value = level.toLowerCase();
  if (value === 'high' || value === 'critical' || value === 'severe') return 'high';
  if (value === 'medium' || value === 'moderate') return 'medium';
  return 'low';
}

/**
 * Candidate reasons a person should look at this learner, most serious first.
 *
 * Returns an empty array for a learner who is simply working through the
 * material, which is the overwhelming majority of the time and is the whole
 * point: a stage that fired for everybody would be noise, and a teacher who
 * is shown forty cases a day reads none of them.
 */
export function interventionTriggers(signals: InterventionSignals): InterventionTrigger[] {
  const triggers: InterventionTrigger[] = [];

  // BR-06, first arm: the misconception itself has persisted. The rule's
  // SUBJECT is the misconception, so this is the reading closest to its words.
  (signals.clusters ?? []).forEach((cluster) => {
    if (cluster.frequency < REMEDIATION_CYCLES_BEFORE_ESCALATION) return;

    const severe = severityFromRiskLevel(cluster.severity ?? '') === 'high';
    if (!severe && !cluster.teacherConfirmed) return;

    triggers.push({
      kind: 'persistent_misconception',
      summary: `The same mix-up has come back ${cluster.frequency} times: ${cluster.pattern}`,
      severity: 'high',
      ruleId: 'BR-06',
      evidence: [
        { label: `Seen ${cluster.frequency} times`, source: 'misconception cluster' },
        ...(cluster.rootCause ? [{ label: cluster.rootCause, source: 'root cause' }] : []),
        ...(cluster.teacherConfirmed
          ? [{ label: 'A teacher has confirmed this pattern', source: 'teacher confirmation' }]
          : []),
      ],
    });
  });

  // BR-06, second arm: the COUNTER the rule is operable through. Both arms
  // carry the rule id on purpose - either alone satisfies the escalation duty,
  // and recording only one would invite the next reader to delete the other.
  const cycles = signals.velocity?.remediationCycles;
  if (cycles != null && cycles >= REMEDIATION_CYCLES_BEFORE_ESCALATION) {
    triggers.push({
      kind: 'repeated_remediation',
      summary: `This has been through repair ${cycles} times without settling.`,
      severity: 'high',
      ruleId: 'BR-06',
      evidence: [{ label: `${cycles} remediation cycles`, source: 'velocity' }],
    });
  }

  const failed = signals.failedChecks ?? 0;
  if (failed >= FAILED_CHECKS_BEFORE_ESCALATION) {
    triggers.push({
      kind: 'failed_checks',
      summary: `The check has not been passed in ${failed} attempts.`,
      severity: 'medium',
      ruleId: null,
      evidence: [{ label: `${failed} checks not passed`, source: 'check history' }],
    });
  }

  (signals.risks ?? []).forEach((risk) => {
    if (!risk.triggerIntervention) return;

    triggers.push({
      kind: 'risk_signal',
      summary: `The ${risk.kind} signal has crossed its threshold.`,
      severity: severityFromRiskLevel(risk.riskLevel),
      ruleId: null,
      evidence: [
        { label: `${risk.riskLevel} risk`, source: `${risk.kind} risk` },
        ...risk.signals.map((entry) => ({
          label: `${entry.label}: ${entry.value}`,
          source: `${risk.kind} risk`,
        })),
      ],
    });
  });

  const result = signals.result;
  const flatLadder =
    result != null &&
    result.attempted > 0 &&
    result.ladder != null &&
    result.ladder.progressPct <= FLAT_LADDER_PROGRESS_PCT &&
    result.needsRemediation;

  if (signals.plateau?.triggerIntervention || flatLadder) {
    triggers.push({
      kind: 'flat_progress',
      summary: 'Answers are going in but the ladder is not moving.',
      severity: 'medium',
      ruleId: null,
      evidence: signals.plateau?.triggerIntervention
        ? [
            {
              label:
                signals.plateau.daysInPlateau != null
                  ? `${signals.plateau.daysInPlateau} days without movement`
                  : 'Plateau detected',
              source: 'plateau',
            },
          ]
        : [{ label: `Ladder at ${Math.round(result?.ladder.progressPct ?? 0)}%`, source: 'ladder' }],
    });
  }

  // Last in the list, first in importance to the learner: this is the only
  // trigger the learner can raise themselves, and PAL has never had one.
  if (signals.learnerRaised) {
    triggers.push({
      kind: 'learner_raised',
      summary: 'The learner has asked for help with this.',
      severity: 'medium',
      ruleId: null,
      evidence: [{ label: 'Raised by the learner', source: 'learner' }],
    });
  }

  const rank: Record<InterventionSeverity, number> = { high: 0, medium: 1, low: 2 };
  return triggers.sort((a, b) => rank[a.severity] - rank[b.severity]);
}

/**
 * Is this enough to put a person in the loop?
 *
 * A single medium signal is a flag on the queue, not an escalation. Escalating
 * on one would flood the queue, and a queue nobody reads protects nobody.
 */
export function shouldEscalate(triggers: readonly InterventionTrigger[]): boolean {
  return triggers.some((trigger) => trigger.severity === 'high') || triggers.length >= 2;
}

export function highestSeverity(
  triggers: readonly InterventionTrigger[]
): InterventionSeverity | null {
  if (triggers.length === 0) return null;
  if (triggers.some((trigger) => trigger.severity === 'high')) return 'high';
  if (triggers.some((trigger) => trigger.severity === 'medium')) return 'medium';
  return 'low';
}

/** Map a trigger set onto the record's risk_level vocabulary. */
export function triggerRiskLevel(
  triggers: readonly InterventionTrigger[]
): 'low' | 'medium' | 'high' {
  return highestSeverity(triggers) ?? 'low';
}

export const TRIGGER_LABELS: Record<InterventionTriggerKind, string> = {
  repeated_remediation: 'Repeated repair',
  persistent_misconception: 'Mix-up keeps returning',
  failed_checks: 'Check not passed',
  risk_signal: 'Risk signal',
  flat_progress: 'No movement',
  learner_raised: 'Learner asked for help',
};

// ---------------------------------------------------------------------------
// The transport half. None of these routes exist in Laravel yet.
// ---------------------------------------------------------------------------

/**
 * Deliberately MIRRORS RecommendationRecord (lib/intelligence/types.ts).
 *
 * The Intelligence layer already has a governance vocabulary - status,
 * risk_level, requires_approval, governance_passed, rationale, evidence_ids -
 * and it is the one the approval screens, the audit trail and BR-07 are
 * written against. A second vocabulary for the same idea (a proposed action
 * against a learner, awaiting a human) would mean two audit stories for one
 * escalation, and the one a regulator asked to see would be whichever was
 * worse. Fields RecommendationRecord carries that a support case does not
 * (case_id, eso_binding, workflow_key, confidence) are simply absent here;
 * nothing is renamed.
 */
export type InterventionStatus = RecommendationStatus;

export interface InterventionNote {
  id: number;
  author_id: string;
  author_name: string | null;
  /** 'staff' | 'learner'. A learner may add a note, never edit or delete one. */
  author_role: string;
  body: string;
  created_at: string | null;
}

export interface InterventionRecord {
  id: number;
  reference: string;
  learner_id: string;
  learner_name: string | null;
  concept_id: number | null;
  concept_name: string | null;
  chapter_id: number | null;
  trigger_kind: InterventionTriggerKind;
  title: string;
  body: string | null;
  rationale: string | null;
  risk_level: 'low' | 'medium' | 'high';
  requires_approval: boolean;
  governance_passed: boolean;
  governance_report: GovernanceReport | null;
  evidence_ids: number[];
  status: InterventionStatus;
  assigned_to: string | null;
  assigned_to_name: string | null;
  opened_at: string | null;
  closed_at: string | null;
  closed_outcome: InterventionOutcome | null;
  notes: InterventionNote[];
}

export type InterventionOutcome = 'resolved' | 'escalated' | 'dismissed';

/**
 * Whether the backend is there.
 *
 * `readOnly` is NOT a permission. It means "this feature has no write route on
 * this server yet". The queue still renders - every trigger below is derived
 * client-side from data that does exist - but each control that would write is
 * disabled with this message beside it, rather than throwing a red error at a
 * teacher for a route nobody has deployed.
 */
export interface InterventionAccess {
  live: boolean;
  readOnly: boolean;
  message: string | null;
}

export interface InterventionQueue {
  access: InterventionAccess;
  records: InterventionRecord[];
}

export interface InterventionScope {
  learnerId?: string;
  conceptId?: string;
  /** 'open' is the server-side shorthand for "anything not closed". */
  status?: InterventionStatus | 'open';
}

const NOT_DEPLOYED =
  'Support cases cannot be saved on this server yet - the PAL intervention API has not been deployed. Everything below is derived from data that is already here, and nothing on this screen will be recorded.';

const LIVE: InterventionAccess = { live: true, readOnly: false, message: null };
const OFFLINE: InterventionAccess = { live: false, readOnly: true, message: NOT_DEPLOYED };

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function toArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function readNullableString(value: unknown): string | null {
  if (value == null) return null;
  const text = readString(value);
  return text === '' ? null : text;
}

type Fetched = { missing: true; data: null } | { missing: false; data: unknown };

/**
 * One request, with 404 reserved for "not deployed".
 *
 * This is why the endpoint contract insists the server answers 200 with an
 * empty list when there are no cases: a 404 meaning "none" would put the whole
 * screen into read-only for a teacher whose caseload simply happens to be
 * clear.
 */
async function interventionFetch(path: string, init?: RequestInit): Promise<Fetched> {
  const session = buildSessionContext();
  if (!session.baseUrl) throw new Error('Session data is missing. Please sign in again.');
  if (!session.token) throw new Error('Your session has expired. Please sign in again.');

  const response = await fetch(`${session.baseUrl}/${path.replace(/^\//, '')}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      Authorization: `Bearer ${session.token}`,
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  });

  if (response.status === 404) return { missing: true, data: null };

  const text = await response.text();
  let payload: unknown = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const record = toRecord(payload);
    const message = readString(record.message);
    if (response.status === 401) {
      throw new Error(message || 'Your session has expired. Please sign in again.');
    }
    if (response.status === 403) {
      throw new Error(message || 'You are not allowed to view this support case.');
    }
    throw new Error(message || `HTTP ${response.status}: support cases are unavailable.`);
  }

  const record = toRecord(payload);
  if (record.success === false) {
    throw new Error(readString(record.message) || 'The request could not be completed.');
  }
  return { missing: false, data: 'data' in record ? record.data : payload };
}

function readNote(value: unknown): InterventionNote {
  const row = toRecord(value);
  return {
    id: readNumber(row.id),
    author_id: readString(row.author_id),
    author_name: readNullableString(row.author_name),
    author_role: readString(row.author_role) || 'staff',
    body: readString(row.body),
    created_at: readNullableString(row.created_at),
  };
}

function readRisk(value: unknown): 'low' | 'medium' | 'high' {
  const level = readString(value).toLowerCase();
  return level === 'high' || level === 'medium' ? level : 'low';
}

function readRecord(value: unknown): InterventionRecord {
  const row = toRecord(value);
  return {
    id: readNumber(row.id),
    reference: readString(row.reference),
    learner_id: readString(row.learner_id),
    learner_name: readNullableString(row.learner_name),
    concept_id: row.concept_id == null ? null : readNumber(row.concept_id),
    concept_name: readNullableString(row.concept_name),
    chapter_id: row.chapter_id == null ? null : readNumber(row.chapter_id),
    trigger_kind: (readString(row.trigger_kind) || 'risk_signal') as InterventionTriggerKind,
    title: readString(row.title),
    body: readNullableString(row.body),
    rationale: readNullableString(row.rationale),
    risk_level: readRisk(row.risk_level),
    requires_approval: row.requires_approval === true,
    governance_passed: row.governance_passed === true,
    governance_report: (row.governance_report as GovernanceReport | null) ?? null,
    evidence_ids: toArray(row.evidence_ids).map((entry) => readNumber(entry)),
    status: (readString(row.status) || 'draft') as InterventionStatus,
    assigned_to: readNullableString(row.assigned_to),
    assigned_to_name: readNullableString(row.assigned_to_name),
    opened_at: readNullableString(row.opened_at),
    closed_at: readNullableString(row.closed_at),
    closed_outcome: (readNullableString(row.closed_outcome) as InterventionOutcome | null) ?? null,
    notes: toArray(row.notes).map(readNote),
  };
}

/**
 * GET /api/pal/intervention
 *
 * A student may only ever ask for their own; the server enforces that, and a
 * 403 here is a real error rather than a degradation.
 */
export async function fetchInterventions(
  scope: InterventionScope,
  signal?: AbortSignal
): Promise<InterventionQueue> {
  const query = new URLSearchParams();
  if (scope.learnerId) query.set('learner_id', scope.learnerId);
  if (scope.conceptId) query.set('concept_id', scope.conceptId);
  if (scope.status) query.set('status', scope.status);

  const suffix = query.toString() ? `?${query.toString()}` : '';
  const outcome = await interventionFetch(`api/pal/intervention${suffix}`, { signal });

  if (outcome.missing) return { access: OFFLINE, records: [] };

  const data = toRecord(outcome.data);
  const rows = Array.isArray(data.records) ? data.records : toArray(outcome.data);
  return { access: LIVE, records: rows.map(readRecord) };
}

export interface OpenInterventionInput {
  learnerId: string;
  conceptId?: string | null;
  chapterId?: string | null;
  triggerKind: InterventionTriggerKind;
  title: string;
  rationale?: string | null;
  riskLevel: 'low' | 'medium' | 'high';
  evidenceIds?: number[];
}

/**
 * POST /api/pal/intervention
 *
 * Returns null when the route is not deployed. A null is "not written", and
 * every caller treats it as such - it must never be reported to a teacher as
 * a case they have opened.
 */
export async function openIntervention(
  input: OpenInterventionInput
): Promise<InterventionRecord | null> {
  const outcome = await interventionFetch('api/pal/intervention', {
    method: 'POST',
    body: JSON.stringify({
      learner_id: input.learnerId,
      concept_id: input.conceptId ?? null,
      chapter_id: input.chapterId ?? null,
      trigger_kind: input.triggerKind,
      title: input.title,
      rationale: input.rationale ?? null,
      risk_level: input.riskLevel,
      // BR-07: a case carrying AI-drafted wording is held for a human. The
      // server decides this too; sending it makes the intent explicit on the
      // wire rather than implicit in a controller.
      requires_approval: true,
      evidence_ids: input.evidenceIds ?? [],
    }),
  });

  if (outcome.missing) return null;
  return readRecord(toRecord(outcome.data).record ?? outcome.data);
}

/** PATCH /api/pal/intervention/{id}. Staff only; notes are append-only. */
export async function updateIntervention(
  id: number,
  patch: {
    status?: InterventionStatus;
    assignedTo?: string;
    riskLevel?: 'low' | 'medium' | 'high';
    note?: string;
  }
): Promise<InterventionRecord | null> {
  const body: Record<string, unknown> = {};
  if (patch.status) body.status = patch.status;
  if (patch.assignedTo) body.assigned_to = patch.assignedTo;
  if (patch.riskLevel) body.risk_level = patch.riskLevel;
  if (patch.note) body.note = patch.note;

  const outcome = await interventionFetch(`api/pal/intervention/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });

  if (outcome.missing) return null;
  return readRecord(toRecord(outcome.data).record ?? outcome.data);
}

/**
 * POST /api/pal/intervention/{id}/close
 *
 * `note` is required by the contract, not optional: a case closed with no
 * reason recorded is not auditable, and the reason is the only part of this
 * whole flow that a parent meeting can actually be shown.
 */
export async function closeIntervention(
  id: number,
  input: { outcome: InterventionOutcome; note: string }
): Promise<InterventionRecord | null> {
  const outcome = await interventionFetch(`api/pal/intervention/${id}/close`, {
    method: 'POST',
    body: JSON.stringify({ outcome: input.outcome, note: input.note }),
  });

  if (outcome.missing) return null;
  return readRecord(toRecord(outcome.data).record ?? outcome.data);
}

/** Statuses that mean the case is still somebody's to deal with. */
export function isOpenStatus(status: InterventionStatus): boolean {
  return status !== 'rejected' && status !== 'superseded' && status !== 'expired';
}
