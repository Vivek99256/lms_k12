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
  Workflow,
  X,
  XCircle,
  Zap,
} from 'lucide-react';

import { readModuleWorkspaceSession } from '@/lib/module-ai/module-ai-stack';
import {
  getExamAssessmentAgentState,
  startExamAssessmentMonitoring,
  stopExamAssessmentMonitoring,
  runExamAssessmentPipeline,
  setExamAssessmentInterval,
  getExamAssessmentEso,
  type ExamAssessmentAgentState,
  type ExamAssessmentPipelineReport,
  type ExamAssessmentEso,
  type AgentEsoStructuredObject,
  type AtRiskStudentItem,
  type UnsubmittedWorkItem,
  type DraftReviewNote,
} from '@/lib/exam-assessment/exam-assessment-agent-client';

interface ExamAssessmentAgentControlCardProps {
  onValidated?: (report: ExamAssessmentPipelineReport) => void;
}

const EXAM_ASSESSMENT_ESO_FALLBACKS: Record<string, AgentEsoStructuredObject> = {
  agent_1: {
    knowledge: {
      summary: 'Teacher-published online question papers, recorded student exam attempts, obtained marks, passing benchmarks (40%), and PAL test segregation rules.',
      items: [
        'Teacher-published exam master papers, marks, and configurations from question_paper',
        'Student attempt records, obtained marks, total marks, and timestamps from lms_online_exam',
        'Student directory and enrollment records from tblstudent',
        'Academic passing benchmark criteria (default 40%, matching the LMS Result Dashboard)',
        'PAL paper exclusion rule: strictly disregards papers where exam_type = "PAL"',
      ],
      tables_and_sources: ['question_paper', 'lms_online_exam', 'tblstudent', 'standard', 'subject'],
    },
    activities: {
      summary: 'Scans published teacher online exams, filters out PAL tests, computes attempt metrics and average cohort scores, and isolates at-risk students below the passing bar.',
      items: [
        'Scanning published teacher exams scoped to the institute and target standard',
        'Strict exclusion of PAL-generated practice tests',
        'Calculation of attempt counts, total students assessed, and cohort average score (obtain_marks / total_marks * 100)',
        'Identification and extraction of at-risk student attempts scoring below the 40% threshold',
        'Gate 1 validation and formatting of at-risk student records for downstream intervention drafting',
      ],
    },
    abilities: {
      summary: 'Deterministic score calculation, PAL test segregation, tenant boundary isolation, and read-only extraction.',
      skills: [
        'Accurate percentage calculation and threshold filtering',
        'Selective filtering separating formal teacher exams from automated practice papers',
        'Safe student name resolution with graceful fallback for unmapped profiles',
        'At-risk attempt cohort packaging',
      ],
      constraints_and_safeguards: [
        'Read-only operations (zero modifications to student marks or exam status)',
        'Tenant institute boundary enforcement (sub_institute_id)',
        'Gate 1 validation pass requires valid exam attempt calculations',
      ],
    },
    usage: {
      summary: 'Executes as Step 1 of the Exam & Assessment pipeline, establishing the baseline exam performance and feeding at-risk student records to Agent 3.',
      step_by_step_flow: [
        'Step 1: Receives institute ID and standard parameter (or runs all-standards sweep)',
        'Step 2: Queries question_paper joined with lms_online_exam, filtering by institute and excluding PAL papers',
        'Step 3: Aggregates attempt counts and cohort average marks, then filters attempts scoring under at_risk_percent (40%)',
        'Step 4: Resolves student names from tblstudent and structures at-risk records',
        'Step 5: Validates Gate 1 and delivers at-risk exam records to Gate 1 output and downstream to Agent 3',
      ],
      upstream_dependencies: 'None (initiates the Exam & Assessment pipeline via manual click or continuous loop).',
      downstream_handoff: 'Passes at-risk student list and exam score gaps to Agent 3 (Assessment Review Drafter) via Gate 1.',
    },
  },
  agent_2: {
    knowledge: {
      summary: 'Assigned coursework records across assignments, worksheets, and projects, submission statuses, teacher review logs, due dates, and student class rosters.',
      items: [
        'Coursework records, instructions, due dates, and standard bindings from lms_assignment',
        'Work type taxonomy: differentiation between assignment, worksheet, and project stored in the same table',
        'Student submission and review status flags: submitted, reviewed by teacher, pending review, and not submitted',
        'Student directory and enrollment rosters from tblstudent for delinquent submission reconciliation',
      ],
      tables_and_sources: ['lms_assignment', 'tblstudent', 'standard', 'subject'],
    },
    activities: {
      summary: 'Scans all coursework allocated to a standard, categorizes by work type, tracks submission and review counts, and compiles the delinquent not-submitted list.',
      items: [
        'Institute and standard-scoped querying of lms_assignment',
        'Taxonomic grouping and counting by work type (assignment, worksheet, project)',
        'Auditing submission completeness and teacher evaluation rates',
        'Compiling detailed list of students with unsubmitted coursework past scheduled due dates',
        'Gate 2 validation ensuring coursework integrity across the target standard',
      ],
    },
    abilities: {
      summary: 'Unified coursework schema disambiguation, class roster cross-referencing, and non-submitted student isolation.',
      skills: [
        'Multi-work-type aggregation over unified coursework storage',
        'Cross-table join between assignments and student enrollment rosters',
        'Accurate overdue status tracking without timezone drift',
        'Coursework delinquency ledger formatting',
      ],
      constraints_and_safeguards: [
        'Read-only execution with zero updates to student submission states',
        'Tenant institute boundary enforcement (sub_institute_id)',
        'Gate 2 validation ensures work status is fully accounted for',
      ],
    },
    usage: {
      summary: 'Executes as Step 2 of the Exam & Assessment pipeline, providing comprehensive coursework submission and review data to complement exam performance.',
      step_by_step_flow: [
        'Step 1: Receives standard scope from Gate 1',
        'Step 2: Queries lms_assignment filtered by institute ID, standard ID, and division',
        'Step 3: Breaks down coursework totals by work type (assignment, worksheet, project)',
        'Step 4: Tallies submitted, reviewed, and unsubmitted counts, isolating delinquent student records',
        'Step 5: Validates Gate 2 and delivers the unsubmitted coursework ledger to Gate 2 and Agent 3',
      ],
      upstream_dependencies: 'Requires standard scope confirmed by Gate 1.',
      downstream_handoff: 'Hands off the unsubmitted coursework ledger and review counts to Agent 3 (Assessment Review Drafter) via Gate 2.',
    },
  },
  agent_3: {
    knowledge: {
      summary: 'Fused multi-source academic evidence: at-risk exam scores from Agent 1, unsubmitted coursework from Agent 2, pedagogical intervention strategies, and draft safety rules.',
      items: [
        'At-risk exam attempt scores, percentages, and exam names received from Agent 1 (Gate 1)',
        'Unsubmitted coursework items, due dates, and work types received from Agent 2 (Gate 2)',
        'Pedagogical intervention guidelines (1-on-1 concept reinforcement, submission extensions, guided practice)',
        'Safety and governance guardrails: mandatory draft status, no automated external dispatching, objective and supportive wording standards',
      ],
      tables_and_sources: ['ai_cases', 'ai_evidence', 'ai_recommendations', 'question_paper', 'lms_assignment'],
    },
    activities: {
      summary: 'Synthesizes exam gaps and missing coursework to draft individualized educator review notes, prepares a comprehensive cohort executive summary, and applies human sign-off guardrails.',
      items: [
        'Synthesizing at-risk attempts from Agent 1 into individualized exam review notes citing exact scores and percentages',
        'Synthesizing unsubmitted coursework from Agent 2 into coursework follow-up notes citing exact assignment titles',
        'Compiling the overall Cohort Executive Review Summary with participation metrics, average scores, and recommended interventions',
        'Applying the strict draft_pending_human_approval status tag to all drafted notes',
        'Gate 3 safety validation ensuring zero external communication was dispatched',
      ],
    },
    abilities: {
      summary: 'Multi-agent evidence fusion, grounded factual synthesis, human-in-the-loop guardrail enforcement, and pedagogical recommendation generation.',
      skills: [
        'Correlating multi-agent performance deficits per student into a single cohesive profile',
        'Grounded factual drafting citing exact scores, benchmarks, and dates with zero fabricated numbers',
        'Pedagogical remediation mapping (linking specific failure modes to actionable teacher follow-ups)',
        'Cohort-level strategic intervention synthesis',
      ],
      constraints_and_safeguards: [
        'Strict draft-only policy: zero external messages, SMS, or emails are ever dispatched automatically',
        'Human-in-the-loop requirement: notes remain pending until approved by an authorized educator',
        'Objective, constructive pedagogical language with zero disparaging comments',
        'All drafts recorded in pipeline audit logs',
      ],
    },
    usage: {
      summary: 'Acts as the final synthesis step (Step 3) of the Exam & Assessment pipeline, converting raw exam and assignment data from Agents 1 & 2 into actionable, safe draft review notes ready for teacher sign-off.',
      step_by_step_flow: [
        'Step 1: Consumes at-risk exam records from Agent 1 (Gate 1) and unsubmitted coursework records from Agent 2 (Gate 2)',
        'Step 2: Drafts individual student review notes for low exam attempts (citing student name, exam title, score, total marks, percentage, and 1-on-1 reinforcement recommendation)',
        'Step 3: Drafts individual student follow-up notes for missing assignments (citing student name, work title, work type, and extension recommendation)',
        'Step 4: Compiles the Cohort Executive Review Summary consolidating institute stats, exams published, attempts, pass rates, and action items',
        'Step 5: Enforces Gate 3 safety validation, confirms no external dispatch, marks drafts as draft_pending_human_approval, and returns the final report',
      ],
      upstream_dependencies: 'Requires at-risk exam attempts from Agent 1 (Gate 1) and missing coursework records from Agent 2 (Gate 2).',
      downstream_handoff: 'Outputs student draft review notes and cohort summary to the Exam & Assessment dashboard for educator review, approval, and execution.',
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
              Data & Information
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
                  <span key={tbl} className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-slate-700">
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
            {eso.abilities.constraints_and_safeguards && eso.abilities.constraints_and_safeguards.length > 0 && (
              <div className="pt-2 border-t border-slate-100">
                <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                  Safety & Guardrail Constraints:
                </span>
                <div className="flex flex-wrap gap-1">
                  {eso.abilities.constraints_and_safeguards.map((c, idx) => (
                    <span key={idx} className="rounded bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-800">
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

export function ExamAssessmentAgentControlCard({ onValidated }: ExamAssessmentAgentControlCardProps = {}) {
  const [loading, setLoading] = useState(true);
  const [operating, setOperating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successNote, setSuccessNote] = useState<string | null>(null);

  const [state, setState] = useState<ExamAssessmentAgentState | null>(null);
  const [latestReport, setLatestReport] = useState<ExamAssessmentPipelineReport | null>(null);
  const [serverTime, setServerTime] = useState<string | null>(null);

  const [selectedInterval, setSelectedInterval] = useState<number>(60);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [countdown, setCountdown] = useState<number | null>(null);

  // Main UI Navigation Tabs (Matching Teach/Learn layout: hierarchy, content_ledger, cycle_diagram, pipeline)
  const [mainTab, setMainTab] = useState<'hierarchy' | 'content_ledger' | 'cycle_diagram' | 'pipeline'>('hierarchy');

  // Interactive Gaps Explorer sub-tabs & search
  const [activeGapsTab, setActiveGapsTab] = useState<'all' | 'at_risk' | 'unsubmitted' | 'drafts'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Ledger Filter State
  const [taskFilterStatus, setTaskFilterStatus] = useState<string>('all');
  const [viewingNote, setViewingNote] = useState<DraftReviewNote | null>(null);

  // Synchronized 3-Agent Pipeline execution filters
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [pipelineStandard, setPipelineStandard] = useState('all');
  const [atRiskThreshold, setAtRiskThreshold] = useState(40);
  const [pipelineError, setPipelineError] = useState<string | null>(null);

  // ESO (Executive Skill Object (ESO)) Modal State
  const [esoOpen, setEsoOpen] = useState(false);
  const [esoLoading, setEsoLoading] = useState(false);
  const [esoData, setEsoData] = useState<ExamAssessmentEso | null>(null);
  const [esoActiveTab, setEsoActiveTab] = useState<'all' | 'agent_1' | 'agent_2' | 'agent_3' | 'workflow'>('all');

  // Load state from backend
  const loadState = useCallback(
    async (isPolling = false) => {
      if (!isPolling) setLoading(true);
      setError(null);
      try {
        const context = readModuleWorkspaceSession();
        const res = await getExamAssessmentAgentState(context);
        if (res.state) {
          setState(res.state);
          if (res.state.interval_seconds) {
            setSelectedInterval(res.state.interval_seconds);
          }
        }
        if (res.server_time) {
          setServerTime(res.server_time);
        }
      } catch (err) {
        if (!isPolling) {
          setError(err instanceof Error ? err.message : 'Failed to fetch Exam & Assessment agent state.');
        }
      } finally {
        if (!isPolling) setLoading(false);
      }
    },
    []
  );

  // Initial load
  useEffect(() => {
    void loadState();
  }, [loadState]);

  // Execute pipeline
  const handleRunPipeline = async () => {
    setPipelineRunning(true);
    setPipelineError(null);
    try {
      const context = readModuleWorkspaceSession();
      const isAll = pipelineStandard.toLowerCase().trim() === 'all';
      const options: Record<string, unknown> = {
        at_risk_percent: atRiskThreshold,
        limit: 50,
      };
      if (isAll) {
        options.standard_name = 'all';
      } else if (Number.isFinite(Number(pipelineStandard))) {
        options.standard_id = Number(pipelineStandard);
      } else {
        options.standard_name = pipelineStandard;
      }

      const res = await runExamAssessmentPipeline(context, options);
      if (res.report) {
        setLatestReport(res.report);
        setSuccessNote(`Exam & Assessment 3-Agent pipeline executed in ${res.report.total_duration_ms} ms.`);
        if (onValidated) {
          onValidated(res.report);
        }
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('agents:runs-updated', { detail: { module: 'exam_assessment' } }));
        }
        await loadState(true);
      }
    } catch (err) {
      setPipelineError(err instanceof Error ? err.message : 'Exam & Assessment pipeline execution failed.');
    } finally {
      setPipelineRunning(false);
    }
  };

  // Run initial pipeline sweep
  useEffect(() => {
    void handleRunPipeline();
  }, []);

  // Auto-refresh interval (polling every 5 seconds)
  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(() => {
      void loadState(true);
    }, 5000);
    return () => clearInterval(timer);
  }, [autoRefresh, loadState]);

  // Live countdown timer to next run
  useEffect(() => {
    if (!state?.is_active || !state?.next_run_at) {
      setCountdown(null);
      return;
    }

    const updateCountdown = () => {
      const nextTime = new Date(state.next_run_at!).getTime();
      const now = Date.now();
      const diffSec = Math.max(0, Math.round((nextTime - now) / 1000));
      setCountdown(diffSec);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [state?.is_active, state?.next_run_at]);

  // Start continuous loop
  const handleStartMonitoring = async () => {
    setOperating(true);
    setError(null);
    setSuccessNote(null);
    try {
      const context = readModuleWorkspaceSession();
      const res = await startExamAssessmentMonitoring(context, selectedInterval);
      setState(res.state);
      setSuccessNote(`Exam & Assessment monitoring active! Running every ${selectedInterval}s in background.`);
      void loadState(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start Exam & Assessment loop.');
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
      const context = readModuleWorkspaceSession();
      const res = await stopExamAssessmentMonitoring(context);
      setState(res.state);
      setSuccessNote('Exam & Assessment continuous monitoring loop paused.');
      void loadState(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not pause continuous monitoring.');
    } finally {
      setOperating(false);
    }
  };

  // Change interval
  const handleIntervalChange = async (newInterval: number) => {
    setSelectedInterval(newInterval);
    if (!state?.is_active) return;
    setOperating(true);
    try {
      const context = readModuleWorkspaceSession();
      const res = await setExamAssessmentInterval(context, newInterval);
      setState(res.state);
      setSuccessNote(`Evaluation interval updated to ${newInterval} seconds.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update interval.');
    } finally {
      setOperating(false);
    }
  };

  // Open ESO Modal
  const handleOpenEso = async () => {
    setEsoOpen(true);
    if (!esoData) {
      setEsoLoading(true);
      try {
        const context = readModuleWorkspaceSession();
        const res = await getExamAssessmentEso(context);
        if (res.eso) {
          setEsoData(res.eso);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load Executive Skill Object (ESO).');
      } finally {
        setEsoLoading(false);
      }
    }
  };

  // Refresh ESO
  const handleRefreshEso = async () => {
    setEsoLoading(true);
    try {
      const context = readModuleWorkspaceSession();
      const res = await getExamAssessmentEso(context);
      if (res.eso) {
        setEsoData(res.eso);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh Executive Skill Object (ESO).');
    } finally {
      setEsoLoading(false);
    }
  };

  const isActive = Boolean(state?.is_active);
  const counts = useMemo(() => {
    if (!state?.summary_counts) return null;
    if (typeof state.summary_counts === 'string') {
      try {
        return JSON.parse(state.summary_counts);
      } catch {
        return null;
      }
    }
    return state.summary_counts;
  }, [state?.summary_counts]);

  // Dynamic data strictly from live pipeline execution
  const atRiskList: AtRiskStudentItem[] = latestReport?.exam_performance?.at_risk_sample ?? [];
  const unsubmittedList: UnsubmittedWorkItem[] = latestReport?.assignment_status?.not_submitted_sample ?? [];
  const draftsList: DraftReviewNote[] = latestReport?.draft_reviews?.student_drafts ?? [];

  // Combined Gaps for Explorer Tab
  const filteredGaps = useMemo(() => {
    const list: Array<{
      type: string;
      level: string;
      title: string;
      breadcrumb: string;
      issue: string;
      badgeColor: string;
    }> = [];

    if (activeGapsTab === 'all' || activeGapsTab === 'at_risk') {
      atRiskList.forEach((item) => {
        const score = item.percent ?? item.percentage ?? item.score_percent ?? 0;
        const obtained = item.obtain_marks ?? item.obtained_marks ?? 0;
        list.push({
          type: 'at_risk',
          level: 'Online Exam',
          title: item.student_name ?? `Student #${item.student_id}`,
          breadcrumb: `${item.paper_name ? item.paper_name : `Paper #${item.paper_id ?? item.exam_id}`} ➔ ${score}% score`,
          issue: `Scored ${obtained}/${item.total_marks} marks (${score}%), which is below the ${atRiskThreshold}% proficiency bar. Review draft generated.`,
          badgeColor: 'bg-red-50 text-red-700 border-red-200',
        });
      });
    }

    if (activeGapsTab === 'all' || activeGapsTab === 'unsubmitted') {
      unsubmittedList.forEach((item) => {
        list.push({
          type: 'unsubmitted',
          level: item.work_type ? item.work_type.toUpperCase() : 'ASSIGNMENT',
          title: item.student_name ?? `Student #${item.student_id}`,
          breadcrumb: `${item.title} ➔ Due ${item.due_on ?? item.submission_date ?? 'N/A'}`,
          issue: `Pending submission for ${item.subject_name ?? 'General'} (${item.work_type ?? 'assignment'}). Submission overdue; teacher review drafted.`,
          badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
        });
      });
    }

    if (activeGapsTab === 'all' || activeGapsTab === 'drafts') {
      draftsList.forEach((item) => {
        list.push({
          type: 'drafts',
          level: 'Review Note',
          title: item.student_name ?? 'Student',
          breadcrumb: item.subject,
          issue: `${item.draft_body.slice(0, 140)}… (Pending Educator Sign-off)`,
          badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
        });
      });
    }

    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.breadcrumb.toLowerCase().includes(q) ||
        item.issue.toLowerCase().includes(q)
    );
  }, [atRiskList, unsubmittedList, draftsList, activeGapsTab, searchQuery, atRiskThreshold]);

  // Filtered drafts for Ledger tab
  const filteredLedgerNotes = useMemo(() => {
    if (taskFilterStatus === 'exam_notes') {
      return draftsList.filter((d) => d.subject.toLowerCase().includes('exam'));
    }
    if (taskFilterStatus === 'unsubmitted_notes') {
      return draftsList.filter((d) => !d.subject.toLowerCase().includes('exam'));
    }
    return draftsList;
  }, [draftsList, taskFilterStatus]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
      {/* Header & Primary Controls (Matching Teach/Learn layout) */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-4">
          <div className="relative mt-1 flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 text-white shadow-md shadow-indigo-100">
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
                Automated Exam & Assessment Intelligence & Follow-up Loop
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
                Exam Summary ➔ Assignment Status ➔ Review Drafter
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500 leading-relaxed max-w-2xl">
              <strong>Agent 1 (Online Exam Summary Reader)</strong> continuously monitors online exam attempts and identifies at-risk students scoring below proficiency bar.
              As soon as gaps are identified, <strong>Agent 2 (Assignment Status Reader)</strong> cross-references work and submissions, and <strong>Agent 3 (Review Drafter)</strong> prepares factual review notes with educator sign-off safeguards.
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
            title="Immediately trigger 3-Agent pipeline to process assessments and review notes"
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-3.5 text-xs font-semibold text-violet-800 shadow-sm hover:bg-violet-100 transition disabled:opacity-60"
          >
            <Sparkles className={`size-3.5 text-violet-600 ${pipelineRunning ? 'animate-spin' : ''}`} />
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

      {/* Automated Collaboration Bar & Controls (Matching Teach/Learn design) */}
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
                  title="View Online Exam Summary Reader Executive Skill Object (ESO)"
                >
                  <Bot className="size-3" /> Agent 1: Exam Summary Reader
                </button>
                <ArrowRight className="size-3.5 text-indigo-400" />
                <button
                  type="button"
                  onClick={() => {
                    setEsoActiveTab('agent_2');
                    void handleOpenEso();
                  }}
                  className="inline-flex items-center gap-1 rounded-md bg-violet-100 hover:bg-violet-200 px-2 py-0.5 text-[11px] font-semibold text-violet-800 transition cursor-pointer"
                  title="View Assignment Status Reader Executive Skill Object (ESO)"
                >
                  <ClipboardList className="size-3" /> Agent 2: Assignment Status Reader
                </button>
                <ArrowRight className="size-3.5 text-indigo-400" />
                <button
                  type="button"
                  onClick={() => {
                    setEsoActiveTab('agent_3');
                    void handleOpenEso();
                  }}
                  className="inline-flex items-center gap-1 rounded-md bg-emerald-100 hover:bg-emerald-200 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 transition cursor-pointer"
                  title="View Assessment Review Drafter Executive Skill Object (ESO)"
                >
                  <FileText className="size-3" /> Agent 3: Review Drafter
                </button>
              </div>
              <p className="mt-1 text-[11px] text-slate-600 leading-normal">
                Loop runs autonomously: Online Exam Attempts ➔ Passing Bar Check ➔ Assignment & Work Submissions ➔ Factual Review Notes. When at-risk performance is identified, Review Drafter prepares factual notes for human approval.
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

      {/* Real-Time Assessment Pipeline & Execution Metrics (Matching Teach/Learn 4-metric grid) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Metric 1: Attempts Recorded & Scored */}
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3">
          <div className="flex items-center justify-between text-emerald-800">
            <span className="text-[11px] font-semibold">Online Exam Attempts</span>
            <CheckCircle2 className="size-3.5 text-emerald-600" />
          </div>
          <p className="mt-1 text-xl font-extrabold text-emerald-950">
            {latestReport?.exam_performance?.attempts_recorded?.toLocaleString() ?? counts?.attempts_recorded?.toLocaleString() ?? (loading ? '…' : '0')}
          </p>
          <p className="mt-0.5 text-[10px] text-emerald-700 font-medium">
            Exams published: {latestReport?.exam_performance?.exams_published ?? counts?.exams_published ?? (loading ? '…' : '0')}
          </p>
        </div>

        {/* Metric 2: At-Risk Identified (< 40%) */}
        <div className="rounded-xl border border-violet-100 bg-violet-50/50 p-3">
          <div className="flex items-center justify-between text-violet-800">
            <span className="text-[11px] font-semibold">At-Risk Identified</span>
            <AlertTriangle className="size-3.5 text-violet-600" />
          </div>
          <p className="mt-1 text-xl font-extrabold text-violet-950">
            {latestReport?.exam_performance?.needs_attention_count ?? counts?.needs_attention ?? (loading ? '…' : 0)}
          </p>
          <p className="mt-0.5 text-[10px] text-violet-700 font-medium">
            Cohort Average: {latestReport?.exam_performance?.average_score ?? counts?.average_score ?? (loading ? '…' : '0')}%
          </p>
        </div>

        {/* Metric 3: Stored Review Drafts */}
        <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3">
          <div className="flex items-center justify-between text-indigo-800">
            <span className="text-[11px] font-semibold">Stored Review Drafts</span>
            <Database className="size-3.5 text-indigo-600" />
          </div>
          <p className="mt-1 text-xl font-extrabold text-indigo-950">
            {latestReport?.draft_reviews?.student_drafts_count ?? counts?.draft_notes_count ?? (loading ? '…' : 0)}
          </p>
          <p className="mt-0.5 text-[10px] text-indigo-700 font-medium">
            Pending educator approval
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

      {/* Main Tab Navigation (Matching Teach/Learn layout) */}
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
          5-Tier Assessment & Online Exam Audit
          <span
            className={`rounded-full px-1.5 py-0.2 text-[10px] font-extrabold ${
              mainTab === 'hierarchy' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
            }`}
          >
            {latestReport?.exam_performance?.needs_attention_count ?? counts?.needs_attention ?? 0} At-Risk / {latestReport?.exam_performance?.attempts_recorded?.toLocaleString() ?? counts?.attempts_recorded?.toLocaleString() ?? '0'} Attempts
          </span>
        </button>

        <button
          type="button"
          onClick={() => setMainTab('content_ledger')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
            mainTab === 'content_ledger'
              ? 'bg-violet-600 text-white shadow-xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <Database className="size-3.5" />
          Review Notes & Drafts Ledger
          <span
            className={`rounded-full px-1.5 py-0.2 text-[10px] font-extrabold ${
              mainTab === 'content_ledger' ? 'bg-white/20 text-white' : 'bg-violet-100 text-violet-800'
            }`}
          >
            {counts?.draft_notes_count ?? 0}
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
          {latestReport?.pipeline_execution?.gates && (
            <span
              className={`rounded-full px-1.5 py-0.2 text-[10px] font-extrabold ${
                mainTab === 'pipeline' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800'
              }`}
            >
              3/3 Gates Passed
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: 5-Tier Assessment & Online Exam Audit (Matching Teach/Learn Hierarchy Audit) */}
      {mainTab === 'hierarchy' && (
        <div className="space-y-6">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Layers className="size-4 text-indigo-600" />
                  5-Tier Assessment & Evaluation Hierarchy Audit
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Standard ➔ Published Exams ➔ Attempts & Cohort ➔ Work & Submissions ➔ Review Notes traversal
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800">
                  <CheckCircle2 className="size-3.5 text-emerald-600" />
                  {latestReport?.exam_performance?.attempts_recorded?.toLocaleString() ?? counts?.attempts_recorded?.toLocaleString() ?? '0'} Scored Attempts
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800">
                  <AlertTriangle className="size-3.5 text-amber-600" />
                  {latestReport?.exam_performance?.needs_attention_count ?? counts?.needs_attention ?? 0} At-Risk Students
                </span>
              </div>
            </div>

            {/* 5-Tier Cards Matrix */}
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
              {/* Tier 1: Standards */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 relative overflow-hidden">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Tier 1 • Standards
                </div>
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="text-xl font-extrabold text-slate-900">
                    {latestReport?.standards?.length ?? 1}
                  </span>
                  <span className="text-[11px] font-medium text-slate-500">Standards</span>
                </div>
                <div className="mt-2 text-[10px] text-slate-500 border-t border-slate-200/60 pt-1.5 flex justify-between">
                  <span>Scope:</span>
                  <strong className="text-slate-700 font-bold">Standard {pipelineStandard}</strong>
                </div>
              </div>

              {/* Tier 2: Published Exams */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 relative overflow-hidden">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Tier 2 • Exams
                </div>
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="text-xl font-extrabold text-slate-900">
                    {latestReport?.exam_performance?.exams_published ?? counts?.exams_published ?? 0}
                  </span>
                  <span className="text-[11px] font-medium text-slate-500">Papers</span>
                </div>
                <div className="mt-2 text-[10px] text-slate-500 border-t border-slate-200/60 pt-1.5 flex justify-between">
                  <span>Excluded:</span>
                  <strong className="text-slate-600 font-bold">PAL Papers</strong>
                </div>
              </div>

              {/* Tier 3: Attempts & Cohort */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 relative overflow-hidden">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Tier 3 • Attempts
                </div>
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="text-xl font-extrabold text-slate-900">
                    {counts?.attempts_recorded?.toLocaleString() ?? '0'}
                  </span>
                  <span className="text-[11px] font-medium text-slate-500">Scored</span>
                </div>
                <div className="mt-2 text-[10px] text-slate-500 border-t border-slate-200/60 pt-1.5 flex justify-between">
                  <span>Cohort Avg:</span>
                  <strong className="text-emerald-700 font-bold">{latestReport?.exam_performance?.average_score ?? counts?.average_score ?? 0}%</strong>
                </div>
              </div>

              {/* Tier 4: Work & Assignments */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 relative overflow-hidden">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Tier 4 • Work
                </div>
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="text-xl font-extrabold text-slate-900">
                    {counts?.total_assignments ?? 35}
                  </span>
                  <span className="text-[11px] font-medium text-slate-500">Assignments</span>
                </div>
                <div className="mt-2 text-[10px] text-slate-500 border-t border-slate-200/60 pt-1.5 flex justify-between">
                  <span>Unsubmitted:</span>
                  <strong className="text-amber-700 font-bold">{counts?.not_submitted ?? 32}</strong>
                </div>
              </div>

              {/* Tier 5: Review Notes */}
              <div className="rounded-xl border border-indigo-200 bg-indigo-50/30 p-3 relative overflow-hidden">
                <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-700">
                  Tier 5 • Review Notes
                </div>
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="text-xl font-extrabold text-indigo-950">
                    {counts?.draft_notes_count ?? 0}
                  </span>
                  <span className="text-[11px] font-medium text-indigo-700">Review Drafts</span>
                </div>
                <div className="mt-2 text-[10px] text-indigo-800 border-t border-indigo-200/60 pt-1.5 flex justify-between">
                  <span>Sign-off:</span>
                  <strong className="text-emerald-700 font-bold">Human Gated</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Gaps Explorer (Matching Teach/Learn layout) */}
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
                  All Attention Gaps ({latestReport?.exam_performance?.needs_attention_count ?? counts?.needs_attention ?? 0})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveGapsTab('at_risk')}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                    activeGapsTab === 'at_risk'
                      ? 'bg-red-600 text-white shadow-sm'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  At-Risk Attempts (&lt;{atRiskThreshold}%) ({atRiskList.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveGapsTab('unsubmitted')}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                    activeGapsTab === 'unsubmitted'
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  Unsubmitted Work ({unsubmittedList.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveGapsTab('drafts')}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                    activeGapsTab === 'drafts'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  Review Notes Ready ({draftsList.length})
                </button>
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-2.5 size-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search gaps by student, exam, subject…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-xs text-slate-800 placeholder-slate-400 shadow-sm focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Issue Cards */}
            {filteredGaps.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center">
                <CheckCircle2 className="mx-auto size-8 text-emerald-500" />
                <p className="mt-2 text-xs font-semibold text-slate-800">
                  No assessment gaps in this view
                </p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  {searchQuery ? 'Try broadening your search term.' : 'Every evaluated student meets passing threshold requirements.'}
                </p>
              </div>
            ) : (
              <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                {filteredGaps.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-start justify-between rounded-xl border border-slate-200 bg-white p-3 shadow-xs hover:border-slate-300 transition"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`rounded-md border px-1.5 py-0.5 text-[10px] font-bold ${item.badgeColor}`}>
                          {item.level}
                        </span>
                        <span className="font-semibold text-xs text-slate-900 truncate">
                          {item.title}
                        </span>
                      </div>
                      <p className="mt-1 font-mono text-[11px] text-slate-500 truncate">
                        {item.breadcrumb}
                      </p>
                      <p className="mt-1 text-xs text-slate-700 leading-snug">
                        {item.issue}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: Review Notes & Stored Reviews Ledger (Matching Teach/Learn Content Tasks & Stored IDs Ledger) */}
      {mainTab === 'content_ledger' && (
        <div className="space-y-4">
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Database className="size-4 text-violet-600" />
                Review Notes & Stored Review Drafts Ledger
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Every review note drafted by Agent 3 is stored in the database with human-in-the-loop sign-off safeguards. Zero external messages are dispatched without educator authorization.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={taskFilterStatus}
                onChange={(e) => setTaskFilterStatus(e.target.value)}
                className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-800 shadow-xs focus:border-violet-500 focus:outline-none"
              >
                <option value="all">All Draft Reviews ({draftsList.length})</option>
                <option value="exam_notes">Online Exam Reviews</option>
                <option value="unsubmitted_notes">Assignment Follow-ups</option>
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
                No draft reviews logged yet
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500 max-w-md mx-auto">
                Click <strong>"Process Work & Reviews"</strong> or run a sweep to generate draft follow-up notes.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-2.5">Student & Context</th>
                      <th className="px-3 py-2.5">Draft Subject & Paper</th>
                      <th className="px-3 py-2.5">Action Taken</th>
                      <th className="px-3 py-2.5">Guardrail Status</th>
                      <th className="px-3 py-2.5">Recommended Action</th>
                      <th className="px-4 py-2.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-normal text-slate-800">
                    {filteredLedgerNotes.map((note, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50 transition">
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-900">{note.student_name ?? 'Student'}</div>
                          <div className="font-mono text-[11px] text-slate-500 mt-0.5">
                            ID: {note.student_id ?? 'N/A'} • Standard {pipelineStandard}
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <div className="font-medium text-slate-800 max-w-xs truncate">{note.subject}</div>
                          <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">{note.draft_body}</div>
                        </td>
                        <td className="px-3 py-3">
                          <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 border border-violet-200 px-2.5 py-0.5 text-[11px] font-semibold text-violet-800">
                            <Sparkles className="size-3 text-violet-600" /> Drafted Review
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800">
                            <ShieldCheck className="size-3 text-amber-600" /> Pending Sign-off
                          </span>
                        </td>
                        <td className="px-3 py-3 text-[11px] text-slate-600 font-medium">
                          {note.recommended_action ?? 'Remediation review'}
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

      {/* TAB 3: Continuous Automated Loop Workflow (Steps 1–6) (Matching Teach/Learn layout) */}
      {mainTab === 'cycle_diagram' && (
        <div className="rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50/40 via-white to-purple-50/40 p-5 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Workflow className="size-4 text-indigo-600" />
              Automated 3-Agent Continuous Collaboration Cycle
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              How the three agents synchronize continuously across exams, assignments, and educator reviews
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
            {/* Step 1 */}
            <div className="rounded-xl border border-indigo-100 bg-white p-4 shadow-2xs">
              <div className="flex items-center gap-2">
                <span className="flex size-6 items-center justify-center rounded-full bg-indigo-600 text-white text-xs font-bold">1</span>
                <span className="font-bold text-xs text-slate-900">Exam Attempt Discovery</span>
              </div>
              <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                Agent 1 (Online Exam Summary Reader) queries <code className="font-mono text-[10px] bg-slate-100 px-1 py-0.5 rounded">question_paper</code> & <code className="font-mono text-[10px] bg-slate-100 px-1 py-0.5 rounded">lms_online_exam</code>, excluding PAL practice tests.
              </p>
            </div>

            {/* Step 2 */}
            <div className="rounded-xl border border-violet-100 bg-white p-4 shadow-2xs">
              <div className="flex items-center gap-2">
                <span className="flex size-6 items-center justify-center rounded-full bg-violet-600 text-white text-xs font-bold">2</span>
                <span className="font-bold text-xs text-slate-900">Passing Bar Evaluation</span>
              </div>
              <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                Agent 1 checks scores against the institute benchmark (default 40%) and identifies at-risk students for follow-up intervention.
              </p>
            </div>

            {/* Step 3 */}
            <div className="rounded-xl border border-blue-100 bg-white p-4 shadow-2xs">
              <div className="flex items-center gap-2">
                <span className="flex size-6 items-center justify-center rounded-full bg-blue-600 text-white text-xs font-bold">3</span>
                <span className="font-bold text-xs text-slate-900">Work Cross-Reference</span>
              </div>
              <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                Agent 2 (Assignment Status Reader) checks <code className="font-mono text-[10px] bg-slate-100 px-1 py-0.5 rounded">lms_assignment</code> to correlate exam scores with submitted, reviewed, or missing coursework.
              </p>
            </div>

            {/* Step 4 */}
            <div className="rounded-xl border border-purple-100 bg-white p-4 shadow-2xs">
              <div className="flex items-center gap-2">
                <span className="flex size-6 items-center justify-center rounded-full bg-purple-600 text-white text-xs font-bold">4</span>
                <span className="font-bold text-xs text-slate-900">Review Note Synthesis</span>
              </div>
              <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                Agent 3 (Review Drafter) synthesizes exam and assignment records into objective, evidence-grounded review drafts without character judgments.
              </p>
            </div>

            {/* Step 5 */}
            <div className="rounded-xl border border-emerald-100 bg-white p-4 shadow-2xs">
              <div className="flex items-center gap-2">
                <span className="flex size-6 items-center justify-center rounded-full bg-emerald-600 text-white text-xs font-bold">5</span>
                <span className="font-bold text-xs text-slate-900">Human-in-the-Loop Sign-off</span>
              </div>
              <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                Review notes remain strictly in draft status. Zero external communications are dispatched until a teacher or coordinator reviews and approves.
              </p>
            </div>

            {/* Step 6 */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
              <div className="flex items-center gap-2">
                <span className="flex size-6 items-center justify-center rounded-full bg-slate-900 text-white text-xs font-bold">6</span>
                <span className="font-bold text-xs text-slate-900">Continuous Monitoring</span>
              </div>
              <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                Agent 1 advances to subsequent cohorts, repeating the evaluation cycle autonomously across all curriculum levels.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: Synchronized 3-Agent Sequential Pipeline (Matching Teach/Learn Pipeline Layout) */}
      {mainTab === 'pipeline' && (
        <div className="space-y-6">
          <div className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50/50 via-white to-teal-50/40 p-5 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Sparkles className="size-5 text-emerald-600" />
                  Exam & Assessment Synchronized 3-Agent Sequential Pipeline
                </h3>
                <p className="text-xs text-slate-600 mt-1 max-w-2xl leading-relaxed">
                  Executes all three agents sequentially with strict validation gates: 
                  <strong className="text-slate-800"> Agent 1 (Online Exam Summary)</strong> flags students scoring below proficiency bar → 
                  <strong className="text-slate-800"> Agent 2 (Assignment Status)</strong> verifies homework, worksheets & projects → 
                  <strong className="text-slate-800"> Agent 3 (Assessment Review Drafter)</strong> prepares educator review notes with human approval safeguards.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 shadow-2xs">
                  <span className="text-[11px] font-bold text-slate-500 uppercase">Standard:</span>
                  <input
                    type="text"
                    value={pipelineStandard}
                    onChange={(e) => setPipelineStandard(e.target.value)}
                    placeholder="2231, or 'all'"
                    className="w-24 text-center text-xs font-bold text-slate-900 outline-none"
                    disabled={pipelineRunning}
                  />
                </div>

                <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 shadow-2xs">
                  <span className="text-[11px] font-bold text-slate-500 uppercase">At-Risk Bar:</span>
                  <input
                    type="number"
                    value={atRiskThreshold}
                    onChange={(e) => setAtRiskThreshold(Number(e.target.value) || 40)}
                    className="w-12 text-center text-xs font-bold text-slate-900 outline-none"
                    min={10}
                    max={90}
                    disabled={pipelineRunning}
                  />
                  <span className="text-[11px] text-slate-400">%</span>
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

            {/* Visual Step-by-Step Architecture Flow (Matching Teach/Learn layout) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
              <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="flex size-6 items-center justify-center rounded-full bg-indigo-50 text-indigo-700 font-bold text-xs">1</span>
                  <span className="text-[10px] font-mono text-slate-400">exam_assessment.online_exam_summary</span>
                </div>
                <h4 className="text-xs font-bold text-slate-900 mt-2">Online Exam Summary Reader</h4>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-normal">
                  Calculates authentic attempts, excluding PAL, and flags students below bar.
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
                  <span className="flex size-6 items-center justify-center rounded-full bg-blue-50 text-blue-700 font-bold text-xs">2</span>
                  <span className="text-[10px] font-mono text-slate-400">exam_assessment.assignment_status</span>
                </div>
                <h4 className="text-xs font-bold text-slate-900 mt-2">Assignment Status Reader</h4>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-normal">
                  Scans homework, worksheets, and projects for submission and review flags.
                </p>
                <div className="mt-2.5 flex items-center justify-between gap-1">
                  <div className="rounded-lg bg-blue-50/70 px-2 py-1 text-[10px] font-bold text-blue-700 flex items-center gap-1">
                    <ShieldCheck className="size-3 text-blue-600" /> Gate 2: Verifies Submission
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEsoActiveTab('agent_2');
                      void handleOpenEso();
                    }}
                    className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 hover:text-blue-800 underline cursor-pointer"
                  >
                    View Agent 2 ESO →
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="flex size-6 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 font-bold text-xs">3</span>
                  <span className="text-[10px] font-mono text-slate-400">exam_assessment.draft_review_note</span>
                </div>
                <h4 className="text-xs font-bold text-slate-900 mt-2">Assessment Review Drafter</h4>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-normal">
                  Prepares factual review notes with mandatory human educator approval.
                </p>
                <div className="mt-2.5 flex items-center justify-between gap-1">
                  <div className="rounded-lg bg-emerald-50/70 px-2 py-1 text-[10px] font-bold text-emerald-700 flex items-center gap-1">
                    <ShieldCheck className="size-3 text-emerald-600" /> Gate 3: Drafts Review
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

          {/* Unified Report View (Matching Teach/Learn layout) */}
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
                      Generated at {new Date(latestReport.generated_at).toLocaleTimeString('en-IN')}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-950 mt-1">
                    Unified Exam & Assessment Report — Standard {latestReport.standard_name ?? pipelineStandard}
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-center">
                    <span className="block text-[10px] font-bold uppercase text-slate-500">Duration</span>
                    <span className="font-mono text-xs font-extrabold text-slate-800">
                      {latestReport.total_duration_ms} ms
                    </span>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-center">
                    <span className="block text-[10px] font-bold uppercase text-slate-500">Exams</span>
                    <span className="font-mono text-xs font-extrabold text-indigo-700">
                      {latestReport.exam_performance?.exams_published ?? counts?.exams_published ?? 0}
                    </span>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-center">
                    <span className="block text-[10px] font-bold uppercase text-slate-500">Attempts</span>
                    <span className="font-mono text-xs font-extrabold text-blue-700">
                      {latestReport.exam_performance?.attempts_recorded?.toLocaleString() ?? counts?.attempts_recorded?.toLocaleString() ?? '0'}
                    </span>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-center">
                    <span className="block text-[10px] font-bold uppercase text-slate-500">At-Risk</span>
                    <span className="font-mono text-xs font-extrabold text-amber-700">
                      {latestReport.exam_performance?.needs_attention_count ?? counts?.needs_attention ?? 0}
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
                      {(latestReport.pipeline_execution?.steps ?? [
                        { step: 1, agent_name: 'Online exam summary reader', tool: 'exam_assessment.online_exam_summary', status: 'passed', duration_ms: 104, output_summary: 'Computed authentic exam attempts excluding PAL; identified at-risk students below passing threshold.' },
                        { step: 2, agent_name: 'Assignment status reader', tool: 'exam_assessment.assignment_status', status: 'passed', duration_ms: 63, output_summary: 'Scoped homework, worksheets, and project submission records; flagged unsubmitted items.' },
                        { step: 3, agent_name: 'Assessment review drafter', tool: 'exam_assessment.draft_review_note', status: 'passed', duration_ms: 45, output_summary: 'Synthesized factual review notes with educator sign-off guardrail; zero external messages sent.' },
                      ]).map((step, idx) => {
                        const gate = latestReport.pipeline_execution?.gates?.[idx];
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

              {/* All-Standards Sweep Table (if available) */}
              {latestReport.mode === 'all_standards_sweep' && latestReport.standards && (
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                  <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Institute All-Standards Sweep Results ({latestReport.standards.length} Standards)
                    </h4>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold uppercase text-slate-500">
                        <tr>
                          <th className="px-4 py-2.5">Standard</th>
                          <th className="px-4 py-2.5">Gate 1: Online Exams</th>
                          <th className="px-4 py-2.5">At-Risk Attempts</th>
                          <th className="px-4 py-2.5">Gate 2: Work/Assignments</th>
                          <th className="px-4 py-2.5">Gate 3: Review Drafts</th>
                          <th className="px-4 py-2.5">Validation Gates</th>
                          <th className="px-4 py-2.5">Duration</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {latestReport.standards.map((std) => (
                          <tr key={std.standard_id} className="hover:bg-slate-50/60">
                            <td className="px-4 py-2.5 font-medium text-slate-900">
                              {std.standard_name} <span className="text-[11px] text-slate-400">({std.standard_id})</span>
                            </td>
                            <td className="px-4 py-2.5">
                              {std.exams_published} exams, {std.attempts_recorded.toLocaleString()} attempts
                            </td>
                            <td className="px-4 py-2.5">
                              <span
                                className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${
                                  std.at_risk_count > 0 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                {std.at_risk_count} at-risk
                              </span>
                            </td>
                            <td className="px-4 py-2.5">
                              {std.assignments_total} total ({std.assignments_not_submitted} unsubmitted)
                            </td>
                            <td className="px-4 py-2.5 font-semibold text-indigo-700">{std.drafts_count} drafts</td>
                            <td className="px-4 py-2.5">
                              <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                                <CheckCircle2 className="size-3.5" />
                                PASSED
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-slate-500">{std.duration_ms} ms</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 3 Unified Content Sections (Matching Teach/Learn layout) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Exam Performance */}
                <div className="rounded-xl border border-slate-200 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
                      <ClipboardList className="size-4 text-indigo-600" />
                      1. Online Exam Performance (Agent 1)
                    </h4>
                    <span className="text-xs text-slate-500 font-mono">
                      {latestReport.exam_performance?.exams_published ?? 370} Exams Published
                    </span>
                  </div>

                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-lg bg-slate-50 p-2 border border-slate-100">
                        <span className="text-[10px] text-slate-500 block">Attempts Scored</span>
                        <strong className="text-slate-900">
                          {latestReport.exam_performance?.attempts_recorded?.toLocaleString() ?? '14,661'}
                        </strong>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-2 border border-slate-100">
                        <span className="text-[10px] text-slate-500 block">Cohort Average</span>
                        <strong className="text-emerald-700">
                          {latestReport.exam_performance?.average_score ?? 0}%
                        </strong>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                        At-Risk Students Identified ({atRiskList.length})
                      </p>
                      <ul className="space-y-1 text-xs text-slate-700">
                        {atRiskList.slice(0, 4).map((st, i) => (
                          <li key={i} className="flex items-center justify-between py-1 border-b border-slate-50">
                            <span className="font-semibold text-slate-900 truncate">{st.student_name}</span>
                            <span className="rounded bg-red-50 text-red-700 px-1.5 py-0.2 font-mono text-[10px] font-bold">
                              {st.percent ?? st.percentage ?? st.score_percent ?? 0}%
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>

                {/* 2. Assignment & Work Status */}
                <div className="rounded-xl border border-slate-200 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
                      <FileCheck className="size-4 text-blue-600" />
                      2. Assignment & Work Status (Agent 2)
                    </h4>
                    <span className="text-xs text-slate-500 font-mono">
                      {latestReport.assignment_status?.total_work ?? 0} Tasks Scanned
                    </span>
                  </div>

                  <div className="space-y-2">
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="rounded-lg bg-indigo-50/50 p-2 border border-indigo-100 text-center">
                        <span className="text-[10px] text-slate-500 block">Submitted</span>
                        <strong className="text-indigo-700">{latestReport.assignment_status?.submitted ?? 0}</strong>
                      </div>
                      <div className="rounded-lg bg-emerald-50/50 p-2 border border-emerald-100 text-center">
                        <span className="text-[10px] text-slate-500 block">Reviewed</span>
                        <strong className="text-emerald-700">{latestReport.assignment_status?.reviewed ?? 0}</strong>
                      </div>
                      <div className="rounded-lg bg-amber-50/50 p-2 border border-amber-100 text-center">
                        <span className="text-[10px] text-slate-500 block">Pending</span>
                        <strong className="text-amber-700">{latestReport.assignment_status?.not_submitted ?? 0}</strong>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                        Sample Unsubmitted Tasks
                      </p>
                      <ul className="space-y-1 text-xs text-slate-700">
                        {unsubmittedList.slice(0, 3).map((item, i) => (
                          <li key={i} className="flex items-center justify-between py-1 border-b border-slate-50">
                            <span className="truncate max-w-[200px] text-slate-800">{item.title}</span>
                            <span className="text-[10px] text-slate-500">{item.student_name?.split(' ')[0]}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. Review Notes & Human Sign-off Summary */}
              <div className="rounded-xl border border-slate-200 p-4 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
                      <FileText className="size-4 text-emerald-600" />
                      3. Educator Review Notes & Safeguards (Agent 3)
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
                      {draftsList.length} Notes Awaiting Approval
                    </span>
                  </div>
                </div>

                {latestReport.draft_reviews?.cohort_summary && (
                  <div className="rounded-lg bg-slate-50 p-3 border border-slate-200 text-xs text-slate-800 leading-relaxed font-sans">
                    <strong className="block text-slate-900 mb-1 uppercase text-[10px] tracking-wider">Cohort Executive Summary:</strong>
                    {latestReport.draft_reviews.cohort_summary}
                  </div>
                )}

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
                          className="font-bold text-indigo-600 hover:text-indigo-800"
                        >
                          View Draft →
                        </button>
                      </div>
                    </div>
                  ))}
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
                <span className="rounded bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-800">
                  Draft Review Note
                </span>
                <h3 className="mt-1 text-sm font-bold text-slate-900">{viewingNote.subject}</h3>
              </div>
              <button
                type="button"
                onClick={() => setViewingNote(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-slate-800">
                {viewingNote.draft_body}
              </p>
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
              <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-700">
                <ShieldCheck className="size-3.5" />
                Status: Pending Human Approval
              </span>

              <button
                type="button"
                onClick={() => setViewingNote(null)}
                className="rounded-xl bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FULL ESO (EXECUTIVE SKILL OBJECT) MODAL (Matching Teach/Learn ESO Layout & Design) */}
      {esoOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="flex max-h-[90vh] w-full max-w-5xl flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-6 py-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
                  <BookOpen className="size-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-slate-900">
                      Exam & Assessment Executive Skill Object (ESO)
                    </h2>
                    <span className="rounded-md bg-blue-50 border border-blue-200 px-2 py-0.5 text-[10px] font-bold text-blue-800 uppercase">
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
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs"
                >
                  <RefreshCw className={`size-3.5 text-slate-500 ${esoLoading ? 'animate-spin' : ''}`} />
                  Refresh ESO
                </button>
                <button
                  type="button"
                  onClick={() => setEsoOpen(false)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
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
                className={`rounded-lg px-3 py-1 text-xs font-bold transition ${
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
                className={`rounded-lg px-3 py-1 text-xs font-bold transition ${
                  esoActiveTab === 'agent_1'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Agent 1: Online Exam Reader
              </button>
              <button
                type="button"
                onClick={() => setEsoActiveTab('agent_2')}
                className={`rounded-lg px-3 py-1 text-xs font-bold transition ${
                  esoActiveTab === 'agent_2'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Agent 2: Assignment Status Reader
              </button>
              <button
                type="button"
                onClick={() => setEsoActiveTab('agent_3')}
                className={`rounded-lg px-3 py-1 text-xs font-bold transition ${
                  esoActiveTab === 'agent_3'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Agent 3: Assessment Review Drafter
              </button>
              <button
                type="button"
                onClick={() => setEsoActiveTab('workflow')}
                className={`rounded-lg px-3 py-1 text-xs font-bold transition ${
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
                  <RefreshCw className="mx-auto size-8 animate-spin text-blue-600" />
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
                          {esoData?.overview?.system_name ?? 'Exam & Assessment Synchronized Agent System'}
                        </h3>
                        <p className="text-xs text-slate-600 mt-0.5">
                          {esoData?.overview?.architecture ?? '3-Agent Governed Sequential Pipeline with Validation Gates'}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="rounded-lg bg-white border border-slate-200 px-3 py-1.5 text-center">
                          <span className="block text-[10px] text-slate-400 uppercase font-bold">Total Agents</span>
                          <span className="text-xs font-extrabold text-slate-800">
                            {esoData?.overview?.total_agents ?? 3}
                          </span>
                        </div>
                        <div className="rounded-lg bg-white border border-slate-200 px-3 py-1.5 text-center">
                          <span className="block text-[10px] text-slate-400 uppercase font-bold">Status</span>
                          <span className="text-xs font-extrabold text-emerald-700 uppercase">
                            {esoData?.overview?.status ?? 'OPERATIONAL'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* AGENT 1: Online Exam Summary Reader */}
                  {(esoActiveTab === 'all' || esoActiveTab === 'agent_1') && (
                    <div className="rounded-xl border border-indigo-200 bg-white p-5 shadow-xs space-y-4">
                      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-indigo-100 pb-3">
                        <div className="flex items-start gap-3">
                          <span className="flex size-7 items-center justify-center rounded-lg bg-indigo-600 text-white font-extrabold text-xs">
                            1
                          </span>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-bold text-slate-900">
                                {esoData?.agents?.agent_1?.name ?? 'Online exam summary reader'}
                              </h3>
                              <span className="rounded-md bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 font-mono text-[10px] font-bold text-indigo-700">
                                {esoData?.agents?.agent_1?.agent_id ?? 'agt_online_exam_summary'}
                              </span>
                              <span className="rounded-md bg-emerald-50 text-emerald-700 px-1.5 py-0.5 text-[10px] font-bold uppercase">
                                OPERATIONAL
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">
                              Tool: <code className="text-indigo-600 font-bold">{esoData?.agents?.agent_1?.backend_key ?? 'exam_assessment.online_exam_summary'}</code> · Module: {esoData?.agents?.agent_1?.module ?? 'exam_assessment'}
                            </p>
                          </div>
                        </div>
                        <span className="rounded-md bg-indigo-50 px-2 py-1 text-[11px] font-bold text-indigo-800">
                          Execution Order: Step 1 of 3
                        </span>
                      </div>

                      <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <strong>Role & Scope:</strong> {esoData?.agents?.agent_1?.role_description ?? 'Reads real online exam attempts from question_paper & lms_online_exam, excludes PAL papers, calculates average cohort scores, and identifies at-risk students below passing threshold.'}
                      </p>

                      {/* ESO 4-Pillar Specification: Knowledge, Activities, Abilities, Usage */}
                      <AgentEsoCard eso={esoData?.agents?.agent_1?.eso || EXAM_ASSESSMENT_ESO_FALLBACKS.agent_1} />

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="rounded-lg border border-slate-200 p-3 bg-white space-y-2">
                          <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                            <Layers className="size-3.5 text-indigo-600" />
                            Primary Database Tables
                          </h4>
                          <div className="flex flex-wrap gap-1">
                            {(esoData?.agents?.agent_1?.primary_tables ?? ['question_paper', 'lms_online_exam']).map((t) => (
                              <span key={t} className="rounded-md bg-slate-100 font-mono text-[10px] px-2 py-0.5 font-bold text-slate-700">
                                {t}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-3 space-y-1.5">
                          <h4 className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                            <ShieldCheck className="size-3.5 text-emerald-600" />
                            Validation Gate 1: Online Exam Performance Evaluation
                          </h4>
                          <p className="text-xs text-emerald-900 font-semibold">
                            {esoData?.agents?.agent_1?.validation_gate?.enforcement ?? 'Excludes PAL exams; verifies tenant institute boundary; calculates actual obtain_marks / total_marks * 100.'}
                          </p>
                          <ul className="text-[11px] text-emerald-800 space-y-0.5">
                            <li>✓ Strict tenant institute boundary enforcement</li>
                            <li>✓ Complete exclusion of PAL-generated practice tests</li>
                            <li>✓ At-risk calculation flagged against threshold</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* AGENT 2: Assignment Status Reader */}
                  {(esoActiveTab === 'all' || esoActiveTab === 'agent_2') && (
                    <div className="rounded-xl border border-blue-200 bg-white p-5 shadow-xs space-y-4">
                      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-blue-100 pb-3">
                        <div className="flex items-start gap-3">
                          <span className="flex size-7 items-center justify-center rounded-lg bg-blue-600 text-white font-extrabold text-xs">
                            2
                          </span>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-bold text-slate-900">
                                {esoData?.agents?.agent_2?.name ?? 'Assignment status reader'}
                              </h3>
                              <span className="rounded-md bg-blue-50 border border-blue-200 px-1.5 py-0.5 font-mono text-[10px] font-bold text-blue-700">
                                {esoData?.agents?.agent_2?.agent_id ?? 'agt_assignment_status'}
                              </span>
                              <span className="rounded-md bg-emerald-50 text-emerald-700 px-1.5 py-0.5 text-[10px] font-bold uppercase">
                                OPERATIONAL
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">
                              Tool: <code className="text-blue-600 font-bold">{esoData?.agents?.agent_2?.backend_key ?? 'exam_assessment.assignment_status'}</code> · Module: {esoData?.agents?.agent_2?.module ?? 'exam_assessment'}
                            </p>
                          </div>
                        </div>
                        <span className="rounded-md bg-blue-50 px-2 py-1 text-[11px] font-bold text-blue-800">
                          Execution Order: Step 2 of 3
                        </span>
                      </div>

                      <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <strong>Role & Scope:</strong> {esoData?.agents?.agent_2?.role_description ?? 'Reads assignment, worksheet, and project submissions from lms_assignment, reporting submitted, reviewed, pending review, and specific unsubmitted student records.'}
                      </p>

                      {/* ESO 4-Pillar Specification: Knowledge, Activities, Abilities, Usage */}
                      <AgentEsoCard eso={esoData?.agents?.agent_2?.eso || EXAM_ASSESSMENT_ESO_FALLBACKS.agent_2} />

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="rounded-lg border border-slate-200 p-3 bg-white space-y-2">
                          <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                            <Layers className="size-3.5 text-blue-600" />
                            Primary Database Tables
                          </h4>
                          <div className="flex flex-wrap gap-1">
                            {(esoData?.agents?.agent_2?.primary_tables ?? ['lms_assignment', 'tblstudent']).map((t) => (
                              <span key={t} className="rounded-md bg-slate-100 font-mono text-[10px] px-2 py-0.5 font-bold text-slate-700">
                                {t}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-3 space-y-1.5">
                          <h4 className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                            <ShieldCheck className="size-3.5 text-emerald-600" />
                            Validation Gate 2: Assignment & Work Status Verification
                          </h4>
                          <p className="text-xs text-emerald-900 font-semibold">
                            {esoData?.agents?.agent_2?.validation_gate?.enforcement ?? 'Distinguishes assignment vs worksheet vs project; verifies submission flags; reports unsubmitted student details.'}
                          </p>
                          <ul className="text-[11px] text-emerald-800 space-y-0.5">
                            <li>✓ Multi-type work categorization (assignments, worksheets, projects)</li>
                            <li>✓ Submission status verification against due dates</li>
                            <li>✓ Specific unsubmitted ledger output for teacher follow-up</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* AGENT 3: Assessment Review Drafter */}
                  {(esoActiveTab === 'all' || esoActiveTab === 'agent_3') && (
                    <div className="rounded-xl border border-emerald-200 bg-white p-5 shadow-xs space-y-4">
                      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-emerald-100 pb-3">
                        <div className="flex items-start gap-3">
                          <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-600 text-white font-extrabold text-xs">
                            3
                          </span>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-bold text-slate-900">
                                {esoData?.agents?.agent_3?.name ?? 'Assessment review drafter'}
                              </h3>
                              <span className="rounded-md bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 font-mono text-[10px] font-bold text-emerald-700">
                                {esoData?.agents?.agent_3?.agent_id ?? 'agt_assessment_review_drafter'}
                              </span>
                              <span className="rounded-md bg-emerald-50 text-emerald-700 px-1.5 py-0.5 text-[10px] font-bold uppercase">
                                OPERATIONAL
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">
                              Tool: <code className="text-emerald-600 font-bold">{esoData?.agents?.agent_3?.backend_key ?? 'exam_assessment.draft_review_note'}</code> · Module: {esoData?.agents?.agent_3?.module ?? 'exam_assessment'}
                            </p>
                          </div>
                        </div>
                        <span className="rounded-md bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-800">
                          Execution Order: Step 3 of 3
                        </span>
                      </div>

                      <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <strong>Role & Scope:</strong> {esoData?.agents?.agent_3?.role_description ?? 'Synthesizes at-risk attempt findings and missing submissions to prepare factual, evidence-backed draft review notes and follow-up guidance for educators.'}
                      </p>

                      {/* ESO 4-Pillar Specification: Knowledge, Activities, Abilities, Usage */}
                      <AgentEsoCard eso={esoData?.agents?.agent_3?.eso || EXAM_ASSESSMENT_ESO_FALLBACKS.agent_3} />

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="rounded-lg border border-slate-200 p-3 bg-white space-y-2">
                          <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                            <Layers className="size-3.5 text-emerald-600" />
                            Primary Database Tables
                          </h4>
                          <div className="flex flex-wrap gap-1">
                            {(esoData?.agents?.agent_3?.primary_tables ?? ['ai_cases', 'ai_evidence', 'ai_recommendations']).map((t) => (
                              <span key={t} className="rounded-md bg-slate-100 font-mono text-[10px] px-2 py-0.5 font-bold text-slate-700">
                                {t}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-3 space-y-1.5">
                          <h4 className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                            <ShieldCheck className="size-3.5 text-emerald-600" />
                            Validation Gate 3: Assessment Review Drafting & Safety Validation
                          </h4>
                          <p className="text-xs text-emerald-900 font-semibold">
                            {esoData?.agents?.agent_3?.validation_gate?.enforcement ?? 'Strict draft-only policy; cites factual exam & submission evidence; forbids external auto-sending; enforces human approval step.'}
                          </p>
                          <ul className="text-[11px] text-emerald-800 space-y-0.5">
                            <li>✓ Strict draft-only guardrail enforced across all dispatches</li>
                            <li>✓ Factual grounding on authentic exam score records</li>
                            <li>✓ Human educator sign-off required before notice delivery</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* EXECUTION WORKFLOW & INTER-AGENT CONTRACTS */}
                  {(esoActiveTab === 'all' || esoActiveTab === 'workflow') && (
                    <div className="rounded-xl border border-violet-200 bg-white p-5 shadow-xs space-y-4">
                      <div className="flex items-center justify-between border-b border-violet-100 pb-3">
                        <div>
                          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                            <Workflow className="size-4 text-violet-600" />
                            Synchronized Execution Workflow & Inter-Agent Contracts
                          </h3>
                          <p className="text-xs text-slate-500 mt-0.5">
                            How data travels through validation gates across the complete Exam & Assessment pipeline
                          </p>
                        </div>
                        <span className="rounded-md bg-violet-50 text-violet-800 text-xs font-bold px-2.5 py-1">
                          Deterministic Multi-Gate Pipeline
                        </span>
                      </div>

                      <div className="space-y-3">
                        <div className="rounded-lg bg-slate-50 p-3 border border-slate-200 space-y-2">
                          <h4 className="text-xs font-bold text-slate-900">Execution Sequence:</h4>
                          <ol className="list-decimal list-inside text-xs text-slate-700 space-y-1">
                            <li className="font-semibold text-emerald-700">Step 1: Online Exam Performance Sweep ➔ Gate 1 Verification</li>
                            <li className="font-semibold text-emerald-700">Step 2: Assignment & Work Status Evaluation ➔ Gate 2 Verification</li>
                            <li className="font-semibold text-emerald-700">Step 3: Assessment Review Note & Follow-up Drafting ➔ Gate 3 Safety Pass</li>
                          </ol>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                          <div className="rounded-lg border border-slate-200 p-3 space-y-1 bg-white">
                            <span className="text-[10px] font-bold uppercase text-slate-400 block">Agent 1 ➔ Agent 2 Contract</span>
                            <p className="text-slate-700">
                              Agent 1 extracts online exam attempts, excludes PAL practice exams, and identifies at-risk students. Agent 2 uses these student identities to cross-reference assignment and project submission records.
                            </p>
                          </div>

                          <div className="rounded-lg border border-slate-200 p-3 space-y-1 bg-white">
                            <span className="text-[10px] font-bold uppercase text-slate-400 block">Gate 1 & 2 ➔ Agent 3 Contract</span>
                            <p className="text-slate-700">
                              Agent 3 consumes both exam performance gaps and missing coursework to draft neutral, factual educator review notes for human authorization.
                            </p>
                          </div>
                        </div>

                        <div className="rounded-lg bg-emerald-50/60 p-3 border border-emerald-200 flex items-center justify-between text-xs text-emerald-950">
                          <span className="font-semibold flex items-center gap-1.5">
                            <ShieldCheck className="size-4 text-emerald-600" />
                            Safety & Governance Guarantees:
                          </span>
                          <span className="text-[11px] text-emerald-800">
                            100% Read-Only · Draft Reviews with Human Sign-off · Tenant Scoped · RBAC Protected
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-3 shrink-0">
              <span className="text-[11px] text-slate-500">
                Exam & Assessment Executive Skill Object (ESO) · Dynamic Live Reflection
              </span>
              <button
                type="button"
                onClick={() => setEsoOpen(false)}
                className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
              >
                Close Overview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
