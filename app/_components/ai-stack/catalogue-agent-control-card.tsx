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
  type CatalogueAgentState,
  type HierarchyValidationReport,
  type ContentTaskRecord,
  type ContentStats,
} from '@/lib/teach-learn/catalogue-agent-client';

interface CatalogueAgentControlCardProps {
  onValidated?: (report: HierarchyValidationReport) => void;
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
  const [mainTab, setMainTab] = useState<'hierarchy' | 'content_ledger' | 'cycle_diagram'>('hierarchy');

  // Hierarchy Issues Explorer Tab State
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
                <span className="inline-flex items-center gap-1 rounded-md bg-indigo-100 px-2 py-0.5 text-[11px] font-semibold text-indigo-800">
                  <Bot className="size-3" /> Agent 1: Catalogue Reader
                </span>
                <ArrowRight className="size-3.5 text-indigo-400" />
                <span className="inline-flex items-center gap-1 rounded-md bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-800">
                  <Sparkles className="size-3" /> Agent 2: Content Agent
                </span>
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
    </div>
  );
}
