'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, ArrowRight, CircleCheck, TriangleAlert, X } from 'lucide-react';

import { assetUrl } from '@/lib/study-deck/deck';
import type { DeckImage, DecisionInteraction, OutcomeInteraction } from '@/lib/study-deck/types';
import { useStage } from './stage-ui';

/**
 * The branching story. A question opens as a pop-up over the scene's photograph; each answer opens its own slide, which says what
 * happens and why and offers the ways on (choose again, or follow the intelligent path). Back always returns to where the learner came
 * from, so nobody is carried forward against their will.
 */

const EASE = [0.22, 1, 0.36, 1] as const;

// ---------------------------------------------------------------------------
// The question
// ---------------------------------------------------------------------------

export interface DecisionViewProps {
  interaction: DecisionInteraction;
  image: DeckImage | null;
  assetBase: string | null;
  heading: { kicker: string; title: string };
  onGoto: (n: number) => void;
  onBack: () => void;
  onDone: () => void;
}

export function DecisionView({ interaction, image, assetBase, heading, onGoto, onBack, onDone }: DecisionViewProps) {
  const reduce = useReducedMotion();
  const titleId = useId();
  const [open, setOpen] = useState(true);
  const [chosen, setChosen] = useState<string | null>(null);
  const firstRef = useRef<HTMLButtonElement>(null);
  const reported = useRef(false);
  const chosenRef = useRef<string | null>(null);

  useEffect(() => {
    if (!reported.current) {
      reported.current = true;
      onDone();
    }
  }, [onDone]);

  useEffect(() => {
    if (open) firstRef.current?.focus({ preventScroll: true });
  }, [open]);

  const choose = useCallback(
    (id: string, goto: number) => {
      if (chosenRef.current) return;
      chosenRef.current = id;
      setChosen(id);
      window.setTimeout(() => onGoto(goto), reduce ? 0 : 420);
    },
    [onGoto, reduce]
  );

  // A, B or C answers; Escape puts the question away.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        return;
      }
      const index = event.key.length === 1 ? event.key.toLowerCase().charCodeAt(0) - 97 : -1;
      const option = interaction.options[index];
      if (option && !event.metaKey && !event.ctrlKey && !event.altKey) choose(option.id, option.goto);
    };
    window.addEventListener('keydown', onKey);

    return () => window.removeEventListener('keydown', onKey);
  }, [open, interaction.options, choose]);

  return (
    <section aria-label="Decision" className="relative h-full min-h-0 overflow-hidden bg-slate-900">
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element -- deck images are our own stored files or local review copies
        <img src={assetUrl(image.url, assetBase)} alt={image.alt} className="absolute inset-0 h-full w-full object-cover" />
      ) : null}
      <div className="absolute inset-x-0 top-0 z-10 bg-slate-950/70 px-[1.6em] py-[0.7em] text-white">
        <p className="text-[0.7em] font-semibold uppercase tracking-[0.14em] text-sky-200">{heading.kicker}</p>
        <h2 tabIndex={-1} className="text-[1.5em] font-bold leading-tight outline-none">
          {heading.title}
        </h2>
      </div>

      {!open ? (
        <div className="absolute inset-x-0 bottom-[2em] z-20 flex items-center justify-center gap-[0.8em]">
          <button type="button" onClick={onBack} className="inline-flex items-center gap-[0.5em] border border-white/70 bg-slate-950/70 px-[1.1em] py-[0.6em] text-[0.9em] font-semibold text-white hover:bg-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
            <ArrowLeft className="h-[1.1em] w-[1.1em]" aria-hidden="true" />
            Back
          </button>
          <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-[0.5em] bg-white px-[1.4em] py-[0.6em] text-[0.95em] font-bold text-slate-900 hover:bg-sky-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
            Answer the question
            <ArrowRight className="h-[1.1em] w-[1.1em]" aria-hidden="true" />
          </button>
        </div>
      ) : null}

      <AnimatePresence>
        {open ? (
          <motion.div className="absolute inset-0 z-30 flex items-center justify-center p-[1.4em]" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={reduce ? undefined : { opacity: 0 }} transition={{ duration: 0.3 }}>
            <div aria-hidden="true" className="absolute inset-0 bg-slate-950/60" onClick={() => setOpen(false)} />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              className="relative z-10 w-full max-w-[40em] border border-slate-200 bg-white shadow-[0_1.4em_3.6em_rgba(2,6,23,0.45)]"
              initial={reduce ? false : { opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.5, ease: EASE }}
            >
              <header className="flex items-center justify-between gap-[1em] border-b border-slate-200 px-[1.6em] py-[0.8em]">
                <p className="text-[0.7em] font-bold uppercase tracking-[0.14em] text-sd-accent">{interaction.kicker}</p>
                <button type="button" onClick={() => setOpen(false)} aria-label="Put the question away" className="-mr-[0.4em] p-[0.4em] text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sd-accent">
                  <X className="h-[1.2em] w-[1.2em]" aria-hidden="true" />
                </button>
              </header>
              <div className="px-[1.6em] pb-[1.5em] pt-[1.3em]">
                <h3 id={titleId} className="text-[1.45em] font-bold leading-snug text-slate-900">
                  {interaction.question}
                </h3>
                <ul className="mt-[1.2em] space-y-[0.6em]" aria-label="Answers">
                  {interaction.options.map((o, i) => {
                    const picked = chosen === o.id;
                    return (
                      <li key={o.id}>
                        <motion.button
                          ref={i === 0 ? firstRef : undefined}
                          type="button"
                          onClick={() => choose(o.id, o.goto)}
                          disabled={chosen !== null && !picked}
                          className={`group flex w-full items-center gap-[0.9em] border px-[1em] py-[0.85em] text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sd-accent ${
                            picked ? 'border-sd-accent bg-sd-soft' : 'border-slate-300 bg-white hover:border-sd-accent hover:bg-sd-softer disabled:opacity-50'
                          }`}
                          initial={reduce ? false : { opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.45, delay: 0.25 + i * 0.09, ease: EASE }}
                          whileHover={reduce || chosen ? undefined : { x: 4 }}
                        >
                          <span className={`flex h-[2em] w-[2em] shrink-0 items-center justify-center text-[0.95em] font-bold text-white transition-colors ${picked ? 'bg-sd-accent' : 'bg-slate-900 group-hover:bg-sd-accent'}`}>{String.fromCharCode(65 + i)}</span>
                          <span className="min-w-0 flex-1 text-[1.05em] font-semibold leading-snug text-slate-900">{o.text}</span>
                          {picked ? <CircleCheck className="h-[1.2em] w-[1.2em] shrink-0 text-sd-accent" aria-hidden="true" /> : <ArrowRight className="h-[1.1em] w-[1.1em] shrink-0 text-slate-400 transition-colors group-hover:text-sd-accent" aria-hidden="true" />}
                        </motion.button>
                      </li>
                    );
                  })}
                </ul>
              </div>
              <footer className="flex items-center justify-between gap-[1em] border-t border-slate-200 bg-slate-50 px-[1.6em] py-[0.7em]">
                <button type="button" onClick={onBack} className="inline-flex items-center gap-[0.4em] text-[0.85em] font-semibold text-slate-700 hover:text-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sd-accent">
                  <ArrowLeft className="h-[1.1em] w-[1.1em]" aria-hidden="true" />
                  Back
                </button>
                <p className="text-[0.75em] text-slate-500">Choose an answer, or press A, B or C</p>
              </footer>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}

// ---------------------------------------------------------------------------
// What an answer leads to
// ---------------------------------------------------------------------------

export interface OutcomeViewProps {
  interaction: OutcomeInteraction;
  image: DeckImage | null;
  assetBase: string | null;
  heading: { kicker: string; title: string };
  onGoto: (n: number) => void;
  onBack: () => void;
  onDone: () => void;
}

/** "Intelligent outcome: a → b → c" is shown as the steps it is. */
function chainOf(why: string): { lead: string; steps: string[] } | null {
  const m = /^(Intelligent outcome):\s*(.+)$/.exec(why);
  if (!m) return null;
  const steps = m[2]
    .split(/\s*→\s*/)
    .map((s) => s.replace(/\.$/, ''))
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1));

  return steps.length > 1 ? { lead: m[1], steps } : null;
}

