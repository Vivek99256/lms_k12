import { readGraphSession } from '@/app/_components/graph/graph-session';
import { resolveAiBaseUrl } from '@/app/components/utils/api_url';

/**
 * Client for the Fees "Recommendation" panel.
 *
 * Deliberately a small local client rather than an addition to
 * `lib/intelligence/client.ts` or `lib/intelligence/workspace.ts`: this is a
 * strictly graph-only read (`FeesGraphRecommendationController`, no SQL
 * fallback), kept isolated from the Knowledge Graph browser's own client and
 * from the SQL-based Fees Intelligence ("Enterprise Brain") contract so
 * neither can accidentally start sharing a code path with this one.
 */

export interface FeesRecommendationCard {
  id: string;
  title: string;
  category: string;
  severity: string;
  available: boolean;
  reason: string | null;
  evidence: Record<string, unknown>;
}

export interface FeesRecommendationPayload {
  generated_at: string;
  syear: string;
  sub_institute_id: number;
  cards: FeesRecommendationCard[];
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  if (!text.trim()) return {};

  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error('The recommendation API returned a non-JSON response.');
  }
}

function sessionHeaders(session: ReturnType<typeof readGraphSession>): Record<string, string> {
  return {
    Accept: 'application/json',
    ...(session.token ? { Authorization: `Bearer ${session.token}` } : {}),
    ...(session.instituteId != null && `${session.instituteId}`.trim()
      ? { 'X-MCP-Institute-Id': String(session.instituteId) }
      : {}),
  };
}

export async function fetchFeesRecommendations(syear: string): Promise<FeesRecommendationPayload> {
  const session = readGraphSession();
  const baseUrl = resolveAiBaseUrl(session.baseUrl);

  if (!baseUrl) {
    throw new Error('The intelligence API base URL is not configured.');
  }

  const params = new URLSearchParams({ syear });

  const response = await fetch(`${baseUrl}/api/ai/knowledge-graph/fees/recommendations?${params.toString()}`, {
    cache: 'no-store',
    headers: sessionHeaders(session),
  });

  const payload = (await readJson(response)) as {
    success?: boolean;
    message?: string;
    data?: FeesRecommendationPayload;
  };

  if (!response.ok || payload.success === false) {
    throw new Error(payload.message || 'The Fees recommendation request failed.');
  }

  if (!payload.data) {
    throw new Error('The Fees recommendation request returned no data.');
  }

  return payload.data;
}

/* --------------------------------------------- five-capability aggregator */

/**
 * The five-capability aggregator (`FeesRecommendationIntelligenceController`).
 * `cross_module`/`graph_reasoning`/`predictive` carry the same honesty-ladder
 * card shape as `FeesRecommendationCard` above, so they reuse `toDisplayCard`
 * and `FeesRecommendationCardView` rather than a second card renderer.
 * `recommendation` and `agentic` have their own shapes — a ranked pick and an
 * operational state, not a list of findings — so they get their own small
 * display components (see `intelligence-sections.tsx`).
 */
export interface FeesEvidenceRecord {
  id: number;
  summary: string | null;
  source: string | null;
  verified: boolean;
  is_generated: boolean;
}

export interface FeesNextBestActionPick {
  source: 'recommendation' | 'case';
  id: number;
  title: string;
  risk_level: string | null;
  confidence: number | null;
  evidence_ids: number[];
  evidence_records?: FeesEvidenceRecord[];
  recommendation_id: number | null;
  workflow_key: string | null;
  requires_approval: boolean | null;
  status: string;
}

export interface FeesAgentState {
  agent_key: string;
  is_active: boolean;
  status: string;
  interval_seconds: number;
  last_run_time: string | null;
  last_run_status: string | null;
  next_scheduled_run: string | null;
  counts: {
    students_with_arrears: number;
    students_with_worsening_trend: number;
    recommendations_drafted: number;
  };
}

