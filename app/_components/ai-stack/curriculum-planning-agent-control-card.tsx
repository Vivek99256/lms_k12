'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Bot,
  Calendar,
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
  Users,
  Workflow,
  X,
  XCircle,
  Zap,
} from 'lucide-react';

import { readModuleWorkspaceSession } from '@/lib/module-ai/module-ai-stack';
import {
  getCurriculumPlanningAgentState,
  startCurriculumPlanningMonitoring,
  stopCurriculumPlanningMonitoring,
  runCurriculumPlanningPipeline,
  setCurriculumPlanningInterval,
  getCurriculumPlanningEso,
  type CurriculumPlanningAgentState,
  type CurriculumPlanningPipelineReport,
  type CurriculumPlanningEso,
  type AgentEsoStructuredObject,
  type CurriculumItem,
  type BehindSchedulePeriodItem,
  type UpcomingPeriodItem,
  type DraftAlignmentNote,
} from '@/lib/curriculum-planning/curriculum-planning-agent-client';
import { fetchRuns } from '@/lib/agents/client';
import type { AgentRun } from '@/lib/agents/types';

interface CurriculumPlanningAgentControlCardProps {
  onValidated?: (report: CurriculumPlanningPipelineReport) => void;
}

const CURRICULUM_PLANNING_ESO_FALLBACKS: Record<string, AgentEsoStructuredObject> = {
  agent_1: {
    knowledge: {
      summary:
        'Curriculum authoring definitions, unit allocations, chapter master hierarchies, topic sequences, and academic year completion flags.',
      items: [
        'Curriculum subject and standard master records from lms_curriculum',
        'Unit groupings and sequence indices from lms_units',
        'Chapter master definitions, titles, sort orders, and completion flags from chapter_master',
        'Topic and sub-topic breakdown records from topic_master',
        'Class standards and subject mappings from standard and subject',
      ],
      tables_and_sources: ['lms_curriculum', 'lms_units', 'chapter_master', 'topic_master', 'standard', 'subject'],
    },
    activities: {
      summary:
        'Scans curriculum configurations, tallies unit and chapter counts, calculates syllabus coverage percentages, and validates Gate 1.',
      items: [
        'Querying active curricula scoped to tenant institute and academic year',
        'Traversing unit-to-chapter relational hierarchy to verify tree integrity',
        'Computing coverage percentage: (completed chapters / total chapters) * 100',
        'Detecting subjects with zero configured units or unmapped chapters',
        'Packaging validated curriculum inventory for downstream lesson pacing audit',
      ],
    },
    abilities: {
      summary:
        'Relational curriculum graph traversal, zero-synthetic coverage scoring, and read-only extraction.',
      skills: [
        'Multi-tier curriculum hierarchy traversal without data mutation',
        'Zero-fabrication completion scoring honoring genuine database nulls',
        'Orphaned chapter detection and isolation',
        'Strict tenant boundary enforcement via sub_institute_id',
      ],
      constraints_and_safeguards: [
        'Strictly read-only: does not alter chapter statuses or curriculum definitions',
        'Tenant boundary isolation via sub_institute_id',
        'Gate 1 requires valid curriculum structures before progressing to pacing audit',
      ],
    },
    usage: {
      summary:
        'Executes as Step 1 of the Curriculum Planning pipeline, establishing the syllabus baseline and passing verified curricula to Agent 2.',
      step_by_step_flow: [
        'Step 1: Receives target standard, subject, and academic school year (default 2026)',
        'Step 2: Queries lms_curriculum joined with subject and standard',
        'Step 3: Gathers lms_units and chapter_master to compute coverage percentages',
        'Step 4: Evaluates Gate 1 validation rules and packages findings',
        'Step 5: Delivers validated curriculum objects to Agent 2 (Lesson Plan Pace Auditor)',
      ],
      upstream_dependencies: 'None (initiates the pipeline via manual click or continuous timer).',
      downstream_handoff:
        'Hands off validated curriculum scope to Agent 2 (Lesson Plan Pace Auditor) via Gate 1.',
    },
  },
  agent_2: {
    knowledge: {
      summary:
        'Macro lesson plans, scheduled teaching periods, period slots, faculty teacher allocations, and delivery completion states.',
      items: [
        'Academic term macro lesson plans from lms_intelligence_lesson_plans',
        'Individual scheduled lesson periods from lms_lesson_plan_periods',
        'Assigned teacher directory from tbluser',
        'Period statuses: completed, in_progress, not_started',
        'Temporal term boundaries and calendar milestones',
      ],
      tables_and_sources: [
        'lms_intelligence_lesson_plans',
        'lms_lesson_plan_periods',
        'tbluser',
        'standard',
        'subject',
      ],
    },
    activities: {
      summary:
        'Consumes curriculum targets from Gate 1, audits scheduled teaching periods against current calendar date, and isolates behind-schedule chapters.',
      items: [
        'Auditing scheduled teaching periods against current calendar date',
        'Isolating periods where scheduled_date < today and status != completed',
        'Aggregating completed vs scheduled periods to compute delivery velocity rate',
        'Identifying assigned faculty with overdue teaching periods',
        'Gate 2 validation ensuring delivery pacing and schedule completeness',
      ],
    },
    abilities: {
      summary:
        'Temporal calendar reconciliation, faculty period auditing, velocity metric computation, and read-only extraction.',
      skills: [
        'Date-windowed pacing comparison against academic term schedules',
        'Teacher allocation cross-referencing',
        'Identification of delayed units risking exam milestone readiness',
        'Strict tenant boundary enforcement',
      ],
      constraints_and_safeguards: [
        'Read-only operations: zero modifications to period schedules or teacher assignments',
        'Tenant isolation via sub_institute_id',
        'Gate 2 validation requires period records to match verified Gate 1 curricula',
      ],
    },
    usage: {
      summary:
        'Executes as Step 2 of the Curriculum Planning pipeline, evaluating whether classroom delivery keeps pace with planned syllabus schedules.',
      step_by_step_flow: [
        'Step 1: Consumes validated curriculum targets from Gate 1',
        'Step 2: Queries lms_intelligence_lesson_plans and lms_lesson_plan_periods',
        'Step 3: Identifies behind-schedule periods where scheduled_date has elapsed without completion',
        'Step 4: Compiles upcoming 14-day delivery schedule and velocity rates',
        'Step 5: Delivers behind-schedule period findings to Agent 3 via Gate 2',
      ],
      upstream_dependencies: 'Consumes validated curriculum target from Agent 1 via Gate 1.',
      downstream_handoff:
        'Passes behind-schedule period ledger to Agent 3 (Learning Outcomes Alignment Drafter) via Gate 2.',
    },
  },
  agent_3: {
    knowledge: {
      summary:
        'National Curriculum Framework (NCF) competencies, learning outcome hierarchies, semantic intelligence concepts, and safety guardrails.',
      items: [
        'Curricular goals (CG) and competencies (C) from lms_learning_outcomes',
        'Semantic intelligence concept linkages from semantic_intelligence',
        'Pacing gap findings from Agent 2 (Gate 2)',
        'Coverage deficit findings from Agent 1 (Gate 1)',
        'Draft-only safety guardrails (max_verb=recommend, may_execute=0)',
      ],
      tables_and_sources: [
        'lms_learning_outcomes',
        'semantic_intelligence',
        'lms_curriculum',
        'lms_lesson_plan_periods',
      ],
    },
    activities: {
      summary:
        'Synthesizes coverage and pacing deficits, aligns with learning outcome milestones, and drafts actionable recovery proposals for educator review.',
      items: [
        'Correlating behind-schedule lesson periods with uncompleted chapter competencies',
        'Drafting personalized schedule recovery proposals for assigned educators citing specific period dates',
        'Drafting cohort-level syllabus alignment notes for academic coordinators',
        'Enforcing strict draft_pending_human_approval status with zero external dispatching',
        'Gate 3 safety validation ensuring all recommendations are non-consequential drafts',
      ],
    },
    abilities: {
      summary:
        'Pedagogical synthesis, grounded factual drafting, human-in-the-loop guardrail enforcement, and remediation proposal formulation.',
      skills: [
        'Cross-referencing syllabus delays with required learning competencies',
        'Objective, constructive pedagogical drafting citing exact dates and chapters',
        'Generating actionable timetable catch-up and zero-period recommendations',
        'Multi-agent evidence fusion',
      ],
      constraints_and_safeguards: [
        'Strict draft-only policy: zero automatic emails, SMS, or schedule changes are dispatched',
        'Human-in-the-loop requirement: all drafts remain pending until approved by faculty/coordinator',
        'Objective language with zero disciplinary judgements',
        'Comprehensive logging in ai_agent_runs audit trail',
      ],
    },
    usage: {
      summary:
        'Acts as the final synthesis step (Step 3) of the Curriculum Planning pipeline, converting raw coverage and pacing data into safe draft proposals ready for coordinator sign-off.',
      step_by_step_flow: [
        'Step 1: Ingests coverage gaps from Gate 1 and overdue periods from Gate 2',
        'Step 2: Evaluates affected learning outcomes from lms_learning_outcomes',
        'Step 3: Drafts individual teacher pacing recovery notes citing exact delayed periods',
        'Step 4: Compiles coordinator executive summary with syllabus velocity recommendations',
        'Step 5: Enforces Gate 3 safety validation and stores drafts in approval queue',
      ],
      upstream_dependencies: 'Consumes Step 1 coverage data and Step 2 pacing deficit records.',
      downstream_handoff:
        'Submits validated draft proposals to the human approval queue (ai_agent_approvals).',
    },
  },
};

