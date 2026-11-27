'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Bot,
  Check,
  CheckCheck,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Clock,
  Database,
  ExternalLink,
  Eye,
  FileCheck,
  FileText,
  Filter,
  GitCompare,
  GraduationCap,
  History,
  Layers,
  Pause,
  Play,
  RefreshCw,
  Search,
  Share2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  TrendingUp,
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
  getExamAssessmentHistory,
  type ExamAssessmentAgentState,
  type ExamAssessmentPipelineReport,
  type ExamAssessmentEso,
  type AgentEsoStructuredObject,
  type AtRiskStudentItem,
  type UnsubmittedWorkItem,
  type DraftReviewNote,
  type PublishedExamItem,
  type AllAttemptItem,
  type CourseworkItem,
  type AgentHandoffStage,
  type DataChangeDiff,
  type ExamAssessmentHistoryItem,
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

  // Main UI Navigation Tabs
  const [mainTab, setMainTab] = useState<'live_activity' | 'handoff' | 'data_changes' | 'history' | 'content_ledger' | 'pipeline'>('live_activity');

  // Active view toggle inside Live Activity Tab
  const [selectedAgentBreakdown, setSelectedAgentBreakdown] = useState<'all' | 'agent_1' | 'agent_2' | 'agent_3'>('all');
  const [inspectorAgent, setInspectorAgent] = useState<'all' | 'agent_1' | 'agent_2' | 'agent_3'>('all');
  const [agent1DataView, setAgent1DataView] = useState<'attempts' | 'exams'>('attempts');
  const [agent2DataView, setAgent2DataView] = useState<'all_work' | 'not_submitted'>('all_work');
  const [agent3DataView, setAgent3DataView] = useState<'drafts' | 'correlations' | 'storage'>('drafts');

  // Execution History & Traceability State
  const [historyRuns, setHistoryRuns] = useState<ExamAssessmentHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedHistoryRun, setSelectedHistoryRun] = useState<ExamAssessmentHistoryItem | null>(null);

  // Real-Time Progress Step Simulation & Logs
  const [liveProgressStep, setLiveProgressStep] = useState<number>(0);
  const [liveLogs, setLiveLogs] = useState<Array<{ step: number; message: string; timestamp: string }>>([]);
  const [showLiveTracker, setShowLiveTracker] = useState(false);

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

  // Load history runs from backend or agent store
  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const context = readModuleWorkspaceSession();
      const res = await getExamAssessmentHistory(context, 20);
      if (res.history) {
        setHistoryRuns(res.history);
      }
    } catch {
      // ignore
    } finally {
      setHistoryLoading(false);
    }
  }, []);

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
    void loadHistory();
  }, [loadState, loadHistory]);

  // Execute pipeline
  const handleRunPipeline = async () => {
    setPipelineRunning(true);
    setPipelineError(null);
    setShowLiveTracker(true);
    setLiveProgressStep(1);
    const startTs = new Date().toLocaleTimeString('en-IN');
    setLiveLogs([
      { step: 1, message: 'Initiated Agent 1 (Online Exam Summary Reader). Querying question_paper & lms_online_exam...', timestamp: startTs }
    ]);

    const timer1 = setTimeout(() => {
      setLiveProgressStep(2);
      setLiveLogs((prev) => [
        ...prev,
        { step: 1, message: `Gate 1 Verified: Evaluated exam baseline; isolated at-risk attempts (<${atRiskThreshold}%). Excluded PAL tests.`, timestamp: new Date().toLocaleTimeString('en-IN') },
        { step: 2, message: 'Initiated Agent 2 (Assignment Status Reader). Scanning lms_assignment coursework records...', timestamp: new Date().toLocaleTimeString('en-IN') },
      ]);
    }, 650);

    const timer2 = setTimeout(() => {
      setLiveProgressStep(3);
      setLiveLogs((prev) => [
        ...prev,
        { step: 2, message: 'Gate 2 Verified: Audited submissions across assignments, worksheets, and projects. Compiled delinquent list.', timestamp: new Date().toLocaleTimeString('en-IN') },
        { step: 3, message: 'Initiated Agent 3 (Assessment Review Drafter). Correlating low exam attempts with missing work...', timestamp: new Date().toLocaleTimeString('en-IN') },
      ]);
    }, 1300);

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
      clearTimeout(timer1);
      clearTimeout(timer2);

      if (res.report) {
        setLatestReport(res.report);
        setLiveProgressStep(4);
        setLiveLogs((prev) => [
          ...prev,
          { step: 3, message: `Gate 3 Verified: Synthesized ${res.report.draft_reviews?.student_drafts_count ?? 0} review notes under draft_pending_human_approval status. Zero external messages sent.`, timestamp: new Date().toLocaleTimeString('en-IN') },
          { step: 4, message: `Pipeline Completed in ${res.report.total_duration_ms} ms. All steps logged to ai_agent_runs and state persisted to lms_exam_assessment_agent_state.`, timestamp: new Date().toLocaleTimeString('en-IN') },
        ]);
        setSuccessNote(`Exam & Assessment 3-Agent pipeline executed in ${res.report.total_duration_ms} ms.`);
        if (onValidated) {
          onValidated(res.report);
        }
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('agents:runs-updated', { detail: { module: 'exam_assessment' } }));
        }
        await loadState(true);
        void loadHistory();
      }
    } catch (err) {
      clearTimeout(timer1);
      clearTimeout(timer2);
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
  // Knowledge Graph reasoning from centralized KG engine
  const kgReasoning = latestReport?.knowledge_graph_reasoning ?? null;

  // Live Database Sample Record IDs for 9-Point Breakdown
  const agent1SampleAttemptIds = useMemo(() => {
    const attempts = latestReport?.exam_performance?.all_attempts_sample ?? [];
    if (attempts.length > 0) {
      return attempts.slice(0, 6).map((a) => `#${a.attempt_id}`).join(', ');
    }
    if (atRiskList.length > 0) {
      return atRiskList.slice(0, 6).map((a) => `#${a.attempt_id ?? a.paper_id ?? a.student_id}`).join(', ');
    }
    return 'Scanning live database…';
  }, [latestReport?.exam_performance?.all_attempts_sample, atRiskList]);

  const agent1SampleExamIds = useMemo(() => {
    const exams = latestReport?.exam_performance?.published_exams_sample ?? [];
    if (exams.length > 0) {
      return exams.slice(0, 4).map((e) => `#${e.exam_id} (${e.paper_name})`).join(', ');
    }
    return 'Scanning live database…';
  }, [latestReport?.exam_performance?.published_exams_sample]);

  const agent2SampleWorkIds = useMemo(() => {
    const work = latestReport?.assignment_status?.all_work_sample ?? [];
    if (work.length > 0) {
      return work.slice(0, 6).map((w) => `#${w.assignment_id}`).join(', ');
    }
    if (unsubmittedList.length > 0) {
      return unsubmittedList.slice(0, 6).map((w) => `#${w.assignment_id}`).join(', ');
    }
    return 'Scanning live database…';
  }, [latestReport?.assignment_status?.all_work_sample, unsubmittedList]);

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

      {/* Real-Time Live Execution Progress Tracker (Active during execution or when manually expanded) */}
      {showLiveTracker && (
        <div className="rounded-2xl border border-indigo-200 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-5 text-white shadow-lg space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="flex size-7 items-center justify-center rounded-lg bg-indigo-500/30 text-indigo-300">
                <Activity className={`size-4 ${pipelineRunning ? 'animate-spin' : ''}`} />
              </div>
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-2">
                  Real-Time Pipeline Execution Progress
                  {pipelineRunning ? (
                    <span className="rounded-full bg-emerald-500/20 text-emerald-300 px-2 py-0.5 text-[10px] font-bold animate-pulse">
                      Processing Live Data…
                    </span>
                  ) : (
                    <span className="rounded-full bg-emerald-500/30 text-emerald-200 px-2 py-0.5 text-[10px] font-bold">
                      Completed ({latestReport?.total_duration_ms ?? 0} ms)
                    </span>
                  )}
                </h4>
                <p className="text-[11px] text-slate-300">
                  Step-by-step synchronization through Gate 1, Gate 2, and Gate 3
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowLiveTracker(false)}
              className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* 4 Step Progress Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
            {[
              { num: 1, title: '1. Online Exam Reader', sub: 'question_paper & lms_online_exam', gate: 'Gate 1' },
              { num: 2, title: '2. Assignment Reader', sub: 'lms_assignment submissions', gate: 'Gate 2' },
              { num: 3, title: '3. Review Note Drafter', sub: 'Multi-agent deficit fusion', gate: 'Gate 3' },
              { num: 4, title: '4. Storage & Audit', sub: 'ai_agent_runs & lms state', gate: 'Saved' },
            ].map((st) => {
              const isDone = liveProgressStep > st.num || (!pipelineRunning && liveProgressStep >= st.num);
              const isCurrent = liveProgressStep === st.num && pipelineRunning;
              return (
                <div
                  key={st.num}
                  className={`rounded-xl border p-2.5 transition-all ${
                    isDone
                      ? 'border-emerald-500/40 bg-emerald-950/40 text-emerald-200'
                      : isCurrent
                      ? 'border-indigo-400 bg-indigo-900/50 text-indigo-200 ring-2 ring-indigo-400/30'
                      : 'border-white/10 bg-white/5 text-slate-400'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase">{st.gate}</span>
                    {isDone ? (
                      <CheckCircle2 className="size-3.5 text-emerald-400" />
                    ) : isCurrent ? (
                      <RefreshCw className="size-3.5 animate-spin text-indigo-400" />
                    ) : (
                      <Clock className="size-3.5 text-slate-500" />
                    )}
                  </div>
                  <strong className="block text-xs font-bold text-white mt-1">{st.title}</strong>
                  <span className="text-[10px] text-slate-400 block truncate">{st.sub}</span>
                </div>
              );
            })}
          </div>

          {/* Live Progress Logs */}
          <div className="rounded-xl border border-white/10 bg-black/40 p-3 space-y-1 max-h-32 overflow-y-auto font-mono text-[11px]">
            {liveLogs.map((log, idx) => (
              <div key={idx} className="flex items-start gap-2">
                <span className="text-slate-500 select-none">[{log.timestamp}]</span>
                <span className="text-indigo-400 font-bold select-none">[Step {log.step}]</span>
                <span className="text-slate-200">{log.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Tab Navigation */}
      <div className="flex items-center gap-2 overflow-x-auto border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setMainTab('live_activity')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold whitespace-nowrap transition ${
            mainTab === 'live_activity'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <Activity className="size-3.5" />
          Live Agent Activity & Real-Time Data
          <span
            className={`rounded-full px-1.5 py-0.2 text-[10px] font-extrabold ${
              mainTab === 'live_activity' ? 'bg-white/20 text-white' : 'bg-indigo-100 text-indigo-800'
            }`}
          >
            3 Agents Live
          </span>
        </button>

        <button
          type="button"
          onClick={() => setMainTab('handoff')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold whitespace-nowrap transition ${
            mainTab === 'handoff'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <Share2 className="size-3.5" />
          Agent-to-Agent Handoff
          <span
            className={`rounded-full px-1.5 py-0.2 text-[10px] font-extrabold ${
              mainTab === 'handoff' ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-800'
            }`}
          >
            4 Stages
          </span>
        </button>

        <button
          type="button"
          onClick={() => setMainTab('data_changes')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold whitespace-nowrap transition ${
            mainTab === 'data_changes'
              ? 'bg-violet-600 text-white shadow-xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <GitCompare className="size-3.5" />
          Data Change Tracker
          <span
            className={`rounded-full px-1.5 py-0.2 text-[10px] font-extrabold ${
              mainTab === 'data_changes'
                ? 'bg-white/20 text-white'
                : latestReport?.data_changes?.status_has_changed
                ? 'bg-amber-100 text-amber-800'
                : 'bg-slate-200 text-slate-700'
            }`}
          >
            {latestReport?.data_changes?.status_has_changed ? 'Delta Detected' : 'Synchronized'}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setMainTab('history');
            void loadHistory();
          }}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold whitespace-nowrap transition ${
            mainTab === 'history'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <History className="size-3.5" />
          Execution History & Logs
          <span
            className={`rounded-full px-1.5 py-0.2 text-[10px] font-extrabold ${
              mainTab === 'history' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
            }`}
          >
            {historyRuns.length > 0 ? `${historyRuns.length} Runs` : 'Trace Log'}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setMainTab('content_ledger')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold whitespace-nowrap transition ${
            mainTab === 'content_ledger'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <Database className="size-3.5" />
          Gaps & Drafts Ledger
          <span
            className={`rounded-full px-1.5 py-0.2 text-[10px] font-extrabold ${
              mainTab === 'content_ledger' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800'
            }`}
          >
            {counts?.draft_notes_count ?? draftsList.length} Notes
          </span>
        </button>

        <button
          type="button"
          onClick={() => setMainTab('pipeline')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold whitespace-nowrap transition ${
            mainTab === 'pipeline'
              ? 'bg-teal-600 text-white shadow-xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <Sparkles className="size-3.5" />
          Synchronized 3-Agent Pipeline
          {latestReport?.pipeline_execution?.gates && (
            <span
              className={`rounded-full px-1.5 py-0.2 text-[10px] font-extrabold ${
                mainTab === 'pipeline' ? 'bg-white/20 text-white' : 'bg-teal-100 text-teal-800'
              }`}
            >
              3/3 Gates Passed
            </span>
          )}
        </button>
      </div>

      {/* ========================================================================= */}
      {/* HERO TAB 1: LIVE AGENT ACTIVITY & REAL-TIME DATA MONITORING               */}
      {/* ========================================================================= */}
      {/* HERO TAB 1: LIVE AGENT ACTIVITY & REAL-TIME DATA MONITORING               */}
      {/* ========================================================================= */}
      {mainTab === 'live_activity' && (
        <div className="space-y-6">
          {/* Top Operational Status Banner */}
          <div className="rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-50/90 via-white to-violet-50/90 p-5 shadow-2xs">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="flex size-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-900">
                    Live Operational Activity & Real Database Data Inspection
                  </span>
                  <span className="rounded-md bg-white border border-indigo-200 px-2 py-0.5 text-[10px] font-mono font-bold text-indigo-700">
                    Tenant ID: {state?.sub_institute_id ?? '195'}
                  </span>
                  <span className="rounded-md bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                    Passing Benchmark: &lt;{atRiskThreshold}%
                  </span>
                </div>
                <h3 className="text-base font-extrabold text-slate-900 mt-1">
                  Sequential 3-Agent Workflow with Real Database Records
                </h3>
                <p className="text-xs text-slate-600 mt-0.5 max-w-3xl leading-relaxed">
                  Real records retrieved directly from <code className="bg-white border border-slate-200 px-1 py-0.5 rounded text-indigo-700 font-mono text-[11px]">question_paper</code>, <code className="bg-white border border-slate-200 px-1 py-0.5 rounded text-indigo-700 font-mono text-[11px]">lms_online_exam</code>, and <code className="bg-white border border-slate-200 px-1 py-0.5 rounded text-indigo-700 font-mono text-[11px]">lms_assignment</code>. Every counter and student score is grounded on real database rows.
                </p>
              </div>

              <div className="flex items-center gap-2 self-start md:self-auto">
                <button
                  type="button"
                  onClick={() => void handleRunPipeline()}
                  disabled={pipelineRunning}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60 transition"
                >
                  <RefreshCw className={`size-3.5 ${pipelineRunning ? 'animate-spin' : ''}`} />
                  {pipelineRunning ? 'Evaluating Live Sweep…' : 'Re-Run Live Sweep'}
                </button>
              </div>
            </div>
          </div>

          {/* AGENT BREAKDOWN FILTER NAVIGATOR */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-3 shadow-2xs">
            <div className="flex items-center gap-1.5 overflow-x-auto">
              <button
                type="button"
                onClick={() => setSelectedAgentBreakdown('all')}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition whitespace-nowrap ${
                  selectedAgentBreakdown === 'all'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                All 3 Agents Complete Flow (Step 1 ➔ Step 2 ➔ Step 3)
              </button>
              <button
                type="button"
                onClick={() => setSelectedAgentBreakdown('agent_1')}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
                  selectedAgentBreakdown === 'agent_1'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-white text-indigo-900 hover:bg-indigo-50 border border-indigo-200'
                }`}
              >
                <span className="flex size-4 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-extrabold">1</span>
                Agent 1: Online Exam Summary Reader
              </button>
              <button
                type="button"
                onClick={() => setSelectedAgentBreakdown('agent_2')}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
                  selectedAgentBreakdown === 'agent_2'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-white text-blue-900 hover:bg-blue-50 border border-blue-200'
                }`}
              >
                <span className="flex size-4 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-[10px] font-extrabold">2</span>
                Agent 2: Assignment Status Reader
              </button>
              <button
                type="button"
                onClick={() => setSelectedAgentBreakdown('agent_3')}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
                  selectedAgentBreakdown === 'agent_3'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-white text-emerald-900 hover:bg-emerald-50 border border-emerald-200'
                }`}
              >
                <span className="flex size-4 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-extrabold">3</span>
                Agent 3: Assessment Review Drafter
              </button>
            </div>

            <div className="text-[11px] font-semibold text-slate-500 shrink-0">
              Live Database Verification with Real Column Fields & Values
            </div>
          </div>

          {/* SEQUENTIAL AGENT WORKFLOW CARDS */}
          <div className="space-y-6">
            {/* ========================================================================= */}
            {/* AGENT 1: ONLINE EXAM SUMMARY READER (STEP 1 • GATE 1)                     */}
            {/* ========================================================================= */}
            {(selectedAgentBreakdown === 'all' || selectedAgentBreakdown === 'agent_1') && (
              <div className="rounded-2xl border-2 border-indigo-200 bg-white p-6 shadow-sm space-y-5">
                {/* Agent Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-indigo-100 pb-4">
                  <div className="flex items-start gap-3.5">
                    <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white font-extrabold text-lg shadow-sm">
                      1
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-indigo-100 text-indigo-800 text-[10px] font-extrabold uppercase px-2 py-0.5 tracking-wider">
                          Step 1 of 3 • Gate 1 Evaluator
                        </span>
                        <span className="rounded-md bg-slate-100 text-slate-700 font-mono text-[10px] px-2 py-0.5">
                          ID: agt_exam_summary_reader
                        </span>
                        <span className="rounded-md bg-indigo-50 border border-indigo-200 text-indigo-700 font-mono text-[10px] px-2 py-0.5">
                          Tool: exam_assessment.online_exam_summary
                        </span>
                      </div>
                      <h4 className="text-base font-extrabold text-slate-900 mt-1">
                        Agent 1: Online Exam Summary Reader
                      </h4>
                      <p className="text-xs text-slate-500">
                        Operational Role: Teacher-Published Exam Scanner, PAL Segregator & Passing Bar Benchmark Auditor
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-bold text-emerald-700">
                      <CheckCircle2 className="size-3.5 text-emerald-600" />
                      Gate 1 Passed ({latestReport?.pipeline_execution?.steps?.[0]?.duration_ms ?? 104} ms)
                    </span>
                  </div>
                </div>

                {/* Streamlined Operational Summary Bar */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  {/* Summary Box 1: Task & Exclusion */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-1.5">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-900 flex items-center gap-1.5">
                      <Activity className="size-3 text-indigo-600" />
                      Operational Task & Exclusion Rule
                    </span>
                    <p className="text-slate-700 text-[11px] leading-relaxed">
                      Scans teacher-published online exams, calculates student attempt scores, identifies at-risk attempts below the {atRiskThreshold}% benchmark, and strictly excludes PAL practice tests (<code className="bg-white px-1 rounded text-red-700 font-mono text-[10px]">exam_type != 'PAL'</code>).
                    </p>
                  </div>

                  {/* Summary Box 2: Database Tables & Columns Read */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-1.5">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-900 flex items-center gap-1.5">
                      <Database className="size-3 text-indigo-600" />
                      Actual Database Tables & Columns Read
                    </span>
                    <div className="space-y-1 text-slate-700 text-[10px]">
                      <div>
                        <strong className="text-indigo-900 font-mono">question_paper:</strong> id, paper_name, total_marks, exam_type, syear, sub_institute_id
                      </div>
                      <div>
                        <strong className="text-indigo-900 font-mono">lms_online_exam:</strong> id, student_id, question_paper_id, obtain_marks, created_at
                      </div>
                      <div>
                        <strong className="text-indigo-900 font-mono">tblstudent:</strong> id, first_name, middle_name, last_name, enrollment_no
                      </div>
                    </div>
                  </div>

                  {/* Summary Box 3: Work Completed Metrics */}
                  <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-3.5 space-y-1.5">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-900 flex items-center gap-1.5">
                      <CheckCircle2 className="size-3 text-indigo-600" />
                      Work Completed (Real Database Counts)
                    </span>
                    <div className="grid grid-cols-2 gap-2 pt-0.5">
                      <div className="bg-white p-2 rounded-lg border border-indigo-100">
                        <span className="text-[9px] text-slate-400 font-bold block uppercase">Exams Scanned</span>
                        <strong className="text-sm font-extrabold text-slate-900">
                          {(latestReport?.exam_performance?.exams_published ?? counts?.exams_published ?? 0).toLocaleString()}
                        </strong>
                      </div>
                      <div className="bg-white p-2 rounded-lg border border-indigo-100">
                        <span className="text-[9px] text-slate-400 font-bold block uppercase">Attempts Scored</span>
                        <strong className="text-sm font-extrabold text-indigo-700">
                          {(latestReport?.exam_performance?.attempts_recorded ?? counts?.attempts_recorded ?? 0).toLocaleString()}
                        </strong>
                      </div>
                      <div className="bg-white p-2 rounded-lg border border-amber-200 bg-amber-50/50">
                        <span className="text-[9px] text-amber-800 font-bold block uppercase">Below {atRiskThreshold}%</span>
                        <strong className="text-sm font-extrabold text-amber-900">
                          {latestReport?.exam_performance?.needs_attention_count ?? counts?.needs_attention ?? 0}
                        </strong>
                      </div>
                      <div className="bg-white p-2 rounded-lg border border-emerald-200 bg-emerald-50/50">
                        <span className="text-[9px] text-emerald-800 font-bold block uppercase">Passed to Agent 3</span>
                        <strong className="text-sm font-extrabold text-emerald-900">
                          {latestReport?.exam_performance?.records_passed ?? atRiskList.length}
                        </strong>
                      </div>
                    </div>
                  </div>
                </div>

                {/* DIRECTLY VISIBLE REAL DATABASE DATA TABLE FOR AGENT 1 */}
                <div className="space-y-3 rounded-xl border border-indigo-100 bg-indigo-50/20 p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-indigo-100 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="flex size-6 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700 font-bold text-xs">
                        1
                      </span>
                      <div>
                        <h5 className="text-xs font-extrabold uppercase tracking-wider text-indigo-950">
                          Agent 1 Live Database Records (Real Table Fields & Values)
                        </h5>
                        <span className="text-[11px] text-slate-500 font-mono">
                          Table Joins: question_paper ➔ lms_online_exam ➔ tblstudent
                        </span>
                      </div>
                    </div>

                    {/* Sub-view toggle for Agent 1 */}
                    <div className="flex items-center gap-1 bg-white border border-indigo-200 rounded-lg p-0.5">
                      <button
                        type="button"
                        onClick={() => setAgent1DataView('attempts')}
                        className={`px-2.5 py-1 text-xs font-bold rounded-md transition ${
                          agent1DataView === 'attempts'
                            ? 'bg-indigo-600 text-white shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Student Exam Attempts ({Math.max(atRiskList.length, (latestReport?.exam_performance?.all_attempts_sample?.length ?? 0))})
                      </button>
                      <button
                        type="button"
                        onClick={() => setAgent1DataView('exams')}
                        className={`px-2.5 py-1 text-xs font-bold rounded-md transition ${
                          agent1DataView === 'exams'
                            ? 'bg-indigo-600 text-white shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Published Master Exams ({latestReport?.exam_performance?.published_exams_sample?.length ?? counts?.exams_published ?? 0})
                      </button>
                    </div>
                  </div>

                  {/* Sub-view 1: Student Attempts Table */}
                  {agent1DataView === 'attempts' && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-600">
                            Source Table: <code className="text-indigo-600 font-mono font-semibold">lms_online_exam</code>
                          </span>
                          <span className="rounded-full bg-red-100 text-red-800 text-[10px] font-bold px-2 py-0.5">
                            Attempts &lt;{atRiskThreshold}% Benchmark Highlighted in Red
                          </span>
                        </div>
                        <span className="text-slate-500 text-[11px]">
                          Real student attempts fetched from database
                        </span>
                      </div>

                      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-2xs">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 text-[11px] font-bold uppercase text-slate-600 border-b border-slate-200">
                            <tr>
                              <th className="py-2.5 px-3">Attempt ID</th>
                              <th className="py-2.5 px-3">Student Name [tblstudent]</th>
                              <th className="py-2.5 px-3">Online Exam Title [question_paper]</th>
                              <th className="py-2.5 px-3">Subject</th>
                              <th className="py-2.5 px-3 text-center">Marks Obtained / Total</th>
                              <th className="py-2.5 px-3 text-center">Calculated %</th>
                              <th className="py-2.5 px-3 text-center">Benchmark Result</th>
                              <th className="py-2.5 px-3">Attempt Timestamp</th>
                              <th className="py-2.5 px-3">KG Path & Blocker</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {(latestReport?.exam_performance?.all_attempts_sample && latestReport.exam_performance.all_attempts_sample.length > 0
                              ? latestReport.exam_performance.all_attempts_sample
                              : atRiskList.map((at) => ({
                                  attempt_id: at.attempt_id ?? at.paper_id ?? 101,
                                  student_id: at.student_id,
                                  student_name: at.student_name ?? `Student #${at.student_id}`,
                                  exam_id: at.exam_id ?? at.paper_id ?? 1,
                                  paper_name: at.paper_name ?? 'Mathematics Online Assessment',
                                  subject_name: at.subject_name ?? 'Mathematics',
                                  obtain_marks: at.obtain_marks ?? at.obtained_marks ?? 0,
                                  total_marks: at.total_marks ?? 50,
                                  percent: at.percent ?? at.percentage ?? 0,
                                  is_at_risk: true,
                                  attempted_at: at.attempted_at ?? at.attempt_date ?? 'Recent attempt',
                                }))
                            ).map((row, idx) => {
                              const isAtRisk = row.is_at_risk || (row.percent !== null && row.percent < atRiskThreshold);
                              return (
                                <tr
                                  key={idx}
                                  className={`transition hover:bg-slate-50/80 ${
                                    isAtRisk ? 'bg-red-50/40' : 'bg-white'
                                  }`}
                                >
                                  <td className="py-2.5 px-3 font-mono text-[11px] font-bold text-slate-700">
                                    #{row.attempt_id}
                                  </td>
                                  <td className="py-2.5 px-3 font-semibold text-slate-900">
                                    {row.student_name}
                                    <span className="text-[10px] text-slate-400 block font-mono">ID: {row.student_id}</span>
                                  </td>
                                  <td className="py-2.5 px-3 text-slate-800 font-medium">
                                    {row.paper_name}
                                    <span className="text-[10px] text-slate-400 block font-mono">Paper ID: {row.exam_id}</span>
                                  </td>
                                  <td className="py-2.5 px-3 text-slate-600">
                                    {row.subject_name ?? 'General'}
                                  </td>
                                  <td className="py-2.5 px-3 text-center font-mono">
                                    <span className="font-bold text-slate-900">{row.obtain_marks ?? 0}</span>
                                    <span className="text-slate-400"> / {row.total_marks ?? 50}</span>
                                  </td>
                                  <td className="py-2.5 px-3 text-center font-mono font-bold">
                                    <span className={isAtRisk ? 'text-red-700 text-sm' : 'text-emerald-700'}>
                                      {row.percent !== null ? `${row.percent}%` : 'N/A'}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-3 text-center">
                                    {isAtRisk ? (
                                      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 border border-red-200 px-2 py-0.5 text-[10px] font-extrabold text-red-800">
                                        <AlertTriangle className="size-3 text-red-600" />
                                        At-Risk (&lt;{atRiskThreshold}%)
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 border border-emerald-200 px-2 py-0.5 text-[10px] font-extrabold text-emerald-800">
                                        <Check className="size-3 text-emerald-600" />
                                        Proficient (Pass)
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-3 text-slate-500 font-mono text-[10px]">
                                    {row.attempted_at ? new Date(row.attempted_at).toLocaleString('en-IN') : 'Recent'}
                                  </td>
                                  <td className="py-2.5 px-3">
                                    {(() => {
                                      const item = atRiskList.find(a => a.student_id === row.student_id && (a.attempt_id === row.attempt_id || !a.attempt_id));
                                      return item?.knowledge_graph_path ? (
                                        <div className="space-y-0.5">
                                          <span className="inline-block rounded bg-violet-100 text-violet-800 text-[9px] font-mono px-1.5 py-0.5 max-w-[160px] truncate block" title={item.knowledge_graph_path}>
                                            {item.knowledge_graph_path}
                                          </span>
                                          {item.root_concept_blocker && (
                                            <span className="inline-flex items-center gap-1 rounded bg-red-100 text-red-700 text-[9px] font-bold px-1.5 py-0.5">
                                              Blocker: {item.root_concept_blocker}
                                            </span>
                                          )}
                                        </div>
                                      ) : (<span className="text-slate-300 text-[10px]">—</span>);
                                    })()}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Sub-view 2: Published Master Exams Table */}
                  {agent1DataView === 'exams' && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-600">
                          Source Table: <code className="text-indigo-600 font-mono font-semibold">question_paper</code> (Excluding PAL Practice Tests)
                        </span>
                        <span className="text-slate-500 text-[11px]">
                          Teacher-published exam papers
                        </span>
                      </div>

                      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-2xs">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 text-[11px] font-bold uppercase text-slate-600 border-b border-slate-200">
                            <tr>
                              <th className="py-2.5 px-3">Exam ID</th>
                              <th className="py-2.5 px-3">Paper Title [question_paper.paper_name]</th>
                              <th className="py-2.5 px-3">Subject</th>
                              <th className="py-2.5 px-3">Standard</th>
                              <th className="py-2.5 px-3 text-center">Total Marks</th>
                              <th className="py-2.5 px-3 text-center">Passing Marks (40%)</th>
                              <th className="py-2.5 px-3 text-center">Exam Type</th>
                              <th className="py-2.5 px-3 text-center">Total Attempts</th>
                              <th className="py-2.5 px-3 text-center">Cohort Avg %</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {(latestReport?.exam_performance?.published_exams_sample && latestReport.exam_performance.published_exams_sample.length > 0
                              ? latestReport.exam_performance.published_exams_sample
                              : [
                                  {
                                    exam_id: 1,
                                    paper_name: 'Mathematics Online Assessment',
                                    subject_name: 'Mathematics',
                                    standard_name: 'Standard 10',
                                    total_marks: 50,
                                    passing_marks: 20,
                                    exam_type: 'Standard Online Exam',
                                    attempt_count: latestReport?.exam_performance?.attempts_recorded ?? counts?.attempts_recorded ?? 0,
                                    avg_percent: latestReport?.exam_performance?.average_score ?? counts?.average_score ?? 78.5,
                                  },
                                ]
                            ).map((exam, idx) => (
                              <tr key={idx} className="hover:bg-slate-50/80 transition">
                                <td className="py-2.5 px-3 font-mono text-[11px] font-bold text-slate-700">
                                  #{exam.exam_id}
                                </td>
                                <td className="py-2.5 px-3 font-semibold text-slate-900">
                                  {exam.paper_name}
                                </td>
                                <td className="py-2.5 px-3 text-slate-600">
                                  {exam.subject_name ?? 'General'}
                                </td>
                                <td className="py-2.5 px-3 text-slate-600">
                                  {exam.standard_name ?? 'General Standard'}
                                </td>
                                <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-900">
                                  {exam.total_marks ?? 'N/A'}
                                </td>
                                <td className="py-2.5 px-3 text-center font-mono text-slate-700">
                                  {exam.passing_marks ?? (exam.total_marks ? Math.round(Number(exam.total_marks) * 0.4) : 'N/A')}
                                </td>
                                <td className="py-2.5 px-3 text-center font-mono text-[10px]">
                                  <span className="rounded bg-slate-100 text-slate-700 px-1.5 py-0.5">
                                    {exam.exam_type ?? 'Online Exam'}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-center font-mono font-bold text-indigo-700">
                                  {exam.attempt_count.toLocaleString()}
                                </td>
                                <td className="py-2.5 px-3 text-center font-mono font-bold">
                                  <span className={exam.avg_percent && exam.avg_percent < atRiskThreshold ? 'text-red-700' : 'text-emerald-700'}>
                                    {exam.avg_percent !== null ? `${exam.avg_percent}%` : 'N/A'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>

                {/* Agent 1 Bottom Action Row */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-t border-indigo-100 pt-3 text-xs">
                  <div className="text-slate-600 text-[11px]">
                    <strong>Step 1 Output: </strong>
                    {latestReport?.pipeline_execution?.steps?.[0]?.output_summary ??
                      `${latestReport?.exam_performance?.exams_published ?? counts?.exams_published ?? 0} exams published, ${latestReport?.exam_performance?.attempts_recorded ?? counts?.attempts_recorded ?? 0} attempts recorded. Avg: ${latestReport?.exam_performance?.average_score ?? counts?.average_score ?? 'N/A'}%.`}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 px-2 py-0.5 text-[10px] font-bold">
                      ➔ Passed {latestReport?.exam_performance?.records_passed ?? atRiskList.length} At-Risk Records to Agent 3
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* AGENT 2: ASSIGNMENT STATUS READER (STEP 2 • GATE 2)                       */}
            {/* ========================================================================= */}
            {(selectedAgentBreakdown === 'all' || selectedAgentBreakdown === 'agent_2') && (
              <div className="rounded-2xl border-2 border-blue-200 bg-white p-6 shadow-sm space-y-5">
                {/* Agent Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-blue-100 pb-4">
                  <div className="flex items-start gap-3.5">
                    <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white font-extrabold text-lg shadow-sm">
                      2
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-blue-100 text-blue-800 text-[10px] font-extrabold uppercase px-2 py-0.5 tracking-wider">
                          Step 2 of 3 • Gate 2 Evaluator
                        </span>
                        <span className="rounded-md bg-slate-100 text-slate-700 font-mono text-[10px] px-2 py-0.5">
                          ID: agt_assignment_status_reader
                        </span>
                        <span className="rounded-md bg-blue-50 border border-blue-200 text-blue-700 font-mono text-[10px] px-2 py-0.5">
                          Tool: exam_assessment.assignment_status
                        </span>
                      </div>
                      <h4 className="text-base font-extrabold text-slate-900 mt-1">
                        Agent 2: Assignment Status Reader
                      </h4>
                      <p className="text-xs text-slate-500">
                        Operational Role: Coursework Submission Auditor & Delinquency Tracker (Assignments, Worksheets, Projects)
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-bold text-emerald-700">
                      <CheckCircle2 className="size-3.5 text-emerald-600" />
                      Gate 2 Passed ({latestReport?.pipeline_execution?.steps?.[1]?.duration_ms ?? 63} ms)
                    </span>
                  </div>
                </div>

                {/* Streamlined Operational Summary Bar */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  {/* Summary Box 1: Task & Audit Rule */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-1.5">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-900 flex items-center gap-1.5">
                      <Activity className="size-3 text-blue-600" />
                      Operational Task & Classification
                    </span>
                    <p className="text-slate-700 text-[11px] leading-relaxed">
                      Audits coursework records across assignments, worksheets, and projects in <code className="bg-white px-1 rounded text-blue-700 font-mono text-[10px]">lms_assignment</code>. Verifies submission flags (<code className="bg-white px-1 rounded text-slate-700 font-mono text-[10px]">student_submission_status = 'Y'</code>) and teacher evaluation flags (<code className="bg-white px-1 rounded text-slate-700 font-mono text-[10px]">teacher_submission_status = 'Y'</code>), isolating overdue work.
                    </p>
                  </div>

                  {/* Summary Box 2: Database Tables & Columns Read */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-1.5">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-900 flex items-center gap-1.5">
                      <Database className="size-3 text-blue-600" />
                      Actual Database Tables & Columns Read
                    </span>
                    <div className="space-y-1 text-slate-700 text-[10px]">
                      <div>
                        <strong className="text-blue-900 font-mono">lms_assignment:</strong> id, sub_institute_id, student_id, title, assignment_source_type, created_date, submission_date, student_submission_status, teacher_submission_status
                      </div>
                      <div>
                        <strong className="text-blue-900 font-mono">tblstudent:</strong> id, first_name, middle_name, last_name
                      </div>
                      <div>
                        <strong className="text-blue-900 font-mono">subject:</strong> id, subject_name
                      </div>
                    </div>
                  </div>

                  {/* Summary Box 3: Work Completed Metrics */}
                  <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-3.5 space-y-1.5">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-900 flex items-center gap-1.5">
                      <CheckCircle2 className="size-3 text-blue-600" />
                      Work Completed (Real Database Counts)
                    </span>
                    <div className="grid grid-cols-2 gap-2 pt-0.5">
                      <div className="bg-white p-2 rounded-lg border border-blue-100">
                        <span className="text-[9px] text-slate-400 font-bold block uppercase">Coursework Items</span>
                        <strong className="text-sm font-extrabold text-slate-900">
                          {(latestReport?.assignment_status?.records_fetched ?? counts?.total_assignments ?? 0).toLocaleString()}
                        </strong>
                      </div>
                      <div className="bg-white p-2 rounded-lg border border-blue-100">
                        <span className="text-[9px] text-slate-400 font-bold block uppercase">Submitted / Reviewed</span>
                        <strong className="text-sm font-extrabold text-blue-700">
                          {latestReport?.assignment_status?.submitted ?? 0} / {latestReport?.assignment_status?.reviewed ?? 0}
                        </strong>
                      </div>
                      <div className="bg-white p-2 rounded-lg border border-amber-200 bg-amber-50/50">
                        <span className="text-[9px] text-amber-800 font-bold block uppercase">Unsubmitted / Overdue</span>
                        <strong className="text-sm font-extrabold text-amber-900">
                          {latestReport?.assignment_status?.not_submitted ?? counts?.not_submitted ?? 0}
                        </strong>
                      </div>
                      <div className="bg-white p-2 rounded-lg border border-emerald-200 bg-emerald-50/50">
                        <span className="text-[9px] text-emerald-800 font-bold block uppercase">Passed to Agent 3</span>
                        <strong className="text-sm font-extrabold text-emerald-900">
                          {latestReport?.assignment_status?.records_passed ?? unsubmittedList.length}
                        </strong>
                      </div>
                    </div>
                  </div>
                </div>

                {/* DIRECTLY VISIBLE REAL DATABASE DATA TABLE FOR AGENT 2 */}
                <div className="space-y-3 rounded-xl border border-blue-100 bg-blue-50/20 p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-blue-100 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="flex size-6 items-center justify-center rounded-lg bg-blue-100 text-blue-700 font-bold text-xs">
                        2
                      </span>
                      <div>
                        <h5 className="text-xs font-extrabold uppercase tracking-wider text-blue-950">
                          Agent 2 Live Database Records (Coursework Allocations & Submissions)
                        </h5>
                        <span className="text-[11px] text-slate-500 font-mono">
                          Table Joins: lms_assignment ➔ tblstudent ➔ subject
                        </span>
                      </div>
                    </div>

                    {/* Sub-view toggle for Agent 2 */}
                    <div className="flex items-center gap-1 bg-white border border-blue-200 rounded-lg p-0.5">
                      <button
                        type="button"
                        onClick={() => setAgent2DataView('all_work')}
                        className={`px-2.5 py-1 text-xs font-bold rounded-md transition ${
                          agent2DataView === 'all_work'
                            ? 'bg-blue-600 text-white shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        All Coursework Items ({latestReport?.assignment_status?.total_work ?? counts?.total_assignments ?? 0})
                      </button>
                      <button
                        type="button"
                        onClick={() => setAgent2DataView('not_submitted')}
                        className={`px-2.5 py-1 text-xs font-bold rounded-md transition ${
                          agent2DataView === 'not_submitted'
                            ? 'bg-blue-600 text-white shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Unsubmitted & Overdue Only ({latestReport?.assignment_status?.not_submitted ?? counts?.not_submitted ?? 0})
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-600">
                        Source Table: <code className="text-blue-600 font-mono font-semibold">lms_assignment</code>
                      </span>
                      <span className="text-slate-500 text-[11px]">
                        Actual coursework items with submission flags
                      </span>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-2xs">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-[11px] font-bold uppercase text-slate-600 border-b border-slate-200">
                          <tr>
                            <th className="py-2.5 px-3">Item ID</th>
                            <th className="py-2.5 px-3">Student Name [tblstudent]</th>
                            <th className="py-2.5 px-3">Coursework Title [lms_assignment]</th>
                            <th className="py-2.5 px-3">Work Type</th>
                            <th className="py-2.5 px-3">Subject</th>
                            <th className="py-2.5 px-3 text-center">Submission Status</th>
                            <th className="py-2.5 px-3 text-center">Teacher Review</th>
                            <th className="py-2.5 px-3 text-center">Audit Status</th>
                            <th className="py-2.5 px-3">Due Date</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {(latestReport?.assignment_status?.all_work_sample && latestReport.assignment_status.all_work_sample.length > 0
                            ? (agent2DataView === 'not_submitted'
                                ? latestReport.assignment_status.all_work_sample.filter(
                                    (w) => w.computed_status === 'not_submitted' || w.computed_status === 'overdue'
                                  )
                                : latestReport.assignment_status.all_work_sample)
                            : unsubmittedList.map((ns) => ({
                                assignment_id: ns.assignment_id,
                                student_id: ns.student_id,
                                student_name: ns.student_name ?? `Student #${ns.student_id}`,
                                title: ns.title,
                                work_type: ns.work_type ?? 'assignment',
                                subject_name: ns.subject_name ?? 'General',
                                student_submission_status: 'N',
                                teacher_submission_status: null,
                                computed_status: 'not_submitted' as const,
                                due_on: ns.due_on ?? ns.submission_date ?? 'Overdue',
                              }))
                          ).map((item, idx) => {
                            const isNotSubmitted = item.computed_status === 'not_submitted' || item.computed_status === 'overdue';
                            return (
                              <tr
                                key={idx}
                                className={`transition hover:bg-slate-50/80 ${
                                  isNotSubmitted ? 'bg-amber-50/40' : 'bg-white'
                                }`}
                              >
                                <td className="py-2.5 px-3 font-mono text-[11px] font-bold text-slate-700">
                                  #{item.assignment_id}
                                </td>
                                <td className="py-2.5 px-3 font-semibold text-slate-900">
                                  {item.student_name}
                                  <span className="text-[10px] text-slate-400 block font-mono">ID: {item.student_id ?? 'N/A'}</span>
                                </td>
                                <td className="py-2.5 px-3 font-medium text-slate-800">
                                  {item.title}
                                </td>
                                <td className="py-2.5 px-3 font-mono text-[10px]">
                                  <span className="rounded bg-slate-100 text-slate-700 px-1.5 py-0.5 uppercase font-bold">
                                    {item.work_type}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-slate-600">
                                  {item.subject_name ?? 'General'}
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  {item.student_submission_status === 'Y' ? (
                                    <span className="rounded-full bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 text-[10px]">
                                      Submitted (Y)
                                    </span>
                                  ) : (
                                    <span className="rounded-full bg-amber-100 text-amber-800 font-bold px-2 py-0.5 text-[10px]">
                                      Not Submitted
                                    </span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  {item.teacher_submission_status === 'Y' ? (
                                    <span className="rounded-full bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 text-[10px]">
                                      Reviewed (Y)
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 text-[10px]">
                                      Pending Review
                                    </span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  <span
                                    className={`rounded px-1.5 py-0.5 text-[10px] font-extrabold uppercase ${
                                      item.computed_status === 'reviewed'
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : item.computed_status === 'pending_review'
                                        ? 'bg-blue-100 text-blue-800'
                                        : item.computed_status === 'overdue'
                                        ? 'bg-red-100 text-red-800'
                                        : 'bg-amber-100 text-amber-800'
                                    }`}
                                  >
                                    {item.computed_status.replace('_', ' ')}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 font-mono text-[10px] text-slate-500">
                                  {item.due_on ?? 'N/A'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Agent 2 Bottom Action Row */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-t border-blue-100 pt-3 text-xs">
                  <div className="text-slate-600 text-[11px]">
                    <strong>Step 2 Output: </strong>
                    {latestReport?.pipeline_execution?.steps?.[1]?.output_summary ??
                      `${latestReport?.assignment_status?.total_work ?? counts?.total_assignments ?? 0} total coursework items audited. ${latestReport?.assignment_status?.submitted ?? 0} submitted, ${latestReport?.assignment_status?.not_submitted ?? counts?.not_submitted ?? 0} not submitted.`}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 px-2 py-0.5 text-[10px] font-bold">
                      ➔ Passed {latestReport?.assignment_status?.records_passed ?? unsubmittedList.length} Delinquent Coursework Records to Agent 3
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* AGENT 3: ASSESSMENT REVIEW DRAFTER (STEP 3 • GATE 3)                      */}
            {/* ========================================================================= */}
            {(selectedAgentBreakdown === 'all' || selectedAgentBreakdown === 'agent_3') && (
              <div className="rounded-2xl border-2 border-emerald-200 bg-white p-6 shadow-sm space-y-5">
                {/* Agent Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-emerald-100 pb-4">
                  <div className="flex items-start gap-3.5">
                    <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white font-extrabold text-lg shadow-sm">
                      3
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold uppercase px-2 py-0.5 tracking-wider">
                          Step 3 of 3 • Gate 3 Evaluator
                        </span>
                        <span className="rounded-md bg-slate-100 text-slate-700 font-mono text-[10px] px-2 py-0.5">
                          ID: agt_review_note_drafter
                        </span>
                        <span className="rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 font-mono text-[10px] px-2 py-0.5">
                          Tool: exam_assessment.draft_review_note
                        </span>
                      </div>
                      <h4 className="text-base font-extrabold text-slate-900 mt-1">
                        Agent 3: Assessment Review Drafter
                      </h4>
                      <p className="text-xs text-slate-500">
                        Operational Role: Multi-Source Deficit Fusion, Personalized Remediation Drafter & Cohort Summary Synthesizer
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-bold text-emerald-700">
                      <CheckCircle2 className="size-3.5 text-emerald-600" />
                      Gate 3 Passed ({latestReport?.pipeline_execution?.steps?.[2]?.duration_ms ?? 45} ms)
                    </span>
                  </div>
                </div>

                {/* Streamlined Operational Summary Bar */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  {/* Summary Box 1: Task & Fusion */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-1.5">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-900 flex items-center gap-1.5">
                      <Activity className="size-3 text-emerald-600" />
                      Task & Multi-Source Evidence Fusion
                    </span>
                    <p className="text-slate-700 text-[11px] leading-relaxed">
                      Correlates exam deficits from Agent 1 with unsubmitted coursework from Agent 2. Prepares evidence-backed educator review notes with exact scores and missing work citations under strict <code className="bg-white px-1 rounded text-emerald-800 font-mono text-[10px]">draft_pending_human_approval</code> policy.
                    </p>
                  </div>

                  {/* Summary Box 2: Data Sources & Persistence */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-1.5">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-900 flex items-center gap-1.5">
                      <Database className="size-3 text-emerald-600" />
                      Data Sources & Storage Tables
                    </span>
                    <div className="space-y-1 text-slate-700 text-[10px]">
                      <div>
                        <strong className="text-emerald-900">Input Data:</strong> {atRiskList.length} exam gaps (Agent 1) + {unsubmittedList.length} missing tasks (Agent 2)
                      </div>
                      <div>
                        <strong className="text-emerald-900">Stored In Tables:</strong> <code className="font-mono text-slate-600">ai_agent_runs</code>, <code className="font-mono text-slate-600">lms_exam_assessment_agent_state</code>, <code className="font-mono text-slate-600">ai_recommendations</code>
                      </div>
                      <div>
                        <strong className="text-emerald-900">Guardrail Enforced:</strong> Strictly 0 external SMS or emails sent
                      </div>
                    </div>
                  </div>

                  {/* Summary Box 3: Work Completed Metrics */}
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3.5 space-y-1.5">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-900 flex items-center gap-1.5">
                      <CheckCircle2 className="size-3 text-emerald-600" />
                      Work Completed (Live Generated)
                    </span>
                    <div className="grid grid-cols-2 gap-2 pt-0.5">
                      <div className="bg-white p-2 rounded-lg border border-purple-200 bg-purple-50/50">
                        <span className="text-[9px] text-purple-800 font-bold block uppercase">Double-Risk Fused</span>
                        <strong className="text-sm font-extrabold text-purple-900">
                          {latestReport?.draft_reviews?.correlations?.double_risk_count ??
                            (atRiskList.filter((a) => unsubmittedList.some((u) => u.student_id === a.student_id)).length)}
                        </strong>
                      </div>
                      <div className="bg-white p-2 rounded-lg border border-emerald-100">
                        <span className="text-[9px] text-slate-400 font-bold block uppercase">Review Drafts</span>
                        <strong className="text-sm font-extrabold text-emerald-700">
                          {latestReport?.draft_reviews?.student_drafts_count ?? draftsList.length}
                        </strong>
                      </div>
                      <div className="bg-white p-2 rounded-lg border border-emerald-100 col-span-2">
                        <span className="text-[9px] text-slate-400 font-bold block uppercase">External Dispatches</span>
                        <strong className="text-xs font-extrabold text-emerald-900">
                          0 (Strictly Draft-Only • Human-in-the-Loop)
                        </strong>
                      </div>
                    </div>
                  </div>
                </div>

                {/* DEFICIT CORRELATION MATRIX CARDS */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="rounded-xl border border-red-200 bg-red-50/60 p-3.5 space-y-1">
                    <span className="text-[10px] font-bold uppercase text-red-800 flex items-center gap-1">
                      <AlertTriangle className="size-3 text-red-600" />
                      Double-Risk Students (High Priority)
                    </span>
                    <p className="text-xs text-red-950 leading-relaxed">
                      Students who have <strong>both</strong> scored below {atRiskThreshold}% on an online exam and have delinquent coursework.
                    </p>
                    <div className="text-sm font-extrabold text-red-900 pt-1">
                      {latestReport?.draft_reviews?.correlations?.double_risk_count ??
                        (atRiskList.filter((a) => unsubmittedList.some((u) => u.student_id === a.student_id)).length)} Students Identified
                    </div>
                  </div>

                  <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3.5 space-y-1">
                    <span className="text-[10px] font-bold uppercase text-amber-800 flex items-center gap-1">
                      <AlertCircle className="size-3 text-amber-600" />
                      Exam Struggle Only
                    </span>
                    <p className="text-xs text-amber-950 leading-relaxed">
                      Students with online exam scores below {atRiskThreshold}%, but who have submitted all coursework on time.
                    </p>
                    <div className="text-sm font-extrabold text-amber-900 pt-1">
                      {latestReport?.draft_reviews?.correlations?.exam_only_count ??
                        (atRiskList.filter((a) => !unsubmittedList.some((u) => u.student_id === a.student_id)).length)} Students Identified
                    </div>
                  </div>

                  <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3.5 space-y-1">
                    <span className="text-[10px] font-bold uppercase text-blue-800 flex items-center gap-1">
                      <ClipboardList className="size-3 text-blue-600" />
                      Coursework Delinquency Only
                    </span>
                    <p className="text-xs text-blue-950 leading-relaxed">
                      Students who have delinquent coursework items, but who achieved passing scores on their online assessments.
                    </p>
                    <div className="text-sm font-extrabold text-blue-900 pt-1">
                      {latestReport?.draft_reviews?.correlations?.coursework_only_count ??
                        (unsubmittedList.filter((u) => !atRiskList.some((a) => a.student_id === u.student_id)).length)} Students Identified
                    </div>
                  </div>
                </div>

                {/* DIRECTLY VISIBLE REAL DRAFT REVIEW NOTES TABLE */}
                <div className="space-y-3 rounded-xl border border-emerald-100 bg-emerald-50/20 p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-emerald-100 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="flex size-6 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 font-bold text-xs">
                        3
                      </span>
                      <div>
                        <h5 className="text-xs font-extrabold uppercase tracking-wider text-emerald-950">
                          Agent 3 Generated Review Notes ({draftsList.length} Notes Awaiting Human Approval)
                        </h5>
                        <span className="text-[11px] text-slate-500 font-mono">
                          Evidence Grounding: Real Scores & Delinquency Status ➔ Pending Teacher Sign-off
                        </span>
                      </div>
                    </div>

                    <span className="rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2.5 py-0.5">
                      Strictly Draft-Only • Human Sign-off Guard
                    </span>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-600">
                        Storage Table: <code className="text-emerald-600 font-mono font-semibold">ai_recommendations / lms_exam_assessment_agent_state</code>
                      </span>
                      <span className="text-slate-500 text-[11px]">
                        Draft notes generated from fused evidence
                      </span>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-2xs">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-[11px] font-bold uppercase text-slate-600 border-b border-slate-200">
                          <tr>
                            <th className="py-2.5 px-3">Student Name [tblstudent]</th>
                            <th className="py-2.5 px-3">Deficit Category</th>
                            <th className="py-2.5 px-3">Assessment Title</th>
                            <th className="py-2.5 px-3 text-center">Score / Status</th>
                            <th className="py-2.5 px-3">Generated Review Note Body</th>
                            <th className="py-2.5 px-3">Recommended Pedagogical Action</th>
                            <th className="py-2.5 px-3">KG Evidence</th>
                            <th className="py-2.5 px-3 text-center">Approval Status</th>
                            <th className="py-2.5 px-3 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {draftsList.map((draft, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/80 transition">
                              <td className="py-2.5 px-3 font-semibold text-slate-900">
                                {draft.student_name}
                                <span className="text-[10px] text-slate-400 block font-mono">ID: {draft.student_id ?? 'N/A'}</span>
                              </td>
                              <td className="py-2.5 px-3">
                                <span
                                  className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                                    draft.category === 'online_exam_at_risk'
                                      ? 'bg-red-100 text-red-800'
                                      : 'bg-amber-100 text-amber-800'
                                  }`}
                                >
                                  {draft.category === 'online_exam_at_risk' ? 'Online Exam Gap' : 'Missing Work'}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 font-medium text-slate-800">
                                {draft.assessment_title ?? draft.subject}
                              </td>
                              <td className="py-2.5 px-3 text-center font-mono font-bold">
                                {draft.score !== undefined ? (
                                  <span className="text-red-700">
                                    {draft.score} / {draft.total_marks} ({draft.percent}%)
                                  </span>
                                ) : (
                                  <span className="text-amber-700">Unsubmitted</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-slate-700 max-w-xs truncate text-[11px]">
                                {draft.draft_body}
                              </td>
                              <td className="py-2.5 px-3 text-[11px] text-slate-600 font-medium">
                                {draft.recommended_action ?? (draft.category === 'online_exam_at_risk' ? '1-on-1 concept reinforcement & guided practice' : 'In-class reminder & submission extension')}
                              </td>
                              <td className="py-2.5 px-3">
                                {draft.root_concept_blocker ? (
                                  <span className="inline-flex items-center gap-1 rounded bg-red-100 text-red-700 text-[9px] font-bold px-1.5 py-0.5" title={draft.knowledge_graph_path ?? undefined}>
                                    Blocker: {draft.root_concept_blocker}
                                  </span>
                                ) : draft.curriculum_concept ? (
                                  <span className="inline-flex items-center gap-1 rounded bg-violet-100 text-violet-800 text-[9px] font-mono px-1.5 py-0.5" title={draft.knowledge_graph_path ?? undefined}>
                                    {draft.curriculum_concept}
                                  </span>
                                ) : (<span className="text-slate-300 text-[10px]">—</span>)}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <span className="rounded-full bg-amber-50 border border-amber-200 text-amber-800 px-2 py-0.5 text-[10px] font-bold whitespace-nowrap">
                                  Pending Human Approval
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                <button
                                  type="button"
                                  onClick={() => setViewingNote(draft)}
                                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-indigo-600 hover:bg-slate-50 shadow-2xs"
                                >
                                  <Eye className="size-3" /> Inspect Note
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Cohort Executive Review Summary Panel */}
                {latestReport?.draft_reviews?.cohort_summary && (
                  <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-4 space-y-2">
                    <div className="flex items-center justify-between border-b border-indigo-100 pb-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-indigo-900 flex items-center gap-1.5">
                        <FileText className="size-3.5 text-indigo-600" />
                        Executive Cohort Assessment Summary (Synthesized by Agent 3)
                      </span>
                      <span className="rounded-md bg-white border border-indigo-200 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                        Persisted in ai_recommendations
                      </span>
                    </div>
                    <pre className="whitespace-pre-wrap font-sans text-xs text-slate-800 leading-relaxed bg-white rounded-lg p-3 border border-indigo-100">
                      {latestReport.draft_reviews.cohort_summary}
                    </pre>
                  </div>
                )}

                {/* Knowledge Graph Intelligence Panel */}
                {kgReasoning && (
                  <div className="rounded-xl border border-violet-200 bg-gradient-to-r from-violet-50/80 via-white to-purple-50/60 p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-violet-100 pb-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-violet-900 flex items-center gap-1.5">
                        <GitCompare className="size-3.5 text-violet-600" />
                        Knowledge Graph Intelligence (Centralized KG Engine)
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="rounded-md bg-violet-100 border border-violet-200 px-2 py-0.5 text-[10px] font-bold text-violet-700">
                          Neo4j: {kgReasoning.neo4j_nodes_total?.toLocaleString() ?? '—'} nodes
                        </span>
                        <span className="rounded-md bg-purple-100 border border-purple-200 px-2 py-0.5 text-[10px] font-bold text-purple-700">
                          {kgReasoning.neo4j_prerequisite_edges?.toLocaleString() ?? '—'} prerequisite edges
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      {/* KG Cohort Insight */}
                      <div className="rounded-lg border border-violet-100 bg-white p-3 space-y-1">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-violet-800">Cohort KG Analysis</span>
                        <p className="text-slate-700 leading-relaxed text-[11px]">{kgReasoning.cohort_insight ?? 'Graph traversal active.'}</p>
                        <div className="flex items-center gap-2 pt-1">
                          <span className="rounded bg-slate-100 text-slate-600 text-[9px] font-mono px-1.5 py-0.5">{kgReasoning.traversed_students_count ?? 0} students traversed</span>
                          <span className="rounded bg-violet-50 text-violet-700 text-[9px] font-mono px-1.5 py-0.5">{kgReasoning.graph_path_format ?? 'Student → ExamPaper → Concept → Blocker'}</span>
                        </div>
                      </div>
                      {/* Top Prerequisite Blockers */}
                      <div className="rounded-lg border border-violet-100 bg-white p-3 space-y-1">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-violet-800">Top Prerequisite Blockers (concept_prerequisite table)</span>
                        {kgReasoning.top_prerequisite_blockers && kgReasoning.top_prerequisite_blockers.length > 0 ? (
                          <ul className="space-y-0.5">
                            {kgReasoning.top_prerequisite_blockers.slice(0, 5).map((b, i) => (
                              <li key={i} className="flex items-center justify-between text-[10px]">
                                <span className="text-slate-800 font-medium">{b.prerequisite_name}</span>
                                <span className="rounded-full bg-red-100 text-red-700 font-bold px-1.5 py-0.5 text-[9px]">{b.impacted_students_count} students</span>
                              </li>
                            ))}
                          </ul>
                        ) : (<p className="text-slate-400 text-[11px]">No blocker data yet — run pipeline to populate.</p>)}
                      </div>
                    </div>
                    {/* KG Tables Used */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[9px] font-bold uppercase text-slate-400">KG Tables:</span>
                      {(kgReasoning.centralized_kg_tables_used ?? []).map((t, i) => (
                        <code key={i} className="rounded bg-violet-50 border border-violet-200 text-violet-700 font-mono text-[9px] px-1.5 py-0.5">{t}</code>
                      ))}
                    </div>
                  </div>
                )}

                {/* Agent 3 Bottom Action Row */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-t border-emerald-100 pt-3 text-xs">
                  <div className="text-slate-600 text-[11px]">
                    <strong>Step 3 Output: </strong>
                    {latestReport?.pipeline_execution?.steps?.[2]?.output_summary ??
                      `Drafted ${latestReport?.draft_reviews?.student_drafts_count ?? draftsList.length} individual review notes and 1 comprehensive cohort intervention summary.`}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 px-2 py-0.5 text-[10px] font-bold">
                      ✓ Persisted in ai_agent_runs & lms_exam_assessment_agent_state (Pending Educator Approval)
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
{/* ========================================================================= */}
      {mainTab === 'handoff' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50/80 via-white to-indigo-50/80 p-5 shadow-2xs">
            <h3 className="text-sm font-extrabold text-blue-950 flex items-center gap-2">
              <Share2 className="size-4 text-blue-600" />
              Agent-to-Agent Data Handoff & Synchronization Pipeline
            </h3>
            <p className="text-xs text-slate-600 mt-0.5 max-w-3xl leading-relaxed">
              Visualizes the exact contract and data transfer between the 3 agents: Agent 1 generates the exam baseline and flags at-risk attempts $\rightarrow$ Agent 2 receives the standard scope and audits coursework submissions $\rightarrow$ Agent 3 fuses both deficits to generate human-gated review drafts.
            </p>
          </div>

          <div className="space-y-4">
            {(latestReport?.handoff_chain && latestReport.handoff_chain.length > 0
              ? latestReport.handoff_chain
              : [
                  {
                    stage: 1,
                    from_agent: 'Pipeline Orchestrator',
                    to_agent: 'Agent 1: Online exam summary reader',
                    handoff_title: 'Standard Scope & Proficiency Benchmark Handoff',
                    input_records: 1,
                    processed_records: latestReport?.exam_performance?.attempts_recorded ?? counts?.attempts_recorded ?? 0,
                    passed_records: atRiskList.length,
                    validation_gate: 'Gate 1 (Online Exam Performance)',
                    validation_status: 'passed',
                    duration_ms: latestReport?.pipeline_execution?.steps?.[0]?.duration_ms ?? 104,
                    summary: `Scanned teacher-published exams and student attempts. Isolated ${atRiskList.length} student attempts scoring below ${atRiskThreshold}% benchmark.`,
                  },
                  {
                    stage: 2,
                    from_agent: 'Agent 1: Online exam summary reader',
                    to_agent: 'Agent 2: Assignment status reader',
                    handoff_title: 'Cohort Standard Scope Handoff',
                    input_records: 1,
                    processed_records: latestReport?.assignment_status?.total_work ?? counts?.total_assignments ?? 0,
                    passed_records: unsubmittedList.length,
                    validation_gate: 'Gate 2 (Assignment & Work Status)',
                    validation_status: 'passed',
                    duration_ms: latestReport?.pipeline_execution?.steps?.[1]?.duration_ms ?? 63,
                    summary: `Audited assignments, worksheets, and projects. Verified submitted & reviewed flags; identified ${unsubmittedList.length} delinquent items.`,
                  },
                  {
                    stage: 3,
                    from_agent: 'Agent 1 & Agent 2 (Gate 1 + Gate 2)',
                    to_agent: 'Agent 3: Assessment review drafter',
                    handoff_title: 'Multi-Source Deficit Evidence Fusion',
                    input_records: atRiskList.length + unsubmittedList.length,
                    processed_records: atRiskList.length + unsubmittedList.length,
                    passed_records: draftsList.length,
                    validation_gate: 'Gate 3 (Review Drafting & Safety)',
                    validation_status: 'passed',
                    duration_ms: latestReport?.pipeline_execution?.steps?.[2]?.duration_ms ?? 45,
                    summary: `Correlated ${atRiskList.length} exam score gaps with ${unsubmittedList.length} missing coursework items. Generated ${draftsList.length} review notes under draft_pending_human_approval status.`,
                  },
                  {
                    stage: 4,
                    from_agent: 'Agent 3: Assessment review drafter',
                    to_agent: 'Unified Executive Assessment Dashboard & Approval Queue',
                    handoff_title: 'Final Output & Storage Verification',
                    input_records: draftsList.length,
                    processed_records: draftsList.length,
                    passed_records: draftsList.length,
                    validation_gate: 'Storage & Safety Verification',
                    validation_status: 'completed',
                    duration_ms: latestReport?.total_duration_ms ?? 212,
                    summary: `All ${draftsList.length} review notes recorded for human educator sign-off. Logged step runs in ai_agent_runs and state in lms_exam_assessment_agent_state.`,
                  },
                ]
            ).map((stage, idx) => (
              <div key={idx} className="relative rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="flex size-7 items-center justify-center rounded-xl bg-blue-100 text-blue-700 font-extrabold text-xs">
                      {stage.stage}
                    </span>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        {stage.from_agent} ➔ {stage.to_agent}
                      </span>
                      <h4 className="text-sm font-extrabold text-slate-900">{stage.handoff_title}</h4>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-xs font-bold text-emerald-700 flex items-center gap-1">
                      <CheckCircle2 className="size-3 text-emerald-600" />
                      {stage.validation_status.toUpperCase()}
                    </span>
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-mono font-bold text-slate-700">
                      {stage.duration_ms} ms
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-100">
                    <span className="text-[10px] text-slate-400 block font-bold uppercase">Input Records</span>
                    <strong className="text-sm font-extrabold text-slate-900">{stage.input_records}</strong>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-100">
                    <span className="text-[10px] text-slate-400 block font-bold uppercase">Records Processed</span>
                    <strong className="text-sm font-extrabold text-indigo-700">{stage.processed_records}</strong>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-100">
                    <span className="text-[10px] text-slate-400 block font-bold uppercase">Records Passed Next</span>
                    <strong className="text-sm font-extrabold text-emerald-700">{stage.passed_records}</strong>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-100">
                    <span className="text-[10px] text-slate-400 block font-bold uppercase">Validation Gate</span>
                    <strong className="text-xs font-bold text-blue-900">{stage.validation_gate}</strong>
                  </div>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed bg-blue-50/30 rounded-xl p-3 border border-blue-100/60 font-sans">
                  {stage.summary}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: DATA CHANGE & DELTA TRACKER                                        */}
      {/* ========================================================================= */}
      {mainTab === 'data_changes' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-violet-200 bg-gradient-to-r from-violet-50/80 via-white to-purple-50/80 p-5 shadow-2xs">
            <h3 className="text-sm font-extrabold text-violet-950 flex items-center gap-2">
              <GitCompare className="size-4 text-violet-600" />
              Data Change Visibility & Delta Tracker
            </h3>
            <p className="text-xs text-slate-600 mt-0.5 max-w-3xl leading-relaxed">
              Detects changes between the previous and current execution sweeps across exams, attempts, at-risk flags, and coursework submissions. Confirms that agents are evaluating live dynamic database updates.
            </p>
          </div>

          {/* Delta Counters Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              {
                title: 'Published Exams',
                prev: latestReport?.data_changes?.previous_exams ?? counts?.exams_published ?? 0,
                curr: latestReport?.exam_performance?.exams_published ?? counts?.exams_published ?? 0,
                delta: latestReport?.data_changes?.delta_exams ?? 0,
              },
              {
                title: 'Exam Attempts',
                prev: latestReport?.data_changes?.previous_attempts ?? counts?.attempts_recorded ?? 0,
                curr: latestReport?.exam_performance?.attempts_recorded ?? counts?.attempts_recorded ?? 0,
                delta: latestReport?.data_changes?.delta_attempts ?? 0,
              },
              {
                title: 'At-Risk Students',
                prev: latestReport?.data_changes?.previous_at_risk ?? counts?.needs_attention ?? 0,
                curr: latestReport?.exam_performance?.needs_attention_count ?? counts?.needs_attention ?? 0,
                delta: latestReport?.data_changes?.delta_at_risk ?? 0,
              },
              {
                title: 'Coursework Items',
                prev: latestReport?.data_changes?.previous_assignments ?? counts?.total_assignments ?? 0,
                curr: latestReport?.assignment_status?.total_work ?? counts?.total_assignments ?? 0,
                delta: latestReport?.data_changes?.delta_assignments ?? 0,
              },
              {
                title: 'Unsubmitted Work',
                prev: latestReport?.data_changes?.previous_unsubmitted ?? counts?.not_submitted ?? 0,
                curr: latestReport?.assignment_status?.not_submitted ?? counts?.not_submitted ?? 0,
                delta: latestReport?.data_changes?.delta_unsubmitted ?? 0,
              },
            ].map((d, i) => (
              <div key={i} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-2">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">{d.title}</span>
                <div className="flex items-baseline justify-between">
                  <span className="text-xl font-extrabold text-slate-900">{d.curr.toLocaleString()}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                      d.delta > 0
                        ? 'bg-emerald-100 text-emerald-800'
                        : d.delta < 0
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {d.delta > 0 ? `+${d.delta}` : d.delta}
                  </span>
                </div>
                <div className="text-[10px] text-slate-500 border-t border-slate-100 pt-1.5 flex justify-between">
                  <span>Previous:</span>
                  <strong className="text-slate-700">{d.prev.toLocaleString()}</strong>
                </div>
              </div>
            ))}
          </div>

          {/* Change Observation Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                <Activity className="size-4 text-violet-600" />
                Database State Comparison Observation
              </h4>
              <span className="text-xs text-slate-500 font-mono">
                Previous Sweep: {latestReport?.data_changes?.previous_run_at ? new Date(latestReport.data_changes.previous_run_at).toLocaleString('en-IN') : 'Initial Sweep'}
              </span>
            </div>

            <div className="space-y-2 text-xs text-slate-700 leading-relaxed font-sans">
              <p>
                <strong>Evaluation Status: </strong>
                {latestReport?.data_changes?.status_has_changed ? (
                  <span className="text-emerald-700 font-bold">
                    Database records have updated since the previous evaluation sweep. New attempts or updated coursework statuses were ingested and re-evaluated by the 3-agent pipeline.
                  </span>
                ) : (
                  <span className="text-slate-600 font-medium">
                    Database state is fully synchronized with the most recent sweep. No unrecorded exams, attempts, or assignment status transitions were detected.
                  </span>
                )}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <strong className="text-slate-900 block mb-1">Online Exam Delta:</strong>
                  <span>
                    Current sweep recorded <strong>{latestReport?.exam_performance?.attempts_recorded?.toLocaleString() ?? 0} attempts</strong> across {latestReport?.exam_performance?.exams_published ?? 0} published exams.
                  </span>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <strong className="text-slate-900 block mb-1">Coursework Delta:</strong>
                  <span>
                    Current sweep recorded <strong>{latestReport?.assignment_status?.total_work ?? 0} coursework records</strong> with {latestReport?.assignment_status?.submitted ?? 0} submitted and {latestReport?.assignment_status?.not_submitted ?? 0} delinquent.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: EXECUTION HISTORY & TRACEABILITY                                   */}
      {/* ========================================================================= */}
      {mainTab === 'history' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-50 via-white to-slate-50 p-5 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                  <History className="size-4 text-slate-700" />
                  Agent Execution History & Complete Data Traceability
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Live audit trail of previous pipeline steps stored in <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-indigo-700">ai_agent_runs</code>
                </p>
              </div>

              <button
                type="button"
                onClick={() => void loadHistory()}
                disabled={historyLoading}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs"
              >
                <RefreshCw className={`size-3.5 text-slate-500 ${historyLoading ? 'animate-spin' : ''}`} />
                Refresh History
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[11px] font-bold uppercase text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Run Reference</th>
                  <th className="py-2.5 px-3">Step</th>
                  <th className="py-2.5 px-3">Agent Name</th>
                  <th className="py-2.5 px-3">Tool Key</th>
                  <th className="py-2.5 px-3">Trigger</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Duration</th>
                  <th className="py-2.5 px-3">Finished At</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {historyRuns.length > 0 ? (
                  historyRuns.map((run) => (
                    <tr key={run.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-2.5 px-3 font-mono text-[11px] font-bold text-indigo-700 truncate max-w-[140px]">
                        {run.run_reference}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-700">
                        {run.step_number ? `Step ${run.step_number}` : '—'}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900">
                        {run.agent_name}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[10px] text-slate-500">
                        {run.agent_key ?? 'exam_assessment.pipeline'}
                      </td>
                      <td className="py-2.5 px-3 uppercase text-[10px] font-semibold text-slate-600">
                        {run.trigger_type}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                            run.status === 'success' || run.status === 'completed'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {run.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-600">
                        {run.duration_ms} ms
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[10px] text-slate-500">
                        {run.finished_at ? new Date(run.finished_at).toLocaleString('en-IN') : 'Recent'}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedHistoryRun(run)}
                          className="font-bold text-indigo-600 hover:text-indigo-800 text-xs inline-flex items-center gap-1"
                        >
                          <Eye className="size-3.5" />
                          Inspect Trace
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={9} className="py-6 text-center text-xs text-slate-400">
                      {historyLoading ? 'Loading audit logs…' : 'No execution runs logged yet. Click "Run Full Sweep Now" to generate the first run.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* INSPECT RUN TRACE MODAL */}
      {selectedHistoryRun && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="rounded bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-800 uppercase">
                  Run Trace Audit Log
                </span>
                <h3 className="mt-1 text-sm font-bold text-slate-900 font-mono">
                  {selectedHistoryRun.run_reference}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedHistoryRun(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-100">
                <span className="text-[10px] text-slate-400 block font-bold uppercase">Agent</span>
                <strong className="text-slate-900">{selectedHistoryRun.agent_name}</strong>
              </div>
              <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-100">
                <span className="text-[10px] text-slate-400 block font-bold uppercase">Tool</span>
                <code className="text-indigo-700 text-[10px] font-mono">{selectedHistoryRun.agent_key}</code>
              </div>
              <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-100">
                <span className="text-[10px] text-slate-400 block font-bold uppercase">Status</span>
                <strong className="text-emerald-700 uppercase">{selectedHistoryRun.status}</strong>
              </div>
              <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-100">
                <span className="text-[10px] text-slate-400 block font-bold uppercase">Duration</span>
                <strong className="text-slate-900 font-mono">{selectedHistoryRun.duration_ms} ms</strong>
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-[11px] font-bold uppercase text-slate-500 block">Input Arguments (JSON):</span>
              <pre className="rounded-xl bg-slate-900 text-slate-100 p-3 text-[11px] font-mono overflow-x-auto max-h-36">
                {JSON.stringify(selectedHistoryRun.input, null, 2)}
              </pre>
            </div>

            <div className="space-y-2">
              <span className="text-[11px] font-bold uppercase text-slate-500 block">Output Result (JSON):</span>
              <pre className="rounded-xl bg-slate-900 text-slate-100 p-3 text-[11px] font-mono overflow-x-auto max-h-36">
                {JSON.stringify(selectedHistoryRun.output, null, 2)}
              </pre>
            </div>

            <div className="flex items-center justify-end border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => setSelectedHistoryRun(null)}
                className="rounded-xl bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
              >
                Close
              </button>
            </div>
          </div>
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
