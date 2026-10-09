'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, X } from 'lucide-react';
import {
  correctPredictionIds,
  getEngine,
  pickExplanation,
  type CalculatorParams,
  type CalculatorState,
  type EngineResult,
  type LabConfig,
  type OsmosisParams,
  type OsmosisState,
  type RelevanceParams,
  type RelevanceState,
  type ClassifyParams,
  type ClassifyState,
  type SequenceParams,
  type SequenceState,
  type VariableModelParams,
  type VariableModelState,
} from '@/lib/prayogshala/engines';
import { validateLabConfig } from '@/lib/prayogshala/validate';
import type { PrayogshalaActivity } from '../../data/prayogshala';
import {
  ClassifyWorkspace,
  LAB_COLORS,
  SequenceWorkspace,
  SliderRow,
  VariableModelWorkspace,
} from './PrayogshalaWorkspaces';

/**
 * The interactive Prayogshala lab: the eight-step flow (Mission, Predict, Do, Observe, Explain,
 * Concept, Apply, Reflect) around a simulation workspace.
 *
 * Everything on screen comes from the activity's `lab_config` (backend data). The simulation
 * is one of a few generic engines (lib/prayogshala/engines.ts) chosen by `simulation.type`;
 * the observation, the explanation and the right prediction are all derived from the engine's
 * own facts for the student's current state, so they cannot contradict what the workspace
 * shows. This component has no knowledge of any chapter, standard or subject.
 *
 * Scope of what is claimed: this is a SIMULATION. It says so, and it does not record that a
 * physical experiment was performed. Reflection text stays on this screen and is not saved.
 */

export const LAB_STEPS = ['Mission', 'Predict', 'Do', 'Observe', 'Explain', 'Concept', 'Apply', 'Reflect'] as const;

// Light, colourful laboratory palette, scoped to the experiment only (the rest of the LMS keeps
// its own). White panels on a soft gradient; each of the eight steps has its own hue.
const C = LAB_COLORS;

const STEP_COLORS = ['#4f46e5', '#d946ef', '#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#14b8a6'];
const PAGE_BACKGROUND = 'linear-gradient(135deg, #eef2ff 0%, #fdf2f8 45%, #ecfeff 100%)';

type EngineState = CalculatorState | RelevanceState | OsmosisState | VariableModelState | SequenceState | ClassifyState;

// ------------------------------------------------------------------------ workspaces

interface WorkspaceProps<S, P> {
  params: P;
  state: S;
  setState: (next: S) => void;
  result: EngineResult;
  particleView: boolean;
}

