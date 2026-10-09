'use client';

import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { ListOrdered, RotateCcw } from 'lucide-react';

import { INTERACTION_HEADING, initialOrder, orderProgress, placeItem, shuffled, type OrderState } from '@/lib/study-deck/interactions';
import type { OrderInteraction } from '@/lib/study-deck/types';
import { CompletedSlot, motion, Tag, useRememberedReducer, useStage } from './stage-ui';

export interface OrderViewProps {
  interaction: OrderInteraction;
  done: boolean;
  /** Called once, when the sequence is complete. */
  onDone: () => void;
  lead: ReactNode;
  /** Where this screen's state is kept for the session. */
  memoryKey: string;
}

type Action = { type: 'place'; id: string } | { type: 'reset' };

/**
 * Put a real sequence in order by choosing what comes next. The right item joins the sequence; any other says "not
 * yet" and nothing is marked down. "Start again" clears it.
 */
export function OrderView({ interaction, done, onDone, lead, memoryKey }: OrderViewProps) {
  const { portrait } = useStage();
  const [state, dispatch] = useRememberedReducer(memoryKey, (s: OrderState, a: Action) => (a.type === 'place' ? placeItem(interaction, s, a.id) : initialOrder()), initialOrder);
  const progress = orderProgress(interaction, state);
  const finished = progress.done || done;
  const reported = useRef(done);
  const choices = useMemo(() => shuffled(interaction.items), [interaction.items]);

  useEffect(() => {
    if (progress.done && !reported.current) {
      reported.current = true;
      onDone();
    }
  }, [progress.done, onDone]);

  const text = (id: string) => interaction.items.find((item) => item.id === id)?.text ?? '';
  const shown = finished && !progress.done ? interaction.items.map((item) => item.id) : state.placed;

  return (
    <section aria-label="Put in order" className={`grid h-full min-h-0 gap-[1.2em] p-[1.4em] ${portrait ? 'grid-rows-[auto_minmax(0,1fr)]' : 'grid-cols-[minmax(0,4.2fr)_minmax(0,7.8fr)]'}`}>
      <div className="flex min-h-0 min-w-0 flex-col justify-center gap-[0.9em]">
        {lead}
        <div className="space-y-[0.4em]">
          <div className="flex flex-wrap items-center gap-[0.6em]">
            <Tag>
              <ListOrdered className="h-[1em] w-[1em]" aria-hidden="true" />
              {INTERACTION_HEADING.order}
            </Tag>
            <span role="status" className="text-[0.72em] font-medium text-slate-600">
              {finished ? 'In order' : `Placed ${progress.opened} / ${progress.total}`}
            </span>
          </div>
          <p className="text-[0.75em] text-slate-600">{interaction.intro}</p>
          <p aria-live="polite" className="min-h-[1.2em] text-[0.8em] text-amber-800">
            {state.last === 'miss' ? `Not yet. What comes ${state.placed.length === 0 ? 'first' : 'next'}?` : ''}
          </p>
        </div>
        <CompletedSlot show={finished}>{interaction.wrapup}</CompletedSlot>
      </div>

      <div className="grid min-h-0 grid-cols-2 content-center gap-[0.9em]">
        <ul aria-label="Choose what comes next" className="grid auto-rows-fr gap-[0.6em]">
          {choices.map((item) => {
            const placed = state.placed.includes(item.id) || done;

            return (
              <li key={item.id}>
                <button
                  type="button"
                  disabled={placed}
                  onClick={() => dispatch({ type: 'place', id: item.id })}
                  className={`flex h-full min-h-[3.2em] w-full items-center rounded-[0.9em] border-2 px-[0.9em] py-[0.5em] text-left text-[0.95em] leading-snug transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ${
                    placed ? 'border-slate-200 bg-slate-50 text-slate-400' : 'border-slate-300 bg-white text-slate-900 hover:border-indigo-500 hover:bg-indigo-50'
                  }`}
                >
                  {item.text}
                </button>
              </li>
            );
          })}
        </ul>
        <div className="flex min-h-0 flex-col gap-[0.5em]">
          <ol aria-label="Your order" className="grid flex-1 auto-rows-fr gap-[0.6em]">
            {interaction.items.map((item, index) => {
              const id = shown[index];

              return (
                <li key={item.id} className={`flex min-h-[3.2em] items-center gap-[0.6em] rounded-[0.9em] border-2 px-[0.8em] py-[0.4em] ${id ? `border-emerald-300 bg-emerald-50 ${motion.settle}` : 'border-dashed border-slate-300 bg-slate-50'}`}>
                  <span className="flex h-[1.8em] w-[1.8em] shrink-0 items-center justify-center rounded-full bg-slate-700 text-[0.8em] font-semibold text-white">{index + 1}</span>
                  <span className="text-[0.95em] leading-snug text-emerald-950">{id ? text(id) : ''}</span>
                </li>
              );
            })}
          </ol>
          {state.placed.length > 0 && !progress.done ? (
            <button
              type="button"
              onClick={() => dispatch({ type: 'reset' })}
              className="inline-flex items-center gap-[0.4em] self-start rounded-[0.6em] border border-slate-300 bg-white px-[0.8em] py-[0.3em] text-[0.75em] font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
            >
              <RotateCcw className="h-[1em] w-[1em]" aria-hidden="true" />
              Start again
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
