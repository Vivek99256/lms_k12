'use client';

import { createContext, useContext, useEffect, useId, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Award, BookOpen, Briefcase, CircleCheck, CirclePlay, Lightbulb, PenLine, Route, Scale, Search, UserCog, type LucideIcon } from 'lucide-react';

import { assetUrl } from '@/lib/study-deck/deck';
import type { DeckImage } from '@/lib/study-deck/types';

/**
 * Guided tours over the product illustrations.
 *
 * Each illustration is a finished picture (a teacher's dashboard, an organisation of people, a company with its systems). A tour does
 * not redraw it: it points at it. The camera moves to the part a step is about, the rest dims, a short tag names what is there, and a
 * panel in the empty lower third of the picture shows what changes (resources, rankings, options). Everything drawn here is in the
 * picture's own pixel coordinates (1122 x 1402), so it stays on the part it points at at any size.
 */

export type ArtId = 'k12' | 'g2g' | 'eb';

const W = 1122;
const H = 1402;
const NAVY = '#0f2a5f';
const BLUE = '#1c59b0';
const AMBER = '#cc6e16';
const SKY = '#c2d7f2';
const EASE = [0.22, 1, 0.36, 1] as const;

/** The paper each illustration is drawn on, read from the pictures themselves (the context slides carry the same colour as `bg`). */
export const ART_PAPER: Record<ArtId, string> = { k12: '#f1f6fd', g2g: '#f3f7fe', eb: '#eff4fc' };

type Tone = 'navy' | 'amber' | 'blue';
const TONE: Record<Tone, string> = { navy: NAVY, amber: AMBER, blue: BLUE };

// ---------------------------------------------------------------------------
// Drawing primitives, in picture pixels
// ---------------------------------------------------------------------------

function Ico({ Icon, x, y, s, color = NAVY, stroke = 2.2 }: { Icon: LucideIcon; x: number; y: number; s: number; color?: string; stroke?: number }) {
  return <Icon x={x - s / 2} y={y - s / 2} width={s} height={s} color={color} strokeWidth={stroke} />;
}

/** The part of the picture the camera is showing, in picture pixels: a tag that would fall outside it is moved just inside, so it is never cut off. */
interface Window {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
const WHOLE: Window = { x0: 0, y0: 0, x1: W, y1: H };
const WindowContext = createContext<Window>(WHOLE);

/** A name tag: a rounded label centred on a point (usually on the edge of what it names). */
function Pill({ x, y, text, tone = 'navy', size = 44, delay = 0 }: { x: number; y: number; text: string; tone?: Tone; size?: number; delay?: number }) {
  const reduce = useReducedMotion();
  const win = useContext(WindowContext);
  const w = Math.round(text.length * size * 0.56 + size * 1.6);
  const h = Math.round(size * 1.8);
  const inside = (v: number, lo: number, hi: number, half: number) => (hi - lo < 2 * half + 24 ? (lo + hi) / 2 : Math.min(Math.max(v, lo + half + 12), hi - half - 12));
  const cx = inside(x, win.x0, win.x1, w / 2);
  const cy = inside(y, win.y0, win.y1, h / 2);

  return (
    <motion.g initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay, ease: EASE }}>
      <rect x={cx - w / 2} y={cy - h / 2} width={w} height={h} rx={h / 2} fill={TONE[tone]} stroke="#ffffff" strokeWidth={5} />
      <text x={cx} y={cy + size * 0.35} fontSize={size} fontWeight={700} fill="#ffffff" textAnchor="middle" style={{ fontFamily: 'inherit' }}>
        {text}
      </text>
    </motion.g>
  );
}

/** A ring that grows from a point and fades, over and over: look here. */
function Ping({ x, y, color = AMBER, r = 30 }: { x: number; y: number; color?: string; r?: number }) {
  const reduce = useReducedMotion();
  if (reduce) return <circle cx={x} cy={y} r={r} fill="none" stroke={color} strokeWidth={6} />;

  return <motion.circle cx={x} cy={y} fill="none" stroke={color} strokeWidth={6} initial={{ r, opacity: 0.9 }} animate={{ r: r * 2.6, opacity: 0 }} transition={{ duration: 1.7, repeat: Infinity, ease: 'easeOut' }} />;
}

