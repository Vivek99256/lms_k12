'use client';

// ---------------------------------------------------------------------------
// HPC settings for one school.
//
// What a blueprint CONTAINS has always been per school — its areas, goals,
// competencies, scale and abilities live in that school's own row. This screen
// covers the other half: what a blueprint may CHOOSE FROM. Who counts as an
// assessor, which activity approaches and evidence methods the school uses,
// which Part A sections its cards carry.
//
// A list the school has not touched shows the published NCERT vocabulary and is
// marked "Standard". The moment it saves one, that list becomes the school's
// own — for that type only. Its other lists keep following the standard, and a
// correction to the published vocabulary still reaches them.
//
// Stages are deliberately absent: NEP 2020's 5+3+3+4 is a national framework,
// not a school preference, and a school inventing a fifth stage would produce a
// card no board could read.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useState } from 'react';
import { GripVertical, Loader2, Plus, RotateCcw, Save, Trash2, X } from 'lucide-react';
import { fetchHpcOptions, resetHpcOptions, saveHpcOptions } from './api';
import type { HpcOptionType, HpcSchoolOption, HpcSchoolOptions } from './types';

type Props = { onClose: () => void; onSaved: () => void };

const LIST_META: Array<{ type: HpcOptionType; title: string; blurb: string; addLabel: string }> = [
  {
    type: 'assessor',
    title: 'Who can assess',
    blurb:
      'An HPC is meant to carry more than one voice. Add the people your school actually asks — a house mentor, a grandparent, a counsellor.',
    addLabel: 'Add assessor',
  },
  {
    type: 'activity_approach',
    title: 'Activity approaches',
    blurb: 'The pedagogies a teacher ticks against an activity on the card.',
    addLabel: 'Add approach',
  },
  {
    type: 'evidence_mode',
    title: 'Evidence methods',
    blurb: 'How a judgement is arrived at — what the teacher looked at before deciding.',
    addLabel: 'Add method',
  },
  {
    type: 'part_a_element',
    title: "The child's own pages (Part A)",
    blurb: 'The sections your cards carry before any subject is assessed.',
    addLabel: 'Add section',
  },
];

/** A row being edited. `code` is absent on one the coordinator just added. */
type DraftOption = { key: string; code?: string; label: string; description: string; isCustom: boolean };

function toDraft(option: HpcSchoolOption, index: number): DraftOption {
  return {
    key: `${option.code}-${index}`,
    code: option.code,
    label: option.label,
    description: option.description,
    isCustom: option.is_custom,
  };
}

