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
  Check,
  CheckCheck,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Clock,
  CreditCard,
  Database,
  DollarSign,
  Eye,
  FileCheck,
  FileText,
  Filter,
  Info,
  Layers,
  Lock,
  MessageSquare,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Square,
  Users,
  Workflow,
  X,
  XCircle,
  Zap,
} from 'lucide-react';

import { readModuleWorkspaceSession } from '@/lib/module-ai/module-ai-stack';
import {
  getFeesAgentState,
  startFeesAgentMonitoring,
  stopFeesAgentMonitoring,
  runFeesPipeline,
  setFeesAgentInterval,
  getFeesEso,
  fetchFeesStandards,
  fetchFeesDefaulterStudents,
  sendApprovedFeesReminders,
  type FeesAgentState,
  type FeesAvailableYear,
  type FeesPipelineReport,
  type FeesEso,
  type FeesEsoAgent,
  type FeesCandidate,
  type FeesStandard,
  type FeesDefaulterStudent,
  type FeesSendResult,
  type FeesPipelineStep,
  type FeesGate,
  type FeesRecentRun,
  type FeesPipelineError,
} from '@/lib/fees/fees-agent-client';
import {
  FeesFinalResultsSection,
  FeesHandoffFlowSection,
  FeesPipelineSequenceBanner,
  StatusPill,
  toAgentStatusLabel,
  formatRupeesReal,
} from '@/app/_components/ai-stack/fees-pipeline-sections';

interface FeesAgentControlCardProps {
  onValidated?: (report: FeesPipelineReport) => void;
  onRan?: () => void;
}

/**
 * Modern 4-Pillar Executive Skill Object (ESO) Viewer Card
 * Renders strictly live ESO specification returned by `/api/ai/fees/agent/eso`.
 */