function CalculatorWorkspace({ params, state, setState, result }: WorkspaceProps<CalculatorState, CalculatorParams>) {
  // Outputs that share a unit are drawn as bars so two routes can be compared by eye.
  const byUnit = new Map<string, { id: string; label: string; value: number; text: string }[]>();
  for (const output of result.outputs) {
    const value = result.facts[output.id];
    if (typeof value !== 'number') continue;
    const list = byUnit.get(output.unit) ?? [];
    list.push({ id: output.id, label: output.label, value, text: output.text });
    byUnit.set(output.unit, list);
  }
  const barGroups = [...byUnit.entries()].filter(([, list]) => list.length >= 2);

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        {params.variables.map((variable) => (
          <SliderRow
            key={variable.id}
            label={variable.label}
            unit={variable.unit}
            value={state.values[variable.id] ?? variable.default}
            min={variable.min}
            max={variable.max}
            step={variable.step}
            note={variable.kind}
            onChange={(value) => setState({ values: { ...state.values, [variable.id]: value } })}
          />
        ))}
      </div>

      {barGroups.map(([unit, list]) => {
        const top = Math.max(...list.map((item) => Math.abs(item.value)), 1);
        return (
          <div key={unit} className="space-y-2 rounded-xl p-3" style={{ background: C.panel2 }}>
            {list.map((item) => (
              <div key={item.id}>
                <div className="flex justify-between text-[12px]" style={{ color: C.muted }}>
                  <span>{item.label}</span>
                  <span className="tabular-nums" style={{ color: C.text }}>
                    {item.text} {unit}
                  </span>
                </div>
                <div className="mt-1 h-2.5 rounded-full" style={{ background: C.line }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(1.5, (Math.abs(item.value) / top) * 100)}%`, background: C.accent }} />
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function RelevanceWorkspace({ params, state, setState, result }: WorkspaceProps<RelevanceState, RelevanceParams>) {
  const toggle = (id: string) =>
    setState({ ...state, kept: state.kept.includes(id) ? state.kept.filter((k) => k !== id) : [...state.kept, id] });
  const keptDetails = params.details.filter((d) => state.kept.includes(d.id));

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-[12px] uppercase tracking-wide" style={{ color: C.muted }}>What are you asking?</p>
        <div className="space-y-2">
          {params.questions.map((question) => {
            const active = question.id === state.question;
            return (
              <button
                key={question.id}
                type="button"
                onClick={() => setState({ question: question.id, kept: [] })}
                className="w-full rounded-xl border px-3 py-2 text-left text-sm"
                style={{ borderColor: active ? C.accent : C.line, background: active ? C.accentSoft : C.panel2, color: C.text }}
              >
                {question.text}
              </button>
            );
          })}
        </div>
      </div>

      <svg viewBox="0 0 320 110" className="w-full rounded-xl" style={{ background: C.panel2 }} role="img" aria-label={`Model sheet for: ${params.subject}`}>
        <text x="12" y="18" fontSize="10" fill={C.muted}>{params.subject}</text>
        <path d="M20 90 Q150 -10 290 90" fill="none" stroke={C.line} strokeWidth="2" strokeDasharray="4 4" />
        <circle cx="20" cy="90" r="7" fill={C.sand} />
        {keptDetails.map((detail, index) => (
          <g key={detail.id}>
            <rect x={14 + (index % 3) * 100} y={30 + Math.floor(index / 3) * 24} width="94" height="18" rx="9" fill={C.accentSoft} stroke={C.accent} />
            <text x={61 + (index % 3) * 100} y={43 + Math.floor(index / 3) * 24} fontSize="9" textAnchor="middle" fill={C.text}>
              {detail.label.length > 18 ? `${detail.label.slice(0, 17)}…` : detail.label}
            </text>
          </g>
        ))}
        {keptDetails.length === 0 ? <text x="160" y="62" fontSize="11" textAnchor="middle" fill={C.muted}>Your model is empty - tick the details to keep</text> : null}
      </svg>

      <div>
        <p className="mb-2 text-[12px] uppercase tracking-wide" style={{ color: C.muted }}>Details of the situation (tick the ones your model keeps)</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {params.details.map((detail) => {
            const on = state.kept.includes(detail.id);
            return (
              <button
                key={detail.id}
                type="button"
                role="checkbox"
                aria-checked={on}
                onClick={() => toggle(detail.id)}
                className="flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm"
                style={{ borderColor: on ? C.accent : C.line, background: on ? C.accentSoft : C.panel2, color: C.text }}
              >
                <span className="flex h-4 w-4 items-center justify-center rounded border" style={{ borderColor: on ? C.accent : C.muted, background: on ? C.accent : 'transparent' }}>
                  {on ? <Check size={11} color={C.onAccent} /> : null}
                </span>
                {detail.label}
              </button>
            );
          })}
        </div>
      </div>
      <p className="text-[13px]" style={{ color: C.muted }}>
        Kept: <b style={{ color: C.text }}>{result.facts.kept}</b> · Missing: <b style={{ color: result.facts.missed ? C.bad : C.text }}>{result.facts.missed}</b> · Extra: <b style={{ color: result.facts.extra ? C.warn : C.text }}>{result.facts.extra}</b>
      </p>
    </div>
  );
}

function OsmosisWorkspace({ params, state, setState, result, particleView }: WorkspaceProps<OsmosisState, OsmosisParams>) {
  const specimen = params.specimens.find((s) => s.id === state.specimen) ?? params.specimens[0];
  const solution = params.solutions.find((s) => s.id === state.solution) ?? params.solutions[0];
  const change = result.facts.change_pct;
  // The drawn size follows the engine's own number, so the picture cannot disagree with the text.
  const scale = Math.max(0.6, Math.min(1.5, 1 + (change / params.full_change_pct) * 0.3));
  const tint = solution.solute_pct === 0 ? C.water : solution.solute_pct >= 15 ? '#8b6fb0' : '#5f93a8';
  const direction = result.facts.swell ? 'in' : result.facts.shrink ? 'out' : 'none';

  const cx = 150;
  const cy = 112;
  const radius = 34 * scale;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-[12px] uppercase tracking-wide" style={{ color: C.muted }}>
          Specimen
          <select
            value={state.specimen}
            onChange={(event) => setState({ ...state, specimen: event.target.value })}
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm normal-case"
            style={{ borderColor: C.line, background: C.panel2, color: C.text }}
          >
            {params.specimens.map((item) => (
              <option key={item.id} value={item.id}>{item.label}</option>
            ))}
          </select>
        </label>
        <label className="block text-[12px] uppercase tracking-wide" style={{ color: C.muted }}>
          Solution
          <select
            value={state.solution}
            onChange={(event) => setState({ ...state, solution: event.target.value })}
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm normal-case"
            style={{ borderColor: C.line, background: C.panel2, color: C.text }}
          >
            {params.solutions.map((item) => (
              <option key={item.id} value={item.id}>{item.label}</option>
            ))}
          </select>
        </label>
      </div>

      <SliderRow label="Time in the solution" unit="min" value={state.minutes} min={0} max={params.max_minutes} step={5} onChange={(minutes) => setState({ ...state, minutes })} />

      <svg viewBox="0 0 300 200" className="w-full rounded-xl" style={{ background: C.panel2 }} role="img" aria-label={`${specimen.label} in ${solution.label}`}>
        <rect x="40" y="40" width="220" height="140" rx="10" fill={tint} fillOpacity="0.55" stroke={C.muted} strokeWidth="2" />
        <text x="150" y="30" fontSize="11" textAnchor="middle" fill={C.muted}>{solution.label}</text>

        {specimen.measure === 'mass' ? (
          <rect x={cx - 38 * scale} y={cy - 26 * scale} width={76 * scale} height={52 * scale} rx="14" fill={C.sand} stroke="#c98a2e" strokeWidth="2" />
        ) : (
          <>
            {specimen.has_wall ? <rect x={cx - 42} y={cy - 42} width="84" height="84" rx="10" fill="none" stroke="#8ccf7a" strokeWidth="4" /> : null}
            {specimen.has_wall ? (
              <rect x={cx - radius} y={cy - radius} width={radius * 2} height={radius * 2} rx="8" fill="#6fae63" fillOpacity="0.55" stroke="#4f9d44" strokeWidth="2" />
            ) : (
              <circle cx={cx} cy={cy} r={radius} fill="#d98f8a" fillOpacity="0.6" stroke="#c4605a" strokeWidth="2" />
            )}
          </>
        )}

        {particleView ? (
          <g>
            {/* Solute particles in the solution: more of them in a stronger solution. */}
            {Array.from({ length: Math.round(solution.solute_pct / 2) }).map((_, i) => (
              <circle key={`s${i}`} cx={58 + ((i * 37) % 70) + (i % 2) * 120} cy={60 + ((i * 53) % 110)} r="3.2" fill="#f59e0b" />
            ))}
            {/* Water movement across the membrane, from the engine's direction. */}
            {direction !== 'none'
              ? [-24, 0, 24].map((dx) => (
                  <g key={dx} stroke="#0284c7" strokeWidth="2" fill="#0284c7">
                    <line x1={cx + dx} y1={direction === 'in' ? cy - 72 : cy - 52} x2={cx + dx} y2={direction === 'in' ? cy - 50 : cy - 74} />
                    <polygon points={direction === 'in' ? `${cx + dx - 4},${cy - 54} ${cx + dx + 4},${cy - 54} ${cx + dx},${cy - 46}` : `${cx + dx - 4},${cy - 70} ${cx + dx + 4},${cy - 70} ${cx + dx},${cy - 78}`} />
                  </g>
                ))
              : null}
            <text x="150" y="196" fontSize="10" textAnchor="middle" fill="#0369a1">
              {direction === 'in' ? 'Water moves INTO the cell' : direction === 'out' ? 'Water moves OUT of the cell' : 'No net movement of water'} · yellow dots = solute
            </text>
          </g>
        ) : null}
      </svg>
      {params.model_note ? <p className="text-[12px]" style={{ color: C.muted }}>Simulation note: {params.model_note}</p> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------- the lab

interface LabProps {
  activity: PrayogshalaActivity;
  lab: LabConfig;
  onClose: () => void;
}

export function PrayogshalaLab({ activity, lab, onClose }: LabProps) {
  // Checked before anything touches the parameters: a malformed config must not reach an engine.
  const configProblems = useMemo(() => validateLabConfig(lab), [lab]);
  const engine = configProblems.length ? null : getEngine(lab.simulation.type);
  const params = lab.simulation.params;

  const [step, setStep] = useState(0);
  const [furthest, setFurthest] = useState(0);
  const [prediction, setPrediction] = useState<string | null>(null);
  const [applyChoice, setApplyChoice] = useState<string | null>(null);
  const [reflection, setReflection] = useState('');
  const [touched, setTouched] = useState(false);
  const [state, setStateRaw] = useState<EngineState | null>(() => (engine ? engine.initialState(params) : null));
  const [particleView, setParticleView] = useState(false);
  const [teacherScript, setTeacherScript] = useState(false);

  // A different activity is a different lab: start it clean.
  useEffect(() => {
    queueMicrotask(() => {
      setStep(0);
      setFurthest(0);
      setPrediction(null);
      setApplyChoice(null);
      setReflection('');
      setTouched(false);
      setParticleView(false);
      setTeacherScript(false);
      setStateRaw(engine ? engine.initialState(params) : null);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activity.id]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const result = useMemo(() => (engine && state ? engine.evaluate(params, state) : null), [engine, params, state]);
  const correctIds = useMemo(() => (configProblems.length ? [] : correctPredictionIds(lab)), [lab, configProblems]);
  const setState = (next: EngineState) => {
    setStateRaw(next);
    setTouched(true);
  };

  const { steps } = lab;
  const hasParticle = !!engine?.supportsParticleView && lab.particle_view === true;
  const hasScript = (lab.teacher_script?.length ?? 0) > 0;
  const predicted = steps.predict.options.find((o) => o.id === prediction) ?? null;
  const predictedRight = prediction !== null && correctIds.includes(prediction);

  // The gate for moving forward from each step. Revisiting a step you have passed is always allowed.
  const nextBlockedReason = (() => {
    if (step === 1 && prediction === null) return 'Choose a prediction first.';
    if (step === 2 && !touched) return 'Try the lab first: change a control.';
    return null;
  })();
  const goNext = () => {
    if (nextBlockedReason || step >= LAB_STEPS.length - 1) return;
    setStep(step + 1);
    setFurthest(Math.max(furthest, step + 1));
  };

  // A lab that fails its own consistency checks is not run: it could contradict itself.
  if (configProblems.length > 0) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto px-6 py-10" style={{ background: PAGE_BACKGROUND, color: C.text }} role="alertdialog" aria-modal="true" aria-label="This activity cannot be run">
        <div className="max-w-xl rounded-2xl border p-6" style={{ background: C.panel, borderColor: C.warn }}>
          <h1 className="text-xl font-bold" style={{ color: C.warn }}>This activity cannot be run yet</h1>
          <p className="mt-2 text-sm" style={{ color: C.muted }}>
            {activity.title} did not pass the lab&rsquo;s checks, so it is not shown. Ask a teacher to review or regenerate it.
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
            {configProblems.slice(0, 5).map((problem) => <li key={problem}>{problem}</li>)}
          </ul>
          <button type="button" onClick={onClose} className="mt-5 rounded-full px-5 py-2 text-sm font-semibold" style={{ background: C.accent, color: C.onAccent }}>Back to chapter</button>
        </div>
      </div>
    );
  }

  const pill = () => ({ background: C.accentSoft, color: C.accent, border: `1px solid ${C.accent}` });
  const card = 'rounded-2xl border p-5 sm:p-6';

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <>
            <h2 className="text-3xl font-bold" style={{ color: STEP_COLORS[step] }}>Mission</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {activity.topic_name ? <span className="rounded-full px-3 py-1 text-xs" style={pill()}>Topic: {activity.topic_name}</span> : null}
              {(steps.mission.tags ?? []).map((tag) => (
                <span key={tag} className="rounded-full px-3 py-1 text-xs" style={{ background: C.panel2, color: C.muted }}>{tag}</span>
              ))}
            </div>
            <p className="mt-4 leading-7">{steps.mission.scenario}</p>
            <div className="mt-4 rounded-xl border-l-4 p-4" style={{ background: C.panel2, borderColor: C.accent }}>
              <p className="font-semibold">Your mission</p>
              <p className="mt-1">{steps.mission.task}</p>
            </div>
            {activity.objective ? <p className="mt-4 text-sm" style={{ color: C.muted }}>Learning objective: {activity.objective}</p> : null}
          </>
        );
      case 1:
        return (
          <>
            <h2 className="text-3xl font-bold" style={{ color: STEP_COLORS[step] }}>Predict</h2>
            <p className="mt-4 font-semibold leading-7">{steps.predict.question}</p>
            <div className="mt-4 space-y-2">
              {steps.predict.options.map((option) => {
                const on = prediction === option.id;
                return (
                  <button key={option.id} type="button" onClick={() => setPrediction(option.id)} className="flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left" style={{ borderColor: on ? C.accent : C.line, background: on ? C.accentSoft : C.panel2 }}>
                    <span className="flex h-4 w-4 items-center justify-center rounded-full border" style={{ borderColor: on ? C.accent : C.muted }}>
                      {on ? <span className="h-2 w-2 rounded-full" style={{ background: C.accent }} /> : null}
                    </span>
                    {option.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-3 text-sm" style={{ color: C.muted }}>Commit to a prediction before you open the lab. You will compare it with the result later.</p>
          </>
        );
      case 2:
        return (
          <>
            <h2 className="text-3xl font-bold" style={{ color: STEP_COLORS[step] }}>Do</h2>
            <ol className="mt-4 list-decimal space-y-2 pl-5 leading-7">
              {steps.do.instructions.map((line, index) => <li key={index}>{line}</li>)}
            </ol>
            {steps.do.materials?.length ? (
              <p className="mt-4 text-sm" style={{ color: C.muted }}><b style={{ color: C.text }}>Equipment:</b> {steps.do.materials.join(' · ')}</p>
            ) : null}
            {steps.do.safety ? (
              <div className="mt-4 rounded-xl border p-3 text-sm" style={{ borderColor: C.warn, background: C.warnSoft }}>
                <b style={{ color: C.warn }}>Safety:</b> {steps.do.safety}
              </div>
            ) : null}
            <p className="mt-4 text-sm" style={{ color: C.muted }}>This is a simulation. It does not replace doing the activity with real materials where your teacher asks you to.</p>
          </>
        );
      case 3:
        return (
          <>
            <h2 className="text-3xl font-bold" style={{ color: STEP_COLORS[step] }}>Observe</h2>
            <p className="mt-3" style={{ color: C.muted }}>{steps.observe.prompt}</p>
            <div className="mt-4 rounded-xl border-l-4 p-4 leading-7" style={{ background: C.panel2, borderColor: C.accent }}>
              {touched ? result?.observation : 'You have not changed anything in the lab yet. Go back to Do and try it.'}
            </div>
            {result?.warnings.map((warning, index) => (
              <p key={index} className="mt-3 rounded-xl border p-3 text-sm" style={{ borderColor: C.warn, color: C.warn }}>{warning}</p>
            ))}
            {touched && result && result.outputs.length > 0 ? (
              <table className="mt-4 w-full text-sm">
                <tbody>
                  {result.outputs.map((output) => (
                    <tr key={output.id} className="border-t" style={{ borderColor: C.line }}>
                      <td className="py-2" style={{ color: C.muted }}>{output.label}</td>
                      <td className="py-2 text-right font-semibold tabular-nums">{output.text} <span style={{ color: C.muted }}>{output.unit}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
          </>
        );
      case 4:
        return (
          <>
            <h2 className="text-3xl font-bold" style={{ color: STEP_COLORS[step] }}>Explain</h2>
            <p className="mt-4 leading-7">{result ? pickExplanation(steps.explain, result.facts) : steps.explain.text}</p>
          </>
        );
      case 5:
        return (
          <>
            <h2 className="text-3xl font-bold" style={{ color: STEP_COLORS[step] }}>Concept</h2>
            <p className="mt-4 font-semibold leading-7">{steps.concept.text}</p>
            <ul className="mt-3 list-disc space-y-2 pl-5 leading-7">
              {(steps.concept.points ?? []).map((point, index) => <li key={index}>{point}</li>)}
            </ul>
            {activity.concept_name ? <p className="mt-4 text-sm" style={{ color: C.muted }}>Chapter concept: {activity.concept_name}</p> : null}
          </>
        );
      case 6:
        return (
          <>
            <h2 className="text-3xl font-bold" style={{ color: STEP_COLORS[step] }}>Apply</h2>
            <p className="mt-4 font-semibold leading-7">{steps.apply.question}</p>
            <div className="mt-4 space-y-2">
              {steps.apply.options.map((option) => {
                const chosen = applyChoice === option.id;
                return (
                  <button key={option.id} type="button" onClick={() => setApplyChoice(option.id)} className="w-full rounded-xl border px-4 py-3 text-left" style={{ borderColor: chosen ? (option.correct ? C.accent : C.bad) : C.line, background: chosen ? (option.correct ? C.accentSoft : 'rgba(229,118,106,0.12)') : C.panel2 }}>
                    {option.label}
                  </button>
                );
              })}
            </div>
            {applyChoice ? (
              <p className="mt-3 text-sm leading-6" style={{ color: steps.apply.options.find((o) => o.id === applyChoice)?.correct ? C.accent : C.warn }}>
                {steps.apply.options.find((o) => o.id === applyChoice)?.feedback}
              </p>
            ) : null}
          </>
        );
      default: {
        const applied = steps.apply.options.find((o) => o.id === applyChoice) ?? null;
        return (
          <>
            <h2 className="text-3xl font-bold" style={{ color: STEP_COLORS[step] }}>Reflect</h2>
            <dl className="mt-4 space-y-3 text-sm leading-6">
              <div>
                <dt style={{ color: C.muted }}>Your prediction</dt>
                <dd>
                  {predicted ? predicted.label : 'You did not make a prediction.'}{' '}
                  {predicted ? (
                    <span className="inline-flex items-center gap-1 font-semibold" style={{ color: predictedRight ? C.accent : C.warn }}>
                      {predictedRight ? <Check size={14} /> : <X size={14} />} {predictedRight ? 'matched the simulation' : 'did not match the simulation'}
                    </span>
                  ) : null}
                </dd>
              </div>
              <div>
                <dt style={{ color: C.muted }}>What the lab showed (your last setting)</dt>
                <dd>{touched ? result?.observation : 'You did not run the lab.'}</dd>
              </div>
              <div>
                <dt style={{ color: C.muted }}>Your answer to Apply</dt>
                <dd>{applied ? `${applied.label} - ${applied.correct ? 'correct' : 'not quite'}` : 'Not answered.'}</dd>
              </div>
            </dl>
            <div className="mt-5 space-y-3">
              {steps.reflect.prompts.map((prompt, index) => <p key={index} className="font-semibold">{prompt}</p>)}
              <textarea
                value={reflection}
                onChange={(event) => setReflection(event.target.value)}
                rows={4}
                aria-label="Your reflection"
                className="w-full rounded-xl border p-3 text-sm"
                style={{ background: C.panel2, borderColor: C.line, color: C.text }}
                placeholder="Write your thoughts. They stay on this screen and are not saved."
              />
            </div>
            {lab.outcomes?.length ? (
              <div className="mt-5">
                <p className="text-sm font-semibold">Learning outcomes</p>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm" style={{ color: C.muted }}>
                  {lab.outcomes.map((outcome, index) => <li key={index}>{outcome}</li>)}
                </ul>
              </div>
            ) : null}
          </>
        );
      }
    }
  };

  const ctx = activity.context;
  const subtitle = [
    ctx?.subject_name,
    ctx?.standard_name ? `Standard ${ctx.standard_name}` : null,
    ctx?.chapter_name,
    activity.topic_name ? `Topic: ${activity.topic_name}` : null,
  ].filter(Boolean).join(' · ');

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto" style={{ background: PAGE_BACKGROUND, color: C.text }} role="dialog" aria-modal="true" aria-label={activity.title}>
      <div className="mx-auto max-w-[1280px] px-4 py-6 sm:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <button type="button" onClick={onClose} className="mb-3 inline-flex items-center gap-2 text-sm" style={{ color: C.muted }}>
              <ArrowLeft size={15} /> Back to chapter
            </button>
            <h1 className="bg-gradient-to-r from-indigo-600 via-fuchsia-500 to-sky-500 bg-clip-text text-3xl font-bold leading-tight text-transparent sm:text-5xl">{activity.title}</h1>
            <p className="mt-2 max-w-2xl text-sm" style={{ color: C.muted }}>Prayogshala{subtitle ? ` · ${subtitle}` : ''}</p>
            {activity.status !== 'published' ? (
              <p className="mt-3 inline-block rounded-full px-3 py-1 text-xs" style={{ background: C.warnSoft, color: C.warn }}>
                {activity.status === 'review' ? 'Pending teacher review - visible to teachers and admins only' : 'Draft - visible to teachers and admins only'}
              </p>
            ) : null}
          </div>
          <div className="flex gap-2">
            {hasParticle ? (
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-sm" style={{ borderColor: C.line, background: C.panel, color: C.text }}>
                <input type="checkbox" checked={particleView} onChange={(event) => setParticleView(event.target.checked)} /> Particle view
              </label>
            ) : null}
            {hasScript ? (
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-sm" style={{ borderColor: C.line, background: C.panel, color: C.text }}>
                <input type="checkbox" checked={teacherScript} onChange={(event) => setTeacherScript(event.target.checked)} /> Teacher script
              </label>
            ) : null}
          </div>
        </div>

        <ol className="mt-6 flex flex-wrap gap-2">
          {LAB_STEPS.map((label, index) => {
            const active = index === step;
            const reachable = index <= furthest;
            return (
              <li key={label}>
                <button
                  type="button"
                  disabled={!reachable}
                  aria-current={active ? 'step' : undefined}
                  onClick={() => setStep(index)}
                  className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm disabled:opacity-40"
                  style={{ borderColor: active ? STEP_COLORS[index] : C.line, background: active ? `${STEP_COLORS[index]}1f` : C.panel, color: C.text }}
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold" style={{ background: reachable ? STEP_COLORS[index] : C.panel2, color: reachable ? C.onAccent : C.muted }}>{index + 1}</span>
                  {label}
                </button>
              </li>
            );
          })}
        </ol>

        {teacherScript && hasScript ? (
          <div className="mt-5 rounded-2xl border p-4 text-sm leading-6" style={{ borderColor: C.warn, background: C.warnSoft }}>
            <p className="mb-1 font-semibold" style={{ color: C.warn }}>Teacher script</p>
            <ul className="list-disc space-y-1 pl-5">{lab.teacher_script!.map((line, i) => <li key={i}>{line}</li>)}</ul>
          </div>
        ) : null}

        <div className="mt-6 grid gap-5 lg:grid-cols-[1.05fr_1fr]">
          <section className={card} style={{ background: C.panel, borderColor: C.line, borderTop: `5px solid ${C.water}`, boxShadow: '0 10px 30px rgba(31,41,90,0.08)' }} aria-label="Lab workspace">
            <p className="mb-4 text-xs font-semibold" style={{ color: C.muted }}>{engine?.supportsParticleView && particleView ? 'What is really happening (particle view)' : 'What your eyes see'}</p>
            {!engine || !state || !result ? (
              <p className="text-sm" style={{ color: C.warn }}>This lab needs a simulation (&ldquo;{lab.simulation.type}&rdquo;) that this version of the LMS does not have yet. The steps on the right still work.</p>
            ) : lab.simulation.type === 'calculator' ? (
              <CalculatorWorkspace params={params as unknown as CalculatorParams} state={state as CalculatorState} setState={setState} result={result} particleView={false} />
            ) : lab.simulation.type === 'relevance' ? (
              <RelevanceWorkspace params={params as unknown as RelevanceParams} state={state as RelevanceState} setState={setState} result={result} particleView={false} />
            ) : lab.simulation.type === 'osmosis' ? (
              <OsmosisWorkspace params={params as unknown as OsmosisParams} state={state as OsmosisState} setState={setState} result={result} particleView={particleView} />
            ) : lab.simulation.type === 'variable_model' ? (
              <VariableModelWorkspace params={params as unknown as VariableModelParams} state={state as VariableModelState} setState={setState} result={result} />
            ) : lab.simulation.type === 'sequence' ? (
              <SequenceWorkspace params={params as unknown as SequenceParams} state={state as SequenceState} setState={setState} result={result} />
            ) : lab.simulation.type === 'classify' ? (
              <ClassifyWorkspace params={params as unknown as ClassifyParams} state={state as ClassifyState} setState={setState} result={result} />
            ) : null}
          </section>

          <section className={card} style={{ background: C.panel, borderColor: C.line, borderTop: `5px solid ${STEP_COLORS[step]}`, boxShadow: '0 10px 30px rgba(31,41,90,0.08)' }} aria-label={`Step ${step + 1}: ${LAB_STEPS[step]}`}>
            {renderStep()}
            <div className="mt-6 flex items-center justify-between gap-3 border-t pt-4" style={{ borderColor: C.line }}>
              <button type="button" disabled={step === 0} onClick={() => setStep(step - 1)} className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm disabled:opacity-40" style={{ borderColor: C.line }}>
                <ArrowLeft size={14} /> Back
              </button>
              <div className="flex items-center gap-3">
                {nextBlockedReason ? <span className="text-xs" style={{ color: C.warn }}>{nextBlockedReason}</span> : null}
                {step < LAB_STEPS.length - 1 ? (
                  <button type="button" disabled={!!nextBlockedReason} onClick={goNext} className="inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold disabled:opacity-40" style={{ background: C.accent, color: C.onAccent }}>
                    Next <ArrowRight size={14} />
                  </button>
                ) : (
                  <button type="button" onClick={onClose} className="rounded-full px-5 py-2 text-sm font-semibold" style={{ background: C.accent, color: C.onAccent }}>Finish</button>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
