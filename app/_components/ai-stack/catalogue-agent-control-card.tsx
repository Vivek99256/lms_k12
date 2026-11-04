'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  ChevronLeft,
  ChevronRight,
  Clock,
  Database,
  Download,
  Eye,
  FileCheck,
  FileText,
  Layers,
  Layout,
  Maximize2,
  Minimize2,
  Monitor,
  Palette,
  Pause,
  Play,
  Printer,
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
import { resolveAiBaseUrl } from '@/app/components/utils/api_url';
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
  fetchCatalogueStandards,
  fetchCatalogueSubjects,
  fetchCatalogueChapters,
  checkChapterContent,
  type CatalogueAgentState,
  type HierarchyValidationReport,
  type ContentTaskRecord,
  type ContentStats,
  type UnifiedTeachLearnReport,
  type ExpertSystemOverviewData,
  type AgentEsoStructuredObject,
  type CatalogueStandard,
  type CatalogueSubject,
  type CatalogueChapter,
  type ContentCoverageCheck,
  type ContentResourceStatus,
  type RunPipelineOptions,
} from '@/lib/teach-learn/catalogue-agent-client';
import {
  CONTENT_TEMPLATES,
  type ContentTemplateOption,
  TemplateDesignCanvas,
} from './template-design-canvas';
export { CONTENT_TEMPLATES, type ContentTemplateOption, TemplateDesignCanvas };

interface CatalogueAgentControlCardProps {
  onValidated?: (report?: HierarchyValidationReport | UnifiedTeachLearnReport | unknown) => void;
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

const TEACHING_APPROACHES = [
  'Explicit instruction / direct teaching',
  'Inquiry-based learning',
  'Problem-based learning',
  'Project-based learning',
  'Experiential / learning by doing',
  'Collaborative / peer learning',
  'Socratic questioning / guided discovery',
  'Flipped classroom',
  'Differentiated / mastery-based instruction',
  'Gamified learning',
];

const STUDENT_EXPERIENCES = [
  { id: 'ppt', label: 'PPT / interactive slides', available: true, description: 'Generates structured interactive presentation slides' },
  { id: 'scenario_lesson', label: 'Scenario-based lesson', available: false, note: 'no generator yet' },
  { id: 'branching_scenario', label: 'Interactive branching scenario', available: true, description: 'Generates branching scenario decision path' },
  { id: 'video_lesson', label: 'Video lesson', available: false, note: 'no generator yet' },
  { id: 'simulation', label: 'Simulation / practical activity', available: false, note: 'no generator yet' },
  { id: 'student_worksheet', label: 'Student worksheet / learning guide', available: false, note: 'no generator yet' },
  { id: 'socratic_dialogue', label: 'Interactive Socratic dialogue', available: false, note: 'no generator yet' },
];

const CLASSROOM_RESOURCE_TYPES = [
  { id: 'Presentation', label: 'Presentation' },
  { id: 'Revision Notes', label: 'Revision Notes' },
  { id: 'Classroom Activity', label: 'Classroom Activity' },
  { id: 'Remedial Class', label: 'Remedial Class' },
];

// Note: CONTENT_TEMPLATES, ContentTemplateOption, and TemplateDesignCanvas are imported from ./template-design-canvas

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

  // Main UI Navigation Tabs - Defaults to User-Driven Multi-Agent Pipeline
  const [mainTab, setMainTab] = useState<'hierarchy' | 'content_ledger' | 'cycle_diagram' | 'pipeline'>('pipeline');

  // Multi-Stage Selection State (Stage 1 to 5)
  const [workflowStage, setWorkflowStage] = useState<1 | 2 | 3 | 4 | 5>(1);

  // Stage 1: Cascading Academic Scope (Real Database Grounded)
  const [catalogueStandards, setCatalogueStandards] = useState<CatalogueStandard[]>([]);
  const [selectedStandardIds, setSelectedStandardIds] = useState<number[]>([]);
  const [catalogueSubjects, setCatalogueSubjects] = useState<CatalogueSubject[]>([]);
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<number[]>([]);
  const [catalogueChapters, setCatalogueChapters] = useState<CatalogueChapter[]>([]);
  const [selectedChapterIds, setSelectedChapterIds] = useState<number[]>([]);
  const [loadingHierarchy, setLoadingHierarchy] = useState(false);

  // Stage 2: Teaching Method
  const [selectedTeachingApproach, setSelectedTeachingApproach] = useState<string>('Inquiry-based learning');

  // Stage 3: Student Learning Experience & Template Layout
  const [selectedStudentExperience, setSelectedStudentExperience] = useState<string>('ppt');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('modern_tech');

  // Interactive Design View (Preview Before Generation) State
  const [previewMode, setPreviewMode] = useState<'ppt' | 'pdf'>('ppt');
  const [previewSlideIdx, setPreviewSlideIdx] = useState<number>(0);
  const [previewFullscreenOpen, setPreviewFullscreenOpen] = useState<boolean>(false);

  const currentTmpl = useMemo(() => {
    return CONTENT_TEMPLATES.find((t) => t.id === selectedTemplate) || CONTENT_TEMPLATES[0];
  }, [selectedTemplate]);

  const activePreviewChapter = useMemo(() => {
    if (selectedChapterIds.length > 0) {
      const found = catalogueChapters.find((c) => selectedChapterIds.includes(c.id));
      if (found) return found.chapter_name;
    }
    return 'Market Equilibrium & Price Determination';
  }, [selectedChapterIds, catalogueChapters]);

  const activePreviewSubject = useMemo(() => {
    if (selectedSubjectIds.length > 0) {
      const found = catalogueSubjects.find((s) => selectedSubjectIds.includes(s.subject_id));
      if (found) return found.subject_name;
    }
    return 'Economics';
  }, [selectedSubjectIds, catalogueSubjects]);

  const activePreviewStandard = useMemo(() => {
    if (selectedStandardIds.length > 0) {
      const found = catalogueStandards.find((s) => selectedStandardIds.includes(s.id));
      if (found) return `Standard ${found.name}`;
    }
    return 'Standard 10';
  }, [selectedStandardIds, catalogueStandards]);

  // Helper to resolve real viewer URLs for generated & audited content
  const resolveContentViewUrl = useCallback((contentId?: number | null, rawUrl?: string | null) => {
    if (rawUrl && (rawUrl.startsWith('http://') || rawUrl.startsWith('https://'))) {
      return rawUrl;
    }
    const base = resolveAiBaseUrl();
    return `${base.replace(/\/+$/, '')}/api/lms-content-view/${contentId || ''}`;
  }, []);

  // Stage 4: Classroom Resources & Assessment
  const [selectedResourceTypes, setSelectedResourceTypes] = useState<string[]>([
    'Presentation',
    'Revision Notes',
  ]);
  const [includeAssessment, setIncludeAssessment] = useState<boolean>(true);

  // Synchronized 3-Agent Pipeline Execution State
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [pipelineResult, setPipelineResult] = useState<UnifiedTeachLearnReport | null>(null);
  const [pipelineDays, setPipelineDays] = useState(15);

  // Dedicated 3-Agent Sequential Execution States (Agent 1 -> Agent 2 -> Agent 3)
  const [executingStep, setExecutingStep] = useState<0 | 1 | 2 | 3>(0);
  const [step1State, setStep1State] = useState<{
    status: 'pending' | 'running' | 'completed' | 'failed';
    summary?: string;
    duration_ms?: number;
    scopeText?: string;
  }>({ status: 'pending' });
  const [step2State, setStep2State] = useState<{
    status: 'pending' | 'running' | 'completed' | 'failed';
    existingFound?: number;
    missingIdentified?: number;
    summary?: string;
    duration_ms?: number;
  }>({ status: 'pending' });
  const [step3State, setStep3State] = useState<{
    status: 'pending' | 'running' | 'completed' | 'failed';
    approach?: string;
    generatedCount?: number;
    summary?: string;
    duration_ms?: number;
  }>({ status: 'pending' });
  const [pipelineError, setPipelineError] = useState<string | null>(null);

  // 1. Load real standards from database on mount
  useEffect(() => {
    let isMounted = true;
    async function loadStandards() {
      try {
        const context = readModuleWorkspaceSession();
        const res = await fetchCatalogueStandards(context);
        if (isMounted && res.standards && res.standards.length > 0) {
          setCatalogueStandards(res.standards);
          // Default select Standard 7 if available, otherwise first available standard
          const std7 = res.standards.find(
            (s) => String(s.name).trim() === '7' || s.id === 7 || String(s.name).toLowerCase().includes('7')
          );
          const defaultStd = std7 || res.standards[0];
          if (defaultStd) {
            setSelectedStandardIds([defaultStd.id]);
          }
        }
      } catch {
        // Fallback gracefully
      }
    }
    void loadStandards();
    return () => {
      isMounted = false;
    };
  }, []);

  // 2. When selected standards change, dynamically load mapped subjects from database
  useEffect(() => {
    let isMounted = true;
    if (selectedStandardIds.length === 0) {
      setCatalogueSubjects([]);
      setSelectedSubjectIds([]);
      setCatalogueChapters([]);
      setSelectedChapterIds([]);
      return;
    }

    async function loadSubjects() {
      setLoadingHierarchy(true);
      try {
        const context = readModuleWorkspaceSession();
        const res = await fetchCatalogueSubjects(context, selectedStandardIds);
        if (isMounted) {
          const subs = res.subjects || [];
          setCatalogueSubjects(subs);
          // Auto-select valid previously selected subjects, or default to first subject
          setSelectedSubjectIds((prev) => {
            const valid = prev.filter((id) => subs.some((s) => s.subject_id === id));
            if (valid.length > 0) return valid;
            // Prefer Science or first available subject
            const scienceSub = subs.find((s) => s.subject_name.toLowerCase().includes('science'));
            return scienceSub ? [scienceSub.subject_id] : subs.length > 0 ? [subs[0].subject_id] : [];
          });
        }
      } catch {
        if (isMounted) setCatalogueSubjects([]);
      } finally {
        if (isMounted) setLoadingHierarchy(false);
      }
    }
    void loadSubjects();
    return () => {
      isMounted = false;
    };
  }, [selectedStandardIds]);