/** Dots that travel along a path, to show something moving from one thing to another. */
function Run({ d, color = BLUE, n = 3, dur = 2.6, delay = 0, rad = 9 }: { d: string; color?: string; n?: number; dur?: number; delay?: number; rad?: number }) {
  const reduce = useReducedMotion();
  if (reduce) return null;

  return (
    <>
      {Array.from({ length: n }, (_, i) => (
        <circle key={i} r={rad} fill={color} stroke="#ffffff" strokeWidth={3}>
          <animateMotion dur={`${dur}s`} begin={`${delay + (i * dur) / n}s`} repeatCount="indefinite" path={d} />
        </circle>
      ))}
    </>
  );
}

/** A line that draws itself. */
function Trace({ d, color = BLUE, width = 9, delay = 0, dur = 1.1, opacity = 1 }: { d: string; color?: string; width?: number; delay?: number; dur?: number; opacity?: number }) {
  const reduce = useReducedMotion();

  return <motion.path d={d} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" opacity={opacity} initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: dur, delay, ease: EASE }} />;
}

/** A white panel in the empty lower part of the picture. */
function Panel({ x = 110, y = 960, w = 900, h = 300, title, children, delay = 0 }: { x?: number; y?: number; w?: number; h?: number; title: string; children: ReactNode; delay?: number }) {
  const reduce = useReducedMotion();

  return (
    <motion.g initial={reduce ? false : { opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay, ease: EASE }}>
      <rect x={x} y={y} width={w} height={h} rx={30} fill="#ffffff" stroke={SKY} strokeWidth={5} />
      <text x={x + 40} y={y + 66} fontSize={42} fontWeight={700} fill={NAVY} style={{ fontFamily: 'inherit' }}>
        {title}
      </text>
      {children}
    </motion.g>
  );
}

function Chip({ x, y, w = 250, h = 150, Icon, label, delay = 0, tone = 'plain' }: { x: number; y: number; w?: number; h?: number; Icon: LucideIcon; label: string; delay?: number; tone?: 'plain' | 'accent' | 'dim' }) {
  const reduce = useReducedMotion();
  const fill = tone === 'accent' ? BLUE : '#ffffff';
  const ink = tone === 'accent' ? '#ffffff' : tone === 'dim' ? '#7b8aa3' : NAVY;

  return (
    <motion.g initial={reduce ? false : { opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay, ease: EASE }}>
      <rect x={x} y={y} width={w} height={h} rx={22} fill={fill} stroke={tone === 'accent' ? BLUE : SKY} strokeWidth={5} />
      <Ico Icon={Icon} x={x + w / 2} y={y + h * 0.38} s={h * 0.42} color={ink} />
      <text x={x + w / 2} y={y + h * 0.84} fontSize={Math.min(36, (w - 28) / (label.length * 0.56))} fontWeight={700} fill={ink} textAnchor="middle" style={{ fontFamily: 'inherit' }}>
        {label}
      </text>
    </motion.g>
  );
}

/** Shows its children only while the tour is on one of these steps; they draw in when it arrives and fade when it leaves. */
function At({ step, from, to = from, children }: { step: number; from: number; to?: number; children: ReactNode }) {
  const on = step >= from && step <= to;

  return (
    <AnimatePresence>
      {on ? (
        <motion.g key="on" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.45 }}>
          {children}
        </motion.g>
      ) : null}
    </AnimatePresence>
  );
}

type Hole = [number, number, number, number, number];

