'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Check, Pause, Play, RotateCcw } from 'lucide-react';

import type { BarsInteraction, DeckImage, FlowInteraction, HubInteraction } from '@/lib/study-deck/types';
import { LabelledArt, TourStage, type ArtId } from './ProTour';
import { useStage } from './stage-ui';

/**
 * The professional look's own screens: a choice of products with its motion, a process played step by step, and animated bars.
 * Each keeps its text to a line or two; the picture or the motion carries the idea. Motion follows `prefers-reduced-motion`
 * (everything is simply shown), and nothing here has to be finished before the learner goes on.
 */

const EASE = [0.22, 1, 0.36, 1] as const;

function Kicker({ children }: { children: ReactNode }) {
  return <p className="text-[0.7em] font-semibold uppercase tracking-[0.14em] text-sd-accent">{children}</p>;
}

// ---------------------------------------------------------------------------
// Hub: one foundation, three products
// ---------------------------------------------------------------------------

export interface HubViewProps {
  interaction: HubInteraction;
  heading: { kicker: string; title: string };
  /** The picture of every slide, by slide number: a product's card shows the picture of the slide it names. */
  images: Record<number, DeckImage | null>;
  /** The slides the learner has opened, so a card can say its path was started or finished. */
  visited: number[];
  assetBase: string | null;
  onChoose: (slide: number) => void;
  onDone: () => void;
}

