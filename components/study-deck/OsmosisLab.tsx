'use client';

import { Pause, Play, RotateCcw } from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';

import {
  advance,
  countOn,
  createState,
  modeFor,
  PORE_HALF,
  PORES,
  predictionFeedback,
  SCENE,
  SOLUTE_R,
  STEPS,
  WATER_R,
  type Direction,
  type LabStep,
  type OsmosisState,
} from '@/lib/study-deck/osmosis';
import { useReducedMotion } from './stage-ui';

export interface OsmosisLabProps {
  /** Index of the selected step (0 dilute, 1 membrane, 2 concentrated, 3 equilibrium), or null. The slide owns it. */
  step: number | null;
  /** The student chose a step by clicking a region of the scene. */
  onSelect: (index: number) => void;
}

/** How much faster than real time the model runs while playing. */
const TIME_SCALE = 4;

const WATER = '#2563eb';
const SOLUTE = '#d97706';
const ACCENT = '#4f46e5';

const CAPTION: Record<LabStep | 'none', string> = {
  none: 'Select a step, or press Play to watch water cross the membrane.',
  dilute: 'Dilute side: more water molecules and only a few solute particles.',
  membrane: 'The pores let the small water molecules through. The larger solute particles cannot cross.',
  concentrated: 'Concentrated side: fewer water molecules and many solute particles.',
  equilibrium: 'Water crosses both ways at about equal rates. The molecules keep moving, but there is no net movement.',
};

/** Keyboard activation for a region that is a button drawn in SVG. */
function onActivate(run: () => void) {
  return (event: KeyboardEvent<SVGElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      event.stopPropagation();
      run();
    }
  };
}

/**
 * The osmosis illustration of the "From diffusion to osmosis" slide, drawn as a live model (lib/study-deck/osmosis.ts): two
 * chambers, a membrane with pores, water molecules and solute particles. It holds no step of its own: the slide's selected step is
 * passed in, so the list, the four-step diagram and this scene always show the same step, and a click here is reported up.
 *
 * Changing the step pauses the motion and restores that step's starting state (the last step starts from the balanced state).
 * Play/Pause, Reset, the two visibility toggles and the prediction are the student's own; none of them is scored.
 */