/** Dims the picture except for one part; the lit part moves from step to step (or through several parts in turn). */
function Spot({ holes }: { holes: Hole | Hole[] | null }) {
  const id = useId().replace(/:/g, '');
  const reduce = useReducedMotion();
  const list = holes === null ? null : Array.isArray(holes[0]) ? (holes as Hole[]) : [holes as Hole];
  const first = list?.[0] ?? [0, 0, W, H, 0];

  return (
    <>
      <defs>
        <mask id={`m${id}`}>
          <rect width={W} height={H} fill="#ffffff" />
          <motion.rect
            fill="#000000"
            initial={false}
            animate={{ x: list ? list.map((h) => h[0]) : first[0], y: list ? list.map((h) => h[1]) : first[1], width: list ? list.map((h) => h[2]) : first[2], height: list ? list.map((h) => h[3]) : first[3], rx: first[4] }}
            transition={{ duration: reduce ? 0 : list && list.length > 1 ? 1.1 * list.length : 0.9, ease: EASE }}
          />
        </mask>
      </defs>
      <motion.rect width={W} height={H} fill={NAVY} initial={false} animate={{ opacity: list ? 0.5 : 0 }} transition={{ duration: 0.5 }} mask={`url(#m${id})`} style={{ pointerEvents: 'none' }} />
    </>
  );
}

// ---------------------------------------------------------------------------
// The tags that name the parts of each picture
// ---------------------------------------------------------------------------

interface Tag {
  x: number;
  y: number;
  text: string;
  tone?: Tone;
}

/** Where each tag goes, chosen from the picture: on the edge of the thing it names, in the free space beside it. */
export const ART_TAGS: Record<ArtId, Tag[]> = {
  k12: [
    { x: 560, y: 57, text: 'Student progress' },
    { x: 760, y: 432, text: 'Learning gap', tone: 'amber' },
    { x: 530, y: 912, text: 'Teacher' },
    { x: 285, y: 805, text: 'School' },
    { x: 880, y: 805, text: 'College' },
  ],
  g2g: [
    { x: 410, y: 200, text: 'Capability finding' },
    { x: 914, y: 467, text: 'HRMS' },
    { x: 872, y: 805, text: 'Task management' },
    { x: 440, y: 918, text: 'Skill gap', tone: 'amber' },
  ],
  eb: [
    { x: 561, y: 220, text: 'Insights' },
    { x: 337, y: 335, text: 'Sales' },
    { x: 784, y: 335, text: 'HR' },
    { x: 177, y: 485, text: 'Finance' },
    { x: 945, y: 485, text: 'Operations' },
    { x: 270, y: 658, text: 'Support' },
    { x: 851, y: 658, text: 'Documents' },
    { x: 561, y: 565, text: 'AI platform' },
    { x: 561, y: 995, text: 'Company' },
  ],
};

function Tags({ art, only }: { art: ArtId; only?: string[] }) {
  const tags = ART_TAGS[art].filter((t) => !only || only.includes(t.text));

  return (
    <>
      {tags.map((t, i) => (
        <Pill key={t.text} x={t.x} y={t.y} text={t.text} tone={t.tone} delay={0.15 + i * 0.1} />
      ))}
    </>
  );
}

