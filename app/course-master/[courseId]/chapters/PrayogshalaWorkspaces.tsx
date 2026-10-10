'use client';

import React, { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Check, X } from 'lucide-react';
import type {
  ClassifyParams,
  ClassifyState,
  EngineResult,
  SequenceParams,
  SequenceState,
  VariableModelParams,
  VariableModelState,
  VisualState,
} from '@/lib/prayogshala/engines';

/**
 * Workspaces for the generic Prayogshala engines (variable_model, sequence, classify) and the
 * animated visuals a variable_model can draw.
 *
 * Every visual is a fixed, trusted component. It receives numbers the engine has already worked
 * out from the student's controls - never markup, never code - so the picture can only show what
 * the simulation computed. Motion is CSS and is switched off when the student's system asks for
 * reduced motion (both by the media query below and by the `animate` flag).
 */

export const LAB_COLORS = {
  bg: '#f5f7ff',
  panel: '#ffffff',
  panel2: '#f1f5fb',
  line: '#dfe6f1',
  text: '#1b2540',
  muted: '#5d6b85',
  accent: '#4f46e5',
  accentSoft: 'rgba(79,70,229,0.10)',
  onAccent: '#ffffff',
  warn: '#b45309',
  warnSoft: 'rgba(245,158,11,0.14)',
  bad: '#d6455d',
  good: '#0f9d74',
  water: '#5bb5e8',
  sand: '#f0b45a',
};
const C = LAB_COLORS;

/** True when the student prefers reduced motion. Re-evaluated if the setting changes. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!query) return;
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener?.('change', update);
    return () => query.removeEventListener?.('change', update);
  }, []);
  return reduced;
}

const MOTION_CSS = `
@keyframes pg-rise { 0% { transform: translateY(0); opacity: 0; } 15% { opacity: .9; } 100% { transform: translateY(-46px); opacity: 0; } }
@keyframes pg-vapour { 0% { transform: translateY(0) scaleX(1); opacity: 0; } 25% { opacity: .65; } 100% { transform: translateY(-34px) scaleX(1.4); opacity: 0; } }
@keyframes pg-flicker { 0%, 100% { transform: scaleY(1); } 50% { transform: scaleY(1.12); } }
@keyframes pg-jiggle { 0% { transform: translate(0, 0); } 25% { transform: translate(var(--a), calc(var(--a) * -.6)); } 50% { transform: translate(calc(var(--a) * -.8), var(--a)); } 75% { transform: translate(calc(var(--a) * .5), calc(var(--a) * .9)); } 100% { transform: translate(0, 0); } }
@keyframes pg-flow { to { stroke-dashoffset: -24; } }
@keyframes pg-wave { from { transform: translateX(0); } to { transform: translateX(-80px); } }
@keyframes pg-spin { to { transform: rotate(360deg); } }
@keyframes pg-fall { 0% { transform: translateY(-10px); opacity: 0; } 15% { opacity: .9; } 100% { transform: translateY(78px); opacity: 0; } }
@keyframes pg-drift { 0% { transform: translateX(-8px); } 50% { transform: translateX(8px); } 100% { transform: translateX(-8px); } }
@keyframes pg-orbit { to { transform: rotate(360deg); } }
@keyframes pg-swing { 0%, 100% { transform: rotate(calc(var(--amp) * -1)); } 50% { transform: rotate(var(--amp)); } }
@keyframes pg-shine { 0%, 100% { transform: scale(1); opacity: .35; } 50% { transform: scale(1.12); opacity: .55; } }
@keyframes pg-glow { 0%, 100% { opacity: var(--glow); } 50% { opacity: calc(var(--glow) * .85); } }
.pg-fluid { transition: all .35s ease; }
@media (prefers-reduced-motion: reduce) { .pg-anim, .pg-fluid { animation: none !important; transition: none !important; } }
`;

function MotionStyles() {
  return <style>{MOTION_CSS}</style>;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// ---------------------------------------------------------------------------- controls

export function SliderRow({
  label,
  unit,
  value,
  min,
  max,
  step,
  note,
  onChange,
}: {
  label: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  step: number;
  note?: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between gap-3 text-[13px]">
        <span style={{ color: C.text }}>
          {label}
          {note ? <span className="ml-2 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide" style={{ background: C.panel2, color: C.muted }}>{note}</span> : null}
        </span>
        <span className="font-semibold tabular-nums" style={{ color: C.accent }}>
          {value} <span style={{ color: C.muted }}>{unit}</span>
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-1 w-full"
        style={{ accentColor: C.accent }}
      />
    </label>
  );
}

// ------------------------------------------------------------------------------ visuals

function HeatingVisual({ v, animate }: { v: VisualState; animate: boolean }) {
  const temperature = v.values.temperature ?? 0;
  const heat = clamp(v.values.heat ?? 0, 0, 1);
  const boiling = v.values.boiling_point ?? 100;
  const boils = boiling > 0 && temperature >= boiling;
  const mercury = clamp(temperature / (boiling * 1.25 || 1), 0, 1) * 110;
  const flame = 6 + 44 * heat;

  return (
    <svg viewBox="0 0 320 250" className="w-full rounded-xl" style={{ background: C.panel2 }} role="img" aria-label={`A beaker of liquid on a burner. Temperature ${Math.round(temperature)} degrees. ${boils ? 'The liquid is boiling and vapour rises.' : 'The liquid is not boiling.'}`}>
      {/* burner */}
      <rect x="110" y="214" width="100" height="14" rx="4" fill="#64748b" />
      <rect x="148" y="204" width="24" height="12" fill="#94a3b8" />
      {heat > 0 ? (
        <g className={animate ? 'pg-anim' : undefined} style={{ transformOrigin: '160px 204px', animation: animate ? 'pg-flicker .5s ease-in-out infinite' : undefined }}>
          <path d={`M160 204 C 146 ${204 - flame * 0.5}, 152 ${204 - flame * 0.8}, 160 ${204 - flame} C 168 ${204 - flame * 0.8}, 174 ${204 - flame * 0.5}, 160 204 Z`} fill="#fb923c" />
          <path d={`M160 204 C 153 ${204 - flame * 0.3}, 156 ${204 - flame * 0.5}, 160 ${204 - flame * 0.6} C 164 ${204 - flame * 0.5}, 167 ${204 - flame * 0.3}, 160 204 Z`} fill="#fde047" />
        </g>
      ) : null}
      {/* beaker and liquid */}
      <rect x="100" y="86" width="120" height="112" rx="6" fill={C.water} fillOpacity={boils ? 0.7 : 0.5} className="pg-fluid" />
      <path d="M100 66 V198 a6 6 0 0 0 6 6 H214 a6 6 0 0 0 6 -6 V66" fill="none" stroke={C.muted} strokeWidth="3" />
      {boils ? (
        <g>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <circle
              key={i}
              cx={116 + i * 18}
              cy={188 - (i % 3) * 6}
              r={3 + (i % 3)}
              fill="#e0f2fe"
              stroke="#7dd3fc"
              className={animate ? 'pg-anim' : undefined}
              style={{ animation: animate ? `pg-rise ${1.1 + (i % 3) * 0.3}s ease-in ${i * 0.17}s infinite` : undefined, opacity: animate ? undefined : 0.9 }}
            />
          ))}
          {[0, 1, 2].map((i) => (
            <path
              key={i}
              d={`M${132 + i * 28} 78 q 6 -10 0 -20 q -6 -10 0 -20`}
              fill="none"
              stroke="#94a3b8"
              strokeWidth="3"
              strokeLinecap="round"
              className={animate ? 'pg-anim' : undefined}
              style={{ animation: animate ? `pg-vapour 1.8s ease-out ${i * 0.5}s infinite` : undefined, opacity: animate ? undefined : 0.6 }}
            />
          ))}
        </g>
      ) : null}
      {/* thermometer */}
      <rect x="248" y="60" width="14" height="124" rx="7" fill="#fff" stroke={C.muted} strokeWidth="2" />
      <rect x="251" y={178 - mercury} width="8" height={mercury + 4} rx="4" fill={boils ? '#ef4444' : '#f87171'} className="pg-fluid" />
      <circle cx="255" cy="196" r="11" fill={boils ? '#ef4444' : '#f87171'} stroke={C.muted} strokeWidth="2" />
      <text x="255" y="224" fontSize="12" textAnchor="middle" fontWeight="700" fill={C.text}>{Math.round(temperature)}°</text>
      <text x="160" y="24" fontSize="11" textAnchor="middle" fill={C.muted}>Boiling point in this model: {Math.round(boiling)}°</text>
    </svg>
  );
}

