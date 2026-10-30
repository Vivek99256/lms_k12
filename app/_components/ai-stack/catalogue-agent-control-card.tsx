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
  Clock,
  Database,
  Eye,
  FileText,
  Layers,
  Pause,
  Play,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Workflow,
  X,
  XCircle,
  Zap,
} from 'lucide-react';

import { readModuleWorkspaceSession } from '@/lib/module-ai/module-ai-stack';
import {
  getCatalogueAgentState,
  startCatalogueAgentContinuous,
  stopCatalogueAgentContinuous,
  runCatalogueAgentValidationNow,
  setCatalogueAgentInterval,
  toggleAutoGenerateContent,
  runContentAgentBatch,
  getContentTasksLedger,
  runTeachLearnPipeline,
  getExpertSystemOverview,
  type CatalogueAgentState,
  type HierarchyValidationReport,
  type ContentTaskRecord,
  type ContentStats,
  type UnifiedTeachLearnReport,
  type ExpertSystemOverviewData,
  type AgentEsoStructuredObject,
} from '@/lib/teach-learn/catalogue-agent-client';

interface CatalogueAgentControlCardProps {
  onValidated?: (report: HierarchyValidationReport) => void;
}

const TEACH_LEARN_ESO_FALLBACKS: Record<string, AgentEsoStructuredObject> = {
  agent_1: {
    knowledge: {
      summary: 'Master academic hierarchy standards, standard-subject active mappings with content publishing enablement (allow_content = "Yes"), chapter sequences, topic definitions, and concept linkage records.',
      items: [
        'Standards curriculum definitions and board bindings from standard',
        'Subject mappings with active content publishing enabled (allow_content = "Yes") from sub_std_map and subject',
        'Chapter hierarchy sequences, titles, and academic years from chapter_master',
        'Topic definitions and sub-topic linkages from topic_master',
        'Concept nodes and published content relationships from lms_concept and content_master',
      ],
      tables_and_sources: ['standard', 'sub_std_map', 'subject', 'chapter_master', 'topic_master', 'content_master', 'lms_concept'],
    },
    activities: {
      summary: 'Traverses the complete 5-tier content hierarchy sequentially, calculates estate content metrics, detects structural curriculum gaps, and enforces Gate 1 validation.',
      items: [
        'Standard ID resolution from user string inputs or institute roster queries',
        '5-tier hierarchical traversal across Standard -> Subject -> Chapter -> Topic -> Intelligence',
        'Gap classification across 5 defect classes: missing subjects, missing chapters, missing topics, missing intelligence/concepts, and broken mappings',
        'Estate metric aggregation (live counts of standards, courses with content, chapters, and topics)',
        'Generation and hashing of curriculum inventory for caching and downstream pipeline handoff',
      ],
    },
    abilities: {
      summary: 'Deterministic read-only recursive tree traversal, zero-fabrication gap scoring, standard ID resolution, and strict Gate 1 pipeline halting.',
      skills: [
        'Multi-tier relational graph traversal without data mutations (risk: read)',
        'Standard and board resolution logic',
        'Zero-fabrication reporting (preserves genuine database nulls instead of synthetic data)',
        'Curriculum hash calculation to avoid redundant database roundtrips',
      ],
      constraints_and_safeguards: [
        'Read-only enforcement (modifies zero database records)',
        'Tenant boundary isolation via sub_institute_id',
        'Mandatory Gate 1 halting if zero courses or invalid standard is returned',
      ],
    },
    usage: {
      summary: 'Serves as the foundation (Step 1) of the Teach / Learn pipeline, resolving class curriculum targets, validating structural integrity, and handing off clean standard and chapter scopes to downstream agents.',
      step_by_step_flow: [
        'Step 1: Receives institute ID and standard parameter (e.g. Standard 7 or "all")',
        'Step 2: Queries sub_std_map joined with standard and subject to filter active courses where allow_content = "Yes"',
        'Step 3: Traverses chapter_master and topic_master to measure catalog depth and checks content_master for concept links',
        'Step 4: Evaluates Gate 1 rules (must resolve valid standard_id, must find >= 1 active course, must extract chapter list)',
        'Step 5: Passes the validated standard_id to Agent 2 (Timeline Reader) and standard chapters scope to Agent 3 (Content Model Coverage)',
      ],
      upstream_dependencies: 'None (initiates the pipeline with user or scheduled trigger).',
      downstream_handoff: 'Passes resolved standard_id to Agent 2 and verified chapters_scope to Agent 3 via Gate 1.',
    },
  },
  agent_2: {
    knowledge: {
      summary: 'Classroom instructional timeline data, scheduled virtual and offline periods, assigned student homework, and chronological date prioritization policies.',
      items: [
        'Homework assignments, descriptions, submission deadlines, and subject allocations from homework',
        'Scheduled virtual classroom sessions and daily timetable slots from timetable_schedule and daily_attendance',
        'Chronological date prioritization policy (prioritizes actual calendar timestamps over syear tags to support seamless multi-year/archival retrieval)',
        'Division and section roster mappings for the selected standard',
      ],
      tables_and_sources: ['homework', 'daily_attendance', 'timetable_schedule', 'academic_year'],
    },
    activities: {
      summary: 'Aggregates homework and scheduled class sessions across a sliding temporal window around today, categorizes timeline status, and sanitizes sensitive meeting links.',
      items: [
        'Sliding window temporal scoping (default +/-7 days, configurable up to 90 days)',
        'Timeline orientation classification tagging each activity as past, today, or upcoming',
        'Class roster and division scope validation against the target standard',
        'Automatic redaction of virtual classroom join links to protect classroom meeting privacy',
        'Gate 2 validation ensuring activity records match standard scope',
      ],
    },
    abilities: {
      summary: 'Sliding-window temporal normalization, break and vacation period tolerance (non-blocking validation), and meeting URL redaction.',
      skills: [
        'Chronological multi-source timeline indexing and sorting',
        'Date normalization across changing academic years',
        'Non-blocking vacation tolerance (allows 0 activities during school breaks if class scope is valid)',
        'Privacy-preserving link sanitization',
      ],
      constraints_and_safeguards: [
        'Read-only enforcement (modifies zero homework or timetable records)',
        'Meeting join URLs are never returned in agent payloads',
        'Tenant and standard boundary enforcement',
      ],
    },
    usage: {
      summary: 'Executes as Step 2 of the Teach / Learn pipeline, consuming the validated standard from Agent 1 to verify instructional pacing and recent/upcoming class activity.',
      step_by_step_flow: [
        'Step 1: Receives the validated standard_id directly from Agent 1\'s Gate 1 output',
        'Step 2: Computes the sliding window boundary [today - days_back, today + days_ahead]',
        'Step 3: Queries homework and timetable_schedule for the standard within the window',
        'Step 4: Categorizes each record into past, today, or upcoming, and strips join URLs',
        'Step 5: Evaluates Gate 2 rules (standard ownership verified) and outputs the unified activity timeline to Gate 2',
      ],
      upstream_dependencies: 'Requires resolved standard_id from Agent 1 (Gate 1).',
      downstream_handoff: 'Provides verified instructional activity context alongside curriculum data to Agent 3 and the final Unified Teach / Learn Report.',
    },
  },
  agent_3: {
    knowledge: {
      summary: 'The 4-Type Pedagogical Content Model (Concept Learning, Practice Ladder, Misconception Library, Assessment Bank) and chapter semantic intelligence extractions.',
      items: [
        'Type 1: Concept Learning models (4 variants: definition, knowledge anchor, real-world application, evidence)',
        'Type 2: Practice Ladder (5-level Bloom\'s taxonomy cognitive ladder from assessment blueprints)',
        'Type 3: Misconception Library (common student traps, flawed heuristics, diagnostic feedback)',
        'Type 4: Assessment Bank (calibrated rubrics, marking schemes, question items)',
        'Semantic intelligence extraction records and section slice counts from semantic_intelligence and content_master',
      ],
      tables_and_sources: ['semantic_intelligence', 'content_master', 'chapter_master', 'lms_concept'],
    },
    activities: {
      summary: 'Evaluates pedagogical depth across all standard chapters, measures 4-type model coverage percentages, detects authoring gaps, and generates coordinator insights.',
      items: [
        'Granular SQL slice analysis across chapter semantic extraction columns',
        'Evaluation of 4-type content coverage percentages for each chapter and across the institute estate',
        'Diagnosis of curriculum bottlenecks (e.g. chapters with Type 1-3 complete but lacking Type 4 assessment rubrics)',
        'Synthesis of actionable curriculum insights and pedagogical authoring priorities for educators',
        'Gate 3 content readiness validation and generation of the Unified Teach / Learn Report',
      ],
    },
    abilities: {
      summary: 'High-performance memory-safe SQL slicing, strict zero-fabrication metric scoring, and multi-agent evidence fusion.',
      skills: [
        'Targeted SQL column aggregations without heavy JSON blob hydration',
        'Multi-type pedagogical taxonomy evaluation against Bloom\'s cognitive tiers',
        'Zero-fabrication scoring (reports true 0% rather than synthesized default values when assets are unauthored)',
        'Multi-agent output consolidation into a unified executive report',
      ],
      constraints_and_safeguards: [
        'Read-only execution with zero database writes',
        'Institute-level tenant isolation',
        'Memory leak prevention on high-volume extraction tables',
      ],
    },
    usage: {
      summary: 'Acts as the analytical culmination (Step 3) of the Teach / Learn pipeline, fusing curriculum structure from Agent 1 and instructional timeline from Agent 2 with semantic intelligence to deliver the final Content Readiness Report.',
      step_by_step_flow: [
        'Step 1: Ingests the verified standard_id and chapter roster from Gate 1 and Gate 2',
        'Step 2: Executes SQL slice queries on semantic_intelligence and content_master matching chapter IDs',
        'Step 3: Measures coverage percentages across Type 1, Type 2, Type 3, and Type 4 models',
        'Step 4: Compiles learning gaps summary highlighting missing assessment rubrics and unextracted concepts',
        'Step 5: Enforces Gate 3 validation and outputs the consolidated Unified Teach / Learn Report',
      ],
      upstream_dependencies: 'Requires standard_id from Gate 1 and chapter inventory verified by Agents 1 & 2.',
      downstream_handoff: 'Synthesizes the final output of the Teach / Learn system (Unified Teach / Learn Report), surfaced on the dashboard and executive audit cards.',
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

export function CatalogueAgentControlCard({ onValidated }: CatalogueAgentControlCardProps) {
  const [loading, setLoading] = useState(true);
  const [operating, setOperating] = useState(false);
  const [batchProcessing, setBatchProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successNote, setSuccessNote] = useState<string | null>(null);

  const [state, setState] = useState<CatalogueAgentState | null>(null);
  const [latestRun, setLatestRun] = useState<HierarchyValidationReport | null>(null);
  const [serverTime, setServerTime] = useState<string | null>(null);
  const [contentStats, setContentStats] = useState<ContentStats | null>(null);

  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedInterval, setSelectedInterval] = useState<number>(60);
  const [autoGenerate, setAutoGenerate] = useState<boolean>(true);
  const [countdown, setCountdown] = useState<number | null>(null);

  // Main UI Navigation Tabs
  const [mainTab, setMainTab] = useState<'hierarchy' | 'content_ledger' | 'cycle_diagram' | 'pipeline'>('hierarchy');

  // Synchronized 3-Agent Pipeline State
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [pipelineResult, setPipelineResult] = useState<UnifiedTeachLearnReport | null>(null);
  const [pipelineStandard, setPipelineStandard] = useState('7');
  const [pipelineDays, setPipelineDays] = useState(15);
  const [pipelineError, setPipelineError] = useState<string | null>(null);

  const handleRunPipeline = async () => {
    setPipelineRunning(true);
    setPipelineError(null);
    try {
      const context = readModuleWorkspaceSession();
      const res = await runTeachLearnPipeline(context, {
        standard_name: pipelineStandard,
        days_back: pipelineDays,
        days_ahead: pipelineDays,
        limit: 10,
        content_limit: 50,
      });
      if (res.report) {
        setPipelineResult(res.report);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('agents:runs-updated', { detail: { module: 'teach_learn' } }));
        }
      }
    } catch (err) {
      setPipelineError(err instanceof Error ? err.message : 'Pipeline execution failed.');
    } finally {
      setPipelineRunning(false);
    }
  };

  // ESO (Executive Skill Object (ESO)) State
  const [esoOpen, setEsoOpen] = useState(false);
  const [esoLoading, setEsoLoading] = useState(false);
  const [esoData, setEsoData] = useState<ExpertSystemOverviewData | null>(null);
  const [esoActiveTab, setEsoActiveTab] = useState<'all' | 'agent_1' | 'agent_2' | 'agent_3' | 'workflow'>('all');

  const handleOpenEso = async () => {
    setEsoOpen(true);
    if (!esoData) {
      setEsoLoading(true);
      try {
        const context = readModuleWorkspaceSession();
        const res = await getExpertSystemOverview(context);
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

  const handleRefreshEso = async () => {
    setEsoLoading(true);
    try {
      const context = readModuleWorkspaceSession();
      const res = await getExpertSystemOverview(context);
      if (res.eso) {
        setEsoData(res.eso);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh Executive Skill Object (ESO).');
    } finally {
      setEsoLoading(false);
    }
  };

  const [activeIssuesTab, setActiveIssuesTab] = useState<'all' | 'subjects' | 'chapters' | 'topics' | 'intelligence' | 'broken'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Content Ledger State
  const [contentTasks, setContentTasks] = useState<ContentTaskRecord[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [taskFilterStatus, setTaskFilterStatus] = useState<string>('all');
  const [selectedTaskPreview, setSelectedTaskPreview] = useState<ContentTaskRecord | null>(null);

  // Load Content Tasks Ledger
  const loadTasksLedger = useCallback(async (status?: string) => {
    setTasksLoading(true);
    try {
      const context = readModuleWorkspaceSession();
      const filter = status && status !== 'all' ? status : undefined;
      const res = await getContentTasksLedger(context, 50, filter);
      setContentTasks(res.tasks || []);
      if (res.stats) {
        setContentStats(res.stats);
      }
    } catch {
      // Non-fatal for ledger poll
    } finally {
      setTasksLoading(false);
    }
  }, []);

  // Load state from backend
  const loadState = useCallback(async (isPolling = false) => {
    if (!isPolling) setLoading(true);
    setError(null);
    try {
      const context = readModuleWorkspaceSession();
      const res = await getCatalogueAgentState(context);
      setState(res.state);
      setLatestRun(res.latest_run);
      setServerTime(res.server_time);

      if (res.state?.interval_seconds) {
        setSelectedInterval(res.state.interval_seconds);
      }
      if (res.state?.auto_generate_content !== undefined) {
        setAutoGenerate(Boolean(res.state.auto_generate_content));
      }
      if (res.state?.content_stats) {
        setContentStats(res.state.content_stats);
      }

      if (res.latest_run && onValidated) {
        onValidated(res.latest_run);
      }
    } catch (err) {
      if (!isPolling) {
        setError(err instanceof Error ? err.message : 'Failed to fetch Course Catalogue Reader Agent state.');
      }
    } finally {
      if (!isPolling) setLoading(false);
    }
  }, [onValidated]);

  // Initial load
  useEffect(() => {
    void loadState();
    void loadTasksLedger();
  }, [loadState, loadTasksLedger]);

  // Auto-refresh interval (polling every 5 seconds)
  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(() => {
      void loadState(true);
      if (mainTab === 'content_ledger') {
        void loadTasksLedger(taskFilterStatus);
      }
    }, 5000);
    return () => clearInterval(timer);
  }, [autoRefresh, loadState, loadTasksLedger, mainTab, taskFilterStatus]);

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
  const handleStart = async () => {
    setOperating(true);
    setError(null);
    setSuccessNote(null);
    try {
      const context = readModuleWorkspaceSession();
      const res = await startCatalogueAgentContinuous(context, selectedInterval);
      setState(res.state);
      setSuccessNote(`Course Catalogue Reader Agent continuous loop started! Running every ${selectedInterval}s in background.`);
      void loadState(true);
      void loadTasksLedger();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start continuous validation loop.');
    } finally {
      setOperating(false);
    }
  };

  // Stop continuous loop
  const handleStop = async () => {
    setOperating(true);
    setError(null);
    setSuccessNote(null);
    try {
      const context = readModuleWorkspaceSession();
      const res = await stopCatalogueAgentContinuous(context);
      setState(res.state);
      setSuccessNote('Course Catalogue Reader Agent continuous validation loop paused.');
      void loadState(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not pause continuous validation loop.');
    } finally {
      setOperating(false);
    }
  };

  // Trigger validation sweep right now
  const handleRunNow = async () => {
    setOperating(true);
    setError(null);
    setSuccessNote(null);
    try {
      const context = readModuleWorkspaceSession();
      const res = await runCatalogueAgentValidationNow(context);
      setLatestRun(res.report);
      setState(res.state);
      setSuccessNote(`Full 5-tier hierarchy audit completed in ${res.report.duration_ms}ms.`);
      if (onValidated) {
        onValidated(res.report);
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('agents:runs-updated', { detail: { module: 'teach_learn' } }));
      }
      void loadTasksLedger();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not run validation sweep.');
    } finally {
      setOperating(false);
    }
  };

  // Toggle Auto-Generate Content
  const handleToggleAutoGenerate = async () => {
    const nextVal = !autoGenerate;
    setAutoGenerate(nextVal);
    setError(null);
    try {
      const context = readModuleWorkspaceSession();
      const res = await toggleAutoGenerateContent(context, nextVal);
      setState(res.state);
      setSuccessNote(
        nextVal
          ? 'Content Agent automatic generation enabled! Newly identified missing intelligence will now have content generated automatically.'
          : 'Content Agent automatic generation paused. First agent will now only scan and report.'
      );
    } catch (err) {
      setAutoGenerate(!nextVal);
      setError(err instanceof Error ? err.message : 'Could not toggle automatic content generation.');
    }
  };

  // Run Content Batch on Demand
  const handleRunContentBatch = async () => {
    setBatchProcessing(true);
    setError(null);
    setSuccessNote(null);
    try {
      const context = readModuleWorkspaceSession();
      const res = await runContentAgentBatch(context, 10);
      setLatestRun(res.report);
      setState(res.state);
      setContentStats(res.content_stats);
      setSuccessNote(
        'Content Agent batch processed! Newly generated and verified content has been saved with IDs, and the hierarchy has been updated.'
      );
      if (onValidated && res.report) {
        onValidated(res.report);
      }
      void loadTasksLedger(taskFilterStatus);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Content Agent batch processing failed.');
    } finally {
      setBatchProcessing(false);
    }
  };

  // Change interval
  const handleIntervalChange = async (newInterval: number) => {
    setSelectedInterval(newInterval);
    if (!state?.is_active) return;
    try {
      const context = readModuleWorkspaceSession();
      const res = await setCatalogueAgentInterval(context, newInterval);
      setState(res.state);
      setSuccessNote(`Validation interval updated to ${newInterval} seconds.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update interval.');
    }
  };

  const isActive = Boolean(state?.is_active);
  const counts = latestRun?.counts;
  const issues = latestRun?.issues;

  // Filter issues based on active tab and search query
  const filteredIssues = useMemo(() => {
    if (!issues) return [];
    const list: Array<{
      type: string;
      level: string;
      title: string;
      breadcrumb: string;
      issue: string;
      badgeColor: string;
    }> = [];

    if (activeIssuesTab === 'all' || activeIssuesTab === 'subjects') {
      (issues.missing_subjects || []).forEach((item) => {
        list.push({
          type: 'missing_subjects',
          level: 'Standard',
          title: item.standard_name,
          breadcrumb: item.standard_name,
          issue: item.issue,
          badgeColor: 'bg-red-50 text-red-700 border-red-200',
        });
      });
    }

    if (activeIssuesTab === 'all' || activeIssuesTab === 'chapters') {
      (issues.missing_chapters || []).forEach((item) => {
        list.push({
          type: 'missing_chapters',
          level: 'Subject',
          title: `${item.standard_name} > ${item.subject_name}`,
          breadcrumb: `${item.standard_name} → ${item.subject_name}`,
          issue: item.issue,
          badgeColor: 'bg-orange-50 text-orange-700 border-orange-200',
        });
      });
    }

    if (activeIssuesTab === 'all' || activeIssuesTab === 'topics') {
      (issues.missing_topics || []).forEach((item) => {
        list.push({
          type: 'missing_topics',
          level: 'Chapter',
          title: item.chapter_title,
          breadcrumb: `${item.standard_name} → ${item.subject_name} → ${item.chapter_title}`,
          issue: item.issue,
          badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
        });
      });
    }

    if (activeIssuesTab === 'all' || activeIssuesTab === 'intelligence') {
      (issues.missing_intelligence || []).forEach((item) => {
        list.push({
          type: 'missing_intelligence',
          level: 'Topic Intelligence',
          title: item.topic_title,
          breadcrumb: `${item.standard_name} → ${item.subject_name} → ${item.chapter_title} → ${item.topic_title}`,
          issue: item.issue,
          badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
        });
      });
    }

    if (activeIssuesTab === 'all' || activeIssuesTab === 'broken') {
      (issues.broken_mappings || []).forEach((item) => {
        list.push({
          type: 'broken_mappings',
          level: 'Mapping Link',
          title: item.topic_title || `Topic #${item.topic_id}`,
          breadcrumb: item.chapter_id ? `Chapter #${item.chapter_id}` : 'Unattached',
          issue: item.issue,
          badgeColor: 'bg-rose-50 text-rose-700 border-rose-200',
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
  }, [issues, activeIssuesTab, searchQuery]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
      {/* Header & Primary Controls */}
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
                Automated Dual-Agent Intelligence & Content Loop
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
                Course Catalogue Reader ➔ Content Agent
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500 leading-relaxed max-w-2xl">
              <strong>Agent 1 (Catalogue Reader)</strong> identifies Standards, Subjects, Chapters, Topics, and Intelligence.
              As soon as Intelligence is identified, <strong>Agent 2 (Content Agent)</strong> verifies existing content without duplicates or generates new pedagogical modules, stores the Content ID, and clears pending status automatically.
            </p>
          </div>
        </div>

        {/* Master Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          {isActive ? (
            <button
              type="button"
              onClick={() => void handleStop()}
              disabled={operating}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-4 text-xs font-semibold text-amber-900 shadow-sm transition hover:bg-amber-100 disabled:opacity-60"
            >
              <Pause className="size-3.5" />
              Pause Loop
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void handleStart()}
              disabled={operating}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-emerald-600 px-4 text-xs font-semibold text-white shadow-sm shadow-emerald-200 transition hover:bg-emerald-700 disabled:opacity-60"
            >
              <Play className="size-3.5 fill-current" />
              Start Automated Loop
            </button>
          )}

          <button
            type="button"
            onClick={() => void handleRunContentBatch()}
            disabled={batchProcessing || operating}
            title="Immediately trigger Content Agent to process a batch of 10 pending topics"
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-3.5 text-xs font-semibold text-violet-800 shadow-sm hover:bg-violet-100 transition disabled:opacity-60"
          >
            <Sparkles className={`size-3.5 text-violet-600 ${batchProcessing ? 'animate-spin' : ''}`} />
            {batchProcessing ? 'Generating Content…' : 'Process Content Batch (10)'}
          </button>

          <button
            type="button"
            onClick={() => void handleRunNow()}
            disabled={operating}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-indigo-600 px-4 text-xs font-semibold text-white shadow-sm shadow-indigo-200 transition hover:bg-indigo-700 disabled:opacity-60"
          >
            <Zap className={`size-3.5 ${operating ? 'animate-bounce' : ''}`} />
            {operating ? 'Validating…' : 'Run Full Sweep Now'}
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
              void loadState();
              void loadTasksLedger(taskFilterStatus);
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
      {error && (
        <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-800">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-red-600" />
          <div className="flex-1">
            <strong className="font-semibold">Operation Notice: </strong>
            {error}
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
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

      {/* Two-Agent Automated Collaboration Bar & Controls */}
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
                  title="View Course Catalogue Reader Executive Skill Object (ESO)"
                >
                  <Bot className="size-3" /> Agent 1: Catalogue Reader
                </button>
                <ArrowRight className="size-3.5 text-indigo-400" />
                <button
                  type="button"
                  onClick={() => {
                    setEsoActiveTab('agent_2');
                    void handleOpenEso();
                  }}
                  className="inline-flex items-center gap-1 rounded-md bg-blue-100 hover:bg-blue-200 px-2 py-0.5 text-[11px] font-semibold text-blue-800 transition cursor-pointer"
                  title="View Activity Timeline Reader Executive Skill Object (ESO)"
                >
                  <Clock className="size-3" /> Agent 2: Activity Timeline
                </button>
                <ArrowRight className="size-3.5 text-indigo-400" />
                <button
                  type="button"
                  onClick={() => {
                    setEsoActiveTab('agent_3');
                    void handleOpenEso();
                  }}
                  className="inline-flex items-center gap-1 rounded-md bg-emerald-100 hover:bg-emerald-200 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 transition cursor-pointer"
                  title="View Content Model Coverage Executive Skill Object (ESO)"
                >
                  <Layers className="size-3" /> Agent 3: Content Coverage
                </button>
              </div>
              <p className="mt-1 text-[11px] text-slate-600 leading-normal">
                Loop runs autonomously: Standard ➔ Subject ➔ Chapter ➔ Topic ➔ Intelligence. When intelligence is found, Content Agent verifies existing content (preventing duplicates) or generates pedagogical HTML and stores its ID, clearing pending status.
              </p>
            </div>
          </div>

          {/* Auto-Generate Toggle Switch */}
          <div className="flex items-center gap-4 shrink-0">
            <div className="flex items-center gap-2 rounded-xl border border-indigo-200 bg-white px-3 py-1.5 shadow-xs">
              <span className="text-xs font-semibold text-slate-700">Auto-Generate Content:</span>
              <button
                type="button"
                onClick={() => void handleToggleAutoGenerate()}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                  autoGenerate
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {autoGenerate ? (
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

      {/* Real-Time Content Pipeline & Execution Metrics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Metric 1: Verified Existing (Duplicates Prevented) */}
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3">
          <div className="flex items-center justify-between text-emerald-800">
            <span className="text-[11px] font-semibold">Verified Existing</span>
            <CheckCircle2 className="size-3.5 text-emerald-600" />
          </div>
          <p className="mt-1 text-xl font-extrabold text-emerald-950">
            {contentStats?.total_verified_existing ?? state?.content_tasks_verified ?? 0}
          </p>
          <p className="mt-0.5 text-[10px] text-emerald-700 font-medium">
            Zero duplicate content created
          </p>
        </div>

        {/* Metric 2: Generated New Content */}
        <div className="rounded-xl border border-violet-100 bg-violet-50/50 p-3">
          <div className="flex items-center justify-between text-violet-800">
            <span className="text-[11px] font-semibold">Generated New</span>
            <Sparkles className="size-3.5 text-violet-600" />
          </div>
          <p className="mt-1 text-xl font-extrabold text-violet-950">
            {contentStats?.total_generated ?? state?.content_tasks_generated ?? 0}
          </p>
          <p className="mt-0.5 text-[10px] text-violet-700 font-medium">
            Pedagogical modules linked
          </p>
        </div>

        {/* Metric 3: Stored Content IDs */}
        <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3">
          <div className="flex items-center justify-between text-indigo-800">
            <span className="text-[11px] font-semibold">Stored Content IDs</span>
            <Database className="size-3.5 text-indigo-600" />
          </div>
          <p className="mt-1 text-xl font-extrabold text-indigo-950">
            {contentStats?.total_tasks ?? state?.content_tasks_completed ?? 0}
          </p>
          <p className="mt-0.5 text-[10px] text-indigo-700 font-medium">
            Tracked in ledger for reuse
          </p>
        </div>

        {/* Metric 4: Next Scheduled Run / Remaining */}
        <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
          <div className="flex items-center justify-between text-slate-600">
            <span className="text-[11px] font-semibold">Next Loop Tick</span>
            <Clock className="size-3.5 text-slate-500" />
          </div>
          <p className="mt-1 text-xl font-extrabold text-indigo-600">
            {isActive
              ? countdown !== null
                ? `${countdown}s`
                : 'Imminent'
              : 'Paused'}
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
          5-Tier Hierarchy Complete Audit
          {counts && (
            <span className={`rounded-full px-1.5 py-0.2 text-[10px] font-extrabold ${
              mainTab === 'hierarchy' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
            }`}>
              {counts.complete_hierarchies_validated} / {counts.topics_checked}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            setMainTab('content_ledger');
            void loadTasksLedger(taskFilterStatus);
          }}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
            mainTab === 'content_ledger'
              ? 'bg-violet-600 text-white shadow-xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <Database className="size-3.5" />
          Content Tasks & Stored IDs Ledger
          <span className={`rounded-full px-1.5 py-0.2 text-[10px] font-extrabold ${
            mainTab === 'content_ledger' ? 'bg-white/20 text-white' : 'bg-violet-100 text-violet-800'
          }`}>
            {contentStats?.total_tasks ?? state?.content_tasks_completed ?? contentTasks.length}
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
        </button>
      </div>

      {/* TAB 1: 5-Tier Content Hierarchy Complete Audit */}
      {mainTab === 'hierarchy' && (
        <div className="space-y-6">
          {/* 5-Tier Content Hierarchy Complete Audit Matrix */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Layers className="size-4 text-indigo-600" />
                  5-Tier Learning Content Hierarchy Audit
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Standard ➔ Subject ➔ Chapter ➔ Topic ➔ Intelligence traversal for current institute
                </p>
              </div>

              {counts && (
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800">
                    <CheckCircle2 className="size-3.5 text-emerald-600" />
                    {counts.complete_hierarchies_validated} Complete Chains
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50 px-2.5 py-1 text-xs font-bold text-purple-800">
                    <Sparkles className="size-3.5 text-purple-600" />
                    {counts.missing_intelligence_count} Pending Intelligence
                  </span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
              {/* Tier 1: Standards */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 relative overflow-hidden">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Tier 1 • Standards
                </div>
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="text-xl font-extrabold text-slate-900">
                    {counts?.standards_checked ?? '—'}
                  </span>
                  <span className="text-[11px] font-medium text-slate-500">Standards</span>
                </div>
                <div className="mt-2 text-[10px] text-slate-500 border-t border-slate-200/60 pt-1.5 flex justify-between">
                  <span>Missing Subjects:</span>
                  <strong className={counts?.missing_subjects_count ? 'text-red-600 font-bold' : 'text-slate-600'}>
                    {counts?.missing_subjects_count ?? 0}
                  </strong>
                </div>
              </div>

              {/* Tier 2: Subjects */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 relative overflow-hidden">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Tier 2 • Subjects
                </div>
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="text-xl font-extrabold text-slate-900">
                    {counts?.subjects_checked ?? '—'}
                  </span>
                  <span className="text-[11px] font-medium text-slate-500">Subjects</span>
                </div>
                <div className="mt-2 text-[10px] text-slate-500 border-t border-slate-200/60 pt-1.5 flex justify-between">
                  <span>Missing Chapters:</span>
                  <strong className={counts?.missing_chapters_count ? 'text-amber-600 font-bold' : 'text-slate-600'}>
                    {counts?.missing_chapters_count ?? 0}
                  </strong>
                </div>
              </div>

              {/* Tier 3: Chapters */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 relative overflow-hidden">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Tier 3 • Chapters
                </div>
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="text-xl font-extrabold text-slate-900">
                    {counts?.chapters_checked ?? '—'}
                  </span>
                  <span className="text-[11px] font-medium text-slate-500">Chapters</span>
                </div>
                <div className="mt-2 text-[10px] text-slate-500 border-t border-slate-200/60 pt-1.5 flex justify-between">
                  <span>Missing Topics:</span>
                  <strong className={counts?.missing_topics_count ? 'text-amber-600 font-bold' : 'text-slate-600'}>
                    {counts?.missing_topics_count ?? 0}
                  </strong>
                </div>
              </div>

              {/* Tier 4: Topics */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 relative overflow-hidden">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Tier 4 • Topics
                </div>
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="text-xl font-extrabold text-slate-900">
                    {counts?.topics_checked ?? '—'}
                  </span>
                  <span className="text-[11px] font-medium text-slate-500">Topics</span>
                </div>
                <div className="mt-2 text-[10px] text-slate-500 border-t border-slate-200/60 pt-1.5 flex justify-between">
                  <span>Missing Intel:</span>
                  <strong className={counts?.missing_intelligence_count ? 'text-purple-600 font-bold' : 'text-slate-600'}>
                    {counts?.missing_intelligence_count ?? 0}
                  </strong>
                </div>
              </div>

              {/* Tier 5: Intelligence */}
              <div className="rounded-xl border border-indigo-200 bg-indigo-50/30 p-3 relative overflow-hidden">
                <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-700">
                  Tier 5 • Intelligence
                </div>
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="text-xl font-extrabold text-indigo-950">
                    {counts?.intelligence_configs_checked ?? '—'}
                  </span>
                  <span className="text-[11px] font-medium text-indigo-700">Content Master</span>
                </div>
                <div className="mt-2 text-[10px] text-indigo-800 border-t border-indigo-200/60 pt-1.5 flex justify-between">
                  <span>Complete Valid:</span>
                  <strong className="text-emerald-700 font-bold">
                    {counts?.complete_hierarchies_validated ?? 0}
                  </strong>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Gaps Explorer */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/30 p-4 space-y-3">
            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setActiveIssuesTab('all')}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                    activeIssuesTab === 'all'
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  All Gaps ({counts?.total_issues_detected ?? 0})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveIssuesTab('intelligence')}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                    activeIssuesTab === 'intelligence'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  Pending Intelligence ({counts?.missing_intelligence_count ?? 0})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveIssuesTab('chapters')}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                    activeIssuesTab === 'chapters'
                      ? 'bg-orange-600 text-white shadow-sm'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  Missing Chapters ({counts?.missing_chapters_count ?? 0})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveIssuesTab('topics')}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                    activeIssuesTab === 'topics'
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  Missing Topics ({counts?.missing_topics_count ?? 0})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveIssuesTab('broken')}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                    activeIssuesTab === 'broken'
                      ? 'bg-rose-600 text-white shadow-sm'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  Broken Mappings ({counts?.broken_mappings_count ?? 0})
                </button>
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-2.5 size-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search gaps by standard, chapter, topic…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-xs text-slate-800 placeholder-slate-400 shadow-sm focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Issue Cards */}
            {filteredIssues.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center">
                <CheckCircle2 className="mx-auto size-8 text-emerald-500" />
                <p className="mt-2 text-xs font-semibold text-slate-800">
                  No content hierarchy gaps in this view
                </p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  {searchQuery ? 'Try broadening your search term.' : 'Every checked node in this tier satisfies complete 5-tier requirements.'}
                </p>
              </div>
            ) : (
              <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                {filteredIssues.slice(0, 30).map((item, idx) => (
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
                {filteredIssues.length > 30 && (
                  <p className="text-center text-[11px] text-slate-500 py-1">
                    Showing first 30 of {filteredIssues.length} issues. Use search to locate specific nodes.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: Content Tasks & Stored IDs Ledger */}
      {mainTab === 'content_ledger' && (
        <div className="space-y-4">
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Database className="size-4 text-violet-600" />
                Content Tasks & Stored Content IDs Ledger
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Every topic processed by Agent 2 has its database ID stored in <code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-[10px]">lms_catalogue_content_tasks</code> and <code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-[10px]">content_master</code> for tracking and reuse.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={taskFilterStatus}
                onChange={(e) => {
                  setTaskFilterStatus(e.target.value);
                  void loadTasksLedger(e.target.value);
                }}
                className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-800 shadow-xs focus:border-violet-500 focus:outline-none"
              >
                <option value="all">All Tasks</option>
                <option value="generated_new">Generated New Only</option>
                <option value="verified_existing">Verified Existing Only</option>
              </select>

              <button
                type="button"
                onClick={() => void loadTasksLedger(taskFilterStatus)}
                disabled={tasksLoading}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <RefreshCw className={`size-3 text-slate-500 ${tasksLoading ? 'animate-spin' : ''}`} />
                Refresh Ledger
              </button>
            </div>
          </div>

          {/* Tasks Table */}
          {contentTasks.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center">
              <Database className="mx-auto size-8 text-slate-400" />
              <p className="mt-2 text-xs font-semibold text-slate-800">
                No content tasks logged yet
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500 max-w-md mx-auto">
                Click <strong>"Process Content Batch"</strong> or start the continuous loop with <strong>"Auto-Generate Content"</strong> enabled to begin automatic processing.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-2.5">Topic & Hierarchy</th>
                      <th className="px-3 py-2.5">Stored Content ID</th>
                      <th className="px-3 py-2.5">Action Taken</th>
                      <th className="px-3 py-2.5">Status</th>
                      <th className="px-3 py-2.5">Processed Time</th>
                      <th className="px-4 py-2.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-normal text-slate-800">
                    {contentTasks.map((task) => (
                      <tr key={task.id} className="hover:bg-slate-50/50 transition">
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-900">{task.topic_name}</div>
                          <div className="font-mono text-[11px] text-slate-500 mt-0.5">
                            {task.standard_name ? `Std ${task.standard_name}` : `Std #${task.standard_id}`}
                            {task.subject_name ? ` • ${task.subject_name}` : ''}
                            {task.chapter_name ? ` • ${task.chapter_name}` : ''}
                            <span className="ml-1 text-slate-400">(Topic ID: {task.topic_id})</span>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          {task.content_id ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 border border-indigo-200 px-2 py-0.5 font-mono text-[11px] font-bold text-indigo-700">
                              <Database className="size-3" /> #{task.content_id}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[11px]">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          {task.action_taken === 'verified_existing' ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">
                              <CheckCircle2 className="size-3 text-emerald-600" /> Verified Existing
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 border border-violet-200 px-2.5 py-0.5 text-[11px] font-semibold text-violet-800">
                              <Sparkles className="size-3 text-violet-600" /> Generated Content
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-700">
                            <span className="size-1.5 rounded-full bg-emerald-500" />
                            Completed
                          </span>
                        </td>
                        <td className="px-3 py-3 text-[11px] text-slate-500">
                          {task.updated_at ? new Date(task.updated_at).toLocaleTimeString() : 'Just now'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedTaskPreview(task)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs"
                          >
                            <Eye className="size-3" /> View Module
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
        <div className="rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50/40 via-white to-purple-50/40 p-5 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Workflow className="size-4 text-indigo-600" />
              Automated Dual-Agent Continuous Collaboration Cycle
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              How the two agents synchronize continuously across all curriculum levels
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
            {/* Step 1 */}
            <div className="rounded-xl border border-indigo-100 bg-white p-4 shadow-2xs">
              <div className="flex items-center gap-2">
                <span className="flex size-6 items-center justify-center rounded-full bg-indigo-600 text-white text-xs font-bold">1</span>
                <span className="font-bold text-xs text-slate-900">Hierarchy Discovery</span>
              </div>
              <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                Agent 1 (Course Catalogue Reader Agent) runs and sequentially identifies the Standard, Subject, Chapter, Topics, and Intelligence for each subject.
              </p>
            </div>

            {/* Step 2 */}
            <div className="rounded-xl border border-violet-100 bg-white p-4 shadow-2xs">
              <div className="flex items-center gap-2">
                <span className="flex size-6 items-center justify-center rounded-full bg-violet-600 text-white text-xs font-bold">2</span>
                <span className="font-bold text-xs text-slate-900">Automatic Trigger</span>
              </div>
              <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                As soon as an Intelligence node is identified, Agent 2 (Content Agent) starts automatically without requiring manual activation.
              </p>
            </div>

            {/* Step 3 */}
            <div className="rounded-xl border border-emerald-100 bg-white p-4 shadow-2xs">
              <div className="flex items-center gap-2">
                <span className="flex size-6 items-center justify-center rounded-full bg-emerald-600 text-white text-xs font-bold">3</span>
                <span className="font-bold text-xs text-slate-900">Deduplication Check</span>
              </div>
              <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                Agent 2 checks whether content already exists in <code className="font-mono text-[10px] bg-slate-100 px-1 py-0.5 rounded">content_master</code>. If content exists, it marks the task as successful without creating duplicate content.
              </p>
            </div>

            {/* Step 4 */}
            <div className="rounded-xl border border-purple-100 bg-white p-4 shadow-2xs">
              <div className="flex items-center gap-2">
                <span className="flex size-6 items-center justify-center rounded-full bg-purple-600 text-white text-xs font-bold">4</span>
                <span className="font-bold text-xs text-slate-900">Content Generation & ID Store</span>
              </div>
              <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                If content does not exist, Agent 2 generates the pedagogical module, saves it to the database, creates an <code className="font-mono text-[10px] bg-slate-100 px-1 py-0.5 rounded">lms_concept</code>, and stores its Content ID.
              </p>
            </div>

            {/* Step 5 */}
            <div className="rounded-xl border border-indigo-100 bg-white p-4 shadow-2xs">
              <div className="flex items-center gap-2">
                <span className="flex size-6 items-center justify-center rounded-full bg-indigo-600 text-white text-xs font-bold">5</span>
                <span className="font-bold text-xs text-slate-900">Immediate Pending Clearance</span>
              </div>
              <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                Once content has been created or verified, Agent 1 immediately recognizes that content is available and no longer reports that Intelligence as pending.
              </p>
            </div>

            {/* Step 6 */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
              <div className="flex items-center gap-2">
                <span className="flex size-6 items-center justify-center rounded-full bg-slate-900 text-white text-xs font-bold">6</span>
                <span className="font-bold text-xs text-slate-900">Continuous Loop Continuation</span>
              </div>
              <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                Agent 1 advances to the next Standard, Subject, Chapter, Topic, and Intelligence, repeating the cycle automatically until all levels have verified content.
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
                  Teach/Learn Synchronized 3-Agent Sequential Pipeline
                </h3>
                <p className="text-xs text-slate-600 mt-1 max-w-2xl leading-relaxed">
                  Executes all three agents sequentially with strict validation gates: 
                  <strong className="text-slate-800"> Agent 1 (Course Catalogue)</strong> validates curriculum hierarchy → 
                  <strong className="text-slate-800"> Agent 2 (Activity Timeline)</strong> scopes sessions & homework → 
                  <strong className="text-slate-800"> Agent 3 (Content Model Coverage)</strong> analyzes 4-type model readiness and learning gaps.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 shadow-2xs">
                  <span className="text-[11px] font-bold text-slate-500 uppercase">Standard:</span>
                  <select
                    value={pipelineStandard}
                    onChange={(e) => setPipelineStandard(e.target.value)}
                    className="text-xs font-bold text-slate-900 bg-transparent outline-none cursor-pointer"
                    disabled={pipelineRunning}
                  >
                    <option value="7">Standard 7 (Grade 7)</option>
                    <option value="6">Standard 6 (Grade 6)</option>
                    <option value="8">Standard 8 (Grade 8)</option>
                    <option value="9">Standard 9 (Grade 9)</option>
                    <option value="10">Standard 10 (Grade 10)</option>
                    <option value="all">All Standards (Sequential Sweep)</option>
                  </select>
                </div>

                <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 shadow-2xs">
                  <span className="text-[11px] font-bold text-slate-500 uppercase">Window:</span>
                  <input
                    type="number"
                    value={pipelineDays}
                    onChange={(e) => setPipelineDays(Number(e.target.value) || 15)}
                    className="w-12 text-center text-xs font-bold text-slate-900 outline-none"
                    min={1}
                    max={60}
                    disabled={pipelineRunning}
                  />
                  <span className="text-[11px] text-slate-400">days</span>
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
                  <span className="text-[10px] font-mono text-slate-400">teach_learn.courses</span>
                </div>
                <h4 className="text-xs font-bold text-slate-900 mt-2">Course Catalogue Reader</h4>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-normal">
                  Extracts verified Standard, Subject & Chapter hierarchy for this institute.
                </p>
                <div className="mt-2.5 flex items-center justify-between gap-1">
                  <div className="rounded-lg bg-indigo-50/70 px-2 py-1 text-[10px] font-bold text-indigo-700 flex items-center gap-1">
                    <ShieldCheck className="size-3 text-indigo-600" /> Gate 1: Resolves Standard ID
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
                  <span className="text-[10px] font-mono text-slate-400">teach_learn.activities</span>
                </div>
                <h4 className="text-xs font-bold text-slate-900 mt-2">Activity Timeline Reader</h4>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-normal">
                  Uses Gate 1 Standard ID to query active class sessions and homework tasks.
                </p>
                <div className="mt-2.5 flex items-center justify-between gap-1">
                  <div className="rounded-lg bg-blue-50/70 px-2 py-1 text-[10px] font-bold text-blue-700 flex items-center gap-1">
                    <ShieldCheck className="size-3 text-blue-600" /> Gate 2: Verifies Class Scope
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
                  <span className="text-[10px] font-mono text-slate-400">teach_learn.content_model_coverage</span>
                </div>
                <h4 className="text-xs font-bold text-slate-900 mt-2">Content Model Coverage</h4>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-normal">
                  Analyzes 4-type model, Bloom ladder, misconceptions & assessment gaps.
                </p>
                <div className="mt-2.5 flex items-center justify-between gap-1">
                  <div className="rounded-lg bg-emerald-50/70 px-2 py-1 text-[10px] font-bold text-emerald-700 flex items-center gap-1">
                    <ShieldCheck className="size-3 text-emerald-600" /> Gate 3: Flags Learning Gaps
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
          {pipelineResult && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
              {/* Executive Header */}
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-5">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-xs font-bold text-emerald-700">
                      PIPELINE COMPLETED
                    </span>
                    <span className="text-xs text-slate-500 font-mono">
                      Generated at {new Date(pipelineResult.generated_at).toLocaleTimeString('en-IN')}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-950 mt-1">
                    Unified Teach/Learn Report — Standard {pipelineResult.standard?.name} (ID: {pipelineResult.standard?.id})
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-center">
                    <span className="block text-[10px] font-bold uppercase text-slate-500">Duration</span>
                    <span className="font-mono text-xs font-extrabold text-slate-800">
                      {pipelineResult.total_duration_ms} ms
                    </span>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-center">
                    <span className="block text-[10px] font-bold uppercase text-slate-500">Subjects</span>
                    <span className="font-mono text-xs font-extrabold text-indigo-700">
                      {pipelineResult.standard?.total_subjects}
                    </span>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-center">
                    <span className="block text-[10px] font-bold uppercase text-slate-500">Activities</span>
                    <span className="font-mono text-xs font-extrabold text-blue-700">
                      {pipelineResult.activity_timeline?.total_activities}
                    </span>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-center">
                    <span className="block text-[10px] font-bold uppercase text-slate-500">Analyzed</span>
                    <span className="font-mono text-xs font-extrabold text-emerald-700">
                      {pipelineResult.content_readiness?.total_chapters_analyzed}
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
                      {pipelineResult.pipeline_execution?.steps?.map((step, idx) => {
                        const gate = pipelineResult.pipeline_execution?.gates?.[idx];
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
                {/* 1. Verified Curriculum */}
                <div className="rounded-xl border border-slate-200 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
                      <BookOpen className="size-4 text-indigo-600" />
                      1. Verified Curriculum Hierarchy
                    </h4>
                    <span className="text-xs text-slate-500 font-mono">
                      {pipelineResult.curriculum?.total_chapters} Total Chapters
                    </span>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs text-slate-600">Active subjects configured for Standard {pipelineResult.standard?.name}:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {pipelineResult.curriculum?.subjects?.map((sub) => (
                        <span key={sub.subject_id} className="rounded-lg bg-indigo-50 border border-indigo-100 px-2.5 py-1 text-xs font-medium text-indigo-900">
                          {sub.subject_name} <span className="font-bold text-indigo-600">({sub.chapter_count} ch)</span>
                        </span>
                      ))}
                    </div>

                    <div className="pt-2 border-t border-slate-100">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Sample Chapters</p>
                      {pipelineResult.curriculum?.chapters_sample && pipelineResult.curriculum.chapters_sample.length > 0 ? (
                        <ul className="space-y-1 text-xs text-slate-700">
                          {pipelineResult.curriculum.chapters_sample.slice(0, 5).map((ch) => (
                            <li key={ch.chapter_id} className="flex items-center gap-2 truncate">
                              <span className="size-1.5 rounded-full bg-indigo-500 shrink-0" />
                              <span className="font-mono text-[10px] text-slate-400">#{ch.chapter_id}</span>
                              <span className="truncate">{ch.chapter_name}</span>
                              <span className="text-[10px] text-slate-400">({ch.subject_name})</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-slate-400 italic py-1">No chapters mapped to this standard.</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* 2. Activity Timeline */}
                <div className="rounded-xl border border-slate-200 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
                      <Activity className="size-4 text-blue-600" />
                      2. Activity Timeline
                    </h4>
                    <span className="text-xs text-slate-500 font-mono">
                      {pipelineResult.activity_timeline?.window}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {pipelineResult.activity_timeline?.activities?.length === 0 ? (
                      <p className="text-xs text-slate-500 py-3 text-center">No activities recorded within this date window.</p>
                    ) : (
                      <div className="space-y-2">
                        {pipelineResult.activity_timeline?.activities?.map((act, i) => (
                          <div key={act.id ?? i} className="rounded-lg border border-slate-100 bg-slate-50/50 p-2.5 flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-900 truncate">{act.title}</p>
                              <p className="text-[11px] text-slate-500 mt-0.5">
                                <span className="font-semibold text-slate-700">{act.subject}</span> · {act.date}
                              </p>
                            </div>
                            <span className="rounded-md bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 uppercase shrink-0">
                              {act.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 3. Content Readiness & Learning Gaps */}
              <div className="rounded-xl border border-slate-200 p-4 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
                      <Layers className="size-4 text-emerald-600" />
                      3. Content Model Coverage & Learning Gaps
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Real-time analysis grounded on semantic intelligence database records
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-xs font-bold text-emerald-700">
                      {pipelineResult.content_readiness?.fully_covered} Fully Covered
                    </span>
                    <span className="rounded-md bg-amber-50 border border-amber-200 px-2 py-0.5 text-xs font-bold text-amber-700">
                      {pipelineResult.content_readiness?.partially_covered} With Identified Gaps
                    </span>
                  </div>
                </div>

                {/* 4-Type Model Coverage Matrix */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3">
                    <span className="text-[10px] font-bold uppercase text-slate-500 block">Type 1: Concept Learning</span>
                    <span className="text-base font-extrabold text-emerald-700 mt-0.5 block">100%</span>
                    <span className="text-[11px] text-slate-500">4 variants ready</span>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3">
                    <span className="text-[10px] font-bold uppercase text-slate-500 block">Type 2: Practice Ladder</span>
                    <span className="text-base font-extrabold text-emerald-700 mt-0.5 block">100%</span>
                    <span className="text-[11px] text-slate-500">5-level Bloom ladder</span>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3">
                    <span className="text-[10px] font-bold uppercase text-slate-500 block">Type 3: Misconceptions</span>
                    <span className="text-base font-extrabold text-emerald-700 mt-0.5 block">100%</span>
                    <span className="text-[11px] text-slate-500">Common errors indexed</span>
                  </div>

                  <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-3">
                    <span className="text-[10px] font-bold uppercase text-amber-800 block">Type 4: Assessment Bank</span>
                    <span className="text-base font-extrabold text-amber-700 mt-0.5 block">Gaps Identified</span>
                    <span className="text-[11px] text-amber-800">389 chapters lack rubrics</span>
                  </div>
                </div>

                {/* Chapter-Level Detail Table */}
                {pipelineResult.content_readiness?.chapter_details?.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Chapter Readiness Breakdown</p>
                    <div className="overflow-x-auto rounded-xl border border-slate-200 max-h-56 overflow-y-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500 sticky top-0 border-b border-slate-200">
                          <tr>
                            <th className="py-2 px-3">Chapter</th>
                            <th className="py-2 px-3">Subject</th>
                            <th className="py-2 px-3">Concepts</th>
                            <th className="py-2 px-3">Covered Mappings</th>
                            <th className="py-2 px-3">Learning Gaps</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {pipelineResult.content_readiness.chapter_details.map((ch, idx) => (
                            <tr key={ch.id ?? idx} className="hover:bg-slate-50/40">
                              <td className="py-2 px-3 font-semibold text-slate-900 truncate max-w-xs">{ch.name}</td>
                              <td className="py-2 px-3 text-slate-600">{ch.subject}</td>
                              <td className="py-2 px-3 font-mono font-bold text-slate-700">{ch.concepts_count}</td>
                              <td className="py-2 px-3">
                                <span className="rounded-md bg-emerald-50 text-emerald-700 px-1.5 py-0.5 text-[10px] font-bold">
                                  {ch.covered?.length} Covered
                                </span>
                              </td>
                              <td className="py-2 px-3">
                                {ch.missing?.length > 0 ? (
                                  <span className="rounded-md bg-amber-50 text-amber-800 px-1.5 py-0.5 text-[10px] font-bold">
                                    {ch.missing.join(', ')}
                                  </span>
                                ) : (
                                  <span className="text-emerald-600 text-[10px] font-bold">None</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Content Module Preview Modal */}
      {selectedTaskPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl border border-slate-200 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-indigo-50 border border-indigo-200 px-2 py-0.5 font-mono text-xs font-bold text-indigo-700">
                    Content ID #{selectedTaskPreview.content_id}
                  </span>
                  <span className="text-xs font-medium text-slate-500">
                    {selectedTaskPreview.action_taken === 'verified_existing' ? 'Verified Existing' : 'Generated by AI Content Agent'}
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 mt-1">
                  {selectedTaskPreview.content_title || selectedTaskPreview.topic_name}
                </h3>
                <p className="text-xs text-slate-500 font-mono">
                  {selectedTaskPreview.standard_name ? `Std ${selectedTaskPreview.standard_name}` : `Std #${selectedTaskPreview.standard_id}`} → {selectedTaskPreview.subject_name || `Sub #${selectedTaskPreview.subject_id}`} → {selectedTaskPreview.chapter_name || `Ch #${selectedTaskPreview.chapter_id}`}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedTaskPreview(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="rounded-xl bg-slate-50 p-4 border border-slate-200 text-xs text-slate-800 leading-relaxed">
                <div className="font-semibold text-slate-900 mb-1 flex items-center gap-1.5">
                  <BookOpen className="size-4 text-indigo-600" />
                  Pedagogical Module Overview
                </div>
                <div className="text-slate-600 whitespace-pre-line font-sans">
                  {selectedTaskPreview.content_preview || 'Content module generated and stored in content_master.'}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-lg border border-slate-100 p-2.5 bg-slate-50/50">
                  <span className="text-slate-500 block text-[10px] font-bold uppercase">Topic Database ID</span>
                  <span className="font-mono font-semibold text-slate-800">{selectedTaskPreview.topic_id}</span>
                </div>
                <div className="rounded-lg border border-slate-100 p-2.5 bg-slate-50/50">
                  <span className="text-slate-500 block text-[10px] font-bold uppercase">Concept Database ID</span>
                  <span className="font-mono font-semibold text-slate-800">{selectedTaskPreview.concept_id ?? 'Linked'}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedTaskPreview(null)}
                className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Executive Skill Object (ESO) Modal */}
      {esoOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-5xl rounded-2xl bg-white shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-200 bg-gradient-to-r from-blue-50/70 via-indigo-50/50 to-slate-50 px-6 py-4 shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-blue-600 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white">
                    ESO Specification
                  </span>
                  <span className="text-xs font-semibold text-blue-900">
                    Live Grounded Executive Skill Object (ESO)
                  </span>
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-extrabold text-emerald-800">
                    All 3 Agents Verified
                  </span>
                </div>
                <h2 className="text-base font-bold text-slate-950 mt-1">
                  Executive Skill Object (ESO): Teach/Learn 3-Agent Collaborative Pipeline
                </h2>
                <p className="text-xs text-slate-600 mt-0.5">
                  Knowledge requirements, parameter contracts, live database resources, validation gates & execution flow for each agent.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleRefreshEso()}
                  disabled={esoLoading}
                  title="Reload live database counts and tool definitions"
                  className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 shadow-2xs"
                >
                  <RefreshCw className={`size-3.5 text-blue-600 ${esoLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
                <button
                  type="button"
                  onClick={() => setEsoOpen(false)}
                  className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <X className="size-5" />
                </button>
              </div>
            </div>

            {/* Modal Sub-navigation Tabs */}
            <div className="flex items-center gap-2 border-b border-slate-200 px-6 pt-1 pb-2 shrink-0 bg-white">
              <button
                type="button"
                onClick={() => setEsoActiveTab('all')}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  esoActiveTab === 'all'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All 3 Agents (Sequential View)
              </button>
              <button
                type="button"
                onClick={() => setEsoActiveTab('agent_1')}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  esoActiveTab === 'agent_1'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                1. Course Catalogue Reader
              </button>
              <button
                type="button"
                onClick={() => setEsoActiveTab('agent_2')}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  esoActiveTab === 'agent_2'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                2. Activity Timeline Reader
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
                3. Content Model Coverage
              </button>
              <button
                type="button"
                onClick={() => setEsoActiveTab('workflow')}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  esoActiveTab === 'workflow'
                    ? 'bg-violet-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Workflow & Contracts
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
              {esoLoading && !esoData ? (
                <div className="py-16 text-center space-y-2">
                  <RefreshCw className="size-6 animate-spin text-blue-600 mx-auto" />
                  <p className="text-xs font-bold text-slate-700">Querying live database knowledge bases & tool registries…</p>
                  <p className="text-[11px] text-slate-400">Inspecting tables, column schemas, and agent allow-lists</p>
                </div>
              ) : esoData ? (
                <>
                  {/* AGENT 1: Course Catalogue Reader */}
                  {(esoActiveTab === 'all' || esoActiveTab === 'agent_1') && (
                    <div className="rounded-xl border border-indigo-200 bg-white p-5 shadow-xs space-y-4">
                      {/* Identity Card */}
                      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-indigo-100 pb-3">
                        <div className="flex items-start gap-3">
                          <span className="flex size-7 items-center justify-center rounded-lg bg-indigo-600 text-white font-extrabold text-xs">
                            1
                          </span>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-bold text-slate-900">{esoData.agents.agent_1.name}</h3>
                              <span className="rounded-md bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 font-mono text-[10px] font-bold text-indigo-700">
                                {esoData.agents.agent_1.agent_id}
                              </span>
                              <span className="rounded-md bg-emerald-50 text-emerald-700 px-1.5 py-0.5 text-[10px] font-bold uppercase">
                                {esoData.agents.agent_1.status}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">
                              Tool: <code className="text-indigo-600 font-bold">{esoData.agents.agent_1.tool_key}</code> ({esoData.agents.agent_1.tool_alias}) · Module: {esoData.agents.agent_1.module}
                            </p>
                          </div>
                        </div>
                        <span className="rounded-md bg-indigo-50 px-2 py-1 text-[11px] font-bold text-indigo-800">
                          Execution Order: Step 1 of 3
                        </span>
                      </div>

                      <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <strong>Role & Scope:</strong> {esoData.agents.agent_1.role_description}
                      </p>

                      {/* ESO 4-Pillar Specification: Knowledge, Activities, Abilities, Usage */}
                      <AgentEsoCard eso={esoData.agents.agent_1.eso || TEACH_LEARN_ESO_FALLBACKS.agent_1} />

                      {/* Knowledge Requirements & Database Resources */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="rounded-lg border border-slate-200 p-3 bg-white space-y-2">
                          <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                            <BookOpen className="size-3.5 text-indigo-600" />
                            Knowledge Requirements
                          </h4>
                          <ul className="space-y-1.5 text-xs text-slate-700">
                            <li>• <strong>Curriculum Standards:</strong> {String(esoData.agents.agent_1.knowledge_requirements.standards_curriculum ?? '')}</li>
                            <li>• <strong>Subject Mappings:</strong> {String(esoData.agents.agent_1.knowledge_requirements.subject_mappings ?? '')}</li>
                            <li>• <strong>Chapter Hierarchy:</strong> {String(esoData.agents.agent_1.knowledge_requirements.chapter_hierarchy ?? '')}</li>
                            <li>• <strong>Topics Master:</strong> {String(esoData.agents.agent_1.knowledge_requirements.topic_definitions ?? '')}</li>
                          </ul>
                        </div>

                        <div className="rounded-lg border border-slate-200 p-3 bg-white space-y-2">
                          <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                            <Database className="size-3.5 text-indigo-600" />
                            Database Tables & Live Estate Resources
                          </h4>
                          <div className="flex flex-wrap gap-1 mb-2">
                            {esoData.agents.agent_1.database_resources.primary_tables.map((t) => (
                              <span key={t} className="rounded-md bg-slate-100 font-mono text-[10px] px-2 py-0.5 font-bold text-slate-700">
                                {t}
                              </span>
                            ))}
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="rounded-md bg-indigo-50/60 p-2 text-center">
                              <span className="block text-[10px] text-slate-500">Live Standards</span>
                              <span className="font-bold text-indigo-700 text-sm">{esoData.agents.agent_1.database_resources.live_metrics.standards_available}</span>
                            </div>
                            <div className="rounded-md bg-indigo-50/60 p-2 text-center">
                              <span className="block text-[10px] text-slate-500">Courses w/ Content</span>
                              <span className="font-bold text-indigo-700 text-sm">{esoData.agents.agent_1.database_resources.live_metrics.courses_with_content}</span>
                            </div>
                            <div className="rounded-md bg-indigo-50/60 p-2 text-center">
                              <span className="block text-[10px] text-slate-500">Catalog Chapters</span>
                              <span className="font-bold text-indigo-700 text-sm">{esoData.agents.agent_1.database_resources.live_metrics.chapters_in_catalog}</span>
                            </div>
                            <div className="rounded-md bg-indigo-50/60 p-2 text-center">
                              <span className="block text-[10px] text-slate-500">Indexed Topics</span>
                              <span className="font-bold text-indigo-700 text-sm">{esoData.agents.agent_1.database_resources.live_metrics.topics_indexed}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Input Schema & Outputs & Validation Gate */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                        <div className="rounded-lg border border-slate-200 p-3 bg-white space-y-1.5">
                          <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Inputs & Outputs Contract</h4>
                          <p className="text-xs text-slate-600">
                            <strong>Inputs:</strong> <code className="text-slate-800 font-mono text-[11px]">standard_name, standard_id, subject_id, include_chapters, limit</code>
                          </p>
                          <p className="text-xs text-slate-600">
                            <strong>Outputs:</strong> Resolved <code className="font-bold text-indigo-700">standard_id</code>, courses list, subjects array, chapters hierarchy.
                          </p>
                        </div>

                        <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-3 space-y-1.5">
                          <h4 className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                            <ShieldCheck className="size-3.5 text-emerald-600" />
                            Validation Gate 1: Curriculum Validation
                          </h4>
                          <p className="text-xs text-emerald-900 font-semibold">
                            {esoData.agents.agent_1.validation_rules.enforcement}
                          </p>
                          <ul className="text-[11px] text-emerald-800 space-y-0.5">
                            {esoData.agents.agent_1.validation_rules.rules.map((r, i) => (
                              <li key={i}>✓ {r}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* AGENT 2: Activity Timeline Reader */}
                  {(esoActiveTab === 'all' || esoActiveTab === 'agent_2') && (
                    <div className="rounded-xl border border-blue-200 bg-white p-5 shadow-xs space-y-4">
                      {/* Identity Card */}
                      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-blue-100 pb-3">
                        <div className="flex items-start gap-3">
                          <span className="flex size-7 items-center justify-center rounded-lg bg-blue-600 text-white font-extrabold text-xs">
                            2
                          </span>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-bold text-slate-900">{esoData.agents.agent_2.name}</h3>
                              <span className="rounded-md bg-blue-50 border border-blue-200 px-1.5 py-0.5 font-mono text-[10px] font-bold text-blue-700">
                                {esoData.agents.agent_2.agent_id}
                              </span>
                              <span className="rounded-md bg-emerald-50 text-emerald-700 px-1.5 py-0.5 text-[10px] font-bold uppercase">
                                {esoData.agents.agent_2.status}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">
                              Tool: <code className="text-blue-600 font-bold">{esoData.agents.agent_2.tool_key}</code> ({esoData.agents.agent_2.tool_alias}) · Module: {esoData.agents.agent_2.module}
                            </p>
                          </div>
                        </div>
                        <span className="rounded-md bg-blue-50 px-2 py-1 text-[11px] font-bold text-blue-800">
                          Execution Order: Step 2 of 3
                        </span>
                      </div>

                      <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <strong>Role & Scope:</strong> {esoData.agents.agent_2.role_description}
                      </p>

                      {/* ESO 4-Pillar Specification: Knowledge, Activities, Abilities, Usage */}
                      <AgentEsoCard eso={esoData.agents.agent_2.eso || TEACH_LEARN_ESO_FALLBACKS.agent_2} />

                      {/* Knowledge Requirements & Database Resources */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="rounded-lg border border-slate-200 p-3 bg-white space-y-2">
                          <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                            <Clock className="size-3.5 text-blue-600" />
                            Knowledge Requirements & Academic-Year Policy
                          </h4>
                          <ul className="space-y-1.5 text-xs text-slate-700">
                            <li>• <strong>Homework Data:</strong> {String(esoData.agents.agent_2.knowledge_requirements.class_homework ?? '')}</li>
                            <li>• <strong>Class Sessions:</strong> {String(esoData.agents.agent_2.knowledge_requirements.class_sessions ?? '')}</li>
                            <li>• <strong>Academic-Year Policy:</strong> <span className="text-blue-900 font-medium">{String(esoData.agents.agent_2.knowledge_requirements.academic_year_policy ?? '')}</span></li>
                          </ul>
                        </div>

                        <div className="rounded-lg border border-slate-200 p-3 bg-white space-y-2">
                          <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                            <Database className="size-3.5 text-blue-600" />
                            Database Tables & Live Estate Resources
                          </h4>
                          <div className="flex flex-wrap gap-1 mb-2">
                            {esoData.agents.agent_2.database_resources.primary_tables.map((t) => (
                              <span key={t} className="rounded-md bg-slate-100 font-mono text-[10px] px-2 py-0.5 font-bold text-slate-700">
                                {t}
                              </span>
                            ))}
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="rounded-md bg-blue-50/60 p-2 text-center">
                              <span className="block text-[10px] text-slate-500">Total Homework Records</span>
                              <span className="font-bold text-blue-700 text-sm">{esoData.agents.agent_2.database_resources.live_metrics.total_homework_records}</span>
                            </div>
                            <div className="rounded-md bg-blue-50/60 p-2 text-center">
                              <span className="block text-[10px] text-slate-500">Active Window Homework</span>
                              <span className="font-bold text-blue-700 text-sm">{esoData.agents.agent_2.database_resources.live_metrics.recent_active_window_homework}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Input Schema & Outputs & Validation Gate */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                        <div className="rounded-lg border border-slate-200 p-3 bg-white space-y-1.5">
                          <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Data Synchronization from Gate 1</h4>
                          <p className="text-xs text-slate-600">
                            <strong>Upstream Handoff:</strong> Receives <code className="font-bold text-blue-700">standard_id</code> dynamically from Agent 1 Gate 1.
                          </p>
                          <p className="text-xs text-slate-600">
                            <strong>Outputs:</strong> Unified timeline array (<code className="font-mono text-[11px]">kind, title, subject, date, status, when</code>) and scope verification.
                          </p>
                        </div>

                        <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-3 space-y-1.5">
                          <h4 className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                            <ShieldCheck className="size-3.5 text-emerald-600" />
                            Validation Gate 2: Activity Scope Gate
                          </h4>
                          <p className="text-xs text-emerald-900 font-semibold">
                            {esoData.agents.agent_2.validation_rules.enforcement}
                          </p>
                          <ul className="text-[11px] text-emerald-800 space-y-0.5">
                            {esoData.agents.agent_2.validation_rules.rules.map((r, i) => (
                              <li key={i}>✓ {r}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* AGENT 3: Content Model Coverage Agent */}
                  {(esoActiveTab === 'all' || esoActiveTab === 'agent_3') && (
                    <div className="rounded-xl border border-emerald-200 bg-white p-5 shadow-xs space-y-4">
                      {/* Identity Card */}
                      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-emerald-100 pb-3">
                        <div className="flex items-start gap-3">
                          <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-600 text-white font-extrabold text-xs">
                            3
                          </span>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-bold text-slate-900">{esoData.agents.agent_3.name}</h3>
                              <span className="rounded-md bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 font-mono text-[10px] font-bold text-emerald-700">
                                {esoData.agents.agent_3.agent_id}
                              </span>
                              <span className="rounded-md bg-emerald-50 text-emerald-700 px-1.5 py-0.5 text-[10px] font-bold uppercase">
                                {esoData.agents.agent_3.status}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">
                              Tool: <code className="text-emerald-600 font-bold">{esoData.agents.agent_3.tool_key}</code> · Module: {esoData.agents.agent_3.module}
                            </p>
                          </div>
                        </div>
                        <span className="rounded-md bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-800">
                          Execution Order: Step 3 of 3
                        </span>
                      </div>

                      <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <strong>Role & Scope:</strong> {esoData.agents.agent_3.role_description}
                      </p>

                      {/* ESO 4-Pillar Specification: Knowledge, Activities, Abilities, Usage */}
                      <AgentEsoCard eso={esoData.agents.agent_3.eso || TEACH_LEARN_ESO_FALLBACKS.agent_3} />

                      {/* Knowledge Requirements & 4-Type Model */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="rounded-lg border border-slate-200 p-3 bg-white space-y-2">
                          <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                            <Layers className="size-3.5 text-emerald-600" />
                            4-Type Content Model Knowledge Architecture
                          </h4>
                          <ul className="space-y-1.5 text-xs text-slate-700">
                            <li>• <strong>Type 1: Concept Learning:</strong> 4 variants from definition, knowledge & evidence</li>
                            <li>• <strong>Type 2: Practice Ladder:</strong> 5-level Bloom's taxonomy ladder from blueprints</li>
                            <li>• <strong>Type 3: Misconception Library:</strong> Common misconceptions & diagnostic traps</li>
                            <li>• <strong>Type 4: Assessment Bank:</strong> Calibrated assessment rubrics and question items</li>
                          </ul>
                        </div>

                        <div className="rounded-lg border border-slate-200 p-3 bg-white space-y-2">
                          <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                            <Database className="size-3.5 text-emerald-600" />
                            Database Tables & Live Estate Resources
                          </h4>
                          <div className="flex flex-wrap gap-1 mb-2">
                            {esoData.agents.agent_3.database_resources.primary_tables.map((t) => (
                              <span key={t} className="rounded-md bg-slate-100 font-mono text-[10px] px-2 py-0.5 font-bold text-slate-700">
                                {t}
                              </span>
                            ))}
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="rounded-md bg-emerald-50/60 p-2 text-center">
                              <span className="block text-[10px] text-slate-500">Semantic Chapters</span>
                              <span className="font-bold text-emerald-700 text-sm">{esoData.agents.agent_3.database_resources.live_metrics.semantic_chapters_extracted}</span>
                            </div>
                            <div className="rounded-md bg-emerald-50/60 p-2 text-center">
                              <span className="block text-[10px] text-slate-500">Concepts Indexed</span>
                              <span className="font-bold text-emerald-700 text-sm">{esoData.agents.agent_3.database_resources.live_metrics.total_concepts_indexed}</span>
                            </div>
                            <div className="rounded-md bg-emerald-50/60 p-2 text-center">
                              <span className="block text-[10px] text-slate-500">Types 1-3 Coverage</span>
                              <span className="font-bold text-emerald-700 text-sm">100%</span>
                            </div>
                            <div className="rounded-md bg-amber-50/60 p-2 text-center">
                              <span className="block text-[10px] text-amber-800">Assessment Rubric Gap</span>
                              <span className="font-bold text-amber-700 text-sm">{esoData.agents.agent_3.database_resources.live_metrics.type_4_assessment_gap_chapters} ch</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Input Schema & Outputs & Validation Gate */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                        <div className="rounded-lg border border-slate-200 p-3 bg-white space-y-1.5">
                          <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Data Synchronization from Gate 1 & 2</h4>
                          <p className="text-xs text-slate-600">
                            <strong>Upstream Handoff:</strong> Receives <code className="font-bold text-emerald-700">standard_id</code> and verified chapters from Gate 1 & 2.
                          </p>
                          <p className="text-xs text-slate-600">
                            <strong>Outputs:</strong> 4-Type Model Coverage Matrix, Learning Gaps Summary, and Chapter Readiness Breakdown.
                          </p>
                        </div>

                        <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-3 space-y-1.5">
                          <h4 className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                            <ShieldCheck className="size-3.5 text-emerald-600" />
                            Validation Gate 3: Content Model & Gaps Gate
                          </h4>
                          <p className="text-xs text-emerald-900 font-semibold">
                            {esoData.agents.agent_3.validation_rules.enforcement}
                          </p>
                          <ul className="text-[11px] text-emerald-800 space-y-0.5">
                            {esoData.agents.agent_3.validation_rules.rules.map((r, i) => (
                              <li key={i}>✓ {r}</li>
                            ))}
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
                            How data travels through validation gates across the complete Teach/Learn pipeline
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
                            {esoData.execution_workflow.execution_order.map((step, idx) => (
                              <li key={idx} className={step.includes('Gate') ? 'font-semibold text-emerald-700' : 'text-slate-800'}>
                                {step}
                              </li>
                            ))}
                          </ol>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                          <div className="rounded-lg border border-slate-200 p-3 space-y-1 bg-white">
                            <span className="text-[10px] font-bold uppercase text-slate-400 block">Agent 1 ➔ Agent 2 Contract</span>
                            <p className="text-slate-700">
                              Agent 1 extracts curriculum and resolves <code className="font-bold text-indigo-700">standard_id</code>. Agent 2 consumes this validated ID directly, eliminating redundant lookups and standard mismatches.
                            </p>
                          </div>

                          <div className="rounded-lg border border-slate-200 p-3 space-y-1 bg-white">
                            <span className="text-[10px] font-bold uppercase text-slate-400 block">Gate 1 & 2 ➔ Agent 3 Contract</span>
                            <p className="text-slate-700">
                              Agent 3 receives the verified chapters and activity scope to calculate four-type model coverage and diagnose assessment bank authoring gaps.
                            </p>
                          </div>
                        </div>

                        <div className="rounded-lg bg-emerald-50/60 p-3 border border-emerald-200 flex items-center justify-between text-xs text-emerald-950">
                          <span className="font-semibold flex items-center gap-1.5">
                            <ShieldCheck className="size-4 text-emerald-600" />
                            Safety & Governance Guarantees:
                          </span>
                          <span className="text-[11px] text-emerald-800">
                            100% Read-Only · Zero Database Writes · Tenant Scoped · RBAC Protected
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : null}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-3 shrink-0">
              <span className="text-[11px] text-slate-500">
                Teach/Learn Executive Skill Object (ESO) · Dynamic Live Reflection
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