/** The illustration with its tags, filling a box from the top (the empty lower part of the picture falls under the box's own text). */
export function LabelledArt({ art, image, assetBase, tags = true }: { art: ArtId; image: DeckImage | null; assetBase: string | null; tags?: boolean }) {
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: ART_PAPER[art] }}>
      {image ? (
        <div className="absolute inset-x-0 top-0" style={{ aspectRatio: `${W} / ${H}` }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- deck images are our own stored files or local review copies */}
          <img src={assetUrl(image.url, assetBase)} alt="" className="absolute inset-0 h-full w-full select-none" draggable={false} />
          {tags ? (
            <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true" className="absolute inset-0 h-full w-full">
              <Tags art={art} />
            </svg>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// The three tours
// ---------------------------------------------------------------------------

interface Camera {
  /** The point the camera looks at, in picture pixels, and how far it zooms in. */
  c: [number, number];
  z: number;
}

const CAMERAS: Record<ArtId, Camera[]> = {
  k12: [{ c: [561, 700], z: 1 }, { c: [620, 270], z: 1.25 }, { c: [561, 700], z: 1 }, { c: [600, 760], z: 1.2 }, { c: [620, 270], z: 1.25 }, { c: [561, 700], z: 1 }],
  g2g: [{ c: [561, 700], z: 1 }, { c: [410, 520], z: 1.2 }, { c: [410, 520], z: 1.25 }, { c: [410, 520], z: 1.25 }, { c: [400, 640], z: 1.25 }, { c: [561, 700], z: 1 }, { c: [561, 700], z: 1 }, { c: [561, 700], z: 1 }],
  eb: [{ c: [561, 700], z: 1 }, { c: [561, 450], z: 1.1 }, { c: [561, 463], z: 1.3 }, { c: [561, 463], z: 1.3 }, { c: [337, 260], z: 1.6 }, { c: [561, 700], z: 1 }, { c: [561, 700], z: 1 }, { c: [561, 700], z: 1 }],
};

/** The part of the picture a step's camera shows (the same clamping `cameraFor` applies), so tags can keep inside it. */
function windowFor(art: ArtId, step: number): Window {
  const list = CAMERAS[art];
  const cam = list[Math.min(Math.max(step, 0), list.length - 1)];
  if (cam.z <= 1) return WHOLE;
  const hw = W / (2 * cam.z);
  const hh = H / (2 * cam.z);
  const cx = Math.min(Math.max(cam.c[0], hw), W - hw);
  const cy = Math.min(Math.max(cam.c[1], hh), H - hh);

  return { x0: cx - hw, y0: cy - hh, x1: cx + hw, y1: cy + hh };
}

const HOLES: Record<ArtId, Array<Hole | Hole[] | null>> = {
  k12: [null, [388, 326, 445, 66, 33], null, [415, 515, 300, 390, 60], [388, 326, 445, 66, 33], null],
  g2g: [null, [[190, 190, 440, 215, 24], [60, 510, 220, 340, 24], [285, 510, 220, 340, 24], [515, 510, 205, 340, 24]], [55, 185, 670, 670, 24], [55, 185, 670, 670, 24], [285, 510, 220, 340, 24], null, null, [285, 510, 220, 340, 24]],
  eb: [null, null, null, [440, 340, 244, 244, 122], [240, 175, 195, 170, 28], [431, 48, 260, 185, 28], null, null],
};

function RankPanel() {
  const reduce = useReducedMotion();
  const [sorted, setSorted] = useState(Boolean(reduce));
  useEffect(() => {
    if (reduce) return undefined;
    const t = window.setTimeout(() => setSorted(true), 1500);

    return () => window.clearTimeout(t);
  }, [reduce]);
  const order = [2, 0, 3, 1];
  const widths = [560, 440, 330, 230];
  const names = ['Gap A', 'Gap B', 'Gap C', 'Gap D'];

  return (
    <Panel title="Gaps ranked">
      {names.map((n, i) => {
        const row = sorted ? i : order.indexOf(i);
        return (
          <motion.g key={n} initial={false} animate={{ y: row * 52 }} transition={{ duration: 0.8, ease: EASE }}>
            <text x={255} y={1064} fontSize={36} fontWeight={700} fill={NAVY} textAnchor="end" style={{ fontFamily: 'inherit' }}>
              {n}
            </text>
            <motion.rect x={275} y={1034} height={38} rx={8} fill={sorted && i === 0 ? AMBER : SKY} initial={{ width: 0 }} animate={{ width: widths[i] }} transition={{ duration: 0.9, delay: 0.2 + i * 0.1, ease: EASE }} />
          </motion.g>
        );
      })}
      <Pill x={850} y={1140} text="Priority first" tone="amber" size={34} delay={1.9} />
    </Panel>
  );
}

function ProgressBars({ x, y, w, delay = 0 }: { x: number; y: number; w: number; delay?: number }) {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect x={x} y={y + i * 40} width={w} height={24} rx={12} fill="#e3ecf8" />
          <motion.rect x={x} y={y + i * 40} height={24} rx={12} fill={BLUE} initial={{ width: 0 }} animate={{ width: [0, w - i * 90] }} transition={{ duration: 2.2, delay: delay + i * 0.4, repeat: Infinity, repeatDelay: 1.4, ease: EASE }} />
        </g>
      ))}
    </>
  );
}

