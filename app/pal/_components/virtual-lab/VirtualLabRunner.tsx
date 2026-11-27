'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Award,
  CheckCircle2,
  Circle,
  FlaskConical,
  HelpCircle,
  ListChecks,
  Loader2,
  Minus,
  Pause,
  Play,
  Plus,
  Play as PlayIcon,
  RotateCcw,
  RotateCw,
  Star,
  Timer,
  X,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { getKit } from '@/lib/virtual-lab/kits';
import { createSimulation, getLab } from '@/lib/virtual-lab/registry';
import { LAB_STAGES, type LabEvent, type LabSnapshot, type LabStageId } from '@/lib/virtual-lab/types';
import type { LabSceneHandle } from '@/lib/virtual-lab/engine/LabScene';
import {
  emptyNotebook,
  emptyProgress,
  fetchVirtualLab,
  loadLocalLab,
  saveLocalLab,
  saveVirtualLab,
  submitVirtualLab,
  type LabEvaluation,
  type LabProgress,
  type LabStatus,
} from '@/app/pal/data/pal-virtual-lab';

import {
  AssessPanel,
  ComparePanel,
  FeedbackPanel,
  IntroPanel,
  NotebookPanel,
  PredictPanel,
} from './LabStagePanels';

/**
 * The 3D Virtual Lab for the Application Lab step.
 *
 * Owns three things: the lab's world (the simulation state, kept here so it
 * survives moving between the bench and the paper stages), the student's
 * progress (stage, prediction, notebook, answers), and saving both. The 3D
 * canvas is loaded on demand and only mounted on the two bench stages.
 */

const LabScene = dynamic(() => import('@/lib/virtual-lab/engine/LabScene').then((m) => m.LabScene), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-slate-600">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> Loading the laboratory…
    </div>
  ),
}) as unknown as typeof import('@/lib/virtual-lab/engine/LabScene').LabScene;

const BENCH: LabStageId[] = ['setup', 'perform'];
const LOG_LIMIT = 300;

export interface VirtualLabRunnerProps {
  chapterId: string;
  labId: string;
  onClose?: () => void;
  /** Rendered as a full page (QA / deep link) instead of an overlay. */
  standalone?: boolean;
}