export interface FeesRecommendationIntelligencePayload {
  generated_at: string;
  syear: string;
  sub_institute_id: number;
  capabilities: {
    cross_module: { available: boolean; reason: string | null; cards: FeesRecommendationCard[] };
    graph_reasoning: { available: boolean; reason: string | null; cards: FeesRecommendationCard[] };
    predictive: { available: boolean; reason: string | null; cards: FeesRecommendationCard[] };
    recommendation: { available: boolean; reason: string | null; top_pick: FeesNextBestActionPick | null };
    agentic: {
      available: boolean;
      reason: string | null;
      agent_state: FeesAgentState;
      pending_approvals_count: number;
    };
  };
}

/* --------------------------------------------- agentic operational control */

/**
 * `/api/ai/fees/agent/*` — operational control over the two governed Fees
 * agents (FeesAgentController). `start`/`stop`/`interval`/`run-now`/
 * `pipeline` are admin-only on the backend (AdministratorCheck); a non-admin
 * staff caller gets a 403 with the backend's own message, surfaced as-is
 * rather than a generic "failed" string.
 */
async function postFeesAgent(path: string, body: Record<string, unknown> = {}): Promise<{ state: FeesAgentState }> {
  const session = readGraphSession();
  const baseUrl = resolveAiBaseUrl(session.baseUrl);

  if (!baseUrl) {
    throw new Error('The intelligence API base URL is not configured.');
  }

  const response = await fetch(`${baseUrl}/api/ai/fees/agent/${path}`, {
    method: 'POST',
    cache: 'no-store',
    headers: { ...sessionHeaders(session), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const payload = (await readJson(response)) as {
    success?: boolean;
    message?: string;
    data?: { state: FeesAgentState };
  };

  if (!response.ok || payload.success === false) {
    throw new Error(payload.message || 'The Fees agent control request failed.');
  }

  if (!payload.data) {
    throw new Error('The Fees agent control request returned no data.');
  }

  return payload.data;
}

export function startFeesAgentMonitoring(intervalSeconds: number) {
  return postFeesAgent('start', { interval_seconds: intervalSeconds });
}

export function stopFeesAgentMonitoring() {
  return postFeesAgent('stop');
}

export function runFeesAgentNow() {
  return postFeesAgent('run-now');
}

export function setFeesAgentInterval(intervalSeconds: number) {
  return postFeesAgent('interval', { interval_seconds: intervalSeconds });
}

export async function fetchFeesRecommendationIntelligence(
  syear: string,
  subjectEntityKey?: string,
  subjectId?: number,
): Promise<FeesRecommendationIntelligencePayload> {
  const session = readGraphSession();
  const baseUrl = resolveAiBaseUrl(session.baseUrl);

  if (!baseUrl) {
    throw new Error('The intelligence API base URL is not configured.');
  }

  const params = new URLSearchParams({ syear });
  if (subjectEntityKey && subjectId != null) {
    params.set('subject_entity_key', subjectEntityKey);
    params.set('subject_id', String(subjectId));
  }

  const response = await fetch(`${baseUrl}/api/ai/fees/recommendation-intelligence?${params.toString()}`, {
    cache: 'no-store',
    headers: sessionHeaders(session),
  });

  const payload = (await readJson(response)) as {
    success?: boolean;
    message?: string;
    data?: FeesRecommendationIntelligencePayload;
  };

  if (!response.ok || payload.success === false) {
    throw new Error(payload.message || 'The Fees recommendation intelligence request failed.');
  }

  if (!payload.data) {
    throw new Error('The Fees recommendation intelligence request returned no data.');
  }

  return payload.data;
}

/* ------------------------------------------------------------- display adapter */

export interface FeesRecommendationDisplayCard {
  id: string;
  title: string;
  category: string;
  severity: string;
  available: boolean;
  reason: string | null;
  description: string | null;
  impactLine: string | null;
  evidencePoints: Array<{ label: string; value: string; note?: string | null }>;
  listItems: string[];
}

const CATEGORY_LABELS: Record<string, string> = {
  fee_schedule: 'Fee schedule',
  fee_payment: 'Fee payment',
  fee_collection: 'Fee collection',
  cross_module: 'Cross-module',
  graph_reasoning: 'Graph reasoning',
  predictive: 'Predictive',
};

function fmt(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'number') return new Intl.NumberFormat('en-IN').format(value);
  return String(value);
}

/**
 * Turns one backend card into display-ready copy, per card id. Each id has a
 * different evidence shape (see `FeesGraphRecommendationEngine`), so this is
 * intentionally a switch rather than one generic formatter — a generic
 * formatter would have to guess at units the backend already named.
 */
export function toDisplayCard(card: FeesRecommendationCard): FeesRecommendationDisplayCard {
  const evidence = card.evidence ?? {};
  const description = typeof evidence.description === 'string'
    ? evidence.description
    : typeof evidence.why === 'string'
      ? evidence.why
      : null;
  const impactLine = typeof evidence.expected_impact === 'string' ? evidence.expected_impact : null;

  const evidencePoints: FeesRecommendationDisplayCard['evidencePoints'] = [];
  const listItems: string[] = [];

  // Predictive cards carry a per-student dynamic id (`fees.predictive.student.<id>`),
  // so this is a prefix check rather than a switch case alongside the fixed ids below.
  if (card.id.startsWith('fees.predictive.student.')) {
    if (evidence.projected_30d_change !== undefined) {
      evidencePoints.push({ label: 'Projected 30-day change', value: `₹${fmt(evidence.projected_30d_change)}` });
    }
    if (evidence.history_points !== undefined) {
      evidencePoints.push({ label: 'Recorded sweeps', value: fmt(evidence.history_points) });
    }
    if (evidence.first_score !== undefined && evidence.last_score !== undefined) {
      evidencePoints.push({ label: 'Balance then → now', value: `₹${fmt(evidence.first_score)} → ₹${fmt(evidence.last_score)}` });
    }
    if (evidence.confidence !== undefined) {
      evidencePoints.push({ label: 'Confidence', value: fmt(evidence.confidence) });
    }
    const recommendation = evidence.recommendation as { title?: string; status?: string } | null | undefined;
    if (recommendation?.title) {
      listItems.push(`Proactive outreach drafted: "${recommendation.title}" (${recommendation.status ?? 'pending'})`);
    }
    const evidenceRecords = Array.isArray(evidence.evidence_records)
      ? (evidence.evidence_records as Array<{ summary?: string | null; verified?: boolean }>)
      : [];
    for (const record of evidenceRecords) {
      if (record.summary) listItems.push(`Evidence: ${record.summary}`);
    }

    return {
      id: card.id,
      title: card.title,
      category: CATEGORY_LABELS[card.category] ?? card.category,
      severity: card.severity,
      available: card.available,
      reason: card.reason,
      description,
      impactLine,
      evidencePoints,
      listItems,
    };
  }

  switch (card.id) {
    case 'fees.cross_module.attendance':
      if (evidence.gap_sampled !== undefined) {
        evidencePoints.push(
          { label: 'Fee-gap students', value: fmt(evidence.gap_sampled) },
          { label: 'With attendance data', value: fmt(evidence.attendance_checked) },
          { label: 'Low attendance (≥20% absent)', value: fmt(evidence.gap_with_low_attendance) },
        );
      }
      break;

    case 'fees.cross_module.admissions':
      if (evidence.mobile_matchable !== undefined) {
        evidencePoints.push(
          { label: 'Fee-gap students, mobile on file', value: fmt(evidence.mobile_matchable) },
          { label: 'Sharing a number with an open enquiry', value: fmt(evidence.gap_with_open_enquiry) },
        );
      }
      break;

    case 'fees.transitive_nonpayment_chain': {
      const chains = Array.isArray(evidence.chains)
        ? (evidence.chains as Array<{ standard_ids: number[]; shared_fee_type_count: number }>)
        : [];
      for (const chain of chains.slice(0, 8)) {
        listItems.push(`Standards ${chain.standard_ids.join(' & ')} — share ${fmt(chain.shared_fee_type_count)} fee head(s)`);
      }
      if (chains.length > 8) listItems.push(`+${chains.length - 8} more`);
      break;
    }

    case 'fees.platform_coverage':
      evidencePoints.push(
        { label: 'Schedule lines', value: fmt(evidence.schedule_lines) },
        { label: 'Standards scheduled', value: fmt(evidence.standards_scheduled) },
        { label: 'Payments', value: fmt(evidence.payments) },
        { label: 'Paying students', value: fmt(evidence.paying_students) },
        { label: 'Enrolled students', value: fmt(evidence.enrolled_students) },
      );
      break;

    case 'fees.schedule_integrity': {
      if (evidence.standards_total !== undefined) {
        evidencePoints.push({ label: 'Standards checked', value: fmt(evidence.standards_total) });
      }
      const gaps = Array.isArray(evidence.gaps) ? (evidence.gaps as Array<{ standard_id: number; name: string | null }>) : [];
      if (gaps.length > 0) {
        evidencePoints.push({ label: 'Standards missing a schedule', value: fmt(gaps.length) });
        for (const gap of gaps.slice(0, 8)) {
          listItems.push(`${gap.name ?? `Standard ${gap.standard_id}`} — no fee schedule for this year`);
        }
        if (gaps.length > 8) listItems.push(`+${gaps.length - 8} more`);
      }
      const conflicts = Array.isArray(evidence.conflicts) ? evidence.conflicts : [];
      if (conflicts.length > 0) {
        evidencePoints.push({ label: 'Conflicting schedule lines', value: fmt(conflicts.length) });
      }
      break;
    }

    case 'fees.unlinked_payments': {
      if (evidence.total_payments !== undefined) {
        evidencePoints.push({ label: 'Total payments', value: fmt(evidence.total_payments) });
      }
      const orphans = Array.isArray(evidence.orphans)
        ? (evidence.orphans as Array<{ receipt_no: string | null; amount: number; student_id: number | null }>)
        : [];
      if (orphans.length > 0) {
        evidencePoints.push({ label: 'Unlinked payments', value: fmt(orphans.length) });
        for (const orphan of orphans.slice(0, 8)) {
          listItems.push(`Receipt ${orphan.receipt_no ?? '—'} · ₹${fmt(orphan.amount)} · student ${orphan.student_id ?? '—'}`);
        }
        if (orphans.length > 8) listItems.push(`+${orphans.length - 8} more`);
      }
      break;
    }

    case 'fees.root_blocker': {
      const standards = Array.isArray(evidence.standards)
        ? (evidence.standards as Array<{ standard_id: number; name: string | null; enrolled: number; non_paying: number }>)
        : [];
      for (const standard of standards.slice(0, 8)) {
        listItems.push(
          `${standard.name ?? `Standard ${standard.standard_id}`} — ${fmt(standard.non_paying)} of ${fmt(standard.enrolled)} not paying`,
        );
      }
      if (evidence.standards_checked !== undefined) {
        evidencePoints.push({ label: 'Standards checked', value: fmt(evidence.standards_checked) });
      }
      break;
    }

    case 'fees.academic_correlation': {
      if (evidence.enrolled_total !== undefined) {
        evidencePoints.push(
          { label: 'Enrolled', value: fmt(evidence.enrolled_total) },
          { label: 'Paying', value: fmt(evidence.paying_total) },
          { label: 'Fee gap', value: fmt(evidence.gap_total) },
        );
      }
      if (evidence.gap_sampled !== undefined) {
        const sampled = Number(evidence.gap_sampled) || 0;
        const withEngagement = Number(evidence.gap_with_engagement) || 0;
        const withMastery = Number(evidence.gap_with_mastery_signal) || 0;
        evidencePoints.push(
          { label: 'Checked for signal', value: fmt(sampled) },
          { label: 'No engagement signal', value: fmt(sampled - withEngagement) },
          { label: 'No mastery signal', value: fmt(sampled - withMastery) },
        );
      }
      break;
    }

    default:
      break;
  }

  return {
    id: card.id,
    title: card.title,
    category: CATEGORY_LABELS[card.category] ?? card.category,
    severity: card.severity,
    available: card.available,
    reason: card.reason,
    description,
    impactLine,
    evidencePoints,
    listItems,
  };
}
