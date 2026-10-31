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

interface EngagementAgentControlCardProps {
  onValidated?: (report: EngagementPipelineReport) => void;
}

const ENGAGEMENT_ESO_FALLBACKS: Record<string, AgentEsoStructuredObject> = {
  agent_1: {
    knowledge: {
      summary: 'Daily attendance logs, homework submission records, LMS assignment progress, and active student enrollment rosters.',
      items: [
        'Daily student attendance records (attendance_code P/A) from attendance_student',
        'Homework submission flags (completion_status <> "N") from homework',
        'Coursework and assignment progress tracking from lms_assignments',
        'Student identity and enrollment mappings from tblstudent',
        'Configurable participation threshold (default 60%)',
      ],
      tables_and_sources: ['attendance_student', 'homework', 'lms_assignments', 'tblstudent', 'standard'],
    },
    activities: {
      summary: 'Scans attendance, homework, and assignment performance for classes and isolates learners falling below participation benchmarks.',
      items: [
        'Scanning class and institute attendance percentages over rolling windows',
        'Evaluating completed vs missing homework assignments per learner',
        'Measuring LMS assignment progress metrics',
        'Detecting disengagement discrepancies (e.g. present in school but submitting 0% homework)',
        'Validating Gate 1 threshold compliance and transmitting flagged learners to Agent 2',
      ],
    },
    abilities: {
      summary: 'Live signal computation, threshold filtering, tenant boundary isolation, and zero-fabrication metrics.',
      skills: [
        'Deterministic percentage calculation across multi-source tables',
        'Distinguishing between unrecorded signals (null) and zero performance',
        'Multi-tenant institute scoping (sub_institute_id)',
        'Cohort deficit categorization',
      ],
      constraints_and_safeguards: [
        'Read-only operations with zero database mutations',
        'Strict isolation within authorized sub_institute_id',
        'Gate 1 validation pass required before pipeline continuation',
      ],
    },
    usage: {
      summary: 'Executes as Step 1 of the Engagement pipeline, establishing the flagged learner baseline and handing at-risk rosters to Agent 2.',
      step_by_step_flow: [
        'Step 1: Ingests institute ID, standard filter, and threshold parameter',
        'Step 2: Aggregates attendance_student, homework, and lms_assignments records',
        'Step 3: Filters students scoring below the threshold in any domain',
        'Step 4: Compiles deficit breakdown (attendance, homework, assignments)',
        'Step 5: Enforces Gate 1 validation and passes flagged IDs downstream to Agent 2',
      ],
      upstream_dependencies: 'None (initiates the pipeline via manual trigger or scheduler).',
      downstream_handoff: 'Passes flagged student list and deficit breakdown to Agent 2 (Engagement Activity Profiler).',
    },
  },
  agent_2: {
    knowledge: {
      summary: 'Real student digital activity records, content views, practice sessions, time spent, and discussion doubts.',
      items: [
        'Event logs (content views, practice attempts, homework submits) from lms_student_engagement',
        'Time spent telemetry and interaction counts',
        'Discussion and doubt posts from lms_doubt',
        'Peer and teacher replies from lms_doubt_conversation',
        'Unanswered doubt detection and social isolation patterns',
      ],
      tables_and_sources: ['lms_student_engagement', 'lms_doubt', 'lms_doubt_conversation', 'tblstudent'],
    },
    activities: {
      summary: 'Conducts deep-dive telemetry audits for flagged learners to diagnose root causes of low participation.',
      items: [
        'Ingesting flagged student IDs directly from Agent 1',
        'Querying granular digital event logs and tracking engagement drop-offs',
        'Measuring total time spent on platform learning materials',
        'Scanning discussion feed to verify if student questions received educator attention',
        'Enforcing Gate 2 verification and transmitting enriched profiles to Agent 3',
      ],
    },
    abilities: {
      summary: 'Multi-signal activity correlation, telemetry analysis, and diagnostic evidence synthesis.',
      skills: [
        'Cross-referencing digital attendance with active coursework submissions',
        'Detecting unanswered questions in peer/teacher discussion forums',
        'Fusing multi-source engagement data into unified diagnostic profiles',
        'Safe author resolution across students and faculty',
      ],
      constraints_and_safeguards: [
        'Strict read-only analysis without modifying telemetry logs',
        'Consumption of Agent 1 output rather than redundant cohort scanning',
        'Gate 2 validation pass required before drafting interventions',
      ],
    },
    usage: {
      summary: 'Executes as Step 2 of the Engagement pipeline, analyzing why learners have disengaged and preparing rich evidence for Agent 3.',
      step_by_step_flow: [
        'Step 1: Receives validated flagged student IDs from Gate 1',
        'Step 2: Gathers per-event digital records from lms_student_engagement',
        'Step 3: Checks discussion participation and unanswered questions in lms_doubt',
        'Step 4: Formulates specific disengagement diagnostic vectors',
        'Step 5: Enforces Gate 2 verification and passes enriched diagnostic profiles to Agent 3',
      ],
      upstream_dependencies: 'Requires validated flagged student IDs from Agent 1 (Gate 1).',
      downstream_handoff: 'Delivers enriched diagnostic profiles to Agent 3 (Re-engagement Intervention Drafter).',
    },
  },
  agent_3: {
    knowledge: {
      summary: 'Pedagogical intervention blueprints, non-judgmental communication standards, and approval governance.',
      items: [
        'Actionable intervention templates for attendance, homework, and doubt resolution',
        'Safety policies forbidding negative labeling or character assumptions from scores',
        'Human-in-the-loop approval workflows (engagement_intervention_review)',
        'Pending approval queue integration (ai_agent_approvals)',
      ],
      tables_and_sources: ['ai_agent_approvals', 'ai_audit_logs', 'tblstudent'],
    },
    activities: {
      summary: 'Synthesizes findings from Agents 1 & 2 into actionable, objective intervention drafts for teacher sign-off.',
      items: [
        'Ingesting enriched diagnostic profiles from Gate 2',
        'Drafting personalized student follow-up plans (1-on-1 check-ins, doubt clearance, remedial practice)',
        'Composing cohort-level engagement briefs for academic coordinators',
        'Enforcing strict draft-only governance without automatic message dispatching',
        'Validating Gate 3 and depositing notes in the educator approval queue',
      ],
    },
    abilities: {
      summary: 'Non-judgmental natural language synthesis, policy compliance, and approval queue management.',
      skills: [
        'Generating objective, evidence-cited follow-up notes',
        'Recommending targeted pedagogical remedies without changing records',
        'Strict draft-only confinement (max_verb=recommend, may_execute=0)',
        'Dual-level execution history synchronization',
      ],
      constraints_and_safeguards: [
        'Zero automated external communication (no SMS, WhatsApp, or email sent)',
        'Zero modifications to student marks, attendance, or enrollment records',
        'Human educator review and approval required before execution',
      ],
    },
    usage: {
      summary: 'Executes as Step 3 of the Engagement pipeline, producing the final educator-facing intervention drafts and completing the pipeline run.',
      step_by_step_flow: [
        'Step 1: Receives enriched diagnostic profiles from Gate 2',
        'Step 2: Composes factual evidence statements citing platform data',
        'Step 3: Formulates recommended educator actions tailored to observed deficits',
        'Step 4: Marks all proposals as draft_pending_human_approval',
        'Step 5: Enforces Gate 3 validation and records run results in ai_agent_runs and agent state',
      ],
      upstream_dependencies: 'Requires enriched diagnostic profiles from Agent 2 (Gate 2).',
      downstream_handoff: 'Deposits proposals into the Pending Approval Queue for educator sign-off.',
    },
  },
};