function ParticlesVisual({ v, animate }: { v: VisualState; animate: boolean }) {
  const energy = clamp(v.values.energy ?? 0, 0, 1);
  const spacing = clamp(v.values.spacing ?? 0, 0, 1);
  const cell = 24 + spacing * 24;
  const cols = 6;
  const rows = 4;
  const width = cols * cell;
  const height = rows * cell;
  const amplitude = 1 + energy * 7;
  const duration = Math.max(0.18, 1.3 - energy * 1.1);

  return (
    <svg viewBox="0 0 320 200" className="w-full rounded-xl" style={{ background: C.panel2 }} role="img" aria-label={`Particles ${spacing > 0.6 ? 'far apart' : spacing > 0.25 ? 'loosely packed' : 'closely packed'}, moving ${energy > 0.66 ? 'fast' : energy > 0.33 ? 'at a medium speed' : 'slowly'}.`}>
      <rect x="40" y="20" width="240" height="160" rx="8" fill="#fff" stroke={C.line} strokeWidth="2" />
      {Array.from({ length: rows * cols }).map((_, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const cx = 160 - width / 2 + cell / 2 + col * cell;
        const cy = 100 - height / 2 + cell / 2 + row * cell;
        return (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r="7"
            fill={i % 2 ? '#6366f1' : '#38bdf8'}
            className={animate ? 'pg-anim pg-fluid' : 'pg-fluid'}
            style={{ ['--a' as string]: `${amplitude}px`, animation: animate && energy > 0 ? `pg-jiggle ${duration}s linear ${(i % 7) * 0.09}s infinite` : undefined }}
          />
        );
      })}
      <text x="160" y="194" fontSize="10" textAnchor="middle" fill={C.muted}>Schematic: how fast they jiggle shows energy; the gaps show spacing</text>
    </svg>
  );
}

