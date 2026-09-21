'use client';

import { useMemo, useState } from 'react';
import { Copy, ImagePlus, Loader2, Plus, Trash2 } from 'lucide-react';
import {
  MEMORY_GAME_DEFAULTS,
  memoryGameApi,
  type H5pMemoryGame,
  type MemoryCardInput,
  type MemoryGameSavePayload,
  type MemoryScoringMode,
} from '../../data/h5p-content-types';
import type { MemoryFaceType } from '@/lib/h5p/memory-game';
import {
  CheckField,
  ColorField,
  FieldGroup,
  NumberField,
  SelectField,
  TextAreaField,
  TextField,
} from '../../components/fields';
import { FeedbackBandEditor } from '../../components/feedback-bands';
import { Input } from '@/components/ui/input';

/**
 * Memory game — authoring editor.
 *
 * A ROW IS A PAIR. The editor never shows a single card, because a single card
 * is not a thing an author can create: every row makes two tiles. Getting this
 * wrong in the UI is how a deck ends up with an odd number of tiles and a game
 * that cannot be completed.
 *
 * THE TWO FACES ARE TYPED INDEPENDENTLY, which is what makes "picture → word"
 * a normal row rather than a special mode. The face editor below is one
 * component used twice per row for exactly that reason.
 */

export interface MemoryGameEditorState extends Omit<MemoryGameSavePayload, 'cards'> {
  cards: MemoryCardInput[];
}

export function emptyMemoryState(): MemoryGameEditorState {
  return {
    ...MEMORY_GAME_DEFAULTS,
    active_pair_sets: [],
    // Two pairs, because two is the floor and an empty editor with an "add"
    // button teaches an author nothing about what a pair is.
    cards: [emptyCard(1), emptyCard(1)],
  };
}

function emptyCard(pairSet: number): MemoryCardInput {
  return {
    pair_set: pairSet,
    front_type: 'image',
    front_text: '',
    front_image: '',
    front_alt: '',
    back_type: 'text',
    back_text: '',
    back_image: '',
    back_alt: '',
    match_description: '',
  };
}

export function memoryStateFromRow(row: H5pMemoryGame): MemoryGameEditorState {
  return {
    title: row.title ?? '',
    description: row.description ?? '',
    task_description: row.task_description ?? '',
    pairs_to_use: row.pairs_to_use,
    active_pair_sets: row.active_pair_sets ?? [],
    allow_retry: row.allow_retry,
    use_grid: row.use_grid,
    shuffle_cards: row.shuffle_cards,
    show_completion_screen: row.show_completion_screen,
    completion_message: row.completion_message ?? '',
    scoring_mode: (row.scoring_mode as MemoryScoringMode) ?? 'pairs',
    points_per_pair: row.points_per_pair,
    pass_percentage: row.pass_percentage,
    track_time: row.track_time,
    time_limit_seconds: row.time_limit_seconds,
    theme_color: row.theme_color ?? '#4f46e5',
    card_back_image: row.card_back_image ?? '',
    feedback_bands: row.feedback_bands ?? [],
    cards: (row.cards ?? []).map((card) => ({
      pair_set: card.pair_set,
      front_type: (card.front_type as MemoryFaceType) ?? 'image',
      front_text: card.front_text ?? '',
      front_image: card.front_image ?? '',
      front_alt: card.front_alt ?? '',
      back_type: (card.back_type as MemoryFaceType) ?? 'image',
      back_text: card.back_text ?? '',
      back_image: card.back_image ?? '',
      back_alt: card.back_alt ?? '',
      match_description: card.match_description ?? '',
    })),
  };
}

export function memoryToPayload(state: MemoryGameEditorState): MemoryGameSavePayload {
  return {
    ...state,
    title: state.title.trim(),
    pairs_to_use: Math.max(0, Math.min(500, state.pairs_to_use || 0)),
    points_per_pair: Math.max(1, Math.min(100, state.points_per_pair || 1)),
    pass_percentage: Math.max(0, Math.min(100, state.pass_percentage || 0)),
    time_limit_seconds: Math.max(0, Math.min(14400, state.time_limit_seconds || 0)),
    // The server treats an empty list as "every set", so sending one is the
    // same as sending none and is what the checkbox row produces when the
    // author has not narrowed anything.
    active_pair_sets: [...new Set(state.active_pair_sets.map(Number))].sort((a, b) => a - b),
  };
}

