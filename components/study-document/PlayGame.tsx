'use client';

import { useMemo, useState, type DragEvent, type ReactNode } from 'react';
import { Check, GripVertical, Lightbulb, RotateCcw, X } from 'lucide-react';

import type { ProgressAction } from '@/lib/study-document/progress';
import { firstLetters, playKey, playsOf, sameAnswer, shuffled, type ClozePlay, type Play, type PlayKind, type SortPlay, type TrueFalsePlay } from '@/lib/study-document/play';
import type { BodyPart, StudyDocument } from '@/lib/study-document/types';
import { ENTER } from './JourneyFrame';

export interface PlayGameProps {
  play: Play;
  /** Already finished (restored from this browser). */
  done: boolean;
  onDone: () => void;
  /** Keeps the shuffle the same each time this screen draws. */
  seed: number;
  /** Words and blanks may be given a hint. The diagnostic and exit check never use these, so this is for practice. */
  hints?: boolean;
}

const TITLES: Record<Play['kind'], { title: string; how: string }> = {
  blanks: { title: 'Fill in the blanks', how: 'Type the missing word in each gap, then check.' },
  words: { title: 'Drag the words', how: 'Drag each word into its gap. On a phone or keyboard, select a word, then select a gap.' },
  truefalse: { title: 'True or false?', how: 'Decide whether each statement is true.' },
  sort: { title: 'Drag and drop', how: 'Drag each card under the group it belongs to. On a phone or keyboard, select a card, then select a group.' },
};

const BUTTON = 'inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sd-accent motion-reduce:transition-none';
const PRIMARY = `${BUTTON} border-sd-accent bg-sd-accent text-white hover:brightness-110 active:scale-[0.98] disabled:opacity-50 motion-reduce:active:scale-100`;
const PLAIN = `${BUTTON} border-sd-line bg-white text-sd-strong hover:bg-sd-softer`;

/** One of the four practice activities, played where it is shown. It reports `onDone` once, when everything in it is right. */
export function PlayGame(props: PlayGameProps) {
  const { play } = props;
  const copy = TITLES[play.kind];

  return (
    <section aria-label={copy.title} className={`space-y-3 rounded-2xl border-2 border-sd-line bg-white p-4 shadow-sm sm:p-5 ${ENTER}`} data-testid={`play-${play.kind}`}>
      <header className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-slate-900">{copy.title}</h3>
          <p className="text-sm text-slate-700">{copy.how}</p>
        </div>
        {props.done ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-900">
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
            Done
          </span>
        ) : null}
      </header>
      {play.kind === 'sort' ? (
        <Sort {...props} play={play} />
      ) : play.kind === 'truefalse' ? (
        <TrueFalse {...props} play={play} />
      ) : play.kind === 'words' ? (
        <Words {...props} play={play} />
      ) : (
        <Blanks {...props} play={play} />
      )}
    </section>
  );
}

function Verdict({ right, total, retry, onRetry, children }: { right: number; total: number; retry: boolean; onRetry: () => void; children?: ReactNode }) {
  const all = right === total;

  return (
    <div role="status" className={`flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2 text-sm ${all ? 'border-emerald-300 bg-emerald-50 text-emerald-950' : 'border-amber-300 bg-amber-50 text-amber-950'}`}>
      <span className="font-semibold">{all ? `All ${total} right.` : `${right} of ${total} right.`}</span>
      {children}
      {retry && !all ? (
        <button type="button" onClick={onRetry} className={`${PLAIN} ml-auto`}>
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          Try again
        </button>
      ) : null}
    </div>
  );
}

const Mark = ({ ok }: { ok: boolean }) =>
  ok ? <Check className="h-4 w-4 shrink-0 text-emerald-700" aria-label="Right" /> : <X className="h-4 w-4 shrink-0 text-rose-700" aria-label="Not right" />;

// ---------------------------------------------------------------------------
// Fill in the blanks
// ---------------------------------------------------------------------------

