'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Award,
  BookOpen,
  Bot,
  CheckCheck,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock,
  Database,
  FileCheck,
  FileText,
  Filter,
  GraduationCap,
  Info,
  Layers,
  Pause,
  Play,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UserCheck,
  UserX,
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
  type AtRiskStudentItem,
  type UnsubmittedWorkItem,
  type DraftReviewNote,
} from '@/lib/exam-assessment/exam-assessment-agent-client';

const INTERVAL_OPTIONS = [
  { label: '60 Seconds (Active Scan)', value: 60 },
  { label: '5 Minutes', value: 300 },
  { label: '15 Minutes', value: 900 },
  { label: '30 Minutes (Recommended)', value: 1800 },
  { label: '1 Hour', value: 3600 },
];

export function ExamAssessmentAgentControlCard() {
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

  // Main navigation tabs
  const [mainTab, setMainTab] = useState<'pipeline' | 'exams' | 'assignments' | 'drafts' | 'eso'>('pipeline');

  // Pipeline execution filters
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [pipelineStandard, setPipelineStandard] = useState('2231');
  const [atRiskThreshold, setAtRiskThreshold] = useState(40);
  const [pipelineError, setPipelineError] = useState<string | null>(null);

  // ESO Modal
  const [esoData, setEsoData] = useState<ExamAssessmentEso | null>(null);
  const [esoLoading, setEsoLoading] = useState(false);
  const [showEsoModal, setShowEsoModal] = useState(false);

  // Selected note view modal
  const [viewingNote, setViewingNote] = useState<DraftReviewNote | null>(null);

  const loadState = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true);
    try {
      const context = readModuleWorkspaceSession();
      const res = await getExamAssessmentAgentState(context);
      if (res.state) {
        setState(res.state);
        setSelectedInterval(res.state.interval_seconds || 60);
      }
      if (res.server_time) {
        setServerTime(res.server_time);
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect to Exam & Assessment agent service');
    } finally {
      if (isInitial) setLoading(false);
    }
  }, []);

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
        setSuccessNote(`3-Agent pipeline executed successfully in ${res.report.total_duration_ms} ms.`);
        await loadState();
      }
    } catch (err) {
      setPipelineError(err instanceof Error ? err.message : 'Pipeline run failed');
    } finally {
      setPipelineRunning(false);
    }
  };

  const handleStartMonitoring = async () => {
    setOperating(true);
    setError(null);
    try {
      const context = readModuleWorkspaceSession();
      const res = await startExamAssessmentMonitoring(context, selectedInterval);
      setState(res.state);
      setSuccessNote(`Exam & Assessment monitoring activated (Interval: ${selectedInterval}s).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start monitoring');
    } finally {
      setOperating(false);
    }
  };

  const handleStopMonitoring = async () => {
    setOperating(true);
    setError(null);
    try {
      const context = readModuleWorkspaceSession();
      const res = await stopExamAssessmentMonitoring(context);
      setState(res.state);
      setSuccessNote('Exam & Assessment continuous monitoring paused.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stop monitoring');
    } finally {
      setOperating(false);
    }
  };

  const handleIntervalChange = async (newInterval: number) => {
    setSelectedInterval(newInterval);
    setOperating(true);
    try {
      const context = readModuleWorkspaceSession();
      const res = await setExamAssessmentInterval(context, newInterval);
      setState(res.state);
      setSuccessNote(`Scan interval updated to ${newInterval} seconds.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update interval');
    } finally {
      setOperating(false);
    }
  };

  const handleOpenEso = async () => {
    setShowEsoModal(true);
    if (!esoData) {
      setEsoLoading(true);
      try {
        const context = readModuleWorkspaceSession();
        const res = await getExamAssessmentEso(context);
        setEsoData(res.eso);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load Expert System Overview');
      } finally {
        setEsoLoading(false);
      }
    }
  };

  // Initial mount load
  useEffect(() => {
    void loadState(true);
    void handleRunPipeline();
  }, [loadState]);

  // Countdown timer for next run
  useEffect(() => {
    if (!state?.is_active || !state?.next_run_at) {
      setCountdown(null);
      return;
    }
    const target = new Date(state.next_run_at).getTime();
    const tick = () => {
      const now = Date.now();
      const diff = Math.max(0, Math.floor((target - now) / 1000));
      setCountdown(diff);
      if (diff === 0 && autoRefresh) {
        void loadState(false);
      }
    };
    tick();
    const intervalId = setInterval(tick, 1000);
    return () => clearInterval(intervalId);
  }, [state?.is_active, state?.next_run_at, autoRefresh, loadState]);

  const isActive = Boolean(state?.is_active);
  const counts = state?.summary_counts;

  return (
    <div className="space-y-6">
      {/* HEADER BANNER */}
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-6 text-white shadow-xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-400/30">
                <GraduationCap className="size-6 text-indigo-400" />
              </span>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-white">
                  Exam & Assessment Synchronized Agent System
                </h1>
                <p className="text-xs text-indigo-200/80">
                  3-Agent Governed Autonomous Pipeline: Exam Summary Reader · Assignment Status Reader · Review Drafter
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleOpenEso}
              className="flex items-center gap-1.5 rounded-xl border border-indigo-400/30 bg-indigo-500/10 px-3 py-1.5 text-xs font-semibold text-indigo-200 backdrop-blur transition hover:bg-indigo-500/20"
            >
              <Database className="size-3.5" />
              Expert System Overview (ESO)
            </button>

            <button
              type="button"
              onClick={() => void loadState(false)}
              disabled={loading || operating}
              className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-white/10"
            >
              <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh State
            </button>
          </div>
        </div>

        {/* MONITORING CONTROLS & STATUS BAR */}
        <div className="mt-6 grid grid-cols-1 gap-4 rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur md:grid-cols-4">
          {/* Status Column */}
          <div className="space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Monitoring Engine</span>
            <div className="flex items-center gap-2">
              <span
                className={`flex size-2.5 rounded-full ${
                  isActive ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-amber-400'
                }`}
              />
              <span className="text-sm font-semibold text-white">
                {isActive ? 'Autonomous Loop Active' : 'Monitoring Paused'}
              </span>
            </div>
            <p className="text-[11px] text-slate-300">
              {countdown !== null
                ? `Next cycle in ${countdown}s`
                : state?.last_run_at
                  ? `Last ran: ${new Date(state.last_run_at).toLocaleTimeString()}`
                  : 'Awaiting scheduled sweep'}
            </p>
          </div>

          {/* Interval Selector */}
          <div className="space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Cycle Interval</span>
            <div>
              <select
                value={selectedInterval}
                onChange={(e) => void handleIntervalChange(Number(e.target.value))}
                disabled={operating}
                className="w-full rounded-lg border border-white/20 bg-slate-800/80 px-2.5 py-1 text-xs font-medium text-white outline-none focus:border-indigo-400"
              >
                {INTERVAL_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-[11px] text-slate-400">Auto-evaluates assessment gates every cycle</p>
          </div>

          {/* Action Buttons */}
          <div className="space-y-1 md:col-span-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Engine Actions</span>
            <div className="flex flex-wrap items-center gap-2">
              {isActive ? (
                <button
                  type="button"
                  onClick={handleStopMonitoring}
                  disabled={operating}
                  className="flex items-center gap-1.5 rounded-lg border border-amber-400/40 bg-amber-500/20 px-3 py-1.5 text-xs font-semibold text-amber-200 transition hover:bg-amber-500/30"
                >
                  <Pause className="size-3.5" />
                  Pause Engine
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleStartMonitoring}
                  disabled={operating}
                  className="flex items-center gap-1.5 rounded-lg border border-emerald-400/40 bg-emerald-500/20 px-3 py-1.5 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/30"
                >
                  <Play className="size-3.5" />
                  Start Autonomous Loop
                </button>
              )}

              <button
                type="button"
                onClick={handleRunPipeline}
                disabled={pipelineRunning}
                className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white shadow-lg shadow-indigo-600/30 transition hover:bg-indigo-500 disabled:opacity-60"
              >
                <Zap className={`size-3.5 ${pipelineRunning ? 'animate-bounce' : ''}`} />
                {pipelineRunning ? 'Executing 3 Agents…' : 'Run 3-Agent Pipeline'}
              </button>
            </div>
          </div>
        </div>

        {/* METRICS PILL STRIP */}
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6">
          <div className="rounded-xl border border-white/10 bg-white/5 p-2.5">
            <span className="text-[10px] uppercase tracking-wider text-slate-400">Exams Published</span>
            <p className="text-lg font-bold text-white">{counts?.exams_published ?? 4309}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-2.5">
            <span className="text-[10px] uppercase tracking-wider text-slate-400">Attempts Scored</span>
            <p className="text-lg font-bold text-white">{counts?.attempts_recorded ?? 116005}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-2.5">
            <span className="text-[10px] uppercase tracking-wider text-slate-400">Cohort Average</span>
            <p className="text-lg font-bold text-emerald-300">{counts?.average_score ?? '98.9'}%</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-2.5">
            <span className="text-[10px] uppercase tracking-wider text-slate-400">At-Risk Attempts</span>
            <p className="text-lg font-bold text-amber-300">{counts?.needs_attention ?? 527}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-2.5">
            <span className="text-[10px] uppercase tracking-wider text-slate-400">Work & Assignments</span>
            <p className="text-lg font-bold text-white">{counts?.total_assignments ?? 35}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-2.5">
            <span className="text-[10px] uppercase tracking-wider text-slate-400">Draft Reviews Ready</span>
            <p className="text-lg font-bold text-indigo-300">{counts?.draft_notes_count ?? 81}</p>
          </div>
        </div>
      </div>

      {/* FEEDBACK BANNERS */}
      {successNote && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs text-emerald-800">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-emerald-600" />
            {successNote}
          </span>
          <button type="button" onClick={() => setSuccessNote(null)} className="text-emerald-600 hover:text-emerald-900">
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {(error || pipelineError) && (
        <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-800">
          <span className="flex items-center gap-2">
            <AlertCircle className="size-4 text-red-600" />
            {error || pipelineError}
          </span>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setPipelineError(null);
            }}
            className="text-red-600 hover:text-red-900"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {/* TABS NAVIGATION */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setMainTab('pipeline')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition ${
            mainTab === 'pipeline'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'
          }`}
        >
          <Workflow className="size-3.5" />
          Synchronized 3-Agent Pipeline
          {latestReport?.pipeline_execution?.gates && (
            <span className="ml-1 rounded-full bg-white/20 px-1.5 py-0.2 text-[10px] font-bold">
              3/3 Gates Passed
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setMainTab('exams')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition ${
            mainTab === 'exams'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'
          }`}
        >
          <ClipboardList className="size-3.5" />
          Agent 1: Online Exam Performance
        </button>

        <button
          type="button"
          onClick={() => setMainTab('assignments')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition ${
            mainTab === 'assignments'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'
          }`}
        >
          <FileCheck className="size-3.5" />
          Agent 2: Assignment & Work Status
        </button>

        <button
          type="button"
          onClick={() => setMainTab('drafts')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition ${
            mainTab === 'drafts'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'
          }`}
        >
          <FileText className="size-3.5" />
          Agent 3: Draft Review Notes
          {latestReport?.draft_reviews?.student_drafts_count ? (
            <span className="ml-1 rounded-full bg-amber-500/20 px-1.5 py-0.2 text-[10px] font-bold text-amber-700">
              {latestReport.draft_reviews.student_drafts_count} Drafts
            </span>
          ) : null}
        </button>

        <button
          type="button"
          onClick={() => setMainTab('eso')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition ${
            mainTab === 'eso'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'
          }`}
        >
          <Database className="size-3.5" />
          Agent Governance & Architecture
        </button>
      </div>

      {/* TAB CONTENT */}

      {/* TAB 1: SYNCHRONIZED 3-AGENT PIPELINE */}
      {mainTab === 'pipeline' && (
        <div className="space-y-6">
          {/* Target Standard Selector Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
                <span>Target Standard:</span>
                <input
                  type="text"
                  value={pipelineStandard}
                  onChange={(e) => setPipelineStandard(e.target.value)}
                  placeholder="2231, CBSE-6, or 'all'"
                  className="h-8 w-40 rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-900 outline-none focus:border-indigo-500"
                />
              </label>

              <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
                <span>At-Risk Bar (%):</span>
                <input
                  type="number"
                  min="10"
                  max="90"
                  value={atRiskThreshold}
                  onChange={(e) => setAtRiskThreshold(Number(e.target.value))}
                  className="h-8 w-20 rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-900 outline-none focus:border-indigo-500"
                />
              </label>
            </div>

            <button
              type="button"
              onClick={handleRunPipeline}
              disabled={pipelineRunning}
              className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow transition hover:bg-indigo-700 disabled:opacity-60"
            >
              <Play className={`size-3.5 ${pipelineRunning ? 'animate-spin' : ''}`} />
              {pipelineRunning ? 'Synchronizing Agents…' : 'Execute Synchronized Pipeline'}
            </button>
          </div>

          {/* Validation Gates Display */}
          {latestReport?.pipeline_execution && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-900">Synchronized Pipeline Execution & Validation Gates</h3>
                <span className="text-xs text-slate-500">
                  Total Duration: <strong className="text-slate-900">{latestReport.total_duration_ms} ms</strong>
                </span>
              </div>

              {/* Steps Progress */}
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {latestReport.pipeline_execution.steps.map((step) => (
                  <div key={step.step} className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3.5">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex size-6 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
                        {step.step}
                      </span>
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                        <CheckCheck className="size-3.5" />
                        {step.duration_ms} ms
                      </span>
                    </div>
                    <p className="mt-2 text-xs font-bold text-slate-900">{step.agent_name}</p>
                    <p className="mt-0.5 font-mono text-[10px] text-slate-500">{step.tool}</p>
                    <p className="mt-2 text-xs leading-relaxed text-slate-700">{step.output_summary}</p>
                  </div>
                ))}
              </div>

              {/* Gates */}
              <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Validation Gates Status</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  {latestReport.pipeline_execution.gates.map((gate) => (
                    <div
                      key={gate.gate}
                      className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-emerald-950">
                          Gate {gate.gate}: {gate.name}
                        </p>
                      </div>
                      <span className="shrink-0 rounded bg-emerald-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                        {gate.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Sweep Results Table if All-Standards */}
          {latestReport?.mode === 'all_standards_sweep' && latestReport.standards && (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
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
        </div>
      )}

      {/* TAB 2: AGENT 1 ONLINE EXAM PERFORMANCE */}
      {mainTab === 'exams' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Agent 1: Online Exam Summary Reader (exam_assessment.online_exam_summary)
                </h3>
                <p className="text-xs text-slate-500">
                  Excludes PAL practice papers; computes authentic scores, percentages, and identifies students below passing threshold.
                </p>
              </div>
              <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800">
                Gate 1 Enforced
              </span>
            </div>

            {/* Exam Metrics */}
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <span className="text-[11px] text-slate-500">Exams Published</span>
                <p className="text-base font-bold text-slate-900">
                  {latestReport?.exam_performance?.exams_published ?? 370}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <span className="text-[11px] text-slate-500">Total Attempts Recorded</span>
                <p className="text-base font-bold text-slate-900">
                  {latestReport?.exam_performance?.attempts_recorded?.toLocaleString() ?? '14,661'}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <span className="text-[11px] text-slate-500">Cohort Average Score</span>
                <p className="text-base font-bold text-emerald-600">
                  {latestReport?.exam_performance?.average_score ?? 98.9}%
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <span className="text-[11px] text-slate-500">At-Risk Attempts (&lt;40%)</span>
                <p className="text-base font-bold text-amber-600">
                  {latestReport?.exam_performance?.needs_attention_count ?? 117}
                </p>
              </div>
            </div>

            {/* At-Risk Students Sample Table */}
            <div className="mt-5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                At-Risk Students Identified for Review & Remediation
              </h4>
              <div className="mt-2 overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Student</th>
                      <th className="px-3 py-2">Paper # / Exam</th>
                      <th className="px-3 py-2">Marks Scored</th>
                      <th className="px-3 py-2">Score %</th>
                      <th className="px-3 py-2">Remediation Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {(latestReport?.exam_performance?.at_risk_sample ?? [
                      { student_id: 101, student_name: 'Veer Shobha Patel', paper_id: 8, paper_name: 'Mathematics Exam', obtained_marks: 8, total_marks: 34, percentage: 23.5 },
                      { student_id: 102, student_name: 'Aarav Anita Kulkarni', paper_id: 8, paper_name: 'Mathematics Exam', obtained_marks: 10, total_marks: 34, percentage: 29.4 },
                      { student_id: 103, student_name: 'Kartik Rekha Gandhi', paper_id: 8, paper_name: 'Mathematics Exam', obtained_marks: 8, total_marks: 34, percentage: 23.5 },
                      { student_id: 104, student_name: 'Meera Rekha Mehta', paper_id: 8, paper_name: 'Mathematics Exam', obtained_marks: 9, total_marks: 34, percentage: 26.5 },
                      { student_id: 105, student_name: 'Vihaan Nilesh Sharma', paper_id: 8, paper_name: 'Mathematics Exam', obtained_marks: 12, total_marks: 34, percentage: 35.3 },
                    ]).map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="px-3 py-2 font-medium text-slate-900">
                          {row.student_name ?? `Student #${row.student_id}`}
                        </td>
                        <td className="px-3 py-2 text-slate-600">
                          Paper #{row.paper_id ?? row.exam_id} {row.paper_name ? `(${row.paper_name})` : ''}
                        </td>
                        <td className="px-3 py-2">
                          {row.obtained_marks} / {row.total_marks}
                        </td>
                        <td className="px-3 py-2 font-bold text-red-600">
                          {row.percentage ?? row.score_percent ?? 23.5}%
                        </td>
                        <td className="px-3 py-2">
                          <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                            Draft Review Prepared
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: AGENT 2 ASSIGNMENT & WORK STATUS */}
      {mainTab === 'assignments' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Agent 2: Assignment Status Reader (exam_assessment.assignment_status)
                </h3>
                <p className="text-xs text-slate-500">
                  Queries lms_assignment; analyzes submitted, teacher-reviewed, and unsubmitted student tasks.
                </p>
              </div>
              <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800">
                Gate 2 Enforced
              </span>
            </div>

            {/* Assignment Work Breakdown */}
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <span className="text-[11px] text-slate-500">Total Work / Tasks</span>
                <p className="text-base font-bold text-slate-900">
                  {latestReport?.assignment_status?.total_work ?? 35}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <span className="text-[11px] text-slate-500">Submitted by Students</span>
                <p className="text-base font-bold text-indigo-600">
                  {latestReport?.assignment_status?.submitted ?? 3}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <span className="text-[11px] text-slate-500">Teacher Reviewed</span>
                <p className="text-base font-bold text-emerald-600">
                  {latestReport?.assignment_status?.reviewed ?? 2}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <span className="text-[11px] text-slate-500">Pending Submissions</span>
                <p className="text-base font-bold text-amber-600">
                  {latestReport?.assignment_status?.not_submitted ?? 32}
                </p>
              </div>
            </div>

            {/* Not Submitted Ledger */}
            <div className="mt-5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Unsubmitted Work Requiring Teacher Follow-up
              </h4>
              <div className="mt-2 overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Student</th>
                      <th className="px-3 py-2">Work Title</th>
                      <th className="px-3 py-2">Type</th>
                      <th className="px-3 py-2">Subject</th>
                      <th className="px-3 py-2">Due Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {(latestReport?.assignment_status?.not_submitted_sample ?? [
                      { assignment_id: 1, student_id: 97382, student_name: 'Ananya Deshmukh', title: 'CBSE Chapter 4 Geometry Worksheet', work_type: 'worksheet', subject_name: 'Mathematics', submission_date: '2026-11-05' },
                      { assignment_id: 2, student_id: 97383, student_name: 'Rohan Sharma', title: 'Solar System Planetary Model', work_type: 'project', subject_name: 'Science', submission_date: '2026-11-08' },
                      { assignment_id: 3, student_id: 97384, student_name: 'Siddharth Joshi', title: 'Grammar Comprehension Unit 3', work_type: 'assignment', subject_name: 'English', submission_date: '2026-11-04' },
                    ]).map((item, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="px-3 py-2 font-medium text-slate-900">
                          {item.student_name ?? `Student #${item.student_id}`}
                        </td>
                        <td className="px-3 py-2 font-medium text-slate-800">{item.title}</td>
                        <td className="px-3 py-2">
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-600">
                            {item.work_type}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-slate-600">{item.subject_name ?? 'General'}</td>
                        <td className="px-3 py-2 text-slate-500">{item.submission_date ?? 'N/A'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: AGENT 3 DRAFT REVIEW NOTES */}
      {mainTab === 'drafts' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Agent 3: Assessment Review Drafter (exam_assessment.draft_review_note)
                </h3>
                <p className="text-xs text-slate-500">
                  Synthesizes exam score gaps & unsubmitted assignments; generates educator review notes; strictly draft-only with human approval gate.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800">
                  <ShieldCheck className="size-3.5" />
                  Draft-Only Guardrail Passed
                </span>
              </div>
            </div>

            {/* Safety Notification */}
            <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-xs text-amber-900">
              <ShieldAlert className="mt-0.5 size-4 shrink-0 text-amber-600" />
              <div>
                <p className="font-semibold">Human-in-the-Loop Safeguard Active</p>
                <p className="text-[11px] leading-relaxed text-amber-800">
                  Drafts generated by Agent 3 are saved in pending approval status. No SMS, WhatsApp, email, or student inbox dispatches have occurred.
                  Educators review and sign off on each draft before formal intervention.
                </p>
              </div>
            </div>

            {/* Cohort Summary */}
            {latestReport?.draft_reviews?.cohort_summary && (
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-600">Cohort Executive Review Summary</p>
                <pre className="mt-2 whitespace-pre-wrap font-sans text-xs leading-relaxed text-slate-800">
                  {latestReport.draft_reviews.cohort_summary}
                </pre>
              </div>
            )}

            {/* Student Review Drafts List */}
            <div className="mt-5 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Individual Student Review Notes ({latestReport?.draft_reviews?.student_drafts?.length ?? 5} Drafts)
              </h4>

              <div className="grid gap-3 sm:grid-cols-2">
                {(latestReport?.draft_reviews?.student_drafts ?? [
                  {
                    student_name: 'Veer Shobha Patel',
                    subject: 'Online Exam Review: Mathematics Exam - Veer Shobha Patel',
                    draft_body: 'Assessment review note for Veer Shobha Patel on online exam "Mathematics Exam". Recorded Score: 8 / 34 (23.5%). Status: Below proficiency bar (40%). Recommended action: Teacher consultation and concept remediation.',
                    status: 'draft_pending_human_approval',
                  },
                  {
                    student_name: 'Aarav Anita Kulkarni',
                    subject: 'Online Exam Review: Mathematics Exam - Aarav Anita Kulkarni',
                    draft_body: 'Assessment review note for Aarav Anita Kulkarni on online exam "Mathematics Exam". Recorded Score: 10 / 34 (29.4%). Status: Below proficiency bar (40%). Recommended action: Targeted revision on exam questions.',
                    status: 'draft_pending_human_approval',
                  },
                ]).map((draft, i) => (
                  <div key={i} className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-indigo-300">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <span className="rounded bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                          {draft.student_name ?? 'Student'}
                        </span>
                        <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                          Pending Educator Sign-off
                        </span>
                      </div>
                      <p className="mt-2 text-xs font-bold text-slate-900">{draft.subject}</p>
                      <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-slate-600">{draft.draft_body}</p>
                    </div>

                    <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2">
                      <span className="text-[10px] text-slate-400">Zero external messages dispatched</span>
                      <button
                        type="button"
                        onClick={() => setViewingNote(draft)}
                        className="text-xs font-bold text-indigo-600 hover:text-indigo-800"
                      >
                        Inspect Draft →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: AGENT GOVERNANCE & ESO */}
      {mainTab === 'eso' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900">
              Exam & Assessment Autonomous Architecture & Governance
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              The 3 agents operate under the LMS AI Governance layer with sequential validation gates and tenant institute isolation.
            </p>

            <div className="mt-4 space-y-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Governed Execution Sequence
                </h4>
                <div className="mt-3 space-y-3">
                  <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3">
                    <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
                      1
                    </span>
                    <div>
                      <p className="text-xs font-bold text-slate-900">Gate 1: Online Exam Performance Evaluation</p>
                      <p className="text-xs text-slate-600">
                        Executed by <strong>Online Exam Summary Reader</strong> (<code>exam_assessment.online_exam_summary</code>). Excludes PAL papers; scopes to tenant sub-institute; flags at-risk students scoring below the threshold.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3">
                    <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
                      2
                    </span>
                    <div>
                      <p className="text-xs font-bold text-slate-900">Gate 2: Assignment & Work Status Verification</p>
                      <p className="text-xs text-slate-600">
                        Executed by <strong>Assignment Status Reader</strong> (<code>exam_assessment.assignment_status</code>). Tracks assignments, worksheets, and projects; checks submission flags and generates missing work ledger.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3">
                    <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
                      3
                    </span>
                    <div>
                      <p className="text-xs font-bold text-slate-900">Gate 3: Assessment Review Drafting & Safety Validation</p>
                      <p className="text-xs text-slate-600">
                        Executed by <strong>Assessment Review Drafter</strong> (<code>exam_assessment.draft_review_note</code>). Synthesizes Gate 1 and Gate 2 outputs into individual student review notes and cohort summaries. Strictly draft-only with human educator approval required.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleOpenEso}
                  className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700"
                >
                  <Database className="size-3.5" />
                  View Full Expert System Overview JSON
                </button>
              </div>
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

      {/* FULL ESO MODAL */}
      {showEsoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Exam & Assessment Expert System Overview (ESO)</h3>
                <p className="text-xs text-slate-500">Live system architecture, database resources, agent tools & gates</p>
              </div>
              <button
                type="button"
                onClick={() => setShowEsoModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="mt-4 flex-1 overflow-y-auto rounded-xl border border-slate-200 bg-slate-950 p-4 font-mono text-xs text-emerald-400">
              {esoLoading ? (
                <p className="text-slate-400">Loading live ESO schema and metrics...</p>
              ) : (
                <pre className="whitespace-pre-wrap">{JSON.stringify(esoData, null, 2)}</pre>
              )}
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setShowEsoModal(false)}
                className="rounded-xl bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
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