function K12Tour({ step }: { step: number }) {
  const bar = 'M 585 378 L 538 538';

  return (
    <>
      {/* While the camera is close on one part, only the tag of that part stays; the others would be cut off at the edge. */}
      <Tags art="k12" only={step === 1 || step === 4 ? ['Student progress'] : step === 3 ? ['Teacher'] : ['Student progress', 'Teacher', 'School', 'College']} />
      <At step={step} from={1}>
        <Ping x={585} y={363} />
      </At>
      <At step={step} from={1}>
        <Pill x={720} y={432} text="Learning gap found" tone="amber" size={40} delay={0.3} />
      </At>
      <At step={step} from={2} to={3}>
        <Panel title="Matched to the gap">
          <circle cx={800} cy={1000} r={12} fill={AMBER} />
          <Chip x={150} y={1070} Icon={BookOpen} label="Reading" delay={0.3} />
          <Chip x={420} y={1070} Icon={CirclePlay} label="Video" delay={0.5} />
          <Chip x={690} y={1070} Icon={PenLine} label="Practice" delay={0.7} />
        </Panel>
      </At>
      <At step={step} from={3}>
        <Run d="M 780 1075 C 790 960, 700 850, 640 752" n={4} />
        <Pill x={800} y={640} text="Teacher supported" tone="blue" size={40} delay={0.3} />
      </At>
      <At step={step} from={4} to={5}>
        <Trace d={bar} color="#f1f5fc" width={14} dur={0.4} />
        <motion.rect x={416} y={348} height={30} rx={15} fill={BLUE} initial={{ width: 198 }} animate={{ width: 300 }} transition={{ duration: 1.6, delay: 0.3, ease: EASE }} />
        <motion.g initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 1.6, duration: 0.5 }} style={{ transformOrigin: '742px 363px', transformBox: 'view-box' }}>
          <circle cx={742} cy={363} r={26} fill="#ffffff" stroke={BLUE} strokeWidth={6} />
          <Ico Icon={CircleCheck} x={742} y={363} s={34} color={BLUE} stroke={3} />
        </motion.g>
      </At>
      <At step={step} from={4} to={4}>
        <Pill x={760} y={432} text="Gap closed" tone="blue" delay={1.2} />
      </At>
      <At step={step} from={5}>
        <Panel title="Mastery over time">
          <Trace d="M 190 1215 L 340 1178 L 500 1130 L 660 1075 L 830 1022" color={BLUE} width={12} delay={0.5} dur={1.6} />
          {[[340, 1178], [500, 1130], [660, 1075], [830, 1022]].map(([x, y], i) => (
            <motion.circle key={x} cx={x} cy={y} r={14} fill="#ffffff" stroke={BLUE} strokeWidth={7} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 + i * 0.35 }} />
          ))}
          <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.2 }}>
            <Ico Icon={Award} x={925} y={1010} s={72} color={BLUE} />
            <text x={925} y={1075} fontSize={32} fontWeight={700} fill={BLUE} textAnchor="middle" style={{ fontFamily: 'inherit' }}>
              Improving
            </text>
          </motion.g>
        </Panel>
      </At>
    </>
  );
}

const ORG_CONNECTORS = ['M 398 395 L 398 460 L 170 460 L 170 518', 'M 398 395 L 398 518', 'M 398 395 L 398 460 L 620 460 L 620 518'];
const BOXES: Array<[number, number, number]> = [[434, 255, 3], [117, 700, 3], [336, 700, 3], [568, 700, 3]];