export function OutcomeView({ interaction, image, assetBase, heading, onGoto, onBack, onDone }: OutcomeViewProps) {
  const reduce = useReducedMotion();
  const { portrait } = useStage();
  const reported = useRef(false);
  useEffect(() => {
    if (!reported.current) {
      reported.current = true;
      onDone();
    }
  }, [onDone]);
  const sound = interaction.tone === 'sound';
  const chain = chainOf(interaction.why);
  const rise = (i: number) => ({ initial: reduce ? (false as const) : { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.55, delay: 0.15 + i * 0.1, ease: EASE } });

  return (
    <section aria-label="What happens next" className={portrait ? 'flex h-full min-h-0 flex-col' : 'grid h-full min-h-0 grid-cols-[minmax(0,5fr)_minmax(0,6fr)]'}>
      <div className={`relative min-w-0 overflow-hidden bg-slate-200 ${portrait ? 'h-[24%] shrink-0' : 'min-h-0'}`}>
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element -- deck images are our own stored files or local review copies
          <img src={assetUrl(image.url, assetBase)} alt={image.alt} className="absolute inset-0 h-full w-full object-cover" />
        ) : null}
        <p className={`absolute left-0 top-[1.2em] inline-flex items-center gap-[0.5em] px-[1.1em] py-[0.5em] text-[0.8em] font-bold uppercase tracking-[0.1em] text-white ${sound ? 'bg-sd-accent' : 'bg-[#b45309]'}`}>
          {sound ? <CircleCheck className="h-[1.2em] w-[1.2em]" aria-hidden="true" /> : <TriangleAlert className="h-[1.2em] w-[1.2em]" aria-hidden="true" />}
          {sound ? 'The intelligent path' : 'Not the best choice'}
        </p>
      </div>

      <div className={`flex min-h-0 min-w-0 flex-col gap-[1.1em] overflow-y-auto bg-white ${portrait ? 'flex-1 p-[1.2em]' : 'justify-center-safe p-[2.2em]'}`}>
        <motion.button {...rise(0)} type="button" onClick={onBack} className="inline-flex w-fit items-center gap-[0.4em] text-[0.8em] font-semibold text-slate-600 hover:text-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sd-accent">
          <ArrowLeft className="h-[1.1em] w-[1.1em]" aria-hidden="true" />
          Back to the question
        </motion.button>
        <motion.div {...rise(1)}>
          <p className="text-[0.7em] font-semibold uppercase tracking-[0.14em] text-sd-accent">
            {heading.kicker} · You chose {interaction.choice.id.toUpperCase()}
          </p>
          <h2 tabIndex={-1} className="mt-[0.3em] text-[1.6em] font-bold leading-tight text-slate-900 outline-none">
            {interaction.choice.text}
          </h2>
        </motion.div>
        <motion.div {...rise(2)}>
          <p className="text-[0.7em] font-bold uppercase tracking-[0.14em] text-slate-500">What happens</p>
          <p className="mt-[0.3em] text-[1.2em] leading-snug text-slate-900">{interaction.what}</p>
        </motion.div>
        <motion.div {...rise(3)} className="border-l-[0.3em] border-slate-300 pl-[1em]">
          <p className="text-[0.7em] font-bold uppercase tracking-[0.14em] text-slate-500">{chain ? chain.lead : 'Why'}</p>
          {chain ? (
            <ol className="mt-[0.5em] flex flex-wrap items-center gap-x-[0.4em] gap-y-[0.5em]">
              {chain.steps.map((s, i) => (
                <li key={s} className="inline-flex items-center gap-[0.4em]">
                  <span className="inline-flex items-center gap-[0.4em] bg-sd-soft px-[0.7em] py-[0.35em] text-[0.9em] font-semibold text-sd-strong">
                    <span className="tabular-nums text-sd-accent">{i + 1}</span>
                    {s}
                  </span>
                  {i < chain.steps.length - 1 ? <ArrowRight className="h-[1em] w-[1em] text-slate-400" aria-hidden="true" /> : null}
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-[0.3em] text-[1.02em] leading-snug text-slate-700">{interaction.why}</p>
          )}
        </motion.div>
        <motion.div {...rise(4)} className="mt-[0.4em] flex flex-wrap gap-[0.7em]">
          {interaction.actions.map((a) => (
            <button
              key={a.label}
              type="button"
              onClick={() => onGoto(a.goto)}
              className={`inline-flex items-center gap-[0.5em] px-[1.3em] py-[0.7em] text-[0.95em] font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sd-accent ${
                a.primary ? 'bg-sd-accent text-white hover:bg-sd-strong' : 'border border-slate-300 bg-white text-slate-800 hover:border-slate-500'
              }`}
            >
              {a.label}
              <ArrowRight className="h-[1.1em] w-[1.1em]" aria-hidden="true" />
            </button>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