function AgentEsoCard({
  agentDetail,
}: {
  agentKey?: 'agent_1' | 'agent_2' | 'agent_3';
  agentDetail?: any;
}) {
  const [activeTab, setActiveTab] = useState<'ek' | 'ea' | 'er' | 'eq' | 'legacy'>('ek');

  if (!agentDetail) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-xs text-slate-500">
        Loading live Executive Skill Object (ESO) specification from backend registry…
      </div>
    );
  }

  const ek = agentDetail.ek;
  const ea = agentDetail.ea;
  const er = agentDetail.er;
  const eq = agentDetail.eq;
  const eso = agentDetail.eso;

  return (
    <div className="space-y-3.5 rounded-xl border border-slate-200 bg-slate-50/70 p-4 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-xs">
            <Sparkles className="size-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
              Executive Skill Object (ESO) Architecture
            </h4>
            <p className="text-[10px] text-slate-500 font-medium">
              Production Standard: EK (Knowledge) · EA (Abilities) · ER (Responsibilities) · EQ (Quality)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 rounded-lg bg-white p-0.5 border border-slate-200 shadow-2xs">
          <button
            type="button"
            onClick={() => setActiveTab('ek')}
            className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all ${activeTab === 'ek'
              ? 'bg-blue-600 text-white shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
          >
            EK · Knowledge
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('ea')}
            className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all ${activeTab === 'ea'
              ? 'bg-emerald-600 text-white shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
          >
            EA · Abilities
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('er')}
            className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all ${activeTab === 'er'
              ? 'bg-purple-600 text-white shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
          >
            ER · Responsibilities
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('eq')}
            className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all ${activeTab === 'eq'
              ? 'bg-amber-600 text-white shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
          >
            EQ · Quality
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('legacy')}
            className={`px-2 py-1 text-[10px] font-medium rounded-md transition-all ${activeTab === 'legacy' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-700'
              }`}
            title="View Classic Activities & Flow View"
          >
            Classic Flow
          </button>
        </div>
      </div>

      {/* TAB 1: EK - EXECUTIVE KNOWLEDGE */}
      {activeTab === 'ek' && ek && (
        <div className="space-y-3 rounded-xl border border-blue-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between border-b border-blue-100 pb-2.5">
            <div className="flex items-center gap-2">
              <div className="flex size-6 items-center justify-center rounded-md bg-blue-100 text-blue-800">
                <BookOpen className="size-3.5 text-blue-700" />
              </div>
              <div>
                <span className="text-xs font-bold text-blue-950 block">EK – Executive Knowledge Base</span>
                <span className="text-[10px] text-blue-600 font-medium">Relational Schemas, Live Tenant Data & Academic Fee Ledgers</span>
              </div>
            </div>
            <span className="rounded-full bg-blue-50 border border-blue-200 text-blue-700 px-2 py-0.5 text-[10px] font-bold">
              Dynamic Live Grounding
            </span>
          </div>

          <p className="text-xs text-slate-700 leading-relaxed font-normal bg-blue-50/40 p-2.5 rounded-lg border border-blue-100/60">
            {ek.summary}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
            <div className="space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                Database Schemas & Relational Graph:
              </span>
              <ul className="space-y-1.5 text-[11px] text-slate-700">
                {ek.schemas_and_relationships?.map((rel: string, idx: number) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="text-blue-500 font-bold">•</span>
                    <span className="leading-snug">{rel}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-2.5">
              {ek.live_metrics && (
                <div className="rounded-lg border border-blue-100 bg-blue-50/30 p-2.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-900 block mb-1.5">
                    Live Verified Tenant Metrics:
                  </span>
                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    {Object.entries(ek.live_metrics).map(([key, val]) => (
                      <div key={key} className="flex items-center justify-between border-b border-blue-100/50 pb-1">
                        <span className="text-slate-600 capitalize">{key.replace(/_/g, ' ')}:</span>
                        <span className="font-mono font-bold text-blue-900">
                          {typeof val === 'number'
                            ? (key.includes('demand') || key.includes('collected') || key.includes('outstanding')
                              ? `₹${val.toLocaleString('en-IN')}`
                              : String(val))
                            : String(val)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {ek.tables_and_sources && ek.tables_and_sources.length > 0 && (
            <div className="pt-2 border-t border-slate-100 flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-bold uppercase text-slate-400">Grounded DB Tables:</span>
              {ek.tables_and_sources.map((tbl: string) => (
                <span key={tbl} className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-slate-700">
                  {tbl}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: EA - EXECUTIVE ABILITIES */}
      {activeTab === 'ea' && ea && (
        <div className="space-y-3 rounded-xl border border-emerald-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between border-b border-emerald-100 pb-2.5">
            <div className="flex items-center gap-2">
              <div className="flex size-6 items-center justify-center rounded-md bg-emerald-100 text-emerald-800">
                <ShieldCheck className="size-3.5 text-emerald-700" />
              </div>
              <div>
                <span className="text-xs font-bold text-emerald-950 block">EA – Executive Abilities & Skills</span>
                <span className="text-[10px] text-emerald-600 font-medium">Executable Backend Capabilities & Dynamic Registry Status</span>
              </div>
            </div>
            <span className="rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 px-2 py-0.5 text-[10px] font-bold">
              Executable Capabilities
            </span>
          </div>

          <p className="text-xs text-slate-700 leading-relaxed font-normal bg-emerald-50/40 p-2.5 rounded-lg border border-emerald-100/60">
            {typeof ea.summary === 'string' ? ea.summary : 'Governed algorithmic abilities with strict tenant boundaries.'}
          </p>

          {ea.capabilities && ea.capabilities.length > 0 && (
            <div className="space-y-2 pt-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                Backend Capability Registry & Execution Status:
              </span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {ea.capabilities.map((cap: any, idx: number) => {
                  const name = typeof cap === 'string' ? cap : cap.name;
                  const desc = typeof cap === 'object' ? cap.description : 'Backend verified domain capability.';
                  const handler = typeof cap === 'object' ? cap.handler : null;
                  const status = typeof cap === 'object' ? cap.status : 'fully_implemented';
                  const isFull = status === 'fully_implemented';
                  const isPartial = status === 'partially_implemented';
                  return (
                    <div
                      key={idx}
                      className="flex flex-col justify-between rounded-lg border border-slate-200/80 bg-slate-50/50 p-2.5 transition-all hover:bg-white"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="text-[11px] font-bold text-slate-900 leading-tight">{name}</span>
                          <span
                            className={`rounded px-1.5 py-0.5 text-[9px] font-extrabold flex items-center gap-1 shrink-0 ${isFull
                              ? 'bg-emerald-100 text-emerald-800'
                              : isPartial
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-600'
                              }`}
                          >
                            <Check className="size-2.5" />
                            {isFull ? 'Implemented' : isPartial ? 'Human-Gated' : 'Unavailable'}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-600 leading-snug">{desc}</p>
                      </div>
                      {handler && (
                        <span className="font-mono text-[8px] text-slate-400 mt-1 block truncate">
                          {handler}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                Core Algorithmic Skills:
              </span>
              <ul className="space-y-1 text-[11px] text-slate-700">
                {ea.skills?.map((skill: string, idx: number) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="text-emerald-500 font-bold">✓</span>
                    <span className="leading-snug">{skill}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                Safety & Guardrail Constraints:
              </span>
              <div className="flex flex-wrap gap-1">
                {ea.constraints_and_safeguards?.map((c: string, idx: number) => (
                  <span
                    key={idx}
                    className="rounded bg-emerald-50 border border-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800"
                  >
                    🛡️ {c}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: ER - EXECUTIVE RESPONSIBILITIES */}
      {activeTab === 'er' && er && (
        <div className="space-y-3 rounded-xl border border-purple-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between border-b border-purple-100 pb-2.5">
            <div className="flex items-center gap-2">
              <div className="flex size-6 items-center justify-center rounded-md bg-purple-100 text-purple-800">
                <Workflow className="size-3.5 text-purple-700" />
              </div>
              <div>
                <span className="text-xs font-bold text-purple-950 block">ER – Executive Responsibilities & Boundaries</span>
                <span className="text-[10px] text-purple-600 font-medium">Execution Boundaries, Contracts & Handoff Protocols</span>
              </div>
            </div>
            <span className="rounded-full bg-purple-50 border border-purple-200 text-purple-700 px-2 py-0.5 text-[10px] font-bold">
              Formal Contracts
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
            <div className="space-y-1.5 rounded-lg border border-emerald-100 bg-emerald-50/20 p-2.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-900 block flex items-center gap-1">
                <CheckCircle2 className="size-3 text-emerald-600" /> Mandatory Responsibilities (Must Do):
              </span>
              <ul className="space-y-1 text-[11px] text-slate-700">
                {er.must_do?.map((item: string, idx: number) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="text-emerald-600 font-bold">✓</span>
                    <span className="leading-snug">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-1.5 rounded-lg border border-rose-100 bg-rose-50/20 p-2.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-900 block flex items-center gap-1">
                <XCircle className="size-3 text-rose-600" /> Prohibited Operations (Must Not Do):
              </span>
              <ul className="space-y-1 text-[11px] text-slate-700">
                {er.must_not_do?.map((item: string, idx: number) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="text-rose-500 font-bold">✕</span>
                    <span className="leading-snug">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">Handoff Contract:</span>
              <p className="text-slate-700">{er.handoff_rules}</p>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">Dependencies:</span>
              <p className="text-slate-700">{er.dependencies}</p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: EQ - EXECUTIVE QUALITY */}
      {activeTab === 'eq' && eq && (
        <div className="space-y-3 rounded-xl border border-amber-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between border-b border-amber-100 pb-2.5">
            <div className="flex items-center gap-2">
              <div className="flex size-6 items-center justify-center rounded-md bg-amber-100 text-amber-800">
                <FileCheck className="size-3.5 text-amber-700" />
              </div>
              <div>
                <span className="text-xs font-bold text-amber-950 block">EQ – Executive Quality & Validation Gates</span>
                <span className="text-[10px] text-amber-600 font-medium">Scoring Formulas, Quality Assertions & Automated Gate Criteria</span>
              </div>
            </div>
            <span className="rounded-full bg-amber-50 border border-amber-200 text-amber-800 px-2 py-0.5 text-[10px] font-bold">
              100% Quality Threshold
            </span>
          </div>

          <div className="rounded-lg bg-amber-50/40 p-3 border border-amber-100/60">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900 block mb-1">
              Applicable Quality Gate:
            </span>
            <div className="flex items-center gap-2">
              <span className="rounded bg-amber-200/80 px-2 py-0.5 text-xs font-black text-amber-950">
                {eq.applicable_gates?.join(', ')}
              </span>
              <span className="text-xs text-slate-600 font-medium">{eq.scoring_formula}</span>
            </div>
          </div>

          <div className="space-y-2 pt-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
              Evaluated Validation Rules & Invariants:
            </span>
            <ul className="space-y-1.5 text-[11px] text-slate-700">
              {eq.quality_rules?.map((rule: string, idx: number) => (
                <li key={idx} className="flex items-start gap-2 rounded-md bg-slate-50 p-2 border border-slate-100">
                  <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0 mt-0.5" />
                  <span className="font-medium text-slate-800">{rule}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* TAB 5: CLASSIC FLOW */}
      {activeTab === 'legacy' && eso && (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-2xs text-xs">
          <div>
            <h5 className="font-bold text-slate-900 mb-1">Execution Activities</h5>
            <ul className="space-y-1 text-slate-600">
              {eso.activities?.items?.map((act: string, idx: number) => (
                <li key={idx}>• {act}</li>
              ))}
            </ul>
          </div>
          <div className="pt-2 border-t border-slate-100">
            <h5 className="font-bold text-slate-900 mb-1">Step-by-Step Flow</h5>
            <ol className="list-decimal pl-4 space-y-1 text-slate-600">
              {eso.usage?.step_by_step_flow?.map((st: string, idx: number) => (
                <li key={idx}>{st}</li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}

export function FeesAgentControlCard({ onValidated, onRan }: FeesAgentControlCardProps) {
  const [state, setState] = useState<FeesAgentState | null>(null);
  const [recentRuns, setRecentRuns] = useState<FeesRecentRun[]>([]);
  const [availableYears, setAvailableYears] = useState<FeesAvailableYear[]>([]);
  const [selectedAcademicYear, setSelectedAcademicYear] = useState<number | null>(null);
  const [resolvedYear, setResolvedYear] = useState<number | null>(null);
  const [yearSource, setYearSource] = useState<string | undefined>(undefined);
  const [instituteIdMeta, setInstituteIdMeta] = useState<number | null>(null);
  const [eso, setEso] = useState<FeesEso | null>(null);
  const [latestReport, setLatestReport] = useState<FeesPipelineReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [runningPipeline, setRunningPipeline] = useState(false);
  const [pipelineError, setPipelineError] = useState<string | null>(null);
  const [expandedTraceAgent, setExpandedTraceAgent] = useState<'agent_1' | 'agent_2' | 'agent_3' | null>(null);
  const [togglingMonitoring, setTogglingMonitoring] = useState(false);
  const [selectedInterval, setSelectedInterval] = useState(60);

  // Main UI Navigation Tabs
  const mainTab = 'pipeline' as const;
  const [inspectingEsoAgent, setInspectingEsoAgent] = useState<'agent_1' | 'agent_2' | 'agent_3' | null>(null);

  // Pipeline Filter Options
  const [standards, setStandards] = useState<FeesStandard[]>([]);
  const [pipelineStandard, setPipelineStandard] = useState<string>('all');
  const [pipelineLimit, setPipelineLimit] = useState<number>(10);
  const [minAmount, setMinAmount] = useState<string>('');
  const [cooldownDays, setCooldownDays] = useState<number>(7);
  const [reminderChannel, setReminderChannel] = useState<'email' | 'sms' | 'whatsapp'>('email');
  const [evidenceLimit, setEvidenceLimit] = useState<number>(5);

  // Dynamic Student Selection State
  const [students, setStudents] = useState<FeesDefaulterStudent[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<number>>(new Set());
  const [customAmounts, setCustomAmounts] = useState<Record<number, number | ''>>({});
  const [studentSearch, setStudentSearch] = useState('');
  const [studentSelectionExpanded, setStudentSelectionExpanded] = useState(false);

  // Sequential Step States
  const [pipelineRunningStep, setPipelineRunningStep] = useState<0 | 1 | 2 | 3>(0);
  const [step1State, setStep1State] = useState<{
    status: 'idle' | 'running' | 'completed' | 'failed';
    duration_ms?: number;
    candidatesCount?: number;
    gate?: FeesGate;
    summary?: string;
    error?: string;
    step_result?: FeesPipelineStep;
    candidates?: FeesCandidate[];
  }>({ status: 'idle' });

  const [step2State, setStep2State] = useState<{
    status: 'idle' | 'waiting' | 'running' | 'completed' | 'failed';
    duration_ms?: number;
    eligibleCount?: number;
    heldBackCount?: number;
    gate?: FeesGate;
    summary?: string;
    error?: string;
    step_result?: FeesPipelineStep;
    eligible?: FeesCandidate[];
    held_back?: FeesCandidate[];
  }>({ status: 'idle' });

  const [step3State, setStep3State] = useState<{
    status: 'idle' | 'waiting' | 'running' | 'completed' | 'failed';
    duration_ms?: number;
    recipientsCount?: number;
    fingerprint?: string;
    gate?: FeesGate;
    summary?: string;
    error?: string;
    step_result?: FeesPipelineStep;
  }>({ status: 'idle' });

  // Human-in-the-Loop Sign-off & Dispatch Modal State
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [approvingAndSending, setApprovingAndSending] = useState(false);
  const [confirmationChecked, setConfirmationChecked] = useState(false);
  const [dispatchResult, setDispatchResult] = useState<FeesSendResult | null>(null);
  const [dispatchError, setDispatchError] = useState<string | null>(null);

  const context = useMemo(() => {
    const session = readModuleWorkspaceSession();
    return {
      token: session.token ?? undefined,
      instituteId: session.instituteId ?? undefined,
      academicYear: session.academicYear ?? undefined,
      baseUrl: session.baseUrl ?? undefined,
    };
  }, []);

  const hydratePipelineFromReport = useCallback((report: FeesPipelineReport | null | undefined) => {
    if (!report || !report.pipeline_execution?.steps?.length) {
      return;
    }

    const steps = report.pipeline_execution.steps;
    const s1 = steps[0];
    const s2 = steps[1];
    const s3 = steps[2];

    if (s1) {
      const candidates = report.arrears_scan?.candidates || s1.output?.candidates || [];
      const candCount = candidates.length || Number(s1.output_summary?.defaulters_found ?? 0);
      setStep1State({
        status: s1.status === 'success' ? 'completed' : 'failed',
        duration_ms: s1.duration_ms,
        candidatesCount: candCount,
        gate: report.quality_scorecard?.gates?.gate_1,
        summary: String(s1.output?.ledger_headline || `Scanned cohort: identified ${candCount} student(s) with fee arrears.`),
        step_result: s1,
        candidates,
      });
    }

    if (s2) {
      const eligibleList = report.evidence_analysis?.eligible || s2.output?.eligible || [];
      const heldBackList = report.evidence_analysis?.held_back || s2.output?.held_back || [];
      setStep2State({
        status: s2.status === 'success' ? 'completed' : 'failed',
        duration_ms: s2.duration_ms,
        eligibleCount: eligibleList.length,
        heldBackCount: heldBackList.length,
        gate: report.quality_scorecard?.gates?.gate_2,
        summary: `Validated evidence: ${eligibleList.length} candidate(s) cleared for reminder; ${heldBackList.length} held back by cooldown.`,
        step_result: s2,
        eligible: eligibleList,
        held_back: heldBackList,
      });
    } else if (s1 && report.pipeline_status === 'completed_no_action') {
      setStep2State({ status: 'completed', eligibleCount: 0, heldBackCount: 0, summary: 'Skipped: 0 arrears candidates to evaluate.' });
    }

    if (s3) {
      const draft = report.reminder_draft;
      setStep3State({
        status: s3.status === 'success' ? 'completed' : 'failed',
        duration_ms: s3.duration_ms,
        recipientsCount: draft?.recipient_count ?? draft?.recipients?.length ?? 0,
        fingerprint: draft?.fingerprint ?? undefined,
        gate: report.quality_scorecard?.gates?.gate_3,
        summary: `Drafted preview for ${draft?.recipient_count ?? 0} recipient(s). SHA-256 approval fingerprint generated. Zero messages sent without approval.`,
        step_result: s3,
      });
    } else if (s1 && report.pipeline_status === 'completed_no_action') {
      setStep3State({ status: 'completed', recipientsCount: 0, summary: 'Skipped: 0 eligible recipients to draft.' });
    }

    setLatestReport(report);
  }, []);

  const applyStatePayload = useCallback(
    (rawState: unknown, hydrateReport = true) => {
      const s = rawState as {
        state?: FeesAgentState & { recent_runs?: FeesRecentRun[]; academic_year?: number | null; academic_year_source?: string; sub_institute_id?: number };
        recent_runs?: FeesRecentRun[];
        available_years?: FeesAvailableYear[];
        latest_report?: FeesPipelineReport | null;
        academic_year?: number | null;
        academic_year_source?: string;
        sub_institute_id?: number;
      } & FeesAgentState;
      const agentState = s.state || s;
      setState(agentState || null);
      setRecentRuns(Array.isArray(s.recent_runs) ? s.recent_runs : Array.isArray(agentState?.recent_runs) ? agentState.recent_runs : []);
      if (Array.isArray(s.available_years)) {
        setAvailableYears(s.available_years);
      }
      const nextYear = s.academic_year ?? agentState?.academic_year ?? null;
      setResolvedYear(nextYear);
      if (nextYear) {
        setSelectedAcademicYear((prev) => prev ?? nextYear);
      }
      setYearSource(s.academic_year_source ?? agentState?.academic_year_source);
      setInstituteIdMeta(s.sub_institute_id ?? agentState?.sub_institute_id ?? null);
      if (agentState?.interval_seconds) {
        setSelectedInterval(agentState.interval_seconds);
      }
      if (hydrateReport && s.latest_report) {
        hydratePipelineFromReport(s.latest_report);
      }
    },
    [hydratePipelineFromReport],
  );

  const loadInitialData = useCallback(
    async (explicitYear?: number | null) => {
      setLoading(true);
      try {
        const [stateRes, esoRes, standardsRes] = await Promise.allSettled([
          getFeesAgentState(context, explicitYear, true),
          getFeesEso(context, explicitYear),
          fetchFeesStandards(context),
        ]);

        if (stateRes.status === 'fulfilled') {
          applyStatePayload(stateRes.value, true);
        }

        if (esoRes.status === 'fulfilled') {
          const e = esoRes.value as { eso?: FeesEso } | FeesEso;
          setEso('eso' in e && e.eso ? e.eso : (e as FeesEso));
        }

        if (standardsRes.status === 'fulfilled') {
          const val = standardsRes.value as FeesStandard[] | { standards?: FeesStandard[] };
          const stdList = Array.isArray(val) ? val : val?.standards || [];
          setStandards(stdList);
        }
      } catch (err) {
        console.error('Failed to load initial Fees Agent data:', err);
      } finally {
        setLoading(false);
      }
    },
    [context, applyStatePayload],
  );

  const loadStudents = useCallback(
    async (stdIdStr: string, explicitYear?: number | null) => {
      setLoadingStudents(true);
      setLoadingStudents(true);
      try {
        const stdId = stdIdStr === 'all' ? undefined : parseInt(stdIdStr, 10);
        const data = await fetchFeesDefaulterStudents(context, stdId, 50, explicitYear);
        setStudents(data);
        // By default select all loaded defaulters
        setSelectedStudentIds(new Set(data.map((s) => s.student_id)));
        setCustomAmounts({});
      } catch (err) {
        console.error('Failed to load defaulter students:', err);
      } finally {
        setLoadingStudents(false);
      }
    },
    [context],
  );

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (!cancelled) void loadInitialData(null);
    });
    return () => {
      cancelled = true;
    };
  }, [loadInitialData]);

  const handleAcademicYearChange = useCallback(
    (newYear: number) => {
      setSelectedAcademicYear(newYear);
      setStep1State({ status: 'idle' });
      setStep2State({ status: 'idle' });
      setStep3State({ status: 'idle' });
      setLatestReport(null);
      void loadInitialData(newYear);
      void loadStudents(pipelineStandard, newYear);
    },
    [loadInitialData, loadStudents, pipelineStandard],
  );

  useEffect(() => {
    if (!resolvedYear && !selectedAcademicYear) return;
    let cancelled = false;
    const activeYear = selectedAcademicYear ?? resolvedYear;
    Promise.resolve().then(() => {
      if (!cancelled) void loadStudents(pipelineStandard, activeYear);
    });
    return () => {
      cancelled = true;
    };
  }, [pipelineStandard, selectedAcademicYear, resolvedYear, loadStudents]);

  const handleToggleStudent = (studentId: number) => {
    setSelectedStudentIds((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) {
        next.delete(studentId);
      } else {
        next.add(studentId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    setSelectedStudentIds(new Set(filteredStudents.map((s) => s.student_id)));
  };

  const handleDeselectAll = () => {
    setSelectedStudentIds(new Set());
  };

  const handleCustomAmountChange = (studentId: number, rawVal: string) => {
    if (rawVal === '') {
      setCustomAmounts((prev) => ({ ...prev, [studentId]: '' }));
      return;
    }
    const parsed = parseFloat(rawVal);
    if (!isNaN(parsed) && parsed >= 0) {
      setCustomAmounts((prev) => ({ ...prev, [studentId]: parsed }));
    }
  };

  const handleResetCustomAmounts = () => {
    setCustomAmounts({});
  };

  const filteredStudents = useMemo(() => {
    if (!studentSearch.trim()) return students;
    const q = studentSearch.toLowerCase();
    return students.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.enrollment_no && s.enrollment_no.toLowerCase().includes(q)) ||
        (s.standard_name && s.standard_name.toLowerCase().includes(q)),
    );
  }, [students, studentSearch]);

  const selectedStudents = useMemo(() => {
    return students.filter((s) => selectedStudentIds.has(s.student_id));
  }, [students, selectedStudentIds]);

  const totalActualDuesOfSelected = useMemo(() => {
    return selectedStudents.reduce((sum, s) => sum + s.outstanding, 0);
  }, [selectedStudents]);

  const totalCustomDuesOfSelected = useMemo(() => {
    return selectedStudents.reduce((sum, s) => {
      const c = customAmounts[s.student_id];
      if (typeof c === 'number' && c > 0 && c <= s.outstanding) {
        return sum + c;
      }
      return sum + s.outstanding;
    }, 0);
  }, [selectedStudents, customAmounts]);

  const customCountOfSelected = useMemo(() => {
    return selectedStudents.filter((s) => {
      const c = customAmounts[s.student_id];
      return typeof c === 'number' && c > 0 && c !== s.outstanding;
    }).length;
  }, [selectedStudents, customAmounts]);

  const handleToggleMonitoring = async () => {
    if (togglingMonitoring || !state) return;
    setTogglingMonitoring(true);
    try {
      const isActive = Boolean(state.is_active);
      if (isActive) {
        const res = await stopFeesAgentMonitoring(context);
        setState(res.state || null);
      } else {
        const res = await startFeesAgentMonitoring(context, selectedInterval);
        setState(res.state || null);
      }
      onRan?.();
    } catch (err) {
      console.error('Failed to toggle monitoring:', err);
    } finally {
      setTogglingMonitoring(false);
    }
  };

  const handleIntervalChange = async (newVal: number) => {
    setSelectedInterval(newVal);
    if (!state?.is_active) return;
    try {
      const res = await setFeesAgentInterval(context, newVal);
      setState(res.state || null);
    } catch (err) {
      console.error('Failed to update interval:', err);
    }
  };

  /**
   * True Sequential Pipeline Execution: Step 1 ➔ Step 2 ➔ Step 3
   */
  const handleRunPipeline = async () => {
    if (runningPipeline) return;
    setRunningPipeline(true);
    setPipelineRunningStep(1);
    setPipelineError(null);
    setLatestReport(null);
    setDispatchResult(null);

    setStep1State({ status: 'running' });
    setStep2State({ status: 'waiting' });
    setStep3State({ status: 'waiting' });

    let activeStep: 1 | 2 | 3 = 1;

    try {
      const activeYear = selectedAcademicYear ?? resolvedYear ?? undefined;
      const baseOptions: any = {
        limit: pipelineLimit,
        cooldown_days: cooldownDays,
        evidence_limit: evidenceLimit,
        channel: reminderChannel,
        ...(activeYear ? { academic_year: activeYear, explicit_academic_year: true } : {}),
      };

      if (pipelineStandard && pipelineStandard !== 'all') {
        baseOptions.standard_id = parseInt(pipelineStandard, 10);
      }
      if (minAmount && parseFloat(minAmount) > 0) {
        baseOptions.min_amount = parseFloat(minAmount);
      }

      if (students.length > 0 && selectedStudentIds.size > 0 && selectedStudentIds.size < students.length) {
        baseOptions.student_ids = Array.from(selectedStudentIds);
      }

      const validCustomAmounts: Record<number, number> = {};
      for (const [sidStr, val] of Object.entries(customAmounts)) {
        const sid = Number(sidStr);
        if (selectedStudentIds.has(sid) && typeof val === 'number' && val > 0) {
          const s = students.find((st) => st.student_id === sid);
          if (s && val <= s.outstanding) {
            validCustomAmounts[sid] = val;
          }
        }
      }
      if (Object.keys(validCustomAmounts).length > 0) {
        baseOptions.custom_amounts = validCustomAmounts;
      }

      // ── STEP 1: Agent 1 · Fee Position & Arrears Reader (Gate 1) ──
      activeStep = 1;
      const step1Res: any = await runFeesPipeline(context, { ...baseOptions, step: 1 });
      const r1 = step1Res.report || step1Res;

      if (!r1?.success) {
        const errMsg = r1?.error || 'Step 1 (Fee Position & Arrears Reader) failed at Gate 1.';
        setStep1State({
          status: 'failed',
          gate: r1?.details?.gate_1,
          summary: errMsg,
          error: errMsg,
          step_result: r1?.details?.step_result,
        });
        setStep2State({ status: 'idle' });
        setStep3State({ status: 'idle' });
        setPipelineError(errMsg);
        return;
      }

      const runId = r1.run_id;
      const candidates = r1.candidates || r1.step_result?.output?.candidates || r1.arrears_scan?.candidates || [];
      const candCount = candidates.length || r1.step_result?.output_summary?.defaulters_found || 0;

      setStep1State({
        status: 'completed',
        duration_ms: r1.step_result?.duration_ms ?? r1.pipeline_execution?.steps?.[0]?.duration_ms,
        candidatesCount: candCount,
        gate: r1.gate ?? r1.quality_scorecard?.gates?.gate_1,
        summary: r1.step_result?.output?.ledger_headline || `Scanned cohort: identified ${candCount} student(s) with fee arrears.`,
        step_result: r1.step_result ?? r1.pipeline_execution?.steps?.[0],
        candidates,
      });

      // Handle clean ledger early exit (0 defaulters)
      if (r1.report_complete) {
        setStep2State({ status: 'completed', eligibleCount: 0, heldBackCount: 0, summary: 'Skipped: 0 arrears candidates to evaluate.' });
        setStep3State({ status: 'completed', recipientsCount: 0, summary: 'Skipped: 0 eligible recipients to draft.' });
        setLatestReport(r1);
        onValidated?.(r1);
        onRan?.();
        return;
      }

      // ── STEP 2: Agent 2 · Collection Evidence & History Analyst (Gate 2) ──
      activeStep = 2;
      setPipelineRunningStep(2);
      setStep2State({ status: 'running' });

      const step2Res: any = await runFeesPipeline(context, { ...baseOptions, step: 2, run_id: runId });
      const r2 = step2Res.report || step2Res;

      if (!r2?.success) {
        const errMsg = r2?.error || 'Step 2 (Collection Evidence & History Analyst) failed at Gate 2.';
        setStep2State({
          status: 'failed',
          gate: r2?.details?.gate_2,
          summary: errMsg,
          error: errMsg,
          step_result: r2?.details?.step_result,
        });
        setStep3State({ status: 'idle' });
        setPipelineError(errMsg);
        return;
      }

      const eligibleList = r2.eligible || [];
      const heldBackList = r2.held_back || [];

      setStep2State({
        status: 'completed',
        duration_ms: r2.step_result?.duration_ms,
        eligibleCount: eligibleList.length,
        heldBackCount: heldBackList.length,
        gate: r2.gate,
        summary: `Validated evidence: ${eligibleList.length} candidate(s) cleared for reminder; ${heldBackList.length} held back by cooldown.`,
        step_result: r2.step_result,
        eligible: eligibleList,
        held_back: heldBackList,
      });

      // ── STEP 3: Agent 3 · Fee Reminder Drafter (Gate 3) ──
      activeStep = 3;
      setPipelineRunningStep(3);
      setStep3State({ status: 'running' });

      const step3Res: any = await runFeesPipeline(context, { ...baseOptions, step: 3, run_id: runId });
      const r3 = step3Res.report || step3Res;

      if (!r3?.success) {
        const errMsg = r3?.error || 'Step 3 (Fee Reminder Drafter) failed at Gate 3.';
        setStep3State({
          status: 'failed',
          gate: r3?.details?.gate_3 || r3?.quality_scorecard?.gates?.gate_3,
          summary: errMsg,
          error: errMsg,
          step_result: r3?.details?.step_result,
        });
        setPipelineError(errMsg);
        return;
      }

      const draft = r3.reminder_draft || {};
      const gate3 = r3.quality_scorecard?.gates?.gate_3 || r3.gate;

      setStep3State({
        status: 'completed',
        duration_ms: r3.pipeline_execution?.steps?.[2]?.duration_ms || r3.step_result?.duration_ms,
        recipientsCount: draft.recipient_count ?? draft.recipients?.length ?? 0,
        fingerprint: draft.fingerprint,
        gate: gate3,
        summary: `Drafted preview for ${draft.recipient_count ?? 0} recipient(s). Cryptographic SHA-256 fingerprint generated. Zero messages sent without human approval.`,
        step_result: r3.step_result ?? r3.pipeline_execution?.steps?.[2],
      });

      setLatestReport(r3);
      onValidated?.(r3);
      onRan?.();

      const stateRes = await getFeesAgentState(context, activeYear ?? null, false);
      applyStatePayload(stateRes, false);
    } catch (err: unknown) {
      const pipeErr = err as FeesPipelineError;
      const msg = pipeErr?.message || 'Pipeline execution failed.';
      const details = pipeErr?.failure?.details;
      setPipelineError(msg);
      if (activeStep === 1) {
        setStep1State({ status: 'failed', error: msg, summary: msg, gate: details?.gate_1, step_result: details?.step_result });
        setStep2State({ status: 'idle' });
        setStep3State({ status: 'idle' });
      } else if (activeStep === 2) {
        setStep2State({ status: 'failed', error: msg, summary: msg, gate: details?.gate_2, step_result: details?.step_result });
        setStep3State({ status: 'idle' });
      } else {
        setStep3State({ status: 'failed', error: msg, summary: msg, gate: details?.gate_3, step_result: details?.step_result });
      }
    } finally {
      setRunningPipeline(false);
      setPipelineRunningStep(0);
    }
  };

  const handleApproveAndSend = async () => {
    if (!latestReport?.reminder_draft?.fingerprint || approvingAndSending) return;
    setApprovingAndSending(true);
    setDispatchError(null);
    try {
      const draftedRecipients = latestReport.reminder_draft.recipients || [];
      const recipientIds = draftedRecipients.map((r) => r.student_id);
      const customMap: Record<number, number> = {};
      for (const r of draftedRecipients) {
        if (r.is_custom_amount) {
          customMap[r.student_id] = r.outstanding;
        }
      }

      const activeYear = selectedAcademicYear ?? resolvedYear ?? latestReport.academic_year ?? undefined;
      const res = await sendApprovedFeesReminders(
        context,
        {
          fingerprint: latestReport.reminder_draft.fingerprint,
          channel: reminderChannel,
          deadline: latestReport.reminder_draft.deadline || new Date().toISOString().slice(0, 10),
          student_ids: recipientIds.length > 0 ? recipientIds : undefined,
          custom_amounts: Object.keys(customMap).length > 0 ? customMap : undefined,
          standard_id: pipelineStandard !== 'all' ? parseInt(pipelineStandard, 10) : undefined,
        },
        activeYear,
      );

      setDispatchResult(res.result);
      onRan?.();

      void loadInitialData(activeYear ?? null);
      void loadStudents(pipelineStandard, activeYear ?? null);
    } catch (err: any) {
      console.error('Dispatch error:', err);
      setDispatchError(err.message || 'Failed to dispatch reminders.');
    } finally {
      setApprovingAndSending(false);
    }
  };

  const formatRupees = (amount?: number | null) => {
    if (amount === undefined || amount === null || Number.isNaN(amount)) return loading ? 'Loading…' : '—';
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  const summary = state?.summary_counts;
  const ledger = latestReport?.ledger_position;
  const arrears = latestReport?.arrears_scan;
  const reminder = latestReport?.reminder_draft;

  const displayDemand = ledger?.total_demand ?? summary?.total_demand ?? null;
  const displayCollected = ledger?.total_collected ?? summary?.total_collected ?? null;
  const displayOutstanding = ledger?.total_outstanding ?? summary?.total_outstanding ?? null;
  const displayDefaulters = summary?.defaulters_count ?? arrears?.defaulter_count ?? null;
  const displayCollectionRate =
    ledger?.collection_rate ??
    (summary?.collection_rate !== undefined && summary?.collection_rate !== null
      ? `${summary.collection_rate}%`
      : displayDemand && displayDemand > 0 && displayCollected !== null
        ? `${((displayCollected / displayDemand) * 100).toFixed(1)}%`
        : null);
  const displayOutstandingShare =
    displayDemand && displayDemand > 0 && displayOutstanding !== null
      ? `${((displayOutstanding / displayDemand) * 100).toFixed(1)}% of Demand Pending`
      : null;
  const displayAcademicYear = latestReport?.academic_year ?? resolvedYear ?? state?.academic_year ?? null;
  const displayYearSource = latestReport?.academic_year_source ?? yearSource ?? state?.academic_year_source;
  const displayInstituteId = latestReport?.sub_institute_id ?? instituteIdMeta ?? state?.sub_institute_id ?? null;

  return (
    <div className="space-y-6">
      {/* ── TOP BANNER: MASTER AUTONOMOUS AGENT ── */}
      <div className="rounded-2xl border border-slate-200/80 bg-linear-to-r from-slate-900 via-indigo-950 to-slate-900 p-5 text-white shadow-md">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3.5">
            <div className="flex size-11 items-center justify-center rounded-xl bg-indigo-500/20 ring-1 ring-indigo-400/30 text-indigo-300">
              <Bot className="size-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-bold tracking-tight text-white">
                  Fees Master Autonomous Agent
                </h2>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${state?.is_active
                    ? 'bg-emerald-500/20 text-emerald-300 ring-emerald-500/30'
                    : 'bg-slate-500/20 text-slate-300 ring-slate-400/30'
                    }`}
                >
                  <span className={`size-1.5 rounded-full ${state?.is_active ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'}`} />
                  {state?.is_active ? 'Monitoring Active' : 'Paused / On-Demand'}
                </span>
                {displayInstituteId ? (
                  <span className="rounded-full bg-white/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-indigo-200">
                    Institute #{displayInstituteId}
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 text-xs text-slate-300">
                Sequential 3-agent pipeline for live fee ledger audits, cooldown verification, and human-approved reminders.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => void loadInitialData(selectedAcademicYear ?? resolvedYear)}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-2 text-xs font-bold text-white transition hover:bg-white/20 disabled:opacity-50"
            >
              <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>

            <div className="flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-1.5 text-xs text-slate-200 backdrop-blur-xs">
              <Clock className="size-3.5 text-indigo-300" />
              <span>Interval:</span>
              <select
                value={selectedInterval}
                onChange={(e) => void handleIntervalChange(parseInt(e.target.value, 10))}
                className="bg-transparent font-bold text-white focus:outline-hidden"
              >
                <option value={30} className="text-slate-900">30s</option>
                <option value={60} className="text-slate-900">60s (Default)</option>
                <option value={120} className="text-slate-900">2 min</option>
                <option value={300} className="text-slate-900">5 min</option>
              </select>
            </div>

            <button
              type="button"
              onClick={handleToggleMonitoring}
              disabled={togglingMonitoring}
              className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition shadow-xs ${state?.is_active
                ? 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                : 'bg-emerald-600 text-white hover:bg-emerald-500'
                }`}
            >
              {state?.is_active ? (
                <>
                  <Pause className="size-3.5" /> Pause Loop
                </>
              ) : (
                <>
                  <Play className="size-3.5" /> Start Continuous Run
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ── 4 KEY METRIC CARDS (Strictly Real Database Data) ── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase">
            <span>Total Fees Demand</span>
            <DollarSign className="size-4 text-indigo-500" />
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900">{formatRupees(displayDemand)}</div>
          <div className="mt-1 text-[11px] font-semibold text-slate-500">
            {displayAcademicYear ? `Academic Year ${displayAcademicYear}` : loading ? 'Resolving year…' : 'Year unresolved'}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase">
            <span>Total Collected</span>
            <CreditCard className="size-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-black text-emerald-600">{formatRupees(displayCollected)}</div>
          <div className="mt-1 text-[11px] font-semibold text-emerald-700">
            {displayCollectionRate ? `Collection Rate: ${displayCollectionRate}` : '—'}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase">
            <span>Total Balance Due</span>
            <AlertCircle className="size-4 text-rose-500" />
          </div>
          <div className="mt-2 text-2xl font-black text-rose-600">{formatRupees(displayOutstanding)}</div>
          <div className="mt-1 text-[11px] font-bold text-rose-600">
            {displayOutstandingShare ?? '—'}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase">
            <span>Defaulters Count</span>
            <Users className="size-4 text-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-black text-indigo-600">
            {displayDefaulters !== null ? displayDefaulters.toLocaleString('en-IN') : loading ? 'Loading…' : '—'}
          </div>
          <div className="mt-1 text-[11px] font-semibold text-slate-500">
            {summary?.fee_accounts !== undefined ? `Across ${summary.fee_accounts.toLocaleString('en-IN')} fee accounts` : 'Live ledger accounts'}
          </div>
        </div>
      </div>

      {/* ── TAB 1: SEQUENTIAL 3-AGENT PIPELINE (HERO) ── */}
      {mainTab === 'pipeline' && (
        <div className="space-y-5">
          {/* PIPELINE CONTROLS & FILTER ROW */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Filter className="size-4 text-indigo-600" />
                  Pipeline Execution Scope & Filter Parameters
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  Configure academic year and execution parameters before initiating the sequential agent pipeline.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
              {/* Academic Year */}
              <div>
                <label className="text-[11px] font-bold text-slate-600 uppercase">Academic Year</label>
                <select
                  value={displayAcademicYear ?? ''}
                  onChange={(e) => {
                    const yr = parseInt(e.target.value, 10);
                    if (!Number.isNaN(yr)) handleAcademicYearChange(yr);
                  }}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                >
                  {availableYears.length === 0 && displayAcademicYear ? (
                    <option value={displayAcademicYear}>AY {displayAcademicYear}</option>
                  ) : (
                    availableYears.map((y) => (
                      <option key={y.syear} value={y.syear}>
                        AY {y.syear} ({y.structure_count} heads · {y.receipts_count} receipts)
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Standard Scope */}
              <div>
                <label className="text-[11px] font-bold text-slate-600 uppercase">Standard Scope</label>
                <select
                  value={pipelineStandard}
                  onChange={(e) => setPipelineStandard(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="all">All Standards (School-wide)</option>
                  {standards.map((s) => {
                    const stdId = s.standard_id ?? s.id;
                    const stdName = s.standard_name ?? s.name;
                    return (
                      <option key={stdId} value={stdId}>
                        {stdName}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Scan Limit */}
              <div>
                <label className="text-[11px] font-bold text-slate-600 uppercase">Scan Limit</label>
                <input
                  type="number"
                  min={1}
                  max={40}
                  value={pipelineLimit}
                  onChange={(e) => setPipelineLimit(parseInt(e.target.value, 10) || 10)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Cooldown Window */}
              <div>
                <label className="text-[11px] font-bold text-slate-600 uppercase">Cooldown Window</label>
                <select
                  value={cooldownDays}
                  onChange={(e) => setCooldownDays(parseInt(e.target.value, 10))}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                >
                  <option value={0}>0 Days (No Cooldown)</option>
                  <option value={3}>3 Days</option>
                  <option value={7}>7 Days (Standard)</option>
                  <option value={14}>14 Days</option>
                  <option value={30}>30 Days</option>
                </select>
              </div>

              {/* Channel */}
              <div>
                <label className="text-[11px] font-bold text-slate-600 uppercase">Notification Channel</label>
                <select
                  value={reminderChannel}
                  onChange={(e) => setReminderChannel(e.target.value as any)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="email">Email Notice</option>
                  <option value="sms">SMS Text</option>
                  <option value="whatsapp">WhatsApp Message</option>
                </select>
              </div>

              {/* Run Trigger */}
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={handleRunPipeline}
                  disabled={runningPipeline}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-md transition hover:bg-indigo-500 disabled:opacity-50"
                >
                  <Zap className={`size-4 ${runningPipeline ? 'animate-spin' : ''}`} />
                  {runningPipeline ? `Running Step ${pipelineRunningStep}…` : 'Execute Steps'}
                </button>
              </div>
            </div>
          </div>

          {/* COLLAPSIBLE STUDENT SELECTION & CUSTOM FEE AMOUNT PANEL */}
          <div className="rounded-2xl border border-slate-200/90 bg-white shadow-xs overflow-hidden">
            <button
              type="button"
              onClick={() => setStudentSelectionExpanded(!studentSelectionExpanded)}
              className="w-full flex flex-wrap items-center justify-between gap-3 p-4 bg-slate-50/60 hover:bg-slate-50 transition text-left"
            >
              <div className="flex items-center gap-2.5">
                <Users className="size-4 text-indigo-600" />
                <div>
                  <h4 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                    Scope Defaulter Selection & Custom Amounts
                    <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-extrabold text-indigo-800">
                      {selectedStudentIds.size} of {students.length} Selected
                    </span>
                    {customCountOfSelected > 0 && (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-extrabold text-emerald-800">
                        {customCountOfSelected} Custom Amounts
                      </span>
                    )}
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Selected Dues: <strong className="text-slate-800">{formatRupees(totalActualDuesOfSelected)}</strong>
                    {customCountOfSelected > 0 && (
                      <span className="ml-1 text-emerald-700 font-bold">
                        (Reminder Total: {formatRupees(totalCustomDuesOfSelected)})
                      </span>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs font-bold text-indigo-600">
                <span>{studentSelectionExpanded ? 'Hide Student List' : 'Customize Selected Students & Amounts'}</span>
                <ChevronDown className={`size-4 transition-transform ${studentSelectionExpanded ? 'rotate-180' : ''}`} />
              </div>
            </button>

            {studentSelectionExpanded && (
              <div className="p-5 border-t border-slate-100 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="relative">
                    <Search className="size-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search name / enrollment…"
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                      className="rounded-xl border border-slate-200 bg-slate-50/50 pl-8 pr-3 py-1.5 text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSelectAll}
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={handleDeselectAll}
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                    >
                      Deselect All
                    </button>
                    <button
                      type="button"
                      onClick={handleResetCustomAmounts}
                      className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                      title="Reset all custom amounts back to actual dues"
                    >
                      <RotateCcw className="size-3 text-slate-500" />
                      Reset Amounts
                    </button>
                  </div>
                </div>

                {loadingStudents ? (
                  <div className="py-8 text-center text-xs text-slate-500">
                    <RefreshCw className="size-5 animate-spin mx-auto text-indigo-600 mb-2" />
                    Fetching enrolled students with outstanding fee arrears from live database…
                  </div>
                ) : filteredStudents.length > 0 ? (
                  <div className="overflow-x-auto rounded-xl border border-slate-200 max-h-72">
                    <table className="w-full text-left text-xs text-slate-600">
                      <thead className="bg-slate-50 text-[11px] font-bold uppercase text-slate-500 sticky top-0 z-10 shadow-2xs">
                        <tr>
                          <th className="px-4 py-3 w-10 text-center">
                            <input
                              type="checkbox"
                              checked={selectedStudentIds.size === filteredStudents.length && filteredStudents.length > 0}
                              onChange={(e) => (e.target.checked ? handleSelectAll() : handleDeselectAll())}
                              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            />
                          </th>
                          <th className="px-4 py-3">Student Details</th>
                          <th className="px-4 py-3">Class</th>
                          <th className="px-4 py-3">Contact Details</th>
                          <th className="px-4 py-3 text-right">Actual Dues</th>
                          <th className="px-4 py-3 text-right">Reminder Amount (₹)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredStudents.map((s) => {
                          const isSelected = selectedStudentIds.has(s.student_id);
                          const customVal = customAmounts[s.student_id];
                          const isCustom = typeof customVal === 'number' && customVal > 0 && customVal !== s.outstanding;
                          const isExceeding = typeof customVal === 'number' && customVal > s.outstanding;
                          const isInvalid = typeof customVal === 'number' && customVal <= 0;

                          return (
                            <tr key={s.student_id} className={`transition hover:bg-slate-50 ${isSelected ? 'bg-indigo-50/20' : ''}`}>
                              <td className="px-4 py-3 text-center">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => handleToggleStudent(s.student_id)}
                                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                />
                              </td>
                              <td className="px-4 py-3 font-medium text-slate-900">
                                <div>{s.name}</div>
                                <div className="text-[10px] text-slate-400 font-mono">Enr: {s.enrollment_no || '—'}</div>
                              </td>
                              <td className="px-4 py-3 font-semibold text-slate-700">{s.standard_name || 'Standard'}</td>
                              <td className="px-4 py-3 font-mono text-[10px] text-slate-500">
                                {s.email_masked && <div>✉ {s.email_masked}</div>}
                                {s.mobile_masked && <div>📱 {s.mobile_masked}</div>}
                              </td>
                              <td className="px-4 py-3 text-right font-bold text-rose-600">
                                {formatRupees(s.outstanding)}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <input
                                  type="number"
                                  placeholder={String(s.outstanding)}
                                  value={customVal === undefined ? '' : customVal}
                                  disabled={!isSelected}
                                  onChange={(e) => handleCustomAmountChange(s.student_id, e.target.value)}
                                  className={`w-28 rounded-lg border px-2.5 py-1 text-right text-xs font-mono font-bold transition focus:outline-hidden ${isExceeding
                                    ? 'border-rose-400 bg-rose-50 text-rose-700 focus:ring-rose-500'
                                    : isCustom
                                      ? 'border-indigo-400 bg-indigo-50/50 text-indigo-900 focus:ring-indigo-500'
                                      : 'border-slate-200 bg-white text-slate-800 focus:ring-indigo-500'
                                    } disabled:opacity-40`}
                                />
                                {isExceeding && (
                                  <span className="block text-[9px] font-bold text-rose-600 mt-0.5">Exceeds dues</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="py-6 text-center text-xs text-slate-500">
                    No defaulter students found for this standard filter.
                  </div>
                )}
              </div>
            )}
          </div>

          {pipelineError && (
            <div className="flex items-start gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-900">
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-rose-600" />
              <div className="flex-1">
                <strong>Pipeline Halted:</strong> {pipelineError}
              </div>
              <button type="button" onClick={() => setPipelineError(null)} className="text-rose-600 hover:text-rose-900">
                <X className="size-4" />
              </button>
            </div>
          )}

          {/* ── 1. AGENT-BY-AGENT WORKFLOW SEQUENCE & REAL PROGRESS ── */}
          <FeesPipelineSequenceBanner
            step1={step1State}
            step2={step2State}
            step3={step3State}
            latestReport={latestReport}
            runningPipeline={runningPipeline}
            academicYear={displayAcademicYear}
            academicYearSource={displayYearSource}
            subInstituteId={displayInstituteId}
          />

          {/* ── SEQUENTIAL 3-AGENT PIPELINE CARDS (HERO) ── */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            {/* STEP 1 · AGENT 1: Fee Position & Arrears Reader */}
            <div className={`rounded-2xl border bg-white p-5 shadow-xs relative overflow-hidden flex flex-col justify-between transition-all ${step1State.status === 'running'
              ? 'border-indigo-400 ring-2 ring-indigo-100'
              : step1State.status === 'completed'
                ? 'border-indigo-300'
                : step1State.status === 'failed'
                  ? 'border-rose-300'
                  : 'border-slate-200/90'
              }`}>
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-indigo-500" />
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-bold text-indigo-700">
                    Step 1 • Agent 1
                  </span>
                  <div className="flex items-center gap-1.5">
                    {step1State.duration_ms !== undefined && (
                      <span className="font-mono text-[10px] font-bold text-slate-500">{step1State.duration_ms}ms</span>
                    )}
                    <StatusPill status={toAgentStatusLabel(step1State.status)} />
                  </div>
                </div>

                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-base font-bold text-slate-900">
                      Fee Position &amp; Arrears Reader
                    </h4>
                    <span className="font-mono text-[10px] text-slate-400">agt_fees_position_reader</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setInspectingEsoAgent(inspectingEsoAgent === 'agent_1' ? null : 'agent_1')}
                    className="rounded-lg bg-indigo-50 px-2 py-1 text-[10px] font-bold text-indigo-700 hover:bg-indigo-100 transition shrink-0"
                  >
                    ESO Inspect
                  </button>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  <strong>Responsibility:</strong> Reads the school-wide fee ledger for the active academic year, computes total demand vs collected receipts, and identifies students with unpaid fee balances.
                </p>

                <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-2.5 text-[11px] text-slate-700">
                  <span className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">Input Received</span>
                  AY {displayAcademicYear ?? 'auto'} · Scope: {pipelineStandard === 'all' ? 'All Standards' : `Standard #${pipelineStandard}`} · Scan Limit: {pipelineLimit}
                </div>

                <div>
                  <span className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Database Tables Accessed</span>
                  <div className="flex flex-wrap gap-1">
                    {(step1State.step_result?.output?.tables_accessed ?? ['fees_breackoff', 'fees_collect', 'fees_paid_other', 'tblstudent', 'tblstudent_enrollment', 'standard']).map((tbl) => (
                      <span key={tbl} className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-slate-700">
                        {tbl}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Distinct Processing Breakdown */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-100">
                    <span className="text-[10px] text-slate-500 block">Fetched (Checked)</span>
                    <strong className="text-sm font-extrabold text-slate-900">
                      {step1State.step_result?.output?.records_fetched !== undefined
                        ? `${step1State.step_result.output.records_fetched} / ${step1State.step_result.output.cohort_size ?? step1State.step_result.output.records_fetched}`
                        : '—'}
                    </strong>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-100">
                    <span className="text-[10px] text-slate-500 block">Processed</span>
                    <strong className="text-sm font-extrabold text-indigo-700">
                      {step1State.step_result?.output?.records_processed ?? '—'}
                    </strong>
                  </div>
                  <div className="rounded-xl bg-emerald-50/60 p-2.5 border border-emerald-100">
                    <span className="text-[10px] text-emerald-800 block">With Arrears (Flagged)</span>
                    <strong className="text-sm font-extrabold text-emerald-900">
                      {step1State.status === 'completed' ? (step1State.candidatesCount ?? 0) : '—'}
                    </strong>
                  </div>
                  <div className="rounded-xl bg-amber-50/60 p-2.5 border border-amber-100">
                    <span className="text-[10px] text-amber-800 block">Held Back / Cleared</span>
                    <strong className="text-sm font-extrabold text-amber-900">
                      {step1State.step_result?.output?.held_back_count ?? '—'}
                    </strong>
                  </div>
                </div>

                <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-2.5 text-[11px] text-indigo-950 flex items-center justify-between">
                  <span className="font-semibold">Passed to Agent 2:</span>
                  <strong className="font-extrabold">
                    {step1State.status === 'completed' ? `${step1State.candidatesCount ?? 0} candidate(s)` : '—'}
                  </strong>
                </div>

                {step1State.summary && (
                  <p className="text-[11px] text-slate-600 leading-snug">{step1State.summary}</p>
                )}

                {step1State.error && (
                  <div className="rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-800">
                    <strong>Halt Error:</strong> {step1State.error}
                  </div>
                )}

                {(step1State.step_result?.actions?.length || step1State.gate) && (
                  <div>
                    <button
                      type="button"
                      onClick={() => setExpandedTraceAgent(expandedTraceAgent === 'agent_1' ? null : 'agent_1')}
                      className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 underline"
                    >
                      {expandedTraceAgent === 'agent_1' ? 'Hide Execution & Gate Checks ▲' : 'View Execution & Gate 1 Checks ▼'}
                    </button>
                    {expandedTraceAgent === 'agent_1' && (
                      <div className="mt-2 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-[11px]">
                        {step1State.step_result?.actions?.map((act, i) => (
                          <div key={i} className="flex items-start gap-1.5">
                            <span className={act.success ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>
                              {act.success ? '✓' : '✕'}
                            </span>
                            <div>
                              <span className="font-mono font-bold text-slate-800">{act.tool || act.type}</span>
                              {act.duration_ms !== undefined && <span className="ml-1 text-slate-400">({act.duration_ms}ms)</span>}
                              <p className="text-slate-600">{act.summary}</p>
                            </div>
                          </div>
                        ))}
                        {step1State.gate && (
                          <div className="border-t border-slate-200 pt-1.5 space-y-1">
                            <span className="font-bold text-slate-700 block">
                              {step1State.gate.gate} ({step1State.gate.passed_checks}/{step1State.gate.total_checks} checks · {step1State.gate.score}%)
                            </span>
                            {Object.entries(step1State.gate.checks || {}).map(([k, v]) => (
                              <div key={k} className="flex items-start gap-1.5 text-[10px]">
                                <span className={v.status === 'passed' ? 'text-emerald-600' : 'text-rose-600'}>●</span>
                                <span className="text-slate-600"><strong>{k.replace(/_/g, ' ')}:</strong> {v.message}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Tool: fees.position + arrears</span>
                <span className="font-bold text-indigo-600 flex items-center gap-1">
                  Handoff to Agent 2 <ArrowRight className="size-3" />
                </span>
              </div>

              {inspectingEsoAgent === 'agent_1' && (
                <div className="mt-3">
                  <AgentEsoCard agentKey="agent_1" agentDetail={eso?.agents?.agent_1} />
                </div>
              )}
            </div>

            {/* STEP 2 · AGENT 2: Collection Evidence & History Analyst */}
            <div className={`rounded-2xl border bg-white p-5 shadow-xs relative overflow-hidden flex flex-col justify-between transition-all ${step2State.status === 'running'
              ? 'border-violet-400 ring-2 ring-violet-100'
              : step2State.status === 'completed'
                ? 'border-violet-300'
                : step2State.status === 'failed'
                  ? 'border-rose-300'
                  : 'border-slate-200/90'
              }`}>
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-violet-500" />
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2.5 py-0.5 text-[11px] font-bold text-violet-700">
                    Step 2 • Agent 2
                  </span>
                  <div className="flex items-center gap-1.5">
                    {step2State.duration_ms !== undefined && (
                      <span className="font-mono text-[10px] font-bold text-slate-500">{step2State.duration_ms}ms</span>
                    )}
                    <StatusPill status={toAgentStatusLabel(step2State.status)} />
                  </div>
                </div>

                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-base font-bold text-slate-900">
                      Collection Evidence &amp; History Analyst
                    </h4>
                    <span className="font-mono text-[10px] text-slate-400">agt_fees_evidence_analyst</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setInspectingEsoAgent(inspectingEsoAgent === 'agent_2' ? null : 'agent_2')}
                    className="rounded-lg bg-violet-50 px-2 py-1 text-[10px] font-bold text-violet-700 hover:bg-violet-100 transition shrink-0"
                  >
                    ESO Inspect
                  </button>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  <strong>Responsibility:</strong> Checks line-item fee heads, recent payments, and prior reminder logs to separate eligible families from those held back by the {cooldownDays}-day cooldown.
                </p>

                <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-2.5 text-[11px] text-slate-700">
                  <span className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">Input Received (from Agent 1)</span>
                  {step2State.step_result?.output?.records_received !== undefined
                    ? `${step2State.step_result.output.records_received} candidate(s) · Cooldown: ${cooldownDays}d · Evidence Limit: ${evidenceLimit}`
                    : `Awaiting candidates from Agent 1 · Cooldown: ${cooldownDays}d`}
                </div>

                <div>
                  <span className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Database Tables Accessed</span>
                  <div className="flex flex-wrap gap-1">
                    {(step2State.step_result?.output?.tables_accessed ?? ['fees_collect', 'fees_paid_other', 'fees_breackoff', 'fees_title', 'ai_audit_logs', 'tblstudent']).map((tbl) => (
                      <span key={tbl} className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-slate-700">
                        {tbl}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Distinct Processing Breakdown */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-100">
                    <span className="text-[10px] text-slate-500 block">Fetched (Logs &amp; Heads)</span>
                    <strong className="text-sm font-extrabold text-slate-900">
                      {step2State.step_result?.output?.records_fetched ?? '—'}
                    </strong>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-100">
                    <span className="text-[10px] text-slate-500 block">Processed</span>
                    <strong className="text-sm font-extrabold text-violet-700">
                      {step2State.step_result?.output?.records_processed ?? '—'}
                    </strong>
                  </div>
                  <div className="rounded-xl bg-emerald-50/60 p-2.5 border border-emerald-100">
                    <span className="text-[10px] text-emerald-800 block">Eligible (Cleared)</span>
                    <strong className="text-sm font-extrabold text-emerald-900">
                      {step2State.status === 'completed' ? (step2State.eligibleCount ?? 0) : '—'}
                    </strong>
                  </div>
                  <div className="rounded-xl bg-amber-50/60 p-2.5 border border-amber-100">
                    <span className="text-[10px] text-amber-800 block">Held Back (Cooldown)</span>
                    <strong className="text-sm font-extrabold text-amber-900">
                      {step2State.status === 'completed' ? (step2State.heldBackCount ?? 0) : '—'}
                    </strong>
                  </div>
                </div>

                <div className="rounded-xl border border-violet-100 bg-violet-50/40 p-2.5 text-[11px] text-violet-950 flex items-center justify-between">
                  <span className="font-semibold">Passed to Agent 3:</span>
                  <strong className="font-extrabold">
                    {step2State.status === 'completed' ? `${step2State.eligibleCount ?? 0} eligible` : '—'}
                  </strong>
                </div>

                {step2State.summary && (
                  <p className="text-[11px] text-slate-600 leading-snug">{step2State.summary}</p>
                )}

                {step2State.error && (
                  <div className="rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-800">
                    <strong>Halt Error:</strong> {step2State.error}
                  </div>
                )}

                {(step2State.step_result?.actions?.length || step2State.gate) && (
                  <div>
                    <button
                      type="button"
                      onClick={() => setExpandedTraceAgent(expandedTraceAgent === 'agent_2' ? null : 'agent_2')}
                      className="text-[11px] font-bold text-violet-700 hover:text-violet-900 underline"
                    >
                      {expandedTraceAgent === 'agent_2' ? 'Hide Execution & Gate Checks ▲' : 'View Execution & Gate 2 Checks ▼'}
                    </button>
                    {expandedTraceAgent === 'agent_2' && (
                      <div className="mt-2 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-[11px]">
                        {step2State.step_result?.actions?.map((act, i) => (
                          <div key={i} className="flex items-start gap-1.5">
                            <span className={act.success ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>
                              {act.success ? '✓' : '✕'}
                            </span>
                            <div>
                              <span className="font-mono font-bold text-slate-800">{act.tool || act.type}</span>
                              {act.duration_ms !== undefined && <span className="ml-1 text-slate-400">({act.duration_ms}ms)</span>}
                              <p className="text-slate-600">{act.summary}</p>
                            </div>
                          </div>
                        ))}
                        {step2State.gate && (
                          <div className="border-t border-slate-200 pt-1.5 space-y-1">
                            <span className="font-bold text-slate-700 block">
                              {step2State.gate.gate} ({step2State.gate.passed_checks}/{step2State.gate.total_checks} checks · {step2State.gate.score}%)
                            </span>
                            {Object.entries(step2State.gate.checks || {}).map(([k, v]) => (
                              <div key={k} className="flex items-start gap-1.5 text-[10px]">
                                <span className={v.status === 'passed' ? 'text-emerald-600' : 'text-rose-600'}>●</span>
                                <span className="text-slate-600"><strong>{k.replace(/_/g, ' ')}:</strong> {v.message}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Tool: fees.getPending + reminder_history</span>
                <span className="font-bold text-violet-700 flex items-center gap-1">
                  Handoff to Agent 3 <ArrowRight className="size-3" />
                </span>
              </div>

              {inspectingEsoAgent === 'agent_2' && (
                <div className="mt-3">
                  <AgentEsoCard agentKey="agent_2" agentDetail={eso?.agents?.agent_2} />
                </div>
              )}
            </div>

            {/* STEP 3 · AGENT 3: Fee Reminder Drafter */}
            <div className={`rounded-2xl border bg-white p-5 shadow-xs relative overflow-hidden flex flex-col justify-between transition-all ${step3State.status === 'running'
              ? 'border-emerald-400 ring-2 ring-emerald-100'
              : step3State.status === 'completed'
                ? 'border-emerald-300'
                : step3State.status === 'failed'
                  ? 'border-rose-300'
                  : 'border-slate-200/90'
              }`}>
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-emerald-500" />
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
                    Step 3 • Agent 3
                  </span>
                  <div className="flex items-center gap-1.5">
                    {step3State.duration_ms !== undefined && (
                      <span className="font-mono text-[10px] font-bold text-slate-500">{step3State.duration_ms}ms</span>
                    )}
                    <StatusPill status={toAgentStatusLabel(step3State.status)} />
                  </div>
                </div>

                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-base font-bold text-slate-900">
                      Fee Reminder Drafter
                    </h4>
                    <span className="font-mono text-[10px] text-slate-400">agt_fees_reminder_drafter</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setInspectingEsoAgent(inspectingEsoAgent === 'agent_3' ? null : 'agent_3')}
                    className="rounded-lg bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700 hover:bg-emerald-100 transition shrink-0"
                  >
                    ESO Inspect
                  </button>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  <strong>Responsibility:</strong> Validates parent contacts, drafts personalized reminder previews with a SHA-256 approval lock, and holds all sends until an administrator approves.
                </p>

                <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-2.5 text-[11px] text-slate-700">
                  <span className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">Input Received (from Agent 2)</span>
                  {step3State.step_result?.output?.records_received !== undefined
                    ? `${step3State.step_result.output.records_received} eligible student(s) · Channel: ${reminderChannel.toUpperCase()}`
                    : `Awaiting eligible students from Agent 2 · Channel: ${reminderChannel.toUpperCase()}`}
                </div>

                <div>
                  <span className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Database Tables Accessed / Written</span>
                  <div className="flex flex-wrap gap-1">
                    {(step3State.step_result?.output?.tables_accessed ?? ['tblstudent', 'sms_api_details', 'ai_audit_logs', 'ai_agent_runs', 'fees_agent_state']).map((tbl) => (
                      <span key={tbl} className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-slate-700">
                        {tbl}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Distinct Processing Breakdown */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-100">
                    <span className="text-[10px] text-slate-500 block">Fetched (Contacts)</span>
                    <strong className="text-sm font-extrabold text-slate-900">
                      {step3State.step_result?.output?.records_fetched ?? '—'}
                    </strong>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-100">
                    <span className="text-[10px] text-slate-500 block">Processed</span>
                    <strong className="text-sm font-extrabold text-emerald-700">
                      {step3State.step_result?.output?.records_processed ?? '—'}
                    </strong>
                  </div>
                  <div className="rounded-xl bg-emerald-50/60 p-2.5 border border-emerald-100">
                    <span className="text-[10px] text-emerald-800 block">Eligible (Drafted)</span>
                    <strong className="text-sm font-extrabold text-emerald-900">
                      {step3State.status === 'completed' ? (step3State.recipientsCount ?? 0) : '—'}
                    </strong>
                  </div>
                  <div className="rounded-xl bg-amber-50/60 p-2.5 border border-amber-100">
                    <span className="text-[10px] text-amber-800 block">Held Back (Unreachable)</span>
                    <strong className="text-sm font-extrabold text-amber-900">
                      {step3State.step_result?.output?.held_back_count ?? '—'}
                    </strong>
                  </div>
                </div>

                <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-2.5 text-[11px] text-emerald-950 flex items-center justify-between">
                  <span className="font-semibold">Sent Automatically:</span>
                  <strong className="font-extrabold">
                    {dispatchResult ? `${dispatchResult.sent} Dispatched` : '0 (Awaiting Approval)'}
                  </strong>
                </div>

                {step3State.summary && (
                  <p className="text-[11px] text-slate-600 leading-snug">{step3State.summary}</p>
                )}

                {step3State.error && (
                  <div className="rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-800">
                    <strong>Halt Error:</strong> {step3State.error}
                  </div>
                )}

                {(step3State.step_result?.actions?.length || step3State.gate) && (
                  <div>
                    <button
                      type="button"
                      onClick={() => setExpandedTraceAgent(expandedTraceAgent === 'agent_3' ? null : 'agent_3')}
                      className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 underline"
                    >
                      {expandedTraceAgent === 'agent_3' ? 'Hide Execution & Gate Checks ▲' : 'View Execution & Gate 3 Checks ▼'}
                    </button>
                    {expandedTraceAgent === 'agent_3' && (
                      <div className="mt-2 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-[11px]">
                        {step3State.step_result?.actions?.map((act, i) => (
                          <div key={i} className="flex items-start gap-1.5">
                            <span className={act.success ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>
                              {act.success ? '✓' : '✕'}
                            </span>
                            <div>
                              <span className="font-mono font-bold text-slate-800">{act.tool || act.type}</span>
                              {act.duration_ms !== undefined && <span className="ml-1 text-slate-400">({act.duration_ms}ms)</span>}
                              <p className="text-slate-600">{act.summary}</p>
                            </div>
                          </div>
                        ))}
                        {step3State.gate && (
                          <div className="border-t border-slate-200 pt-1.5 space-y-1">
                            <span className="font-bold text-slate-700 block">
                              {step3State.gate.gate} ({step3State.gate.passed_checks}/{step3State.gate.total_checks} checks · {step3State.gate.score}%)
                            </span>
                            {Object.entries(step3State.gate.checks || {}).map(([k, v]) => (
                              <div key={k} className="flex items-start gap-1.5 text-[10px]">
                                <span className={v.status === 'passed' ? 'text-emerald-600' : 'text-rose-600'}>●</span>
                                <span className="text-slate-600"><strong>{k.replace(/_/g, ' ')}:</strong> {v.message}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Tool: fees.send_reminders (preview)</span>
                <span className="font-bold text-emerald-700 flex items-center gap-1">
                  Human Sign-off Gate
                </span>
              </div>

              {(step3State.fingerprint || reminder?.fingerprint) && (
                <button
                  type="button"
                  onClick={() => {
                    setShowApprovalModal(true);
                    setDispatchResult(null);
                    setDispatchError(null);
                    setConfirmationChecked(false);
                  }}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-500"
                >
                  <Send className="size-3.5" />
                  Review &amp; Approve Reminders
                </button>
              )}

              {inspectingEsoAgent === 'agent_3' && (
                <div className="mt-3">
                  <AgentEsoCard agentKey="agent_3" agentDetail={eso?.agents?.agent_3} />
                </div>
              )}
            </div>
          </div>

          {/* ── 2. AGENT-TO-AGENT HANDOFFS & DATA FLOW ── */}
          <FeesHandoffFlowSection
            latestReport={latestReport}
            step1={step1State}
            step2={step2State}
            step3={step3State}
          />

          {/* ── 4. FINAL RESULTS, STORAGE LOCATIONS & ACTIONS AWAITING APPROVAL ── */}
          <FeesFinalResultsSection
            latestReport={latestReport}
            state={state}
            dispatchResult={dispatchResult}
            onOpenApprovalModal={() => {
              setShowApprovalModal(true);
              setDispatchResult(null);
              setDispatchError(null);
              setConfirmationChecked(false);
            }}
          />
        </div>
      )}

      {/* ── HUMAN APPROVAL & DISPATCH MODAL ── */}
      {showApprovalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800">
                  <ShieldCheck className="size-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Administrator Review & Fingerprint Approval
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Verify reminder recipients and amounts before authorizing dispatch.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowApprovalModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="overflow-y-auto p-6 space-y-5 flex-1">
              {dispatchResult ? (
                /* Post-Send Delivery Report */
                <div className="space-y-5">
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 text-emerald-900 flex items-start gap-3">
                    <CheckCircle2 className="size-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-bold">Reminders Dispatched Successfully</h4>
                      <p className="text-xs text-emerald-800 mt-1">
                        Dispatch reference: <strong className="font-mono">{dispatchResult.reference}</strong> • Dispatched via <strong className="uppercase">{dispatchResult.channel}</strong>
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Accepted / Sent</span>
                      <div className="text-xl font-black text-emerald-600 mt-1">{dispatchResult.sent}</div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Failed</span>
                      <div className="text-xl font-black text-rose-600 mt-1">{dispatchResult.failed}</div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Skipped</span>
                      <div className="text-xl font-black text-amber-600 mt-1">{dispatchResult.skipped}</div>
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-left text-xs text-slate-600">
                      <thead className="bg-slate-50 text-[11px] font-bold uppercase text-slate-500">
                        <tr>
                          <th className="px-4 py-2.5">Student</th>
                          <th className="px-4 py-2.5 text-right">Reminder Amount</th>
                          <th className="px-4 py-2.5">Status</th>
                          <th className="px-4 py-2.5">Gateway Response</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {dispatchResult.results.map((r, i) => (
                          <tr key={i}>
                            <td className="px-4 py-2.5 font-semibold text-slate-900">{r.name}</td>
                            <td className="px-4 py-2.5 text-right font-bold text-slate-800">
                              {formatRupees(r.outstanding)}
                              {r.is_custom_amount && (
                                <span className="ml-1 text-[10px] font-normal text-indigo-600">(Custom)</span>
                              )}
                            </td>
                            <td className="px-4 py-2.5">
                              <span
                                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${r.status === 'sent'
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : r.status === 'failed'
                                    ? 'bg-rose-50 text-rose-700'
                                    : 'bg-amber-50 text-amber-700'
                                  }`}
                              >
                                {r.status}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-[11px] text-slate-500">{r.detail}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                /* Pre-Send Review & Approval */
                <div className="space-y-5">
                  {dispatchError && (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-900 flex items-start gap-2">
                      <AlertCircle className="size-4 text-rose-600 shrink-0 mt-0.5" />
                      <div>
                        <strong>Dispatch stopped:</strong> {dispatchError}
                      </div>
                    </div>
                  )}

                  {/* Summary Strip */}
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
                    <div>
                      <span className="text-slate-400 text-[10px] uppercase font-bold">Channel</span>
                      <div className="font-bold text-indigo-700 mt-0.5">
                        {reminderChannel === 'email' ? 'Email Notice' : reminderChannel === 'sms' ? 'SMS Text' : 'WhatsApp Message'}
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] uppercase font-bold">Payment Deadline</span>
                      <div className="font-bold text-slate-800 mt-0.5">{reminder?.deadline || '7 Days'}</div>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] uppercase font-bold">Recipients</span>
                      <div className="font-bold text-emerald-700 mt-0.5">{reminder?.recipient_count ?? 0} Students</div>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] uppercase font-bold">Total Dues</span>
                      <div className="font-bold text-slate-900 mt-0.5">{formatRupees(reminder?.total_outstanding)}</div>
                    </div>
                  </div>

                  {/* Monospace Fingerprint */}
                  <div className="rounded-xl border border-slate-200 bg-slate-900 p-3.5 text-white">
                    <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                      <span className="flex items-center gap-1.5 font-bold text-indigo-300">
                        <Lock className="size-3.5" /> SHA-256 Approval Fingerprint
                      </span>
                      <span>Cryptographically Locked</span>
                    </div>
                    <div className="font-mono text-xs text-emerald-400 break-all select-all">
                      {step3State.fingerprint || reminder?.fingerprint || '—'}
                    </div>
                  </div>

                  {/* Recipients List */}
                  <div>
                    <h5 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                      Recipients & Designated Amounts
                    </h5>
                    <div className="overflow-x-auto rounded-xl border border-slate-200 max-h-48">
                      <table className="w-full text-left text-xs text-slate-600">
                        <thead className="bg-slate-50 text-[10px] font-bold uppercase text-slate-500">
                          <tr>
                            <th className="px-3 py-2">Student</th>
                            <th className="px-3 py-2">Target Contact</th>
                            <th className="px-3 py-2 text-right">Actual Outstanding</th>
                            <th className="px-3 py-2 text-right">Reminder Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {reminder?.recipients?.map((r) => (
                            <tr key={r.student_id}>
                              <td className="px-3 py-2 font-medium text-slate-900">
                                {r.name} <span className="text-slate-400 text-[10px]">({r.class || 'Class'})</span>
                              </td>
                              <td className="px-3 py-2 font-mono text-[11px] text-slate-600">
                                <div>{r.contact_masked}</div>
                                {r.is_test_contact && (
                                  <span className="mt-0.5 inline-block rounded-sm bg-purple-100 px-1 py-0.2 text-[9px] font-extrabold text-purple-800">
                                    TEST OVERRIDE ({r.contact_destination})
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-right text-rose-600 font-semibold">{formatRupees(r.actual_outstanding ?? r.outstanding)}</td>
                              <td className="px-3 py-2 text-right font-bold text-slate-900">
                                {formatRupees(r.outstanding)}
                                {r.is_custom_amount && (
                                  <span className="ml-1 rounded-sm bg-indigo-100 px-1 py-0.2 text-[9px] font-extrabold text-indigo-800">Custom</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Sample Message Preview */}
                  {reminder?.sample_message && (
                    <div>
                      <h5 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Sample Notification Draft Preview
                      </h5>
                      <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs text-slate-700 font-mono whitespace-pre-wrap leading-relaxed">
                        {reminder.sample_message}
                      </div>
                    </div>
                  )}

                  {/* Non-destructive guarantee notice */}
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 flex items-start gap-2">
                    <AlertTriangle className="size-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <strong>Audit Guarantee:</strong> Messages are dispatched directly to the student/parent via the school's configured gateway. Zero financial ledger changes will take place.
                    </div>
                  </div>

                  {/* Confirmation Checkbox */}
                  <div className="flex items-start gap-2.5 pt-2">
                    <input
                      type="checkbox"
                      id="confirm-send"
                      checked={confirmationChecked}
                      onChange={(e) => setConfirmationChecked(e.target.checked)}
                      className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <label htmlFor="confirm-send" className="text-xs font-semibold text-slate-700 cursor-pointer">
                      I have verified the recipient list, designated reminder amounts, and notification channel, and authorize sending these reminders.
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 border-t border-slate-100 bg-slate-50/50 px-6 py-4">
              {dispatchResult ? (
                <button
                  type="button"
                  onClick={() => {
                    setShowApprovalModal(false);
                    setDispatchResult(null);
                  }}
                  className="rounded-xl bg-slate-900 px-5 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-slate-800"
                >
                  Done & Close
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setShowApprovalModal(false)}
                    disabled={approvingAndSending}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-2xs transition hover:bg-slate-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleApproveAndSend}
                    disabled={!confirmationChecked || approvingAndSending}
                    className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white shadow-md transition hover:bg-emerald-500 disabled:opacity-50"
                  >
                    <Send className={`size-3.5 ${approvingAndSending ? 'animate-spin' : ''}`} />
                    {approvingAndSending ? 'Dispatching Reminders…' : 'Confirm & Dispatch Reminders'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
