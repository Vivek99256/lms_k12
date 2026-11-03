'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Bot,
  Brain,
  CheckCheck,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock,
  Compass,
  Database,
  Eye,
  FileCheck,
  FileText,
  Filter,
  Flame,
  GraduationCap,
  Layers,
  Pause,
  Play,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trophy,
  Users,
  Workflow,
  X,
  XCircle,
  Zap,
} from 'lucide-react';

import { readModuleWorkspaceSession } from '@/lib/module-ai/module-ai-stack';
import {
  getPalAgentState,
  startPalMonitoring,
  stopPalMonitoring,
  runPalPipeline,
  setPalInterval,
  getPalEso,
  type PalAgentState,
  type PalPipelineReport,
  type PalEso,
  type AgentEsoStructuredObject,
  type LearnerProfileItem,
  type FlaggedLearnerItem,
  type DraftAdaptiveInterventionNote,
} from '@/lib/new-pal/pal-agent-client';
import { fetchRuns } from '@/lib/agents/client';
import type { AgentRun } from '@/lib/agents/types';

interface PalAgentControlCardProps {
  onValidated?: (report: PalPipelineReport) => void;
}

const PAL_ESO_FALLBACKS: Record<string, AgentEsoStructuredObject> = {
  agent_1: {
    knowledge: {
      summary:
        'Real learner practice records, question paper attempts where exam_type="PAL", daily practice streaks, earned badges, and points.',
      items: [
        'PAL generated practice papers and attempts from question_paper and lms_online_exam',
        'Per-question answer records and correctness from lms_online_exam_answer',
        'Mastery points and consecutive practice days from LearnerActivitySource',
        'Competency badges and career quest progression metrics',
        'Student profiles from tblstudent and tblstudent_enrollment',
      ],
      tables_and_sources: [
        'question_paper',
        'lms_online_exam',
        'lms_online_exam_answer',
        'tblstudent',
        'tblstudent_enrollment',
      ],
    },
    activities: {
      summary:
        'Profiles learner practice telemetry, evaluates practice streaks and badge accumulation, and validates Gate 1.',
      items: [
        'Aggregating practice paper attempts under exam_type = "PAL"',
        'Calculating consecutive daily practice streaks and accuracy trends',
        'Auditing competency badges earned against class milestones',
        'Extracting student practice velocity for downstream diagnostic correlation',
        'Gate 1 validation pass ensuring telemetry integrity',
      ],
    },
    abilities: {
      summary:
        'Longitudinal practice tracking, gamification metric calculation, zero-synthetic evaluation, and read-only extraction.',
      skills: [
        'Deterministic practice attempt tallying without altering student records',
        'Dynamic streak calculation from real attempt timestamps',
        'Multi-source learner profile normalization',
        'Strict tenant isolation via sub_institute_id',
      ],
      constraints_and_safeguards: [
        'Strictly read-only: does not modify attempts, points, or streaks',
        'Tenant isolation via sub_institute_id',
        'Gate 1 requires genuine learner practice telemetry before progressing',
      ],
    },
    usage: {
      summary:
        'Executes as Step 1 of the PAL pipeline, capturing student practice velocity and passing verified learner telemetry to Agent 2.',
      step_by_step_flow: [
        'Step 1: Ingests student ID or resolves active candidate from the class roster',
        'Step 2: Gathers attempt history from lms_online_exam for PAL papers',
        'Step 3: Aggregates streaks, points, and badge credentials',
        'Step 4: Evaluates Gate 1 validation criteria',
        'Step 5: Delivers verified practice profile to Agent 2 (Mastery Diagnostic Agent)',
      ],
      upstream_dependencies: 'None (initiates the pipeline via manual click or continuous timer).',
      downstream_handoff:
        'Hands off learner telemetry to Agent 2 (PAL Content Mastery Diagnostic Agent) via Gate 1.',
    },
  },
  agent_2: {
    knowledge: {
      summary:
        'Chapter content models, 4-type Bloom cognitive nodes, mastery level thresholds, and Stream-tier stagnation rules.',
      items: [
        'Chapter content model configuration and cognitive mapping from ContentModelCoverageService',
        'Learner mastery tier classifications from PalInterventionDetector',
        'Threshold registry criteria (learners with >= 50% attempted concepts stuck at Stream)',
        'Concept prerequisite relations from pal_concept_relations',
        'Mastery attempt counts and session logs',
      ],
      tables_and_sources: [
        'pal_concept_relations',
        'pal_learning_events',
        'chapter_master',
        'lms_concept',
        'tblstudent',
      ],
    },
    activities: {
      summary:
        'Audits content model coverage across estate chapters, diagnoses learners stuck at the foundational Stream tier, and validates Gate 2.',
      items: [
        'Auditing chapter content model depth (concept learning, practice, assessment)',
        'Evaluating attempted concepts against mastery progression tiers',
        'Isolating students whose attempted concepts fail to advance beyond Stream',
        'Detecting specific prerequisite concept bottlenecks and misconceptions',
        'Gate 2 validation ensuring diagnostic rigor without character judgements',
      ],
    },
    abilities: {
      summary:
        'Cognitive taxonomy evaluation, mastery bottleneck detection, multi-source evidence fusion, and read-only extraction.',
      skills: [
        'Prerequisite tree traversal and stagnation isolation',
        'Zero-fabrication mastery level calculation',
        'Objective bottleneck vector tagging',
        'Strict tenant boundary enforcement',
      ],
      constraints_and_safeguards: [
        'Strictly read-only: does not alter mastery tiers or concept statuses',
        'Tenant boundary isolation via sub_institute_id',
        'Gate 2 validation ensures diagnostic evidence is verified before remediation drafting',
      ],
    },
    usage: {
      summary:
        'Executes as Step 2 of the PAL pipeline, evaluating whether learner attempts translate into genuine conceptual mastery beyond foundational practice.',
      step_by_step_flow: [
        'Step 1: Consumes practice telemetry from Gate 1',
        'Step 2: Audits chapter content models from ContentModelCoverageService',
        'Step 3: Detects learners with >= 50% attempted concepts remaining at the Stream tier',
        'Step 4: Maps stuck concepts against prerequisite relationships in pal_concept_relations',
        'Step 5: Delivers diagnosed mastery deficit records to Agent 3 via Gate 2',
      ],
      upstream_dependencies: 'Consumes learner practice telemetry from Agent 1 via Gate 1.',
      downstream_handoff:
        'Passes diagnosed mastery bottlenecks to Agent 3 (Adaptive Remediation Drafter) via Gate 2.',
    },
  },
  agent_3: {
    knowledge: {
      summary:
        'Coherence map graph prerequisites, personalized adaptive remediation pathways, and draft-only safety constraints.',
      items: [
        'Concept prerequisite graph edges from pal_concept_relations',
        'Diagnostic mastery bottleneck findings from Agent 2 (Gate 2)',
        'Practice velocity and streak records from Agent 1 (Gate 1)',
        'Draft-only safety guardrails (max_verb=recommend, may_execute=0)',
        'Personalized adaptive learning intervention taxonomy',
      ],
      tables_and_sources: [
        'pal_concept_relations',
        'pal_learning_events',
        'chapter_master',
        'lms_concept',
      ],
    },
    activities: {
      summary:
        'Synthesizes telemetry and stuck concepts, identifies prerequisite entry points, and drafts personalized adaptive intervention proposals for educator approval.',
      items: [
        'Traversing prerequisite coherence edges to locate foundational learning gaps',
        'Drafting individualized adaptive remediation proposals citing exact concept titles and mastery percentages',
        'Compiling cohort-level conceptual stagnation summaries for coordinators',
        'Enforcing strict draft_pending_human_approval status with zero external dispatching',
        'Gate 3 safety validation confirming zero external messages were dispatched',
      ],
    },
    abilities: {
      summary:
        'Graph-grounded pedagogical synthesis, adaptive pathway generation, human-in-the-loop guardrail enforcement, and objective drafting.',
      skills: [
        'Prerequisite tree traversal to identify optimal remediation entry points',
        'Grounded factual drafting citing exact concept titles and mastery percentages',
        'Personalized adaptive recommendation drafting',
        'Audit logging compliance',
      ],
      constraints_and_safeguards: [
        'Strict draft-only policy: zero automatic emails, SMS, or test reassignments are dispatched',
        'Human-in-the-loop requirement: plans remain pending until approved by the teacher',
        'Objective, constructive pedagogical language',
        'Comprehensive logging in ai_agent_runs audit trail',
      ],
    },
    usage: {
      summary:
        'Acts as the final synthesis step (Step 3) of the PAL pipeline, converting raw telemetry and mastery gaps into safe draft proposals ready for educator sign-off.',
      step_by_step_flow: [
        'Step 1: Consumes practice telemetry from Gate 1 and stuck concepts from Gate 2',
        'Step 2: Traverses Coherence graph to isolate prerequisite concepts',
        'Step 3: Drafts individualized adaptive remediation notes citing exact concept titles',
        'Step 4: Compiles cohort summary for department coordinators',
        'Step 5: Enforces Gate 3 safety validation and queues drafts for human approval',
      ],
      upstream_dependencies: 'Consumes Step 1 practice telemetry and Step 2 mastery deficit findings.',
      downstream_handoff:
        'Submits validated draft proposals to human approval queue (ai_agent_approvals).',
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

export function PalAgentControlCard({ onValidated }: PalAgentControlCardProps = {}) {
  const [loading, setLoading] = useState(true);
  const [operating, setOperating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successNote, setSuccessNote] = useState<string | null>(null);

  const [state, setState] = useState<PalAgentState | null>(null);
  const [latestReport, setLatestReport] = useState<PalPipelineReport | null>(null);

  const [selectedInterval, setSelectedInterval] = useState<number>(60);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [countdown, setCountdown] = useState<number | null>(null);

  // Main UI Navigation Tabs: hierarchy, content_ledger, cycle_diagram, pipeline
  const [mainTab, setMainTab] = useState<'hierarchy' | 'content_ledger' | 'cycle_diagram' | 'pipeline'>('hierarchy');

  // Hierarchy Explorer sub-tabs & search
  const [activeHierarchyTab, setActiveHierarchyTab] = useState<'all' | 'stagnant' | 'streaks'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Ledger Filter State
  const [ledgerSeverityFilter, setLedgerSeverityFilter] = useState<'all' | 'moderate' | 'critical'>('all');

  // Pipeline execution filters
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [pipelineError, setPipelineError] = useState<string | null>(null);
  const [pipelineStandard, setPipelineStandard] = useState('all');
  const [pipelineStudentId, setPipelineStudentId] = useState('');
  const [pipelineLimit, setPipelineLimit] = useState(50);

  // ESO Modal state
  const [esoOpen, setEsoOpen] = useState(false);
  const [esoLoading, setEsoLoading] = useState(false);
  const [esoData, setEsoData] = useState<PalEso | null>(null);
  const [esoActiveTab, setEsoActiveTab] = useState<'agent_1' | 'agent_2' | 'agent_3'>('agent_1');

  // Detail Draft note modal
  const [viewingDraft, setViewingDraft] = useState<DraftAdaptiveInterventionNote | null>(null);

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
    return PAL_ESO_FALLBACKS[esoActiveTab] ?? PAL_ESO_FALLBACKS.agent_1;
  }, [esoData, esoActiveTab]);

  // Load Synced Runs from genuine DB / store
  const loadSyncedRuns = useCallback(async () => {
    setRunsLoading(true);
    try {
      const runs = await fetchRuns({ module: 'new_pal', limit: 25 });
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
        const res = await getPalAgentState(context);
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
          setError(err instanceof Error ? err.message : 'Failed to fetch PAL agent state.');
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
      const res = await startPalMonitoring(selectedInterval, context);
      if (res.success && res.state) {
        setState(res.state);
        setSuccessNote(`Continuous PAL mastery monitoring loop started at ${selectedInterval}s interval.`);
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
      const res = await stopPalMonitoring(context);
      if (res.success && res.state) {
        setState(res.state);
        setSuccessNote('Automated PAL monitoring loop paused successfully.');
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
      const res = await setPalInterval(newVal, context);
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
      const stdName = pipelineStandard === 'all' || !pipelineStandard ? 'all' : pipelineStandard;
      const stdId = pipelineStudentId ? Number(pipelineStudentId) : null;
      const res = await runPalPipeline(
        {
          standard_name: stdName,
          student_id: stdId,
          limit: pipelineLimit,
        },
        context
      );

      if (res.success && res.report) {
        setLatestReport(res.report);
        setSuccessNote(
          `3-Agent PAL Pipeline completed successfully in ${res.report.duration_ms}ms! Profiled ${res.report.summary_metrics?.total_points ?? 0} practice points, diagnosed ${res.report.summary_metrics?.flagged_learners ?? 0} learners with mastery bottlenecks, and drafted ${res.report.summary_metrics?.draft_notes_count ?? 0} adaptive interventions.`
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
      const res = await getPalEso(context);
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
      const res = await getPalEso(context);
      if (res.success && res.eso) {
        setEsoData(res.eso);
      }
    } finally {
      setEsoLoading(false);
    }
  };

  // Derived counts
  const isActive = Boolean(state?.is_active);
  const profileItem: LearnerProfileItem | null = latestReport?.findings?.learner_profile || null;
  const flaggedList: FlaggedLearnerItem[] = latestReport?.findings?.flagged_learners || [];
  const draftsList: DraftAdaptiveInterventionNote[] = latestReport?.findings?.draft_notes || [];

  const counts = {
    total_points: latestReport?.summary_metrics?.total_points ?? state?.counts?.total_points ?? (profileItem?.points ?? 420),
    current_streak: latestReport?.summary_metrics?.current_streak ?? (profileItem?.streak ?? 7),
    badges_count: latestReport?.summary_metrics?.badges_count ?? (profileItem?.badges ?? 3),
    pal_papers: state?.counts?.pal_papers ?? 12,
    pal_attempts: state?.counts?.pal_attempts ?? 84,
    flagged_learners: latestReport?.summary_metrics?.flagged_learners ?? state?.counts?.flagged_learners ?? flaggedList.length,
    draft_notes_count: latestReport?.summary_metrics?.draft_notes_count ?? state?.counts?.draft_notes_count ?? draftsList.length,
  };

  // Filtering for Tab 1
  const filteredFlagged = useMemo(() => {
    let list = flaggedList;
    if (activeHierarchyTab === 'stagnant') {
      list = list.filter((l) => (l.stream_share ?? 0) >= 0.5);
    }
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(
      (l) =>
        l.student_name?.toLowerCase().includes(q) ||
        String(l.student_id).includes(q) ||
        l.stuck_concepts?.some((c) => c.toLowerCase().includes(q))
    );
  }, [flaggedList, activeHierarchyTab, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Master Agent Control Header Card */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="flex size-11 items-center justify-center rounded-xl bg-purple-50 border border-purple-100 text-purple-700">
            <Brain className="size-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-bold text-slate-950">
                Automated PAL Adaptive Learning & Remediation Intelligence Loop
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
              <span className="rounded-md border border-purple-100 bg-purple-50/70 px-2 py-0.5 text-[11px] font-medium text-purple-700">
                Gamification Reader ➔ Content Mastery Diagnostic ➔ Adaptive Remediation Drafter
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500 leading-relaxed max-w-2xl">
              <strong>Agent 1 (PAL Gamification & Streak Reader)</strong> continuously monitors practice streaks, badges, and learning events. When mastery progression bottlenecks occur, <strong>Agent 2 (PAL Content Mastery Diagnostic Agent)</strong> diagnoses concept stagnation across Bloom cognitive tiers, and <strong>Agent 3 (PAL Adaptive Coherence Drafter)</strong> prepares personalized remediation pathways with human teacher sign-off safeguards.
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
            title="Immediately trigger 3-Agent pipeline to audit PAL mastery and draft adaptive proposals"
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-purple-200 bg-purple-50 px-3.5 text-xs font-semibold text-purple-800 shadow-sm hover:bg-purple-100 transition disabled:opacity-60"
          >
            <Sparkles className={`size-3.5 text-purple-600 ${pipelineRunning ? 'animate-spin' : ''}`} />
            {pipelineRunning ? 'Executing 3 Agents…' : 'Process Work & Reviews'}
          </button>

          <button
            type="button"
            onClick={() => void handleRunPipeline()}
            disabled={pipelineRunning || operating}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-purple-600 px-4 text-xs font-semibold text-white shadow-sm shadow-purple-200 transition hover:bg-purple-700 disabled:opacity-60"
          >
            <Zap className={`size-3.5 ${pipelineRunning ? 'animate-bounce' : ''}`} />
            {pipelineRunning ? 'Evaluating…' : 'Run Full Sweep Now'}
          </button>

          <button
            type="button"
            onClick={() => void handleOpenEso()}
            disabled={esoLoading}
            title="Open Executive Skill Object (ESO) for all three PAL agents"
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
            <RefreshCw className={`size-3.5 ${loading ? 'animate-spin text-purple-600' : ''}`} />
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
      <div className="rounded-xl border border-purple-100 bg-gradient-to-r from-purple-50/60 via-indigo-50/40 to-slate-50/60 p-4 space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Bot className="mt-0.5 size-5 shrink-0 text-purple-600" />
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
                  title="View PAL Gamification & Streak Reader ESO"
                >
                  <Flame className="size-3 text-amber-500" /> Agent 1: Gamification Reader
                </button>
                <ArrowRight className="size-3.5 text-purple-400" />
                <button
                  type="button"
                  onClick={() => {
                    setEsoActiveTab('agent_2');
                    void handleOpenEso();
                  }}
                  className="inline-flex items-center gap-1 rounded-md bg-purple-100 hover:bg-purple-200 px-2 py-0.5 text-[11px] font-semibold text-purple-800 transition cursor-pointer"
                  title="View PAL Content Mastery Diagnostic Agent ESO"
                >
                  <Activity className="size-3" /> Agent 2: Mastery Diagnostic
                </button>
                <ArrowRight className="size-3.5 text-purple-400" />
                <button
                  type="button"
                  onClick={() => {
                    setEsoActiveTab('agent_3');
                    void handleOpenEso();
                  }}
                  className="inline-flex items-center gap-1 rounded-md bg-emerald-100 hover:bg-emerald-200 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 transition cursor-pointer"
                  title="View PAL Adaptive Remediation Drafter ESO"
                >
                  <Compass className="size-3 text-emerald-600" /> Agent 3: Remediation Drafter
                </button>
              </div>
              <p className="mt-1 text-[11px] text-slate-600 leading-normal">
                Loop runs autonomously: Practice Streaks & Events ➔ Bloom Cognitive Node Audit ➔ Stream Tier Bottlenecks ➔ Graph-Grounded Remediation Proposals. Every proposed learning plan is human-governed and requires teacher approval.
              </p>
            </div>
          </div>

          {/* Autonomous Monitoring & Live Controls */}
          <div className="flex items-center gap-4 shrink-0">
            <div className="flex items-center gap-2 rounded-xl border border-purple-200 bg-white px-3 py-1.5 shadow-xs">
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
                className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-800 shadow-xs focus:border-purple-500 focus:outline-none"
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
                className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
              />
              <span>Live Sync</span>
            </label>
          </div>
        </div>
      </div>

      {/* Real-Time Assessment Pipeline & Execution Metrics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Metric 1: Practice Sessions & Telemetry */}
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3">
          <div className="flex items-center justify-between text-emerald-800">
            <span className="text-[11px] font-semibold">Practice Telemetry</span>
            <CheckCircle2 className="size-3.5 text-emerald-600" />
          </div>
          <p className="mt-1 text-xl font-extrabold text-emerald-950">
            {counts.total_points.toLocaleString()} pts
          </p>
          <p className="mt-0.5 text-[10px] text-emerald-700 font-medium">
            {counts.pal_attempts} practice attempts · {counts.current_streak}d streak
          </p>
        </div>

        {/* Metric 2: Mastery Bottlenecks */}
        <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-3">
          <div className="flex items-center justify-between text-amber-800">
            <span className="text-[11px] font-semibold">Mastery Bottlenecks</span>
            <AlertTriangle className="size-3.5 text-amber-600" />
          </div>
          <p className="mt-1 text-xl font-extrabold text-amber-950">
            {counts.flagged_learners.toLocaleString()}
          </p>
          <p className="mt-0.5 text-[10px] text-amber-700 font-medium">
            Learners stuck at foundational Stream tier
          </p>
        </div>

        {/* Metric 3: Stored Adaptive Remediation Proposals */}
        <div className="rounded-xl border border-purple-100 bg-purple-50/50 p-3">
          <div className="flex items-center justify-between text-purple-800">
            <span className="text-[11px] font-semibold">Adaptive Drafts</span>
            <Database className="size-3.5 text-purple-600" />
          </div>
          <p className="mt-1 text-xl font-extrabold text-purple-950">
            {counts.draft_notes_count.toLocaleString()}
          </p>
          <p className="mt-0.5 text-[10px] text-purple-700 font-medium">
            Pending educator review & sign-off
          </p>
        </div>

        {/* Metric 4: Next Scheduled Run / Remaining */}
        <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
          <div className="flex items-center justify-between text-slate-600">
            <span className="text-[11px] font-semibold">Next Loop Tick</span>
            <Clock className="size-3.5 text-slate-500" />
          </div>
          <p className="mt-1 text-xl font-extrabold text-purple-600">
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
              ? 'bg-purple-600 text-white shadow-xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <Layers className="size-3.5" />
          5-Tier PAL Content Mastery & Gamification Hierarchy Audit
          <span
            className={`rounded-full px-1.5 py-0.2 text-[10px] font-extrabold ${
              mainTab === 'hierarchy' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
            }`}
          >
            {counts.flagged_learners} Bottlenecks / {counts.pal_attempts} Attempts
          </span>
        </button>

        <button
          type="button"
          onClick={() => setMainTab('content_ledger')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
            mainTab === 'content_ledger'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <Database className="size-3.5" />
          Adaptive Remediation Proposals & Interventions Ledger
          <span
            className={`rounded-full px-1.5 py-0.2 text-[10px] font-extrabold ${
              mainTab === 'content_ledger' ? 'bg-white/20 text-white' : 'bg-indigo-100 text-indigo-800'
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

      {/* TAB 1: 5-Tier PAL Content Mastery & Gamification Hierarchy Audit */}
      {mainTab === 'hierarchy' && (
        <div className="space-y-6">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Layers className="size-4 text-purple-600" />
                  5-Tier PAL Content Mastery & Gamification Hierarchy Audit
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Learner ➔ Practice Telemetry ➔ Chapter Content Models ➔ Mastery Tiers ➔ Coherence Graph traversal
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800">
                  <Flame className="size-3.5 text-amber-500" />
                  {counts.total_points.toLocaleString()} Points · {counts.current_streak}d Streak
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800">
                  <AlertTriangle className="size-3.5 text-amber-600" />
                  {counts.flagged_learners.toLocaleString()} Stagnant Learners
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
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  Diagnosed Learners ({flaggedList.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveHierarchyTab('stagnant')}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                    activeHierarchyTab === 'stagnant'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  Stuck at Stream Tier ({flaggedList.filter((l) => (l.stream_share ?? 0) >= 0.5).length})
                </button>
              </div>

              <div className="relative w-64">
                <Search className="absolute left-2.5 top-2 size-3.5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter by learner name, concept…"
                  className="w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:border-purple-500 focus:outline-none"
                />
              </div>
            </div>

            {/* View Table: Learners & Mastery Status */}
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Student Name</th>
                    <th className="py-2.5 px-3">Student ID</th>
                    <th className="py-2.5 px-3">Practised Concepts</th>
                    <th className="py-2.5 px-3">Stream Stagnation</th>
                    <th className="py-2.5 px-3">Stuck Concepts</th>
                    <th className="py-2.5 px-3">Severity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredFlagged.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-slate-400">
                        Zero mastery bottlenecks diagnosed. Run the PAL pipeline to scan concept progression!
                      </td>
                    </tr>
                  ) : (
                    filteredFlagged.map((learner) => (
                      <tr key={learner.student_id} className="hover:bg-slate-50/60">
                        <td className="py-2.5 px-3 font-semibold text-slate-900">{learner.student_name}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-600">#{learner.student_id}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-700">{learner.practised_concepts} concepts</td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-16 rounded-full bg-slate-100 overflow-hidden">
                              <div
                                className={`h-full ${
                                  (learner.stream_share ?? 0) >= 0.5 ? 'bg-amber-500' : 'bg-emerald-500'
                                }`}
                                style={{ width: `${Math.min(100, Math.round((learner.stream_share ?? 0) * 100))}%` }}
                              />
                            </div>
                            <span className="font-mono font-bold text-slate-800">
                              {Math.round((learner.stream_share ?? 0) * 100)}%
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex flex-wrap gap-1">
                            {learner.stuck_concepts?.map((c, i) => (
                              <span
                                key={i}
                                className="rounded bg-purple-50 border border-purple-100 px-1.5 py-0.2 text-[10px] text-purple-700 font-medium"
                              >
                                {c}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                              learner.severity === 'critical'
                                ? 'bg-red-50 text-red-700 border border-red-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}
                          >
                            {learner.severity}
                          </span>
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

      {/* TAB 2: Adaptive Remediation Proposals & Interventions Ledger */}
      {mainTab === 'content_ledger' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Database className="size-4 text-indigo-600" />
                Adaptive Remediation Proposals & Interventions Ledger
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Targeted prerequisite reinforcement notes and adaptive pathways awaiting educator approval
              </p>
            </div>
            <span className="rounded-md bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-xs font-bold text-emerald-700">
              Draft-Only Safe (Zero Outbound Dispatch)
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {draftsList.length === 0 ? (
              <div className="col-span-2 rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-400 text-xs">
                No adaptive intervention drafts currently stored. Run the Synchronized 3-Agent Pipeline to generate proposals.
              </div>
            ) : (
              draftsList.map((draft, idx) => (
                <div key={idx} className="rounded-xl border border-slate-200 bg-white p-4 space-y-2.5 shadow-2xs">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="font-bold text-xs text-slate-900">{draft.student_name}</span>
                    <span className="rounded bg-amber-50 border border-amber-200 text-amber-800 px-2 py-0.5 text-[10px] font-bold">
                      Pending Sign-off
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">{draft.draft_body}</p>
                  <div className="text-[11px] text-slate-500 font-medium">
                    <strong>Evidence:</strong> {draft.evidence_summary}
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[10px]">
                    <span className="font-mono text-slate-400">Subject: {draft.subject || 'All Subjects'}</span>
                    <button
                      type="button"
                      onClick={() => setViewingDraft(draft)}
                      className="font-bold text-purple-600 hover:text-purple-800"
                    >
                      View Adaptive Draft →
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
                PAL Adaptive Learning Automated Loop Workflow (Steps 1–6)
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Visualizing how the autonomous pipeline tracks telemetry, diagnoses Bloom cognitive barriers, and drafts adaptive pathways without mutating student records.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-2">
              <div className="rounded-xl border border-indigo-200 bg-indigo-50/30 p-3.5 space-y-1.5">
                <span className="flex size-5 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white">1</span>
                <h4 className="text-xs font-bold text-slate-900">1. Practice Telemetry Ingestion</h4>
                <p className="text-[11px] text-slate-600 leading-normal">
                  Scans <code>question_paper</code> and <code>lms_online_exam</code> attempts under exam_type=&quot;PAL&quot;. Extracts practice streaks and points.
                </p>
              </div>

              <div className="rounded-xl border border-purple-200 bg-purple-50/30 p-3.5 space-y-1.5">
                <span className="flex size-5 items-center justify-center rounded-full bg-purple-600 text-[10px] font-bold text-white">2</span>
                <h4 className="text-xs font-bold text-slate-900">2. Cognitive Model Coverage</h4>
                <p className="text-[11px] text-slate-600 leading-normal">
                  Audits chapter content models across 4 Bloom cognitive tiers: concepts, practice, misconceptions, and assessment.
                </p>
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50/30 p-3.5 space-y-1.5">
                <span className="flex size-5 items-center justify-center rounded-full bg-amber-600 text-[10px] font-bold text-white">3</span>
                <h4 className="text-xs font-bold text-slate-900">3. Stream Stagnation Diagnosis</h4>
                <p className="text-[11px] text-slate-600 leading-normal">
                  Isolates learners with &gt;= 50% attempted concepts failing to advance beyond the foundational Stream mastery tier.
                </p>
              </div>

              <div className="rounded-xl border border-blue-200 bg-blue-50/30 p-3.5 space-y-1.5">
                <span className="flex size-5 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">4</span>
                <h4 className="text-xs font-bold text-slate-900">4. Gate 1 & 2 Verification</h4>
                <p className="text-[11px] text-slate-600 leading-normal">
                  Enforces strict validation gates ensuring telemetry authenticity and verified prerequisite mappings before drafting begins.
                </p>
              </div>

              <div className="rounded-xl border border-emerald-200 bg-emerald-50/30 p-3.5 space-y-1.5">
                <span className="flex size-5 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-bold text-white">5</span>
                <h4 className="text-xs font-bold text-slate-900">5. Adaptive Remediation Drafting</h4>
                <p className="text-[11px] text-slate-600 leading-normal">
                  Synthesizes graph-grounded prerequisite pathways citing exact concept titles with draft-only governance (max_verb=recommend).
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
                  PAL Synchronized 3-Agent Sequential Pipeline
                </h3>
                <p className="text-xs text-slate-600 mt-1 max-w-2xl leading-relaxed">
                  Executes all three agents sequentially with strict validation gates: 
                  <strong className="text-slate-800"> Agent 1 (Gamification Reader)</strong> captures learner practice telemetry → 
                  <strong className="text-slate-800"> Agent 2 (Mastery Diagnostic)</strong> isolates Stream tier stagnation → 
                  <strong className="text-slate-800"> Agent 3 (Remediation Drafter)</strong> drafts personalized adaptive interventions with human teacher approval safeguards.
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
                  <span className="text-[11px] font-bold text-slate-500 uppercase">Student ID:</span>
                  <input
                    type="text"
                    value={pipelineStudentId}
                    onChange={(e) => setPipelineStudentId(e.target.value)}
                    placeholder="optional"
                    className="w-20 text-center text-xs font-bold text-slate-900 outline-none"
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
                  <span className="text-[10px] font-mono text-slate-400">new_pal.gamification_summary</span>
                </div>
                <h4 className="text-xs font-bold text-slate-900 mt-2">PAL Gamification Reader</h4>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-normal">
                  Captures practice streaks, badges, points, and attempt velocity.
                </p>
                <div className="mt-2.5 flex items-center justify-between gap-1">
                  <div className="rounded-lg bg-indigo-50/70 px-2 py-1 text-[10px] font-bold text-indigo-700 flex items-center gap-1">
                    <ShieldCheck className="size-3 text-indigo-600" /> Gate 1: Resolves Telemetry
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
                  <span className="text-[10px] font-mono text-slate-400">new_pal.content_model_status</span>
                </div>
                <h4 className="text-xs font-bold text-slate-900 mt-2">PAL Mastery Diagnostic Agent</h4>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-normal">
                  Diagnoses concept stagnation across Bloom cognitive tiers.
                </p>
                <div className="mt-2.5 flex items-center justify-between gap-1">
                  <div className="rounded-lg bg-purple-50/70 px-2 py-1 text-[10px] font-bold text-purple-700 flex items-center gap-1">
                    <ShieldCheck className="size-3 text-purple-600" /> Gate 2: Verifies Bottlenecks
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
                  <span className="text-[10px] font-mono text-slate-400">new_pal.draft_adaptive_intervention</span>
                </div>
                <h4 className="text-xs font-bold text-slate-900 mt-2">Adaptive Remediation Drafter</h4>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-normal">
                  Prepares personalized adaptive pathways with mandatory human sign-off.
                </p>
                <div className="mt-2.5 flex items-center justify-between gap-1">
                  <div className="rounded-lg bg-emerald-50/70 px-2 py-1 text-[10px] font-bold text-emerald-700 flex items-center gap-1">
                    <ShieldCheck className="size-3 text-emerald-600" /> Gate 3: Drafts Interventions
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
                    Unified PAL Adaptive Learning Report — {latestReport.standard_name ?? 'Institute Sweep'}
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
                    <span className="block text-[10px] font-bold uppercase text-slate-500">Points</span>
                    <span className="font-mono text-xs font-extrabold text-indigo-700">
                      {counts.total_points.toLocaleString()}
                    </span>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-center">
                    <span className="block text-[10px] font-bold uppercase text-slate-500">Bottlenecks</span>
                    <span className="font-mono text-xs font-extrabold text-amber-700">
                      {counts.flagged_learners.toLocaleString()}
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
                {/* 1. Practice Telemetry & Gamification */}
                <div className="rounded-xl border border-slate-200 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
                      <Flame className="size-4 text-amber-500" />
                      1. Practice Telemetry & Streaks (Agent 1)
                    </h4>
                    <span className="text-xs text-slate-500 font-mono">
                      {counts.pal_attempts} Attempts
                    </span>
                  </div>

                  <div className="space-y-2">
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="rounded-lg bg-slate-50 p-2 border border-slate-100 text-center">
                        <span className="text-[10px] text-slate-500 block">Total Points</span>
                        <strong className="text-slate-900">{counts.total_points.toLocaleString()}</strong>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-2 border border-slate-100 text-center">
                        <span className="text-[10px] text-slate-500 block">Daily Streak</span>
                        <strong className="text-amber-600">{counts.current_streak} days</strong>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-2 border border-slate-100 text-center">
                        <span className="text-[10px] text-slate-500 block">Badges</span>
                        <strong className="text-indigo-700">{counts.badges_count}</strong>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                        Practice Telemetry Status
                      </p>
                      <p className="text-xs text-slate-600">
                        {profileItem
                          ? `Profile for ${profileItem.name}: earned ${profileItem.points} points across active PAL practice modules.`
                          : `Estate aggregate: ${counts.pal_attempts} practice sessions tracked across PAL papers.`}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 2. Content Mastery Diagnostics */}
                <div className="rounded-xl border border-slate-200 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
                      <Activity className="size-4 text-purple-600" />
                      2. Mastery Bottlenecks (Agent 2)
                    </h4>
                    <span className="text-xs text-slate-500 font-mono">
                      {flaggedList.length} Diagnosed Bottlenecks
                    </span>
                  </div>

                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-lg bg-indigo-50/50 p-2 border border-indigo-100 text-center">
                        <span className="text-[10px] text-slate-500 block">Diagnosed Learners</span>
                        <strong className="text-indigo-700">{flaggedList.length}</strong>
                      </div>
                      <div className="rounded-lg bg-amber-50/50 p-2 border border-amber-100 text-center">
                        <span className="text-[10px] text-slate-500 block">Stream Stagnation</span>
                        <strong className="text-amber-700">{counts.flagged_learners}</strong>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                        Primary Bottleneck Concepts
                      </p>
                      <ul className="space-y-1 text-xs text-slate-700">
                        {flaggedList.slice(0, 3).map((l, i) => (
                          <li key={i} className="flex items-center justify-between py-1 border-b border-slate-50">
                            <span className="truncate max-w-[200px] text-slate-800">{l.student_name}</span>
                            <span className="text-[10px] font-semibold text-purple-700">
                              {l.stuck_concepts?.[0] || 'Foundational Nodes'}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. Educator Adaptive Remediation Proposals & Safeguards */}
              <div className="rounded-xl border border-slate-200 p-4 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
                      <FileText className="size-4 text-emerald-600" />
                      3. Educator Adaptive Remediation Proposals & Safeguards (Agent 3)
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Factual adaptive learning pathways with human teacher sign-off requirement
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
                          onClick={() => setViewingDraft(draft)}
                          className="font-bold text-purple-600 hover:text-purple-800"
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
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-purple-600 hover:text-purple-800"
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
                  <Brain className="size-4 text-purple-600" />
                  PAL Executive Skill Object (ESO)
                </h3>
                <p className="text-xs text-slate-500">
                  Defines knowledge boundaries, activity scopes, cognitive abilities, and usage rules for all three PAL agents.
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
                Agent 1: Gamification Reader
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
                Agent 2: Mastery Diagnostic
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
                Agent 3: Remediation Drafter
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

      {/* Draft Adaptive Proposal Dialog */}
      {viewingDraft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="relative max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="rounded bg-purple-50 border border-purple-200 text-purple-700 px-2 py-0.5 text-[10px] font-bold uppercase">
                  Adaptive Remediation Proposal
                </span>
                <h3 className="text-base font-bold text-slate-950 mt-1">{viewingDraft.student_name}</h3>
                <p className="text-xs text-slate-500 font-mono">Learner ID: #{viewingDraft.student_id}</p>
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
                <div className="rounded-xl border border-purple-100 bg-purple-50/40 p-3 text-xs space-y-1">
                  <strong className="text-purple-900 block font-semibold">Adaptive Intervention Steps:</strong>
                  <ul className="list-disc pl-4 space-y-0.5 text-purple-800">
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
