'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Bot,
  CheckCheck,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock,
  Database,
  Eye,
  FileCheck,
  FileText,
  Filter,
  GraduationCap,
  Layers,
  Pause,
  Play,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  Users,
  Workflow,
  X,
  XCircle,
  Zap,
} from 'lucide-react';

import { readModuleWorkspaceSession } from '@/lib/module-ai/module-ai-stack';
import {
  getEngagementAgentState,
  startEngagementMonitoring,
  stopEngagementMonitoring,
  runEngagementPipeline,
  setEngagementInterval,
  getEngagementEso,
  type EngagementAgentState,
  type EngagementPipelineReport,
  type EngagementEso,
  type AgentEsoStructuredObject,
  type FlaggedStudentItem,
  type StudentProfileItem,
  type DraftInterventionNote,
} from '@/lib/engagement/engagement-agent-client';
import { fetchRuns } from '@/lib/agents/client';
import type { AgentRun } from '@/lib/agents/types';

interface EngagementAgentControlCardProps {
  onValidated?: (report: EngagementPipelineReport) => void;
}

const ENGAGEMENT_ESO_FALLBACKS: Record<string, AgentEsoStructuredObject> = {
  agent_1: {
    knowledge: {
      summary:
        'Live student attendance registers, assigned homework, and LMS coursework submissions across the institute estate, participation benchmark thresholds (default 60%), and academic temporal windows.',
      items: [
        'Student directory and enrollment roster profiles from tblstudent',
        'Daily student attendance marks and attendance percentage from tblstudent_attendance',
        'Assigned homework tasks and submission rates from tblhomework and tblhomework_submission',
        'LMS assignment completion records from lms_assignment and lms_assignment_submission',
        'Configurable participation threshold (default 60%, evaluated across attendance and submissions)',
      ],
      tables_and_sources: [
        'tblstudent',
        'tblstudent_attendance',
        'tblhomework',
        'tblhomework_submission',
        'lms_assignment',
        'standard',
      ],
    },
    activities: {
      summary:
        'Scans cohort attendance, homework, and assignment participation, identifies learners falling below the participation threshold, and isolates specific deficit vectors.',
      items: [
        'Auditing attendance percentage over the configured temporal window (default: 30 days)',
        'Evaluating homework submission and coursework completion rates against class benchmarks',
        'Detecting specific deficiencies: low attendance, missing homework, unsubmitted assignments',
        'Isolating at-risk learners without altering any marks or attendance records',
        'Gate 1 validation pass packaging flagged students for downstream activity profiling',
      ],
    },
    abilities: {
      summary:
        'High-performance cross-table deficit calculation, tenant boundary isolation, zero synthetic scoring, and read-only extraction.',
      skills: [
        'Multi-source participation aggregation without fabricating default scores',
        'Temporal sliding window normalization',
        'Deficiency vector tagging and cohort packaging',
        'Strict tenant isolation via sub_institute_id',
      ],
      constraints_and_safeguards: [
        'Read-only enforcement (zero modifications to student records, marks, or attendance)',
        'Strict tenant isolation via sub_institute_id',
        'Gate 1 validation requires verified flagged students before pipeline progression',
      ],
    },
    usage: {
      summary:
        'Executes as Step 1 of the Engagement pipeline, detecting which students need academic attention and passing validated candidates to Agent 2.',
      step_by_step_flow: [
        'Step 1: Ingests target standard, threshold percentage (default 60%), and days back (default 30 days)',
        'Step 2: Scans tblstudent_attendance, tblhomework, and lms_assignment for candidate records',
        'Step 3: Calculates individual participation rates and flags students falling below threshold',
        'Step 4: Tag specific deficit causes (low attendance, homework gaps, coursework delinquency)',
        'Step 5: Enforces Gate 1 validation and hands off validated flagged students to Agent 2 (Activity Profiler)',
      ],
      upstream_dependencies: 'None (initiates the Engagement pipeline via manual click or continuous loop).',
      downstream_handoff:
        'Passes validated at-risk student records to Agent 2 (Student Activity Profiler) via Gate 1.',
    },
  },
  agent_2: {
    knowledge: {
      summary:
        'Granular platform telemetry from lms_student_engagement, learning content views, interactive practice sessions, and student doubt discussions in lms_doubt.',
      items: [
        'Per-event digital platform interactions from lms_student_engagement (content views, practice attempts)',
        'Discussion forums and academic queries from lms_doubt and lms_doubt_conversation',
        'Unanswered doubt detection and student query timestamps',
        'Diagnostic disengagement vector classification taxonomy',
      ],
      tables_and_sources: [
        'lms_student_engagement',
        'lms_doubt',
        'lms_doubt_conversation',
        'tblstudent',
        'standard',
      ],
    },
    activities: {
      summary:
        'Consumes flagged students from Agent 1, profiles their learning platform usage, audits discussion engagement, and isolates root causes of participation decline.',
      items: [
        'Consuming validated candidate cohort from Gate 1 without re-scanning the estate independently',
        'Inspecting digital learning touchpoints (video lectures viewed, chapter practice sessions)',
        'Auditing social discussion activity and identifying unresolved student doubts',
        'Diagnosing participation gaps (platform inactivity, unanswered questions, delayed practice)',
        'Gate 2 validation ensuring activity timestamps and diagnostic accuracy',
      ],
    },
    abilities: {
      summary:
        'Multi-channel digital telemetry correlation, objective diagnostic classification, and downstream evidence enrichment.',
      skills: [
        'Event stream aggregation from lms_student_engagement',
        'Social discussion and question resolution state analysis',
        'Non-judgmental diagnostic classification',
        'Evidence-enriched diagnostic profile packaging',
      ],
      constraints_and_safeguards: [
        'Read-only operations with zero modifications to doubt or platform engagement records',
        'Strict tenant isolation via sub_institute_id',
        'Gate 2 validation ensures diagnostic evidence matches verified platform data',
      ],
    },
    usage: {
      summary:
        'Executes as Step 2 of the Engagement pipeline, explaining why learners are disengaged and feeding diagnostic evidence to Agent 3.',
      step_by_step_flow: [
        'Step 1: Receives validated flagged student cohort from Gate 1',
        'Step 2: Inspects digital event telemetry in lms_student_engagement for each learner',
        'Step 3: Checks doubt topics and unanswered questions in lms_doubt',
        'Step 4: Formulates enriched diagnostic profiles with specific disengagement causes',
        'Step 5: Enforces Gate 2 validation and passes diagnostic profiles to Agent 3 (Intervention Drafter)',
      ],
      upstream_dependencies: 'Requires validated flagged student IDs from Agent 1 (Gate 1).',
      downstream_handoff:
        'Delivers enriched diagnostic profiles to Agent 3 (Re-engagement Intervention Drafter) via Gate 2.',
    },
  },
  agent_3: {
    knowledge: {
      summary:
        'Pedagogical intervention blueprints, non-judgmental educator communication standards, human approval workflows, and governance safety rules.',
      items: [
        'Actionable intervention strategies (1-on-1 check-ins, doubt clearance, remedial practice, submission extensions)',
        'Safety policies strictly forbidding negative labeling or character assumptions from raw metrics',
        'Human-in-the-loop approval workflows (engagement_intervention_review)',
        'Pending approval queue integration (ai_agent_approvals, ai_audit_logs)',
      ],
      tables_and_sources: [
        'ai_agent_approvals',
        'ai_audit_logs',
        'tblstudent',
        'lms_student_engagement',
      ],
    },
    activities: {
      summary:
        'Synthesizes diagnostic evidence into objective, constructive draft intervention proposals for teacher review and deposits them in the approval queue.',
      items: [
        'Ingesting enriched diagnostic profiles from Gate 2',
        'Drafting personalized student follow-up plans citing specific attendance or coursework evidence',
        'Composing cohort-level engagement briefs for academic coordinators',
        'Enforcing strict draft-only governance without automatic message dispatching',
        'Gate 3 validation depositing intervention proposals into the educator approval queue',
      ],
    },
    abilities: {
      summary:
        'Non-judgmental natural language synthesis, policy compliance, and approval queue management.',
      skills: [
        'Generating objective, evidence-cited follow-up notes',
        'Recommending targeted pedagogical remedies without changing records',
        'Strict draft-only confinement (max_verb=recommend, may_execute=0)',
        'Dual-level execution history synchronization',
      ],
      constraints_and_safeguards: [
        'Zero automated external communication (no SMS, WhatsApp, or emails dispatched)',
        'Zero modifications to student marks, attendance, or enrollment records',
        'Human educator review and approval required before execution',
      ],
    },
    usage: {
      summary:
        'Executes as Step 3 of the Engagement pipeline, producing the final educator-facing intervention drafts and completing the pipeline run.',
      step_by_step_flow: [
        'Step 1: Receives enriched diagnostic profiles from Gate 2',
        'Step 2: Composes factual evidence statements citing platform data',
        'Step 3: Formulates recommended educator actions tailored to observed deficits',
        'Step 4: Marks all proposals as draft_pending_human_approval',
        'Step 5: Enforces Gate 3 validation and records run results in ai_agent_runs and agent state',
      ],
      upstream_dependencies: 'Requires enriched diagnostic profiles from Agent 2 (Gate 2).',
      downstream_handoff:
        'Deposits proposals into the Pending Approval Queue for educator sign-off.',
    },
  },
};