export default function HpcSchoolOptionsPanel({ onClose, onSaved }: Props) {
  const [data, setData] = useState<HpcSchoolOptions | null>(null);
  const [drafts, setDrafts] = useState<Record<string, DraftOption[]>>({});
  const [loading, setLoading] = useState(true);
  const [busyType, setBusyType] = useState<HpcOptionType | ''>('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const next = await fetchHpcOptions();

      setData(next);
      setDrafts(
        Object.fromEntries(
          LIST_META.map((meta) => [meta.type, (next.options[meta.type] ?? []).map(toDraft)])
        )
      );
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load your HPC settings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = useCallback(
    async (type: HpcOptionType) => {
      const rows = (drafts[type] ?? []).filter((row) => row.label.trim() !== '');

      if (rows.length === 0) {
        setError('A list needs at least one option. Reset it to the standard list instead.');

        return;
      }

      setBusyType(type);
      setError('');

      try {
        const saved = await saveHpcOptions(
          type,
          rows.map((row) => ({ code: row.code, label: row.label.trim(), description: row.description.trim() }))
        );

        setDrafts((current) => ({ ...current, [type]: saved.map(toDraft) }));
        setData((current) =>
          current
            ? {
                ...current,
                options: { ...current.options, [type]: saved },
                customised_types: current.customised_types.includes(type)
                  ? current.customised_types
                  : [...current.customised_types, type],
              }
            : current
        );
        setNotice('Saved for your school. Other schools are unaffected.');
        onSaved();
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : 'Unable to save these options.');
      } finally {
        setBusyType('');
      }
    },
    [drafts, onSaved]
  );

  const reset = useCallback(
    async (type: HpcOptionType) => {
      if (
        !window.confirm(
          'Reset this list to the standard one?\n\nBlueprints that already use an option your school added keep it — the option just stops being offered.'
        )
      ) {
        return;
      }

      setBusyType(type);
      setError('');

      try {
        const standard = await resetHpcOptions(type);

        setDrafts((current) => ({ ...current, [type]: standard.map(toDraft) }));
        setData((current) =>
          current
            ? {
                ...current,
                options: { ...current.options, [type]: standard },
                customised_types: current.customised_types.filter((entry) => entry !== type),
              }
            : current
        );
        setNotice('Back to the standard list.');
        onSaved();
      } catch (resetError) {
        setError(resetError instanceof Error ? resetError.message : 'Unable to reset these options.');
      } finally {
        setBusyType('');
      }
    },
    [onSaved]
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#0F172A]/45 p-3">
      <div className="my-6 w-full max-w-[860px] rounded-[18px] border border-[#E4E9F2] bg-white shadow-xl">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#EEF1F6] px-5 py-3.5">
          <div className="min-w-0">
            <h3 className="text-[15px] font-semibold text-[#172554]">HPC settings for your school</h3>
            <p className="mt-0.5 max-w-2xl text-[12.5px] leading-5 text-[#5F7087]">
              What your blueprints can choose from. Each list follows the standard NCERT vocabulary
              until you change it — and only the list you change. Nothing here affects any other
              school.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-[9px] border border-[#E4E9F2] p-1.5 text-[#5F7087] transition hover:bg-[#F3F5F9]"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {error ? (
          <div className="mx-5 mt-3 rounded-[12px] border border-red-200 bg-red-50 px-3.5 py-2.5 text-[13px] text-[#B91C1C]">
            {error}
          </div>
        ) : null}

        {notice ? (
          <div className="mx-5 mt-3 rounded-[12px] border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-[13px] text-[#047857]">
            {notice}
          </div>
        ) : null}

        {loading ? (
          <p className="flex items-center gap-2 px-5 py-10 text-[13px] text-[#5F7087]">
            <Loader2 size={15} className="animate-spin" /> Loading your settings…
          </p>
        ) : (
          <div className="flex flex-col gap-4 p-5">
            {LIST_META.map((meta) => {
              const rows = drafts[meta.type] ?? [];
              const customised = data?.customised_types.includes(meta.type) ?? false;
              const busy = busyType === meta.type;

              return (
                <section key={meta.type} className="rounded-[14px] border border-[#E4E9F2] bg-[#FAFBFE] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h4 className="flex items-center gap-2 text-[14px] font-semibold text-[#172554]">
                        {meta.title}
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10.5px] font-semibold ${
                            customised
                              ? 'border-[#5846EA] bg-[#F5F4FF] text-[#5846EA]'
                              : 'border-[#E4E9F2] bg-white text-[#7A889D]'
                          }`}
                        >
                          {customised ? 'Your school' : 'Standard'}
                        </span>
                      </h4>
                      <p className="mt-0.5 max-w-xl text-[12px] leading-5 text-[#7A889D]">{meta.blurb}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      {customised ? (
                        <button
                          type="button"
                          onClick={() => void reset(meta.type)}
                          disabled={busy}
                          className="inline-flex items-center gap-1.5 rounded-[9px] border border-[#E4E9F2] bg-white px-2.5 py-1.5 text-[12px] font-semibold text-[#5F7087] transition hover:bg-[#F3F5F9] disabled:opacity-50"
                        >
                          <RotateCcw size={13} /> Reset
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => void save(meta.type)}
                        disabled={busy}
                        className="inline-flex items-center gap-1.5 rounded-[9px] bg-[#5846EA] px-3 py-1.5 text-[12px] font-semibold text-white transition hover:bg-[#4738CE] disabled:opacity-50"
                      >
                        {busy ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                        Save
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-col gap-1.5">
                    {rows.map((row, index) => (
                      <div
                        key={row.key}
                        className="flex items-center gap-2 rounded-[10px] border border-[#E4E9F2] bg-white px-2.5 py-1.5"
                      >
                        <GripVertical size={14} className="shrink-0 text-[#C3CDE0]" />
                        <input
                          value={row.label}
                          onChange={(event) =>
                            setDrafts((current) => ({
                              ...current,
                              [meta.type]: (current[meta.type] ?? []).map((entry, entryIndex) =>
                                entryIndex === index ? { ...entry, label: event.target.value } : entry
                              ),
                            }))
                          }
                          placeholder="What this option is called"
                          className="h-8 min-w-0 flex-1 rounded-[8px] border-0 px-1 text-[13px] text-[#172554] focus:outline-none"
                        />
                        {row.isCustom ? (
                          <span className="shrink-0 rounded-full border border-[#E4E9F2] bg-[#F8FAFC] px-2 py-0.5 text-[10px] font-semibold text-[#7A889D]">
                            added
                          </span>
                        ) : null}
                        <button
                          type="button"
                          onClick={() =>
                            setDrafts((current) => ({
                              ...current,
                              [meta.type]: (current[meta.type] ?? []).filter((_, i) => i !== index),
                            }))
                          }
                          className="shrink-0 rounded-[8px] p-1 text-[#98A4B6] transition hover:bg-red-50 hover:text-[#B91C1C]"
                          aria-label="Remove option"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={() =>
                        setDrafts((current) => ({
                          ...current,
                          [meta.type]: [
                            ...(current[meta.type] ?? []),
                            {
                              key: `new-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                              label: '',
                              description: '',
                              isCustom: true,
                            },
                          ],
                        }))
                      }
                      className="inline-flex w-fit items-center gap-1.5 pt-1 text-[12px] font-semibold text-[#5846EA]"
                    >
                      <Plus size={13} /> {meta.addLabel}
                    </button>
                  </div>

                  {customised ? null : (
                    <p className="mt-2 text-[11.5px] leading-5 text-[#98A4B6]">
                      Saving takes this list over for your school. Until then it follows the standard,
                      so any correction to the published vocabulary still reaches you.
                    </p>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