export function VirtualLabRunner({ chapterId, labId, onClose, standalone = false }: VirtualLabRunnerProps) {
  const config = useMemo(() => getLab(labId), [labId]);
  const sim = useMemo(() => (config ? createSimulation(config) : null), [config]);
  const kit = useMemo(() => (config ? getKit(config.simulationId) : null), [config]);

  const worldRef = useRef<unknown>(null);
  const logRef = useRef<LabEvent[]>([]);
  const scene = useRef<LabSceneHandle>(null);

  const [loaded, setLoaded] = useState(false);
  // How far the student has got (a stage number), so they can go back to any step they have reached and check it again.
  const [furthest, setFurthest] = useState(0);
  const [persisted, setPersisted] = useState(false);
  const [status, setStatus] = useState<LabStatus>('in_progress');
  const [progress, setProgress] = useState<LabProgress>(emptyProgress());
  const [evaluation, setEvaluation] = useState<LabEvaluation | null>(null);
  const [snap, setSnap] = useState<LabSnapshot | null>(null);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'local'>('idle');
  const [panelOpen, setPanelOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const prevStage = useRef<LabStageId | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);

  const progressRef = useRef(progress);
  const statusRef = useRef(status);
  const persistedRef = useRef(persisted);
  useEffect(() => {
    progressRef.current = progress;
    statusRef.current = status;
    persistedRef.current = persisted;
  }, [progress, status, persisted]);

  const getWorld = useCallback(() => {
    if (!worldRef.current && sim && config) worldRef.current = sim.create(config);
    return worldRef.current;
  }, [sim, config]);

  const newProgress = useCallback((): LabProgress => {
    const p = emptyProgress();
    if (config) p.notebook = emptyNotebook(config.notebookColumns.length - 1, config.notebookRows.length);
    return p;
  }, [config]);

  // --- load / resume -------------------------------------------------------------------
  useEffect(() => {
    if (!config || !sim) return;
    const controller = new AbortController();
    let cancelled = false;

    const apply = (saved: LabProgress | null, st: LabStatus, ev: LabEvaluation | null, server: boolean) => {
      if (cancelled) return;
      const base = saved ?? newProgress();
      if (base.notebook.table.length === 0) base.notebook = newProgress().notebook;
      worldRef.current = base.world ? sim.restore(config, base.world) : sim.create(config);
      logRef.current = base.log ?? [];
      setSnap(sim.snapshot(worldRef.current));
      setProgress(base);
      setFurthest(Math.max(0, LAB_STAGES.findIndex((x) => x.id === base.stage)));
      setStatus(st);
      setEvaluation(ev);
      setPersisted(server);
      setLoaded(true);
    };

    fetchVirtualLab(chapterId, labId, controller.signal)
      .then(({ persisted: server, record }) => {
        if (record?.progress) apply(record.progress, record.status, record.evaluation, true);
        else apply(server ? null : loadLocalLab(chapterId, labId), 'in_progress', null, server);
      })
      .catch(() => apply(loadLocalLab(chapterId, labId), 'in_progress', null, false));

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [chapterId, labId, config, sim, newProgress]);

  // --- saving ---------------------------------------------------------------------------
  const buildProgress = useCallback((): LabProgress => {
    const world = worldRef.current ? JSON.parse(JSON.stringify(worldRef.current)) : null;
    return { ...progressRef.current, world, log: logRef.current.slice(-LOG_LIMIT) };
  }, []);

  const save = useCallback(
    (keepalive = false) => {
      if (!loaded || statusRef.current !== 'in_progress') return;
      const p = buildProgress();
      saveLocalLab(chapterId, labId, p);
      if (!persistedRef.current) {
        setSaveState('local');
        return;
      }
      setSaveState('saving');
      saveVirtualLab(chapterId, labId, p, keepalive)
        .then((out) => setSaveState(out.record ? 'saved' : 'local'))
        .catch(() => setSaveState('local'));
    },
    [buildProgress, chapterId, labId, loaded]
  );

  // Debounced save when the student writes or moves between stages.
  useEffect(() => {
    if (!loaded) return;
    const t = setTimeout(() => save(), 1500);
    return () => clearTimeout(t);
  }, [progress, loaded, save]);

  const stage = progress.stage;
  const onBench = BENCH.includes(stage);

  // Poll the world for the HUD, collect the interaction log, and autosave while on the bench.
  useEffect(() => {
    if (!loaded || !sim || !onBench) return;
    const poll = setInterval(() => {
      const w = getWorld();
      if (!w) return;
      const events = sim.drainEvents(w);
      if (events.length > 0) logRef.current = [...logRef.current, ...events].slice(-LOG_LIMIT);
      setSnap(sim.snapshot(w));
    }, 160);
    const autosave = setInterval(() => save(), 8000);
    return () => {
      clearInterval(poll);
      clearInterval(autosave);
      save();
    };
  }, [loaded, sim, onBench, getWorld, save]);

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') save(true);
    };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, [save]);

  // A small celebration when the student finishes a step and moves on.
  useEffect(() => {
    if (!loaded) return;
    const prev = prevStage.current;
    prevStage.current = progress.stage;
    if (!prev || prev === progress.stage) return;
    const from = LAB_STAGES.findIndex((x) => x.id === prev);
    const to = LAB_STAGES.findIndex((x) => x.id === progress.stage);
    if (to <= from) return;
    const label = LAB_STAGES[from].label;
    const show = setTimeout(() => setToast(`Step complete: ${label}`), 0);
    const hide = setTimeout(() => setToast(null), 2400);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
    };
  }, [progress.stage, loaded]);

  const update = useCallback((patch: Partial<LabProgress>) => setProgress((p) => ({ ...p, ...patch })), []);
  const goto = useCallback(
    (next: LabStageId) => {
      if (sim && worldRef.current) setSnap(sim.snapshot(worldRef.current));
      setFurthest((f) => Math.max(f, LAB_STAGES.findIndex((x) => x.id === next)));
      update({ stage: next });
    },
    [sim, update]
  );

  const submit = () => {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    submitVirtualLab(chapterId, labId, buildProgress())
      .then(({ record, message: text }) => {
        if (!record) {
          setMessage(text ?? 'Couldn’t submit your lab.');
          return;
        }
        setStatus(record.status);
        setEvaluation(record.evaluation);
        if (record.progress) setProgress(record.progress);
        if (record.status === 'submitted' && !record.evaluation) {
          setMessage('Your work is saved. The marking did not finish; try “Get my feedback”.');
        }
      })
      .catch((error: unknown) => setMessage(error instanceof Error ? error.message : 'Couldn’t submit your lab.'))
      .finally(() => setBusy(false));
  };

  const resetExperiment = () => {
    if (!sim || !config) return;
    if (!window.confirm('Start the experiment again? Everything on the bench goes back to the start.')) return;
    worldRef.current = sim.create(config);
    logRef.current = [...logRef.current, { t: 0, type: 'reset' }].slice(-LOG_LIMIT);
    setSnap(sim.snapshot(worldRef.current));
    update({ stage: 'setup', world: null });
  };

  const exit = () => {
    save();
    onClose?.();
  };

  if (!config || !sim) {
    return (
      <Shell standalone={standalone}>
        <p className="p-6 text-sm text-slate-700">This lab is not available.</p>
      </Shell>
    );
  }

  const submitted = status !== 'in_progress';
  const locked = submitted;
  const stageIndex = LAB_STAGES.findIndex((s) => s.id === stage);
  const game = computeGamification(progress, snap, evaluation);

  return (
    <Shell standalone={standalone}>
      <header className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <FlaskConical className="h-5 w-5 shrink-0 text-sky-600" aria-hidden />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-slate-900">{config.title}</p>
            <p className="truncate text-[11px] text-slate-500">{config.subtitle}</p>
          </div>
        </div>
        <ol className="order-3 flex w-full items-center gap-1 overflow-x-auto md:order-none md:w-auto md:min-w-0 md:flex-1" aria-label="Progress">
          {LAB_STAGES.map((s, i) => (
            <li key={s.id} aria-current={s.id === stage ? 'step' : undefined} className="shrink-0">
              {/* A step already reached can be opened again to check it; nothing is lost, and the work stays saved. */}
              <button
                type="button"
                disabled={locked || s.id === stage || i > furthest || s.id === 'feedback'}
                onClick={() => goto(s.id)}
                title={!locked && i <= furthest && s.id !== stage ? `Go back to step ${i + 1}: ${s.label}` : undefined}
                data-testid={`stage-${s.id}`}
                className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold disabled:cursor-default ${
                  s.id === stage ? 'bg-sky-600 text-white' : i < stageIndex ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200' : i <= furthest ? 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100' : 'bg-slate-100 text-slate-500'
                }`}
              >
                <span>{i + 1}</span>
                <span className={s.id === stage ? '' : 'hidden lg:inline'}>{s.label}</span>
              </button>
            </li>
          ))}
        </ol>
        <div className="ml-auto flex items-center gap-2 text-[11px] text-slate-500">
          <span
            key={game.score}
            className="inline-flex animate-pulse items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-900"
            title="Your scientist score goes up as you complete steps"
            data-testid="scientist-score"
          >
            <Star className="h-3.5 w-3.5" aria-hidden /> {game.score}
          </span>
          <span aria-live="polite">
            {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved' : saveState === 'local' ? 'Saved on this device' : ''}
          </span>
          {onClose ? (
            <Button size="sm" variant="outline" onClick={exit} className="h-8 gap-1 text-xs">
              <X className="h-3.5 w-3.5" /> Save and exit
            </Button>
          ) : null}
        </div>
      </header>

      {toast ? (
        <div
          role="status"
          className="pointer-events-none fixed left-1/2 top-16 z-[120] -translate-x-1/2 animate-bounce rounded-full bg-emerald-600 px-4 py-1.5 text-sm font-bold text-white shadow-lg"
          data-testid="step-toast"
        >
          ✓ {toast}
        </div>
      ) : null}

      {!loaded ? (
        <div className="flex flex-1 items-center justify-center text-sm text-slate-600" role="status">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> Opening your lab…
        </div>
      ) : onBench && kit ? (
        <div className="relative flex min-h-0 flex-1 select-none">
          <aside
            className={`absolute left-3 top-12 z-20 max-h-[62%] w-[min(19rem,calc(100%-1.5rem))] overflow-y-auto rounded-xl bg-white/95 p-3 text-slate-800 shadow-lg md:static md:max-h-none md:w-72 md:shrink-0 md:rounded-none md:border-r md:border-slate-200 md:bg-white md:shadow-none ${
              panelOpen ? 'block' : 'hidden md:block'
            }`}
            aria-label="Mission and tasks"
          >
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
              {stage === 'setup' ? 'Set up your bench' : 'Your experiment'}
            </p>
            {config.simulatedNote && stage === 'perform' ? (
              <p className="mt-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-900">
                Simulated experiment
              </p>
            ) : null}
            {stage === 'setup' ? (
              <p className="mt-1 text-xs text-slate-700">
                {config.setupText ?? (
                  <>
                    Drag <strong>Beaker 1</strong> and <strong>Beaker 2</strong> onto Station A and Station B. You will use the
                    jugs, cylinder, sugar, thermometer, spoon and stopwatch next.
                  </>
                )}
              </p>
            ) : (
              <ul className="mt-1.5 space-y-1">
                {config.tasks.map((t) => {
                  const done = snap?.tasksDone[t.id];
                  const next = snap?.nextTask === t.id;
                  return (
                    <li
                      key={t.id}
                      className={`flex items-start gap-1.5 rounded px-1 py-0.5 text-xs ${next ? 'bg-sky-50 font-semibold text-sky-900' : done ? 'text-slate-400' : 'text-slate-700'}`}
                    >
                      {done ? (
                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" aria-label="done" />
                      ) : (
                        <Circle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
                      )}
                      <span className={done ? 'line-through' : ''}>{t.label}</span>
                    </li>
                  );
                })}
              </ul>
            )}
            {snap && snap.readouts.length > 0 ? (
              <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 border-t border-slate-200 pt-2 text-[11px]">
                {snap.readouts.map((r) => (
                  <div key={r.id} className="contents">
                    <dt className="truncate text-slate-500">{r.label}</dt>
                    <dd className="font-mono font-semibold text-slate-800">{r.value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </aside>
          <div className="relative min-w-0 flex-1">
          {/* mission + tasks */}
          <button
            type="button"
            onClick={() => setPanelOpen((v) => !v)}
            className="absolute left-3 top-3 z-30 flex items-center gap-1 rounded-lg bg-white/95 px-2.5 py-1.5 text-xs font-semibold text-slate-800 shadow md:hidden"
          >
            <ListChecks className="h-4 w-4" aria-hidden /> Tasks
          </button>

          <div className="absolute inset-0" data-testid="lab-canvas">
            <LabScene
              ref={scene}
              config={config}
              sim={sim}
              kit={kit}
              getWorld={getWorld as () => unknown}
              paused={paused}
              speed={speed}
              interactive={!locked}
            />
          </div>

          {/* toolbar */}
          <div className="absolute right-3 top-3 z-10 flex flex-wrap items-center justify-end gap-1.5">
            <Tool label={paused ? 'Play' : 'Pause'} onClick={() => setPaused((v) => !v)}>
              {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            </Tool>
            <Tool label={speed === 1 ? 'Fast forward x4' : 'Normal speed'} onClick={() => setSpeed((s) => (s === 1 ? 4 : 1))} active={speed !== 1}>
              <span className="text-[11px] font-bold">{speed}x</span>
            </Tool>
            <Tool label="Zoom in" onClick={() => scene.current?.zoom(-0.12)}>
              <Plus className="h-4 w-4" />
            </Tool>
            <Tool label="Zoom out" onClick={() => scene.current?.zoom(0.12)}>
              <Minus className="h-4 w-4" />
            </Tool>
            <Tool label="Reset the view" onClick={() => scene.current?.resetView()}>
              <RotateCcw className="h-4 w-4" />
            </Tool>
            <Tool label="Start the experiment again" onClick={resetExperiment}>
              <span className="text-[11px] font-bold">Reset</span>
            </Tool>
            <Tool label="How to move things" onClick={() => setHelpOpen((v) => !v)} active={helpOpen}>
              <HelpCircle className="h-4 w-4" />
            </Tool>
          </div>

          {paused ? (
            <div className="pointer-events-none absolute left-1/2 top-16 z-10 -translate-x-1/2 rounded-full bg-slate-900/85 px-4 py-1 text-xs font-bold text-white">
              Paused
            </div>
          ) : null}

          {helpOpen ? (
            <div className="absolute right-3 top-14 z-10 w-64 rounded-xl bg-white/95 p-3 text-xs text-slate-700 shadow-lg">
              <p className="mb-1 font-bold text-slate-900">How to use the lab</p>
              <ul className="list-disc space-y-0.5 pl-4">
                <li>Press and drag an object to pick it up and move it.</li>
                <li>Hold a jug or the sugar over a beaker, then tilt it: mouse wheel, ↑ ↓ keys or the Tilt slider.</li>
                <li>Hold the spoon in the water and move it in circles to stir.</li>
                <li>Lower the thermometer into the water and wait for the reading.</li>
                <li>Click the stopwatch (or press S) to start and stop it.</li>
                <li>Q and E turn what you hold. Drag the room to look around.</li>
              </ul>
            </div>
          ) : null}

          {/* hints, warnings, held-object controls, stopwatch, continue */}
          <div className="absolute inset-x-3 bottom-3 z-10 flex flex-col items-center gap-2">
            {snap?.info ? (
              <div className="relative max-w-xl rounded-xl border border-sky-200 bg-white/97 px-4 py-2.5 pr-8 text-xs text-slate-800 shadow-lg" data-testid="info-card">
                <p className="font-bold text-sky-900">{snap.info.label}</p>
                <p className="mt-0.5">{snap.info.text}</p>
                <button
                  type="button"
                  aria-label="Close"
                  onClick={() => sim.act(getWorld(), 'close_info')}
                  className="absolute right-2 top-2 text-slate-500 hover:text-slate-800"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : null}
            {snap && snap.warnings.length > 0 ? (
              <div role="alert" className="max-w-xl rounded-lg border border-amber-300 bg-amber-50/95 px-3 py-1.5 text-xs font-medium text-amber-900 shadow">
                {snap.warnings[snap.warnings.length - 1]}
              </div>
            ) : snap?.good && snap.good.length > 0 ? (
              <div role="status" className="max-w-xl rounded-lg border border-emerald-300 bg-emerald-50/95 px-3 py-1.5 text-xs font-medium text-emerald-900 shadow">
                ✓ {snap.good[snap.good.length - 1]}
              </div>
            ) : null}
            {stage === 'setup' && snap && !snap.setupReady && config.setupText ? (
              <div className="max-w-xl rounded-lg bg-slate-900/85 px-3 py-1.5 text-xs text-white shadow" data-testid="lab-hint">
                💡 {snap.hint}
              </div>
            ) : stage === 'setup' && snap && !snap.setupReady ? (
              <div className="max-w-xl rounded-lg bg-slate-900/85 px-3 py-1.5 text-xs text-white shadow">
                Drag a beaker onto the coloured station. It snaps into place.
              </div>
            ) : stage === 'perform' && snap?.hint ? (
              <div className="max-w-xl rounded-lg bg-slate-900/85 px-3 py-1.5 text-xs text-white shadow" data-testid="lab-hint">
                💡 {snap.hint}
              </div>
            ) : null}

            <div className="flex w-full flex-wrap items-end justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                {snap?.held ? (
                  <div className="rounded-xl bg-white/95 p-2 shadow-lg" data-testid="held-controls">
                    <p className="mb-1 text-[11px] font-bold text-slate-600">Holding: {snap.heldLabel}</p>
                    <div className="flex items-center gap-2">
                      {snap.heldCanTilt ? (
                        <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700">
                          Tilt
                          <input
                            type="range"
                            min={0}
                            max={110}
                            value={Math.round(snap.tilt)}
                            aria-label="Tilt"
                            onChange={(e) => sim.setTilt(getWorld(), Number(e.target.value))}
                            className="h-6 w-28 touch-none"
                          />
                          <span className="w-8 font-mono">{Math.round(snap.tilt)}°</span>
                        </label>
                      ) : null}
                      <Tool label="Turn left" onClick={() => sim.rotateHeld(getWorld(), -15)} small>
                        <RotateCcw className="h-3.5 w-3.5" />
                      </Tool>
                      <Tool label="Turn right" onClick={() => sim.rotateHeld(getWorld(), 15)} small>
                        <RotateCw className="h-3.5 w-3.5" />
                      </Tool>
                    </div>
                  </div>
                ) : null}
                {config.objects.some((o) => o.kind === 'stopwatch') && snap ? (
                  <div className="flex items-center gap-1.5 rounded-xl bg-white/95 px-2 py-1.5 shadow-lg">
                    <Timer className="h-4 w-4 text-slate-500" aria-hidden />
                    <span className="w-14 font-mono text-xs font-bold text-slate-800" data-testid="hud-stopwatch">
                      {formatTime(snap.stopwatch.elapsed)}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-[11px]"
                      onClick={() => sim.click(getWorld(), config.objects.find((o) => o.kind === 'stopwatch')!.id)}
                    >
                      {snap.stopwatch.running ? 'Stop' : 'Start'}
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={() => sim.act(getWorld(), 'stopwatch_reset')}>
                      Reset
                    </Button>
                  </div>
                ) : null}
              </div>

              <div className="ml-auto">
                {stage === 'setup' ? (
                  <Button
                    size="sm"
                    disabled={!snap?.setupReady}
                    onClick={() => goto('perform')}
                    className="bg-sky-700 text-xs font-semibold text-white hover:bg-sky-800"
                    data-testid="setup-continue"
                  >
                    My bench is ready
                  </Button>
                ) : config.startAction && snap && !snap.started ? (
                  <Button
                    size="sm"
                    disabled={!snap.startable}
                    onClick={() => sim.act(getWorld(), config.startAction!.action)}
                    className="gap-1.5 bg-emerald-600 text-sm font-bold text-white shadow-lg hover:bg-emerald-700"
                    data-testid="start-experiment"
                  >
                    <PlayIcon className="h-4 w-4" aria-hidden /> {config.startAction.label}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    disabled={!snap?.comparable}
                    onClick={() => goto('compare')}
                    className="bg-emerald-700 text-xs font-semibold text-white hover:bg-emerald-800"
                    data-testid="perform-continue"
                  >
                    {snap?.comparable
                      ? 'See my results'
                      : config.startAction
                        ? 'Wait until the experiment has finished'
                        : 'Finish when the sugar has gone from both beakers'}
                  </Button>
                )}
              </div>
            </div>
          </div>
          </div>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl p-4 sm:p-6">
            {stage === 'intro' ? <IntroPanel config={config} resumed={false} onStart={() => goto('predict')} /> : null}
            {stage === 'predict' ? (
              <PredictPanel config={config} progress={progress} update={update} locked={locked} onNext={() => goto('setup')} />
            ) : null}
            {stage === 'compare' ? (
              <ComparePanel config={config} progress={progress} snap={snap} onBack={() => goto('perform')} onNext={() => goto('notebook')} />
            ) : null}
            {stage === 'notebook' ? (
              <NotebookPanel config={config} progress={progress} update={update} locked={locked} onNext={() => goto('assess')} />
            ) : null}
            {stage === 'assess' ? (
              <AssessPanel config={config} progress={progress} update={update} locked={locked} onNext={() => goto('feedback')} />
            ) : null}
            {stage === 'feedback' ? <Achievements game={game} /> : null}
            {stage === 'feedback' ? (
              <FeedbackPanel
                config={config}
                progress={progress}
                evaluation={evaluation}
                submitted={submitted}
                persisted={persisted}
                busy={busy}
                message={message}
                onSubmit={submit}
                onBack={() => goto('assess')}
              />
            ) : null}
          </div>
        </div>
      )}
    </Shell>
  );
}

function Shell({ standalone, children }: { standalone: boolean; children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-slate-100"
      role={standalone ? undefined : 'dialog'}
      aria-modal={standalone ? undefined : true}
      aria-label="3D virtual lab"
    >
      {children}
    </div>
  );
}

function Tool({
  label,
  onClick,
  children,
  active = false,
  small = false,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  active?: boolean;
  small?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`flex items-center justify-center rounded-lg border shadow ${small ? 'h-7 w-7' : 'h-9 min-w-9 px-2'} ${
        active ? 'border-sky-600 bg-sky-600 text-white' : 'border-slate-200 bg-white/95 text-slate-700 hover:bg-white'
      }`}
    >
      {children}
    </button>
  );
}

function formatTime(t: number): string {
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${String(m).padStart(2, '0')}:${s.toFixed(1).padStart(4, '0')}`;
}

interface Gamification {
  score: number;
  badges: { id: string; label: string; hint: string; earned: boolean }[];
}

/** The scientist score and badges, worked out from what the student has actually done. Nothing here is saved. */
function computeGamification(progress: LabProgress, snap: LabSnapshot | null, evaluation: LabEvaluation | null): Gamification {
  let score = 0;
  const reason = progress.prediction.reason.trim();
  if (progress.prediction.choice) score += 10;
  if (reason.length >= 20) score += 5;

  const tasks = snap ? Object.values(snap.tasksDone).filter(Boolean).length : 0;
  score += tasks * 10;

  const stats = (snap?.stats ?? {}) as { firstTrySetup?: boolean | null };
  if (stats.firstTrySetup === true) score += 20;
  else if (snap?.started) score += 5;

  const cells = progress.notebook.table.flat().filter((c) => c.trim() !== '').length;
  if (cells >= 4) score += 10;
  if ((progress.notebook.observationA + progress.notebook.observationB).trim().length >= 20) score += 5;

  const answered = Object.values(progress.answers).filter((a) => (Array.isArray(a) ? a.length > 0 : (a ?? '').trim() !== '')).length;
  score += answered * 4;
  const concluded = progress.conclusion.trim().length >= 40;
  if (concluded) score += 10;
  if (evaluation) score += Math.round((evaluation.scorePercent / 100) * 20);

  return {
    score,
    badges: [
      { id: 'predictor', label: 'Predictor', hint: 'Made a prediction and said why', earned: !!progress.prediction.choice && reason.length >= 20 },
      { id: 'careful', label: 'Careful Setup', hint: 'Set up the whole test correctly the first time', earned: stats.firstTrySetup === true },
      { id: 'collector', label: 'Data Collector', hint: 'Filled in the observation table', earned: cells >= 4 },
      { id: 'thinker', label: 'Evidence Thinker', hint: 'Wrote a conclusion backed by evidence', earned: concluded && answered >= 3 },
      { id: 'top', label: 'Top Scientist', hint: 'Scored 80% or more', earned: (evaluation?.scorePercent ?? 0) >= 80 },
    ],
  };
}

function Achievements({ game }: { game: Gamification }) {
  return (
    <section className="mx-auto mb-4 max-w-3xl px-4 pt-4 sm:px-6" aria-label="Achievements">
      <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4">
        <p className="flex items-center gap-2 text-sm font-bold text-amber-900">
          <Star className="h-4 w-4" aria-hidden /> Scientist score: {game.score}
        </p>
        <ul className="mt-2 flex flex-wrap gap-2">
          {game.badges.map((b) => (
            <li
              key={b.id}
              title={b.hint}
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${b.earned ? 'bg-amber-200 text-amber-950' : 'bg-white text-slate-400 line-through'}`}
            >
              <Award className="h-3.5 w-3.5" aria-hidden /> {b.label}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
