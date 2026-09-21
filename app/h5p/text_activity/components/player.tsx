'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Eye, RotateCcw } from 'lucide-react';
import {
  TEXT_ACTIVITY_LABELS,
  feedbackFor,
  markableTokens,
  postH5pXapiStatement,
  scoreBlanks,
  scoreMarkedWords,
  segmentPassage,
  wordBank,
  type H5pContext,
  type H5pTextActivity,
  type TextActivityType,
  type TextAttemptResult,
} from '../../data/h5p';

/**
 * The learner-facing player for all three text-passage types.
 *
 * WHAT IT SHARES AND WHAT IT DOES NOT
 *
 * The frame -- instructions, illustration, the Check / Retry / Show solution
 * row, the score line, the feedback message and the xAPI statements -- is the
 * same for all three, and lives here once. Only the passage itself differs,
 * and each renderer below is small because the hard part (the grammar, the
 * tokenising, the arithmetic) is in lib/h5p/ and already tested.
 *
 * ANSWERS ARE MARKED IN THE BROWSER, AND THAT IS NOT A SECURITY HOLE BY
 * ACCIDENT. The answer key arrives with the activity, so a determined learner
 * can read it out of the network tab. That is true of every H5P type this
 * platform ships and is inherent to the format: H5P content.json contains its
 * own solutions, and the official player marks client-side too. What protects
 * a graded assessment is the xAPI record and the teacher's own marking, not
 * the player. Nothing here should be read as a claim otherwise.
 *
 * DRAGGING IS NEVER THE ONLY WAY. Drag the Words supports click-to-place as
 * well as dragging -- pick a word, then pick a blank. Drag-only would exclude
 * keyboard users, most touch users on a small screen, and anyone with a motor
 * impairment, and the activity is about vocabulary rather than dexterity.
 */