function RayVisual({ v }: { v: VisualState }) {
  const i = clamp(v.values.incidence ?? 0, 0, 85);
  const r = clamp(v.values.reflection ?? 0, 0, 85);
  const rad = (d: number) => (d * Math.PI) / 180;
  const len = 120;
  const ox = 160;
  const oy = 170;
  const sx = ox - Math.sin(rad(i)) * len;
  const sy = oy - Math.cos(rad(i)) * len;
  const ex = ox + Math.sin(rad(r)) * len;
  const ey = oy - Math.cos(rad(r)) * len;

  return (
    <svg viewBox="0 0 320 210" className="w-full rounded-xl" style={{ background: C.panel2 }} role="img" aria-label={`A ray meets a mirror at ${Math.round(i)} degrees to the normal and reflects at ${Math.round(r)} degrees.`}>
      <rect x="30" y="170" width="260" height="10" fill="#94a3b8" />
      <line x1="160" y1="30" x2="160" y2="170" stroke={C.muted} strokeDasharray="5 5" />
      <line x1={sx} y1={sy} x2={ox} y2={oy} stroke="#f59e0b" strokeWidth="3.5" className="pg-fluid" />
      <line x1={ox} y1={oy} x2={ex} y2={ey} stroke="#ef4444" strokeWidth="3.5" className="pg-fluid" />
      <circle cx={sx} cy={sy} r="7" fill="#fde047" stroke="#f59e0b" />
      <text x={ox - 62} y="62" fontSize="12" fontWeight="700" fill="#b45309">i = {Math.round(i)}°</text>
      <text x={ox + 22} y="62" fontSize="12" fontWeight="700" fill="#b91c1c">r = {Math.round(r)}°</text>
      <text x="166" y="38" fontSize="10" fill={C.muted}>normal</text>
    </svg>
  );
}

function CircuitVisual({ v, animate }: { v: VisualState; animate: boolean }) {
  const closed = (v.values.closed ?? 0) !== 0;
  const brightness = closed ? clamp(v.values.brightness ?? 0, 0, 1) : 0;
  const wire = closed ? '#16a34a' : C.muted;

  return (
    <svg viewBox="0 0 320 210" className="w-full rounded-xl" style={{ background: C.panel2 }} role="img" aria-label={`A simple circuit with a battery, a switch and a bulb. The switch is ${closed ? 'closed' : 'open'} and the bulb is ${brightness > 0.05 ? 'lit' : 'off'}.`}>
      <g fill="none" stroke={wire} strokeWidth="4" strokeLinecap="round" className={closed && animate ? 'pg-anim' : undefined} strokeDasharray={closed ? '8 8' : undefined} style={{ animation: closed && animate ? 'pg-flow .8s linear infinite' : undefined }}>
        <path d="M70 100 V40 H130" />
        <path d="M190 40 H250 V100" />
        <path d="M250 120 V170 H70 V130" />
      </g>
      {/* battery */}
      <line x1="55" y1="100" x2="85" y2="100" stroke={C.text} strokeWidth="5" />
      <line x1="62" y1="116" x2="78" y2="116" stroke={C.text} strokeWidth="3" />
      <text x="96" y="107" fontSize="10" fill={C.muted}>cell</text>
      <line x1="70" y1="116" x2="70" y2="130" stroke={wire} strokeWidth="4" />
      {/* switch */}
      <circle cx="130" cy="40" r="4" fill={C.text} />
      <circle cx="190" cy="40" r="4" fill={C.text} />
      <line x1="130" y1="40" x2={closed ? 190 : 180} y2={closed ? 40 : 14} stroke={C.text} strokeWidth="4" strokeLinecap="round" className="pg-fluid" />
      <text x="160" y="64" fontSize="11" textAnchor="middle" fill={C.muted}>switch {closed ? 'closed' : 'open'}</text>
      {/* bulb */}
      <circle
        cx="250"
        cy="110"
        r="30"
        fill="#fde047"
        className={animate ? 'pg-anim pg-fluid' : 'pg-fluid'}
        style={{ ['--glow' as string]: String(brightness * 0.9), opacity: brightness * 0.9, animation: animate && brightness > 0 ? 'pg-glow 1.6s ease-in-out infinite' : undefined }}
      />
      <circle cx="250" cy="110" r="18" fill="#fff" stroke={C.text} strokeWidth="3" />
      <path d="M241 118 L246 104 L250 112 L254 104 L259 118" fill="none" stroke={brightness > 0.05 ? '#f59e0b' : C.muted} strokeWidth="2" />
    </svg>
  );
}