function G2GTour({ step }: { step: number }) {
  const rows = BOXES.flatMap(([x, y]) => [0, 1, 2].map((r) => [x, y + r * 46] as const));
  const checks = rows.filter((p) => !(p[0] === 336 && p[1] === 792));
  const slot = (text: string, tone: Tone = 'navy') => <Pill x={410} y={200} text={text} tone={tone} delay={0.2} />;

  return (
    <>
      {/* Close on the organisation chart the tags on the right would be cut off, so they show only while the whole picture does. */}
      {step === 0 || step >= 5 ? <Tags art="g2g" only={['HRMS', 'Task management']} /> : null}
      <At step={step} from={0}>{slot('Capability finding')}</At>
      <At step={step} from={5} to={7}>{slot('Capability finding')}</At>
      <At step={step} from={1}>
        {ORG_CONNECTORS.map((d, i) => (
          <Run key={d} d={d} n={3} delay={i * 0.4} />
        ))}
        {slot('Organisation')}
      </At>
      <At step={step} from={2}>
        {[[402, 225, 200, 150], [92, 678, 165, 135], [312, 678, 175, 135], [544, 678, 155, 135]].map(([x, y, w, h], i) => (
          <motion.rect key={x} x={x} y={y} width={w} height={h} rx={14} fill="none" stroke={BLUE} strokeWidth={7} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 + i * 0.25 }} />
        ))}
        {slot('Roles and tasks', 'blue')}
      </At>
      <At step={step} from={3}>
        {rows.map(([x, y], i) => (
          <motion.circle key={`${x}-${y}`} cx={x} cy={y} r={25} fill="none" stroke={BLUE} strokeWidth={6} initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 + i * 0.07 }} style={{ transformOrigin: `${x}px ${y}px`, transformBox: 'view-box' }} />
        ))}
        {slot('Required competencies', 'blue')}
      </At>
      <At step={step} from={4}>
        <motion.g initial={{ x: 0, y: 0 }} animate={{ x: [0, 166, 398, 166], y: [0, 0, 0, 47] }} transition={{ duration: 5, ease: 'easeInOut' }}>
          <Ico Icon={Search} x={170} y={745} s={110} color={BLUE} stroke={2.6} />
        </motion.g>
        {slot('Evidence', 'blue')}
      </At>
      <At step={step} from={4} to={6}>
        {checks.map(([x, y], i) => (
          <motion.g key={`${x}-${y}`} initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.4 + i * 0.12 }} style={{ transformOrigin: `${x + 190}px ${y}px`, transformBox: 'view-box' }}>
            <Ico Icon={CircleCheck} x={x + 190} y={y} s={32} color={BLUE} stroke={3} />
          </motion.g>
        ))}
        <motion.rect x={312} y={772} width={178} height={42} rx={10} fill="none" stroke={AMBER} strokeWidth={7} strokeDasharray="14 8" animate={{ opacity: [1, 0.35, 1] }} transition={{ duration: 1.4, repeat: Infinity }} />
      </At>
      <At step={step} from={4} to={5}>
        <Pill x={440} y={918} text="Missing evidence" tone="amber" delay={step === 4 ? 3.6 : 0.3} />
      </At>
      <At step={step} from={5}>
        <RankPanel />
      </At>
      <At step={step} from={6}>
        <Trace d="M 400 880 L 400 952" color={AMBER} width={10} dur={0.6} />
        <Panel title="Development routes" y={930} h={340}>
          <Chip x={150} y={1020} w={250} h={100} Icon={Route} label="Learning path" delay={0.4} />
          <Chip x={430} y={1020} w={200} h={100} Icon={UserCog} label="Coaching" delay={0.6} />
          <Chip x={660} y={1020} w={230} h={100} Icon={Briefcase} label="On the job" delay={0.8} />
          <ProgressBars x={150} y={1156} w={740} delay={1.2} />
        </Panel>
      </At>
      <At step={step} from={7}>
        <motion.g initial={{ opacity: 0, scale: 0.4 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3, duration: 0.5 }} style={{ transformOrigin: '335px 792px', transformBox: 'view-box' }}>
          <rect x={317} y={774} width={38} height={38} rx={8} fill={BLUE} />
          <Ico Icon={CircleCheck} x={336} y={793} s={34} color="#ffffff" stroke={3.2} />
        </motion.g>
        <Panel title="Before and after">
          <rect x={620} y={1000} width={26} height={26} rx={6} fill={SKY} />
          <text x={658} y={1022} fontSize={30} fontWeight={600} fill={NAVY} style={{ fontFamily: 'inherit' }}>
            Before
          </text>
          <rect x={800} y={1000} width={26} height={26} rx={6} fill={BLUE} />
          <text x={838} y={1022} fontSize={30} fontWeight={600} fill={NAVY} style={{ fontFamily: 'inherit' }}>
            After
          </text>
          {[0, 1, 2].map((i) => (
            <g key={i}>
              <rect x={170 + i * 270} y={1190 - [70, 90, 60][i]} width={70} height={[70, 90, 60][i]} rx={8} fill={SKY} />
              <motion.rect x={250 + i * 270} width={70} rx={8} fill={BLUE} initial={{ y: 1190 - [70, 90, 60][i], height: [70, 90, 60][i] }} animate={{ y: 1190 - [70, 90, 60][i] - [80, 70, 100][i], height: [70, 90, 60][i] + [80, 70, 100][i] }} transition={{ duration: 1.3, delay: 0.7 + i * 0.25, ease: EASE }} />
            </g>
          ))}
        </Panel>
        <Pill x={440} y={918} text="Capability grown" tone="blue" delay={1.2} />
      </At>
    </>
  );
}