/** The pairs actually in play, mirroring `activeMemoryPairs` in lib. */
function pairsInPlay(state: MemoryGameEditorState): MemoryCardInput[] {
  const sets = state.active_pair_sets;
  const inSets =
    sets.length > 0 ? state.cards.filter((card) => sets.includes(Number(card.pair_set))) : state.cards;

  return state.pairs_to_use > 0 ? inSets.slice(0, state.pairs_to_use) : inSets;
}

function faceComplete(card: MemoryCardInput, side: 'front' | 'back'): boolean {
  const type = card[`${side}_type`];
  return (type === 'text' ? card[`${side}_text`] : card[`${side}_image`]).trim() !== '';
}

/** Mirrors the server's publish check, in the author's words. */
export function validateMemoryState(state: MemoryGameEditorState): string[] {
  const problems: string[] = [];
  if (state.title.trim() === '') problems.push('Give the game a title.');

  const active = pairsInPlay(state);
  if (active.length < 2) {
    problems.push(
      state.cards.length < 2
        ? 'Add at least two pairs.'
        : 'The chosen pair sets and pair limit leave fewer than two pairs in play.'
    );
  }

  active.forEach((card, index) => {
    if (!faceComplete(card, 'front') || !faceComplete(card, 'back')) {
      problems.push(`Pair ${index + 1} is missing content on one side.`);
    }
    for (const side of ['front', 'back'] as const) {
      if (card[`${side}_type`] === 'image' && card[`${side}_image`].trim() !== '' && card[`${side}_alt`].trim() === '') {
        problems.push(`Pair ${index + 1} has a picture with no description.`);
      }
    }
  });

  // One line per problem gets long on a deck of twenty. Past five, say how
  // many are left rather than listing them all.
  return problems.length > 6 ? [...problems.slice(0, 5), `…and ${problems.length - 5} more.`] : problems;
}

// ---------------------------------------------------------------------------
// One face of a pair
// ---------------------------------------------------------------------------