export function HubView({ interaction, heading, images, visited, assetBase, onChoose, onDone }: HubViewProps) {
  const reduce = useReducedMotion();
  const { portrait } = useStage();
  const [hover, setHover] = useState<string | null>(null);
  const reported = useRef(false);
  useEffect(() => {
    if (!reported.current) {
      reported.current = true;
      onDone();
    }
  }, [onDone]);
  const n = interaction.options.length;
  const finished = interaction.options.filter((o) => visited.includes(o.end)).length;

  return (
    <section aria-label="Choose a product" className="flex h-full min-h-0 flex-col gap-[0.9em] p-[1.6em]">
      <header className={`flex gap-[1em] ${portrait ? 'flex-col items-start' : 'items-end justify-between'}`}>
        <div className="flex flex-col gap-[0.3em]">
          <Kicker>{heading.kicker}</Kicker>
          <h2 tabIndex={-1} className={`font-bold leading-[1.05] tracking-tight text-slate-900 outline-none ${portrait ? 'text-[1.7em]' : 'text-[2.2em]'}`}>
            {heading.title}
          </h2>
          <p className="text-[1.05em] text-slate-600">{interaction.intro}</p>
        </div>
        {interaction.skip_to ? (
          <button
            type="button"
            onClick={() => onChoose(interaction.skip_to?.goto ?? 1)}
            className={`inline-flex shrink-0 items-center gap-[0.5em] px-[1.2em] py-[0.6em] text-[0.9em] font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sd-accent ${
              finished === n ? 'bg-sd-accent text-white hover:bg-sd-strong' : 'border border-slate-300 bg-white text-slate-800 hover:border-slate-500'
            }`}
          >
            {interaction.skip_to.label}
            <ArrowRight className="h-[1.1em] w-[1.1em]" aria-hidden="true" />
          </button>
        ) : null}
      </header>

      <div className="relative min-h-0 flex-1">
        {/* The foundation: a rule that draws across the three products, with a tick down to each. */}
        {portrait ? null : (
          <>
            <motion.span
              aria-hidden="true"
              className="absolute top-[0.9em] h-[2px] origin-center bg-sd-accent"
              style={{ left: `${50 / n}%`, right: `${50 / n}%` }}
              initial={reduce ? false : { scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.9, delay: 0.2, ease: EASE }}
            />
            {interaction.options.map((o, i) => (
              <motion.span
                key={o.id}
                aria-hidden="true"
                className="absolute top-[0.9em] h-[1.3em] w-[2px] origin-top bg-sd-accent"
                style={{ left: `${((i + 0.5) / n) * 100}%` }}
                initial={reduce ? false : { scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ duration: 0.4, delay: 0.9 + i * 0.1, ease: EASE }}
              />
            ))}
          </>
        )}
        <motion.div
          className="absolute left-1/2 top-[0.1em] z-20 -translate-x-1/2 bg-slate-900 px-[1em] py-[0.35em] text-[0.8em] font-semibold tracking-wide text-white"
          initial={reduce ? false : { opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE }}
        >
          One AI foundation
        </motion.div>

        <div className={`grid h-full min-h-0 gap-[1em] ${portrait ? 'grid-rows-3 pt-[2em]' : 'pt-[2.2em]'}`} style={portrait ? undefined : { gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
          {interaction.options.map((o, i) => {
            const done = visited.includes(o.end);
            const started = !done && visited.includes(o.goto);
            return (
              <motion.button
                key={o.id}
                type="button"
                onClick={() => onChoose(o.goto)}
                onMouseEnter={() => setHover(o.id)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(o.id)}
                onBlur={() => setHover(null)}
                aria-label={`${o.label}: ${o.tagline}${done ? ' (completed)' : started ? ' (started)' : ''}`}
                className="group relative min-h-0 overflow-hidden border border-slate-200 bg-white text-left transition-colors hover:border-sd-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sd-accent"
                initial={reduce ? false : { opacity: 0, y: 28 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.35 + i * 0.12, ease: EASE }}
                whileTap={reduce ? undefined : { scale: 0.985 }}
              >
                <span aria-hidden="true" className={`absolute transition-transform duration-[900ms] ease-out motion-reduce:transition-none ${portrait ? 'inset-y-0 left-0 w-[40%] overflow-hidden' : 'inset-0'} ${hover === o.id ? 'scale-[1.03]' : 'scale-100'}`}>
                  <LabelledArt art={o.art} image={images[o.image_slide] ?? null} assetBase={assetBase} tags={!portrait} />
                </span>
                <span
                  aria-hidden="true"
                  className={`absolute z-10 flex h-[2.4em] w-[2.4em] shrink-0 items-center justify-center rounded-full bg-slate-900 text-white transition-transform duration-300 motion-reduce:transition-none ${portrait ? 'right-[0.8em] top-1/2 -translate-y-1/2' : 'right-[0.9em] top-[0.9em]'} ${hover === o.id ? 'translate-x-[0.3em]' : ''}`}
                >
                  <ArrowRight className="h-[1.1em] w-[1.1em]" />
                </span>
                <span className={`absolute z-10 flex ${portrait ? 'inset-y-0 right-0 w-[60%] items-center p-[0.9em] pr-[3.4em]' : 'inset-x-0 bottom-0 items-end p-[1.1em]'}`}>
                  <span className="min-w-0">
                    <span className="flex items-center gap-[0.6em] text-[0.7em] font-semibold uppercase tracking-[0.14em] text-sd-accent">
                      0{i + 1}
                      {done || started ? (
                        <span className={`inline-flex items-center gap-[0.3em] px-[0.6em] py-[0.15em] text-[0.95em] font-bold tracking-[0.08em] text-white ${done ? 'bg-sd-accent' : 'bg-slate-700'}`}>
                          {done ? <Check className="h-[1.1em] w-[1.1em]" aria-hidden="true" /> : null}
                          {done ? 'Completed' : 'Started'}
                        </span>
                      ) : null}
                    </span>
                    <span className={`block font-bold leading-tight text-slate-900 ${portrait ? 'text-[1.2em]' : 'whitespace-nowrap text-[1.5em]'}`}>{o.label}</span>
                    <span className="mt-[0.15em] block text-[0.9em] leading-snug text-slate-600">{o.tagline}</span>
                  </span>
                </span>
              </motion.button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Flow: a process played step by step
// ---------------------------------------------------------------------------

export interface FlowViewProps {
  interaction: FlowInteraction;
  heading: { kicker: string; title: string };
  image: DeckImage | null;
  assetBase: string | null;
  onDone: () => void;
}

export function FlowView({ interaction, heading, image, assetBase, onDone }: FlowViewProps) {
  const reduce = useReducedMotion();
  const { portrait } = useStage();
  const total = interaction.steps.length;
  const tour = interaction.world?.startsWith('tour:') ? (interaction.world.slice(5) as ArtId) : null;
  // `reached` is how many steps have lit up; it counts up by itself while playing and stops on the last one.
  const [reached, setReached] = useState(reduce ? total : 0);
  const [playing, setPlaying] = useState(!reduce);
  const reported = useRef(false);

  useEffect(() => {
    if (!playing || reached >= total) return undefined;
    const timer = window.setTimeout(() => setReached((r) => r + 1), reached === 0 ? 1800 : 5600);

    return () => window.clearTimeout(timer);
  }, [playing, reached, total]);

  useEffect(() => {
    if (reached >= total && !reported.current) {
      reported.current = true;
      onDone();
    }
  }, [reached, total, onDone]);

  const progress = total > 1 ? Math.max(0, reached - 1) / (total - 1) : 1;
  const stage = tour && image;
  // On a phone the picture takes the slide and only the step being played is written under it.
  const compact = Boolean(stage) && portrait;

  return (
    <section
      aria-label="Watch it work"
      className={`h-full min-h-0 ${compact ? 'flex flex-col gap-[0.6em] p-[0.8em]' : `grid gap-[1.4em] ${stage ? 'grid-cols-[minmax(0,6fr)_minmax(0,5fr)] py-[0.9em] pl-[1.6em] pr-[1em]' : 'p-[1.6em]'}`}`}
    >
      <div className={`flex min-h-0 min-w-0 flex-col gap-[1.1em] ${compact ? 'order-2 shrink-0 gap-[0.5em]' : 'justify-center-safe'}`}>
        <header className="flex flex-col gap-[0.3em]">
          <Kicker>{heading.kicker}</Kicker>
          <h2 tabIndex={-1} className={`font-bold leading-tight text-slate-900 outline-none ${compact ? 'text-[1.3em]' : 'text-[1.8em]'}`}>
            {heading.title}
          </h2>
          {compact ? null : <p className="text-[0.95em] leading-snug text-slate-600">{interaction.intro}</p>}
        </header>

        {compact ? (
          <p className="min-h-[2.6em] text-[1.05em] font-semibold leading-snug text-slate-900">{reached > 0 ? interaction.steps[Math.min(reached, total) - 1].label : 'Press Play, or step through.'}</p>
        ) : null}

        <ol className={compact ? 'hidden' : 'relative flex flex-col gap-[0.55em]'} aria-label="Steps">
          {/* The track behind the steps fills as the steps light up. */}
          <span aria-hidden="true" className="absolute bottom-[1.1em] left-[1.05em] top-[1.1em] w-[2px] bg-slate-200" />
          <motion.span
            aria-hidden="true"
            className="absolute left-[1.05em] top-[1.1em] w-[2px] origin-top bg-sd-accent"
            style={{ height: 'calc(100% - 2.2em)' }}
            animate={{ scaleY: progress }}
            transition={{ duration: reduce ? 0 : 0.9, ease: EASE }}
          />
          {interaction.steps.map((s, i) => {
            const on = i < reached;
            const current = i === reached - 1;
            return (
              <li key={s.id} className="relative flex items-center gap-[0.9em]">
                <motion.span
                  className={`relative z-10 flex h-[2.2em] w-[2.2em] shrink-0 items-center justify-center rounded-full border-2 text-[0.85em] font-bold tabular-nums ${on ? 'border-sd-accent bg-sd-accent text-white' : 'border-slate-300 bg-white text-slate-500'}`}
                  animate={reduce ? undefined : { scale: current ? [1, 1.18, 1] : 1 }}
                  transition={{ duration: 0.5 }}
                >
                  {i + 1}
                </motion.span>
                <motion.span
                  className={`text-[1.05em] leading-snug ${on ? 'font-semibold text-slate-900' : 'text-slate-500'}`}
                  animate={{ x: on ? 0 : -6, opacity: on ? 1 : 0.7 }}
                  transition={{ duration: reduce ? 0 : 0.45, ease: EASE }}
                >
                  {s.label}
                </motion.span>
              </li>
            );
          })}
        </ol>

        <div className="flex items-center gap-[0.8em]">
          <button
            type="button"
            onClick={() => {
              if (reached >= total) {
                setReached(0);
                setPlaying(true);
              } else setPlaying((p) => !p);
            }}
            className="inline-flex items-center gap-[0.45em] bg-slate-900 px-[1em] py-[0.5em] text-[0.8em] font-semibold text-white hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sd-accent"
          >
            {reached >= total ? <RotateCcw className="h-[1.1em] w-[1.1em]" aria-hidden="true" /> : playing ? <Pause className="h-[1.1em] w-[1.1em]" aria-hidden="true" /> : <Play className="h-[1.1em] w-[1.1em]" aria-hidden="true" />}
            {reached >= total ? 'Replay' : playing ? 'Pause' : 'Play'}
          </button>
          {reached < total ? (
            <button
              type="button"
              onClick={() => {
                setPlaying(false);
                setReached((r) => Math.min(r + 1, total));
              }}
              className="inline-flex items-center gap-[0.4em] border border-slate-300 bg-white px-[1em] py-[0.5em] text-[0.8em] font-semibold text-slate-800 hover:border-slate-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sd-accent"
            >
              Next step
              <ArrowRight className="h-[1.1em] w-[1.1em]" aria-hidden="true" />
            </button>
          ) : null}
          <p role="status" className="text-[0.8em] text-slate-600">
            {reached >= total ? interaction.wrapup : `Step ${Math.max(reached, 1)} of ${total}`}
          </p>
        </div>
      </div>

      {stage ? (
        <div className={`min-h-0 min-w-0 overflow-hidden ${compact ? 'order-1 flex-1' : ''}`}>
          <TourStage art={tour} image={image} assetBase={assetBase} step={reached} />
        </div>
      ) : null}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Bars: figures that grow, and open for their detail
// ---------------------------------------------------------------------------

const TONE: Record<NonNullable<BarsInteraction['groups'][number]['bars'][number]['tone']>, string> = {
  primary: '#0b1f4b',
  accent: '#1f4e9c',
  muted: '#9db6e0',
};

export interface BarsViewProps {
  interaction: BarsInteraction;
  heading: { kicker: string; title: string };
  onDone: () => void;
}

export function BarsView({ interaction, heading, onDone }: BarsViewProps) {
  const reduce = useReducedMotion();
  const { portrait } = useStage();
  const [open, setOpen] = useState<string | null>(null);
  const reported = useRef(false);
  useEffect(() => {
    if (!reported.current) {
      reported.current = true;
      onDone();
    }
  }, [onDone]);

  // One scale per group, so a group's bars compare with each other and not with another group's unit.
  const detail = useMemo(() => interaction.groups.flatMap((g) => g.bars).find((b) => b.id === open) ?? null, [interaction.groups, open]);
  const vertical = interaction.orientation === 'vertical';

  return (
    <section aria-label="Explore the figures" className="flex h-full min-h-0 flex-col gap-[0.9em] p-[1.6em]">
      <header className="flex flex-col gap-[0.3em] border-b border-slate-300 pb-[0.6em]">
        <Kicker>{heading.kicker}</Kicker>
        <h2 tabIndex={-1} className="text-[1.7em] font-bold leading-tight text-slate-900 outline-none">
          {heading.title}
        </h2>
      </header>

      <div className={`grid min-h-0 flex-1 gap-[2em] ${portrait || interaction.groups.length === 1 ? '' : 'grid-flow-col auto-cols-fr'}`}>
        {interaction.groups.map((g, gi) => {
          const max = Math.max(...g.bars.map((b) => b.value), 1);
          return (
            <div key={g.title} className="flex min-h-0 min-w-0 flex-col gap-[0.5em]">
              <p className="text-[1em] font-semibold text-slate-800">{g.title}</p>
              <div className={`flex min-h-0 flex-1 gap-[0.9em] ${vertical ? 'items-end' : 'flex-col justify-center'}`}>
                {g.bars.map((b, bi) => {
                  const share = Math.max(b.value / max, 0.04);
                  const selected = open === b.id;
                  const delay = 0.15 + (gi * 3 + bi) * 0.1;
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setOpen(selected ? null : b.id)}
                      aria-pressed={selected}
                      aria-label={`${b.label}: ${b.display}`}
                      className={`group flex min-h-0 min-w-0 gap-[0.4em] text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sd-accent ${vertical ? 'h-full flex-1 flex-col justify-end' : 'items-center'}`}
                    >
                      {vertical ? (
                        <>
                          <span className="text-[1.35em] font-bold tabular-nums text-slate-900">{b.display}</span>
                          <span className="flex min-h-0 flex-1 items-end">
                            <motion.span
                              className={`mx-auto block w-full max-w-[9em] origin-bottom transition-[filter] group-hover:brightness-110 ${selected ? 'outline outline-[3px] outline-offset-2 outline-sd-accent' : ''}`}
                              style={{ height: `${share * 100}%`, backgroundColor: TONE[b.tone ?? 'accent'] }}
                              initial={reduce ? false : { scaleY: 0 }}
                              animate={{ scaleY: 1 }}
                              transition={{ duration: 0.9, delay, ease: EASE }}
                            />
                          </span>
                          <span className="text-[0.95em] font-medium leading-tight text-slate-800">{b.label}</span>
                        </>
                      ) : (
                        <>
                          <span className="w-[34%] shrink-0 text-[0.95em] leading-tight text-slate-800">{b.label}</span>
                          <span className="flex min-w-0 flex-1 items-center gap-[0.5em]">
                            <motion.span
                              className={`block h-[1.6em] origin-left transition-[filter] group-hover:brightness-110 ${selected ? 'outline outline-[3px] outline-offset-2 outline-sd-accent' : ''}`}
                              style={{ width: `${share * 78}%`, backgroundColor: TONE[b.tone ?? 'accent'] }}
                              initial={reduce ? false : { scaleX: 0 }}
                              animate={{ scaleX: 1 }}
                              transition={{ duration: 0.9, delay, ease: EASE }}
                            />
                            <span className="text-[1.15em] font-bold tabular-nums text-slate-900">{b.display}</span>
                          </span>
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div aria-live="polite" className={`min-h-[3.4em] border-l-[0.3em] px-[0.9em] py-[0.5em] ${detail ? 'border-sd-accent bg-slate-50' : 'border-slate-200'}`}>
        {detail ? (
          <motion.div key={detail.id} initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <p className="text-[0.95em] font-bold text-slate-900">{detail.label}</p>
            <p className="text-[0.9em] leading-snug text-slate-800">{detail.detail}</p>
          </motion.div>
        ) : (
          <p className="text-[0.85em] text-slate-600">{interaction.intro}</p>
        )}
      </div>
    </section>
  );
}
