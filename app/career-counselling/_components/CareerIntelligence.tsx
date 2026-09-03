'use client';

import {
  useCallback, useEffect, useRef, useState, type ReactNode,
} from 'react';
import {
  AlertTriangle, BookOpen, CalendarClock, CheckCircle2, CircleAlert, ClipboardList, Compass,
  GraduationCap, Info, LoaderCircle, NotebookPen, RefreshCw, Route, Save, ShieldCheck, Sparkles,
  Target, Users,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { loadAlignment, loadCareerEvidence, loadCareerRecommendation } from '../_lib/api';
import { CAREER_EVIDENCE_STATUS_LABEL, EVIDENCE_LEVEL_LABEL, formatEventDate } from '../_lib/evidence';
import type {
  AlignmentBand, AlignmentPayload, AlignmentStatus, CareerEvidencePayload, CareerEvidenceStatus,
  CareerRecommendationPayload, EvidenceLevel,
} from '../_lib/types';

/**
 * Direct color classes (no `--primary`/`--success`/`--warning` design tokens),
 * matching how tone accents are already hardcoded elsewhere in this codebase
 * (e.g. `app/dashboard/_components/DashboardPrimitives.tsx`'s `iconToneClass`,
 * `app/organization_managment/oragnization_profile/page.tsx`'s status badges).
 */
const TONE = {
  brand: {
    icon: 'bg-indigo-50 text-[#4F46E5]',
    text: 'text-[#4F46E5]',
    badge: 'border-indigo-200 bg-indigo-50 text-[#4F46E5]',
  },
  neutral: {
    icon: 'bg-slate-100 text-slate-600',
    text: 'text-slate-600',
    badge: 'border-slate-200 bg-slate-100 text-slate-600',
  },
  success: {
    icon: 'bg-emerald-50 text-emerald-600',
    text: 'text-emerald-600',
    badge: 'border-emerald-200 bg-emerald-50 text-emerald-600',
    dot: 'bg-emerald-500',
  },
  warning: {
    icon: 'bg-amber-50 text-amber-600',
    text: 'text-amber-600',
    badge: 'border-amber-200 bg-amber-50 text-amber-700',
    dot: 'bg-amber-500',
  },
  danger: {
    icon: 'bg-red-50 text-red-600',
    text: 'text-red-600',
    badge: 'border-red-200 bg-red-50 text-red-600',
    dot: 'bg-red-500',
  },
} as const;

const LEVEL_BADGE_CLASS: Record<EvidenceLevel, string> = {
  demonstrated: TONE.success.badge,
  developing: TONE.neutral.badge,
  emerging: TONE.warning.badge,
  insufficient: 'border-slate-200 bg-white text-slate-500',
};

const RECOGNISED_ALIGNMENT_STATUSES: AlignmentStatus[] = ['ALIGNED', 'MISALIGNED', 'INSUFFICIENT_DATA'];

/**
 * Purely a display mapping for the three bands the config-driven
 * AlignmentBandClassifier (Laravel repo) can return — never a threshold or
 * scoring decision of its own. Any other string means the backend added a
 * new band without a matching UI update; render it plainly rather than
 * guessing a tone for it.
 */
const ALIGNMENT_BAND_TONE: Record<AlignmentBand, { badge: string; text: string }> = {
  'Strong Match': TONE.success,
  'Partial Match': TONE.warning,
  'Weak Match': TONE.danger,
};

function AlignmentBandBadge({ band }: { band: AlignmentBand | string }) {
  const tone = ALIGNMENT_BAND_TONE[band as AlignmentBand];
  return <Badge variant="outline" className={tone?.badge ?? TONE.neutral.badge}>{band}</Badge>;
}

type Severity = 'high' | 'medium' | 'low';

const SEVERITY_META: Record<Severity, { label: string; dot: string; text: string }> = {
  high: { label: 'High', dot: TONE.danger.dot, text: TONE.danger.text },
  medium: { label: 'Medium', dot: TONE.warning.dot, text: TONE.warning.text },
  low: { label: 'Low', dot: TONE.success.dot, text: TONE.success.text },
};

/** Deterministic bucket over `days_remaining`, same pattern as `computeCoverageStatus` — never inferred. */
function computeSeverity(daysRemaining: number | null): Severity | null {
  if (daysRemaining == null) return null;
  if (daysRemaining <= 30) return 'high';
  if (daysRemaining <= 90) return 'medium';
  return 'low';
}

function certaintyMeta(score: number | null): { label: string; value: string } | null {
  if (score == null) return null;
  const label = score >= 0.75 ? 'High' : score >= 0.45 ? 'Medium' : 'Low';
  return { label, value: score.toFixed(2) };
}

function LevelBadge({ level }: { level: EvidenceLevel }) {
  return <Badge variant="outline" className={LEVEL_BADGE_CLASS[level]}>{EVIDENCE_LEVEL_LABEL[level]}</Badge>;
}

function CenterMessage({
  icon: Icon, title, description, action,
}: {
  icon: typeof CircleAlert; title: string; description?: string; action?: ReactNode;
}) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center gap-2 text-center">
      <Icon className="size-6 text-muted-foreground" />
      <p className="text-sm font-medium">{title}</p>
      {description && <p className="max-w-md text-sm text-muted-foreground">{description}</p>}
      {action}
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: typeof CircleAlert; label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <span className="flex items-center gap-2 text-sm text-muted-foreground"><Icon className="size-4" />{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

function AlignmentBanner({ payload }: { payload: AlignmentPayload | null }) {
  const status: AlignmentStatus =
    payload && RECOGNISED_ALIGNMENT_STATUSES.includes(payload.alignment_status)
      ? payload.alignment_status
      : 'INSUFFICIENT_DATA';

  if (status === 'ALIGNED') {
    return (
      <Card className="border-emerald-200 bg-emerald-50">
        <CardContent className="flex items-center gap-3">
          <CheckCircle2 className={`size-6 shrink-0 ${TONE.success.text}`} />
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Alignment status</p>
            <p className={`text-lg font-semibold ${TONE.success.text}`}>Aligned</p>
            <p className="text-sm text-muted-foreground">The current plan can reach the stated goal.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (status === 'INSUFFICIENT_DATA') {
    return (
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="flex items-center gap-3">
          <Info className={`size-6 shrink-0 ${TONE.warning.text}`} />
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Alignment status</p>
            <p className={`text-lg font-semibold ${TONE.warning.text}`}>Insufficient data</p>
            <p className="text-sm text-muted-foreground">
              {payload?.insufficient_data_reason || 'A stated career aspiration is needed before alignment can be evaluated.'}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const breakPoint = payload?.break_point ?? null;
  const severity = computeSeverity(breakPoint?.days_remaining ?? null);

  return (
    <Card className="border-red-200 bg-red-50">
      <CardContent>
        <div className="grid gap-5 lg:grid-cols-[1.2fr_1.6fr_auto_auto]">
          <div className="flex items-center gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
              <AlertTriangle className="size-5" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Alignment status</p>
              <p className={`text-lg font-semibold ${TONE.danger.text}`}>Misaligned</p>
            </div>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Reason (misalignment codes)</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {payload?.misalignment_codes.length ? (
                payload.misalignment_codes.map((code) => (
                  <Badge key={code} variant="outline" className={`font-mono ${TONE.danger.badge}`}>{code}</Badge>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">No codes reported</span>
              )}
            </div>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Severity</p>
            {severity ? (
              <p className={`mt-1.5 flex items-center gap-2 text-sm font-medium ${SEVERITY_META[severity].text}`}>
                <span className={`size-2 rounded-full ${SEVERITY_META[severity].dot}`} />{SEVERITY_META[severity].label}
              </p>
            ) : (
              <p className="mt-1.5 text-sm text-muted-foreground">—</p>
            )}
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Deadline</p>
            {breakPoint?.deadline_date ? (
              <>
                <p className="mt-1.5 flex items-center gap-1.5 text-sm font-medium"><CalendarClock className="size-4" />{formatEventDate(breakPoint.deadline_date)}</p>
                {breakPoint.days_remaining != null && (
                  <p className={`text-xs ${SEVERITY_META[severity ?? 'low'].text}`}>{breakPoint.days_remaining} days left</p>
                )}
              </>
            ) : (
              <p className="mt-1.5 text-sm text-muted-foreground">—</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function OverviewCard({
  icon: Icon, iconClass, label, title, footer,
}: {
  icon: typeof Target; iconClass: string; label: string; title: ReactNode; footer?: ReactNode;
}) {
  return (
    <Card>
      <CardContent className="space-y-2">
        <div className="flex items-center gap-2">
          <div className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${iconClass}`}>
            <Icon className="size-4" />
          </div>
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
        <p className="text-xl font-semibold">{title}</p>
        {footer}
      </CardContent>
    </Card>
  );
}

function OverviewCards({ data, alignment }: { data: CareerEvidencePayload; alignment: AlignmentPayload | null }) {
  const aspiration = data.aspiration;
  const certainty = certaintyMeta(aspiration?.certainty ?? null);
  const breakPoint = alignment?.break_point ?? null;
  const evidenceConfidence: Record<CareerEvidenceStatus, Severity> = {
    complete: 'low', partial: 'medium', insufficient: 'high', no_evidence: 'high',
  };
  const confidenceSeverity = evidenceConfidence[data.evidence_status];
  const confidenceLabel = confidenceSeverity === 'low' ? 'High' : confidenceSeverity === 'medium' ? 'Medium' : 'Low';

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <OverviewCard
        icon={Target}
        iconClass={TONE.brand.icon}
        label="Stated Aspiration"
        title={aspiration?.occupation_name || aspiration?.expectation_age_30 || 'Not set'}
        footer={certainty && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            Certainty <Badge variant="outline" className={TONE.neutral.badge}>{certainty.label} ({certainty.value})</Badge>
          </p>
        )}
      />
      <OverviewCard
        icon={Users}
        iconClass={TONE.neutral.icon}
        label="Parent Aspiration"
        title={aspiration?.parent_occupation_name || 'Not shared'}
        footer={aspiration?.parent_occupation_name && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            Source <Badge variant="outline" className={TONE.neutral.badge}>Parent</Badge>
          </p>
        )}
      />
      <OverviewCard
        icon={NotebookPen}
        iconClass={TONE.warning.icon}
        label="Current Plan"
        title={breakPoint?.current_stream || aspiration?.preferred_stream || 'Not set'}
        footer={data.evidence_summary.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {data.evidence_summary.map((item) => (
              <Badge key={item.subject} variant="outline">{item.subject}</Badge>
            ))}
          </div>
        )}
      />
      <OverviewCard
        icon={ShieldCheck}
        iconClass={TONE.success.icon}
        label="Evidence Confidence"
        title={confidenceLabel}
        footer={<Badge variant="outline">{CAREER_EVIDENCE_STATUS_LABEL[data.evidence_status]}</Badge>}
      />
    </div>
  );
}

function BreakPointAnalysis({ alignment }: { alignment: AlignmentPayload | null }) {
  const status: AlignmentStatus =
    alignment && RECOGNISED_ALIGNMENT_STATUSES.includes(alignment.alignment_status)
      ? alignment.alignment_status
      : 'INSUFFICIENT_DATA';
  const breakPoint = alignment?.break_point ?? null;

  return (
    <Card>
      <CardContent>
        <h3 className="flex items-center gap-2 font-semibold"><Route className="size-4" />Break Point Analysis</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          This analysis identifies any gaps between the student&apos;s stated career aspiration and their current educational pathway.
        </p>
        {status === 'INSUFFICIENT_DATA' ? (
          <CenterMessage
            icon={CircleAlert}
            title="Not enough data yet"
            description={alignment?.insufficient_data_reason || 'A stated career aspiration and a resolved educational plan are needed before this analysis can run.'}
          />
        ) : (
          <>
            {status === 'ALIGNED' ? (
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm">
                <CheckCircle2 className={`mt-0.5 size-4 shrink-0 ${TONE.success.text}`} />
                <div>
                  <p className={`font-medium ${TONE.success.text}`}>No alignment gap identified.</p>
                  <p className="text-muted-foreground">The student&apos;s current educational plan remains aligned with their stated career goal.</p>
                </div>
              </div>
            ) : (
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm">
                <AlertTriangle className={`mt-0.5 size-4 shrink-0 ${TONE.danger.text}`} />
                <div>
                  <p className={`font-medium ${TONE.danger.text}`}>Alignment gap identified.</p>
                  <p className="text-muted-foreground">The student&apos;s current educational plan does not fully support their stated career goal.</p>
                </div>
              </div>
            )}
            {breakPoint && (
              <div className="mt-2 divide-y">
                <InfoRow icon={Compass} label="Current Stream" value={breakPoint.current_stream || '—'} />
                <InfoRow icon={GraduationCap} label="Required Stream" value={breakPoint.required_stream || '—'} />
                <InfoRow
                  icon={BookOpen}
                  label="Missing Subjects"
                  value={breakPoint.missing_subjects.length
                    ? <span className="flex flex-wrap justify-end gap-1">{breakPoint.missing_subjects.map((s) => <Badge key={s} variant="outline" className={TONE.danger.badge}>{s}</Badge>)}</span>
                    : '—'}
                />
                <InfoRow
                  icon={ClipboardList}
                  label="Required Exam"
                  value={breakPoint.required_exams.length
                    ? breakPoint.required_exams.map((exam) => exam.name).join(', ')
                    : '—'}
                />
                <InfoRow icon={CalendarClock} label="Deadline" value={breakPoint.deadline_date ? formatEventDate(breakPoint.deadline_date) : '—'} />
                <InfoRow
                  icon={CircleAlert}
                  label="Days Remaining"
                  value={breakPoint.days_remaining != null ? <Badge variant="outline" className={TONE.warning.badge}>{breakPoint.days_remaining} days</Badge> : '—'}
                />
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function EvidenceSummaryPanel({ data }: { data: CareerEvidencePayload }) {
  return (
    <Card>
      <CardContent>
        <h3 className="flex items-center gap-2 font-semibold"><ShieldCheck className="size-4" />Evidence Summary</h3>
        {data.evidence_summary.length === 0 ? (
          <CenterMessage icon={CircleAlert} title="No evidence recorded yet" description="Evidence will appear here once assessments or academic marks are captured." />
        ) : (
          <ul className="mt-2 divide-y">
            {data.evidence_summary.map((item) => (
              <li key={item.subject} className="flex items-center justify-between gap-3 py-2">
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  {item.level === 'demonstrated' || item.level === 'developing'
                    ? <CheckCircle2 className={`size-4 ${TONE.success.text}`} />
                    : <AlertTriangle className={`size-4 ${TONE.warning.text}`} />}
                  {item.subject}
                </span>
                <LevelBadge level={item.level} />
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3 flex items-start gap-2 rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0" />
          <p>
            {data.evidence_status === 'complete'
              ? 'Evidence is based on recorded assessments and academic marks only.'
              : data.insufficient_data_reason
                || 'Evidence is based on recorded assessments and may read "insufficient" while more is gathered. More evidence will improve confidence.'}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

const COUNSELLOR_ACTIONS = [
  { type: 'discuss_pathway', icon: Compass, title: 'Discuss Pathway', subtitle: 'Talk to the student about options' },
  { type: 'review_subjects', icon: BookOpen, title: 'Review Subjects', subtitle: 'Review subject change possibilities' },
  { type: 'parent_discussion', icon: Users, title: 'Parent Discussion', subtitle: 'Schedule parent meeting' },
  { type: 'explore_adjacent', icon: Sparkles, title: 'Best Fit Careers', subtitle: 'See similar career options' },
  { type: 'action_plan', icon: ClipboardList, title: 'Set Action Plan', subtitle: 'Create counselling action plan' },
] as const;

function CounsellorActions({ onSelectAction }: { onSelectAction: (type: string) => void }) {
  return (
    <Card>
      <CardContent>
        <h3 className="flex items-center gap-2 font-semibold"><ClipboardList className="size-4" />Counsellor Actions</h3>
        <div className="mt-2 divide-y">
          {COUNSELLOR_ACTIONS.map((action) => (
            <button
              key={action.type}
              type="button"
              onClick={() => onSelectAction(action.type)}
              className="flex w-full items-center gap-3 py-2.5 text-left transition-colors hover:bg-muted/50"
            >
              <div className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${TONE.brand.icon}`}>
                <action.icon className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{action.title}</p>
                <p className="text-xs text-muted-foreground">{action.subtitle}</p>
              </div>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * "Explore Adjacent Careers" (Counsellor Actions). Knowledge-based, not
 * evidence-only — deliberately kept as its own opt-in panel rather than
 * folded into the evidence-first sections above it, so the "no match
 * scores" framing on the main view stays true for everything except this
 * explicitly knowledge-scored feature.
 */
function AdjacentCareersPanel({ studentId, onClose }: { studentId?: string; onClose: () => void }) {
  const [data, setData] = useState<CareerRecommendationPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    // The request owns loading/error/data state for this panel, same pattern
    // as the top-level CareerIntelligence refresh() below.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError('');
    loadCareerRecommendation(studentId)
      .then((payload) => { if (!cancelled) setData(payload); })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to load adjacent careers.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [studentId]);

  return (
    <Card className="border-indigo-200">
      <CardContent>
        <div className="flex items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 font-semibold"><Sparkles className="size-4" />Best Fit Careers</h3>
          <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
        </div>

        {loading && (
          <div className="flex min-h-32 items-center justify-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" />Loading knowledge-based recommendations…
          </div>
        )}

        {!loading && (error || !data) && (
          <CenterMessage icon={CircleAlert} title="Unable to load adjacent careers" description={error || 'Something went wrong.'} />
        )}

        {!loading && data && data.alignment === 'INSUFFICIENT_DATA' && (
          <CenterMessage
            icon={CircleAlert}
            title="Not enough data yet"
            description={data.insufficient_data_reason || 'A current aspiration and demonstrated knowledge are both needed for this analysis.'}
          />
        )}

        {!loading && data && data.currentAspiration && (
          <div className="mt-3 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 p-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Current Aspiration</p>
                <p className="text-base font-semibold">{data.currentAspiration.occupation_name || data.currentAspiration.occupation_code}</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Knowledge Match</p>
                <p className="text-lg font-semibold">{data.currentAspiration.matchPercentage.toFixed(1)}%</p>
              </div>
              <AlignmentBandBadge band={data.currentAspiration.alignmentBand} />
            </div>

            {data.narrative.alignmentSummary && (
              <p className="text-sm text-muted-foreground">{data.narrative.alignmentSummary}</p>
            )}

            {data.relatedCareersWithBetterAlignment.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold">Related Careers With Better Alignment</h4>
                {data.narrative.relatedCareersGuidance && (
                  <p className="mt-0.5 text-xs text-muted-foreground">{data.narrative.relatedCareersGuidance}</p>
                )}
                <ul className="mt-2 divide-y">
                  {data.relatedCareersWithBetterAlignment.map((career) => (
                    <li key={career.occupation_code} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{career.occupation_name}</p>
                        {career.topMatchedKnowledgeDomains.length > 0 && (
                          <p className="mt-1 flex flex-wrap gap-1 text-xs text-muted-foreground">
                            Matched:
                            {career.topMatchedKnowledgeDomains.map((domain) => (
                              <Badge key={domain} variant="outline" className={TONE.neutral.badge}>{domain}</Badge>
                            ))}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">{career.matchPercentage.toFixed(1)}%</p>
                        <p className={`text-xs ${TONE.success.text}`}>+{career.scoreImprovement.toFixed(1)}% better alignment</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {data.knowledgeDevelopmentAreas.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold">Knowledge Development Areas</h4>
                {data.narrative.knowledgeDevelopmentIntro && (
                  <p className="mt-0.5 text-xs text-muted-foreground">{data.narrative.knowledgeDevelopmentIntro}</p>
                )}
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {data.knowledgeDevelopmentAreas.map((area) => (
                    <li key={area.knowledge}>
                      <Badge variant="outline" className={TONE.warning.badge}>{area.knowledge}</Badge>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const INTERVENTION_TYPES = [
  { value: 'discuss_pathway', label: 'Discuss pathway' },
  { value: 'review_subjects', label: 'Review subjects' },
  { value: 'parent_discussion', label: 'Parent discussion' },
  { value: 'explore_adjacent', label: 'Best fit careers' },
  { value: 'action_plan', label: 'Set action plan' },
  { value: 'other', label: 'Other' },
];

const INTERVENTION_OUTCOMES = [
  { value: 'positive', label: 'Positive engagement' },
  { value: 'follow_up', label: 'Needs follow-up' },
  { value: 'escalated', label: 'Escalated to parent' },
  { value: 'no_change', label: 'No change' },
];

interface InterventionEntry {
  id: string;
  type: string;
  note: string;
  outcome: string;
  loggedAt: string;
}

function LogInterventionForm({
  interventionType, setInterventionType, noteRef, entries, onLog,
}: {
  interventionType: string; setInterventionType: (value: string) => void;
  noteRef: React.RefObject<HTMLInputElement | null>;
  entries: InterventionEntry[]; onLog: (entry: Omit<InterventionEntry, 'id' | 'loggedAt'>) => void;
}) {
  const [note, setNote] = useState('');
  const [outcome, setOutcome] = useState('');
  const [formError, setFormError] = useState('');

  function submit() {
    if (!interventionType) { setFormError('Select an intervention type.'); return; }
    if (!note.trim()) { setFormError('Enter a note describing the intervention.'); return; }
    if (!outcome) { setFormError('Select an outcome.'); return; }
    setFormError('');
    onLog({ type: interventionType, note: note.trim(), outcome });
    setNote('');
    setOutcome('');
  }

  return (
    <Card>
      <CardContent>
        <h3 className="flex items-center gap-2 font-semibold"><NotebookPen className="size-4" />Log Intervention</h3>
        {formError && <p className={`mt-2 text-sm ${TONE.danger.text}`} role="alert">{formError}</p>}
        <div className="mt-3 grid gap-3 md:grid-cols-[1fr_2fr_1fr_auto]">
          <div className="space-y-1.5">
            <Label htmlFor="intervention-type">Type</Label>
            <Select value={interventionType} onValueChange={(value) => value && setInterventionType(value)}>
              <SelectTrigger id="intervention-type"><SelectValue placeholder="Select type" /></SelectTrigger>
              <SelectContent>
                {INTERVENTION_TYPES.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="intervention-note">Note</Label>
            <Input id="intervention-note" ref={noteRef} className="h-10" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Enter note…" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="intervention-outcome">Outcome</Label>
            <Select value={outcome} onValueChange={(value) => value && setOutcome(value)}>
              <SelectTrigger id="intervention-outcome"><SelectValue placeholder="Select outcome" /></SelectTrigger>
              <SelectContent>
                {INTERVENTION_OUTCOMES.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="invisible">Save</Label>
            <Button className="h-10 w-full bg-[#0D6EFD] border-[#0D6EFD] text-white hover:bg-[#0D6EFD]/90" onClick={submit}><Save />Save</Button>
          </div>
        </div>
        {entries.length > 0 && (
          <ul className="mt-4 space-y-2 border-t pt-3">
            {entries.map((entry) => (
              <li key={entry.id} className="flex flex-wrap items-center gap-2 text-sm">
                <Badge variant="outline">{INTERVENTION_TYPES.find((t) => t.value === entry.type)?.label ?? entry.type}</Badge>
                <span className="text-muted-foreground">{entry.note}</span>
                <Badge variant="outline" className={TONE.neutral.badge}>{INTERVENTION_OUTCOMES.find((o) => o.value === entry.outcome)?.label ?? entry.outcome}</Badge>
                <span className="ml-auto text-xs text-muted-foreground">{formatEventDate(entry.loggedAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function CareerIntelligence({ studentId }: { studentId?: string }) {
  const [data, setData] = useState<CareerEvidencePayload | null>(null);
  const [alignment, setAlignment] = useState<AlignmentPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [interventionType, setInterventionType] = useState('');
  const [entries, setEntries] = useState<InterventionEntry[]>([]);
  const [showAdjacentCareers, setShowAdjacentCareers] = useState(false);
  const noteRef = useRef<HTMLInputElement | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [evidence, alignmentPayload] = await Promise.all([
        loadCareerEvidence(studentId),
        loadAlignment(studentId).catch(() => null),
      ]);
      setData(evidence);
      setAlignment(alignmentPayload);
    } catch (err) {
      setData(null);
      setError(err instanceof Error ? err.message : 'Unable to load career evidence.');
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    // The request owns the loading, error, and response state for this view.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  const onSelectAction = useCallback((type: string) => {
    if (type === 'explore_adjacent') {
      // Reveals the knowledge-based panel rather than jumping to the
      // intervention log — 'explore_adjacent' still exists as a loggable
      // intervention type separately, once the counsellor has actually
      // discussed it with the student.
      setShowAdjacentCareers(true);
      return;
    }
    setInterventionType(type);
    noteRef.current?.focus();
    noteRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  const onLog = useCallback((entry: Omit<InterventionEntry, 'id' | 'loggedAt'>) => {
    setEntries((current) => [
      { ...entry, id: `${Date.now()}`, loggedAt: new Date().toISOString() },
      ...current,
    ]);
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-64 items-center justify-center gap-2 text-sm text-muted-foreground">
        <LoaderCircle className="size-4 animate-spin" />Loading career evidence…
      </div>
    );
  }

  if (error || !data) {
    return (
      <CenterMessage
        icon={CircleAlert}
        title="Unable to load career evidence"
        description={error || 'Something went wrong while loading this information.'}
        action={<Button variant="outline" className="mt-2" onClick={() => void refresh()}><RefreshCw />Try again</Button>}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Evidence-based view of this student&apos;s career readiness. No match scores or AI-generated
          recommendations — only the evidence recorded so far.
        </p>
        <Button variant="outline" size="sm" onClick={() => void refresh()}><RefreshCw />Refresh</Button>
      </div>
      <AlignmentBanner payload={alignment} />
      <OverviewCards data={data} alignment={alignment} />
      <div className="grid gap-4 lg:grid-cols-3">
        <BreakPointAnalysis alignment={alignment} />
        <EvidenceSummaryPanel data={data} />
        <CounsellorActions onSelectAction={onSelectAction} />
      </div>
      {showAdjacentCareers && (
        <AdjacentCareersPanel studentId={studentId} onClose={() => setShowAdjacentCareers(false)} />
      )}
      <LogInterventionForm
        interventionType={interventionType}
        setInterventionType={setInterventionType}
        noteRef={noteRef}
        entries={entries}
        onLog={onLog}
      />
    </div>
  );
}