function BarsVisual({ v }: { v: VisualState }) {
  const bars = v.bars ?? [];
  return (
    <div className="space-y-3 rounded-xl p-4" style={{ background: C.panel2 }} role="img" aria-label={`Bar chart: ${bars.map((b) => `${b.label} ${Math.round(b.value * 100) / 100}`).join(', ')}`}>
      {bars.map((b) => (
        <div key={b.label}>
          <div className="flex justify-between text-[12px]" style={{ color: C.muted }}>
            <span>{b.label}</span>
            <span className="tabular-nums" style={{ color: C.text }}>{Math.round(b.value * 100) / 100}</span>
          </div>
          <div className="mt-1 h-3 rounded-full" style={{ background: C.line }}>
            <div className="pg-fluid h-full rounded-full" style={{ width: `${clamp((Math.abs(b.value) / b.max) * 100, 1.5, 100)}%`, background: C.accent }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function RectangleVisual({ v }: { v: VisualState }) {
  const w = Math.max(0, v.values.width ?? 0);
  const h = Math.max(0, v.values.height ?? 0);
  const scale = w > 0 && h > 0 ? Math.min(220 / w, 120 / h) : 1;
  const pw = w * scale;
  const ph = h * scale;
  const round = (n: number) => Math.round(n * 100) / 100;

  return (
    <svg viewBox="0 0 320 200" className="w-full rounded-xl" style={{ background: C.panel2 }} role="img" aria-label={`A rectangle ${round(w)} by ${round(h)}, area ${round(w * h)}.`}>
      <rect x={160 - pw / 2} y={92 - ph / 2} width={pw} height={ph} fill={C.accentSoft} stroke={C.accent} strokeWidth="3" className="pg-fluid" />
      <text x="160" y={92 - ph / 2 - 8} fontSize="12" textAnchor="middle" fill={C.text}>{round(w)}</text>
      <text x={160 + pw / 2 + 8} y="96" fontSize="12" fill={C.text}>{round(h)}</text>
      <text x="160" y="186" fontSize="11" textAnchor="middle" fill={C.muted}>{v.caption ?? `Area = ${round(w * h)}`}</text>
    </svg>
  );
}

function MotionVisual({ v, animate }: { v: VisualState; animate: boolean }) {
  const position = clamp(v.values.position ?? 0, 0, 1);
  const speed = clamp(v.values.speed ?? 0, 0, 1);
  const x = 40 + position * 240;
  // Speed lines trail the object: more of them, and longer, the faster it goes.
  const trails = Math.round(speed * 4);

  return (
    <svg viewBox="0 0 320 170" className="w-full rounded-xl" style={{ background: C.panel2 }} role="img" aria-label={`A cart ${Math.round(position * 100)} percent of the way along a track, moving ${speed > 0.66 ? 'fast' : speed > 0.2 ? 'at a moderate speed' : speed > 0 ? 'slowly' : 'not at all (at rest)'}.`}>
      <line x1="30" y1="120" x2="290" y2="120" stroke="#94a3b8" strokeWidth="4" />
      {Array.from({ length: 11 }).map((_, i) => (
        <g key={i}>
          <line x1={40 + i * 24} y1="120" x2={40 + i * 24} y2="130" stroke="#94a3b8" />
          {i % 5 === 0 ? <text x={40 + i * 24} y="146" fontSize="9" textAnchor="middle" fill={C.muted}>{i * 10}%</text> : null}
        </g>
      ))}
      <g className="pg-fluid" style={{ transform: `translateX(${x - 40}px)` }}>
        {Array.from({ length: trails }).map((_, i) => (
          <line key={i} x1={20 - i * 9} y1={92 + i * 6} x2={4 - i * 9 - speed * 10} y2={92 + i * 6} stroke="#cbd5e1" strokeWidth="3" strokeLinecap="round" />
        ))}
        <rect x="14" y="84" width="52" height="24" rx="6" fill={C.accent} />
        <circle cx="28" cy="114" r="8" fill="#334155" className={animate && speed > 0 ? 'pg-anim' : undefined} style={{ transformBox: 'fill-box', transformOrigin: 'center', animation: animate && speed > 0 ? `pg-spin ${Math.max(0.25, 1.4 - speed * 1.2)}s linear infinite` : undefined }} />
        <circle cx="52" cy="114" r="8" fill="#334155" className={animate && speed > 0 ? 'pg-anim' : undefined} style={{ transformBox: 'fill-box', transformOrigin: 'center', animation: animate && speed > 0 ? `pg-spin ${Math.max(0.25, 1.4 - speed * 1.2)}s linear infinite` : undefined }} />
        <line x1="28" y1="114" x2="34" y2="114" stroke="#fff" strokeWidth="2" />
        <line x1="52" y1="114" x2="58" y2="114" stroke="#fff" strokeWidth="2" />
      </g>
      <text x="160" y="26" fontSize="11" textAnchor="middle" fill={C.muted}>Position along the track: {Math.round(position * 100)}%</text>
    </svg>
  );
}

function WaveVisual({ v, animate }: { v: VisualState; animate: boolean }) {
  const amplitude = clamp(v.values.amplitude ?? 0, 0, 1);
  const frequency = clamp(v.values.frequency ?? 1, 1, 8);
  const height = 8 + amplitude * 50;
  const wavelength = 320 / frequency;
  // One long sine drawn from segments; sliding it by exactly one wavelength (here: the pattern width of 80px
  // is replaced by the wavelength via the CSS variable) makes the wave appear to travel.
  const points: string[] = [];
  for (let x = -wavelength * 2; x <= 320 + wavelength * 2; x += 4) {
    points.push(`${x},${100 - Math.sin((x / wavelength) * Math.PI * 2) * height}`);
  }

  return (
    <svg viewBox="0 0 320 200" className="w-full rounded-xl" style={{ background: C.panel2 }} role="img" aria-label={`A wave with ${amplitude > 0.66 ? 'large' : amplitude > 0.33 ? 'medium' : 'small'} amplitude and ${Math.round(frequency)} cycles across the screen.`}>
      <clipPath id="pg-wave-clip"><rect x="10" y="30" width="300" height="140" /></clipPath>
      <line x1="10" y1="100" x2="310" y2="100" stroke={C.line} strokeDasharray="4 4" />
      <g clipPath="url(#pg-wave-clip)">
        <polyline
          points={points.join(' ')}
          fill="none"
          stroke={C.accent}
          strokeWidth="3"
          strokeLinejoin="round"
          className={animate ? 'pg-anim' : undefined}
          style={{ animation: animate ? `pg-wave ${Math.max(0.6, 4 / frequency)}s linear infinite` : undefined, ['--wl' as string]: `${wavelength}px` }}
        />
      </g>
      <line x1="40" y1="100" x2="40" y2={100 - height} stroke="#ef4444" strokeWidth="2" />
      <text x="46" y={100 - height / 2} fontSize="10" fill="#b91c1c">amplitude</text>
      <text x="160" y="190" fontSize="10" textAnchor="middle" fill={C.muted}>Frequency: {Math.round(frequency)} cycles across this screen (schematic)</text>
    </svg>
  );
}


function LeverVisual({ v }: { v: VisualState }) {
  const ll = Math.max(0, v.values.left_load ?? 0);
  const ld = Math.max(0, v.values.left_distance ?? 0);
  const rl = Math.max(0, v.values.right_load ?? 0);
  const rd = Math.max(0, v.values.right_distance ?? 0);
  const left = ll * ld;
  const right = rl * rd;
  const top = Math.max(left, right, 1);
  // The beam tilts toward the larger turning effect (load x distance); equal effects balance it.
  const tilt = clamp(((right - left) / top) * 16, -16, 16);
  const maxD = Math.max(ld, rd, 1);
  const lx = 160 - (ld / maxD) * 110;
  const rx = 160 + (rd / maxD) * 110;
  const size = (load: number) => 14 + Math.min(26, load * 2.6);

  return (
    <svg viewBox="0 0 320 210" className="w-full rounded-xl" style={{ background: C.panel2 }} role="img" aria-label={`A balance beam. Left turning effect ${Math.round(left)}, right turning effect ${Math.round(right)}. ${left === right ? 'The beam balances.' : right > left ? 'The right side goes down.' : 'The left side goes down.'}`}>
      <polygon points="160,150 140,190 180,190" fill="#94a3b8" />
      <g className="pg-fluid" style={{ transformOrigin: '160px 150px', transform: `rotate(${tilt}deg)` }}>
        <rect x="40" y="144" width="240" height="8" rx="4" fill="#475569" />
        <g>
          <rect x={lx - size(ll) / 2} y={144 - size(ll)} width={size(ll)} height={size(ll)} rx="3" fill="#f59e0b" />
          <text x={lx} y={144 - size(ll) / 2 + 4} fontSize="10" textAnchor="middle" fill="#fff" fontWeight="700">{Math.round(ll * 10) / 10}</text>
        </g>
        <g>
          <rect x={rx - size(rl) / 2} y={144 - size(rl)} width={size(rl)} height={size(rl)} rx="3" fill="#6366f1" />
          <text x={rx} y={144 - size(rl) / 2 + 4} fontSize="10" textAnchor="middle" fill="#fff" fontWeight="700">{Math.round(rl * 10) / 10}</text>
        </g>
      </g>
      <text x="80" y="30" fontSize="11" textAnchor="middle" fill="#b45309">Left: {Math.round(left * 10) / 10}</text>
      <text x="240" y="30" fontSize="11" textAnchor="middle" fill="#4338ca">Right: {Math.round(right * 10) / 10}</text>
      <text x="160" y="205" fontSize="10" textAnchor="middle" fill={C.muted}>Turning effect = load x distance from the pivot (schematic)</text>
    </svg>
  );
}

function AtomVisual({ v, animate }: { v: VisualState; animate: boolean }) {
  const protons = Math.round(clamp(v.values.protons ?? 1, 0, 20));
  const neutrons = Math.round(clamp(v.values.neutrons ?? 0, 0, 20));
  const electrons = Math.round(clamp(v.values.electrons ?? 0, 0, 20));
  const charge = protons - electrons;
  // Shells fill 2, 8, 8, ... (the usual first three shells for light elements).
  const shells = [2, 8, 8, 2].reduce<number[]>((acc, cap) => {
    const placed = acc.reduce((a, b) => a + b, 0);
    return placed < electrons ? [...acc, Math.min(cap, electrons - placed)] : acc;
  }, []);
  const nucleus = [...Array.from({ length: protons }, () => 'p'), ...Array.from({ length: neutrons }, () => 'n')];

  return (
    <svg viewBox="0 0 320 240" className="w-full rounded-xl" style={{ background: C.panel2 }} role="img" aria-label={`An atom with ${protons} protons, ${neutrons} neutrons and ${electrons} electrons. Overall charge ${charge > 0 ? '+' : ''}${charge}.`}>
      {shells.map((count, si) => {
        const r = 44 + si * 24;
        return (
          <g key={si}>
            <circle cx="160" cy="110" r={r} fill="none" stroke={C.line} strokeWidth="1.5" strokeDasharray="3 4" />
            <g className={animate ? 'pg-anim' : undefined} style={{ transformOrigin: '160px 110px', animation: animate ? `pg-orbit ${5 + si * 3}s linear infinite` : undefined }}>
              {Array.from({ length: count }).map((_, i) => {
                const a = (i / count) * Math.PI * 2;
                return <circle key={i} cx={160 + Math.cos(a) * r} cy={110 + Math.sin(a) * r} r="4.5" fill="#38bdf8" stroke="#0369a1" />;
              })}
            </g>
          </g>
        );
      })}
      {nucleus.map((kind, i) => {
        const ring = Math.floor(Math.sqrt(i));
        const a = i * 2.4;
        return <circle key={i} cx={160 + Math.cos(a) * ring * 5.2} cy={110 + Math.sin(a) * ring * 5.2} r="5.4" fill={kind === 'p' ? '#ef4444' : '#94a3b8'} stroke="#fff" strokeWidth="0.8" className="pg-fluid" />;
      })}
      <text x="160" y="204" fontSize="12" textAnchor="middle" fill={C.text} fontWeight="700">
        {protons} protons (red) · {neutrons} neutrons (grey) · {electrons} electrons (blue)
      </text>
      <text x="160" y="224" fontSize="11" textAnchor="middle" fill={charge === 0 ? C.good : C.warn}>
        {charge === 0 ? 'Neutral atom' : `Overall charge ${charge > 0 ? '+' : ''}${charge}`} (schematic, not to scale)
      </text>
    </svg>
  );
}

function SceneryVisual({ v, animate }: { v: VisualState; animate: boolean }) {
  const sun = clamp(v.values.sun ?? 0, 0, 1);
  const clouds = clamp(v.values.clouds ?? 0, 0, 1);
  const rain = clamp(v.values.rain ?? 0, 0, 1);
  const water = clamp(v.values.water ?? 0, 0, 1);
  const plants = clamp(v.values.plants ?? 0, 0, 1);
  const waterTop = 190 - water * 60;
  const drops = Math.round(rain * 16);
  const plantCount = Math.max(0, Math.round(plants * 6));

  return (
    <svg viewBox="0 0 320 220" className="w-full rounded-xl" role="img" aria-label={`A landscape: sun ${sun > 0.6 ? 'bright' : sun > 0.2 ? 'dim' : 'hidden'}, clouds ${clouds > 0.6 ? 'heavy' : clouds > 0.2 ? 'light' : 'none'}, rain ${rain > 0.05 ? 'falling' : 'none'}, water level ${Math.round(water * 100)} percent, ${plantCount} plants.`}>
      <defs>
        <linearGradient id="pg-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={clouds > 0.6 ? '#94a3b8' : '#7dd3fc'} />
          <stop offset="1" stopColor={clouds > 0.6 ? '#cbd5e1' : '#e0f2fe'} />
        </linearGradient>
      </defs>
      <rect width="320" height="220" fill="url(#pg-sky)" className="pg-fluid" />
      {sun > 0.05 ? (
        <g opacity={0.35 + sun * 0.65} className="pg-fluid">
          <circle cx="262" cy="46" r={16 + sun * 10} fill="#fde047" />
          <circle cx="262" cy="46" r={26 + sun * 14} fill="#fde047" className={animate ? 'pg-anim' : undefined} style={{ transformOrigin: '262px 46px', animation: animate ? 'pg-shine 3s ease-in-out infinite' : undefined, opacity: 0.35 }} />
        </g>
      ) : null}
      {Array.from({ length: Math.round(clouds * 4) }).map((_, i) => (
        <g key={i} className={animate ? 'pg-anim' : undefined} style={{ animation: animate ? `pg-drift ${6 + i * 2}s ease-in-out infinite` : undefined }} opacity={0.55 + clouds * 0.4}>
          <ellipse cx={70 + i * 62} cy={38 + (i % 2) * 20} rx="34" ry="14" fill={clouds > 0.6 ? '#64748b' : '#fff'} />
          <ellipse cx={90 + i * 62} cy={30 + (i % 2) * 20} rx="22" ry="12" fill={clouds > 0.6 ? '#64748b' : '#fff'} />
        </g>
      ))}
      {Array.from({ length: drops }).map((_, i) => (
        <line key={i} x1={24 + i * 18} y1="70" x2={20 + i * 18} y2="82" stroke="#0284c7" strokeWidth="2" strokeLinecap="round" className={animate ? 'pg-anim' : undefined} style={{ animation: animate ? `pg-fall ${0.9 + (i % 4) * 0.2}s linear ${(i % 5) * 0.15}s infinite` : undefined, opacity: animate ? undefined : 0.7 }} />
      ))}
      <rect x="0" y="150" width="320" height="70" fill="#86b96b" />
      <rect x="0" y={waterTop} width="320" height={220 - waterTop} fill="#38bdf8" fillOpacity="0.8" className="pg-fluid" />
      {Array.from({ length: plantCount }).map((_, i) => (
        <g key={i} className="pg-fluid">
          <line x1={34 + i * 46} y1="152" x2={34 + i * 46} y2={152 - 14 - plants * 22} stroke="#15803d" strokeWidth="3" />
          <ellipse cx={28 + i * 46} cy={152 - 10 - plants * 14} rx="9" ry="5" fill="#22c55e" />
          <ellipse cx={40 + i * 46} cy={152 - 18 - plants * 18} rx="9" ry="5" fill="#16a34a" />
        </g>
      ))}
    </svg>
  );
}

function MixtureVisual({ v, animate }: { v: VisualState; animate: boolean }) {
  const separated = clamp(v.values.separated ?? 0, 0, 1);
  const energy = clamp(v.values.energy ?? 0, 0, 1);
  const n = 18;
  // Two kinds of particle start mixed through the container and settle into two layers as `separated` grows.
  const place = (i: number, heavy: boolean) => {
    const col = i % 6;
    const row = Math.floor(i / 6);
    const mixedY = 40 + ((i * 37) % 100);
    const layerY = heavy ? 150 - row * 14 : 60 + row * 14;
    return { x: 66 + col * 34 + (heavy ? 0 : 10), y: mixedY + (layerY - mixedY) * separated };
  };

  return (
    <svg viewBox="0 0 320 210" className="w-full rounded-xl" style={{ background: C.panel2 }} role="img" aria-label={`A container holding two kinds of particles, ${separated > 0.8 ? 'fully separated into layers' : separated > 0.2 ? 'partly separated' : 'mixed together'}.`}>
      <rect x="50" y="24" width="220" height="140" rx="8" fill="#fff" stroke={C.muted} strokeWidth="2" />
      {Array.from({ length: n }).map((_, i) => {
        const a = place(i, true);
        const b = place(i, false);
        return (
          <g key={i}>
            <circle cx={a.x} cy={a.y} r="7" fill="#b45309" className={animate ? 'pg-anim pg-fluid' : 'pg-fluid'} style={{ ['--a' as string]: `${1 + energy * 5}px`, animation: animate && energy > 0 ? `pg-jiggle ${Math.max(0.3, 1.4 - energy)}s linear ${(i % 5) * 0.1}s infinite` : undefined }} />
            <circle cx={b.x} cy={b.y} r="4" fill="#38bdf8" className={animate ? 'pg-anim pg-fluid' : 'pg-fluid'} style={{ ['--a' as string]: `${1 + energy * 5}px`, animation: animate && energy > 0 ? `pg-jiggle ${Math.max(0.3, 1.2 - energy)}s linear ${(i % 7) * 0.08}s infinite` : undefined }} />
          </g>
        );
      })}
      <text x="160" y="190" fontSize="11" textAnchor="middle" fill={C.muted}>Brown = large particles · blue = small particles · {Math.round(separated * 100)}% separated</text>
    </svg>
  );
}

function PendulumVisual({ v, animate }: { v: VisualState; animate: boolean }) {
  const length = clamp(v.values.length ?? 0.5, 0.1, 1);
  const swing = clamp(v.values.swing ?? 0.3, 0, 1);
  const amp = swing * 40;
  const rod = 40 + length * 110;
  // Period grows with the square root of the length (model: shown on screen, in seconds, scaled).
  const period = 0.8 + 1.6 * Math.sqrt(length);

  return (
    <svg viewBox="0 0 320 230" className="w-full rounded-xl" style={{ background: C.panel2 }} role="img" aria-label={`A pendulum with a ${length > 0.66 ? 'long' : length > 0.33 ? 'medium' : 'short'} string swinging ${swing > 0.6 ? 'widely' : swing > 0.2 ? 'a little' : 'hardly at all'}. One swing takes about ${period.toFixed(1)} seconds in this model.`}>
      <rect x="110" y="16" width="100" height="8" rx="4" fill="#475569" />
      <g className={animate ? 'pg-anim' : undefined} style={{ transformOrigin: '160px 22px', ['--amp' as string]: `${amp}deg`, animation: animate && swing > 0 ? `pg-swing ${period}s ease-in-out infinite` : undefined, transform: animate ? undefined : `rotate(${amp}deg)` }}>
        <line x1="160" y1="22" x2="160" y2={22 + rod} stroke="#64748b" strokeWidth="2.5" />
        <circle cx="160" cy={22 + rod} r="13" fill={C.accent} stroke="#312e81" strokeWidth="2" />
      </g>
      <text x="160" y="220" fontSize="11" textAnchor="middle" fill={C.muted}>String length {Math.round(length * 100)}% · swing {Math.round(amp)}° · about {period.toFixed(1)} s per swing (model)</text>
    </svg>
  );
}

export function ModelVisual({ visual, animate }: { visual: VisualState; animate: boolean }) {
  switch (visual.kind) {
    case 'heating':
      return <HeatingVisual v={visual} animate={animate} />;
    case 'particles':
      return <ParticlesVisual v={visual} animate={animate} />;
    case 'ray':
      return <RayVisual v={visual} />;
    case 'circuit':
      return <CircuitVisual v={visual} animate={animate} />;
    case 'bars':
      return <BarsVisual v={visual} />;
    case 'rectangle':
      return <RectangleVisual v={visual} />;
    case 'motion':
      return <MotionVisual v={visual} animate={animate} />;
    case 'wave':
      return <WaveVisual v={visual} animate={animate} />;
    case 'lever':
      return <LeverVisual v={visual} />;
    case 'atom':
      return <AtomVisual v={visual} animate={animate} />;
    case 'scenery':
      return <SceneryVisual v={visual} animate={animate} />;
    case 'mixture':
      return <MixtureVisual v={visual} animate={animate} />;
    case 'pendulum':
      return <PendulumVisual v={visual} animate={animate} />;
    default:
      return null;
  }
}

// -------------------------------------------------------------------------- workspaces

interface WorkspaceProps<S, P> {
  params: P;
  state: S;
  setState: (next: S) => void;
  result: EngineResult;
}

export function VariableModelWorkspace({ params, state, setState, result }: WorkspaceProps<VariableModelState, VariableModelParams>) {
  const reduced = useReducedMotion();

  return (
    <div className="space-y-4">
      <MotionStyles />
      {result.visual ? <ModelVisual visual={result.visual} animate={!reduced} /> : null}
      <div className="space-y-3">
        {params.controls.map((control) => {
          const value = state.values[control.id] ?? control.default;
          if (control.kind === 'toggle') {
            const on = value >= (control.min + control.max) / 2;
            return (
              <button
                key={control.id}
                type="button"
                role="switch"
                aria-checked={on}
                onClick={() => setState({ values: { ...state.values, [control.id]: on ? control.min : control.max } })}
                className="flex w-full items-center justify-between rounded-xl border px-3 py-2 text-sm"
                style={{ borderColor: on ? C.accent : C.line, background: on ? C.accentSoft : C.panel2, color: C.text }}
              >
                {control.label}
                <span className="font-semibold" style={{ color: on ? C.accent : C.muted }}>{on ? 'ON' : 'OFF'}</span>
              </button>
            );
          }
          return (
            <SliderRow
              key={control.id}
              label={control.label}
              unit={control.unit ?? ''}
              value={value}
              min={control.min}
              max={control.max}
              step={control.step}
              onChange={(next) => setState({ values: { ...state.values, [control.id]: next } })}
            />
          );
        })}
      </div>
      {result.outputs.length > 0 ? (
        <dl className="grid gap-2 sm:grid-cols-2">
          {result.outputs.map((output) => (
            <div key={output.id} className="rounded-xl px-3 py-2" style={{ background: C.panel2 }}>
              <dt className="text-[11px] uppercase tracking-wide" style={{ color: C.muted }}>{output.label}</dt>
              <dd className="text-base font-semibold tabular-nums" style={{ color: C.text }}>{output.text} <span className="text-xs font-normal" style={{ color: C.muted }}>{output.unit}</span></dd>
            </div>
          ))}
        </dl>
      ) : null}
      <p className="text-[12px]" style={{ color: C.muted }}>Simulation: a simplified model, not a measurement.</p>
    </div>
  );
}

export function SequenceWorkspace({ params, state, setState, result }: WorkspaceProps<SequenceState, SequenceParams>) {
  const byId = new Map(params.items.map((item) => [item.id, item]));
  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= state.order.length) return;
    const order = [...state.order];
    [order[index], order[target]] = [order[target], order[index]];
    setState({ order });
  };

  return (
    <div className="space-y-3">
      <MotionStyles />
      <p className="text-[12px] uppercase tracking-wide" style={{ color: C.muted }}>Put these in the right order (use the arrows)</p>
      <ol className="space-y-2">
        {state.order.map((id, index) => {
          const item = byId.get(id);
          if (!item) return null;
          const inPlace = params.items[index]?.id === id;
          return (
            <li key={id} className="pg-fluid flex items-center gap-3 rounded-xl border px-3 py-2" style={{ borderColor: inPlace ? C.good : C.line, background: inPlace ? 'rgba(15,157,116,0.08)' : C.panel2 }}>
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold" style={{ background: inPlace ? C.good : C.muted, color: C.onAccent }}>{index + 1}</span>
              <span className="min-w-0 flex-1 text-sm" style={{ color: C.text }}>
                {item.label}
                {item.detail ? <span className="block text-xs" style={{ color: C.muted }}>{item.detail}</span> : null}
              </span>
              <button type="button" aria-label={`Move "${item.label}" up`} disabled={index === 0} onClick={() => move(index, -1)} className="rounded-full border p-1.5 disabled:opacity-30" style={{ borderColor: C.line, background: C.panel }}>
                <ArrowUp size={14} />
              </button>
              <button type="button" aria-label={`Move "${item.label}" down`} disabled={index === state.order.length - 1} onClick={() => move(index, 1)} className="rounded-full border p-1.5 disabled:opacity-30" style={{ borderColor: C.line, background: C.panel }}>
                <ArrowDown size={14} />
              </button>
            </li>
          );
        })}
      </ol>
      <p className="text-[13px]" style={{ color: C.muted }}>
        In the right place: <b style={{ color: C.text }}>{result.facts.correct}</b> of {result.facts.total}
      </p>
    </div>
  );
}

export function ClassifyWorkspace({ params, state, setState, result }: WorkspaceProps<ClassifyState, ClassifyParams>) {
  return (
    <div className="space-y-3">
      <MotionStyles />
      <p className="text-[12px] uppercase tracking-wide" style={{ color: C.muted }}>Sort each item into a group</p>
      <ul className="space-y-2">
        {params.items.map((item) => {
          const choice = state.assigned[item.id];
          const right = choice !== undefined && choice === item.category;
          return (
            <li key={item.id} className="pg-fluid rounded-xl border px-3 py-2" style={{ borderColor: choice ? (right ? C.good : C.bad) : C.line, background: C.panel2 }}>
              <div className="flex items-center justify-between gap-2 text-sm" style={{ color: C.text }}>
                <span>{item.label}</span>
                {choice ? (right ? <Check size={15} color={C.good} aria-label="Correct group" /> : <X size={15} color={C.bad} aria-label="Not this group" />) : null}
              </div>
              <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label={`Group for ${item.label}`}>
                {params.categories.map((category) => {
                  const on = choice === category.id;
                  return (
                    <button
                      key={category.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setState({ assigned: { ...state.assigned, [item.id]: category.id } })}
                      className="rounded-full border px-3 py-1 text-xs"
                      style={{ borderColor: on ? C.accent : C.line, background: on ? C.accentSoft : C.panel, color: C.text }}
                    >
                      {category.label}
                    </button>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ul>
      <p className="text-[13px]" style={{ color: C.muted }}>
        Correct: <b style={{ color: C.text }}>{result.facts.correct}</b> · Wrong: <b style={{ color: result.facts.wrong ? C.bad : C.text }}>{result.facts.wrong}</b> · Not sorted: <b style={{ color: C.text }}>{result.facts.unassigned}</b>
      </p>
    </div>
  );
}