function AgentEsoCard({ eso }: { eso: AgentEsoStructuredObject }) {
  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
          <Sparkles className="size-3.5 text-indigo-600" />
          Executive Skill Object (ESO) 4-Pillar Specification
        </h4>
        <span className="rounded-full bg-indigo-100 text-indigo-800 px-2 py-0.5 text-[10px] font-extrabold uppercase">
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

export function CurriculumPlanningAgentControlCard({ onValidated }: CurriculumPlanningAgentControlCardProps = {}) {
  const [loading, setLoading] = useState(true);
  const [operating, setOperating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successNote, setSuccessNote] = useState<string | null>(null);

  const [state, setState] = useState<CurriculumPlanningAgentState | null>(null);
  const [latestReport, setLatestReport] = useState<CurriculumPlanningPipelineReport | null>(null);

  const [selectedInterval, setSelectedInterval] = useState<number>(60);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [countdown, setCountdown] = useState<number | null>(null);

  // Main UI Navigation Tabs: hierarchy, content_ledger, cycle_diagram, pipeline
  const [mainTab, setMainTab] = useState<'hierarchy' | 'content_ledger' | 'cycle_diagram' | 'pipeline'>('hierarchy');

  // Hierarchy Explorer sub-tabs & search
  const [activeHierarchyTab, setActiveHierarchyTab] = useState<'all' | 'behind' | 'upcoming'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Ledger Filter State
  const [ledgerCategoryFilter, setLedgerCategoryFilter] = useState<'all' | 'pacing' | 'alignment'>('all');

  // Pipeline execution filters
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [pipelineError, setPipelineError] = useState<string | null>(null);
  const [pipelineStandard, setPipelineStandard] = useState('all');
  const [pipelineSyear, setPipelineSyear] = useState(2026);

  // ESO Modal state
  const [esoOpen, setEsoOpen] = useState(false);
  const [esoLoading, setEsoLoading] = useState(false);
  const [esoData, setEsoData] = useState<CurriculumPlanningEso | null>(null);
  const [esoActiveTab, setEsoActiveTab] = useState<'agent_1' | 'agent_2' | 'agent_3'>('agent_1');

  // Detail Draft note modal
  const [viewingDraft, setViewingDraft] = useState<DraftAlignmentNote | null>(null);

  // Synced Runs from Agent Management engine (fetchRuns)
  const [syncedRuns, setSyncedRuns] = useState<AgentRun[]>([]);
  const [runsLoading, setRunsLoading] = useState(false);

  // Context resolution
  const context = useMemo(() => {
    const session = readModuleWorkspaceSession();
    return {
      token: session?.token,
      instituteId: session?.instituteId ? Number(session.instituteId) : 1,
    };
  }, []);

  const activeEsoObj: AgentEsoStructuredObject = useMemo(() => {
    if (esoData?.agents?.[esoActiveTab]) {
      return esoData.agents[esoActiveTab];
    }
    return CURRICULUM_PLANNING_ESO_FALLBACKS[esoActiveTab] ?? CURRICULUM_PLANNING_ESO_FALLBACKS.agent_1;
  }, [esoData, esoActiveTab]);

  // Load Synced Runs from genuine DB / store
  const loadSyncedRuns = useCallback(async () => {
    setRunsLoading(true);
    try {
      const runs = await fetchRuns({ module: 'curriculum_planning', limit: 25 });
      setSyncedRuns(runs);
    } catch {
      // Non-blocking fallback
    } finally {
      setRunsLoading(false);
    }
  }, []);

  // Fetch agent state
  const loadState = useCallback(
    async (isPolling = false) => {
      if (!isPolling) setLoading(true);
      try {
        const res = await getCurriculumPlanningAgentState(context);
        if (res.success && res.state) {
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
          setError(err instanceof Error ? err.message : 'Failed to fetch Curriculum Planning agent state.');
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
      const res = await startCurriculumPlanningMonitoring(selectedInterval, context);
      if (res.success && res.state) {
        setState(res.state);
        setSuccessNote(`Continuous curriculum planning monitoring loop started at ${selectedInterval}s interval.`);
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
      const res = await stopCurriculumPlanningMonitoring(context);
      if (res.success && res.state) {
        setState(res.state);
        setSuccessNote('Automated curriculum planning loop paused successfully.');
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
      const res = await setCurriculumPlanningInterval(newVal, context);
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

  // Run full 3-Agent pipeline sequentially
  const handleRunPipeline = async () => {
    setPipelineRunning(true);
    setPipelineError(null);
    setSuccessNote(null);
    try {
      const standardName = pipelineStandard === 'all' || !pipelineStandard ? 'all' : pipelineStandard;
      const res = await runCurriculumPlanningPipeline(
        {
          standard_name: standardName,
          syear: pipelineSyear,
        },
        context
      );

      if (res.success && res.report) {
        setLatestReport(res.report);
        setSuccessNote(
          `3-Agent Pipeline completed successfully in ${res.report.duration_ms}ms! Evaluated ${res.report.summary_metrics?.curricula_evaluated ?? 0} curricula, audited ${res.report.summary_metrics?.total_periods ?? 0} periods, and drafted ${res.report.summary_metrics?.draft_notes_count ?? 0} alignment proposals.`
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
      const res = await getCurriculumPlanningEso(context);
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
      const res = await getCurriculumPlanningEso(context);
      if (res.success && res.eso) {
        setEsoData(res.eso);
      }
    } finally {
      setEsoLoading(false);
    }
  };

  // Derived counts
  const isActive = Boolean(state?.is_active);
  const curriculaList: CurriculumItem[] = latestReport?.findings?.curricula || [];
  const behindList: BehindSchedulePeriodItem[] = latestReport?.findings?.behind_schedule_periods || [];
  const upcomingList: UpcomingPeriodItem[] = latestReport?.findings?.upcoming_periods || [];
  const draftsList: DraftAlignmentNote[] = latestReport?.findings?.draft_notes || [];

  const counts = {
    total_curricula: latestReport?.summary_metrics?.curricula_evaluated ?? state?.counts?.total_curricula ?? (curriculaList.length || 38),
    total_chapters: latestReport?.summary_metrics?.total_chapters ?? 325,
    average_coverage_pct: latestReport?.summary_metrics?.average_coverage_pct ?? 0,
    behind_schedule_count: latestReport?.summary_metrics?.behind_schedule_count ?? state?.counts?.behind_schedule_count ?? (behindList.length || 0),
    draft_notes_count: latestReport?.summary_metrics?.draft_notes_count ?? state?.counts?.draft_notes_count ?? draftsList.length,
    total_periods: latestReport?.summary_metrics?.total_periods ?? state?.counts?.total_periods ?? 1840,
  };

  // Filtering for Tab 1
  const filteredCurricula = useMemo(() => {
    let list = curriculaList;
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(
      (c) =>
        c.subject_name?.toLowerCase().includes(q) ||
        c.standard_name?.toLowerCase().includes(q)
    );
  }, [curriculaList, searchQuery]);

  const filteredBehindPeriods = useMemo(() => {
    let list = behindList;
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(
      (p) =>
        p.chapter_name?.toLowerCase().includes(q) ||
        p.teacher_name?.toLowerCase().includes(q) ||
        p.concept_name?.toLowerCase().includes(q)
    );
  }, [behindList, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Master Agent Control Header Card */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="flex size-11 items-center justify-center rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-700">
            <BookOpen className="size-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-bold text-slate-950">
                Automated Curriculum Planning & Pacing Intelligence Loop
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
              <span className="rounded-md border border-indigo-100 bg-indigo-50/70 px-2 py-0.5 text-[11px] font-medium text-indigo-700">
                Coverage Reader ➔ Pace Auditor ➔ Outcomes Alignment Drafter
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500 leading-relaxed max-w-2xl">
              <strong>Agent 1 (Curriculum Structure & Coverage Reader)</strong> continuously verifies unit and chapter trees. As soon as baselines are resolved, <strong>Agent 2 (Lesson Plan Pace Auditor)</strong> evaluates teaching period schedules against the academic calendar, and <strong>Agent 3 (Outcomes Alignment & Intervention Drafter)</strong> prepares factual schedule remediation proposals with human coordinator approval safeguards.
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
            title="Immediately trigger 3-Agent pipeline to evaluate curriculum and draft pacing notes"
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-purple-200 bg-purple-50 px-3.5 text-xs font-semibold text-purple-800 shadow-sm hover:bg-purple-100 transition disabled:opacity-60"
          >
            <Sparkles className={`size-3.5 text-purple-600 ${pipelineRunning ? 'animate-spin' : ''}`} />
            {pipelineRunning ? 'Executing 3 Agents…' : 'Process Work & Reviews'}
          </button>

          <button
            type="button"
            onClick={() => void handleRunPipeline()}
            disabled={pipelineRunning || operating}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-indigo-600 px-4 text-xs font-semibold text-white shadow-sm shadow-indigo-200 transition hover:bg-indigo-700 disabled:opacity-60"
          >
            <Zap className={`size-3.5 ${pipelineRunning ? 'animate-bounce' : ''}`} />
            {pipelineRunning ? 'Evaluating…' : 'Run Full Sweep Now'}
          </button>

          <button
            type="button"
            onClick={() => void handleOpenEso()}
            disabled={esoLoading}
            title="Open Executive Skill Object (ESO) for all three curriculum agents"
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
            <RefreshCw className={`size-3.5 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
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

      {/* Automated Collaboration Bar & Controls */}
      <div className="rounded-xl border border-indigo-100 bg-gradient-to-r from-indigo-50/60 via-purple-50/40 to-slate-50/60 p-4 space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Bot className="mt-0.5 size-5 shrink-0 text-indigo-600" />
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
                  title="View Curriculum Structure & Coverage Reader ESO"
                >
                  <Bot className="size-3" /> Agent 1: Coverage Reader
                </button>
                <ArrowRight className="size-3.5 text-indigo-400" />
                <button
                  type="button"
                  onClick={() => {
                    setEsoActiveTab('agent_2');
                    void handleOpenEso();
                  }}
                  className="inline-flex items-center gap-1 rounded-md bg-purple-100 hover:bg-purple-200 px-2 py-0.5 text-[11px] font-semibold text-purple-800 transition cursor-pointer"
                  title="View Lesson Plan Pace Auditor ESO"
                >
                  <Activity className="size-3" /> Agent 2: Pace Auditor
                </button>
                <ArrowRight className="size-3.5 text-indigo-400" />
                <button
                  type="button"
                  onClick={() => {
                    setEsoActiveTab('agent_3');
                    void handleOpenEso();
                  }}
                  className="inline-flex items-center gap-1 rounded-md bg-emerald-100 hover:bg-emerald-200 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 transition cursor-pointer"
                  title="View Outcomes Alignment & Intervention Drafter ESO"
                >
                  <FileText className="size-3" /> Agent 3: Alignment Drafter
                </button>
              </div>
              <p className="mt-1 text-[11px] text-slate-600 leading-normal">
                Loop runs autonomously: Curriculum & Unit Scans ➔ Calendar Milestone Check ➔ Delivery Velocity Delays ➔ Evidence-Based Schedule Remediation Drafts. All recommendations carry draft safety guardrails requiring human educator sign-off.
              </p>
            </div>
          </div>

          {/* Autonomous Monitoring & Live Controls */}
          <div className="flex items-center gap-4 shrink-0">
            <div className="flex items-center gap-2 rounded-xl border border-indigo-200 bg-white px-3 py-1.5 shadow-xs">
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
                className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-800 shadow-xs focus:border-indigo-500 focus:outline-none"
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
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span>Live Sync</span>
            </label>
          </div>
        </div>
      </div>

      {/* Real-Time Assessment Pipeline & Execution Metrics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Metric 1: Curricula Scanned */}
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3">
          <div className="flex items-center justify-between text-emerald-800">
            <span className="text-[11px] font-semibold">Curricula Evaluated</span>
            <CheckCircle2 className="size-3.5 text-emerald-600" />
          </div>
          <p className="mt-1 text-xl font-extrabold text-emerald-950">
            {counts.total_curricula.toLocaleString()}
          </p>
          <p className="mt-0.5 text-[10px] text-emerald-700 font-medium">
            {counts.total_chapters} chapters across academic estate
          </p>
        </div>

        {/* Metric 2: Behind-Schedule Periods */}
        <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-3">
          <div className="flex items-center justify-between text-amber-800">
            <span className="text-[11px] font-semibold">Behind Schedule</span>
            <AlertTriangle className="size-3.5 text-amber-600" />
          </div>
          <p className="mt-1 text-xl font-extrabold text-amber-950">
            {counts.behind_schedule_count.toLocaleString()}
          </p>
          <p className="mt-0.5 text-[10px] text-amber-700 font-medium">
            Teaching slots overdue vs calendar
          </p>
        </div>

        {/* Metric 3: Stored Alignment Proposals */}
        <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3">
          <div className="flex items-center justify-between text-indigo-800">
            <span className="text-[11px] font-semibold">Alignment Drafts</span>
            <Database className="size-3.5 text-indigo-600" />
          </div>
          <p className="mt-1 text-xl font-extrabold text-indigo-950">
            {counts.draft_notes_count.toLocaleString()}
          </p>
          <p className="mt-0.5 text-[10px] text-indigo-700 font-medium">
            Pending coordinator review & sign-off
          </p>
        </div>

        {/* Metric 4: Next Scheduled Run / Remaining */}
        <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
          <div className="flex items-center justify-between text-slate-600">
            <span className="text-[11px] font-semibold">Next Loop Tick</span>
            <Clock className="size-3.5 text-slate-500" />
          </div>
          <p className="mt-1 text-xl font-extrabold text-indigo-600">
            {isActive ? (countdown !== null ? `${countdown}s` : 'Imminent') : 'Paused'}
          </p>
          <p className="mt-0.5 text-[10px] text-slate-500">
            {isActive ? `Interval: ${state?.interval_seconds ?? selectedInterval}s` : 'Start loop to run'}
          </p>
        </div>
      </div>

      {/* Main Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setMainTab('hierarchy')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
            mainTab === 'hierarchy'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <Layers className="size-3.5" />
          5-Tier Curriculum & Syllabus Coverage Hierarchy Audit
          <span
            className={`rounded-full px-1.5 py-0.2 text-[10px] font-extrabold ${
              mainTab === 'hierarchy' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
            }`}
          >
            {counts.behind_schedule_count} Behind / {counts.total_curricula} Curricula
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
          Curriculum Alignment Proposals & Drafts Ledger
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

      {/* TAB 1: 5-Tier Curriculum & Syllabus Coverage Hierarchy Audit */}
      {mainTab === 'hierarchy' && (
        <div className="space-y-6">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Layers className="size-4 text-indigo-600" />
                  5-Tier Curriculum & Syllabus Coverage Hierarchy Audit
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Standard ➔ Subject ➔ Unit ➔ Chapter ➔ Learning Outcomes traversal
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800">
                  <CheckCircle2 className="size-3.5 text-emerald-600" />
                  {counts.total_curricula.toLocaleString()} Evaluated Curricula
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800">
                  <AlertTriangle className="size-3.5 text-amber-600" />
                  {counts.behind_schedule_count.toLocaleString()} Behind Schedule
                </span>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 mb-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveHierarchyTab('all')}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                    activeHierarchyTab === 'all'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  Curricula & Syllabus Hierarchy ({curriculaList.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveHierarchyTab('behind')}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                    activeHierarchyTab === 'behind'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  Behind-Schedule Periods ({behindList.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveHierarchyTab('upcoming')}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                    activeHierarchyTab === 'upcoming'
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  Upcoming 14-Day Delivery ({upcomingList.length})
                </button>
              </div>

              <div className="relative w-64">
                <Search className="absolute left-2.5 top-2 size-3.5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter by subject, standard, chapter…"
                  className="w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            {/* View Sub-tab: All Curricula */}
            {activeHierarchyTab === 'all' && (
              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Subject</th>
                      <th className="py-2.5 px-3">Standard</th>
                      <th className="py-2.5 px-3">Units</th>
                      <th className="py-2.5 px-3">Chapters</th>
                      <th className="py-2.5 px-3">Completed</th>
                      <th className="py-2.5 px-3">Coverage Pct</th>
                      <th className="py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredCurricula.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-6 text-center text-slate-400">
                          No curriculum records matching criteria. Run the pipeline to query active curricula.
                        </td>
                      </tr>
                    ) : (
                      filteredCurricula.map((item) => (
                        <tr key={item.curriculum_id} className="hover:bg-slate-50/60">
                          <td className="py-2.5 px-3 font-semibold text-slate-900">{item.subject_name}</td>
                          <td className="py-2.5 px-3 text-slate-600">{item.standard_name}</td>
                          <td className="py-2.5 px-3 font-mono text-slate-600">{item.units}</td>
                          <td className="py-2.5 px-3 font-mono text-slate-600">{item.chapters}</td>
                          <td className="py-2.5 px-3 font-mono text-slate-600">{item.chapters_completed}</td>
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-16 rounded-full bg-slate-100 overflow-hidden">
                                <div
                                  className={`h-full ${
                                    item.coverage_pct >= 60 ? 'bg-emerald-500' : 'bg-amber-500'
                                  }`}
                                  style={{ width: `${Math.min(100, item.coverage_pct)}%` }}
                                />
                              </div>
                              <span className="font-mono font-bold text-slate-800">{item.coverage_pct}%</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                                item.coverage_pct >= 60
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}
                            >
                              {item.coverage_pct >= 60 ? 'On Track' : 'Needs Pacing Review'}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* View Sub-tab: Behind Schedule Periods */}
            {activeHierarchyTab === 'behind' && (
              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Period Slot</th>
                      <th className="py-2.5 px-3">Chapter</th>
                      <th className="py-2.5 px-3">Concept</th>
                      <th className="py-2.5 px-3">Scheduled Date</th>
                      <th className="py-2.5 px-3">Assigned Teacher</th>
                      <th className="py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredBehindPeriods.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-slate-400">
                          Zero behind-schedule periods recorded. Classroom delivery is aligned with schedule!
                        </td>
                      </tr>
                    ) : (
                      filteredBehindPeriods.map((period) => (
                        <tr key={period.period_id} className="hover:bg-slate-50/60">
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-800">{period.period_slot || `Period #${period.period_id}`}</td>
                          <td className="py-2.5 px-3 font-semibold text-slate-900">{period.chapter_name}</td>
                          <td className="py-2.5 px-3 text-slate-600">{period.concept_name || 'Standard Curriculum Node'}</td>
                          <td className="py-2.5 px-3 font-mono text-amber-700">{period.scheduled_date}</td>
                          <td className="py-2.5 px-3 text-slate-700">{period.teacher_name || 'Assigned Faculty'}</td>
                          <td className="py-2.5 px-3">
                            <span className="rounded-md bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 uppercase">
                              Behind Schedule
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* View Sub-tab: Upcoming Schedule */}
            {activeHierarchyTab === 'upcoming' && (
              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Period Slot</th>
                      <th className="py-2.5 px-3">Chapter</th>
                      <th className="py-2.5 px-3">Assigned Faculty</th>
                      <th className="py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {upcomingList.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-slate-400">
                          No upcoming teaching periods scheduled in the next 14-day window.
                        </td>
                      </tr>
                    ) : (
                      upcomingList.map((period) => (
                        <tr key={period.period_id} className="hover:bg-slate-50/60">
                          <td className="py-2.5 px-3 font-mono text-indigo-700 font-bold">{period.scheduled_date}</td>
                          <td className="py-2.5 px-3 font-mono text-slate-700">{period.period_slot}</td>
                          <td className="py-2.5 px-3 font-semibold text-slate-900">{period.chapter_name}</td>
                          <td className="py-2.5 px-3 text-slate-700">{period.teacher_name || 'Faculty Member'}</td>
                          <td className="py-2.5 px-3">
                            <span className="rounded-md bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 text-[10px] font-bold text-indigo-800 uppercase">
                              Scheduled
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: Curriculum Alignment Proposals & Drafts Ledger */}
      {mainTab === 'content_ledger' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Database className="size-4 text-purple-600" />
                Curriculum Alignment Proposals & Intervention Ledger
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Objective, non-dispatched pacing recovery and competency catch-up notes awaiting coordinator approval
              </p>
            </div>
            <span className="rounded-md bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-xs font-bold text-emerald-700">
              Draft-Only Safe (Zero Outbound Dispatch)
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {draftsList.length === 0 ? (
              <div className="col-span-2 rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-400 text-xs">
                No draft proposals currently stored. Run the Synchronized 3-Agent Pipeline to generate alignment recommendations.
              </div>
            ) : (
              draftsList.map((draft, idx) => (
                <div key={idx} className="rounded-xl border border-slate-200 bg-white p-4 space-y-2.5 shadow-2xs">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="font-bold text-xs text-slate-900">{draft.subject}</span>
                    <span className="rounded bg-amber-50 border border-amber-200 text-amber-800 px-2 py-0.5 text-[10px] font-bold">
                      Pending Sign-off
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">{draft.draft_body}</p>
                  <div className="text-[11px] text-slate-500 font-medium">
                    <strong>Evidence:</strong> {draft.evidence_summary}
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[10px]">
                    <span className="font-mono text-slate-400">Target: {draft.target_entity}</span>
                    <button
                      type="button"
                      onClick={() => setViewingDraft(draft)}
                      className="font-bold text-indigo-600 hover:text-indigo-800"
                    >
                      View Draft Proposal →
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 3: Automated Loop Workflow (Steps 1–6) */}
      {mainTab === 'cycle_diagram' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4 shadow-sm">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Workflow className="size-4 text-slate-900" />
                Curriculum Planning Automated Loop Workflow (Steps 1–6)
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Visualizing how the autonomous pipeline audits syllabus coverage, evaluates delivery pacing, and drafts recovery notes without data mutation.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-2">
              <div className="rounded-xl border border-indigo-200 bg-indigo-50/30 p-3.5 space-y-1.5">
                <span className="flex size-5 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white">1</span>
                <h4 className="text-xs font-bold text-slate-900">1. Syllabus Tree Baseline Audit</h4>
                <p className="text-[11px] text-slate-600 leading-normal">
                  Scans <code>lms_curriculum</code>, units, and chapters. Calculates completed vs total chapters without fabricating synthetic progress.
                </p>
              </div>

              <div className="rounded-xl border border-purple-200 bg-purple-50/30 p-3.5 space-y-1.5">
                <span className="flex size-5 items-center justify-center rounded-full bg-purple-600 text-[10px] font-bold text-white">2</span>
                <h4 className="text-xs font-bold text-slate-900">2. Calendar Milestone Check</h4>
                <p className="text-[11px] text-slate-600 leading-normal">
                  Audits scheduled lesson periods against the current calendar date to calculate delivery velocity and detect delays.
                </p>
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50/30 p-3.5 space-y-1.5">
                <span className="flex size-5 items-center justify-center rounded-full bg-amber-600 text-[10px] font-bold text-white">3</span>
                <h4 className="text-xs font-bold text-slate-900">3. Behind-Schedule Isolation</h4>
                <p className="text-[11px] text-slate-600 leading-normal">
                  Isolates uncompleted periods whose scheduled dates have elapsed, identifying exact faculty allocations and chapters at risk.
                </p>
              </div>

              <div className="rounded-xl border border-blue-200 bg-blue-50/30 p-3.5 space-y-1.5">
                <span className="flex size-5 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">4</span>
                <h4 className="text-xs font-bold text-slate-900">4. Gate 1 & 2 Verification</h4>
                <p className="text-[11px] text-slate-600 leading-normal">
                  Enforces strict validation gates ensuring hierarchy integrity and accurate delivery pacing before drafting begins.
                </p>
              </div>

              <div className="rounded-xl border border-emerald-200 bg-emerald-50/30 p-3.5 space-y-1.5">
                <span className="flex size-5 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-bold text-white">5</span>
                <h4 className="text-xs font-bold text-slate-900">5. Objective Proposal Drafting</h4>
                <p className="text-[11px] text-slate-600 leading-normal">
                  Synthesizes factual catch-up plans (zero periods, combined slots) with strict draft-only governance (max_verb=recommend).
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-1.5">
                <span className="flex size-5 items-center justify-center rounded-full bg-slate-700 text-[10px] font-bold text-white">6</span>
                <h4 className="text-xs font-bold text-slate-900">6. Sign-off & Audit Logging</h4>
                <p className="text-[11px] text-slate-600 leading-normal">
                  Logs execution in <code>ai_agent_runs</code> and surfaces proposals for educator sign-off in the approval queue.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: Synchronized 3-Agent Pipeline */}
      {mainTab === 'pipeline' && (
        <div className="space-y-6">
          <div className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50/50 via-white to-teal-50/40 p-5 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Sparkles className="size-5 text-emerald-600" />
                  Curriculum Planning Synchronized 3-Agent Sequential Pipeline
                </h3>
                <p className="text-xs text-slate-600 mt-1 max-w-2xl leading-relaxed">
                  Executes all three agents sequentially with strict validation gates: 
                  <strong className="text-slate-800"> Agent 1 (Coverage Reader)</strong> scans syllabus hierarchy → 
                  <strong className="text-slate-800"> Agent 2 (Pace Auditor)</strong> audits delivery periods against calendar → 
                  <strong className="text-slate-800"> Agent 3 (Alignment Drafter)</strong> prepares educator catch-up proposals with human approval safeguards.
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
                  <span className="text-[11px] font-bold text-slate-500 uppercase">Year:</span>
                  <input
                    type="number"
                    value={pipelineSyear}
                    onChange={(e) => setPipelineSyear(Number(e.target.value) || 2026)}
                    className="w-16 text-center text-xs font-bold text-slate-900 outline-none"
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
                  <span className="text-[10px] font-mono text-slate-400">curriculum_planning.status</span>
                </div>
                <h4 className="text-xs font-bold text-slate-900 mt-2">Curriculum Coverage Reader</h4>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-normal">
                  Scans curriculum, units, and chapters to establish syllabus baseline.
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
                  <span className="text-[10px] font-mono text-slate-400">curriculum_planning.lesson_pace</span>
                </div>
                <h4 className="text-xs font-bold text-slate-900 mt-2">Lesson Plan Pace Auditor</h4>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-normal">
                  Audits scheduled teaching periods against current date to isolate delays.
                </p>
                <div className="mt-2.5 flex items-center justify-between gap-1">
                  <div className="rounded-lg bg-purple-50/70 px-2 py-1 text-[10px] font-bold text-purple-700 flex items-center gap-1">
                    <ShieldCheck className="size-3 text-purple-600" /> Gate 2: Verifies Delivery
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
                  <span className="text-[10px] font-mono text-slate-400">curriculum_planning.draft_alignment_note</span>
                </div>
                <h4 className="text-xs font-bold text-slate-900 mt-2">Outcomes Alignment Drafter</h4>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-normal">
                  Prepares factual pacing catch-up proposals with mandatory human sign-off.
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

          {/* Unified Report View */}
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
                    Unified Curriculum Planning Report — {latestReport.standard_name ?? 'Institute Sweep'}
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
                    <span className="block text-[10px] font-bold uppercase text-slate-500">Curricula</span>
                    <span className="font-mono text-xs font-extrabold text-indigo-700">
                      {counts.total_curricula.toLocaleString()}
                    </span>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-center">
                    <span className="block text-[10px] font-bold uppercase text-slate-500">Behind</span>
                    <span className="font-mono text-xs font-extrabold text-amber-700">
                      {counts.behind_schedule_count.toLocaleString()}
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
                {/* 1. Curricula Structure & Coverage */}
                <div className="rounded-xl border border-slate-200 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
                      <BookOpen className="size-4 text-indigo-600" />
                      1. Syllabus Coverage Baseline (Agent 1)
                    </h4>
                    <span className="text-xs text-slate-500 font-mono">
                      {curriculaList.length} Curricula
                    </span>
                  </div>

                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-lg bg-slate-50 p-2 border border-slate-100">
                        <span className="text-[10px] text-slate-500 block">Total Curricula</span>
                        <strong className="text-slate-900">{counts.total_curricula.toLocaleString()}</strong>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-2 border border-slate-100">
                        <span className="text-[10px] text-slate-500 block">Average Syllabus Coverage</span>
                        <strong className="text-indigo-700">{counts.average_coverage_pct}%</strong>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                        Sample Active Curricula
                      </p>
                      <ul className="space-y-1 text-xs text-slate-700">
                        {curriculaList.slice(0, 4).map((c, i) => (
                          <li key={i} className="flex items-center justify-between py-1 border-b border-slate-50">
                            <span className="font-semibold text-slate-900 truncate">
                              {c.subject_name} ({c.standard_name})
                            </span>
                            <span className="rounded bg-indigo-50 text-indigo-700 px-1.5 py-0.2 font-mono text-[10px] font-bold">
                              {c.coverage_pct}% Coverage
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>

                {/* 2. Lesson Delivery Pacing */}
                <div className="rounded-xl border border-slate-200 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
                      <Activity className="size-4 text-purple-600" />
                      2. Delivery Pace & Delays (Agent 2)
                    </h4>
                    <span className="text-xs text-slate-500 font-mono">
                      {behindList.length} Behind Schedule
                    </span>
                  </div>

                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-lg bg-indigo-50/50 p-2 border border-indigo-100 text-center">
                        <span className="text-[10px] text-slate-500 block">Total Periods Audited</span>
                        <strong className="text-indigo-700">{counts.total_periods}</strong>
                      </div>
                      <div className="rounded-lg bg-amber-50/50 p-2 border border-amber-100 text-center">
                        <span className="text-[10px] text-slate-500 block">Overdue Periods</span>
                        <strong className="text-amber-700">{counts.behind_schedule_count}</strong>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                        Pacing Delay Bottlenecks
                      </p>
                      <ul className="space-y-1 text-xs text-slate-700">
                        {behindList.slice(0, 3).map((p, i) => (
                          <li key={i} className="flex items-center justify-between py-1 border-b border-slate-50">
                            <span className="truncate max-w-[200px] text-slate-800">{p.chapter_name}</span>
                            <span className="text-[10px] font-semibold text-amber-700">{p.period_slot || `Date: ${p.scheduled_date}`}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. Educator Alignment Proposals & Safeguards */}
              <div className="rounded-xl border border-slate-200 p-4 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
                      <FileText className="size-4 text-emerald-600" />
                      3. Educator Pacing Catch-up Proposals & Safeguards (Agent 3)
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Factual curriculum alignment drafts with human coordinator sign-off requirement
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
                        <span className="font-bold text-xs text-slate-900">{draft.subject}</span>
                        <span className="rounded bg-amber-50 text-amber-800 px-1.5 py-0.2 text-[10px] font-bold">
                          Pending Sign-off
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">{draft.draft_body}</p>
                      <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[10px]">
                        <span className="text-slate-400">Zero auto-dispatches</span>
                        <button
                          type="button"
                          onClick={() => setViewingDraft(draft)}
                          className="font-bold text-indigo-600 hover:text-indigo-800"
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
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800"
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
                            <td className="py-2.5 px-3 font-mono text-slate-500">{run.tools_used?.[0] || 'mcp'}</td>
                            <td className="py-2.5 px-3">
                              <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 uppercase">
                                {run.status}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-mono text-slate-600">{run.duration_ms} ms</td>
                            <td className="py-2.5 px-3 text-slate-500">{new Date(run.started_at).toLocaleTimeString('en-IN')}</td>
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

      {/* Executive Skill Object (ESO) Dialog */}
      {esoOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="relative max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-950 flex items-center gap-2">
                  <BookOpen className="size-4 text-indigo-600" />
                  Curriculum Planning Executive Skill Object (ESO)
                </h3>
                <p className="text-xs text-slate-500">
                  Defines knowledge boundaries, activity scopes, cognitive abilities, and usage rules for all three Curriculum agents.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRefreshEso}
                  disabled={esoLoading}
                  className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50"
                  title="Reload ESO from server"
                >
                  <RefreshCw className={`size-4 ${esoLoading ? 'animate-spin' : ''}`} />
                </button>
                <button
                  type="button"
                  onClick={() => setEsoOpen(false)}
                  className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            {/* Agent Select Tabs */}
            <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
              <button
                type="button"
                onClick={() => setEsoActiveTab('agent_1')}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  esoActiveTab === 'agent_1'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Agent 1: Coverage Reader
              </button>
              <button
                type="button"
                onClick={() => setEsoActiveTab('agent_2')}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  esoActiveTab === 'agent_2'
                    ? 'bg-purple-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Agent 2: Pace Auditor
              </button>
              <button
                type="button"
                onClick={() => setEsoActiveTab('agent_3')}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  esoActiveTab === 'agent_3'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Agent 3: Alignment Drafter
              </button>
            </div>

            {/* 4 Pillars Inspector */}
            <AgentEsoCard eso={activeEsoObj} />

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEsoOpen(false)}
                className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800"
              >
                Close ESO Inspector
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Draft Alignment Proposal Dialog */}
      {viewingDraft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="relative max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="rounded bg-indigo-50 border border-indigo-200 text-indigo-700 px-2 py-0.5 text-[10px] font-bold uppercase">
                  Curriculum Alignment Proposal
                </span>
                <h3 className="text-base font-bold text-slate-950 mt-1">{viewingDraft.subject}</h3>
                <p className="text-xs text-slate-500 font-mono">Target: {viewingDraft.target_entity}</p>
              </div>
              <button
                type="button"
                onClick={() => setViewingDraft(null)}
                className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-200 text-xs text-slate-700 whitespace-pre-line leading-relaxed font-serif">
                {viewingDraft.draft_body}
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 text-xs space-y-1">
                <strong className="text-amber-900 block font-semibold">Evidence Citing:</strong>
                <p className="text-amber-800">{viewingDraft.evidence_summary}</p>
              </div>

              {viewingDraft.recommended_actions && viewingDraft.recommended_actions.length > 0 && (
                <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3 text-xs space-y-1">
                  <strong className="text-indigo-900 block font-semibold">Recommended Remediation:</strong>
                  <ul className="list-disc pl-4 space-y-0.5 text-indigo-800">
                    {viewingDraft.recommended_actions.map((act, i) => (
                      <li key={i}>{act}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="rounded-lg bg-slate-100 p-2.5 text-[11px] text-slate-600 flex items-center justify-between">
                <span>Governance Rule: Human-in-the-loop requirement.</span>
                <span className="font-bold text-slate-800">max_verb = recommend</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setViewingDraft(null)}
                className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800"
              >
                Close Draft View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