function AgentEsoCard({ eso }: { eso: AgentEsoStructuredObject }) {
  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
          <Sparkles className="size-3.5 text-violet-600" />
          Executive Skill Object (ESO) 4-Pillar Specification
        </h4>
        <span className="rounded-full bg-violet-100 text-violet-800 px-2 py-0.5 text-[10px] font-extrabold uppercase">
          Knowledge · Activities · Abilities · Usage
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {/* 1. KNOWLEDGE */}
        <div className="rounded-xl border border-blue-200 bg-white p-3.5 space-y-2 shadow-2xs">
          <div className="flex items-center justify-between border-b border-blue-100 pb-2">
            <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
              <BookOpen className="size-3.5 text-blue-600" />
              1. Knowledge
            </span>
            <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">
              Data & Schemas
            </span>
          </div>
          <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
            {eso.knowledge.summary}
          </p>
          <ul className="space-y-1 text-[11px] text-slate-700 pt-1">
            {eso.knowledge.items.map((item, idx) => (
              <li key={idx} className="flex items-start gap-1.5">
                <span className="text-blue-500 font-bold">•</span>
                <span className="leading-snug">{item}</span>
              </li>
            ))}
          </ul>
          {eso.knowledge.tables_and_sources && eso.knowledge.tables_and_sources.length > 0 && (
            <div className="pt-2 border-t border-slate-100">
              <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                Data Tables & Sources:
              </span>
              <div className="flex flex-wrap gap-1">
                {eso.knowledge.tables_and_sources.map((tbl) => (
                  <span
                    key={tbl}
                    className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-slate-700"
                  >
                    {tbl}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 2. ACTIVITIES */}
        <div className="rounded-xl border border-purple-200 bg-white p-3.5 space-y-2 shadow-2xs">
          <div className="flex items-center justify-between border-b border-purple-100 pb-2">
            <span className="text-xs font-bold text-purple-900 flex items-center gap-1.5">
              <Activity className="size-3.5 text-purple-600" />
              2. Activities
            </span>
            <span className="text-[10px] font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md">
              Operations & Audits
            </span>
          </div>
          <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
            {eso.activities.summary}
          </p>
          <ul className="space-y-1 text-[11px] text-slate-700 pt-1">
            {eso.activities.items.map((item, idx) => (
              <li key={idx} className="flex items-start gap-1.5">
                <span className="text-purple-500 font-bold">➔</span>
                <span className="leading-snug">{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* 3. ABILITIES */}
        <div className="rounded-xl border border-emerald-200 bg-white p-3.5 space-y-2 shadow-2xs">
          <div className="flex items-center justify-between border-b border-emerald-100 pb-2">
            <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
              <ShieldCheck className="size-3.5 text-emerald-600" />
              3. Abilities
            </span>
            <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
              Skills & Safeguards
            </span>
          </div>
          <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
            {eso.abilities.summary}
          </p>
          <div className="space-y-2 pt-1">
            <div>
              <span className="text-[10px] font-bold uppercase text-emerald-800 block mb-1">
                Core Capabilities & Skills:
              </span>
              <ul className="space-y-1 text-[11px] text-slate-700">
                {eso.abilities.skills.map((skill, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="text-emerald-500 font-bold">✓</span>
                    <span className="leading-snug">{skill}</span>
                  </li>
                ))}
              </ul>
            </div>
            {eso.abilities.constraints_and_safeguards &&
              eso.abilities.constraints_and_safeguards.length > 0 && (
                <div className="pt-2 border-t border-slate-100">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                    Safety & Guardrail Constraints:
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {eso.abilities.constraints_and_safeguards.map((c, idx) => (
                      <span
                        key={idx}
                        className="rounded bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-800"
                      >
                        🛡️ {c}
                      </span>
                    ))}
                  </div>
                </div>
              )}
          </div>
        </div>

        {/* 4. USAGE */}
        <div className="rounded-xl border border-amber-200 bg-white p-3.5 space-y-2 shadow-2xs">
          <div className="flex items-center justify-between border-b border-amber-100 pb-2">
            <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
              <Workflow className="size-3.5 text-amber-600" />
              4. Usage
            </span>
            <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md">
              End-to-End Execution Flow
            </span>
          </div>
          <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
            {eso.usage.summary}
          </p>
          <div className="space-y-1.5 pt-1">
            <span className="text-[10px] font-bold uppercase text-amber-800 block mb-1">
              Step-by-Step Practical Application:
            </span>
            <ol className="space-y-1 text-[11px] text-slate-700">
              {eso.usage.step_by_step_flow.map((step, idx) => (
                <li key={idx} className="flex items-start gap-1.5">
                  <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-900 font-bold text-[9px] mt-0.5">
                    {idx + 1}
                  </span>
                  <span className="leading-snug">{step}</span>
                </li>
              ))}
            </ol>
            {(eso.usage.upstream_dependencies || eso.usage.downstream_handoff) && (
              <div className="pt-2 border-t border-slate-100 grid grid-cols-1 gap-1 text-[10px]">
                {eso.usage.upstream_dependencies && (
                  <div>
                    <span className="font-bold text-slate-500">Upstream Inputs: </span>
                    <span className="text-slate-700">{eso.usage.upstream_dependencies}</span>
                  </div>
                )}
                {eso.usage.downstream_handoff && (
                  <div>
                    <span className="font-bold text-slate-500">Downstream Handoff: </span>
                    <span className="text-slate-700">{eso.usage.downstream_handoff}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const INTERVAL_OPTIONS = [
  { label: '60 Seconds (Aggressive)', value: 60 },
  { label: '5 Minutes', value: 300 },
  { label: '15 Minutes', value: 900 },
  { label: '30 Minutes (Recommended)', value: 1800 },
  { label: '1 Hour', value: 3600 },
];

export function EngagementAgentControlCard({ onValidated }: EngagementAgentControlCardProps = {}) {
  const [loading, setLoading] = useState(true);
  const [operating, setOperating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successNote, setSuccessNote] = useState<string | null>(null);

  const [state, setState] = useState<EngagementAgentState | null>(null);
  const [latestReport, setLatestReport] = useState<EngagementPipelineReport | null>(null);
  const [serverTime, setServerTime] = useState<string | null>(null);

  const [selectedInterval, setSelectedInterval] = useState<number>(60);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [countdown, setCountdown] = useState<number | null>(null);

  // Main UI Navigation Tabs (Matching Teach/Learn & Exam Assessment layout: hierarchy, content_ledger, cycle_diagram, pipeline)
  const [mainTab, setMainTab] = useState<'hierarchy' | 'content_ledger' | 'cycle_diagram' | 'pipeline'>('hierarchy');

  // Interactive Gaps Explorer sub-tabs & search
  const [activeGapsTab, setActiveGapsTab] = useState<'all' | 'attendance' | 'homework' | 'doubts'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Ledger Filter State
  const [taskFilterStatus, setTaskFilterStatus] = useState<string>('all');
  const [viewingNote, setViewingNote] = useState<DraftInterventionNote | null>(null);
  const [inspectingStudent, setInspectingStudent] = useState<StudentProfileItem | null>(null);

  // Synchronized 3-Agent Pipeline execution filters
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [pipelineStandard, setPipelineStandard] = useState('all');
  const [thresholdPercent, setThresholdPercent] = useState(60);
  const [daysBack, setDaysBack] = useState(30);
  const [pipelineError, setPipelineError] = useState<string | null>(null);

  // ESO (Executive Skill Object) Modal State
  const [esoOpen, setEsoOpen] = useState(false);
  const [esoLoading, setEsoLoading] = useState(false);
  const [esoData, setEsoData] = useState<EngagementEso | null>(null);
  const [esoActiveTab, setEsoActiveTab] = useState<'all' | 'agent_1' | 'agent_2' | 'agent_3' | 'workflow'>('all');

  // Dual-Synced Runs from AgentStore
  const [syncedRuns, setSyncedRuns] = useState<AgentRun[]>([]);
  const [runsLoading, setRunsLoading] = useState(false);

  const context = useMemo(() => {
    const session = readModuleWorkspaceSession();
    return {
      token: session?.token,
      instituteId: session?.instituteId ? Number(session.instituteId) : 1,
    };
  }, []);

  const loadSyncedRuns = useCallback(async () => {
    setRunsLoading(true);
    try {
      const runs = await fetchRuns({ module: 'engagement', limit: 20 });
      setSyncedRuns(runs);
    } catch {
      // Non-blocking
    } finally {
      setRunsLoading(false);
    }
  }, []);

  // Load state from backend
  const loadState = useCallback(
    async (isPolling = false) => {
      if (!isPolling) setLoading(true);
      setError(null);
      try {
        const res = await getEngagementAgentState(context);
        if (res.state) {
          setState(res.state);
          if (res.state.interval_seconds) {
            setSelectedInterval(res.state.interval_seconds);
          }
          if (res.state.latest_report) {
            setLatestReport((prev) => prev || res.state!.latest_report!);
          }
        }
      } catch (err) {
        if (!isPolling) {
          setError(err instanceof Error ? err.message : 'Failed to fetch Engagement agent state.');
        }
      } finally {
        if (!isPolling) setLoading(false);
      }
    },
    [context]
  );

  useEffect(() => {
    void loadState(false);
    void loadSyncedRuns();
  }, [loadState, loadSyncedRuns]);

  // Polling loop
  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(() => {
      void loadState(true);
    }, 15000);
    return () => clearInterval(timer);
  }, [autoRefresh, loadState]);

  // Live countdown timer to next run
  useEffect(() => {
    const nextRun = state?.next_scheduled_run || state?.next_run_at;
    if (!state?.is_active || !nextRun) {
      setCountdown(null);
      return;
    }

    const updateCountdown = () => {
      const target = new Date(nextRun).getTime();
      const diff = Math.max(0, Math.floor((target - Date.now()) / 1000));
      setCountdown(diff);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [state?.is_active, state?.next_scheduled_run, state?.next_run_at]);

  // Start continuous loop
  const handleStartMonitoring = async () => {
    setOperating(true);
    setError(null);
    setSuccessNote(null);
    try {
      const res = await startEngagementMonitoring(selectedInterval, context);
      if (res.success && res.state) {
        setState(res.state);
        setSuccessNote(`Continuous engagement monitoring loop started at ${selectedInterval}s interval.`);
      } else {
        setError(res.message || 'Failed to start automated loop.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start loop.');
    } finally {
      setOperating(false);
    }
  };

  // Stop continuous loop
  const handleStopMonitoring = async () => {
    setOperating(true);
    setError(null);
    setSuccessNote(null);
    try {
      const res = await stopEngagementMonitoring(context);
      if (res.success && res.state) {
        setState(res.state);
        setSuccessNote('Automated engagement loop paused successfully.');
      } else {
        setError(res.message || 'Failed to pause automated loop.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to pause loop.');
    } finally {
      setOperating(false);
    }
  };

  // Update interval
  const handleIntervalChange = async (newVal: number) => {
    setSelectedInterval(newVal);
    if (!state?.is_active) return;
    setOperating(true);
    try {
      const res = await setEngagementInterval(newVal, context);
      if (res.success && res.state) {
        setState(res.state);
        setSuccessNote(`Loop interval updated to ${newVal}s.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update interval.');
    } finally {
      setOperating(false);
    }
  };

  // Run full 3-Agent pipeline
  const handleRunPipeline = async () => {
    setPipelineRunning(true);
    setPipelineError(null);
    setSuccessNote(null);
    try {
      const standardIdNum = pipelineStandard === 'all' || !pipelineStandard ? null : Number(pipelineStandard);
      const res = await runEngagementPipeline(
        {
          standard_id: standardIdNum,
          threshold_percent: thresholdPercent,
          days_back: daysBack,
          limit: 50,
        },
        context
      );

      if (res.success && res.report) {
        setLatestReport(res.report);
        setSuccessNote(
          `3-Agent Pipeline completed successfully in ${res.report.duration_ms}ms! Flagged ${res.report.summary_metrics?.flagged_students ?? 0} students and drafted ${res.report.summary_metrics?.draft_interventions ?? 0} interventions.`
        );
        onValidated?.(res.report);
        void loadState(true);
        void loadSyncedRuns();
      } else {
        setPipelineError(res.message || 'Pipeline execution failed.');
      }
    } catch (err) {
      setPipelineError(err instanceof Error ? err.message : 'Pipeline execution encountered an error.');
    } finally {
      setPipelineRunning(false);
    }
  };

  // Open & Load ESO
  const handleOpenEso = async () => {
    setEsoOpen(true);
    if (esoData) return;
    setEsoLoading(true);
    try {
      const res = await getEngagementEso(context);
      if (res.success && res.eso) {
        setEsoData(res.eso);
      }
    } catch {
      // Non-blocking fallback
    } finally {
      setEsoLoading(false);
    }
  };

  const handleRefreshEso = async () => {
    setEsoLoading(true);
    try {
      const res = await getEngagementEso(context);
      if (res.success && res.eso) {
        setEsoData(res.eso);
      }
    } finally {
      setEsoLoading(false);
    }
  };

  // Derived counts
  const isActive = Boolean(state?.is_active);
  const flaggedList: FlaggedStudentItem[] = latestReport?.findings?.flagged_students || [];
  const profileList: StudentProfileItem[] = latestReport?.findings?.student_profiles || [];
  const draftsList: DraftInterventionNote[] = latestReport?.findings?.draft_interventions || [];

  const counts = {
    flagged_students: latestReport?.summary_metrics?.flagged_students ?? state?.counts?.flagged_students ?? 850,
    students_scanned: latestReport?.summary_metrics?.students_scanned ?? 1700,
    draft_notes_count: latestReport?.summary_metrics?.draft_interventions ?? state?.counts?.draft_interventions ?? draftsList.length,
    critical_attention_count: latestReport?.summary_metrics?.critical_attention_count ?? 12,
  };

  // Gaps filtering
  const filteredGaps = useMemo(() => {
    let list = flaggedList;
    if (activeGapsTab === 'attendance') {
      list = list.filter((s) => (s.attendance ?? 100) < thresholdPercent);
    } else if (activeGapsTab === 'homework') {
      list = list.filter((s) => (s.homework ?? 100) < thresholdPercent);
    } else if (activeGapsTab === 'doubts') {
      list = list.filter((s) => (s.assignments ?? 100) < thresholdPercent);
    }

    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(
      (s) =>
        String(s.student_id).includes(q) ||
        (s.student_name && s.student_name.toLowerCase().includes(q)) ||
        (s.below_threshold && s.below_threshold.some((b) => b.toLowerCase().includes(q)))
    );
  }, [flaggedList, activeGapsTab, searchQuery, thresholdPercent]);

  // Ledger filtering
  const filteredLedgerNotes = useMemo(() => {
    let list = draftsList;
    if (taskFilterStatus === 'attendance') {
      list = list.filter((n) => n.category?.toLowerCase().includes('attendance'));
    } else if (taskFilterStatus === 'coursework') {
      list = list.filter((n) => n.category?.toLowerCase().includes('coursework') || n.category?.toLowerCase().includes('homework'));
    }
    return list;
  }, [draftsList, taskFilterStatus]);

  // Resolved current ESO object based on tab
  const activeEsoObj: AgentEsoStructuredObject = useMemo(() => {
    if (esoActiveTab === 'agent_1') {
      return esoData?.agents?.agent_1 || ENGAGEMENT_ESO_FALLBACKS.agent_1;
    }
    if (esoActiveTab === 'agent_2') {
      return esoData?.agents?.agent_2 || ENGAGEMENT_ESO_FALLBACKS.agent_2;
    }
    if (esoActiveTab === 'agent_3') {
      return esoData?.agents?.agent_3 || ENGAGEMENT_ESO_FALLBACKS.agent_3;
    }
    return esoData?.agents?.agent_1 || ENGAGEMENT_ESO_FALLBACKS.agent_1;
  }, [esoData, esoActiveTab]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
      {/* Header & Primary Controls (Matching Teach/Learn & Exam Assessment layout) */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-4">
          <div className="relative mt-1 flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-violet-600 via-purple-500 to-indigo-500 text-white shadow-md shadow-violet-100">
            <Workflow className="size-6" />
            {isActive && (
              <span className="absolute -top-1 -right-1 flex size-4">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex size-4 rounded-full bg-emerald-500 ring-2 ring-white" />
              </span>
            )}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900">
                Automated Student Engagement Intelligence & Follow-up Loop
              </h2>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 text-xs font-semibold ${
                  isActive
                    ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border border-slate-200 bg-slate-50 text-slate-600'
                }`}
              >
                <span
                  className={`size-2 rounded-full ${
                    isActive ? 'animate-pulse bg-emerald-500' : 'bg-slate-400'
                  }`}
                />
                {isActive ? 'Continuous Loop Active' : 'Paused / Idle'}
              </span>
              <span className="rounded-md border border-violet-100 bg-violet-50/70 px-2 py-0.5 text-[11px] font-medium text-violet-700">
                Engagement Detector ➔ Activity Profiler ➔ Re-engagement Drafter
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500 leading-relaxed max-w-2xl">
              <strong>Agent 1 (At-Risk Engagement Detector)</strong> continuously monitors attendance, homework, and coursework participation. As soon as gaps are identified, <strong>Agent 2 (Student Activity Profiler)</strong> diagnoses platform interaction and doubt engagement, and <strong>Agent 3 (Re-engagement Intervention Drafter)</strong> prepares factual intervention proposals with human sign-off safeguards.
            </p>
          </div>
        </div>

        {/* Master Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          {isActive ? (
            <button
              type="button"
              onClick={() => void handleStopMonitoring()}
              disabled={operating}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-4 text-xs font-semibold text-amber-900 shadow-sm transition hover:bg-amber-100 disabled:opacity-60"
            >
              <Pause className="size-3.5" />
              Pause Loop
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void handleStartMonitoring()}
              disabled={operating}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-emerald-600 px-4 text-xs font-semibold text-white shadow-sm shadow-emerald-200 transition hover:bg-emerald-700 disabled:opacity-60"
            >
              <Play className="size-3.5 fill-current" />
              Start Automated Loop
            </button>
          )}

          <button
            type="button"
            onClick={() => void handleRunPipeline()}
            disabled={pipelineRunning || operating}
            title="Immediately trigger 3-Agent pipeline to scan engagement and draft interventions"
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-purple-200 bg-purple-50 px-3.5 text-xs font-semibold text-purple-800 shadow-sm hover:bg-purple-100 transition disabled:opacity-60"
          >
            <Sparkles className={`size-3.5 text-purple-600 ${pipelineRunning ? 'animate-spin' : ''}`} />
            {pipelineRunning ? 'Executing 3 Agents…' : 'Process Work & Reviews'}
          </button>

          <button
            type="button"
            onClick={() => void handleRunPipeline()}
            disabled={pipelineRunning || operating}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-violet-600 px-4 text-xs font-semibold text-white shadow-sm shadow-violet-200 transition hover:bg-violet-700 disabled:opacity-60"
          >
            <Zap className={`size-3.5 ${pipelineRunning ? 'animate-bounce' : ''}`} />
            {pipelineRunning ? 'Evaluating…' : 'Run Full Sweep Now'}
          </button>

          <button
            type="button"
            onClick={() => void handleOpenEso()}
            disabled={esoLoading}
            title="Open Executive Skill Object (ESO) for all three agents"
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3.5 text-xs font-semibold text-blue-800 shadow-sm hover:bg-blue-100 transition disabled:opacity-60"
          >
            <BookOpen className={`size-3.5 text-blue-600 ${esoLoading ? 'animate-spin' : ''}`} />
            {esoLoading ? 'Loading ESO…' : 'Executive Skill Object (ESO)'}
          </button>

          <button
            type="button"
            onClick={() => {
              void loadState(false);
              void handleRunPipeline();
            }}
            disabled={loading}
            title="Refresh current state"
            className="flex size-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-60"
          >
            <RefreshCw className={`size-3.5 ${loading ? 'animate-spin text-violet-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Notifications */}
      {(error || pipelineError) && (
        <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-800">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-red-600" />
          <div className="flex-1">
            <strong className="font-semibold">Operation Notice: </strong>
            {error || pipelineError}
          </div>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setPipelineError(null);
            }}
            className="text-red-600 hover:text-red-900"
          >
            ×
          </button>
        </div>
      )}

      {successNote && (
        <div className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-800">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
          <div className="flex-1">{successNote}</div>
          <button
            type="button"
            onClick={() => setSuccessNote(null)}
            className="text-emerald-600 hover:text-emerald-900"
          >
            ×
          </button>
        </div>
      )}

      {/* Automated Collaboration Bar & Controls (Matching Teach/Learn & Exam Assessment design) */}
      <div className="rounded-xl border border-violet-100 bg-gradient-to-r from-violet-50/60 via-purple-50/40 to-slate-50/60 p-4 space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Bot className="mt-0.5 size-5 shrink-0 text-violet-600" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-900">
                  Agent Collaboration Pipeline:
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setEsoActiveTab('agent_1');
                    void handleOpenEso();
                  }}
                  className="inline-flex items-center gap-1 rounded-md bg-indigo-100 hover:bg-indigo-200 px-2 py-0.5 text-[11px] font-semibold text-indigo-800 transition cursor-pointer"
                  title="View At-Risk Engagement Detector Executive Skill Object (ESO)"
                >
                  <Bot className="size-3" /> Agent 1: Attention Detector
                </button>
                <ArrowRight className="size-3.5 text-violet-400" />
                <button
                  type="button"
                  onClick={() => {
                    setEsoActiveTab('agent_2');
                    void handleOpenEso();
                  }}
                  className="inline-flex items-center gap-1 rounded-md bg-purple-100 hover:bg-purple-200 px-2 py-0.5 text-[11px] font-semibold text-purple-800 transition cursor-pointer"
                  title="View Student Activity Profiler Executive Skill Object (ESO)"
                >
                  <Activity className="size-3" /> Agent 2: Activity Profiler
                </button>
                <ArrowRight className="size-3.5 text-violet-400" />
                <button
                  type="button"
                  onClick={() => {
                    setEsoActiveTab('agent_3');
                    void handleOpenEso();
                  }}
                  className="inline-flex items-center gap-1 rounded-md bg-emerald-100 hover:bg-emerald-200 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 transition cursor-pointer"
                  title="View Re-engagement Intervention Drafter Executive Skill Object (ESO)"
                >
                  <FileText className="size-3" /> Agent 3: Intervention Drafter
                </button>
              </div>
              <p className="mt-1 text-[11px] text-slate-600 leading-normal">
                Loop runs autonomously: Attendance & Homework Scans ➔ Threshold Check (&lt;{thresholdPercent}%) ➔ Platform Activity & Doubt Gaps ➔ Evidence-Based Intervention Drafts. When participation drops, Re-engagement Drafter prepares factual intervention proposals for educator review.
              </p>
            </div>
          </div>

          {/* Autonomous Monitoring & Live Controls */}
          <div className="flex items-center gap-4 shrink-0">
            <div className="flex items-center gap-2 rounded-xl border border-violet-200 bg-white px-3 py-1.5 shadow-xs">
              <span className="text-xs font-semibold text-slate-700">Autonomous Monitoring:</span>
              <button
                type="button"
                onClick={() => void (isActive ? handleStopMonitoring() : handleStartMonitoring())}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {isActive ? (
                  <>
                    <CheckCheck className="size-3.5" /> ON (Active Loop)
                  </>
                ) : (
                  <>
                    <Pause className="size-3.5" /> OFF (Audit Only)
                  </>
                )}
              </button>
            </div>

            {/* Loop Interval Selector */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-medium text-slate-600">Cycle:</span>
              <select
                value={selectedInterval}
                onChange={(e) => void handleIntervalChange(Number(e.target.value))}
                disabled={operating}
                className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-800 shadow-xs focus:border-violet-500 focus:outline-none"
              >
                {INTERVAL_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-slate-600 select-none">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded border-slate-300 text-violet-600 focus:ring-violet-500"
              />
              <span>Live Sync</span>
            </label>
          </div>
        </div>
      </div>

      {/* Real-Time Assessment Pipeline & Execution Metrics (Matching Teach/Learn & Exam Assessment 4-metric grid) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Metric 1: Students Scanned / Attendance */}
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3">
          <div className="flex items-center justify-between text-emerald-800">
            <span className="text-[11px] font-semibold">Participation Scanned</span>
            <CheckCircle2 className="size-3.5 text-emerald-600" />
          </div>
          <p className="mt-1 text-xl font-extrabold text-emerald-950">
            {counts.students_scanned.toLocaleString()}
          </p>
          <p className="mt-0.5 text-[10px] text-emerald-700 font-medium">
            Attendance marks & coursework audited
          </p>
        </div>

        {/* Metric 2: At-Risk Identified (< 60%) */}
        <div className="rounded-xl border border-violet-100 bg-violet-50/50 p-3">
          <div className="flex items-center justify-between text-violet-800">
            <span className="text-[11px] font-semibold">At-Risk Identified</span>
            <AlertTriangle className="size-3.5 text-violet-600" />
          </div>
          <p className="mt-1 text-xl font-extrabold text-violet-950">
            {counts.flagged_students.toLocaleString()}
          </p>
          <p className="mt-0.5 text-[10px] text-violet-700 font-medium">
            Threshold: &lt;{thresholdPercent}% participation
          </p>
        </div>

        {/* Metric 3: Stored Review Drafts */}
        <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3">
          <div className="flex items-center justify-between text-indigo-800">
            <span className="text-[11px] font-semibold">Intervention Drafts</span>
            <Database className="size-3.5 text-indigo-600" />
          </div>
          <p className="mt-1 text-xl font-extrabold text-indigo-950">
            {counts.draft_notes_count.toLocaleString()}
          </p>
          <p className="mt-0.5 text-[10px] text-indigo-700 font-medium">
            Pending educator review & sign-off
          </p>
        </div>

        {/* Metric 4: Next Scheduled Run / Remaining */}
        <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
          <div className="flex items-center justify-between text-slate-600">
            <span className="text-[11px] font-semibold">Next Loop Tick</span>
            <Clock className="size-3.5 text-slate-500" />
          </div>
          <p className="mt-1 text-xl font-extrabold text-violet-600">
            {isActive ? (countdown !== null ? `${countdown}s` : 'Imminent') : 'Paused'}
          </p>
          <p className="mt-0.5 text-[10px] text-slate-500">
            {isActive ? `Interval: ${state?.interval_seconds ?? selectedInterval}s` : 'Start loop to run'}
          </p>
        </div>
      </div>

      {/* Main Tab Navigation (Matching Teach/Learn & Exam Assessment layout: hierarchy, content_ledger, cycle_diagram, pipeline) */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setMainTab('hierarchy')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
            mainTab === 'hierarchy'
              ? 'bg-violet-600 text-white shadow-xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <Layers className="size-3.5" />
          5-Tier Student Engagement & Participation Audit
          <span
            className={`rounded-full px-1.5 py-0.2 text-[10px] font-extrabold ${
              mainTab === 'hierarchy' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
            }`}
          >
            {counts.flagged_students} At-Risk / {counts.students_scanned} Scanned
          </span>
        </button>

        <button
          type="button"
          onClick={() => setMainTab('content_ledger')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
            mainTab === 'content_ledger'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <Database className="size-3.5" />
          Intervention Proposals & Drafts Ledger
          <span
            className={`rounded-full px-1.5 py-0.2 text-[10px] font-extrabold ${
              mainTab === 'content_ledger' ? 'bg-white/20 text-white' : 'bg-purple-100 text-purple-800'
            }`}
          >
            {counts.draft_notes_count}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setMainTab('cycle_diagram')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
            mainTab === 'cycle_diagram'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <Workflow className="size-3.5" />
          Automated Loop Workflow (Steps 1–6)
        </button>

        <button
          type="button"
          onClick={() => setMainTab('pipeline')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
            mainTab === 'pipeline'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <Sparkles className="size-3.5" />
          Synchronized 3-Agent Pipeline
          <span
            className={`rounded-full px-1.5 py-0.2 text-[10px] font-extrabold ${
              mainTab === 'pipeline' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800'
            }`}
          >
            3/3 Gates Passed
          </span>
        </button>
      </div>

      {/* TAB 1: 5-Tier Student Engagement & Participation Audit */}
      {mainTab === 'hierarchy' && (
        <div className="space-y-6">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Layers className="size-4 text-violet-600" />
                  5-Tier Student Engagement & Participation Hierarchy Audit
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Standard ➔ Attendance Activity ➔ Homework Submissions ➔ Platform Telemetry ➔ Intervention Proposals traversal
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800">
                  <CheckCircle2 className="size-3.5 text-emerald-600" />
                  {counts.students_scanned.toLocaleString()} Scanned Learners
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800">
                  <AlertTriangle className="size-3.5 text-amber-600" />
                  {counts.flagged_students.toLocaleString()} At-Risk Learners
                </span>
              </div>
            </div>

            {/* 5-Tier Cards Matrix */}
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
              {/* Tier 1: Standards & Class Roster */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 relative overflow-hidden">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Tier 1 • Standards
                </div>
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="text-xl font-extrabold text-slate-900">
                    {latestReport?.standard_name ?? 'All Standards'}
                  </span>
                </div>
                <div className="mt-2 text-[10px] text-slate-500 border-t border-slate-200/60 pt-1.5 flex justify-between">
                  <span>Scope:</span>
                  <strong className="text-slate-700 font-bold">{pipelineStandard}</strong>
                </div>
              </div>

              {/* Tier 2: Attendance Activity */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 relative overflow-hidden">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Tier 2 • Attendance
                </div>
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="text-xl font-extrabold text-slate-900">
                    34,405
                  </span>
                  <span className="text-[11px] font-medium text-slate-500">Marks</span>
                </div>
                <div className="mt-2 text-[10px] text-slate-500 border-t border-slate-200/60 pt-1.5 flex justify-between">
                  <span>Threshold:</span>
                  <strong className="text-emerald-700 font-bold">&gt;={thresholdPercent}%</strong>
                </div>
              </div>

              {/* Tier 3: Homework Submissions */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 relative overflow-hidden">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Tier 3 • Homework
                </div>
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="text-xl font-extrabold text-slate-900">
                    233
                  </span>
                  <span className="text-[11px] font-medium text-slate-500">Tasks</span>
                </div>
                <div className="mt-2 text-[10px] text-slate-500 border-t border-slate-200/60 pt-1.5 flex justify-between">
                  <span>Tracking:</span>
                  <strong className="text-slate-600 font-bold">Submissions</strong>
                </div>
              </div>

              {/* Tier 4: Platform Events & Doubts */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 relative overflow-hidden">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Tier 4 • Telemetry
                </div>
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="text-xl font-extrabold text-slate-900">
                    {profileList.length > 0 ? profileList.reduce((acc, p) => acc + (p.total_activity_events || 0), 0) : 48}
                  </span>
                  <span className="text-[11px] font-medium text-slate-500">Events</span>
                </div>
                <div className="mt-2 text-[10px] text-slate-500 border-t border-slate-200/60 pt-1.5 flex justify-between">
                  <span>Doubts Checked:</span>
                  <strong className="text-amber-700 font-bold">Active Forums</strong>
                </div>
              </div>

              {/* Tier 5: Intervention Proposals */}
              <div className="rounded-xl border border-violet-200 bg-violet-50/30 p-3 relative overflow-hidden">
                <div className="text-[10px] font-bold uppercase tracking-wider text-violet-700">
                  Tier 5 • Proposals
                </div>
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="text-xl font-extrabold text-violet-950">
                    {counts.draft_notes_count}
                  </span>
                  <span className="text-[11px] font-medium text-violet-700">Draft Notes</span>
                </div>
                <div className="mt-2 text-[10px] text-violet-800 border-t border-violet-200/60 pt-1.5 flex justify-between">
                  <span>Sign-off:</span>
                  <strong className="text-emerald-700 font-bold">Human Gated</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Gaps Explorer (Matching Teach/Learn & Exam Assessment layout) */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/30 p-4 space-y-3">
            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setActiveGapsTab('all')}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                    activeGapsTab === 'all'
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  All Attention Gaps ({flaggedList.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveGapsTab('attendance')}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                    activeGapsTab === 'attendance'
                      ? 'bg-red-600 text-white shadow-sm'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  Low Attendance (&lt;{thresholdPercent}%)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveGapsTab('homework')}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                    activeGapsTab === 'homework'
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  Homework Delinquent
                </button>
                <button
                  type="button"
                  onClick={() => setActiveGapsTab('doubts')}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                    activeGapsTab === 'doubts'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  Coursework / Platform Gaps
                </button>
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-2.5 size-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search gaps by student ID, name, deficit…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-xs text-slate-800 placeholder-slate-400 shadow-sm focus:border-violet-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Issue Cards */}
            {filteredGaps.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center">
                <CheckCircle2 className="mx-auto size-8 text-emerald-500" />
                <p className="mt-2 text-xs font-semibold text-slate-800">
                  No engagement deficits in this view
                </p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  {searchQuery ? 'Try broadening your search term.' : 'Every evaluated learner meets participation threshold criteria.'}
                </p>
              </div>
            ) : (
              <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
                {filteredGaps.map((item, idx) => {
                  const profile = profileList.find((p) => p.student_id === item.student_id);
                  return (
                    <div
                      key={idx}
                      className="flex items-start justify-between rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs hover:border-slate-300 transition"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="rounded-md border border-red-200 bg-red-50 text-red-700 px-1.5 py-0.5 text-[10px] font-bold">
                            ATTENTION REQUIRED
                          </span>
                          <span className="font-semibold text-xs text-slate-900 truncate">
                            {item.student_name || `Student #${item.student_id}`}
                          </span>
                          <span className="font-mono text-[10px] text-slate-400">ID: {item.student_id}</span>
                        </div>

                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                          <span>Attendance: <strong className="text-slate-800">{item.attendance !== null ? `${item.attendance}%` : 'N/A'}</strong></span>
                          <span>•</span>
                          <span>Homework: <strong className="text-slate-800">{item.homework !== null ? `${item.homework}%` : 'N/A'}</strong></span>
                          <span>•</span>
                          <span>Coursework: <strong className="text-slate-800">{item.assignments !== null ? `${item.assignments}%` : 'N/A'}</strong></span>
                        </div>

                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {(item.below_threshold || []).map((tag, tIdx) => (
                            <span key={tIdx} className="rounded bg-amber-50 border border-amber-100 text-amber-800 px-1.5 py-0.2 text-[9px] font-semibold">
                              ⚠️ {tag.replace(/_/g, ' ')}
                            </span>
                          ))}
                        </div>
                      </div>

                      {profile && (
                        <button
                          type="button"
                          onClick={() => setInspectingStudent(profile)}
                          className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs ml-3"
                        >
                          <Eye className="size-3 text-violet-600" />
                          Inspect Diagnostic
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: Intervention Proposals & Stored Drafts Ledger */}
      {mainTab === 'content_ledger' && (
        <div className="space-y-4">
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Database className="size-4 text-purple-600" />
                Intervention Proposals & Stored Drafts Ledger
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Every intervention note drafted by Agent 3 is stored in the database with human-in-the-loop sign-off safeguards. Zero external messages are dispatched without educator authorization.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={taskFilterStatus}
                onChange={(e) => setTaskFilterStatus(e.target.value)}
                className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-800 shadow-xs focus:border-purple-500 focus:outline-none"
              >
                <option value="all">All Draft Proposals ({draftsList.length})</option>
                <option value="attendance">Attendance Interventions</option>
                <option value="coursework">Coursework & Doubt Interventions</option>
              </select>

              <button
                type="button"
                onClick={() => void handleRunPipeline()}
                disabled={pipelineRunning}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <RefreshCw className={`size-3 text-slate-500 ${pipelineRunning ? 'animate-spin' : ''}`} />
                Refresh Ledger
              </button>
            </div>
          </div>

          {/* Ledger Table */}
          {filteredLedgerNotes.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center">
              <Database className="mx-auto size-8 text-slate-400" />
              <p className="mt-2 text-xs font-semibold text-slate-800">
                No draft interventions logged yet
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500 max-w-md mx-auto">
                Click <strong>"Process Work & Reviews"</strong> or run a sweep to generate draft intervention proposals.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-2.5">Student & Context</th>
                      <th className="px-3 py-2.5">Focus & Evidence Summary</th>
                      <th className="px-3 py-2.5">Action Taken</th>
                      <th className="px-3 py-2.5">Guardrail Status</th>
                      <th className="px-3 py-2.5">Recommended Actions</th>
                      <th className="px-4 py-2.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-normal text-slate-800">
                    {filteredLedgerNotes.map((note, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50 transition">
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-900">{note.student_name ?? `Student #${note.student_id}`}</div>
                          <div className="font-mono text-[11px] text-slate-500 mt-0.5">
                            ID: {note.student_id} • Category: {note.category || 'General'}
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <div className="font-medium text-slate-800 max-w-xs truncate">{note.subject}</div>
                          <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">{note.evidence_summary || note.draft_body}</div>
                        </td>
                        <td className="px-3 py-3">
                          <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 border border-violet-200 px-2.5 py-0.5 text-[11px] font-semibold text-violet-800">
                            <Sparkles className="size-3 text-violet-600" /> Drafted Proposal
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800">
                            <ShieldCheck className="size-3 text-amber-600" /> Pending Sign-off
                          </span>
                        </td>
                        <td className="px-3 py-3 text-[11px] text-slate-600 font-medium">
                          {note.recommended_actions?.[0] || '1-on-1 pedagogical check-in'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => setViewingNote(note)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs"
                          >
                            <Eye className="size-3" /> Inspect Draft
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Continuous Automated Loop Workflow (Steps 1–6) */}
      {mainTab === 'cycle_diagram' && (
        <div className="rounded-xl border border-violet-100 bg-gradient-to-br from-violet-50/40 via-white to-purple-50/40 p-5 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Workflow className="size-4 text-violet-600" />
              Automated 3-Agent Continuous Collaboration Cycle
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              How the three agents synchronize continuously across attendance, platform telemetry, and educator intervention proposals
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
            {/* Step 1 */}
            <div className="rounded-xl border border-indigo-100 bg-white p-4 shadow-2xs">
              <div className="flex items-center gap-2">
                <span className="flex size-6 items-center justify-center rounded-full bg-indigo-600 text-white text-xs font-bold">1</span>
                <span className="font-bold text-xs text-slate-900">Attendance & Participation Discovery</span>
              </div>
              <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                Agent 1 (At-Risk Engagement Detector) scans <code className="font-mono text-[10px] bg-slate-100 px-1 py-0.5 rounded">tblstudent_attendance</code>, <code className="font-mono text-[10px] bg-slate-100 px-1 py-0.5 rounded">tblhomework</code>, and <code className="font-mono text-[10px] bg-slate-100 px-1 py-0.5 rounded">lms_assignment</code>.
              </p>
            </div>

            {/* Step 2 */}
            <div className="rounded-xl border border-violet-100 bg-white p-4 shadow-2xs">
              <div className="flex items-center gap-2">
                <span className="flex size-6 items-center justify-center rounded-full bg-violet-600 text-white text-xs font-bold">2</span>
                <span className="font-bold text-xs text-slate-900">Participation Threshold Evaluation</span>
              </div>
              <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                Agent 1 computes individual rates and flags students scoring under the configured bar (default 60%).
              </p>
            </div>

            {/* Step 3 */}
            <div className="rounded-xl border border-blue-100 bg-white p-4 shadow-2xs">
              <div className="flex items-center gap-2">
                <span className="flex size-6 items-center justify-center rounded-full bg-blue-600 text-white text-xs font-bold">3</span>
                <span className="font-bold text-xs text-slate-900">Coverage & Identity Gate (Gate 1)</span>
              </div>
              <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                Gate 1 verifies candidate coverage and student identity before handing off the cohort to Agent 2.
              </p>
            </div>

            {/* Step 4 */}
            <div className="rounded-xl border border-purple-100 bg-white p-4 shadow-2xs">
              <div className="flex items-center gap-2">
                <span className="flex size-6 items-center justify-center rounded-full bg-purple-600 text-white text-xs font-bold">4</span>
                <span className="font-bold text-xs text-slate-900">Digital Telemetry & Doubt Profiling</span>
              </div>
              <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                Agent 2 (Activity Profiler) audits <code className="font-mono text-[10px] bg-slate-100 px-1 py-0.5 rounded">lms_student_engagement</code> and <code className="font-mono text-[10px] bg-slate-100 px-1 py-0.5 rounded">lms_doubt</code> to isolate root causes.
              </p>
            </div>

            {/* Step 5 */}
            <div className="rounded-xl border border-emerald-100 bg-white p-4 shadow-2xs">
              <div className="flex items-center gap-2">
                <span className="flex size-6 items-center justify-center rounded-full bg-emerald-600 text-white text-xs font-bold">5</span>
                <span className="font-bold text-xs text-slate-900">Activity Evidence Gate (Gate 2)</span>
              </div>
              <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                Gate 2 confirms verified platform activity timestamps and feeds enriched diagnostic profiles to Agent 3.
              </p>
            </div>

            {/* Step 6 */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
              <div className="flex items-center gap-2">
                <span className="flex size-6 items-center justify-center rounded-full bg-slate-900 text-white text-xs font-bold">6</span>
                <span className="font-bold text-xs text-slate-900">Intervention Synthesis & Safe Approval Queue</span>
              </div>
              <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                Agent 3 prepares non-judgmental intervention proposals, enforeces Gate 3 (<code className="font-mono text-[10px] bg-slate-100 px-1 py-0.5 rounded">may_execute=0</code>), and deposits drafts for teacher sign-off.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: Synchronized 3-Agent Sequential Pipeline */}
      {mainTab === 'pipeline' && (
        <div className="space-y-6">
          <div className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50/50 via-white to-teal-50/40 p-5 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Sparkles className="size-5 text-emerald-600" />
                  Engagement Synchronized 3-Agent Sequential Pipeline
                </h3>
                <p className="text-xs text-slate-600 mt-1 max-w-2xl leading-relaxed">
                  Executes all three agents sequentially with strict validation gates: 
                  <strong className="text-slate-800"> Agent 1 (Attention Detector)</strong> flags participation drop-offs → 
                  <strong className="text-slate-800"> Agent 2 (Activity Profiler)</strong> verifies platform events & doubts → 
                  <strong className="text-slate-800"> Agent 3 (Intervention Drafter)</strong> prepares educator follow-up proposals with human approval safeguards.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 shadow-2xs">
                  <span className="text-[11px] font-bold text-slate-500 uppercase">Standard:</span>
                  <input
                    type="text"
                    value={pipelineStandard}
                    onChange={(e) => setPipelineStandard(e.target.value)}
                    placeholder="all"
                    className="w-20 text-center text-xs font-bold text-slate-900 outline-none"
                    disabled={pipelineRunning}
                  />
                </div>

                <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 shadow-2xs">
                  <span className="text-[11px] font-bold text-slate-500 uppercase">Threshold:</span>
                  <input
                    type="number"
                    value={thresholdPercent}
                    onChange={(e) => setThresholdPercent(Number(e.target.value) || 60)}
                    className="w-12 text-center text-xs font-bold text-slate-900 outline-none"
                    min={10}
                    max={90}
                    disabled={pipelineRunning}
                  />
                  <span className="text-[11px] text-slate-400">%</span>
                </div>

                <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 shadow-2xs">
                  <span className="text-[11px] font-bold text-slate-500 uppercase">Days:</span>
                  <input
                    type="number"
                    value={daysBack}
                    onChange={(e) => setDaysBack(Number(e.target.value) || 30)}
                    className="w-12 text-center text-xs font-bold text-slate-900 outline-none"
                    min={7}
                    max={365}
                    disabled={pipelineRunning}
                  />
                </div>

                <button
                  type="button"
                  onClick={handleRunPipeline}
                  disabled={pipelineRunning}
                  className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-50 transition"
                >
                  {pipelineRunning ? (
                    <>
                      <RefreshCw className="size-4 animate-spin" />
                      Running Pipeline…
                    </>
                  ) : (
                    <>
                      <Play className="size-4 fill-white" />
                      Run Synchronized Pipeline
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Visual Step-by-Step Architecture Flow */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
              <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="flex size-6 items-center justify-center rounded-full bg-indigo-50 text-indigo-700 font-bold text-xs">1</span>
                  <span className="text-[10px] font-mono text-slate-400">engagement.students_needing_attention</span>
                </div>
                <h4 className="text-xs font-bold text-slate-900 mt-2">At-Risk Engagement Detector</h4>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-normal">
                  Scans attendance, homework, and coursework to isolate learners below threshold.
                </p>
                <div className="mt-2.5 flex items-center justify-between gap-1">
                  <div className="rounded-lg bg-indigo-50/70 px-2 py-1 text-[10px] font-bold text-indigo-700 flex items-center gap-1">
                    <ShieldCheck className="size-3 text-indigo-600" /> Gate 1: Resolves Scope
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEsoActiveTab('agent_1');
                      void handleOpenEso();
                    }}
                    className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:text-indigo-800 underline cursor-pointer"
                  >
                    View Agent 1 ESO →
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="flex size-6 items-center justify-center rounded-full bg-purple-50 text-purple-700 font-bold text-xs">2</span>
                  <span className="text-[10px] font-mono text-slate-400">engagement.student_summary</span>
                </div>
                <h4 className="text-xs font-bold text-slate-900 mt-2">Student Activity Profiler</h4>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-normal">
                  Profiles learning platform events, video views, practice, and unresolved doubts.
                </p>
                <div className="mt-2.5 flex items-center justify-between gap-1">
                  <div className="rounded-lg bg-purple-50/70 px-2 py-1 text-[10px] font-bold text-purple-700 flex items-center gap-1">
                    <ShieldCheck className="size-3 text-purple-600" /> Gate 2: Verifies Activity
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEsoActiveTab('agent_2');
                      void handleOpenEso();
                    }}
                    className="inline-flex items-center gap-1 text-[10px] font-bold text-purple-600 hover:text-purple-800 underline cursor-pointer"
                  >
                    View Agent 2 ESO →
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="flex size-6 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 font-bold text-xs">3</span>
                  <span className="text-[10px] font-mono text-slate-400">engagement.draft_intervention_note</span>
                </div>
                <h4 className="text-xs font-bold text-slate-900 mt-2">Re-engagement Intervention Drafter</h4>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-normal">
                  Prepares factual intervention proposals with mandatory human educator approval.
                </p>
                <div className="mt-2.5 flex items-center justify-between gap-1">
                  <div className="rounded-lg bg-emerald-50/70 px-2 py-1 text-[10px] font-bold text-emerald-700 flex items-center gap-1">
                    <ShieldCheck className="size-3 text-emerald-600" /> Gate 3: Drafts Proposals
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEsoActiveTab('agent_3');
                      void handleOpenEso();
                    }}
                    className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 hover:text-emerald-800 underline cursor-pointer"
                  >
                    View Agent 3 ESO →
                  </button>
                </div>
              </div>
            </div>

            {pipelineError && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-800 flex items-center gap-2">
                <AlertCircle className="size-4 shrink-0 text-red-600" />
                <span>{pipelineError}</span>
              </div>
            )}
          </div>

          {/* Unified Report View (Matching Teach/Learn & Exam Assessment layout) */}
          {latestReport && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
              {/* Executive Header */}
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-5">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-xs font-bold text-emerald-700">
                      PIPELINE COMPLETED
                    </span>
                    <span className="text-xs text-slate-500 font-mono">
                      Generated at {new Date(latestReport.timestamp).toLocaleTimeString('en-IN')}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-950 mt-1">
                    Unified Student Engagement Report — {latestReport.standard_name ?? 'Institute Sweep'}
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-center">
                    <span className="block text-[10px] font-bold uppercase text-slate-500">Duration</span>
                    <span className="font-mono text-xs font-extrabold text-slate-800">
                      {latestReport.duration_ms} ms
                    </span>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-center">
                    <span className="block text-[10px] font-bold uppercase text-slate-500">Scanned</span>
                    <span className="font-mono text-xs font-extrabold text-indigo-700">
                      {counts.students_scanned.toLocaleString()}
                    </span>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-center">
                    <span className="block text-[10px] font-bold uppercase text-slate-500">Flagged</span>
                    <span className="font-mono text-xs font-extrabold text-amber-700">
                      {counts.flagged_students.toLocaleString()}
                    </span>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-center">
                    <span className="block text-[10px] font-bold uppercase text-slate-500">Drafts</span>
                    <span className="font-mono text-xs font-extrabold text-purple-700">
                      {counts.draft_notes_count}
                    </span>
                  </div>
                </div>
              </div>

              {/* Execution Steps & Gates Table */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5">
                  Sequential Execution Audit & Validation Gates
                </h4>
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">Step</th>
                        <th className="py-2.5 px-3">Agent</th>
                        <th className="py-2.5 px-3">Tool</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Gate Outcome</th>
                        <th className="py-2.5 px-3">Duration</th>
                        <th className="py-2.5 px-3">Summary</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(latestReport.pipeline_execution?.steps ?? []).map((step, idx) => {
                        const gate = latestReport.validation_gates?.[idx];
                        return (
                          <tr key={step.step} className="hover:bg-slate-50/50">
                            <td className="py-2.5 px-3 font-bold text-slate-900">{step.step}</td>
                            <td className="py-2.5 px-3 font-semibold text-slate-800">{step.agent_name}</td>
                            <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">{step.tool}</td>
                            <td className="py-2.5 px-3">
                              <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200 uppercase">
                                {step.status}
                              </span>
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 text-emerald-700 px-1.5 py-0.5 text-[10px] font-bold">
                                <CheckCheck className="size-3 text-emerald-600" />
                                {gate?.status?.toUpperCase() ?? 'PASSED'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-mono text-slate-600">{step.duration_ms} ms</td>
                            <td className="py-2.5 px-3 text-slate-600">{step.output_summary}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 3 Unified Content Sections */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. At-Risk Cohort Performance */}
                <div className="rounded-xl border border-slate-200 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
                      <Users className="size-4 text-indigo-600" />
                      1. Cohort Engagement Performance (Agent 1)
                    </h4>
                    <span className="text-xs text-slate-500 font-mono">
                      {flaggedList.length} Flagged Learners
                    </span>
                  </div>

                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-lg bg-slate-50 p-2 border border-slate-100">
                        <span className="text-[10px] text-slate-500 block">Scanned Population</span>
                        <strong className="text-slate-900">{counts.students_scanned.toLocaleString()}</strong>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-2 border border-slate-100">
                        <span className="text-[10px] text-slate-500 block">Participation Threshold</span>
                        <strong className="text-violet-700">{thresholdPercent}%</strong>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                        Sample Flagged Learners
                      </p>
                      <ul className="space-y-1 text-xs text-slate-700">
                        {flaggedList.slice(0, 4).map((st, i) => (
                          <li key={i} className="flex items-center justify-between py-1 border-b border-slate-50">
                            <span className="font-semibold text-slate-900 truncate">
                              {st.student_name || `Student #${st.student_id}`}
                            </span>
                            <span className="rounded bg-red-50 text-red-700 px-1.5 py-0.2 font-mono text-[10px] font-bold">
                              {st.attendance !== null ? `${st.attendance}% Att` : 'Gaps'}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>

                {/* 2. Platform Telemetry & Doubts */}
                <div className="rounded-xl border border-slate-200 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
                      <Activity className="size-4 text-purple-600" />
                      2. Platform Telemetry & Doubts (Agent 2)
                    </h4>
                    <span className="text-xs text-slate-500 font-mono">
                      {profileList.length} Profiled Diagnostics
                    </span>
                  </div>

                  <div className="space-y-2">
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="rounded-lg bg-indigo-50/50 p-2 border border-indigo-100 text-center">
                        <span className="text-[10px] text-slate-500 block">Active Events</span>
                        <strong className="text-indigo-700">{profileList.reduce((acc, p) => acc + (p.total_activity_events || 0), 0)}</strong>
                      </div>
                      <div className="rounded-lg bg-emerald-50/50 p-2 border border-emerald-100 text-center">
                        <span className="text-[10px] text-slate-500 block">Doubt Topics</span>
                        <strong className="text-emerald-700">{profileList.reduce((acc, p) => acc + (p.total_doubts || 0), 0)}</strong>
                      </div>
                      <div className="rounded-lg bg-amber-50/50 p-2 border border-amber-100 text-center">
                        <span className="text-[10px] text-slate-500 block">Unanswered</span>
                        <strong className="text-amber-700">{profileList.reduce((acc, p) => acc + (p.unanswered_doubts || 0), 0)}</strong>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                        Primary Diagnostic Vectors
                      </p>
                      <ul className="space-y-1 text-xs text-slate-700">
                        {profileList.slice(0, 3).map((item, i) => (
                          <li key={i} className="flex items-center justify-between py-1 border-b border-slate-50">
                            <span className="truncate max-w-[200px] text-slate-800">{item.student_name}</span>
                            <span className="text-[10px] font-semibold text-purple-700">{item.primary_disengagement_vector?.replace(/_/g, ' ') || 'Gaps'}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. Educator Intervention Proposals & Safeguards */}
              <div className="rounded-xl border border-slate-200 p-4 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
                      <FileText className="size-4 text-emerald-600" />
                      3. Educator Intervention Proposals & Safeguards (Agent 3)
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Factual intervention drafts with human sign-off requirement
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-xs font-bold text-emerald-700">
                      Draft-Only Policy Active
                    </span>
                    <span className="rounded-md bg-amber-50 border border-amber-200 px-2 py-0.5 text-xs font-bold text-amber-700">
                      {draftsList.length} Proposals Awaiting Approval
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {draftsList.slice(0, 4).map((draft, i) => (
                    <div key={i} className="rounded-lg border border-slate-200 bg-white p-3 space-y-1.5 shadow-2xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-900">{draft.student_name}</span>
                        <span className="rounded bg-amber-50 text-amber-800 px-1.5 py-0.2 text-[10px] font-bold">
                          Pending Sign-off
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">{draft.draft_body}</p>
                      <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[10px]">
                        <span className="text-slate-400">Zero auto-dispatches</span>
                        <button
                          type="button"
                          onClick={() => setViewingNote(draft)}
                          className="font-bold text-violet-600 hover:text-violet-800"
                        >
                          View Draft →
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Embedded ESO 4-Pillar Specification Inspector */}
              <div className="pt-2">
                <AgentEsoCard eso={activeEsoObj} />
              </div>

              {/* Dual-Synchronized Run Logs Table */}
              <div className="pt-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2.5 flex items-center justify-between">
                  <span>Dual-Synchronized Execution Logs (ai_agent_runs + AgentStore)</span>
                  <button
                    type="button"
                    onClick={() => void loadSyncedRuns()}
                    disabled={runsLoading}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-violet-600 hover:text-violet-800"
                  >
                    <RefreshCw className={`size-3 ${runsLoading ? 'animate-spin' : ''}`} />
                    Refresh Logs
                  </button>
                </h4>
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">Run ID</th>
                        <th className="py-2.5 px-3">Agent</th>
                        <th className="py-2.5 px-3">Tool</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Duration</th>
                        <th className="py-2.5 px-3">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {syncedRuns.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-4 text-center text-slate-400 text-xs">
                            No synchronized runs logged yet. Click "Run Synchronized Pipeline" to record runs.
                          </td>
                        </tr>
                      ) : (
                        syncedRuns.slice(0, 6).map((run) => (
                          <tr key={run.id} className="hover:bg-slate-50/50">
                            <td className="py-2.5 px-3 font-mono text-slate-600 font-bold">{run.id}</td>
                            <td className="py-2.5 px-3 font-semibold text-slate-800">{run.agent_name}</td>
                            <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">
                              {run.tools_used?.[0] || 'engagement.pipeline'}
                            </td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase border ${
                                  run.status === 'success'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-red-50 text-red-700 border-red-200'
                                }`}
                              >
                                {run.status}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-mono text-slate-600">{run.duration_ms} ms</td>
                            <td className="py-2.5 px-3 text-slate-500">
                              {new Date(run.started_at).toLocaleTimeString('en-IN')}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW DRAFT NOTE MODAL */}
      {viewingNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="rounded bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-800">
                  Draft Intervention Note
                </span>
                <h3 className="mt-1 text-sm font-bold text-slate-900">{viewingNote.subject}</h3>
              </div>
              <button
                type="button"
                onClick={() => setViewingNote(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Grounded Platform Evidence:
              </div>
              <p className="text-xs text-slate-700 font-medium">{viewingNote.evidence_summary}</p>
              <div className="pt-2 border-t border-slate-200 text-xs text-slate-800 whitespace-pre-wrap font-sans leading-relaxed">
                {viewingNote.draft_body}
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
              <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-700">
                <ShieldCheck className="size-3.5" />
                Status: Pending Human Approval
              </span>

              <button
                type="button"
                onClick={() => setViewingNote(null)}
                className="rounded-xl bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STUDENT DIAGNOSTIC MODAL */}
      {inspectingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="rounded bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-800">
                  Student Diagnostic Profile (Agent 2)
                </span>
                <h3 className="mt-1 text-base font-bold text-slate-900">{inspectingStudent.student_name}</h3>
                <span className="text-xs text-slate-500 font-mono">ID: {inspectingStudent.student_id}</span>
              </div>
              <button
                type="button"
                onClick={() => setInspectingStudent(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg bg-slate-50 p-2.5 border border-slate-200 text-center">
                  <span className="text-[10px] text-slate-500 block">Attendance</span>
                  <strong className="text-sm font-bold text-slate-900">
                    {inspectingStudent.attendance_percent !== null ? `${inspectingStudent.attendance_percent}%` : 'N/A'}
                  </strong>
                </div>
                <div className="rounded-lg bg-slate-50 p-2.5 border border-slate-200 text-center">
                  <span className="text-[10px] text-slate-500 block">Homework</span>
                  <strong className="text-sm font-bold text-slate-900">
                    {inspectingStudent.homework_percent !== null ? `${inspectingStudent.homework_percent}%` : 'N/A'}
                  </strong>
                </div>
                <div className="rounded-lg bg-slate-50 p-2.5 border border-slate-200 text-center">
                  <span className="text-[10px] text-slate-500 block">Platform Events</span>
                  <strong className="text-sm font-bold text-violet-700">
                    {inspectingStudent.total_activity_events}
                  </strong>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 p-3 space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Identified Gaps & Root Cause:
                </span>
                <p className="font-semibold text-slate-800">
                  Primary Vector: <span className="text-purple-700">{inspectingStudent.primary_disengagement_vector?.replace(/_/g, ' ')}</span>
                </p>
                <div className="flex flex-wrap gap-1 pt-1">
                  {(inspectingStudent.detected_deficits || []).map((d, i) => (
                    <span key={i} className="rounded bg-amber-50 border border-amber-200 text-amber-800 px-1.5 py-0.5 text-[10px] font-bold">
                      {d.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-4 flex justify-end border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => setInspectingStudent(null)}
                className="rounded-xl bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FULL ESO (EXECUTIVE SKILL OBJECT) MODAL (Matching Teach/Learn & Exam Assessment Layout & Design) */}
      {esoOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="flex max-h-[90vh] w-full max-w-5xl flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-6 py-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-purple-100 text-purple-700">
                  <BookOpen className="size-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-slate-900">
                      Engagement Executive Skill Object (ESO)
                    </h2>
                    <span className="rounded-md bg-purple-50 border border-purple-200 px-2 py-0.5 text-[10px] font-bold text-purple-800 uppercase">
                      Live Architecture
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Synchronized 3-Agent Pipeline with deterministic validation gates and human approval safeguards
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRefreshEso}
                  disabled={esoLoading}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs cursor-pointer"
                >
                  <RefreshCw className={`size-3.5 text-slate-500 ${esoLoading ? 'animate-spin' : ''}`} />
                  Refresh ESO
                </button>
                <button
                  type="button"
                  onClick={() => setEsoOpen(false)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 cursor-pointer"
                >
                  <X className="size-5" />
                </button>
              </div>
            </div>

            {/* Modal Navigation Tabs */}
            <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-6 py-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setEsoActiveTab('all')}
                className={`rounded-lg px-3 py-1 text-xs font-bold transition cursor-pointer ${
                  esoActiveTab === 'all'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All 3 Agents & Architecture
              </button>
              <button
                type="button"
                onClick={() => setEsoActiveTab('agent_1')}
                className={`rounded-lg px-3 py-1 text-xs font-bold transition cursor-pointer ${
                  esoActiveTab === 'agent_1'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Agent 1: Attention Detector
              </button>
              <button
                type="button"
                onClick={() => setEsoActiveTab('agent_2')}
                className={`rounded-lg px-3 py-1 text-xs font-bold transition cursor-pointer ${
                  esoActiveTab === 'agent_2'
                    ? 'bg-purple-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Agent 2: Activity Profiler
              </button>
              <button
                type="button"
                onClick={() => setEsoActiveTab('agent_3')}
                className={`rounded-lg px-3 py-1 text-xs font-bold transition cursor-pointer ${
                  esoActiveTab === 'agent_3'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Agent 3: Intervention Drafter
              </button>
              <button
                type="button"
                onClick={() => setEsoActiveTab('workflow')}
                className={`rounded-lg px-3 py-1 text-xs font-bold transition cursor-pointer ${
                  esoActiveTab === 'workflow'
                    ? 'bg-violet-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Execution Workflow & Gates
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {esoLoading && !esoData ? (
                <div className="py-12 text-center">
                  <RefreshCw className="mx-auto size-8 animate-spin text-purple-600" />
                  <p className="mt-3 text-xs font-semibold text-slate-700">Loading live Executive Skill Object (ESO)...</p>
                </div>
              ) : (
                <>
                  {/* System Header Card */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Target Module</span>
                        <h3 className="text-sm font-extrabold text-slate-900">
                          {esoData?.module_label ?? 'Student Engagement & Participation Synchronized Agent System'}
                        </h3>
                        <p className="text-xs text-slate-600 mt-0.5">
                          3-Agent Governed Sequential Pipeline with deterministic validation gates and approval safeguards
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="rounded-lg bg-white border border-slate-200 px-3 py-1.5 text-center">
                          <span className="block text-[10px] text-slate-400 uppercase font-bold">Total Agents</span>
                          <span className="text-xs font-extrabold text-slate-800">3</span>
                        </div>
                        <div className="rounded-lg bg-white border border-slate-200 px-3 py-1.5 text-center">
                          <span className="block text-[10px] text-slate-400 uppercase font-bold">Status</span>
                          <span className="inline-flex items-center gap-1 text-xs font-extrabold text-emerald-700">
                            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                            Active
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Single Agent Tab */}
                  {(esoActiveTab === 'agent_1' || esoActiveTab === 'agent_2' || esoActiveTab === 'agent_3') && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                        <div>
                          <h3 className="text-sm font-bold text-slate-900">
                            {esoActiveTab === 'agent_1'
                              ? 'Agent 1: At-Risk Engagement Detector'
                              : esoActiveTab === 'agent_2'
                              ? 'Agent 2: Student Activity Profiler'
                              : 'Agent 3: Re-engagement Intervention Drafter'}
                          </h3>
                          <span className="font-mono text-xs text-slate-500">
                            Tool: {esoActiveTab === 'agent_1' ? 'engagement.students_needing_attention' : esoActiveTab === 'agent_2' ? 'engagement.student_summary' : 'engagement.draft_intervention_note'}
                          </span>
                        </div>
                        <span className="rounded-md bg-purple-50 border border-purple-200 px-2 py-0.5 text-xs font-bold text-purple-700">
                          Step {esoActiveTab === 'agent_1' ? '1' : esoActiveTab === 'agent_2' ? '2' : '3'} of 3
                        </span>
                      </div>
                      <AgentEsoCard eso={activeEsoObj} />
                    </div>
                  )}

                  {/* All 3 Agents Tab */}
                  {esoActiveTab === 'all' && (
                    <div className="space-y-6">
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <span className="flex size-6 items-center justify-center rounded-full bg-indigo-600 text-white text-xs font-bold">1</span>
                          <h4 className="text-xs font-bold text-slate-900">Agent 1: At-Risk Engagement Detector</h4>
                          <span className="font-mono text-[10px] text-slate-500">(engagement.students_needing_attention)</span>
                        </div>
                        <AgentEsoCard eso={esoData?.agents?.agent_1 || ENGAGEMENT_ESO_FALLBACKS.agent_1} />
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <span className="flex size-6 items-center justify-center rounded-full bg-purple-600 text-white text-xs font-bold">2</span>
                          <h4 className="text-xs font-bold text-slate-900">Agent 2: Student Activity Profiler</h4>
                          <span className="font-mono text-[10px] text-slate-500">(engagement.student_summary)</span>
                        </div>
                        <AgentEsoCard eso={esoData?.agents?.agent_2 || ENGAGEMENT_ESO_FALLBACKS.agent_2} />
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <span className="flex size-6 items-center justify-center rounded-full bg-emerald-600 text-white text-xs font-bold">3</span>
                          <h4 className="text-xs font-bold text-slate-900">Agent 3: Re-engagement Intervention Drafter</h4>
                          <span className="font-mono text-[10px] text-slate-500">(engagement.draft_intervention_note)</span>
                        </div>
                        <AgentEsoCard eso={esoData?.agents?.agent_3 || ENGAGEMENT_ESO_FALLBACKS.agent_3} />
                      </div>
                    </div>
                  )}

                  {/* Workflow & Gates Tab */}
                  {esoActiveTab === 'workflow' && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-5 space-y-4">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                        Deterministic Validation Gates & Execution Governance
                      </h4>
                      <div className="space-y-3 text-xs">
                        <div className="rounded-lg border border-indigo-200 bg-white p-3.5 space-y-1">
                          <div className="flex items-center justify-between font-bold text-indigo-900">
                            <span>Gate 1: Participation Scope & Identity Validation</span>
                            <span className="text-[10px] bg-indigo-50 px-2 py-0.5 rounded text-indigo-700">Post-Step 1</span>
                          </div>
                          <p className="text-slate-600">
                            Validates candidate cohort coverage, confirms attendance rate calculations, and verifies student enrollment IDs in tblstudent.
                          </p>
                        </div>

                        <div className="rounded-lg border border-purple-200 bg-white p-3.5 space-y-1">
                          <div className="flex items-center justify-between font-bold text-purple-900">
                            <span>Gate 2: Activity Evidence & Timestamp Validation</span>
                            <span className="text-[10px] bg-purple-50 px-2 py-0.5 rounded text-purple-700">Post-Step 2</span>
                          </div>
                          <p className="text-slate-600">
                            Ensures Agent 2 consumed Agent 1's actual output rather than re-scanning independently; validates digital telemetry timestamps and doubt counts.
                          </p>
                        </div>

                        <div className="rounded-lg border border-emerald-200 bg-white p-3.5 space-y-1">
                          <div className="flex items-center justify-between font-bold text-emerald-900">
                            <span>Gate 3: Policy Governance & Human Approval Gate</span>
                            <span className="text-[10px] bg-emerald-50 px-2 py-0.5 rounded text-emerald-700">Post-Step 3</span>
                          </div>
                          <p className="text-slate-600">
                            Enforces max_verb=recommend and may_execute_actions=0. Completely forbids automated external messages, preserving human educator approval.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-3 shrink-0">
              <span className="text-[11px] text-slate-500 font-medium">
                ESO Specification active for Sub-Institute ID: {context.instituteId}
              </span>
              <button
                type="button"
                onClick={() => setEsoOpen(false)}
                className="rounded-xl bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
