'use client';

import { API_BASE_URL } from '@/app/components/utils/api_url';
import { readSelectedAcademicYear } from '@/lib/academic-year';

/**
 * Where the Enterprise Brain API lives.
 *
 * THIS IS NOT ALWAYS THE LMS API HOST, AND THAT IS THE POINT. The LMS front end
 * talks to whichever deployment NEXT_PUBLIC_API_BASE_URL_DEV names, and the
 * Brain route table (`/api/brain/*`, mounted by next_lms_erp's
 * RouteServiceProvider) only exists where the Brain backend has been deployed.
 * Pointing Brain requests at a host without those routes is what produced
 * "Brain request failed 404" — the LMS host answered, it simply had no such
 * route. NEXT_PUBLIC_BRAIN_API_BASE_URL names the host that does; it falls back
 * to the LMS host for deployments where the two are the same.
 */
export const BRAIN_API_BASE_URL: string =
  (process.env.NEXT_PUBLIC_BRAIN_API_BASE_URL || '').trim().replace(/\/$/, '') || API_BASE_URL;

export interface BrainSession {
  tenantId: string;
  token: string;
  userId: string;
  /** The `syear` the LMS header has selected; '' when it has not resolved yet. */
  syear: string;
}

export class BrainApiError extends Error {
  readonly status: number;
  readonly url: string;
  readonly payload: unknown;

  constructor(message: string, status: number, url: string, payload: unknown) {
    super(message);
    this.name = 'BrainApiError';
    this.status = status;
    this.url = url;
    this.payload = payload;
  }
}

/**
 * The Brain has no login of its own: it reuses the LMS session verbatim.
 *
 * The academic year comes from the LMS header's own selection, not from
 * anything the Brain keeps — there is one year switcher in this product and
 * this is the value it stores. It is a request PARAMETER, never an identity:
 * the tenant still comes from the signed token, and the API validates the year
 * against that institute's own `academic_year` rows before using it.
 */
export function getBrainSession(): BrainSession | null {
  if (typeof window === 'undefined') return null;

  try {
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    const menuContext = JSON.parse(localStorage.getItem('menuContext') || '{}');
    const token = String(userData.user_token || userData.token || '');
    const tenantId = String(userData.sub_institute_id ?? menuContext.sub_institute_id ?? '');
    const userId = String(userData.id ?? menuContext.user_id ?? '');
    // Falls back to the syear the session was issued with, exactly as the fees
    // and exam clients do, so a first paint before the header has resolved still
    // asks for a real year rather than none.
    const syear = String(readSelectedAcademicYear() || userData.syear || menuContext.syear || '');

    if (!token || !tenantId) return null;
    return { token, tenantId, userId, syear };
  } catch {
    return null;
  }
}

export function getBrainTenantId(): string {
  return getBrainSession()?.tenantId ?? '';
}

/**
 * Add `syear` to a URL that may already carry a query string.
 *
 * A caller that has set `syear` itself wins — nothing does today, but a screen
 * that wants to compare two years should not have to fight the session.
 */
function withSyear(url: string, syear: string): string {
  if (!syear) return url;

  const [base, query = ''] = url.split('?');
  const params = new URLSearchParams(query);
  if (!params.get('syear')) params.set('syear', syear);

  return `${base}?${params.toString()}`;
}