const EB_PATHS: Array<[string, string]> = [
  ['Sales', 'M 372 335 C 372 385, 420 392, 468 412'],
  ['HR', 'M 750 335 C 750 385, 702 392, 654 412'],
  ['Finance', 'M 260 425 L 335 425 C 385 425, 405 465, 461 465'],
  ['Operations', 'M 862 425 L 787 425 C 737 425, 717 465, 661 465'],
  ['Support', 'M 357 580 C 415 580, 425 515, 474 512'],
  ['Documents', 'M 765 580 C 707 580, 697 515, 648 512'],
  ['Insights', 'M 561 220 L 561 363'],
];

function EBTour({ step }: { step: number }) {
  return (
    <>
      {/* Zoomed in on the middle of the picture, the tags at its edges would be cut off: they show while the whole picture does. */}
      <Tags art="eb" only={step <= 1 || step >= 5 ? ['Sales', 'HR', 'Finance', 'Operations', 'Support', 'Documents', 'Insights'] : step === 4 ? ['Sales'] : []} />
      <At step={step} from={1}>
        {EB_PATHS.slice(0, 6).map(([, d], i) => (
          <Run key={d} d={d} n={2} delay={i * 0.35} />
        ))}
      </At>
      <At step={step} from={2} to={7}>
        <Pill x={561} y={565} text="AI platform" />
      </At>
      <At step={step} from={2}>
        {EB_PATHS.map(([, d], i) => (
          <Trace key={d} d={d} color={BLUE} width={11} delay={0.2 + i * 0.15} opacity={0.85} />
        ))}
        <Ping x={561} y={463} color={BLUE} r={100} />
      </At>
      <At step={step} from={3} to={3}>
        <Pill x={380} y={463} text="time" tone="blue" size={40} delay={0.3} />
        <Pill x={742} y={463} text="policy" tone="blue" size={40} delay={0.5} />
        <Pill x={561} y={662} text="intent" tone="blue" size={40} delay={0.7} />
      </At>
      <At step={step} from={4} to={4}>
        <motion.circle cx={337} cy={262} r={96} fill="none" stroke={AMBER} strokeWidth={8} strokeDasharray="16 10" animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.5, repeat: Infinity }} />
        <Pill x={337} y={150} text="Pattern" tone="amber" delay={0.4} />
      </At>
      <At step={step} from={5} to={5}>
        <Ping x={561} y={140} color={AMBER} r={70} />
        <Panel title="Insight" y={1010} h={250}>
          <Ico Icon={Lightbulb} x={920} y={1075} s={80} color={AMBER} />
          {[0, 1, 2].map((l) => (
            <motion.rect key={l} x={150} y={1100 + l * 44} height={20} rx={10} fill={SKY} initial={{ width: 0 }} animate={{ width: 640 - l * 140 }} transition={{ delay: 0.8 + l * 0.35, duration: 0.8, ease: EASE }} />
          ))}
        </Panel>
      </At>
      <At step={step} from={6} to={6}>
        <Panel title="Decision support" y={1010} h={260}>
          <Ico Icon={Scale} x={925} y={1160} s={84} color={NAVY} />
          <Chip x={140} y={1125} w={330} h={120} Icon={PenLine} label="Option A" tone="dim" delay={0.4} />
          <Chip x={500} y={1125} w={330} h={120} Icon={CircleCheck} label="Option B" tone="accent" delay={0.7} />
        </Panel>
        <Pill x={665} y={1125} text="Recommended" tone="blue" size={32} delay={1.3} />
      </At>
      <At step={step} from={7}>
        <Panel title="Actions are tracked" y={1010} h={260}>
          {['Decide', 'Act', 'Review', 'Learn'].map((l, i) => (
            <motion.g key={l} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.25 }}>
              <rect x={130 + i * 210} y={1085} width={180} height={84} rx={20} fill={i < 2 ? NAVY : BLUE} />
              <text x={220 + i * 210} y={1139} fontSize={34} fontWeight={700} fill="#ffffff" textAnchor="middle" style={{ fontFamily: 'inherit' }}>
                {l}
              </text>
            </motion.g>
          ))}
          <Trace d="M 220 1180 L 220 1222 L 850 1222 L 850 1180" color={SKY} width={7} delay={1.2} dur={1.4} />
          <Run d="M 220 1222 L 850 1222" n={2} dur={3.4} delay={1.6} color={AMBER} />
        </Panel>
      </At>
    </>
  );
}