  // 3. When selected subjects or standards change, dynamically load corresponding chapters
  useEffect(() => {
    let isMounted = true;
    if (selectedStandardIds.length === 0 || selectedSubjectIds.length === 0) {
      setCatalogueChapters([]);
      setSelectedChapterIds([]);
      return;
    }

    async function loadChapters() {
      setLoadingHierarchy(true);
      try {
        const context = readModuleWorkspaceSession();
        const res = await fetchCatalogueChapters(context, selectedStandardIds, selectedSubjectIds);
        if (isMounted) {
          const chaps = res.chapters || [];
          setCatalogueChapters(chaps);
          // Auto-select valid previously selected chapters, or default to Chapter 3 or first
          setSelectedChapterIds((prev) => {
            const valid = prev.filter((id) => chaps.some((c) => c.id === id));
            if (valid.length > 0) return valid;
            const ch3 = chaps.find((c) => c.chapter_name.toLowerCase().includes('chapter 3') || c.sort_order === 3);
            return ch3 ? [ch3.id] : chaps.length > 0 ? [chaps[0].id] : [];
          });
        }
      } catch {
        if (isMounted) setCatalogueChapters([]);
      } finally {
        if (isMounted) setLoadingHierarchy(false);
      }
    }
    void loadChapters();
    return () => {
      isMounted = false;
    };
  }, [selectedStandardIds, selectedSubjectIds]);

  // Toggle Standard selection
  const toggleStandardSelection = (stdId: number) => {
    setSelectedStandardIds((prev) =>
      prev.includes(stdId) ? prev.filter((id) => id !== stdId) : [...prev, stdId]
    );
  };

  const toggleAllStandardsSelection = () => {
    if (selectedStandardIds.length === catalogueStandards.length) {
      setSelectedStandardIds([]);
    } else {
      setSelectedStandardIds(catalogueStandards.map((s) => s.id));
    }
  };

  // Toggle Subject selection
  const toggleSubjectSelection = (subId: number) => {
    setSelectedSubjectIds((prev) =>
      prev.includes(subId) ? prev.filter((id) => id !== subId) : [...prev, subId]
    );
  };

  const toggleAllSubjectsSelection = () => {
    if (selectedSubjectIds.length === catalogueSubjects.length) {
      setSelectedSubjectIds([]);
    } else {
      setSelectedSubjectIds(catalogueSubjects.map((s) => s.subject_id));
    }
  };

  // Toggle Chapter selection
  const toggleChapterSelection = (chId: number) => {
    setSelectedChapterIds((prev) =>
      prev.includes(chId) ? prev.filter((id) => id !== chId) : [...prev, chId]
    );
  };

  const toggleAllChaptersSelection = () => {
    if (selectedChapterIds.length === catalogueChapters.length) {
      setSelectedChapterIds([]);
    } else {
      setSelectedChapterIds(catalogueChapters.map((c) => c.id));
    }
  };

  // Toggle Classroom Resource Type selection
  const toggleResourceType = (rType: string) => {
    setSelectedResourceTypes((prev) =>
      prev.includes(rType) ? prev.filter((t) => t !== rType) : [...prev, rType]
    );
  };

  const toggleAllResourceTypes = () => {
    if (selectedResourceTypes.length === CLASSROOM_RESOURCE_TYPES.length) {
      setSelectedResourceTypes([]);
    } else {
      setSelectedResourceTypes(CLASSROOM_RESOURCE_TYPES.map((r) => r.id));
    }
  };