export async function brainFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const session = getBrainSession();
  if (!session) {
    throw new BrainApiError('Brain session is unavailable. Please sign in again.', 401, path, null);
  }

  // The year rides on EVERY Brain request rather than being threaded through
  // the twenty-odd fetchers by hand. The backend applies it only where the LMS
  // itself is year-scoped (attendance, homework, fees, marks, the student roll)
  // and ignores it for master data like departments and people, so sending it
  // uniformly cannot make a foundation screen go empty — and no year-sensitive
  // endpoint can be forgotten.
  const url = withSyear(`${BRAIN_API_BASE_URL}/api/brain${path}`, session.syear);
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.token}`,
        ...(init?.headers || {}),
      },
    });
  } catch (cause) {
    throw new BrainApiError(
      `Could not reach the Brain API at ${BRAIN_API_BASE_URL}. ${cause instanceof Error ? cause.message : ''}`.trim(),
      0,
      url,
      null,
    );
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = (data as Record<string, unknown>)?.message ?? (data as Record<string, unknown>)?.error;
    throw new BrainApiError(
      typeof detail === 'string' ? describe(detail, res.status, url) : `Brain request failed with ${res.status} (${url})`,
      res.status,
      url,
      data,
    );
  }

  return data as T;
}

/** Turns the API's machine codes into something an administrator can act on. */
function describe(code: string, status: number, url: string): string {
  switch (code) {
    case 'brain_unauthenticated':
      return 'Not signed in to the Brain — the LMS session carried no token.';
    case 'brain_invalid_token':
      return `The LMS session token was rejected by the Brain API at ${BRAIN_API_BASE_URL}. Its JWT secret must match the host that issued this login.`;
    case 'brain_token_expired':
      return 'The LMS session has expired. Please sign in again.';
    case 'brain_tenant_mismatch':
      return 'This Brain workspace belongs to another organization.';
    case 'brain_forbidden':
      return 'Your LMS role does not grant this Brain permission.';
    case 'brain_schema_missing':
      return 'The Brain store for this screen has not been provisioned in this database.';
    default:
      return `${code} (${status} — ${url})`;
  }
}

/** Prefixes a Brain path with the tenant taken from the LMS session. */
export function tenantPath(path: string) {
  const session = getBrainSession();
  if (!session) throw new BrainApiError('Brain session is unavailable. Please sign in again.', 401, path, null);
  return `/${session.tenantId}${path}`;
}

export function withQuery(path: string, params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') search.set(key, String(value));
  });
  const query = search.toString();
  return query ? `${path}?${query}` : path;
}

/* ------------------------------------------------------------------ shapes */

export type BrainRow = Record<string, unknown>;

export interface BrainMetric {
  key: string;
  label: string;
  value: number;
  available: boolean;
  table?: string;
}

export interface BrainPanel {
  key: string;
  title: string;
  table: string;
  available: boolean;
  count: number;
  columns: Array<{ key: string; label: string }>;
  rows: BrainRow[];
}

export interface BrainBreakdown {
  key: string;
  title: string;
  available: boolean;
  data: Array<{ label: string; value: number }>;
}

export interface BrainSeries {
  key: string;
  title: string;
  available: boolean;
  points: Array<{ label: string; value: number; at: string }>;
}

export interface BrainScreenPayload {
  screen: string;
  title: string;
  section: string;
  sectionLabel: string;
  description: string;
  tenantId: string;
  metrics: BrainMetric[];
  panels: BrainPanel[];
  breakdowns: BrainBreakdown[];
  series: BrainSeries[];
}

export interface BrainSectionPayload {
  section: string;
  label: string;
  tenantId: string;
  screens: Array<{ key: string; title: string; description: string; metrics: BrainMetric[] }>;
}

export function fetchScreen(screen: string, search?: string) {
  return brainFetch<BrainScreenPayload>(withQuery(tenantPath(`/screens/${screen}`), { q: search }));
}

export function fetchSection(section: string) {
  return brainFetch<BrainSectionPayload>(tenantPath(`/sections/${section}`));
}

/* ------------------------------------------------- intelligence loop shapes */

export interface BrainCause {
  family: string;
  confidence: number;
  hypothesis: string;
  action: string;
  category: string;
}

export interface BrainSignal extends BrainRow {
  id: string;
  rule_key: string | null;
  classification: string;
  source: string;
  severity: string;
  priority: string;
  status: string;
  confidence: string | number;
  created_date: string;
  title: string;
  affectedCount: number | null;
  totalCount: number | null;
  share: number | null;
  cause: BrainCause | null;
}

export interface BrainStage {
  key: string;
  label: string;
  table: string;
  count: number;
  available: boolean;
}

export interface BrainRuleStatus {
  rule: string;
  family: string;
  category: string;
  action: string;
  firing: boolean;
  severity: string | null;
  status: string | null;
  title: string | null;
  affectedCount: number | null;
  totalCount: number | null;
  raisedAt: string | null;
}

export interface BrainIntelligencePayload {
  tenantId: string;
  source: string;
  stages: BrainStage[];
  signalsBySeverity: Array<{ label: string; value: number }>;
  signalsByClassification: Array<{ label: string; value: number }>;
  rootCauseFamilies: Array<{ label: string; value: number }>;
  recommendationsByCategory: Array<{ label: string; value: number }>;
  rules: BrainRuleStatus[];
  lastRun: { at: string; changes: Record<string, unknown> } | null;
  signals: BrainFinding[];
}

export interface BrainSignalDetail {
  signal: BrainFinding;
  evidence: BrainRow[];
  case: BrainRow | null;
  hypothesis: BrainRow | null;
  reasoning: BrainRow[];
  recommendations: BrainRow[];
  rule: BrainCause | null;
}

export interface BrainRecommendation extends BrainRow {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  urgency: string;
  confidence: string | number;
  impact: string | null;
  status: string;
  eso_id: string | null;
  eso_code: string | null;
  decision: BrainRow | null;
}

/** A labelled magnitude — the shape every chart in the Brain consumes. */
export interface BrainPoint {
  label: string;
  value: number;
  [extra: string]: unknown;
}

export interface BrainAnalyticsPayload {
  tenantId: string;
  generatedAt: string;
  source: string;
  headline: BrainMetric[];
  organization: { staffByDepartment: BrainPoint[]; departmentCompleteness: BrainPoint[] };
  people: { byGender: BrainPoint[]; byStatus: BrainPoint[]; recordCompleteness: BrainPoint[] };
  students: { byGender: BrainPoint[]; byAdmissionYear: BrainPoint[]; recordCompleteness: BrainPoint[] };
  attendance: { studentByCode?: BrainPoint[]; studentMonthlyTrend?: BrainPoint[]; staffMonthlyTrend?: BrainPoint[] };
  academics: { bySubject?: BrainPoint[]; byGrade?: BrainPoint[]; attainmentBands?: BrainPoint[]; homeworkCompletion?: BrainPoint[] };
  finance: { totals?: BrainPoint[]; byPaymentMode?: BrainPoint[]; monthlyTrend?: BrainPoint[] };
  intelligence: Record<string, BrainPoint[]>;
}

export interface BrainKnowledgePayload {
  tenantId: string;
  metrics: BrainMetric[];
  assets: BrainRow[];
  mentalModels: BrainRow[];
  byCategory: BrainPoint[];
}

export interface BrainAutomationPayload {
  tenantId: string;
  metrics: BrainMetric[];
  esos: BrainRow[];
  policies: BrainRow[];
  decisions: BrainRow[];
  executions: BrainRow[];
  outcomes: BrainRow[];
}

export interface BrainStudentsPayload {
  total: number;
  available: boolean;
  signals: BrainFinding[];
  analytics: { byGender?: BrainPoint[]; byAdmissionYear?: BrainPoint[]; recordCompleteness?: BrainPoint[] };
  data: BrainRow[];
}

export const fetchIntelligence = () => brainFetch<BrainIntelligencePayload>(tenantPath('/intelligence'));
export const runIntelligence = () =>
  brainFetch<Record<string, unknown>>(tenantPath('/intelligence/run'), { method: 'POST' });
export const fetchSignalDetail = (id: string) => brainFetch<BrainSignalDetail>(tenantPath(`/signals/${id}`));
export const fetchAnalytics = () => brainFetch<BrainAnalyticsPayload>(tenantPath('/analytics'));
export const fetchKnowledge = (q?: string) =>
  brainFetch<BrainKnowledgePayload>(withQuery(tenantPath('/knowledge'), { q }));
export const fetchAutomation = () => brainFetch<BrainAutomationPayload>(tenantPath('/automation'));
export const fetchStudents = (q?: string) =>
  brainFetch<BrainStudentsPayload>(withQuery(tenantPath('/students'), { q }));

export const fetchRecommendations = (filters: Record<string, string | undefined> = {}) =>
  brainFetch<{
    total: number;
    categories: BrainPoint[];
    statuses: BrainPoint[];
    priorities: BrainPoint[];
    data: BrainRecommendation[];
  }>(withQuery(tenantPath('/recommendations'), filters));

export const decideRecommendation = (id: string, status: string, rationale: string) =>
  brainFetch<{ decisionId: string; executionId: string | null; status: string }>(
    tenantPath(`/recommendations/${id}/decide`),
    { method: 'POST', body: JSON.stringify({ status, rationale }) },
  );

export const completeExecution = (id: string, result: string, feedback: string) =>
  brainFetch<{ executionId: string; outcomeId: string | null; result: string }>(
    tenantPath(`/executions/${id}/complete`),
    { method: 'POST', body: JSON.stringify({ result, feedback }) },
  );

/* -------------------------------------------- readable intelligence shapes */

/** A signal as a person reads it. `technical` holds the engine's own vocabulary. */
export interface BrainFinding {
  id: string;
  severity: string;
  severityLabel: string;
  title: string;
  headline: {
    value: string;
    label: string;
    change: number | null;
    changeLabel: string | null;
    direction: string;
  } | null;
  whatHappened: string;
  whyItMatters: string | null;
  evidence: Array<{ label: string; value: string; note?: string }>;
  likelyCause: string | null;
  causeConfirmed: boolean;
  recommendation: string | null;
  owner: string;
  priority: string;
  confidence: { band: string; value: number };
  affected: { count: number | null; total: number | null; unit: string | null };
  raisedAt: string;
  technical: Record<string, unknown>;
}

export interface BrainHealthDimension {
  key: string;
  label: string;
  available: boolean;
  score: number | null;
  band: string | null;
  headline: string | null;
  change: number | null;
  changeLabel: string | null;
  why: string;
  formula: string | null;
  drivers: Array<{ label: string; value: string }>;
  action: string | null;
}

export interface BrainExecutivePayload {
  tenantId: string;
  organization: string;
  generatedAt: string;
  /** When the rules last ran; null if the pipeline has never run for this tenant. */
  findingsRefreshedAt: string | null;
  academicYear: {
    label: string;
    title: string | null;
    shortName: string | null;
    syear: string | null;
    startDate: string | null;
    endDate: string | null;
  };
  summary: {
    foundation: {
      departments: number;
      people: number;
      students: number;
      capabilities: number;
    };
    brain: {
      signals: number;
      evidence: number;
      recommendations: number;
      decisions: number;
      executions: number;
      outcomes: number;
    };
  };
  health: {
    overall: { score: number | null; band: string | null; scoredDimensions: number; totalDimensions: number; formula: string; why: string };
    dimensions: BrainHealthDimension[];
  };
  topFindings: BrainFinding[];
  whatChanged: Array<{
    key: string;
    label: string;
    available: boolean;
    value?: string;
    change?: number;
    unit?: string;
    direction?: string;
    note?: string;
  }>;
  atRisk: {
    classes: Array<{ id: string; name: string; value: string; gap: number; baseline: number; students: number; note: string }>;
    students: Array<{ id: string; name: string; enrollmentNo: string; value: string; note: string }>;
    departments: Array<{ id: string; name: string; value: string; note: string; headcount: number }>;
  };
  actions: Array<{ action: string; owner: string; priority: string; confidence: string; because: string[] }>;
  counts: { openFindings: number; high: number; awaitingDecision: number };
  loop: Array<{ key: string; label: string; count: number; available: boolean }>;
  intelligence: {
    strengths: Array<{ dimension: string; score: number; band: string; why: string; headline?: string }>;
    risks: Array<{
      type: 'dimension' | 'signal';
      dimension?: string;
      score?: number;
      band?: string;
      why?: string;
      action?: string;
      headline?: string;
      signalId?: string;
      title?: string;
      severity: string;
      whyItMatters?: string;
      evidence?: Array<{ label: string; value: string; note?: string }>;
      recommendation?: string;
      owner?: string;
      affected?: { count: number | null; total: number | null; unit: string | null };
    }>;
    opportunities: Array<{ dimension: string; score: number; band: string; why: string; action?: string; headline?: string }>;
    recommendedFocus: {
      action: string;
      owner: string;
      priority: string;
      confidence: string;
      because: string[];
      expectedBenefit: string;
    } | null;
  };
  ingestion: {
    available: boolean;
    inventory: Array<{ scope: string; label: string; source: string; sourceCount: number; target: string; targetCount: number }>;
  };
  graph: {
    available: boolean;
    roots: Array<{ type: string; label: string; count: number }>;
    organization: {
      available: boolean;
      node?: { type: string; label: string; metrics: Array<{ label: string; value: string }> };
      edges?: Array<{ label: string; targetType: string; total: number; shown: number; nodes: Array<{ type: string; label: string; metrics: Array<{ label: string; value: string }> }> }>;
      signals?: BrainFinding[];
    };
  };
  evidence: Array<{
    signalTitle: string;
    severity: string;
    whatHappened: string;
    whyItMatters?: string;
    recommendation?: string;
    affected?: { count: number | null; total: number | null; unit: string | null };
    evidence: Array<{ label: string; value: string; note?: string }>;
  }>;
}

export interface BrainStudentProfile {
  available: boolean;
  reason?: string;
  id: string;
  name: string;
  enrollmentNo: string;
  admissionYear: number | null;
  gender: string;
  risk: string;
  summary: string;
  metrics: Array<{ key: string; label: string; value: string; change: number | null; changeLabel: string | null; band?: string }>;
  evidence: Array<{ label: string; value: string; note?: string }>;
  strengths: Array<{ label: string; value: string }>;
  weaknesses: Array<{ label: string; value: string }>;
  risks: Array<{ label: string; severity: string; detail: string }>;
  recommendations: string[];
  dataGaps: string[];
}

export interface BrainClassIntelligence {
  available: boolean;
  reason: string | null;
  baseline: number;
  marks: number;
  classes: Array<{
    id: string; name: string; attendanceRate: number; baseline: number; gapPoints: number;
    students: number; absences: number; marks: number; band: string;
    risks: string[]; summary: string; action: string | null;
  }>;
}

export interface BrainDepartmentIntelligence {
  available: boolean;
  reason: string | null;
  note: string;
  departments: Array<{
    id: string; name: string; headcount: number; head: string | null; hasRemit: boolean;
    inactive: number; neverSignedIn: number; score: number; band: string;
    risks: Array<{ label: string; severity: string }>;
    summary: string; action: string | null; formula: string;
  }>;
}

export interface BrainTeacherIntelligence {
  available: boolean;
  reason?: string;
  teachers: Array<{
    id: string; name: string; email: string; observations: number; sufficientEvidence: boolean; summary: string;
    metrics: Array<{ key: string; label: string; value: string; band?: string }>;
    evidence: Array<{ label: string; value: string }>;
  }>;
  coverage?: { attributedMarks: number; totalMarks: number; sharePercent: number; note: string | null };
}

export interface BrainGraphNode {
  type: string;
  id: string;
  label: string;
  degree: number;
  metrics: Array<{ label: string; value: string }>;
}

export interface BrainGraphPayload {
  available: boolean;
  reason?: string;
  roots?: Array<{ type: string; label: string; count: number }>;
  organization?: BrainGraphExpansion;
  type?: string;
  nodes?: BrainGraphNode[];
}

export interface BrainGraphExpansion {
  available: boolean;
  reason?: string;
  node?: BrainGraphNode;
  edges?: Array<{ label: string; targetType: string; total: number; shown: number; nodes: BrainGraphNode[] }>;
  signals?: BrainFinding[];
  intelligence?: BrainStudentProfile;
}

export const fetchExecutive = () => brainFetch<BrainExecutivePayload>(tenantPath('/executive'));
export const fetchStudentProfile = (id: string) =>
  brainFetch<BrainStudentProfile>(tenantPath(`/intelligence/students/${id}`));
export const fetchClassIntelligence = () => brainFetch<BrainClassIntelligence>(tenantPath('/intelligence/classes'));
export const fetchDepartmentIntelligence = () =>
  brainFetch<BrainDepartmentIntelligence>(tenantPath('/intelligence/departments'));
export const fetchTeacherIntelligence = () => brainFetch<BrainTeacherIntelligence>(tenantPath('/intelligence/teachers'));

export const fetchGraph = (params: { type?: string; id?: string; q?: string } = {}) =>
  brainFetch<BrainGraphPayload & BrainGraphExpansion>(withQuery(tenantPath('/graph'), params));