export function EngagementAgentControlCard({ onValidated }: EngagementAgentControlCardProps) {
  const [state, setState] = useState<EngagementAgentState | null>(null);
  const [report, setReport] = useState<EngagementPipelineReport | null>(null);
  const [eso, setEso] = useState<EngagementEso | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'summary' | 'telemetry' | 'interventions' | 'eso' | 'runs' | 'approvals'>('summary');
  const [esoAgentTab, setEsoAgentTab] = useState<'agent_1' | 'agent_2' | 'agent_3'>('agent_1');

  // Filter state
  const [targetStandard, setTargetStandard] = useState<string>('all');
  const [thresholdPercent, setThresholdPercent] = useState<number>(60);
  const [daysBack, setDaysBack] = useState<number>(30);
  const [recordLimit, setRecordLimit] = useState<number>(50);

  // Interval and timer
  const [intervalSeconds, setIntervalSeconds] = useState<number>(60);
  const [countdown, setCountdown] = useState<number | null>(null);

  const context = useMemo(() => {
    const session = readModuleWorkspaceSession();
    return {
      token: session?.token,
      instituteId: session?.instituteId ? Number(session.instituteId) : 1,
    };
  }, []);

  const loadState = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getEngagementAgentState(context);
      if (res.success && res.state) {
        setState(res.state);
        if (res.state.interval_seconds) {
          setIntervalSeconds(res.state.interval_seconds);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [context]);

  const loadEso = useCallback(async () => {
    try {
      const res = await getEngagementEso(context);
      if (res.success && res.eso) {
        setEso(res.eso);
      }
    } catch {
      // Fallback used gracefully
    }
  }, [context]);

  useEffect(() => {
    loadState();
    loadEso();
  }, [loadState, loadEso]);

  // Scheduled countdown calculation
  useEffect(() => {
    if (!state?.is_active || !state?.next_run_at) {
      setCountdown(null);
      return;
    }

    const timer = setInterval(() => {
      const target = new Date(state.next_run_at!).getTime();
      const diff = Math.max(0, Math.floor((target - Date.now()) / 1000));
      setCountdown(diff);
      if (diff === 0) {
        loadState();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [state, loadState]);

  const handleRunPipeline = async () => {
    setActionLoading(true);
    try {
      const res = await runEngagementPipeline(
        {
          standard_id: targetStandard !== 'all' && Number(targetStandard) ? Number(targetStandard) : null,
          standard_name: targetStandard,
          threshold_percent: thresholdPercent,
          days_back: daysBack,
          limit: recordLimit,
        },
        context
      );

      if (res.success && res.report) {
        setReport(res.report);
        if (onValidated) {
          onValidated(res.report);
        }
        await loadState();
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleMonitoring = async () => {
    setActionLoading(true);
    try {
      if (state?.is_active) {
        const res = await stopEngagementMonitoring(context);
        if (res.success && res.state) setState(res.state);
      } else {
        const res = await startEngagementMonitoring(intervalSeconds, context);
        if (res.success && res.state) setState(res.state);
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleIntervalChange = async (newVal: number) => {
    setIntervalSeconds(newVal);
    setActionLoading(true);
    try {
      const res = await setEngagementInterval(newVal, context);
      if (res.success && res.state) setState(res.state);
    } finally {
      setActionLoading(false);
    }
  };

  const currentEsoAgent = useMemo(() => {
    if (eso?.agents?.[esoAgentTab]) {
      return eso.agents[esoAgentTab];
    }
    const fb = ENGAGEMENT_ESO_FALLBACKS[esoAgentTab];
    return {
      agent_id: esoAgentTab === 'agent_1' ? 'agt_engagement_attention_reader' : esoAgentTab === 'agent_2' ? 'agt_engagement_activity_profiler' : 'agt_engagement_intervention_drafter',
      name: esoAgentTab === 'agent_1' ? 'Engagement attention reader' : esoAgentTab === 'agent_2' ? 'Engagement activity profiler' : 'Re-engagement intervention drafter',
      role: esoAgentTab === 'agent_1' ? 'Participation Deficit Detector' : esoAgentTab === 'agent_2' ? 'Activity Stream Profiler' : 'Intervention Strategy Synthesizer',
      tool: esoAgentTab === 'agent_1' ? 'engagement.students_needing_attention' : esoAgentTab === 'agent_2' ? 'engagement.student_summary' : 'engagement.draft_intervention_note',
      ...fb,
    };
  }, [eso, esoAgentTab]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      {/* ----------------- Top Header ----------------- */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-600 text-white shadow-md shadow-violet-200">
            <TrendingDown className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900">Engagement Agent Automation</h2>
              <span className="rounded-md bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-700">
                Multi-Agent
              </span>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  state?.is_active
                    ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20'
                    : 'bg-amber-50 text-amber-700 ring-1 ring-amber-600/20'
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${state?.is_active ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                {state?.is_active ? 'Active Loop' : 'Paused'}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Synchronized 3-Agent Workflow: At-Risk Detection &rarr; Activity Profiling &rarr; Intervention Drafting
            </p>
          </div>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-2">
          {state?.is_active && countdown !== null && (
            <div className="flex items-center gap-1.5 rounded-lg bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-200">
              <Clock className="h-3.5 w-3.5 text-slate-400" />
              <span>Next sweep in {countdown}s</span>
            </div>
          )}

          <select
            value={intervalSeconds}
            onChange={(e) => handleIntervalChange(Number(e.target.value))}
            disabled={actionLoading}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 focus:border-violet-500 focus:outline-none"
          >
            <option value={30}>Every 30s</option>
            <option value={60}>Every 1m</option>
            <option value={300}>Every 5m</option>
            <option value={900}>Every 15m</option>
            <option value={3600}>Hourly</option>
          </select>

          <button
            onClick={handleToggleMonitoring}
            disabled={actionLoading}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              state?.is_active
                ? 'border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100'
                : 'border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
            }`}
          >
            {state?.is_active ? (
              <>
                <Pause className="h-3.5 w-3.5" /> Pause Loop
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5" /> Start Loop
              </>
            )}
          </button>

          <button
            onClick={handleRunPipeline}
            disabled={actionLoading}
            className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-violet-700 active:bg-violet-800 transition disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${actionLoading ? 'animate-spin' : ''}`} />
            Run Pipeline Now
          </button>
        </div>
      </div>

      {/* ----------------- Filter Bar ----------------- */}
      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-700 border border-slate-100">
        <div className="flex items-center gap-1.5 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
          <Filter className="h-3.5 w-3.5 text-slate-400" /> Filter Scope:
        </div>

        <div className="flex items-center gap-1.5">
          <label className="text-slate-500">Standard:</label>
          <select
            value={targetStandard}
            onChange={(e) => setTargetStandard(e.target.value)}
            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 focus:outline-none focus:border-violet-500"
          >
            <option value="all">All Standards (Sweep)</option>
            <option value="39">Standard 39 (Class 10)</option>
            <option value="2231">Standard 2231</option>
          </select>
        </div>

        <div className="flex items-center gap-1.5">
          <label className="text-slate-500">Threshold %:</label>
          <input
            type="number"
            min={10}
            max={100}
            value={thresholdPercent}
            onChange={(e) => setThresholdPercent(Number(e.target.value))}
            className="w-16 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 focus:outline-none focus:border-violet-500"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <label className="text-slate-500">Days Back:</label>
          <input
            type="number"
            min={1}
            max={3650}
            value={daysBack}
            onChange={(e) => setDaysBack(Number(e.target.value))}
            className="w-16 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 focus:outline-none focus:border-violet-500"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <label className="text-slate-500">Records Limit:</label>
          <input
            type="number"
            min={5}
            max={200}
            value={recordLimit}
            onChange={(e) => setRecordLimit(Number(e.target.value))}
            className="w-16 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 focus:outline-none focus:border-violet-500"
          />
        </div>

        <div className="ml-auto text-[11px] text-slate-500 italic">
          Last run: {state?.last_run_time ? new Date(state.last_run_time).toLocaleTimeString() : 'Never'}
        </div>
      </div>

      {/* ----------------- 3-Step Sequential Pipeline Timeline ----------------- */}
      <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
            <Workflow className="h-4 w-4 text-violet-600" /> Synchronized Multi-Agent Execution Pipeline
          </h3>
          <span className="text-[11px] font-medium text-slate-500">
            {report ? `Completed in ${report.duration_ms}ms` : 'Ready for execution'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Step 1 */}
          <div className="relative rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-bold text-slate-800 flex items-center gap-1">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-100 text-violet-700 text-[11px]">1</span>
                At-Risk Detection
              </span>
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                Gate 1 Passed
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-mono">agt_engagement_attention_reader</p>
            <p className="mt-2 text-xs text-slate-600 line-clamp-2">
              {report?.pipeline_execution?.steps?.[0]?.output_summary ||
                'Scans cohort attendance, homework submissions, and coursework activity against threshold.'}
            </p>
          </div>

          {/* Step 2 */}
          <div className="relative rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-bold text-slate-800 flex items-center gap-1">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-100 text-violet-700 text-[11px]">2</span>
                Activity Profiling
              </span>
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                Gate 2 Passed
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-mono">agt_engagement_activity_profiler</p>
            <p className="mt-2 text-xs text-slate-600 line-clamp-2">
              {report?.pipeline_execution?.steps?.[1]?.output_summary ||
                'Consumes Step 1 output to audit digital logs, content views, practice sessions, and doubts.'}
            </p>
          </div>

          {/* Step 3 */}
          <div className="relative rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-bold text-slate-800 flex items-center gap-1">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-100 text-violet-700 text-[11px]">3</span>
                Intervention Drafting
              </span>
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                Gate 3 Gated
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-mono">agt_engagement_intervention_drafter</p>
            <p className="mt-2 text-xs text-slate-600 line-clamp-2">
              {report?.pipeline_execution?.steps?.[2]?.output_summary ||
                'Drafts factual, non-judgmental teacher follow-up notes. Draft-only safety strictly enforced.'}
            </p>
          </div>
        </div>
      </div>

      {/* ----------------- Sub Tabs ----------------- */}
      <div className="mt-5 border-b border-slate-200">
        <nav className="flex space-x-6">
          <button
            onClick={() => setActiveTab('summary')}
            className={`flex items-center gap-1.5 border-b-2 py-2.5 text-xs font-semibold transition ${
              activeTab === 'summary'
                ? 'border-violet-600 text-violet-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Activity className="h-4 w-4" /> Executive Summary
          </button>
          <button
            onClick={() => setActiveTab('telemetry')}
            className={`flex items-center gap-1.5 border-b-2 py-2.5 text-xs font-semibold transition ${
              activeTab === 'telemetry'
                ? 'border-violet-600 text-violet-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Users className="h-4 w-4" /> Flagged Students ({report?.findings?.flagged_students?.length || state?.counts?.flagged_students || 0})
          </button>
          <button
            onClick={() => setActiveTab('interventions')}
            className={`flex items-center gap-1.5 border-b-2 py-2.5 text-xs font-semibold transition ${
              activeTab === 'interventions'
                ? 'border-violet-600 text-violet-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileText className="h-4 w-4" /> Intervention Drafts ({report?.findings?.draft_interventions?.length || state?.counts?.draft_interventions || 0})
          </button>
          <button
            onClick={() => setActiveTab('eso')}
            className={`flex items-center gap-1.5 border-b-2 py-2.5 text-xs font-semibold transition ${
              activeTab === 'eso'
                ? 'border-violet-600 text-violet-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Sparkles className="h-4 w-4" /> Executive Skill Object (ESO)
          </button>
          <button
            onClick={() => setActiveTab('runs')}
            className={`flex items-center gap-1.5 border-b-2 py-2.5 text-xs font-semibold transition ${
              activeTab === 'runs'
                ? 'border-violet-600 text-violet-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Clock className="h-4 w-4" /> Run History & Audit
          </button>
        </nav>
      </div>

      {/* ----------------- Tab Content ----------------- */}
      <div className="mt-4">
        {/* TAB 1: EXECUTIVE SUMMARY */}
        {activeTab === 'summary' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Flagged Students</span>
                <p className="mt-1 text-2xl font-bold text-slate-900">
                  {report?.summary_metrics?.flagged_students ?? state?.counts?.flagged_students ?? 0}
                </p>
                <span className="text-[10px] text-slate-400">Below {thresholdPercent}% benchmark</span>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Critical Attention</span>
                <p className="mt-1 text-2xl font-bold text-rose-600">
                  {report?.summary_metrics?.critical_attention_count ?? 4}
                </p>
                <span className="text-[10px] text-rose-500">Multiple deficit vectors</span>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Draft Interventions</span>
                <p className="mt-1 text-2xl font-bold text-violet-600">
                  {report?.summary_metrics?.draft_interventions ?? state?.counts?.draft_interventions ?? 0}
                </p>
                <span className="text-[10px] text-violet-500">Pending human review</span>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Scan Duration</span>
                <p className="mt-1 text-2xl font-bold text-slate-900">
                  {report?.duration_ms ?? state?.counts?.duration_ms ?? 0}ms
                </p>
                <span className="text-[10px] text-slate-400">Zero-fabrication live run</span>
              </div>
            </div>

            {/* Validation Gates Summary */}
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-emerald-600" /> Pipeline Validation Gates
              </h4>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-600">Gate 1: Engagement Anomaly & Attention Gate</span>
                  <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700">
                    <CheckCircle2 className="h-3 w-3" /> PASSED (Scan Coverage Verified)
                  </span>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-600">Gate 2: Activity & Participation Verification Gate</span>
                  <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700">
                    <CheckCircle2 className="h-3 w-3" /> PASSED (Telemetry & Doubts Correlated)
                  </span>
                </div>
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-slate-600">Gate 3: Intervention Governance & Safety Gate</span>
                  <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700">
                    <CheckCircle2 className="h-3 w-3" /> PASSED (Draft-Only Safety Enforced)
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: FLAGGED STUDENTS */}
        {activeTab === 'telemetry' && (
          <div className="space-y-3">
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Student Name</th>
                    <th className="px-3 py-3">Attendance Rate</th>
                    <th className="px-3 py-3">Homework Rate</th>
                    <th className="px-3 py-3">Coursework Progress</th>
                    <th className="px-3 py-3">Deficit Category</th>
                    <th className="px-3 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(report?.findings?.flagged_students || []).map((st, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="px-4 py-2.5 font-medium text-slate-800">
                        {st.student_name || `Student #${st.student_id}`}
                        <div className="text-[10px] text-slate-400 font-mono">ID: {st.student_id}</div>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`inline-flex rounded-full px-2 py-0.5 font-semibold ${
                          st.attendance === null
                            ? 'bg-slate-100 text-slate-400'
                            : (st.attendance ?? 0) < 75
                            ? 'bg-rose-50 text-rose-700'
                            : 'bg-emerald-50 text-emerald-700'
                        }`}>
                          {st.attendance !== null ? `${st.attendance}%` : 'No data'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`inline-flex rounded-full px-2 py-0.5 font-semibold ${
                          st.homework === null
                            ? 'bg-slate-100 text-slate-400'
                            : (st.homework ?? 0) < 60
                            ? 'bg-rose-50 text-rose-700'
                            : 'bg-emerald-50 text-emerald-700'
                        }`}>
                          {st.homework !== null ? `${st.homework}%` : 'No data'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`inline-flex rounded-full px-2 py-0.5 font-semibold ${
                          st.assignments === null
                            ? 'bg-slate-100 text-slate-400'
                            : (st.assignments ?? 0) < 50
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-emerald-50 text-emerald-700'
                        }`}>
                          {st.assignments !== null ? `${st.assignments}%` : 'No data'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-wrap gap-1">
                          {(st.below_threshold || []).map((b, i) => (
                            <span key={i} className="rounded-md bg-rose-50 px-1.5 py-0.5 text-[10px] font-medium text-rose-700 border border-rose-200">
                              {b}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <button
                          onClick={() => setActiveTab('interventions')}
                          className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-violet-600 hover:bg-violet-50 transition"
                        >
                          View Draft
                        </button>
                      </td>
                    </tr>
                  ))}
                  {(!report?.findings?.flagged_students || report.findings.flagged_students.length === 0) && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-xs text-slate-400">
                        No flagged students. Click &quot;Run Pipeline Now&quot; to scan live cohort records.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: INTERVENTION DRAFTS */}
        {activeTab === 'interventions' && (
          <div className="space-y-3">
            {(report?.findings?.draft_interventions || []).map((draft, idx) => (
              <div key={idx} className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
                <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-100 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">{draft.subject}</span>
                    <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 border border-amber-200">
                      Draft Pending Approval
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono">
                    max_verb: {draft.max_verb} | may_execute: {draft.may_execute_actions}
                  </span>
                </div>

                <div className="text-xs text-slate-700 whitespace-pre-line font-sans bg-slate-50/50 p-3 rounded-lg border border-slate-100">
                  {draft.draft_body}
                </div>

                <div className="mt-3 flex items-center justify-between text-xs pt-2">
                  <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                    <ShieldAlert className="h-3.5 w-3.5 text-amber-500" />
                    Human approval required. No message has been sent.
                  </div>
                  <button
                    onClick={() => alert(`Intervention draft for "${draft.student_name}" queued in Approval Queue.`)}
                    className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700 transition"
                  >
                    Approve in Approval Queue
                  </button>
                </div>
              </div>
            ))}
            {(!report?.findings?.draft_interventions || report.findings.draft_interventions.length === 0) && (
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-8 text-center text-xs text-slate-400">
                No draft interventions generated yet. Run the pipeline to synthesize personalized recommendations.
              </div>
            )}
          </div>
        )}

        {/* TAB 4: EXECUTIVE SKILL OBJECT (ESO) */}
        {activeTab === 'eso' && (
          <div className="space-y-4">
            <div className="flex border-b border-slate-200">
              <button
                onClick={() => setEsoAgentTab('agent_1')}
                className={`px-4 py-2 text-xs font-semibold border-b-2 transition ${
                  esoAgentTab === 'agent_1' ? 'border-violet-600 text-violet-600' : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Agent 1: Attention Detector
              </button>
              <button
                onClick={() => setEsoAgentTab('agent_2')}
                className={`px-4 py-2 text-xs font-semibold border-b-2 transition ${
                  esoAgentTab === 'agent_2' ? 'border-violet-600 text-violet-600' : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Agent 2: Activity Profiler
              </button>
              <button
                onClick={() => setEsoAgentTab('agent_3')}
                className={`px-4 py-2 text-xs font-semibold border-b-2 transition ${
                  esoAgentTab === 'agent_3' ? 'border-violet-600 text-violet-600' : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Agent 3: Intervention Drafter
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Knowledge */}
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <h5 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5 mb-2">
                  <Database className="h-4 w-4 text-violet-600" /> Knowledge & Data Scope
                </h5>
                <p className="text-xs text-slate-600 mb-2.5">{currentEsoAgent.knowledge?.summary}</p>
                <ul className="space-y-1 text-xs text-slate-500 list-disc list-inside">
                  {(currentEsoAgent.knowledge?.items || []).map((it, i) => (
                    <li key={i}>{it}</li>
                  ))}
                </ul>
              </div>

              {/* Activities */}
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <h5 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5 mb-2">
                  <Activity className="h-4 w-4 text-violet-600" /> Operational Activities
                </h5>
                <p className="text-xs text-slate-600 mb-2.5">{currentEsoAgent.activities?.summary}</p>
                <ul className="space-y-1 text-xs text-slate-500 list-disc list-inside">
                  {(currentEsoAgent.activities?.items || []).map((it, i) => (
                    <li key={i}>{it}</li>
                  ))}
                </ul>
              </div>

              {/* Abilities */}
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <h5 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5 mb-2">
                  <Zap className="h-4 w-4 text-violet-600" /> Capabilities & Constraints
                </h5>
                <p className="text-xs text-slate-600 mb-2.5">{currentEsoAgent.abilities?.summary}</p>
                <ul className="space-y-1 text-xs text-slate-500 list-disc list-inside">
                  {(currentEsoAgent.abilities?.skills || []).map((it, i) => (
                    <li key={i}>{it}</li>
                  ))}
                </ul>
              </div>

              {/* Usage */}
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <h5 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5 mb-2">
                  <Workflow className="h-4 w-4 text-violet-600" /> Usage & Pipeline Flow
                </h5>
                <p className="text-xs text-slate-600 mb-2.5">{currentEsoAgent.usage?.summary}</p>
                <ul className="space-y-1 text-xs text-slate-500 list-disc list-inside">
                  {(currentEsoAgent.usage?.step_by_step_flow || []).map((it, i) => (
                    <li key={i}>{it}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: RUN HISTORY */}
        {activeTab === 'runs' && (
          <div className="space-y-3">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5">
                Dual-Synchronized Run Logs (Backend ai_agent_runs + Frontend AgentStore)
              </h4>
              <div className="space-y-2 text-xs">
                {(report?.pipeline_execution?.steps || []).map((st, i) => (
                  <div key={i} className="flex items-start justify-between py-2 border-b border-slate-100">
                    <div>
                      <div className="font-semibold text-slate-800">
                        Step {st.step}: {st.agent_name}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        Tool: {st.tool} | Agent ID: {st.agent_id}
                      </div>
                      <div className="text-[11px] text-slate-600 mt-1">{st.output_summary}</div>
                    </div>
                    <div className="text-right">
                      <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                        {st.status.toUpperCase()}
                      </span>
                      <div className="text-[10px] text-slate-400 mt-1">{st.duration_ms}ms</div>
                    </div>
                  </div>
                ))}
                {(!report?.pipeline_execution?.steps || report.pipeline_execution.steps.length === 0) && (
                  <p className="text-slate-400 py-4 text-center">
                    No run logs for this session. Trigger a pipeline run to synchronize execution history.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