export function OsmosisLab({ step, onSelect }: OsmosisLabProps) {
  const still = useReducedMotion();
  const active: LabStep | null = step === null ? null : (STEPS[step] ?? null);
  const [sim, setSim] = useState<OsmosisState>(() => createState(modeFor(active)));
  const [playing, setPlaying] = useState(false);
  const [showWater, setShowWater] = useState(true);
  const [showSolute, setShowSolute] = useState(true);
  const [predict, setPredict] = useState<{ open: boolean; choice: Direction | null }>({ open: false, choice: null });

  // A different step: stop, and show that step's starting state. (Adjusting state while rendering, so no frame shows the old step.)
  const [shownStep, setShownStep] = useState<LabStep | null>(active);
  if (shownStep !== active) {
    setShownStep(active);
    setPlaying(false);
    setSim(createState(modeFor(active)));
  }

  const last = useRef<number | null>(null);
  useEffect(() => {
    if (!playing) return undefined;
    if (still) {
      // Reduced motion: no continuous movement; the model advances a second at a time.
      const timer = window.setInterval(() => setSim((s) => advance(s, 2)), 1000);

      return () => window.clearInterval(timer);
    }
    let frame = 0;
    last.current = null;
    const tick = (now: number) => {
      const dt = last.current === null ? 0 : Math.min(0.05, (now - last.current) / 1000);
      last.current = now;
      // The model runs faster than real time so a few seconds of watching show what crossed.
      if (dt > 0) setSim((s) => advance(s, dt * TIME_SCALE));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frame);
  }, [playing, still]);

  const reset = () => {
    setPlaying(false);
    setSim(createState(modeFor(active)));
  };

  const waterLeft = countOn(sim, 'water', 'left');
  const waterRight = countOn(sim, 'water', 'right');
  const soluteLeft = countOn(sim, 'solute', 'left');
  const soluteRight = countOn(sim, 'solute', 'right');
  const leftOn = active === 'dilute' || active === 'equilibrium';
  const rightOn = active === 'concentrated' || active === 'equilibrium';
  const membraneOn = active === 'membrane';
  const chamber = (on: boolean) => (on ? { stroke: ACCENT, strokeWidth: 0.9, fill: 'rgba(79,70,229,0.10)' } : { stroke: '#94a3b8', strokeWidth: 0.4, fill: '#f8fafc' });
  const select = (index: number) => () => onSelect(index);
  // Water crosses at a rate that grows with how much water meets the pores: the arrows are as thick as the water on their side.
  const arrow = (n: number) => 0.3 + n * 0.011;
  const feedback = predict.choice ? predictionFeedback(predict.choice) : null;

  const region = (index: number, label: string, x: number, y: number, w: number, h: number) => (
    <rect
      x={x}
      y={y}
      width={w}
      height={h}
      fill="transparent"
      role="button"
      tabIndex={0}
      aria-label={label}
      aria-pressed={step === index}
      data-testid={`osmosis-region-${STEPS[index]}`}
      className="cursor-pointer focus-visible:outline-none [&:focus-visible]:stroke-[#4f46e5] [&:focus-visible]:stroke-[0.8]"
      onClick={select(index)}
      onKeyDown={onActivate(select(index))}
    />
  );

  const toggle = (label: string, color: string, on: boolean, flip: () => void) => (
    <button
      type="button"
      aria-pressed={on}
      onClick={flip}
      className={`inline-flex items-center gap-[0.4em] rounded-full border px-[0.6em] py-[0.15em] text-[0.8em] font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-sd-accent ${
        on ? 'border-sd-accent bg-white text-slate-900' : 'border-slate-300 bg-slate-100 text-slate-500 line-through'
      }`}
    >
      <span aria-hidden="true" className="inline-block h-[0.8em] w-[0.8em] rounded-full border-2" style={{ borderColor: color, backgroundColor: on ? color : 'transparent' }} />
      {label}
    </button>
  );

  const control =
    'inline-flex items-center gap-[0.35em] rounded-[0.6em] border border-sd-line bg-white px-[0.6em] py-[0.2em] text-[0.8em] font-semibold text-sd-strong shadow-sm hover:border-sd-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-sd-accent';

  return (
    <div data-testid="osmosis-lab" className="relative flex h-full min-h-0 w-full min-w-0 flex-col gap-[0.4em] rounded-[0.9em] border border-sd-line bg-white/90 p-[0.5em] shadow-sm">
      <div className="relative min-h-0 flex-1">
        <svg viewBox={`0 0 ${SCENE.width} ${SCENE.height + 4}`} role="group" aria-label="Osmosis across a selectively permeable membrane" className="h-full w-full" preserveAspectRatio="xMidYMid meet">
          {/* Chambers */}
          <rect x={SCENE.left} y={SCENE.top} width={SCENE.membrane - SCENE.left - 1} height={SCENE.bottom - SCENE.top} rx={1.2} {...chamber(leftOn)} />
          <rect x={SCENE.membrane + 1} y={SCENE.top} width={SCENE.right - SCENE.membrane - 1} height={SCENE.bottom - SCENE.top} rx={1.2} {...chamber(rightOn)} />

          {/* Membrane: wall pieces between the pores */}
          {(() => {
            const gaps = PORES.map((p) => [p - PORE_HALF, p + PORE_HALF] as const);
            const pieces: Array<readonly [number, number]> = [];
            let y: number = SCENE.top;
            for (const [a, b] of gaps) {
              pieces.push([y, a]);
              y = b;
            }
            pieces.push([y, SCENE.bottom]);

            return pieces.map(([a, b], i) => (
              <rect key={i} x={SCENE.membrane - 0.7} y={a} width={1.4} height={b - a} rx={0.5} fill={membraneOn ? ACCENT : '#475569'} stroke={membraneOn ? '#c7d2fe' : 'none'} strokeWidth={0.8} />
            ));
          })()}
          {membraneOn
            ? PORES.map((p) => <ellipse key={p} cx={SCENE.membrane} cy={p} rx={1.6} ry={PORE_HALF} fill="none" stroke={ACCENT} strokeWidth={0.5} strokeDasharray="0.8 0.8" />)
            : null}

          {/* Particles */}
          {sim.particles.map((p) =>
            p.kind === 'water' ? (
              showWater ? <circle key={p.id} cx={p.x} cy={p.y} r={WATER_R} fill={WATER} opacity={0.9} data-kind="water" /> : null
            ) : showSolute ? (
              <circle key={p.id} cx={p.x} cy={p.y} r={SOLUTE_R} fill={SOLUTE} stroke="#92400e" strokeWidth={0.3} data-kind="solute" />
            ) : null
          )}

          {/* Water crossing the membrane, one arrow each way, as thick as the water on the side it leaves from */}
          <g aria-hidden="true" data-testid="osmosis-arrows">
            <line x1={SCENE.membrane - 14} y1={1.7} x2={SCENE.membrane + 14} y2={1.7} stroke={WATER} strokeWidth={arrow(waterLeft)} markerEnd="url(#arrow-right)" strokeLinecap="round" />
            <line x1={SCENE.membrane + 14} y1={4.3} x2={SCENE.membrane - 14} y2={4.3} stroke={WATER} strokeWidth={arrow(waterRight)} markerEnd="url(#arrow-left)" strokeLinecap="round" />
          </g>
          <defs>
            <marker id="arrow-right" viewBox="0 0 4 4" refX="3" refY="2" markerWidth="2.2" markerHeight="2.2" orient="auto">
              <path d="M0 0 L4 2 L0 4 z" fill={WATER} />
            </marker>
            <marker id="arrow-left" viewBox="0 0 4 4" refX="3" refY="2" markerWidth="2.2" markerHeight="2.2" orient="auto">
              <path d="M0 0 L4 2 L0 4 z" fill={WATER} />
            </marker>
          </defs>

          {/* Names under the chambers */}
          <text x={(SCENE.left + SCENE.membrane) / 2} y={SCENE.height + 1.5} textAnchor="middle" fontSize={2.8} fontWeight={700} fill="#0f172a">
            Dilute: water {waterLeft}, solute {soluteLeft}
          </text>
          <text x={(SCENE.membrane + SCENE.right) / 2} y={SCENE.height + 1.5} textAnchor="middle" fontSize={2.8} fontWeight={700} fill="#0f172a">
            Concentrated: water {waterRight}, solute {soluteRight}
          </text>

          {/* The clickable regions: the dilute side, the membrane, the concentrated side */}
          {region(0, 'Dilute solution', SCENE.left, SCENE.top, SCENE.membrane - SCENE.left - 3, SCENE.bottom - SCENE.top)}
          {region(2, 'Concentrated solution', SCENE.membrane + 3, SCENE.top, SCENE.right - SCENE.membrane - 3, SCENE.bottom - SCENE.top)}
          {region(1, 'Selectively permeable membrane', SCENE.membrane - 3, SCENE.top, 6, SCENE.bottom - SCENE.top)}
        </svg>

      </div>

      {predict.open ? (
        <div role="dialog" aria-label="Predict the direction" className="absolute inset-[0.4em] z-10 flex flex-col justify-center gap-[0.5em] rounded-[0.8em] border-2 border-sd-accent bg-white/97 p-[0.8em] shadow-xl">
          <p className="text-[1em] font-bold text-slate-900">Which direction will water move?</p>
          <div className="flex flex-wrap gap-[0.5em]">
            {(
              [
                ['dilute-to-concentrated', 'Dilute → Concentrated'],
                ['concentrated-to-dilute', 'Concentrated → Dilute'],
              ] as const
            ).map(([value, text]) => (
              <button
                key={value}
                type="button"
                aria-pressed={predict.choice === value}
                onClick={() => setPredict({ open: true, choice: value })}
                className={`rounded-[0.6em] border-2 px-[0.8em] py-[0.3em] text-[0.9em] font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-sd-accent ${
                  predict.choice === value ? (feedback?.correct ? 'border-emerald-600 bg-emerald-50 text-emerald-900' : 'border-amber-600 bg-amber-50 text-amber-900') : 'border-sd-line bg-white text-slate-800 hover:border-sd-accent'
                }`}
              >
                {text}
              </button>
            ))}
          </div>
          <div role="status" aria-live="polite" className="min-h-[3.2em] text-[0.85em] leading-snug text-slate-800">
            {feedback ? (
              <>
                <strong>{feedback.correct ? 'Correct. ' : 'Not yet. '}</strong>
                {feedback.message}
              </>
            ) : (
              'Choose a direction to see what the model says.'
            )}
          </div>
          <div className="flex gap-[0.5em]">
            {feedback && !feedback.correct ? (
              <button type="button" className={control} onClick={() => setPredict({ open: true, choice: null })}>
                Try again
              </button>
            ) : null}
            <button type="button" className={control} onClick={() => setPredict({ open: false, choice: null })}>
              {feedback?.correct ? 'Done' : 'Close'}
            </button>
          </div>
        </div>
      ) : null}

      <p role="status" aria-live="polite" className="min-h-[2.4em] text-[0.8em] leading-snug text-slate-700">
        {CAPTION[active ?? 'none']}
        {sim.time > 0 ? (
          <span className="ml-[0.5em] font-semibold tabular-nums text-slate-900" data-testid="osmosis-tally">
            Crossed: dilute → concentrated {sim.crossings.toRight}, concentrated → dilute {sim.crossings.toLeft}
          </span>
        ) : null}
      </p>

      <div className="flex flex-wrap items-center gap-[0.4em]">
        <button type="button" className={control} onClick={() => setPlaying((p) => !p)} aria-pressed={playing} data-testid="osmosis-play">
          {playing ? <Pause className="h-[1em] w-[1em]" aria-hidden="true" /> : <Play className="h-[1em] w-[1em]" aria-hidden="true" />}
          {playing ? 'Pause' : 'Play'}
        </button>
        <button type="button" className={control} onClick={reset} data-testid="osmosis-reset">
          <RotateCcw className="h-[1em] w-[1em]" aria-hidden="true" />
          Reset
        </button>
        {toggle('Water', WATER, showWater, () => setShowWater((v) => !v))}
        {toggle('Solute', SOLUTE, showSolute, () => setShowSolute((v) => !v))}
        <button type="button" className={`${control} ml-auto`} onClick={() => setPredict({ open: true, choice: null })} data-testid="osmosis-predict">
          Predict the direction
        </button>
      </div>
    </div>
  );
}