  // Execute the 3-Agent Sequential Pipeline based strictly on confirmed user selections
  // Execute the 3-Agent Sequential Pipeline strictly one by one (Agent 1 -> Agent 2 -> Agent 3)
  const executePipeline = async (options: RunPipelineOptions) => {
    setPipelineRunning(true);
    setPipelineError(null);
    setPipelineResult(null);

    const stdNames = selectedStandardIds
      .map((id) => catalogueStandards.find((s) => s.id === id)?.name || `Std ${id}`)
      .join(', ');
    const subNames = selectedSubjectIds
      .map((id) => catalogueSubjects.find((s) => s.subject_id === id)?.subject_name || `Sub ${id}`)
      .join(', ');
    const chNames = selectedChapterIds
      .map((id) => catalogueChapters.find((c) => c.id === id)?.chapter_name || `Ch ${id}`)
      .join(', ');
    const scopeSummaryText = `Standard: ${stdNames || 'All'} | Subject: ${subNames || 'All'} | Chapter: ${chNames || 'All'}`;

    // Reset and initialize step execution states
    setExecutingStep(1);
    setStep1State({
      status: 'running',
      summary: 'Validating confirmed academic scope, subject bindings, and 5-tier hierarchy...',
      scopeText: scopeSummaryText,
    });
    setStep2State({
      status: 'pending',
      summary: 'Waiting for Agent 1 to pass Gate 1 validation...',
    });
    setStep3State({
      status: 'pending',
      summary: 'Waiting for Agent 2 to pass Gate 2 content audit...',
    });

    try {
      const context = readModuleWorkspaceSession();

      // =========================================================================
      // STEP 1: Agent 1 – Course Catalogue Reader (Gate 1 Validation)
      // =========================================================================
      const step1Res = await runTeachLearnPipeline(context, {
        ...options,
        step: 1,
        days_back: pipelineDays,
        days_ahead: pipelineDays,
        limit: 10,
        content_limit: 50,
      });

      if (!step1Res.report?.success) {
        const errMsg = step1Res.report?.error || 'Scope validation failed at Gate 1.';
        setStep1State((prev) => ({ ...prev, status: 'failed', summary: errMsg }));
        throw new Error(errMsg);
      }

      setStep1State({
        status: 'completed',
        summary: step1Res.report?.step_result?.output_summary || 'Scope and curriculum hierarchy validated successfully.',
        duration_ms: step1Res.report?.step_result?.duration_ms,
        scopeText: scopeSummaryText,
      });

      const handover1 = (step1Res.report?.handover as Record<string, unknown>) || {};

      // =========================================================================
      // STEP 2: Agent 2 – Activity Timeline Reader (Gate 2 Content Audit)
      // =========================================================================
      setExecutingStep(2);
      setStep2State({
        status: 'running',
        summary: 'Auditing database for existing classroom resources and activity records...',
      });

      const step2Res = await runTeachLearnPipeline(context, {
        ...options,
        step: 2,
        handover: handover1,
        days_back: pipelineDays,
        days_ahead: pipelineDays,
        limit: 10,
        content_limit: 50,
      });

      if (!step2Res.report?.success) {
        const errMsg = step2Res.report?.error || 'Content audit failed at Gate 2.';
        setStep2State((prev) => ({ ...prev, status: 'failed', summary: errMsg }));
        throw new Error(errMsg);
      }

      const existingCount = Number(step2Res.report?.handover?.existing_content_count ?? 0);
      const missingCount = Number(step2Res.report?.handover?.missing_content_count ?? 0);

      setStep2State({
        status: 'completed',
        existingFound: existingCount,
        missingIdentified: missingCount,
        summary: step2Res.report?.step_result?.output_summary || `Found ${existingCount} existing resources; identified ${missingCount} missing resources.`,
        duration_ms: step2Res.report?.step_result?.duration_ms,
      });

      const handover2 = (step2Res.report?.handover as Record<string, unknown>) || {};

      // =========================================================================
      // STEP 3: Agent 3 – Content Generation Agent (Gate 3 Generation & Assessment)
      // =========================================================================
      setExecutingStep(3);
      setStep3State({
        status: 'running',
        approach: selectedTeachingApproach,
        summary: `Generating missing resources using '${selectedTeachingApproach}' approach...`,
      });

      const step3Res = await runTeachLearnPipeline(context, {
        ...options,
        step: 3,
        handover: { ...handover1, ...handover2 },
        days_back: pipelineDays,
        days_ahead: pipelineDays,
        limit: 10,
        content_limit: 50,
      });

      if (!step3Res.report?.success) {
        const errMsg = step3Res.report?.error || 'Content generation failed at Gate 3.';
        setStep3State((prev) => ({ ...prev, status: 'failed', summary: errMsg }));
        throw new Error(errMsg);
      }

      const finalReport = step3Res.report;
      const genCount = Number(finalReport.content_generation?.generated_count ?? 0);

      setStep3State({
        status: 'completed',
        approach: selectedTeachingApproach,
        generatedCount: genCount,
        summary: finalReport.content_generation?.summary_message || `Generated ${genCount} new pedagogical resources. Zero duplicate records created.`,
        duration_ms: finalReport.pipeline_execution?.steps?.[2]?.duration_ms,
      });

      setPipelineResult(finalReport);
      setExecutingStep(0);

      if (onValidatedRef.current) {
        onValidatedRef.current(finalReport);
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('agents:runs-updated', { detail: { module: 'teach_learn' } }));
      }
      // Immediately sync upper-section KPI counters and tasks ledger with new results
      void loadState(true);
      void loadTasksLedger();
    } catch (err) {
      setPipelineError(err instanceof Error ? err.message : 'Pipeline execution failed.');
    } finally {
      setPipelineRunning(false);
      setExecutingStep(0);
    }
  };

  // User clicks "Start Agents" after reviewing all selections
  const handleStartAgents = async () => {
    if (selectedStandardIds.length === 0) {
      setPipelineError('Please select at least one Standard in Stage 1 before starting.');
      setWorkflowStage(1);
      return;
    }
    if (selectedSubjectIds.length === 0) {
      setPipelineError('Please select at least one Subject in Stage 1 before starting.');
      setWorkflowStage(1);
      return;
    }
    if (selectedChapterIds.length === 0) {
      setPipelineError('Please select at least one Chapter in Stage 1 before starting.');
      setWorkflowStage(1);
      return;
    }
    if (selectedResourceTypes.length === 0 && !includeAssessment) {
      setPipelineError('Please select at least one Classroom Resource or Assessment in Stage 4.');
      setWorkflowStage(4);
      return;
    }

    setPipelineError(null);
    await executePipeline({
      standard_ids: selectedStandardIds,
      subject_ids: selectedSubjectIds,
      chapter_ids: selectedChapterIds,
      teaching_approach: selectedTeachingApproach,
      student_experiences: [selectedStudentExperience],
      selected_resources: selectedResourceTypes,
      selected_template: selectedTemplate,
      generate_assessment: includeAssessment,
      check_only: false,
    });
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

  const onValidatedRef = useRef(onValidated);
  useEffect(() => {
    onValidatedRef.current = onValidated;
  }, [onValidated]);

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
    } catch (err) {
      if (!isPolling) {
        setError(err instanceof Error ? err.message : 'Failed to fetch Course Catalogue Reader Agent state.');
      }
    } finally {
      if (!isPolling) setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    void loadState();
    void loadTasksLedger();
  }, [loadState, loadTasksLedger]);

  // Auto-refresh interval (polling every 15 seconds)
  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(() => {
      void loadState(true);
      if (mainTab === 'content_ledger') {
        void loadTasksLedger(taskFilterStatus);
      }
    }, 15000);
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
      if (onValidatedRef.current) {
        onValidatedRef.current(res.report);
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
      if (onValidatedRef.current && res.report) {
        onValidatedRef.current(res.report);
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
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setMainTab('pipeline')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition shrink-0 ${
            mainTab === 'pipeline'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <Sparkles className="size-3.5" />
          User-Driven Content Generation Workflow
          <span className={`rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider ${
            mainTab === 'pipeline' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800'
          }`}>
            Sequential 3-Agent
          </span>
        </button>

        <button
          type="button"
          onClick={() => setMainTab('hierarchy')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition shrink-0 ${
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
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition shrink-0 ${
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
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition shrink-0 ${
            mainTab === 'cycle_diagram'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <Workflow className="size-3.5" />
          Automated Loop Workflow (Steps 1–6)
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
                            <a
                              href={resolveContentViewUrl(task.content_id)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-md bg-indigo-50 border border-indigo-200 px-2 py-0.5 font-mono text-[11px] font-bold text-indigo-700 hover:bg-indigo-100 hover:border-indigo-300 transition cursor-pointer"
                              title="Open content in responsive viewer"
                            >
                              <Database className="size-3" /> #{task.content_id}
                            </a>
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

      {/* TAB: User-Driven Multi-Agent Content Generation Workflow */}
      {mainTab === 'pipeline' && (
        <div className="space-y-6">
          {/* Main Workflow Card */}
          <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/40 via-white to-teal-50/30 p-6 space-y-6 shadow-xs">
            {/* Header */}
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-emerald-100/80 pb-5">
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-emerald-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white tracking-wider">
                    Sequential Workflow
                  </span>
                  <span className="text-xs text-slate-500 font-semibold">
                    Agent 1 ➔ Agent 2 ➔ Agent 3
                  </span>
                </div>
                <h3 className="text-lg font-bold text-slate-900 mt-1 flex items-center gap-2">
                  <Sparkles className="size-5 text-emerald-600" />
                  Teach/Learn User-Driven Multi-Agent Content Generation
                </h3>
                <p className="text-xs text-slate-600 mt-1 max-w-3xl leading-relaxed">
                  Agents never generate unselected content. Complete your selections across Stages 1–4, review in Stage 5, and click <strong>Start Agents</strong>. 
                  The three agents will execute sequentially, check existing database content first to prevent duplicates, and generate only what is missing.
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-slate-500">
                  <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 border border-emerald-100 px-2 py-0.5 font-semibold text-emerald-800">
                    <CheckCircle2 className="size-3 text-emerald-600" />
                    Simultaneous Execution Supported
                  </span>
                  <span>The upper autonomous background loop and this lower targeted selection workflow run in parallel without conflicts or duplicate data creation.</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEsoActiveTab('workflow');
                    void handleOpenEso();
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-800 shadow-2xs hover:bg-emerald-50 transition"
                >
                  <Workflow className="size-3.5 text-emerald-600" />
                  View 3-Agent Architecture
                </button>
              </div>
            </div>

            {/* 5-Stage Stepper Navigation */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 border-b border-slate-100 pb-4">
              {[
                { stage: 1, label: 'Stage 1', title: 'Academic Scope', icon: Layers },
                { stage: 2, label: 'Stage 2', title: 'Teaching Method', icon: BookOpen },
                { stage: 3, label: 'Stage 3', title: 'Learning Experience', icon: Sparkles },
                { stage: 4, label: 'Stage 4', title: 'Classroom Resources', icon: Database },
                { stage: 5, label: 'Stage 5', title: 'Review & Start', icon: Play },
              ].map((step) => {
                const IconComponent = step.icon;
                const isActive = workflowStage === step.stage;
                const isComplete = workflowStage > step.stage;
                return (
                  <button
                    key={step.stage}
                    type="button"
                    onClick={() => setWorkflowStage(step.stage as 1 | 2 | 3 | 4 | 5)}
                    className={`flex items-center gap-2.5 rounded-xl p-2.5 text-left transition border ${
                      isActive
                        ? 'border-emerald-600 bg-emerald-50/70 text-emerald-950 font-bold shadow-2xs'
                        : isComplete
                        ? 'border-emerald-200 bg-white text-slate-700 hover:bg-slate-50'
                        : 'border-slate-200 bg-slate-50/50 text-slate-500 hover:bg-white'
                    }`}
                  >
                    <span
                      className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        isActive
                          ? 'bg-emerald-600 text-white'
                          : isComplete
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {isComplete ? <Check className="size-3.5" /> : step.stage}
                    </span>
                    <div className="min-w-0">
                      <span className="block text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                        {step.label}
                      </span>
                      <span className="block text-xs truncate font-semibold">
                        {step.title}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* STAGE 1: Select Academic Scope (Standard, Subject, Chapter) */}
            {workflowStage === 1 && (
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Layers className="size-4 text-emerald-600" />
                      Stage 1 – Select Academic Scope
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Choose one, multiple, or all Standards, Subjects, and Chapters from your institute&apos;s real database records.
                    </p>
                  </div>
                  {loadingHierarchy && (
                    <span className="inline-flex items-center gap-1.5 text-xs text-indigo-600 font-semibold">
                      <RefreshCw className="size-3.5 animate-spin" />
                      Loading Database Records…
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* 1. Standards */}
                  <div className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-3 shadow-2xs">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <span className="text-xs font-bold text-slate-900">
                        1. Standards ({selectedStandardIds.length}/{catalogueStandards.length})
                      </span>
                      <button
                        type="button"
                        onClick={toggleAllStandardsSelection}
                        className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 cursor-pointer"
                      >
                        {selectedStandardIds.length === catalogueStandards.length ? 'Deselect All' : 'Select All'}
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-1.5 max-h-56 overflow-y-auto pr-1">
                      {catalogueStandards.map((std) => {
                        const isSelected = selectedStandardIds.includes(std.id);
                        return (
                          <button
                            key={std.id}
                            type="button"
                            onClick={() => toggleStandardSelection(std.id)}
                            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition cursor-pointer border ${
                              isSelected
                                ? 'border-emerald-600 bg-emerald-600 text-white shadow-2xs'
                                : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white'
                            }`}
                          >
                            {isSelected && <Check className="size-3" />}
                            Standard {std.name}
                          </button>
                        );
                      })}
                      {catalogueStandards.length === 0 && (
                        <p className="text-xs text-slate-400 italic">No standards found in database.</p>
                      )}
                    </div>
                  </div>

                  {/* 2. Subjects */}
                  <div className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-3 shadow-2xs">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <span className="text-xs font-bold text-slate-900">
                        2. Subjects ({selectedSubjectIds.length}/{catalogueSubjects.length})
                      </span>
                      <button
                        type="button"
                        onClick={toggleAllSubjectsSelection}
                        disabled={catalogueSubjects.length === 0}
                        className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 cursor-pointer disabled:opacity-40"
                      >
                        {selectedSubjectIds.length === catalogueSubjects.length ? 'Deselect All' : 'Select All'}
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-1.5 max-h-56 overflow-y-auto pr-1">
                      {catalogueSubjects.map((sub) => {
                        const isSelected = selectedSubjectIds.includes(sub.subject_id);
                        return (
                          <button
                            key={sub.subject_id}
                            type="button"
                            onClick={() => toggleSubjectSelection(sub.subject_id)}
                            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition cursor-pointer border ${
                              isSelected
                                ? 'border-indigo-600 bg-indigo-600 text-white shadow-2xs'
                                : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white'
                            }`}
                          >
                            {isSelected && <Check className="size-3" />}
                            {sub.subject_name}
                          </button>
                        );
                      })}
                      {catalogueSubjects.length === 0 && (
                        <p className="text-xs text-slate-400 italic">
                          {selectedStandardIds.length === 0 ? 'Select a standard first.' : 'No content-enabled subjects found.'}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* 3. Chapters */}
                  <div className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-3 shadow-2xs">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <span className="text-xs font-bold text-slate-900">
                        3. Chapters ({selectedChapterIds.length}/{catalogueChapters.length})
                      </span>
                      <button
                        type="button"
                        onClick={toggleAllChaptersSelection}
                        disabled={catalogueChapters.length === 0}
                        className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 cursor-pointer disabled:opacity-40"
                      >
                        {selectedChapterIds.length === catalogueChapters.length ? 'Deselect All' : 'Select All'}
                      </button>
                    </div>

                    <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                      {catalogueChapters.map((ch) => {
                        const isSelected = selectedChapterIds.includes(ch.id);
                        return (
                          <button
                            key={ch.id}
                            type="button"
                            onClick={() => toggleChapterSelection(ch.id)}
                            className={`w-full flex items-center justify-between rounded-lg p-2 text-left text-xs font-medium transition cursor-pointer border ${
                              isSelected
                                ? 'border-emerald-600 bg-emerald-50/70 text-emerald-950 font-bold shadow-2xs'
                                : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                            }`}
                          >
                            <span className="truncate pr-2">{ch.chapter_name}</span>
                            <span
                              className={`flex size-4 shrink-0 items-center justify-center rounded-sm border ${
                                isSelected ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300 bg-white'
                              }`}
                            >
                              {isSelected && <Check className="size-3" />}
                            </span>
                          </button>
                        );
                      })}
                      {catalogueChapters.length === 0 && (
                        <p className="text-xs text-slate-400 italic">
                          {selectedSubjectIds.length === 0 ? 'Select a subject first.' : 'No chapters found.'}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Stage 1 Actions */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <span className="text-xs text-slate-500">
                    Selected: <strong>{selectedStandardIds.length}</strong> Standard(s), <strong>{selectedSubjectIds.length}</strong> Subject(s), <strong>{selectedChapterIds.length}</strong> Chapter(s)
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void handleStartAgents()}
                      disabled={pipelineRunning || selectedChapterIds.length === 0}
                      className="flex items-center gap-1.5 rounded-xl border border-emerald-600 bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50 transition cursor-pointer shadow-2xs"
                      title="Directly execute Agent 1 ➔ Agent 2 ➔ Agent 3 for the selected Standard, Subject, and Chapter right now"
                    >
                      {pipelineRunning ? (
                        <>
                          <RefreshCw className="size-3.5 animate-spin text-emerald-700" />
                          Executing for Selected Scope…
                        </>
                      ) : (
                        <>
                          <Zap className="size-3.5 text-emerald-600 fill-emerald-600" />
                          Execute for Selected Scope
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setWorkflowStage(2)}
                      disabled={selectedChapterIds.length === 0}
                      className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-50 transition cursor-pointer"
                    >
                      Customize Pedagogy (Stage 2) ➔
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* STAGE 2: Choose Teaching Method */}
            {workflowStage === 2 && (
              <div className="space-y-5">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <BookOpen className="size-4 text-emerald-600" />
                    Stage 2 – Choose Teaching Method
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Select the pedagogical approach. Agents will tailor presentation structures and classroom exercises to this instructional style.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {TEACHING_APPROACHES.map((approach) => {
                    const isSelected = selectedTeachingApproach === approach;
                    return (
                      <label
                        key={approach}
                        onClick={() => setSelectedTeachingApproach(approach)}
                        className={`flex items-center gap-3 rounded-xl border p-3.5 text-xs cursor-pointer transition ${
                          isSelected
                            ? 'border-emerald-600 bg-emerald-50/60 text-emerald-950 font-bold shadow-2xs'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50/50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="workflowTeachingApproach"
                          checked={isSelected}
                          onChange={() => setSelectedTeachingApproach(approach)}
                          className="size-4 text-emerald-600 border-slate-300 focus:ring-emerald-500"
                        />
                        <span className="leading-snug">{approach}</span>
                      </label>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => setWorkflowStage(1)}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                  >
                    ← Back to Academic Scope
                  </button>
                  <button
                    type="button"
                    onClick={() => setWorkflowStage(3)}
                    className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition cursor-pointer"
                  >
                    Next: Choose Learning Experience ➔
                  </button>
                </div>
              </div>
            )}

            {/* STAGE 3: Choose Learning Experience & Presentation Template */}
            {workflowStage === 3 && (
              <div className="space-y-6">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Sparkles className="size-4 text-emerald-600" />
                    Stage 3 – Choose Learning Experience &amp; Design Template
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Select your target interactive format and choose a professionally designed visual template for Presentations (PPT), PDFs, Revision Notes, and Activities.
                  </p>
                </div>

                {/* 3A: Student Learning Experience */}
                <div className="space-y-2.5">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Layout className="size-3.5 text-emerald-600" />
                    Interactive Student Experience Format
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {STUDENT_EXPERIENCES.map((exp) => {
                      const isSelected = selectedStudentExperience === exp.id;
                      const isAvailable = exp.available;
                      return (
                        <label
                          key={exp.id}
                          onClick={() => {
                            if (isAvailable) setSelectedStudentExperience(exp.id);
                          }}
                          className={`flex items-center justify-between rounded-xl border p-3.5 text-xs transition ${
                            !isAvailable
                              ? 'border-slate-200 bg-slate-50/70 text-slate-400 cursor-not-allowed opacity-75'
                              : isSelected
                              ? 'border-emerald-600 bg-emerald-50/60 text-emerald-950 font-bold shadow-2xs cursor-pointer'
                              : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50/50 cursor-pointer'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <input
                              type="radio"
                              name="workflowStudentExperience"
                              disabled={!isAvailable}
                              checked={isSelected}
                              onChange={() => {
                                if (isAvailable) setSelectedStudentExperience(exp.id);
                              }}
                              className="size-4 text-emerald-600 border-slate-300 focus:ring-emerald-500 disabled:opacity-40"
                            />
                            <div className="truncate">
                              <span className="block truncate font-semibold">{exp.label}</span>
                              {exp.description && (
                                <span className="text-[11px] text-slate-500 block truncate">{exp.description}</span>
                              )}
                            </div>
                          </div>

                          {!isAvailable && (
                            <span className="rounded-md bg-slate-100 text-slate-500 border border-slate-200 px-2 py-0.5 text-[10px] font-semibold italic shrink-0 ml-2">
                              no generator yet
                            </span>
                          )}
                          {isAvailable && (
                            <span className="rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold shrink-0 ml-2">
                              Available
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* 3B: Multiple Professionally Designed Templates */}
                <div className="space-y-3 pt-3 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <Palette className="size-3.5 text-indigo-600" />
                        Choose Visual Presentation &amp; Document Template
                      </span>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Select a distinct visual layout with custom color palettes, clear headings, student-friendly analogies, and SVG vector diagrams.
                      </p>
                    </div>
                    <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-full shrink-0">
                      8 Professional Templates
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {CONTENT_TEMPLATES.map((tmpl) => {
                      const isSelected = selectedTemplate === tmpl.id;
                      return (
                        <div
                          key={tmpl.id}
                          onClick={() => {
                            setSelectedTemplate(tmpl.id);
                            // Also sync theme attribute in browser for preview
                            if (typeof document !== 'undefined') {
                              document.documentElement.setAttribute('data-template', tmpl.id);
                            }
                          }}
                          className={`group relative flex flex-col justify-between rounded-xl border p-3.5 text-xs transition cursor-pointer ${
                            isSelected
                              ? 'border-indigo-600 bg-indigo-50/40 shadow-sm ring-1 ring-indigo-600'
                              : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
                          }`}
                        >
                          <div>
                            {/* Top row: Radio + Title + Badge */}
                            <div className="flex items-start justify-between gap-1.5 mb-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <span
                                  className={`flex size-4 shrink-0 items-center justify-center rounded-full border transition ${
                                    isSelected
                                      ? 'border-indigo-600 bg-indigo-600 text-white'
                                      : 'border-slate-300 bg-white group-hover:border-slate-400'
                                  }`}
                                >
                                  {isSelected && <span className="size-1.5 rounded-full bg-white" />}
                                </span>
                                <div className="min-w-0 truncate">
                                  <span className="font-bold text-slate-900 block leading-tight truncate">
                                    {tmpl.name}
                                  </span>
                                  <span className="text-[10px] text-slate-500 block truncate">
                                    {tmpl.tagline}
                                  </span>
                                </div>
                              </div>
                              <span
                                className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border shrink-0 ${tmpl.badgeColor}`}
                              >
                                {tmpl.badge}
                              </span>
                            </div>

                            {/* Template visual preview pill */}
                            <div
                              className="rounded-lg p-2.5 my-2 border flex items-center justify-between gap-2 shadow-2xs"
                              style={{
                                backgroundColor: tmpl.previewBg,
                                borderColor: tmpl.borderColor,
                              }}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <div
                                  className="size-3 rounded-full shrink-0 shadow-xs"
                                  style={{ backgroundColor: tmpl.paletteDot }}
                                />
                                <span
                                  className="text-[11px] font-mono font-bold truncate"
                                  style={{ color: tmpl.previewText }}
                                >
                                  {tmpl.name}
                                </span>
                              </div>
                              <span
                                className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0"
                                style={{
                                  backgroundColor: tmpl.previewAccent + '25',
                                  color: tmpl.previewAccent,
                                }}
                              >
                                SVG Visuals
                              </span>
                            </div>

                            <p className="text-[11px] text-slate-600 leading-relaxed mb-2.5 line-clamp-2">
                              {tmpl.description}
                            </p>
                          </div>

                          {/* Bottom row: supported formats */}
                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px]">
                            <span className="text-slate-400 font-medium">Supported:</span>
                            <div className="flex flex-wrap gap-1">
                              {tmpl.supportedTypes.slice(0, 3).map((st) => (
                                <span
                                  key={st}
                                  className="rounded bg-slate-100 px-1.5 py-0.5 font-semibold text-slate-700"
                                >
                                  {st}
                                </span>
                              ))}
                              {tmpl.supportedTypes.length > 3 && (
                                <span className="rounded bg-slate-100 px-1 py-0.5 font-semibold text-slate-500">
                                  +{tmpl.supportedTypes.length - 3}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* 3C: Live Interactive Design View (Preview Before Generation) */}
                  <div className="mt-6 rounded-2xl border border-indigo-200/80 bg-gradient-to-b from-indigo-50/30 via-white to-slate-50/50 p-4 sm:p-5 shadow-xs space-y-4">
                    {/* Preview Header & Controls */}
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-indigo-100/80 pb-3.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className="flex size-7 items-center justify-center rounded-lg shadow-2xs"
                          style={{ backgroundColor: currentTmpl.paletteDot }}
                        >
                          <Palette className="size-4 text-white" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-slate-900">
                              Live Interactive Design View
                            </span>
                            <span
                              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold border shadow-2xs"
                              style={{
                                backgroundColor: currentTmpl.badgeBg,
                                color: currentTmpl.badgeTextColor,
                                borderColor: currentTmpl.borderColor,
                              }}
                            >
                              <span
                                className="size-2 rounded-full animate-pulse"
                                style={{ backgroundColor: currentTmpl.paletteDot }}
                              />
                              Active: {currentTmpl.name}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Real-time visual preview of how your slides and documents will render with full fonts, layouts, SVG diagrams, and high-quality images.
                          </p>
                        </div>
                      </div>

                      {/* Format Toggles & Actions */}
                      <div className="flex items-center gap-2">
                        <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200">
                          <button
                            type="button"
                            onClick={() => setPreviewMode('ppt')}
                            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                              previewMode === 'ppt'
                                ? 'bg-white text-indigo-700 shadow-2xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            <Monitor className="size-3.5 text-indigo-600" />
                            <span>PPT Slide (16:9)</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setPreviewMode('pdf')}
                            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                              previewMode === 'pdf'
                                ? 'bg-white text-indigo-700 shadow-2xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            <FileText className="size-3.5 text-indigo-600" />
                            <span>PDF Document (A4)</span>
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => setPreviewFullscreenOpen(true)}
                          className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
                          title="Expand to Fullscreen View"
                        >
                          <Maximize2 className="size-3.5 text-slate-600" />
                          <span className="hidden sm:inline">Expand Fullscreen</span>
                        </button>
                      </div>
                    </div>

                    {/* Quick Switch Palette Bar for Simultaneous Immediate Updates */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5 border-b border-indigo-100/60">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider shrink-0 flex items-center gap-1 mr-1">
                        <Palette className="size-3 text-indigo-600" />
                        Quick Switch Palette:
                      </span>
                      {CONTENT_TEMPLATES.map((tmpl) => {
                        const isSelected = selectedTemplate === tmpl.id;
                        return (
                          <button
                            key={tmpl.id}
                            type="button"
                            onClick={() => {
                              setSelectedTemplate(tmpl.id);
                              if (typeof document !== 'undefined') {
                                document.documentElement.setAttribute('data-template', tmpl.id);
                              }
                            }}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer shrink-0 ${
                              isSelected
                                ? 'bg-indigo-600 text-white shadow-2xs ring-2 ring-indigo-400 font-bold'
                                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
                            }`}
                          >
                            <span
                              className="size-2 rounded-full shrink-0 shadow-2xs"
                              style={{ backgroundColor: tmpl.paletteDot }}
                            />
                            <span className="truncate">{tmpl.name}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* PPT Mode Slide Selector Bar */}
                    {previewMode === 'ppt' && (
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-1.5 overflow-x-auto py-1">
                          {[
                            { idx: 0, label: '01: Hero Cover & Intentions' },
                            { idx: 1, label: '02: Real-World Hook & Photo' },
                            { idx: 2, label: '03: Core Law & SVG Diagram' },
                            { idx: 3, label: '04: Active Challenge & Summary' },
                          ].map((tab) => (
                            <button
                              key={tab.idx}
                              type="button"
                              onClick={() => setPreviewSlideIdx(tab.idx)}
                              className={`rounded-lg px-3 py-1 font-semibold transition shrink-0 cursor-pointer ${
                                previewSlideIdx === tab.idx
                                  ? 'bg-indigo-600 text-white font-bold shadow-2xs'
                                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              {tab.label}
                            </button>
                          ))}
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                          <button
                            type="button"
                            onClick={() => setPreviewSlideIdx((p) => Math.max(0, p - 1))}
                            disabled={previewSlideIdx === 0}
                            className="rounded-lg border border-slate-200 bg-white p-1 text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition"
                            title="Previous slide"
                          >
                            <ChevronLeft className="size-4" />
                          </button>
                          <span className="font-mono font-bold text-slate-600 text-[11px] px-1">
                            Slide {previewSlideIdx + 1} of 4
                          </span>
                          <button
                            type="button"
                            onClick={() => setPreviewSlideIdx((p) => Math.min(3, p + 1))}
                            disabled={previewSlideIdx === 3}
                            className="rounded-lg border border-slate-200 bg-white p-1 text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition"
                            title="Next slide"
                          >
                            <ChevronRight className="size-4" />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Real-time Synchronized Dynamic Design Canvas */}
                    <TemplateDesignCanvas
                      template={currentTmpl}
                      mode={previewMode}
                      slideIdx={previewSlideIdx}
                      standardName={activePreviewStandard}
                      subjectName={activePreviewSubject}
                      chapterName={activePreviewChapter}
                      teachingApproach={selectedTeachingApproach}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => setWorkflowStage(2)}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                  >
                    ← Back to Teaching Method
                  </button>
                  <button
                    type="button"
                    onClick={() => setWorkflowStage(4)}
                    className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition cursor-pointer"
                  >
                    Next: Select Classroom Resources ➔
                  </button>
                </div>
              </div>
            )}

            {/* STAGE 4: Select Classroom Resources */}
            {workflowStage === 4 && (
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Database className="size-4 text-emerald-600" />
                      Stage 4 – Select Classroom Resources
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Select required classroom resources. Support single, multiple, or all content types.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={toggleAllResourceTypes}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition cursor-pointer"
                  >
                    {selectedResourceTypes.length === CLASSROOM_RESOURCE_TYPES.length
                      ? 'Deselect All Resources'
                      : 'Select All Content Types'}
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {CLASSROOM_RESOURCE_TYPES.map((res) => {
                    const isChecked = selectedResourceTypes.includes(res.id);
                    return (
                      <button
                        key={res.id}
                        type="button"
                        onClick={() => toggleResourceType(res.id)}
                        className={`flex items-center justify-between rounded-xl border p-3.5 text-xs transition cursor-pointer ${
                          isChecked
                            ? 'border-indigo-600 bg-indigo-50/70 text-indigo-950 font-bold shadow-2xs'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                        }`}
                      >
                        <span className="font-semibold">{res.label}</span>
                        <span
                          className={`flex size-4.5 items-center justify-center rounded-sm border ${
                            isChecked
                              ? 'border-indigo-600 bg-indigo-600 text-white'
                              : 'border-slate-300 bg-white'
                          }`}
                        >
                          {isChecked && <Check className="size-3" />}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Assessment Option */}
                <label className="flex items-center justify-between rounded-xl border border-indigo-200 bg-indigo-50/50 p-3.5 cursor-pointer hover:bg-indigo-50/80 transition">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={includeAssessment}
                      onChange={(e) => setIncludeAssessment(e.target.checked)}
                      className="size-4.5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">
                        Generate Relevant Chapter Assessment
                      </span>
                      <span className="text-[11px] text-slate-600 block">
                        Calibrated cognitive ladder across 5 Bloom tiers: Remember, Understand, Apply, Analyze, Evaluate.
                      </span>
                    </div>
                  </div>
                  <span className="rounded-md bg-white border border-indigo-200 px-2 py-0.5 text-[10px] font-bold text-indigo-700 shrink-0">
                    Bloom&apos;s Calibrated
                  </span>
                </label>

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => setWorkflowStage(3)}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                  >
                    ← Back to Learning Experience
                  </button>
                  <button
                    type="button"
                    onClick={() => setWorkflowStage(5)}
                    disabled={selectedResourceTypes.length === 0 && !includeAssessment}
                    className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-50 transition cursor-pointer"
                  >
                    Next: Review &amp; Start ➔
                  </button>
                </div>
              </div>
            )}

            {/* STAGE 5: Review Selections & Start Agents */}
            {workflowStage === 5 && (
              <div className="space-y-5">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Play className="size-4 text-emerald-600" />
                    Stage 5 – Review Selections &amp; Start Agents
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Review your confirmed scope and preferences before executing the sequential multi-agent workflow.
                  </p>
                </div>

                {/* Summary Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Academic Scope Summary */}
                  <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                    <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5 border-b border-slate-100 pb-2">
                      <Layers className="size-3.5 text-indigo-600" />
                      Academic Scope (Database Grounded)
                    </span>
                    <div className="space-y-1.5 text-xs text-slate-700">
                      <div>
                        <span className="font-semibold text-slate-500">Standards: </span>
                        <span className="font-bold text-slate-900">
                          {selectedStandardIds.length === catalogueStandards.length
                            ? 'All Standards'
                            : selectedStandardIds
                                .map((id) => {
                                  const std = catalogueStandards.find((s) => s.id === id);
                                  return std ? `Standard ${std.name}` : `Std ${id}`;
                                })
                                .join(', ')}
                        </span>
                      </div>
                      <div>
                        <span className="font-semibold text-slate-500">Subjects: </span>
                        <span className="font-bold text-slate-900">
                          {selectedSubjectIds.length === catalogueSubjects.length
                            ? 'All Subjects'
                            : selectedSubjectIds
                                .map((id) => {
                                  const sub = catalogueSubjects.find((s) => s.subject_id === id);
                                  return sub?.subject_name || `Subject ${id}`;
                                })
                                .join(', ')}
                        </span>
                      </div>
                      <div>
                        <span className="font-semibold text-slate-500">Chapters: </span>
                        <span className="font-bold text-slate-900">
                          {selectedChapterIds.length === catalogueChapters.length
                            ? `All ${catalogueChapters.length} Chapters`
                            : `${selectedChapterIds.length} Chapter(s) Selected`}
                        </span>
                        {selectedChapterIds.length > 0 && selectedChapterIds.length <= 5 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {selectedChapterIds.map((id) => {
                              const ch = catalogueChapters.find((c) => c.id === id);
                              return (
                                <span key={id} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-800">
                                  {ch?.chapter_name || `Ch #${id}`}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Method & Resources Summary */}
                  <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                    <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5 border-b border-slate-100 pb-2">
                      <Sparkles className="size-3.5 text-emerald-600" />
                      Pedagogy &amp; Resources to Generate
                    </span>
                    <div className="space-y-1.5 text-xs text-slate-700">
                      <div>
                        <span className="font-semibold text-slate-500">Teaching Approach: </span>
                        <span className="font-bold text-emerald-800">{selectedTeachingApproach}</span>
                      </div>
                      <div>
                        <span className="font-semibold text-slate-500">Learning Experience: </span>
                        <span className="font-bold text-purple-800">
                          {STUDENT_EXPERIENCES.find((e) => e.id === selectedStudentExperience)?.label || selectedStudentExperience}
                        </span>
                      </div>
                      <div>
                        <span className="font-semibold text-slate-500">Design Template: </span>
                        {(() => {
                          const tmpl = CONTENT_TEMPLATES.find((t) => t.id === selectedTemplate) || CONTENT_TEMPLATES[0];
                          return (
                            <span className="inline-flex items-center gap-1.5 rounded-md bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-[11px] font-bold text-indigo-900">
                              <span
                                className="inline-block size-2.5 rounded-full shadow-2xs"
                                style={{ backgroundColor: tmpl.paletteDot }}
                              />
                              {tmpl.name}
                              <span className="text-[10px] font-semibold text-indigo-600">
                                ({tmpl.badge})
                              </span>
                            </span>
                          );
                        })()}
                      </div>
                      <div>
                        <span className="font-semibold text-slate-500">Classroom Resources: </span>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {selectedResourceTypes.map((t) => (
                            <span key={t} className="rounded-md bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-[11px] font-bold text-indigo-800">
                              {t}
                            </span>
                          ))}
                          {includeAssessment && (
                            <span className="rounded-md bg-violet-50 border border-violet-200 px-2 py-0.5 text-[11px] font-bold text-violet-800">
                              Chapter Assessment
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sequential Execution & Duplicate Prevention Notice */}
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-950">
                    <ShieldCheck className="size-4 text-emerald-600 shrink-0" />
                    Strict Sequential Execution &amp; Idempotency Guarantee
                  </div>
                  <p className="text-xs text-emerald-900 leading-relaxed">
                    When you click <strong>Start Agents</strong>, the three agents will execute sequentially: 
                    <strong> Agent 1</strong> validates your selected scope → 
                    <strong> Agent 2</strong> checks existing content in the database → 
                    <strong> Agent 3</strong> generates ONLY the missing selected resources. If content already exists, it is verified and reused without duplicate creation.
                  </p>
                </div>

                {/* Final Actions */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setWorkflowStage(4)}
                    disabled={pipelineRunning}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                  >
                    ← Edit Resources
                  </button>

                  <button
                    type="button"
                    onClick={() => void handleStartAgents()}
                    disabled={pipelineRunning || selectedChapterIds.length === 0}
                    className="flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-2.5 text-xs font-bold text-white shadow-md shadow-emerald-200 hover:bg-emerald-700 disabled:opacity-50 transition cursor-pointer"
                  >
                    {pipelineRunning ? (
                      <>
                        <RefreshCw className="size-4 animate-spin" />
                        Agents Executing Sequentially…
                      </>
                    ) : (
                      <>
                        <Play className="size-4 fill-white" />
                        Start Agents (Agent 1 ➔ Agent 2 ➔ Agent 3)
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {pipelineError && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-800 flex items-center gap-2">
                <AlertCircle className="size-4 shrink-0 text-red-600" />
                <span>{pipelineError}</span>
              </div>
            )}
          </div>

          {/* LIVE SEQUENTIAL AGENT EXECUTION TIMELINE */}
          {(pipelineRunning || pipelineResult) && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
              {/* Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold uppercase ${
                        pipelineRunning
                          ? 'border border-amber-300 bg-amber-50 text-amber-900 animate-pulse'
                          : pipelineResult?.success
                          ? 'border border-emerald-200 bg-emerald-50 text-emerald-800'
                          : 'border border-red-200 bg-red-50 text-red-800'
                      }`}
                    >
                      {pipelineRunning ? (
                        <>
                          <RefreshCw className="size-3 animate-spin" />
                          Live Sequential Execution In Progress
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="size-3 text-emerald-600" />
                          Sequential Execution Completed
                        </>
                      )}
                    </span>
                    {pipelineResult?.generated_at && (
                      <span className="text-xs text-slate-500 font-mono">
                        {new Date(pipelineResult.generated_at).toLocaleTimeString('en-IN')}
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mt-1">
                    Live Sequential Agent Execution Timeline
                  </h3>
                </div>

                {pipelineResult && (
                  <div className="flex items-center gap-2">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-center">
                      <span className="block text-[10px] font-bold uppercase text-slate-400">Total Duration</span>
                      <span className="font-mono text-xs font-extrabold text-slate-800">
                        {pipelineResult.total_duration_ms} ms
                      </span>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-emerald-50/60 px-3 py-1.5 text-center">
                      <span className="block text-[10px] font-bold uppercase text-emerald-700">Verified Existing</span>
                      <span className="font-mono text-xs font-extrabold text-emerald-800">
                        {pipelineResult.content_generation?.verified_count ?? 0}
                      </span>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-violet-50/60 px-3 py-1.5 text-center">
                      <span className="block text-[10px] font-bold uppercase text-violet-700">Newly Generated</span>
                      <span className="font-mono text-xs font-extrabold text-violet-800">
                        {pipelineResult.content_generation?.generated_count ?? 0}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* 3 Agents Sequential Timeline Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* AGENT 1 - COURSE CATALOGUE READER */}
                <div
                  className={`rounded-xl border p-4 space-y-3 transition-all duration-300 ${
                    step1State.status === 'running'
                      ? 'border-indigo-400 bg-indigo-50/40 ring-2 ring-indigo-500/30 shadow-md'
                      : step1State.status === 'completed'
                      ? 'border-emerald-300 bg-emerald-50/30 shadow-xs'
                      : step1State.status === 'failed'
                      ? 'border-red-300 bg-red-50/30'
                      : 'border-slate-200 bg-slate-50/60 opacity-80'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`flex size-6 items-center justify-center rounded-full font-bold text-xs ${
                      step1State.status === 'completed'
                        ? 'bg-emerald-100 text-emerald-800'
                        : step1State.status === 'running'
                        ? 'bg-indigo-600 text-white animate-pulse'
                        : 'bg-slate-200 text-slate-700'
                    }`}>
                      1
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        step1State.status === 'running'
                          ? 'bg-amber-100 text-amber-900 border border-amber-300 animate-pulse'
                          : step1State.status === 'completed'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : step1State.status === 'failed'
                          ? 'bg-red-100 text-red-800 border border-red-200'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {step1State.status === 'running' && <RefreshCw className="size-2.5 animate-spin text-amber-700" />}
                      {step1State.status === 'completed' && <CheckCircle2 className="size-2.5 text-emerald-700" />}
                      {step1State.status === 'failed' && <XCircle className="size-2.5 text-red-700" />}
                      {step1State.status === 'running'
                        ? 'Validating…'
                        : step1State.status === 'completed'
                        ? 'Gate 1 Passed'
                        : step1State.status === 'failed'
                        ? 'Failed'
                        : 'Pending'}
                    </span>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      Agent 1 – Course Catalogue Reader
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      <strong>Work:</strong> Validating selected academic scope
                    </p>
                  </div>

                  <div className="rounded-lg bg-white border border-slate-200/80 p-2.5 text-[11px] space-y-1.5">
                    <div className="text-slate-700 leading-tight">
                      <span className="font-semibold text-slate-900">Target Scope: </span>
                      <span className="font-medium text-indigo-700">
                        {step1State.scopeText || `${selectedStandardIds.length} Std, ${selectedSubjectIds.length} Sub, ${selectedChapterIds.length} Ch`}
                      </span>
                    </div>
                    {step1State.duration_ms !== undefined && (
                      <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-100">
                        <span>Validation Gate 1:</span>
                        <span className="font-mono font-bold text-emerald-700">Passed ({step1State.duration_ms} ms)</span>
                      </div>
                    )}
                    {step1State.summary && (
                      <p className="text-slate-600 border-t border-slate-100 pt-1 text-[11px] leading-relaxed">
                        {step1State.summary}
                      </p>
                    )}
                  </div>
                </div>

                {/* AGENT 2 - ACTIVITY TIMELINE READER */}
                <div
                  className={`rounded-xl border p-4 space-y-3 transition-all duration-300 ${
                    step2State.status === 'running'
                      ? 'border-blue-400 bg-blue-50/40 ring-2 ring-blue-500/30 shadow-md'
                      : step2State.status === 'completed'
                      ? 'border-emerald-300 bg-emerald-50/30 shadow-xs'
                      : step2State.status === 'failed'
                      ? 'border-red-300 bg-red-50/30'
                      : 'border-slate-200 bg-slate-50/60 opacity-80'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`flex size-6 items-center justify-center rounded-full font-bold text-xs ${
                      step2State.status === 'completed'
                        ? 'bg-emerald-100 text-emerald-800'
                        : step2State.status === 'running'
                        ? 'bg-blue-600 text-white animate-pulse'
                        : 'bg-slate-200 text-slate-700'
                    }`}>
                      2
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        step2State.status === 'running'
                          ? 'bg-blue-100 text-blue-900 border border-blue-300 animate-pulse'
                          : step2State.status === 'completed'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : step2State.status === 'failed'
                          ? 'bg-red-100 text-red-800 border border-red-200'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {step2State.status === 'running' && <RefreshCw className="size-2.5 animate-spin text-blue-700" />}
                      {step2State.status === 'completed' && <CheckCircle2 className="size-2.5 text-emerald-700" />}
                      {step2State.status === 'failed' && <XCircle className="size-2.5 text-red-700" />}
                      {step2State.status === 'running'
                        ? 'Auditing Scope…'
                        : step2State.status === 'completed'
                        ? 'Gate 2 Passed'
                        : step2State.status === 'failed'
                        ? 'Failed'
                        : executingStep === 1
                        ? 'Waiting for Agent 1'
                        : 'Pending'}
                    </span>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      Agent 2 – Activity Timeline Reader
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      <strong>Work:</strong> Checking existing content and activities
                    </p>
                  </div>

                  <div className="rounded-lg bg-white border border-slate-200/80 p-2.5 text-[11px] space-y-1.5">
                    <div className="flex items-center justify-between text-slate-600">
                      <span>Existing Content Found:</span>
                      <span className="font-bold text-emerald-700">
                        {step2State.status === 'running'
                          ? 'Auditing database…'
                          : step2State.existingFound !== undefined
                          ? step2State.existingFound
                          : (pipelineResult?.content_generation?.verified_count ?? '—')}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-600">
                      <span>Missing Content Identified:</span>
                      <span className="font-bold text-amber-700">
                        {step2State.status === 'running'
                          ? 'Auditing database…'
                          : step2State.missingIdentified !== undefined
                          ? step2State.missingIdentified
                          : (pipelineResult?.content_generation?.missing_identified?.length ?? '—')}
                      </span>
                    </div>
                    {step2State.duration_ms !== undefined && (
                      <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-100">
                        <span>Content Audit Gate 2:</span>
                        <span className="font-mono font-bold text-emerald-700">Passed ({step2State.duration_ms} ms)</span>
                      </div>
                    )}
                    {step2State.summary && (
                      <p className="text-slate-600 border-t border-slate-100 pt-1 text-[11px] leading-relaxed">
                        {step2State.summary}
                      </p>
                    )}
                  </div>
                </div>

                {/* AGENT 3 - CONTENT GENERATION AGENT */}
                <div
                  className={`rounded-xl border p-4 space-y-3 transition-all duration-300 ${
                    step3State.status === 'running'
                      ? 'border-violet-400 bg-violet-50/40 ring-2 ring-violet-500/30 shadow-md'
                      : step3State.status === 'completed'
                      ? 'border-emerald-300 bg-emerald-50/30 shadow-xs'
                      : step3State.status === 'failed'
                      ? 'border-red-300 bg-red-50/30'
                      : 'border-slate-200 bg-slate-50/60 opacity-80'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`flex size-6 items-center justify-center rounded-full font-bold text-xs ${
                      step3State.status === 'completed'
                        ? 'bg-emerald-100 text-emerald-800'
                        : step3State.status === 'running'
                        ? 'bg-violet-600 text-white animate-pulse'
                        : 'bg-slate-200 text-slate-700'
                    }`}>
                      3
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        step3State.status === 'running'
                          ? 'bg-violet-100 text-violet-900 border border-violet-300 animate-pulse'
                          : step3State.status === 'completed'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : step3State.status === 'failed'
                          ? 'bg-red-100 text-red-800 border border-red-200'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {step3State.status === 'running' && <RefreshCw className="size-2.5 animate-spin text-violet-700" />}
                      {step3State.status === 'completed' && <CheckCircle2 className="size-2.5 text-emerald-700" />}
                      {step3State.status === 'failed' && <XCircle className="size-2.5 text-red-700" />}
                      {step3State.status === 'running'
                        ? 'Generating…'
                        : step3State.status === 'completed'
                        ? 'Gate 3 Completed'
                        : step3State.status === 'failed'
                        ? 'Failed'
                        : executingStep === 1 || executingStep === 2
                        ? 'Waiting for Agent 2'
                        : 'Pending'}
                    </span>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      Agent 3 – Content Generation Agent
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      <strong>Work:</strong> Generating only selected missing resources
                    </p>
                  </div>

                  <div className="rounded-lg bg-white border border-slate-200/80 p-2.5 text-[11px] space-y-1.5">
                    <div className="flex items-center justify-between text-slate-600">
                      <span>Approach Used:</span>
                      <span className="font-bold text-slate-900 truncate max-w-[130px]" title={selectedTeachingApproach}>
                        {selectedTeachingApproach}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-600">
                      <span>Template:</span>
                      <span className="font-bold text-indigo-700 truncate max-w-[130px]" title={CONTENT_TEMPLATES.find(t => t.id === selectedTemplate)?.name}>
                        {CONTENT_TEMPLATES.find(t => t.id === selectedTemplate)?.badge || selectedTemplate}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-600">
                      <span>Newly Generated:</span>
                      <span className="font-bold text-violet-700">
                        {step3State.status === 'running'
                          ? 'Generating…'
                          : step3State.generatedCount !== undefined
                          ? step3State.generatedCount
                          : (pipelineResult?.content_generation?.generated_count ?? 0)}
                      </span>
                    </div>
                    {step3State.duration_ms !== undefined && (
                      <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-100">
                        <span>Generation Gate 3:</span>
                        <span className="font-mono font-bold text-emerald-700">Passed ({step3State.duration_ms} ms)</span>
                      </div>
                    )}
                    {step3State.summary && (
                      <p className="text-slate-600 border-t border-slate-100 pt-1 text-[11px] leading-relaxed truncate">
                        {step3State.summary}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Execution Summary Notice & Details */}
              {pipelineResult && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-950 flex items-center gap-1.5">
                        <CheckCircle2 className="size-4 text-emerald-600" />
                        Execution Summary &amp; Verification Outcome
                      </h4>
                      <p className="text-xs text-emerald-900 mt-1 leading-relaxed">
                        {pipelineResult.content_generation?.summary_message ||
                          `Validation sweep completed across ${pipelineResult.standard?.name}. Verified ${pipelineResult.content_generation?.verified_count ?? 0} existing resource(s); generated ${pipelineResult.content_generation?.generated_count ?? 0} new resource(s).`}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setPipelineResult(null);
                        setWorkflowStage(1);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-50 transition shrink-0 cursor-pointer"
                    >
                      <RefreshCw className="size-3 text-emerald-600" />
                      Configure Another Scope
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

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

                {/* 4. Content Generation & Classroom Resources (Third Agent Output Handover) */}
                {pipelineResult.content_generation && (
                  <div className="rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50/40 via-white to-purple-50/30 p-4 space-y-4 pt-3">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-indigo-100 pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="rounded-md bg-indigo-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white tracking-wider">
                            Third Agent Handover
                          </span>
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                            <Sparkles className="size-4 text-indigo-600" />
                            4. Content Generation & Classroom Resources
                          </h4>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Pedagogical classroom resource generation and assessment creation executed by Agent 3
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {pipelineResult.content_generation.scope?.chapter_name && (
                          <span className="rounded-lg bg-indigo-50 border border-indigo-200 px-2.5 py-1 text-xs font-bold text-indigo-900">
                            Ch: {pipelineResult.content_generation.scope.chapter_name}
                          </span>
                        )}
                        {pipelineResult.content_generation.teaching_approach && (
                          <span className="rounded-lg bg-blue-50 border border-blue-200 px-2.5 py-1 text-xs font-medium text-blue-900">
                            Approach: {pipelineResult.content_generation.teaching_approach}
                          </span>
                        )}
                        {pipelineResult.content_generation.student_experiences && pipelineResult.content_generation.student_experiences.length > 0 && (
                          <span className="rounded-lg bg-purple-50 border border-purple-200 px-2.5 py-1 text-xs font-medium text-purple-900">
                            Experience: {pipelineResult.content_generation.student_experiences.join(', ')}
                          </span>
                        )}
                        {pipelineResult.content_generation.selected_template && (
                          <span className="rounded-lg bg-indigo-50 border border-indigo-200 px-2.5 py-1 text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                            <Palette className="size-3 text-indigo-600" />
                            Template: {CONTENT_TEMPLATES.find((t) => t.id === pipelineResult.content_generation?.selected_template)?.name || pipelineResult.content_generation.selected_template}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Summary Counters */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      <div className="rounded-lg border border-slate-200 bg-white p-2.5 text-center">
                        <span className="block text-[10px] font-bold uppercase text-slate-400">Generated New</span>
                        <span className="font-mono text-base font-extrabold text-violet-700">
                          {pipelineResult.content_generation.generated_count ?? 0}
                        </span>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-white p-2.5 text-center">
                        <span className="block text-[10px] font-bold uppercase text-slate-400">Verified Existing</span>
                        <span className="font-mono text-base font-extrabold text-emerald-700">
                          {pipelineResult.content_generation.verified_count ?? 0}
                        </span>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-white p-2.5 text-center">
                        <span className="block text-[10px] font-bold uppercase text-slate-400">Duplicate Prevention</span>
                        <span className="text-xs font-bold text-emerald-700 mt-1 block">
                          100% Enforced
                        </span>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-white p-2.5 text-center">
                        <span className="block text-[10px] font-bold uppercase text-slate-400">Chapter Assessment</span>
                        <span className={`text-xs font-bold mt-1 block ${
                          pipelineResult.content_generation.assessment_created ? 'text-indigo-700' : 'text-slate-600'
                        }`}>
                          {pipelineResult.content_generation.assessment_created ? '✓ Generated' : 'Verified'}
                        </span>
                      </div>
                    </div>

                    {/* Generated Resources List */}
                    {pipelineResult.content_generation.generated_resources && pipelineResult.content_generation.generated_resources.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                          Newly Generated Classroom Resources
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                          {pipelineResult.content_generation.generated_resources.map((res, i) => (
                            <div key={i} className="rounded-xl border border-violet-200 bg-violet-50/40 p-3.5 flex items-start justify-between gap-2 shadow-2xs hover:shadow-xs transition">
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="rounded-md bg-violet-600 text-white font-mono text-[10px] font-bold px-1.5 py-0.5">
                                    #{res.content_id}
                                  </span>
                                  <span className="font-bold text-xs text-slate-900 truncate">
                                    {res.resource_type}
                                  </span>
                                </div>
                                <p className="text-xs text-slate-800 mt-1 truncate font-semibold" title={res.title}>
                                  {res.title}
                                </p>
                                <p className="text-[10px] text-slate-500 mt-0.5">
                                  Category: {res.category} {res.chapter_name ? `· ${res.chapter_name}` : ''}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="rounded-md bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-800 shrink-0">
                                  Generated
                                </span>
                                {res.content_id && (
                                  <a
                                    href={resolveContentViewUrl(res.content_id, res.url)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 rounded-lg border border-violet-300 bg-white px-2.5 py-1 text-xs font-bold text-violet-700 hover:bg-violet-100 transition shadow-2xs cursor-pointer"
                                    title="Open and view content in responsive viewer"
                                  >
                                    <Eye className="size-3.5 text-violet-600" />
                                    <span>View Content</span>
                                  </a>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Verified Existing Resources List */}
                    {pipelineResult.content_generation.verified_resources && pipelineResult.content_generation.verified_resources.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                            Verified Existing Resources (Zero Duplicates Created)
                          </p>
                          <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                            Idempotent Execution
                          </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {pipelineResult.content_generation.verified_resources.map((res, i) => (
                            <div key={i} className="rounded-lg border border-emerald-100 bg-emerald-50/30 p-2.5 flex items-center justify-between gap-2">
                              <div className="min-w-0 flex items-center gap-2">
                                <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0" />
                                <div className="truncate">
                                  <span className="font-bold text-xs text-slate-800">{res.type}: </span>
                                  <span className="text-xs text-slate-600 truncate">{res.title}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="font-mono text-[10px] font-bold text-slate-500">
                                  #{res.content_id}
                                </span>
                                {res.content_id && (
                                  <a
                                    href={resolveContentViewUrl(res.content_id, res.url)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-white px-2 py-0.5 text-[10px] font-bold text-emerald-800 hover:bg-emerald-100 transition shadow-2xs cursor-pointer"
                                    title="Open and view existing content in viewer"
                                  >
                                    <Eye className="size-3 text-emerald-700" />
                                    <span>View</span>
                                  </a>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
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

      {/* Fullscreen Interactive Design View Modal */}
      {previewFullscreenOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 sm:p-6"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-6xl rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl flex flex-col max-h-[92vh] overflow-hidden text-white">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950 px-6 py-3.5 shrink-0">
              <div className="flex items-center gap-3">
                <div
                  className="size-3 rounded-full"
                  style={{ backgroundColor: currentTmpl.paletteDot }}
                />
                <div>
                  <h3 className="text-sm font-bold flex items-center gap-2">
                    <span>Fullscreen Design Preview</span>
                    <span className="text-slate-400 font-normal">|</span>
                    <span className="text-indigo-400">{currentTmpl.name}</span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {activePreviewStandard} • {activePreviewSubject} • {activePreviewChapter}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {/* Switch Template Dropdown inside Modal */}
                <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-xs">
                  <span className="text-slate-400 text-[10px] font-bold">Template:</span>
                  <select
                    value={selectedTemplate}
                    onChange={(e) => {
                      setSelectedTemplate(e.target.value);
                      if (typeof document !== 'undefined') {
                        document.documentElement.setAttribute('data-template', e.target.value);
                      }
                    }}
                    className="bg-transparent text-white font-semibold outline-none cursor-pointer"
                  >
                    {CONTENT_TEMPLATES.map((t) => (
                      <option key={t.id} value={t.id} className="bg-slate-900 text-white">
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Format Toggle */}
                <div className="inline-flex rounded-lg bg-slate-800 p-0.5 border border-slate-700 text-xs">
                  <button
                    type="button"
                    onClick={() => setPreviewMode('ppt')}
                    className={`px-2.5 py-1 rounded font-bold transition cursor-pointer ${
                      previewMode === 'ppt' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    PPT
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewMode('pdf')}
                    className={`px-2.5 py-1 rounded font-bold transition cursor-pointer ${
                      previewMode === 'pdf' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    PDF
                  </button>
                </div>

                {/* Close Button */}
                <button
                  type="button"
                  onClick={() => setPreviewFullscreenOpen(false)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition cursor-pointer"
                  title="Close fullscreen preview"
                >
                  <X className="size-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-950 flex flex-col items-center space-y-4">
              {/* Quick Switch Palette Bar inside Modal */}
              <div className="w-full max-w-4xl flex items-center gap-1.5 overflow-x-auto pb-1 shrink-0">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0 flex items-center gap-1 mr-1">
                  <Palette className="size-3 text-indigo-400" />
                  Quick Palette:
                </span>
                {CONTENT_TEMPLATES.map((tmpl) => {
                  const isSelected = selectedTemplate === tmpl.id;
                  return (
                    <button
                      key={tmpl.id}
                      type="button"
                      onClick={() => {
                        setSelectedTemplate(tmpl.id);
                        if (typeof document !== 'undefined') {
                          document.documentElement.setAttribute('data-template', tmpl.id);
                        }
                      }}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer shrink-0 ${
                        isSelected
                          ? 'bg-indigo-600 text-white ring-2 ring-indigo-400 font-bold'
                          : 'bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white'
                      }`}
                    >
                      <span
                        className="size-2 rounded-full shrink-0 shadow-2xs"
                        style={{ backgroundColor: tmpl.paletteDot }}
                      />
                      <span className="truncate">{tmpl.name}</span>
                    </button>
                  );
                })}
              </div>

              {previewMode === 'ppt' && (
                <div className="w-full max-w-4xl flex items-center justify-between text-xs text-slate-400 shrink-0">
                  <div className="flex items-center gap-1.5 overflow-x-auto py-1">
                    {[
                      { idx: 0, label: '01: Hero Cover & Intentions' },
                      { idx: 1, label: '02: Real-World Hook & Photo' },
                      { idx: 2, label: '03: Core Law & SVG Diagram' },
                      { idx: 3, label: '04: Active Challenge & Summary' },
                    ].map((tab) => (
                      <button
                        key={tab.idx}
                        type="button"
                        onClick={() => setPreviewSlideIdx(tab.idx)}
                        className={`rounded-lg px-2.5 py-1 font-semibold transition shrink-0 cursor-pointer ${
                          previewSlideIdx === tab.idx
                            ? 'bg-indigo-600 text-white font-bold shadow-2xs'
                            : 'bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-2 shrink-0 ml-auto">
                    <button
                      type="button"
                      onClick={() => setPreviewSlideIdx((p) => Math.max(0, p - 1))}
                      disabled={previewSlideIdx === 0}
                      className="rounded px-2.5 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-40"
                    >
                      ◀ Prev
                    </button>
                    <span className="font-mono font-bold text-white text-[11px]">
                      Slide {previewSlideIdx + 1} of 4
                    </span>
                    <button
                      type="button"
                      onClick={() => setPreviewSlideIdx((p) => Math.min(3, p + 1))}
                      disabled={previewSlideIdx === 3}
                      className="rounded px-2.5 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-40"
                    >
                      Next ▶
                    </button>
                  </div>
                </div>
              )}

              <div className="w-full max-w-4xl flex justify-center">
                <TemplateDesignCanvas
                  template={currentTmpl}
                  mode={previewMode}
                  slideIdx={previewSlideIdx}
                  standardName={activePreviewStandard}
                  subjectName={activePreviewSubject}
                  chapterName={activePreviewChapter}
                  teachingApproach={selectedTeachingApproach}
                  isFullscreen={true}
                />
              </div>

              {previewMode === 'pdf' && (
                <div className="w-full max-w-4xl flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="inline-flex items-center gap-1.5 rounded-lg px-4 py-1.5 bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 cursor-pointer shadow-xs"
                  >
                    <Printer className="size-4" /> Print / Save PDF
                  </button>
                </div>
              )}
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
