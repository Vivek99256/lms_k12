'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, Eye, Lightbulb, RotateCcw, XCircle } from 'lucide-react';

import {
  firstIndexOfTopic,
  hintFor,
  isCorrectAnswer,
  playableCards,
  score,
  startIndexForChapter,
  type CardResult,
  type PlayableCard,
  type VocabularyDeck,
} from '@/lib/vocabulary-class/deck';

type Mode = 'learn' | 'practise';

interface CardState {
  typed: string;
  /** Wrong tries on this card; after two the answer can be shown. */
  wrong: number;
  hint: boolean;
}

const EMPTY: CardState = { typed: '', wrong: 0, hint: false };

/**
 * The Vocabulary Class flashcards, modelled on the H5P Flashcards experience: a rounded card with a picture, a clue and
 * a typed answer that is checked, with the neighbouring cards showing either side and a progress bar underneath.
 *
 * Two ways to use the same deck:
 *  - Learn: the card shows the word; "Show definition" turns it over.
 *  - Practise: the card shows the definition as the clue, the learner types the word and checks it (as in H5P).
 *
 * It holds no data of its own and stores nothing: the deck comes from the stored document, and progress lives only for
 * this visit (nothing about a learner is written anywhere by this component).
 */
export function VocabularyClassPlayer({ deck, chapterId }: { deck: VocabularyDeck; chapterId: number }) {
  const cards = useMemo(() => playableCards(deck), [deck]);
  const total = cards.length;

  const [index, setIndex] = useState(() => startIndexForChapter(cards, chapterId));
  const [mode, setMode] = useState<Mode>('learn');
  const [turned, setTurned] = useState<Record<string, boolean>>({});
  const [state, setState] = useState<Record<string, CardState>>({});
  const [results, setResults] = useState<Record<string, CardResult>>({});
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [finished, setFinished] = useState(false);
  const [failedPictures, setFailedPictures] = useState<Record<string, boolean>>({});
  const inputRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);

  const card = cards[index];
  const cardState = state[card.id] ?? EMPTY;
  const result = results[card.id];
  const isTurned = mode === 'learn' ? turned[card.id] === true : result !== undefined;
  const tally = score(results, total);

  const go = useCallback(
    (next: number) => {
      if (next < 0 || next >= total) return;
      setFeedback(null);
      setIndex(next);
    },
    [total]
  );

  // Left and right arrows move through the deck, except while typing an answer.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      if (event.key === 'ArrowLeft') go(index - 1);
      if (event.key === 'ArrowRight') go(index + 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, index]);

  const setCardState = (patch: Partial<CardState>) => setState((all) => ({ ...all, [card.id]: { ...(all[card.id] ?? EMPTY), ...patch } }));

  const check = () => {
    if (result !== undefined || cardState.typed.trim() === '') return;
    if (isCorrectAnswer(cardState.typed, card.term)) {
      setResults((all) => ({ ...all, [card.id]: 'correct' }));
      setFeedback('correct');
    } else {
      setCardState({ wrong: cardState.wrong + 1 });
      setFeedback('wrong');
      inputRef.current?.select();
    }
  };

  const reveal = () => {
    setResults((all) => ({ ...all, [card.id]: all[card.id] ?? 'revealed' }));
    setFeedback(null);
  };

  const restart = () => {
    setResults({});
    setState({});
    setTurned({});
    setFeedback(null);
    setFinished(false);
    setIndex(startIndexForChapter(cards, chapterId));
    titleRef.current?.focus();
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setFeedback(null);
    setFinished(false);
  };

  const topics = deck.topics;
  const atEnd = index === total - 1;
  const answeredAll = mode === 'practise' && Object.keys(results).length === total;

  return (
    <section aria-labelledby="vc-title" className="mx-auto w-full max-w-5xl text-slate-100">
      <div className="rounded-3xl bg-[#27344f] p-4 shadow-xl sm:p-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 id="vc-title" ref={titleRef} tabIndex={-1} className="text-lg font-semibold text-white outline-none sm:text-xl">
              {deck.title}
            </h1>
            <p className="text-sm text-slate-300">
              {deck.topics.length === 1 ? `${deck.topics[0].title} · ` : ''}Vocabulary class · {total} cards
            </p>
          </div>
          <div role="group" aria-label="How to use the cards" className="inline-flex rounded-xl bg-slate-900/40 p-1">
            {(['learn', 'practise'] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={mode === option}
                onClick={() => switchMode(option)}
                className={`rounded-lg px-4 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300 ${
                  mode === option ? 'bg-white text-slate-900' : 'text-slate-200 hover:bg-white/10'
                }`}
              >
                {option === 'learn' ? 'Learn' : 'Practise'}
              </button>
            ))}
          </div>
        </header>

        <nav aria-label="Topics" hidden={topics.length < 2} className="mt-4 flex gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
          {topics.map((topic, t) => {
            const current = card.topicId === topic.id;
            return (
              <button
                key={topic.id}
                type="button"
                aria-current={current ? 'true' : undefined}
                onClick={() => go(firstIndexOfTopic(cards, topic.id))}
                className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-left text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300 ${
                  current ? 'bg-sky-200 font-semibold text-slate-900' : 'bg-slate-900/40 text-slate-200 hover:bg-white/10'
                }`}
              >
                <span className="font-semibold">{t + 1}.</span> {topic.title}
              </button>
            );
          })}
        </nav>

        {finished ? (
          <ResultPanel correct={tally.correct} total={total} percent={tally.percent} onRestart={restart} onReview={() => { setFinished(false); go(0); }} />
        ) : (
          <>
            <div className="relative mt-6 flex items-center justify-center gap-4">
              <Preview card={cards[index - 1]} side="previous" />
              <article
                key={card.id}
                aria-label={`Card ${index + 1} of ${total}`}
                className="w-full max-w-[26rem] overflow-hidden rounded-[2rem] bg-white text-slate-900 shadow-2xl motion-safe:animate-[vc-in_180ms_ease-out]"
              >
                {card.image && !failedPictures[card.id] ? (
                  <figure className="bg-sky-100 p-5">
                    <div className="overflow-hidden rounded-2xl border-4 border-white bg-white shadow-md">
                      {/* eslint-disable-next-line @next/next/no-img-element -- the address is a stored, school-owned picture; sizing is by the card */}
                      <img
                        src={card.image.src}
                        alt={card.image.alt}
                        className="mx-auto max-h-56 w-full object-contain"
                        onError={() => setFailedPictures((all) => ({ ...all, [card.id]: true }))}
                      />
                    </div>
                    {card.image.caption || card.image.credit ? (
                      <figcaption className="mt-2 text-center text-xs text-slate-600">
                        {card.image.caption}
                        {card.image.caption && card.image.credit ? ' · ' : ''}
                        {card.image.credit}
                      </figcaption>
                    ) : null}
                  </figure>
                ) : null}

                <div className="space-y-4 px-6 pb-6 pt-5 text-center">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Topic {card.topicNumber} · {mode === 'learn' ? (isTurned ? 'Definition' : 'Word') : isTurned ? 'Answer' : 'Which word means this?'}
                  </p>

                  {mode === 'learn' ? (
                    <>
                      <p className="break-words text-3xl font-semibold text-slate-900">{card.term}</p>
                      {isTurned ? (
                        <p className="text-lg leading-relaxed text-slate-800" data-testid="vc-definition">
                          {card.definition}
                        </p>
                      ) : null}
                      <button
                        type="button"
                        aria-expanded={isTurned}
                        onClick={() => setTurned((all) => ({ ...all, [card.id]: !isTurned }))}
                        className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-5 py-2.5 text-base font-semibold text-white hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                      >
                        <RotateCcw className="h-4 w-4" aria-hidden="true" />
                        {isTurned ? 'Hide definition' : 'Show definition'}
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="text-lg leading-relaxed text-slate-800" data-testid="vc-clue">
                        {card.definition}
                      </p>
                      {isTurned ? (
                        <p className="break-words text-2xl font-semibold text-slate-900" data-testid="vc-answer">
                          {card.term}
                        </p>
                      ) : null}
                      <form
                        onSubmit={(event) => {
                          event.preventDefault();
                          check();
                        }}
                        className="flex items-stretch overflow-hidden rounded-full border-2 border-sky-300 bg-white focus-within:ring-4 focus-within:ring-sky-200"
                      >
                        <label htmlFor="vc-answer-input" className="sr-only">
                          Your answer: the word that matches this definition
                        </label>
                        <input
                          id="vc-answer-input"
                          ref={inputRef}
                          value={cardState.typed}
                          disabled={result !== undefined}
                          autoComplete="off"
                          autoCapitalize="none"
                          spellCheck={false}
                          placeholder="Your answer"
                          onChange={(event) => {
                            setCardState({ typed: event.target.value });
                            if (feedback) setFeedback(null);
                          }}
                          className="min-w-0 flex-1 bg-transparent px-4 py-3 text-base text-slate-900 outline-none placeholder:text-slate-500 disabled:text-slate-500"
                        />
                        <button
                          type="submit"
                          disabled={result !== undefined || cardState.typed.trim() === ''}
                          className="bg-blue-600 px-5 text-base font-semibold text-white hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-white disabled:bg-slate-300 disabled:text-slate-600"
                        >
                          Check
                        </button>
                      </form>

                      <div role="status" aria-live="polite" className="min-h-[1.5rem] text-base">
                        {feedback === 'correct' || result === 'correct' ? (
                          <p className="inline-flex items-center gap-2 font-semibold text-emerald-700">
                            <CheckCircle2 className="h-5 w-5" aria-hidden="true" /> Correct
                          </p>
                        ) : null}
                        {feedback === 'wrong' && result === undefined ? (
                          <p className="inline-flex items-center gap-2 font-semibold text-red-700">
                            <XCircle className="h-5 w-5" aria-hidden="true" /> Not quite. Try again.
                          </p>
                        ) : null}
                        {result === 'revealed' ? <p className="text-slate-700">Here is the word. Try it again later.</p> : null}
                      </div>

                      {result === undefined ? (
                        <div className="flex flex-wrap items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => setCardState({ hint: true })}
                            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold text-blue-700 hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
                          >
                            <Lightbulb className="h-4 w-4" aria-hidden="true" /> Hint
                          </button>
                          {cardState.wrong >= 2 ? (
                            <button
                              type="button"
                              onClick={reveal}
                              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
                            >
                              <Eye className="h-4 w-4" aria-hidden="true" /> Show the word
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                      {cardState.hint && result === undefined ? <p className="text-sm text-slate-700">{hintFor(card.term)}</p> : null}
                    </>
                  )}
                </div>
              </article>
              <Preview card={cards[index + 1]} side="next" />
            </div>

            <div className="mx-auto mt-6 flex max-w-xl items-center gap-3">
              <button
                type="button"
                aria-label="Previous card"
                disabled={index === 0}
                onClick={() => go(index - 1)}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-500 text-slate-100 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300 disabled:opacity-40"
              >
                <ArrowLeft className="h-5 w-5" aria-hidden="true" />
              </button>
              <div className="flex-1">
                <div
                  role="progressbar"
                  aria-label="Progress through the cards"
                  aria-valuemin={1}
                  aria-valuemax={total}
                  aria-valuenow={index + 1}
                  aria-valuetext={`Card ${index + 1} of ${total}`}
                  className="h-2.5 overflow-hidden rounded-full border border-slate-500 bg-slate-900/50"
                >
                  <div className="h-full rounded-full bg-emerald-300 transition-[width] motion-reduce:transition-none" style={{ width: `${((index + 1) / total) * 100}%` }} />
                </div>
                <p className="mt-1.5 flex justify-between text-sm text-slate-300">
                  <span data-testid="vc-counter">
                    {index + 1} / {total}
                  </span>
                  {mode === 'practise' ? (
                    <span>
                      Correct: {tally.correct} of {total}
                    </span>
                  ) : null}
                </p>
              </div>
              {mode === 'practise' && atEnd && answeredAll ? (
                <button
                  type="button"
                  onClick={() => setFinished(true)}
                  className="shrink-0 rounded-full bg-emerald-300 px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-emerald-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300"
                >
                  See result
                </button>
              ) : (
                <button
                  type="button"
                  aria-label="Next card"
                  disabled={atEnd}
                  onClick={() => go(index + 1)}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-500 text-slate-100 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300 disabled:opacity-40"
                >
                  <ArrowRight className="h-5 w-5" aria-hidden="true" />
                </button>
              )}
            </div>
          </>
        )}
      </div>
      <style>{`@keyframes vc-in { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: none } }`}</style>
    </section>
  );
}

/** The dimmed neighbour on either side. Decorative: the buttons and the arrow keys are the way to move. */
function Preview({ card, side }: { card: PlayableCard | undefined; side: 'previous' | 'next' }) {
  if (!card) return <div aria-hidden="true" className="hidden w-40 shrink-0 lg:block" />;
  return (
    <div
      aria-hidden="true"
      className={`hidden h-64 w-40 shrink-0 items-center justify-center overflow-hidden rounded-3xl bg-slate-100/20 p-4 text-center text-lg font-semibold text-slate-200/70 lg:flex ${
        side === 'previous' ? '-ml-2' : '-mr-2'
      }`}
    >
      {card.term}
    </div>
  );
}

function ResultPanel({ correct, total, percent, onRestart, onReview }: { correct: number; total: number; percent: number; onRestart: () => void; onReview: () => void }) {
  return (
    <div role="status" className="mx-auto mt-8 max-w-md rounded-3xl bg-white p-8 text-center text-slate-900">
      <p className="text-sm font-semibold uppercase tracking-wider text-slate-500">Practice complete</p>
      <p className="mt-2 text-4xl font-semibold" data-testid="vc-result">
        {correct} of {total}
      </p>
      <p className="mt-1 text-base text-slate-700">cards answered correctly ({percent}%)</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={onRestart} className="rounded-full bg-blue-600 px-5 py-2.5 font-semibold text-white hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
          Practise again
        </button>
        <button type="button" onClick={onReview} className="rounded-full border border-slate-300 px-5 py-2.5 font-semibold text-slate-800 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
          Review the cards
        </button>
      </div>
    </div>
  );
}