function FaceEditor({
  side,
  card,
  onChange,
  disabled,
  onUploadError,
}: {
  side: 'front' | 'back';
  card: MemoryCardInput;
  onChange: (patch: Partial<MemoryCardInput>) => void;
  disabled?: boolean;
  onUploadError: (message: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const type = card[`${side}_type`];

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const url = await memoryGameApi.uploadMedia(file, 'card');
      onChange({ [`${side}_image`]: url } as Partial<MemoryCardInput>);
    } catch (err: unknown) {
      onUploadError(err instanceof Error ? err.message : 'Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex-1 space-y-2 rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          {side === 'front' ? 'First card' : 'Matching card'}
        </span>
        <div className="inline-flex overflow-hidden rounded-lg border border-slate-200">
          {(['image', 'text'] as MemoryFaceType[]).map((option) => (
            <button
              key={option}
              type="button"
              disabled={disabled}
              aria-pressed={type === option}
              onClick={() => onChange({ [`${side}_type`]: option } as Partial<MemoryCardInput>)}
              className={`px-2.5 py-1 text-[11px] font-medium transition disabled:opacity-50 ${
                type === option ? 'bg-indigo-50 text-indigo-700' : 'bg-white text-slate-500 hover:bg-slate-50'
              }`}
            >
              {option === 'image' ? 'Picture' : 'Words'}
            </button>
          ))}
        </div>
      </div>

      {type === 'text' ? (
        <Input
          value={card[`${side}_text`]}
          disabled={disabled}
          maxLength={500}
          placeholder={side === 'front' ? 'Kerala' : 'Thiruvananthapuram'}
          onChange={(e) => onChange({ [`${side}_text`]: e.target.value } as Partial<MemoryCardInput>)}
          aria-label={`${side === 'front' ? 'First' : 'Matching'} card text`}
        />
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            {card[`${side}_image`] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={card[`${side}_image`]}
                alt=""
                className="h-14 w-14 shrink-0 rounded-lg border border-slate-200 object-cover"
              />
            ) : (
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-dashed border-slate-300 text-slate-400">
                <ImagePlus className="h-4 w-4" />
              </div>
            )}
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50">
              {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <ImagePlus className="h-3 w-3" />}
              {card[`${side}_image`] ? 'Replace' : 'Upload'}
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                disabled={disabled || uploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (file) void upload(file);
                }}
              />
            </label>
          </div>
          <Input
            value={card[`${side}_alt`]}
            disabled={disabled}
            maxLength={255}
            placeholder="Describe the picture"
            onChange={(e) => onChange({ [`${side}_alt`]: e.target.value } as Partial<MemoryCardInput>)}
            aria-label={`${side === 'front' ? 'First' : 'Matching'} card image description`}
          />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// The editor
// ---------------------------------------------------------------------------

export function MemoryGameEditor({
  state,
  onChange,
  disabled,
}: {
  state: MemoryGameEditorState;
  onChange: (next: MemoryGameEditorState) => void;
  disabled?: boolean;
}) {
  const [uploadError, setUploadError] = useState('');

  const set = <K extends keyof MemoryGameEditorState>(key: K, value: MemoryGameEditorState[K]) =>
    onChange({ ...state, [key]: value });

  const patchCard = (index: number, patch: Partial<MemoryCardInput>) =>
    onChange({ ...state, cards: state.cards.map((card, i) => (i === index ? { ...card, ...patch } : card)) });

  const sets = useMemo(
    () => [...new Set(state.cards.map((card) => Number(card.pair_set)))].sort((a, b) => a - b),
    [state.cards]
  );

  const inPlay = pairsInPlay(state).length;

  return (
    <div className="space-y-4">
      {uploadError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{uploadError}</div>
      ) : null}

      <FieldGroup title="About this game" columns={1}>
        <TextField
          label="Title"
          required
          value={state.title}
          onChange={(v) => set('title', v)}
          disabled={disabled}
          placeholder="Match the state to its capital"
          maxLength={255}
        />
        <TextAreaField
          label="Description"
          value={state.description}
          onChange={(v) => set('description', v)}
          disabled={disabled}
          hint="For teachers, in the content list. Learners do not see this."
          rows={2}
        />
        <TextField
          label="Instruction"
          value={state.task_description}
          onChange={(v) => set('task_description', v)}
          disabled={disabled}
          hint="Shown above the board."
          placeholder="Turn over two cards. Match each state to its capital."
        />
      </FieldGroup>

      {/* ---- the pairs ---- */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Pairs</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Each row makes two cards. {state.cards.length} authored
              {inPlay !== state.cards.length ? `, ${inPlay} in play` : ''}.
            </p>
          </div>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange({ ...state, cards: [...state.cards, emptyCard(sets[sets.length - 1] ?? 1)] })}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" />
            Add pair
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {state.cards.map((card, index) => (
            <div key={index} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-700">Pair {index + 1}</span>
                <div className="flex items-center gap-1.5">
                  <label className="inline-flex items-center gap-1.5 text-[11px] text-slate-500">
                    Set
                    <Input
                      type="number"
                      min={1}
                      max={500}
                      value={String(card.pair_set)}
                      disabled={disabled}
                      onChange={(e) => patchCard(index, { pair_set: Math.max(1, Number(e.target.value) || 1) })}
                      className="h-7 w-16 tabular-nums"
                      aria-label={`Pair ${index + 1} set number`}
                    />
                  </label>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() =>
                      onChange({
                        ...state,
                        cards: [...state.cards.slice(0, index + 1), { ...card }, ...state.cards.slice(index + 1)],
                      })
                    }
                    className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 disabled:opacity-50"
                    aria-label={`Duplicate pair ${index + 1}`}
                    title="Duplicate pair"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onChange({ ...state, cards: state.cards.filter((_, i) => i !== index) })}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                    aria-label={`Remove pair ${index + 1}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <FaceEditor
                  side="front"
                  card={card}
                  disabled={disabled}
                  onChange={(patch) => patchCard(index, patch)}
                  onUploadError={setUploadError}
                />
                <FaceEditor
                  side="back"
                  card={card}
                  disabled={disabled}
                  onChange={(patch) => patchCard(index, patch)}
                  onUploadError={setUploadError}
                />
              </div>

              <div className="mt-2">
                <Input
                  value={card.match_description}
                  disabled={disabled}
                  maxLength={500}
                  placeholder="Shown when this pair is matched — e.g. “Thiruvananthapuram is the capital of Kerala.”"
                  onChange={(e) => patchCard(index, { match_description: e.target.value })}
                  aria-label={`Pair ${index + 1} match message`}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      <FieldGroup title="The board">
        <NumberField
          label="Pairs to deal"
          value={state.pairs_to_use}
          onChange={(v) => set('pairs_to_use', v)}
          min={0}
          max={500}
          disabled={disabled}
          hint="0 deals every pair in the chosen sets."
        />

        {sets.length > 1 ? (
          <fieldset className="space-y-2">
            <legend className="text-xs font-medium text-slate-700">Pair sets in play</legend>
            <div className="flex flex-wrap gap-2">
              {sets.map((setNumber) => {
                const on = state.active_pair_sets.includes(setNumber);
                return (
                  <button
                    key={setNumber}
                    type="button"
                    disabled={disabled}
                    aria-pressed={on}
                    onClick={() =>
                      set(
                        'active_pair_sets',
                        on
                          ? state.active_pair_sets.filter((s) => s !== setNumber)
                          : [...state.active_pair_sets, setNumber]
                      )
                    }
                    className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition disabled:opacity-50 ${
                      on
                        ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Set {setNumber}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-slate-500">None selected means every set.</p>
          </fieldset>
        ) : null}

        <CheckField
          label="Shuffle the board"
          hint="Off deals the pairs in the order above, so a class can be walked through the same board twice."
          checked={state.shuffle_cards}
          onChange={(v) => set('shuffle_cards', v)}
          disabled={disabled}
        />
        <CheckField
          label="Lay the cards out as a square grid"
          hint="Off flows them, which reads better on a phone."
          checked={state.use_grid}
          onChange={(v) => set('use_grid', v)}
          disabled={disabled}
        />
        <ColorField
          label="Card colour"
          value={state.theme_color}
          onChange={(v) => set('theme_color', v)}
          disabled={disabled}
        />
      </FieldGroup>

      <FieldGroup title="Timing and scoring">
        <SelectField<MemoryScoringMode>
          label="Score by"
          value={state.scoring_mode}
          onChange={(v) => set('scoring_mode', v)}
          disabled={disabled}
          options={[
            { value: 'pairs', label: 'Pairs matched' },
            { value: 'moves', label: 'Pairs matched, scaled by efficiency' },
          ]}
          hint={
            state.scoring_mode === 'moves'
              ? 'Measures memory of the board: clearing it in the fewest turns scores full marks.'
              : 'Measures recall of the content, however many turns it took.'
          }
        />
        <NumberField
          label="Points per pair"
          value={state.points_per_pair}
          onChange={(v) => set('points_per_pair', v)}
          min={1}
          max={100}
          disabled={disabled}
        />
        <NumberField
          label="Pass mark"
          value={state.pass_percentage}
          onChange={(v) => set('pass_percentage', v)}
          min={0}
          max={100}
          suffix="%"
          disabled={disabled}
        />
        <NumberField
          label="Time limit"
          value={state.time_limit_seconds}
          onChange={(v) => set('time_limit_seconds', v)}
          min={0}
          max={14400}
          suffix="seconds"
          disabled={disabled}
          hint="0 means no limit."
        />
        <CheckField
          label="Record how long an attempt takes"
          hint="Reported in analytics. It does not end the game."
          checked={state.track_time}
          onChange={(v) => set('track_time', v)}
          disabled={disabled}
        />
        <CheckField
          label="Allow retries"
          checked={state.allow_retry}
          onChange={(v) => set('allow_retry', v)}
          disabled={disabled}
        />
        <CheckField
          label="Show a completion screen"
          checked={state.show_completion_screen}
          onChange={(v) => set('show_completion_screen', v)}
          disabled={disabled}
        />
        <TextField
          label="Completion message"
          value={state.completion_message}
          onChange={(v) => set('completion_message', v)}
          disabled={disabled || !state.show_completion_screen}
          placeholder="Every state matched. Try it again against the clock."
        />
      </FieldGroup>

      <FeedbackBandEditor
        bands={state.feedback_bands}
        onChange={(bands) => set('feedback_bands', bands)}
        disabled={disabled}
      />
    </div>
  );
}