export function TextActivityPlayer({
  type,
  activity,
  ctx,
}: {
  type: TextActivityType;
  activity: H5pTextActivity;
  ctx: H5pContext;
}) {
  const tokens = useMemo(
    () => (type === 'mark_the_words' ? markableTokens(activity.passage) : []),
    [type, activity.passage]
  );

  const [responses, setResponses] = useState<Record<number, string>>({});
  const [selected, setSelected] = useState<ReadonlySet<number>>(() => new Set<number>());
  const [checked, setChecked] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  // Wall-clock, not render time: what the analytics pipeline stores as time
  // spent has to be the time the learner was in front of the activity. Set on
  // mount rather than at construction -- a render may be discarded or replayed,
  // and a clock read during one is neither pure nor necessarily the moment the
  // learner actually arrived.
  const startedAt = useRef<number>(0);
  const objectId = `${type}:${activity.id}`;

  useEffect(() => {
    startedAt.current = Date.now();
    void postH5pXapiStatement({ objectId, verb: 'attempted', ctx });
    // One `attempted` per activity opened, not per re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [objectId]);

  const result: TextAttemptResult = useMemo(
    () =>
      type === 'mark_the_words'
        ? scoreMarkedWords(activity, tokens, selected)
        : scoreBlanks(activity, responses),
    [type, activity, tokens, selected, responses]
  );

  // With instant feedback the learner sees each answer marked as they give it;
  // otherwise nothing is marked until they press Check.
  const showMarks = checked || (activity.instant_feedback && type !== 'mark_the_words');

  const check = useCallback(() => {
    setChecked(true);

    const seconds = Math.round((Date.now() - startedAt.current) / 1000);

    void postH5pXapiStatement({
      objectId,
      verb: 'answered',
      ctx,
      success: result.passed,
      response: String(result.score),
      durationSeconds: seconds,
    });

    // `completed` is a separate statement because the two answer different
    // questions in the reporting pipeline: "how did they do" and "did they
    // finish". An activity can be answered without being completed on a retry.
    void postH5pXapiStatement({
      objectId,
      verb: 'completed',
      ctx,
      success: result.passed,
      durationSeconds: seconds,
    });
  }, [ctx, objectId, result.passed, result.score]);

  const retry = useCallback(() => {
    setResponses({});
    setSelected(new Set<number>());
    setChecked(false);
    setRevealed(false);
    setAttempt((n) => n + 1);
    startedAt.current = Date.now();
  }, []);

  /**
   * An activity whose passage marks nothing renders perfectly and awards
   * nothing. Telling a learner "0 out of 0" says they got it wrong when
   * nothing was ever right, so the player says what is actually true instead.
   */
  if (!result.scoreable) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
        <p className="font-medium">This activity has no answers set yet.</p>
        <p className="mt-1 text-xs">
          Nothing is marked in the passage, so it cannot be scored. Ask your teacher to check it.
        </p>
      </div>
    );
  }

  const message = checked ? feedbackFor(activity.feedback_bands, result.percentage) : null;

  return (
    <div className="space-y-4">
      <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        {activity.task_description ? (
          <p className="mb-4 text-sm text-slate-600">{stripHtml(activity.task_description)}</p>
        ) : null}

        {activity.media_image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={activity.media_image}
            alt={activity.media_alt || ''}
            className="mb-4 max-h-72 w-full rounded-xl border border-slate-200 object-contain"
          />
        ) : null}

        {type === 'mark_the_words' ? (
          <MarkTheWordsPassage
            tokens={tokens}
            selected={selected}
            onToggle={(tokenIndex) => {
              if (checked) return;
              setSelected((current) => {
                const next = new Set(current);
                if (next.has(tokenIndex)) next.delete(tokenIndex);
                else next.add(tokenIndex);
                return next;
              });
            }}
            showMarks={checked}
            revealed={revealed}
            locked={checked}
          />
        ) : type === 'drag_text' ? (
          <DragTextPassage
            key={attempt}
            activity={activity}
            responses={responses}
            onPlace={(blankIndex, word) =>
              setResponses((current) => ({ ...current, [blankIndex]: word }))
            }
            onClear={(blankIndex) =>
              setResponses((current) => {
                const next = { ...current };
                delete next[blankIndex];
                return next;
              })
            }
            perBlank={result.perBlank}
            showMarks={showMarks}
            revealed={revealed}
            locked={checked}
          />
        ) : (
          <BlanksPassage
            activity={activity}
            responses={responses}
            onType={(blankIndex, value) =>
              setResponses((current) => ({ ...current, [blankIndex]: value }))
            }
            perBlank={result.perBlank}
            showMarks={showMarks}
            revealed={revealed}
            locked={checked}
          />
        )}
      </article>

      {checked ? (
        <div
          className={`rounded-2xl border p-4 ${
            result.passed
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-slate-200 bg-slate-50 text-slate-700'
          }`}
        >
          <p className="text-sm font-semibold">
            You scored {result.score} out of {result.maxScore} ({result.percentage}%)
          </p>
          {message ? <p className="mt-1 text-xs">{message}</p> : null}
          {type === 'mark_the_words' && result.incorrect > 0 ? (
            <p className="mt-1.5 text-[11px]">
              {result.incorrect} {result.incorrect === 1 ? 'word was' : 'words were'} marked that should
              not have been. Wrong marks count against the score.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {activity.enable_check && !checked ? (
          <button
            type="button"
            onClick={check}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#4f46e5] px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-[#4338ca]"
          >
            <Check className="h-4 w-4" />
            Check
          </button>
        ) : null}

        {checked && activity.enable_retry ? (
          <button
            type="button"
            onClick={retry}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <RotateCcw className="h-4 w-4" />
            Retry
          </button>
        ) : null}

        {checked && activity.enable_show_solution && !revealed ? (
          <button
            type="button"
            onClick={() => setRevealed(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3.5 py-2 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100"
          >
            <Eye className="h-4 w-4" />
            Show solution
          </button>
        ) : null}

        <span className="ml-auto text-[11px] text-slate-400">
          {TEXT_ACTIVITY_LABELS[type]} · {result.maxScore} {result.maxScore === 1 ? 'point' : 'points'}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fill in the blanks
// ---------------------------------------------------------------------------

function BlanksPassage({
  activity,
  responses,
  onType,
  perBlank,
  showMarks,
  revealed,
  locked,
}: {
  activity: H5pTextActivity;
  responses: Record<number, string>;
  onType: (blankIndex: number, value: string) => void;
  perBlank: Record<number, boolean>;
  showMarks: boolean;
  revealed: boolean;
  locked: boolean;
}) {
  const segments = useMemo(() => segmentPassage(activity.passage), [activity.passage]);

  return (
    <p
      className={`text-[15px] leading-loose text-slate-800 ${
        activity.separate_lines ? 'flex flex-col gap-2' : ''
      }`}
    >
      {segments.map((segment, index) =>
        segment.kind === 'text' ? (
          <span key={index}>{segment.text}</span>
        ) : (
          <span key={index} className="inline-flex items-baseline gap-1">
            <input
              type="text"
              value={responses[segment.slot.index] ?? ''}
              onChange={(event) => onType(segment.slot.index, event.target.value)}
              disabled={locked}
              // The field is sized to its own answer so the blank does not give
              // away a longer or shorter word than the rest.
              size={Math.max(8, segment.slot.solution.length + 2)}
              aria-label={`Blank ${segment.slot.index + 1}${segment.slot.tip ? `. Hint: ${segment.slot.tip}` : ''}`}
              className={`rounded-lg border px-2 py-1 text-sm outline-none transition focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50 ${
                showMarks
                  ? perBlank[segment.slot.index]
                    ? 'border-emerald-400 bg-emerald-50 text-emerald-800'
                    : 'border-red-300 bg-red-50 text-red-800'
                  : 'border-slate-300 focus:border-[#4f46e5]'
              }`}
            />
            {segment.slot.tip && !revealed ? (
              <span
                title={segment.slot.tip}
                className="cursor-help select-none text-[11px] font-semibold text-indigo-500"
                aria-hidden="true"
              >
                ?
              </span>
            ) : null}
            {revealed && !perBlank[segment.slot.index] ? (
              <span className="text-xs font-semibold text-emerald-700">{segment.slot.solution}</span>
            ) : null}
          </span>
        )
      )}
    </p>
  );
}

// ---------------------------------------------------------------------------
// Drag the words
// ---------------------------------------------------------------------------

function DragTextPassage({
  activity,
  responses,
  onPlace,
  onClear,
  perBlank,
  showMarks,
  revealed,
  locked,
}: {
  activity: H5pTextActivity;
  responses: Record<number, string>;
  onPlace: (blankIndex: number, word: string) => void;
  onClear: (blankIndex: number) => void;
  perBlank: Record<number, boolean>;
  showMarks: boolean;
  revealed: boolean;
  locked: boolean;
}) {
  const segments = useMemo(() => segmentPassage(activity.passage), [activity.passage]);
  // Seeded by the activity id, so a reload mid-attempt shows the same order.
  // See wordBank() for why an unshuffled or re-shuffled bank is both wrong.
  const bank = useMemo(
    () => wordBank(activity.passage, activity.distractors, activity.id),
    [activity.passage, activity.distractors, activity.id]
  );

  /** The word the learner picked up, for click-to-place. */
  const [held, setHeld] = useState<string | null>(null);

  const used = useMemo(() => Object.values(responses), [responses]);

  /** How many of this word are still in the bank, counting duplicates. */
  const remaining = (word: string) =>
    bank.filter((w) => w === word).length - used.filter((w) => w === word).length;

  const place = (blankIndex: number, word: string) => {
    if (locked) return;
    onPlace(blankIndex, word);
    setHeld(null);
  };

  return (
    <div className="space-y-5">
      <p className="text-[15px] leading-loose text-slate-800">
        {segments.map((segment, index) =>
          segment.kind === 'text' ? (
            <span key={index}>{segment.text}</span>
          ) : (
            <button
              key={index}
              type="button"
              disabled={locked && !responses[segment.slot.index]}
              onClick={() => {
                if (locked) return;
                if (held) place(segment.slot.index, held);
                else if (responses[segment.slot.index]) onClear(segment.slot.index);
              }}
              onDragOver={(event) => {
                if (!locked) event.preventDefault();
              }}
              onDrop={(event) => {
                event.preventDefault();
                const word = event.dataTransfer.getData('text/plain');
                if (word) place(segment.slot.index, word);
              }}
              aria-label={
                responses[segment.slot.index]
                  ? `Blank ${segment.slot.index + 1}, holding ${responses[segment.slot.index]}. Select to remove.`
                  : `Blank ${segment.slot.index + 1}, empty.${held ? ` Select to place ${held}.` : ''}`
              }
              className={`mx-0.5 inline-flex min-w-[88px] items-center justify-center rounded-lg border-2 border-dashed px-2 py-1 align-middle text-sm transition ${
                showMarks
                  ? perBlank[segment.slot.index]
                    ? 'border-emerald-400 bg-emerald-50 font-medium text-emerald-800'
                    : 'border-red-300 bg-red-50 font-medium text-red-800'
                  : responses[segment.slot.index]
                    ? 'border-indigo-300 bg-indigo-50 font-medium text-indigo-800'
                    : held
                      ? 'border-[#4f46e5] bg-indigo-50/50 text-slate-400'
                      : 'border-slate-300 bg-slate-50 text-slate-400'
              }`}
            >
              {responses[segment.slot.index] ?? ' '}
              {revealed && !perBlank[segment.slot.index] ? (
                <span className="ml-1.5 text-xs font-semibold text-emerald-700">
                  → {segment.slot.solution}
                </span>
              ) : null}
            </button>
          )
        )}
      </p>

      {!locked ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            {held ? `Now choose where “${held}” goes` : 'Drag a word into a blank, or pick one and then pick a blank'}
          </p>
          <div className="flex flex-wrap gap-2">
            {bank.map((word, index) => {
              const left = remaining(word);
              const spent = left <= 0;
              return (
                <button
                  key={`${word}-${index}`}
                  type="button"
                  draggable={!spent}
                  onDragStart={(event) => event.dataTransfer.setData('text/plain', word)}
                  onClick={() => setHeld(held === word ? null : word)}
                  disabled={spent}
                  aria-pressed={held === word}
                  className={`rounded-lg border px-2.5 py-1.5 text-sm font-medium transition ${
                    spent
                      ? 'cursor-default border-slate-200 bg-slate-100 text-slate-300 line-through'
                      : held === word
                        ? 'border-[#4f46e5] bg-[#4f46e5] text-white'
                        : 'cursor-grab border-slate-300 bg-white text-slate-700 hover:border-[#4f46e5] hover:text-[#4f46e5]'
                  }`}
                >
                  {word}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mark the words
// ---------------------------------------------------------------------------

function MarkTheWordsPassage({
  tokens,
  selected,
  onToggle,
  showMarks,
  revealed,
  locked,
}: {
  tokens: Array<{ tokenIndex: number; word: string; correct: boolean }>;
  selected: ReadonlySet<number>;
  onToggle: (tokenIndex: number) => void;
  showMarks: boolean;
  revealed: boolean;
  locked: boolean;
}) {
  return (
    <p className="text-[15px] leading-loose text-slate-800">
      {tokens.map((token) => {
        const marked = selected.has(token.tokenIndex);

        // Before checking, a marked word just looks marked. After checking,
        // the three states a learner needs to tell apart are: marked and
        // right, marked and wrong, and missed -- which is why "missed" only
        // appears once the solution is shown, so Check does not hand over the
        // answers a retry is supposed to let them find.
        let tone = 'hover:bg-slate-100 text-slate-800';
        if (marked && !showMarks) tone = 'bg-indigo-100 text-indigo-900 ring-1 ring-indigo-300';
        else if (showMarks && marked && token.correct) tone = 'bg-emerald-100 text-emerald-900 ring-1 ring-emerald-300';
        else if (showMarks && marked && !token.correct) tone = 'bg-red-100 text-red-900 ring-1 ring-red-300 line-through';
        else if (revealed && token.correct) tone = 'bg-emerald-50 text-emerald-800 ring-1 ring-dashed ring-emerald-300';

        return (
          <span key={token.tokenIndex}>
            <button
              type="button"
              onClick={() => onToggle(token.tokenIndex)}
              disabled={locked}
              aria-pressed={marked}
              className={`rounded px-1 py-0.5 transition disabled:cursor-default ${tone}`}
            >
              {token.word}
            </button>{' '}
          </span>
        );
      })}
    </p>
  );
}

/**
 * Task descriptions round-trip through H5P as rich text, so a package authored
 * elsewhere brings `<p>` tags with it. They are stripped rather than rendered:
 * this is imported content, and putting it through dangerouslySetInnerHTML
 * would make an uploaded .h5p file a script-injection vector.
 */
function stripHtml(value: string): string {
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}