const TOURS: Record<ArtId, (props: { step: number }) => ReactNode> = {
  k12: (p) => <K12Tour {...p} />,
  g2g: (p) => <G2GTour {...p} />,
  eb: (p) => <EBTour {...p} />,
};

/** The camera for a step: where to look and how far to zoom, as a transform of the picture box (origin at its top-left corner). */
function cameraFor(art: ArtId, step: number) {
  const list = CAMERAS[art];
  const cam = list[Math.min(Math.max(step, 0), list.length - 1)];
  if (cam.z <= 1) return { scale: 1, x: '0%', y: '0%' };
  const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);
  const tx = clamp(0.5 - (cam.z * cam.c[0]) / W, 1 - cam.z, 0);
  const ty = clamp(0.5 - (cam.z * cam.c[1]) / H, 1 - cam.z, 0);

  return { scale: cam.z, x: `${tx * 100}%`, y: `${ty * 100}%` };
}

export function TourStage({ art, image, assetBase, step }: { art: ArtId; image: DeckImage; assetBase: string | null; step: number }) {
  const reduce = useReducedMotion();
  const holes = HOLES[art][Math.min(Math.max(step, 0), HOLES[art].length - 1)];
  const camera = cameraFor(art, step);
  const Tour = TOURS[art];

  return (
    <div className="flex h-full w-full items-center justify-center" style={{ background: ART_PAPER[art] }}>
      <div className="relative h-full max-w-full overflow-hidden" style={{ aspectRatio: `${W} / ${H}` }}>
        <motion.div className="absolute inset-0" style={{ transformOrigin: '0% 0%' }} initial={false} animate={camera} transition={{ duration: reduce ? 0 : 1.4, ease: EASE }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- deck images are our own stored files or local review copies */}
          <img src={assetUrl(image.url, assetBase)} alt={image.alt} className="absolute inset-0 h-full w-full select-none" draggable={false} />
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={image.alt} className="absolute inset-0 h-full w-full">
            <Spot holes={holes} />
            <WindowContext.Provider value={windowFor(art, step)}>
              <Tour step={step} />
            </WindowContext.Provider>
          </svg>
        </motion.div>
      </div>
    </div>
  );
}