function Blanks({ play, done, onDone, hints }: PlayGameProps & { play: ClozePlay }) {
  const [typed, setTyped] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState(false);
  const [hinted, setHinted] = useState(false);
  const right = play.items.filter((i) => sameAnswer(typed[i.id] ?? '', i.answer)).length;
  const all = right === play.items.length;

  const check = () => {
    setChecked(true);
    if (play.items.every((i) => sameAnswer(typed[i.id] ?? '', i.answer))) onDone();
  };

  return (
    <div className="space-y-3">
      <ol className="space-y-2.5">
        {play.items.map((item, n) => {
          const ok = sameAnswer(typed[item.id] ?? '', item.answer);

          return (
            <li key={item.id} className="text-sm leading-8 text-slate-900">
              <span className="mr-1.5 font-bold text-sd-strong">{n + 1}.</span>
              {item.before}
              <input
                aria-label={`Gap ${n + 1}`}
                value={typed[item.id] ?? ''}
                disabled={checked && ok}
                placeholder={hinted ? firstLetters(item.answer) : ''}
                onChange={(e) => {
                  setChecked(false);
                  setTyped((t) => ({ ...t, [item.id]: e.target.value }));
                }}
                style={{ width: `${Math.max(item.answer.length, 6) + 2}ch` }}
                className={`mx-1 rounded-lg border-2 px-2 py-0.5 text-center font-semibold text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sd-accent ${checked ? (ok ? 'border-emerald-500 bg-emerald-50' : 'border-rose-500 bg-rose-50') : 'border-sd-line bg-sd-softer'}`}
              />
              {item.after}
              {checked ? (
                <span className="ml-1.5 inline-flex items-center gap-1 align-middle">
                  <Mark ok={ok} />
                  {ok ? null : <span className="sr-only">Not right yet</span>}
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={check} className={PRIMARY} disabled={play.items.every((i) => !(typed[i.id] ?? '').trim())}>
          Check answers
        </button>
        {hints ? (
          <button type="button" onClick={() => setHinted((h) => !h)} aria-pressed={hinted} className={PLAIN}>
            <Lightbulb className="h-4 w-4" aria-hidden="true" />
            {hinted ? 'Hide hint' : 'Show a hint'}
          </button>
        ) : null}
      </div>
      {checked ? (
        <Verdict right={right} total={play.items.length} retry onRetry={() => setChecked(false)}>
          {all ? <span>{play.items.map((i) => i.answer).join(', ')}.</span> : <span>Fix the gaps marked wrong, then check again.</span>}
        </Verdict>
      ) : done ? (
        <p role="status" className="text-sm font-semibold text-emerald-900">You have done this one.</p>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Drag the words
// ---------------------------------------------------------------------------

function Words({ play, done, onDone, seed }: PlayGameProps & { play: ClozePlay }) {
  const bank = useMemo(() => shuffled(play.items.map((i) => ({ id: i.id, word: i.answer })), seed), [play.items, seed]);
  // Which word (by the id of the sentence it came from) sits in which gap.
  const [placed, setPlaced] = useState<Record<string, string>>({});
  const [picked, setPicked] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const inGaps = new Set(Object.values(placed));
  const right = play.items.filter((i) => placed[i.id] === i.id).length;
  const wordOf = (id: string) => bank.find((b) => b.id === id)?.word ?? '';

  const put = (gap: string, wordId: string) => {
    setChecked(false);
    setPicked(null);
    setPlaced((p) => {
      const next = Object.fromEntries(Object.entries(p).filter(([, w]) => w !== wordId));
      next[gap] = wordId;

      return next;
    });
  };
  const drop = (gap: string) => (e: DragEvent) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain');
    if (id) put(gap, id);
  };
  const check = () => {
    setChecked(true);
    if (play.items.every((i) => placed[i.id] === i.id)) onDone();
  };

  return (
    <div className="space-y-3">
      <ul aria-label="Words" className="flex min-h-[2.75rem] flex-wrap gap-2 rounded-xl border-2 border-dashed border-sd-line bg-sd-softer p-2">
        {bank.filter((b) => !inGaps.has(b.id)).map((b) => (
          <li key={b.id}>
            <button
              type="button"
              draggable
              onDragStart={(e) => e.dataTransfer.setData('text/plain', b.id)}
              onClick={() => setPicked((p) => (p === b.id ? null : b.id))}
              aria-pressed={picked === b.id}
              className={`${BUTTON} cursor-grab ${picked === b.id ? 'border-sd-accent bg-sd-accent text-white' : 'border-sd-line bg-white text-slate-900 hover:border-sd-accent'}`}
            >
              <GripVertical className="h-4 w-4 opacity-60" aria-hidden="true" />
              {b.word}
            </button>
          </li>
        ))}
        {bank.every((b) => inGaps.has(b.id)) ? <li className="px-1 py-1 text-sm text-slate-700">Every word is placed.</li> : null}
      </ul>

      <ol className="space-y-2.5">
        {play.items.map((item, n) => {
          const word = placed[item.id];
          const ok = word === item.id;

          return (
            <li key={item.id} className="text-sm leading-9 text-slate-900">
              <span className="mr-1.5 font-bold text-sd-strong">{n + 1}.</span>
              {item.before}
              <button
                type="button"
                aria-label={word ? `Gap ${n + 1}: ${wordOf(word)}. Select to take it out.` : `Gap ${n + 1}, empty. Select to place the chosen word.`}
                onDragOver={(e) => e.preventDefault()}
                onDrop={drop(item.id)}
                onClick={() => {
                  if (word) {
                    setChecked(false);
                    setPlaced((p) => Object.fromEntries(Object.entries(p).filter(([g]) => g !== item.id)));
                  } else if (picked) put(item.id, picked);
                }}
                className={`mx-1 inline-flex min-w-[6rem] items-center justify-center rounded-lg border-2 px-2 py-0.5 font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-sd-accent motion-reduce:transition-none ${
                  checked && word ? (ok ? 'border-emerald-500 bg-emerald-50 text-emerald-950' : 'border-rose-500 bg-rose-50 text-rose-950') : word ? 'border-sd-accent bg-sd-soft text-sd-strong' : picked ? 'border-dashed border-sd-accent bg-white text-slate-500' : 'border-dashed border-sd-line bg-white text-slate-500'
                }`}
              >
                {word ? wordOf(word) : ' '}
              </button>
              {item.after}
              {checked && word ? <span className="ml-1.5 inline-flex align-middle"><Mark ok={ok} /></span> : null}
            </li>
          );
        })}
      </ol>

      <button type="button" onClick={check} className={PRIMARY} disabled={Object.keys(placed).length === 0}>
        Check answers
      </button>
      {checked ? (
        <Verdict
          right={right}
          total={play.items.length}
          retry
          onRetry={() => {
            setChecked(false);
            setPlaced((p) => Object.fromEntries(Object.entries(p).filter(([g, w]) => g === w)));
          }}
        >
          {right === play.items.length ? null : <span>Words in the wrong gap go back to the box when you try again.</span>}
        </Verdict>
      ) : done ? (
        <p role="status" className="text-sm font-semibold text-emerald-900">You have done this one.</p>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// True or false
// ---------------------------------------------------------------------------

function TrueFalse({ play, done, onDone }: PlayGameProps & { play: TrueFalsePlay }) {
  const [said, setSaid] = useState<Record<string, boolean>>({});
  const right = play.items.filter((i) => said[i.id] === i.truth).length;

  const answer = (id: string, value: boolean) => {
    const next = { ...said, [id]: value };
    setSaid(next);
    if (play.items.every((i) => next[i.id] === i.truth)) onDone();
  };

  return (
    <div className="space-y-3">
      <ol className="space-y-3">
        {play.items.map((item, n) => {
          const given = said[item.id];
          const ok = given === item.truth;

          return (
            <li key={item.id} className={`space-y-2 rounded-xl border-2 p-3 transition motion-reduce:transition-none ${given === undefined ? 'border-sd-line' : ok ? 'border-emerald-300 bg-emerald-50/60' : 'border-rose-300 bg-rose-50/60'}`}>
              <p className="text-sm font-medium text-slate-900">
                <span className="mr-1.5 font-bold text-sd-strong">{n + 1}.</span>
                {item.statement}
              </p>
              <div role="group" aria-label={`Statement ${n + 1}`} className="flex flex-wrap items-center gap-2">
                {[true, false].map((value) => (
                  <button
                    key={String(value)}
                    type="button"
                    aria-pressed={given === value}
                    disabled={given !== undefined && ok}
                    onClick={() => answer(item.id, value)}
                    className={`${BUTTON} ${given === value ? (ok ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-rose-600 bg-rose-600 text-white') : 'border-sd-line bg-white text-slate-900 hover:border-sd-accent'}`}
                  >
                    {value ? 'True' : 'False'}
                  </button>
                ))}
                {given !== undefined ? <Mark ok={ok} /> : null}
              </div>
              {given !== undefined ? (
                <p role="status" className="text-sm text-slate-900">
                  {ok ? item.why : `Not quite. Look again. ${item.truth ? 'This one is true.' : 'This one is not true.'}`}
                </p>
              ) : null}
            </li>
          );
        })}
      </ol>
      <p role="status" className="text-sm text-slate-800">
        {right === play.items.length ? 'All right. Well done.' : done ? 'You have done this one.' : `${right} of ${play.items.length} right so far.`}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Drag and drop: sort into groups
// ---------------------------------------------------------------------------

function Sort({ play, done, onDone, seed }: PlayGameProps & { play: SortPlay }) {
  const pool = useMemo(() => shuffled(play.items, seed), [play.items, seed]);
  const [where, setWhere] = useState<Record<string, number>>({});
  const [picked, setPicked] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const right = play.items.filter((i) => where[i.id] === i.bucket).length;
  const unplaced = pool.filter((i) => where[i.id] === undefined);

  const put = (id: string, bucket: number) => {
    setChecked(false);
    setPicked(null);
    setWhere((w) => ({ ...w, [id]: bucket }));
  };
  const check = () => {
    setChecked(true);
    if (play.items.every((i) => where[i.id] === i.bucket)) onDone();
  };
  const chip = (id: string, text: string, state: 'pool' | 'ok' | 'bad' | 'placed') => (
    <button
      key={id}
      type="button"
      draggable
      onDragStart={(e) => e.dataTransfer.setData('text/plain', id)}
      onClick={() => {
        if (state === 'pool') setPicked((p) => (p === id ? null : id));
        else if (picked) {
          // A card is chosen and another sits here: the chosen card goes into this card's group; nothing is taken out.
          const here = where[id];
          if (here !== undefined) put(picked, here);
        } else {
          setChecked(false);
          setWhere((w) => Object.fromEntries(Object.entries(w).filter(([k]) => k !== id)));
        }
      }}
      aria-pressed={state === 'pool' ? picked === id : undefined}
      aria-label={state === 'pool' ? text : `${text}. Select to take it out of the group.`}
      className={`${BUTTON} cursor-grab text-left font-medium ${
        state === 'ok' ? 'border-emerald-500 bg-emerald-50 text-emerald-950' : state === 'bad' ? 'border-rose-500 bg-rose-50 text-rose-950' : picked === id ? 'border-sd-accent bg-sd-accent text-white' : 'border-sd-line bg-white text-slate-900 hover:border-sd-accent'
      }`}
    >
      {text}
    </button>
  );

  return (
    <div className="space-y-3">
      <ul aria-label="Cards to sort" className="flex min-h-[2.75rem] flex-wrap gap-2 rounded-xl border-2 border-dashed border-sd-line bg-sd-softer p-2">
        {unplaced.map((i) => (
          <li key={i.id}>{chip(i.id, i.text, 'pool')}</li>
        ))}
        {unplaced.length === 0 ? <li className="px-1 py-1 text-sm text-slate-700">Every card is placed.</li> : null}
      </ul>
      <div className={`grid gap-3 ${play.buckets.length > 2 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
        {play.buckets.map((name, b) => (
          <div
            key={name}
            role="group"
            aria-label={`Group: ${name}`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const id = e.dataTransfer.getData('text/plain');
              if (id) put(id, b);
            }}
            onClick={() => picked && put(picked, b)}
            className={`min-h-[7rem] space-y-2 rounded-xl border-2 p-2.5 transition motion-reduce:transition-none ${picked ? 'cursor-pointer border-dashed border-sd-accent bg-sd-soft/60' : 'border-sd-line bg-white'}`}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-bold text-sd-strong">{name}</p>
              {/* The keyboard's way in: with a card chosen, this button puts it in this group. A mouse or a finger can use the whole group instead. */}
              <button
                type="button"
                disabled={!picked}
                onClick={(e) => {
                  e.stopPropagation();
                  if (picked) put(picked, b);
                }}
                aria-label={`Put the chosen card in ${name}`}
                className="min-h-8 rounded-lg border border-sd-line bg-white px-3 text-sm font-semibold text-sd-strong hover:bg-sd-softer focus-visible:outline focus-visible:outline-2 focus-visible:outline-sd-accent disabled:opacity-40"
              >
                Put here
              </button>
            </div>
            <ul className="space-y-1.5">
              {play.items
                .filter((i) => where[i.id] === b)
                .map((i) => (
                  <li key={i.id}>{chip(i.id, i.text, checked ? (i.bucket === b ? 'ok' : 'bad') : 'placed')}</li>
                ))}
            </ul>
          </div>
        ))}
      </div>
      <button type="button" onClick={check} className={PRIMARY} disabled={Object.keys(where).length === 0}>
        Check answers
      </button>
      {checked ? (
        <Verdict
          right={right}
          total={play.items.length}
          retry
          onRetry={() => {
            setChecked(false);
            setWhere((w) => Object.fromEntries(Object.entries(w).filter(([id, b]) => play.items.find((i) => i.id === id)?.bucket === b)));
          }}
        >
          {right === play.items.length ? null : <span>Cards in the wrong group go back to the box when you try again.</span>}
        </Verdict>
      ) : done ? (
        <p role="status" className="text-sm font-semibold text-emerald-900">You have done this one.</p>
      ) : null}
    </div>
  );
}

/** The plays of one part, one after another. `kinds` picks which; `hints` lets a blank be given a hint. */
export function Plays({ doc, part, kinds, done, dispatch, hints = false }: { doc: StudyDocument; part: BodyPart; kinds?: readonly PlayKind[]; done: ReadonlySet<string>; dispatch: (a: ProgressAction) => void; hints?: boolean }) {
  const plays = playsOf(doc, part).filter((p) => !kinds || kinds.includes(p.kind));
  if (plays.length === 0) return null;

  return (
    <div className="space-y-4" data-testid="plays">
      {plays.map((p, i) => (
        <PlayGame key={p.kind} play={p} done={done.has(playKey(part, p.kind))} onDone={() => dispatch({ type: 'done', key: playKey(part, p.kind) })} seed={part.n * 31 + i + 1} hints={hints} />
      ))}
    </div>
  );
}
