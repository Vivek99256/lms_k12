'use client';

// ---------------------------------------------------------------------------
// LMS > Exam > Blueprint.
//
// The design of a paper, settled before any question is chosen: how many marks
// to which chapter, how many questions of which type, what share is easy.
//
// The screen opens on published references — Delhi DoE's own 2025-26 paper
// designs and CBSE's Class X pattern, transcribed from the source documents and
// linked back to them. A school never edits a reference; it copies one, and the
// copy records what it came from, so "how does our paper differ from the
// board's" stays answerable a year later.
//
// Nothing here blocks a save. A blueprint is partial until it is finished; what
// does not add up is shown beside the field that causes it and saved anyway.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Copy,
  ExternalLink,
  FileStack,
  Loader2,
  Plus,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import { SearchDropdown, type SearchDropdownValues } from '@/components/search-dropdown';
import BlueprintEditor, { sectionMarks, totalSectionMarks } from './BlueprintEditor';
import HpcBlueprintEditor from './HpcBlueprintEditor';
import {
  cloneBlueprint,
  deleteBlueprint,
  fetchBlueprintIndex,
  fetchChapters,
  saveBlueprint,
} from './api';
import type {
  Blueprint,
  BlueprintDraft,
  BlueprintIndex,
  BlueprintKind,
  ChapterOption,
  HpcBlueprintRow,
  RegularBlueprint,
} from './types';

/**
 * The two categories, and how each one describes itself.
 *
 * They share a lifecycle — published reference, copy, edit, version — and
 * nothing else: one is a marks-based paper design, the other is a Holistic
 * Progress Card with no marks in it at all. Keeping them on one screen behind a
 * switch is what stops a school having two half-learned places to look.
 */
const CATEGORIES: Array<{ kind: BlueprintKind; label: string; blurb: string }> = [
  {
    kind: 'regular',
    label: 'Regular',
    blurb:
      'How a marks-based paper is designed before any question is picked — marks by chapter, questions by type, the easy/hard split.',
  },
  {
    kind: 'hpc',
    label: 'HPC',
    blurb:
      'How a Holistic Progress Card is designed. No marks: curricular goals and competencies, judged against a proficiency scale by the student, a peer, the teacher and the parent.',
  },
];

/** Stable list key — a reference has no id until it is copied. */
function blueprintKey(blueprint: Blueprint): string {
  return blueprint.is_preset ? `preset:${blueprint.preset_key}` : `blueprint:${blueprint.id}`;
}

function toDraft(blueprint: Blueprint): BlueprintDraft {
  const base = {
    id: blueprint.id,
    stage: blueprint.stage,
    name: blueprint.name,
    description: blueprint.description,
    academic_year: blueprint.academic_year,
    board: blueprint.board,
    class_band: blueprint.class_band,
    assessment_type: blueprint.assessment_type,
    standard_id: blueprint.standard_id,
    subject_id: blueprint.subject_id,
    subject_label: blueprint.subject_label,
    total_marks: blueprint.total_marks,
    duration_minutes: blueprint.duration_minutes,
    status: blueprint.status,
    source: blueprint.source,
    source_url: blueprint.source_url,
    preset_key: blueprint.preset_key,
    parent_id: blueprint.parent_id,
  };

  // Narrowed on `kind` rather than cast, so the wrong definition shape cannot
  // reach the wrong editor.
  return blueprint.kind === 'hpc'
    ? { ...base, kind: 'hpc', definition: blueprint.definition }
    : { ...base, kind: 'regular', definition: blueprint.definition };
}

function trimNumber(value: number): string {
  return String(Math.round(value * 100) / 100);
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export default function AssessmentBlueprints() {
  const [index, setIndex] = useState<BlueprintIndex | null>(null);
  const [indexLoading, setIndexLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const [category, setCategory] = useState<BlueprintKind>('regular');
  const [selectedKey, setSelectedKey] = useState('');
  const [draft, setDraft] = useState<BlueprintDraft | null>(null);
  const [chapters, setChapters] = useState<ChapterOption[]>([]);
  const [chaptersLoading, setChaptersLoading] = useState(false);

  const load = useCallback(async (keepKey = '') => {
    setIndexLoading(true);

    try {
      const next = await fetchBlueprintIndex();

      setIndex(next);

      if (keepKey) {
        setSelectedKey(keepKey);
      }
    } catch (loadError) {
      setError(errorMessage(loadError, 'Unable to load blueprints.'));
    } finally {
      setIndexLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = useMemo<Blueprint | null>(() => {
    if (!index || !selectedKey) return null;

    return (
      [...index.blueprints, ...index.presets].find((entry) => blueprintKey(entry) === selectedKey) ?? null
    );
  }, [index, selectedKey]);

  // Both categories arrive in one payload and are filtered here, so switching
  // between them is instant and never re-fetches.
  const visibleBlueprints = useMemo(
    () => (index?.blueprints ?? []).filter((entry) => entry.kind === category),
    [category, index]
  );

  const visiblePresets = useMemo(
    () => (index?.presets ?? []).filter((entry) => entry.kind === category),
    [category, index]
  );

  // The editor is a controlled form over its own draft, so selecting a
  // different blueprint has to reseed it. References are never edited, so they
  // get no draft at all — they render as a read-only preview.
  useEffect(() => {
    if (!selected || selected.is_preset) {
      setDraft(null);

      return;
    }

    setDraft(toDraft(selected));
  }, [selected]);

  // Chapter weightage is a marks-based idea, so the chapter list is only ever
  // fetched for a regular blueprint.
  const standardId = draft?.kind === 'regular' ? draft.standard_id : null;
  const subjectId = draft?.kind === 'regular' ? draft.subject_id : null;

  useEffect(() => {
    if (!standardId || !subjectId) {
      setChapters([]);

      return;
    }

    let cancelled = false;

    setChaptersLoading(true);

    fetchChapters(standardId, subjectId)
      .then((next) => {
        if (!cancelled) setChapters(next);
      })
      .catch(() => {
        // A missing chapter list is not worth an error banner: weightage rows
        // still work by name, which is how the reference documents express them.
        if (!cancelled) setChapters([]);
      })
      .finally(() => {
        if (!cancelled) setChaptersLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [standardId, subjectId]);

  const use = useCallback(
    async (blueprint: Blueprint) => {
      setBusy(true);
      setError('');

      try {
        const created = await cloneBlueprint(
          blueprint.is_preset
            ? { presetKey: blueprint.preset_key ?? '' }
            : { blueprintId: blueprint.id ?? 0 }
        );

        setCategory(created.kind);
        await load(blueprintKey(created));
        setNotice(
          blueprint.is_preset
            ? `Copied "${blueprint.name}" into your school. Everything in it can now be changed.`
            : `Copied "${blueprint.name}".`
        );
      } catch (cloneError) {
        setError(errorMessage(cloneError, 'Unable to copy this blueprint.'));
      } finally {
        setBusy(false);
      }
    },
    [load]
  );

  const startBlank = useCallback(async () => {
    if (!index) return;

    setBusy(true);
    setError('');

    const shared = {
      id: null,
      name: category === 'hpc' ? 'Untitled HPC blueprint' : 'Untitled blueprint',
      description: '',
      academic_year: '',
      board: '',
      class_band: '',
      assessment_type: '',
      standard_id: null,
      subject_id: null,
      subject_label: '',
      total_marks: 0,
      duration_minutes: null,
      status: 'Draft' as const,
      source: 'School-custom',
      source_url: '',
      preset_key: null,
      parent_id: null,
    };

    try {
      const created = await saveBlueprint(
        category === 'hpc'
          ? {
              ...shared,
              kind: 'hpc',
              stage: index.options.hpc.defaults.stage,
              definition: index.options.hpc.defaults,
            }
          : { ...shared, kind: 'regular', stage: '', definition: index.options.defaults }
      );

      setCategory(created.kind);
      await load(blueprintKey(created));
      setNotice('New blueprint created.');
    } catch (createError) {
      setError(errorMessage(createError, 'Unable to create a blueprint.'));
    } finally {
      setBusy(false);
    }
  }, [category, index, load]);

  const save = useCallback(async () => {
    if (!draft) return;

    setBusy(true);
    setError('');

    try {
      const saved = await saveBlueprint(draft);

      await load(blueprintKey(saved));
      setNotice('Blueprint saved.');
    } catch (saveError) {
      setError(errorMessage(saveError, 'Unable to save this blueprint.'));
    } finally {
      setBusy(false);
    }
  }, [draft, load]);

  const remove = useCallback(
    async (blueprint: Blueprint) => {
      if (!blueprint.id || !window.confirm(`Remove "${blueprint.name}"?`)) {
        return;
      }

      setBusy(true);
      setError('');

      try {
        await deleteBlueprint(blueprint.id);
        setSelectedKey('');
        setDraft(null);
        await load();
        setNotice('Blueprint removed.');
      } catch (removeError) {
        setError(errorMessage(removeError, 'Unable to remove this blueprint.'));
      } finally {
        setBusy(false);
      }
    },
    [load]
  );

  const handleClassChange = useCallback(
    (values: SearchDropdownValues) => {
      setDraft((current) =>
        current
          ? {
              ...current,
              standard_id: Number(values.standard) || null,
              subject_id: Number(values.subject) || null,
            }
          : current
      );
    },
    []
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[18px] font-semibold text-[#172554]">Blueprint</h2>
          <p className="mt-1 max-w-3xl text-[13px] leading-6 text-[#5B6B82]">
            {CATEGORIES.find((entry) => entry.kind === category)?.blurb} Start from a published
            design and change what your school does differently.
          </p>

          <div className="mt-2.5 inline-flex rounded-[10px] border border-[#E4E9F2] p-0.5">
            {CATEGORIES.map((entry) => (
              <button
                key={entry.kind}
                type="button"
                onClick={() => {
                  setCategory(entry.kind);
                  // The open blueprint belongs to the category being left, so
                  // it closes rather than lingering behind the other list.
                  setSelectedKey('');
                  setDraft(null);
                }}
                className={`rounded-[8px] px-4 py-1.5 text-[12.5px] font-semibold transition ${
                  category === entry.kind
                    ? 'bg-[#5846EA] text-white'
                    : 'text-[#5F7087] hover:bg-[#F3F5F9]'
                }`}
              >
                {entry.label}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => void startBlank()}
          disabled={!index || busy}
          className="inline-flex items-center gap-2 rounded-[10px] bg-[#5846EA] px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-[#4738CE] disabled:opacity-50"
        >
          <Plus size={16} />
          New blueprint
        </button>
      </div>

      {error ? (
        <div className="flex items-start justify-between gap-3 rounded-[14px] border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-[#B91C1C]">
          <span>{error}</span>
          <button type="button" onClick={() => setError('')} aria-label="Dismiss">
            <X size={15} />
          </button>
        </div>
      ) : null}

      {notice ? (
        <div className="flex items-start justify-between gap-3 rounded-[14px] border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[13px] text-[#047857]">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice('')} aria-label="Dismiss">
            <X size={15} />
          </button>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
        {/* ---- List ------------------------------------------------------- */}
        <aside className="flex flex-col gap-2.5 rounded-[18px] border border-[#E4E9F2] bg-white p-3">
          {indexLoading ? (
            <p className="flex items-center gap-2 px-2 py-6 text-[13px] text-[#5F7087]">
              <Loader2 size={15} className="animate-spin" /> Loading blueprints…
            </p>
          ) : (
            <>
              <p className="px-2 pt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7A889D]">
                Your school&apos;s blueprints
              </p>

              {visibleBlueprints.length === 0 ? (
                <p className="px-2 pb-1 text-[12px] leading-5 text-[#7A889D]">
                  None yet. Start from a published design below, or build one from scratch.
                </p>
              ) : (
                visibleBlueprints.map((blueprint) => (
                  <ListRow
                    key={blueprintKey(blueprint)}
                    blueprint={blueprint}
                    active={selectedKey === blueprintKey(blueprint)}
                    onSelect={() => setSelectedKey(blueprintKey(blueprint))}
                    onRemove={() => void remove(blueprint)}
                  />
                ))
              )}

              <p className="mt-2 px-2 pt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7A889D]">
                Published designs
              </p>
              <p className="px-2 text-[11.5px] leading-5 text-[#98A4B6]">
                Transcribed from the source documents. Read-only — copy one to change it.
              </p>

              {visiblePresets.map((preset) => (
                <ListRow
                  key={blueprintKey(preset)}
                  blueprint={preset}
                  active={selectedKey === blueprintKey(preset)}
                  onSelect={() => setSelectedKey(blueprintKey(preset))}
                />
              ))}
            </>
          )}
        </aside>

        {/* ---- Panel ------------------------------------------------------ */}
        <section className="min-w-0">
          {!selected ? (
            <div className="flex flex-col items-center gap-2 rounded-[18px] border border-dashed border-[#D7DEEA] bg-white px-6 py-14 text-center">
              <FileStack size={22} className="text-[#98A4B6]" />
              <p className="text-[14px] font-semibold text-[#334155]">Nothing open</p>
              <p className="max-w-md text-[12.5px] leading-6 text-[#7A889D]">
                Pick a blueprint on the left. The published designs are a good place to start — they
                are transcribed from the real {category === 'hpc' ? 'NCERT and CBSE cards' : '2025-26 paper patterns'}, not
                examples.
              </p>
            </div>
          ) : selected.is_preset ? (
            selected.kind === 'hpc' ? (
              <HpcPresetPreview blueprint={selected} busy={busy} onUse={() => void use(selected)} />
            ) : (
              <PresetPreview blueprint={selected} busy={busy} onUse={() => void use(selected)} />
            )
          ) : draft && index ? (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-[#E4E9F2] bg-white px-4 py-3.5">
                <div className="min-w-0">
                  <h3 className="text-[15px] font-semibold text-[#172554]">{draft.name}</h3>
                  <p className="mt-0.5 text-[12px] text-[#7A889D]">
                    {selected.source ? `From ${selected.source}` : 'School-custom'}
                    {selected.version > 1 ? ` · edit ${selected.version}` : ''}
                    {selected.updated_at ? ` · saved ${selected.updated_at}` : ''}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void use(selected)}
                    disabled={busy}
                    className="inline-flex items-center gap-1.5 rounded-[10px] border border-[#E4E9F2] px-3.5 py-2 text-[13px] font-semibold text-[#334155] transition hover:bg-[#F3F5F9] disabled:opacity-50"
                  >
                    <Copy size={15} /> Duplicate
                  </button>
                  <button
                    type="button"
                    onClick={() => void save()}
                    disabled={busy}
                    className="inline-flex items-center gap-1.5 rounded-[10px] bg-[#5846EA] px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-[#4738CE] disabled:opacity-50"
                  >
                    {busy ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                    Save
                  </button>
                </div>
              </div>

              {selected.warnings.length > 0 ? (
                <div className="rounded-[14px] border border-amber-200 bg-amber-50 px-4 py-3">
                  <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-amber-800">
                    <AlertTriangle size={14} /> Worth a look — saved either way
                  </p>
                  <ul className="mt-1.5 list-disc pl-5 text-[12.5px] leading-6 text-amber-800">
                    {selected.warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {/* Binding to a class only buys you the chapter picker, which is
                  a marks-based idea, so it is not shown on an HPC. */}
              {draft.kind === 'regular' ? (
              <section className="rounded-[18px] border border-[#E4E9F2] bg-white p-4">
                <h4 className="text-[14px] font-semibold text-[#172554]">Set against a class</h4>
                <p className="mt-0.5 mb-3 max-w-3xl text-[12px] leading-5 text-[#7A889D]">
                  Optional, and only useful once you want chapter weightage: binding the blueprint to
                  a class and subject is what lets you pick real chapters instead of typing their
                  names.
                </p>
                <SearchDropdown
                  fields={['standard', 'subject']}
                  values={{
                    standard: draft.standard_id ? String(draft.standard_id) : '',
                    subject: draft.subject_id ? String(draft.subject_id) : '',
                  }}
                  labels={{ standard: 'Standard', subject: 'Subject' }}
                  placeholders={{ standard: 'Select Standard', subject: 'Select Subject' }}
                  onChange={handleClassChange}
                />
              </section>
              ) : null}

              {draft.kind === 'hpc' ? (
                <HpcBlueprintEditor
                  draft={draft}
                  options={index.options.hpc}
                  onChange={setDraft}
                />
              ) : (
                <BlueprintEditor
                  draft={draft}
                  options={index.options}
                  chapters={chapters}
                  chaptersLoading={chaptersLoading}
                  onChange={setDraft}
                />
              )}
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}

function ListRow({
  blueprint,
  active,
  onSelect,
  onRemove,
}: {
  blueprint: Blueprint;
  active: boolean;
  onSelect: () => void;
  onRemove?: () => void;
}) {
  const facets = [
    blueprint.board,
    blueprint.kind === 'hpc' ? blueprint.stage : blueprint.class_band,
    blueprint.subject_label || blueprint.subject_name,
  ]
    .filter(Boolean)
    .join(' · ');

  // An HPC has no marks, so the badge counts what it actually designs.
  const size =
    blueprint.kind === 'hpc'
      ? `${countHpcCompetencies(blueprint)} competencies`
      : `${trimNumber(blueprint.total_marks)} marks`;

  return (
    <div
      className={`group flex items-start gap-2 rounded-[12px] border px-3 py-2.5 transition ${
        active ? 'border-[#5846EA] bg-[#F5F4FF]' : 'border-[#E4E9F2] bg-white hover:border-[#C3CDE0]'
      }`}
    >
      <button type="button" onClick={onSelect} className="min-w-0 flex-1 text-left">
        <span className="flex items-start gap-2 text-[13px] font-semibold text-[#172554]">
          <BookOpen size={14} className="mt-0.5 shrink-0 text-[#5846EA]" />
          <span className="min-w-0 break-words">{blueprint.name}</span>
        </span>
        {facets ? <span className="mt-0.5 block text-[11.5px] text-[#7A889D]">{facets}</span> : null}
        <span className="mt-1 flex flex-wrap items-center gap-1.5">
          <span className="rounded-full border border-[#E4E9F2] bg-[#F8FAFC] px-2 py-0.5 text-[10.5px] font-semibold text-[#334155]">
            {size}
          </span>
          {blueprint.is_preset ? (
            <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10.5px] font-semibold text-indigo-700">
              Reference
            </span>
          ) : (
            <span className="text-[11px] text-[#98A4B6]">{blueprint.status}</span>
          )}
        </span>
      </button>

      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          className="shrink-0 rounded-[8px] p-1 text-[#98A4B6] opacity-0 transition hover:bg-red-50 hover:text-[#B91C1C] group-hover:opacity-100"
          aria-label="Remove blueprint"
        >
          <Trash2 size={14} />
        </button>
      ) : null}
    </div>
  );
}

/**
 * A published design, read-only.
 *
 * Shows the source link prominently on purpose: a school is being asked to
 * build its papers on these numbers, so it should be one click from checking
 * them against the document they were taken from.
 */
function PresetPreview({
  blueprint,
  busy,
  onUse,
}: {
  blueprint: RegularBlueprint;
  busy: boolean;
  onUse: () => void;
}) {
  const definition = blueprint.definition;
  const marks = totalSectionMarks(definition.sections);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-[18px] border border-[#E4E9F2] bg-white px-4 py-3.5">
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold text-[#172554]">{blueprint.name}</h3>
          <p className="mt-0.5 max-w-2xl text-[12.5px] leading-5 text-[#5F7087]">
            {blueprint.description}
          </p>
          {blueprint.source_url ? (
            <a
              href={blueprint.source_url}
              target="_blank"
              rel="noreferrer"
              className="mt-1.5 inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#5846EA] hover:underline"
            >
              <ExternalLink size={13} /> {blueprint.source}
            </a>
          ) : null}
        </div>

        <button
          type="button"
          onClick={onUse}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-[10px] bg-[#5846EA] px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-[#4738CE] disabled:opacity-50"
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Copy size={16} />}
          Use this blueprint
        </button>
      </div>

      <div className="rounded-[18px] border border-[#E4E9F2] bg-white p-4">
        <div className="flex flex-wrap gap-2">
          <Stat label="Total marks" value={trimNumber(blueprint.total_marks)} />
          <Stat label="Written paper" value={trimNumber(marks)} />
          <Stat
            label="Questions"
            value={String(
              definition.sections.reduce(
                (sum, section) => sum + section.rows.reduce((rows, row) => rows + row.count, 0),
                0
              )
            )}
          />
          {definition.internal_choice_pct > 0 ? (
            <Stat label="Internal choice" value={`${trimNumber(definition.internal_choice_pct)}%`} />
          ) : null}
          {blueprint.duration_minutes ? (
            <Stat label="Duration" value={`${blueprint.duration_minutes} min`} />
          ) : null}
        </div>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left">
            <thead>
              <tr className="border-b border-[#EEF1F6] text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[#7A889D]">
                <th className="px-3 py-2">Section</th>
                <th className="px-3 py-2">Type of questions</th>
                <th className="px-3 py-2 text-right">Questions</th>
                <th className="px-3 py-2 text-right">Marks each</th>
                <th className="px-3 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {definition.sections.map((section) =>
                section.rows.map((row, rowIndex) => (
                  <tr key={row.id} className="border-b border-[#F3F5F9] text-[12.5px] last:border-b-0">
                    <td className="px-3 py-2 align-top font-semibold text-[#172554]">
                      {rowIndex === 0 ? (
                        <>
                          {section.name}
                          {section.note ? (
                            <span className="mt-0.5 block text-[11.5px] font-normal text-[#7A889D]">
                              {section.note}
                            </span>
                          ) : null}
                        </>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-[#334155]">
                      {row.label || row.question_type}
                      {row.question_numbers ? (
                        <span className="ml-1.5 text-[11.5px] text-[#98A4B6]">Q{row.question_numbers}</span>
                      ) : null}
                      {row.note ? (
                        <span className="mt-0.5 block text-[11.5px] text-[#7A889D]">{row.note}</span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-right text-[#334155]">
                      {row.count}
                      {row.subparts > 0 ? (
                        <span className="text-[11.5px] text-[#98A4B6]"> ({row.subparts} parts)</span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-right text-[#334155]">{trimNumber(row.marks_each)}</td>
                    <td className="px-3 py-2 text-right font-semibold text-[#172554]">
                      {trimNumber(row.total_marks)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {definition.content_weightage.length > 0 || definition.competency_distribution.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {definition.content_weightage.length > 0 ? (
            <WeightCard
              title="Content weightage"
              rows={definition.content_weightage.map((area) => ({
                key: area.id,
                label: area.name,
                value: `${trimNumber(area.marks)} marks`,
                note: area.note,
              }))}
            />
          ) : null}

          {definition.competency_distribution.length > 0 ? (
            <WeightCard
              title="Competency weightage"
              rows={definition.competency_distribution.map((band) => ({
                key: band.id,
                label: band.label,
                value: `${trimNumber(band.weight_pct)}%`,
                note: '',
              }))}
            />
          ) : null}
        </div>
      ) : null}

      {definition.notes ? (
        <div className="rounded-[18px] border border-[#E4E9F2] bg-white p-4">
          <h4 className="text-[14px] font-semibold text-[#172554]">Notes</h4>
          <p className="mt-1.5 whitespace-pre-line text-[12.5px] leading-6 text-[#5F7087]">
            {definition.notes}
          </p>
        </div>
      ) : null}
    </div>
  );
}

/** Competencies across every area — the real size of an HPC design. */
function countHpcCompetencies(blueprint: HpcBlueprintRow): number {
  return blueprint.definition.areas.reduce(
    (total, area) =>
      total + area.curricular_goals.reduce((goals, goal) => goals + goal.competencies.length, 0),
    0
  );
}

/**
 * A published HPC design, read-only.
 *
 * Shows the proficiency scale WITH its descriptors rather than just the level
 * names, because on a card with no marks the descriptor is the entire meaning
 * of a judgement — "Proficient" on its own says nothing a parent can act on.
 */
function HpcPresetPreview({
  blueprint,
  busy,
  onUse,
}: {
  blueprint: HpcBlueprintRow;
  busy: boolean;
  onUse: () => void;
}) {
  const definition = blueprint.definition;
  const goals = definition.areas.reduce((total, area) => total + area.curricular_goals.length, 0);
  const areaNoun = definition.stage === 'Foundational' || definition.stage === 'Preparatory'
    ? 'Development domains'
    : 'Curricular areas';

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-[18px] border border-[#E4E9F2] bg-white px-4 py-3.5">
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold text-[#172554]">{blueprint.name}</h3>
          <p className="mt-0.5 max-w-2xl text-[12.5px] leading-5 text-[#5F7087]">
            {blueprint.description}
          </p>
          {blueprint.source_url ? (
            <a
              href={blueprint.source_url}
              target="_blank"
              rel="noreferrer"
              className="mt-1.5 inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#5846EA] hover:underline"
            >
              <ExternalLink size={13} /> {blueprint.source}
            </a>
          ) : null}
        </div>

        <button
          type="button"
          onClick={onUse}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-[10px] bg-[#5846EA] px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-[#4738CE] disabled:opacity-50"
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Copy size={16} />}
          Use this blueprint
        </button>
      </div>

      <div className="rounded-[18px] border border-[#E4E9F2] bg-white p-4">
        <div className="flex flex-wrap gap-2">
          <Stat label="Stage" value={definition.stage} />
          <Stat label={areaNoun} value={String(definition.areas.length)} />
          <Stat label="Curricular goals" value={String(goals)} />
          <Stat label="Competencies" value={String(countHpcCompetencies(blueprint))} />
          <Stat label="Marks" value="None" />
        </div>

        <h4 className="mt-4 text-[13px] font-semibold text-[#172554]">Proficiency scale</h4>
        <div className="mt-1.5 flex flex-col gap-1.5">
          {definition.proficiency_scale.map((level) => (
            <div
              key={level.code}
              className="rounded-[12px] border border-[#E4E9F2] bg-[#FAFBFE] px-3 py-2 text-[12.5px]"
            >
              <span className="font-semibold text-[#172554]">{level.label}</span>
              {level.descriptor ? (
                <span className="mt-0.5 block leading-5 text-[#5F7087]">{level.descriptor}</span>
              ) : null}
            </div>
          ))}
        </div>

        <h4 className="mt-4 text-[13px] font-semibold text-[#172554]">{areaNoun}</h4>
        <div className="mt-1.5 flex flex-col gap-1.5">
          {definition.areas.map((area) => (
            <div
              key={area.id}
              className="flex flex-wrap items-start justify-between gap-2 rounded-[12px] border border-[#E4E9F2] px-3 py-2 text-[12.5px]"
            >
              <span className="min-w-0 text-[#334155]">
                {area.name}
                {area.note ? (
                  <span className="mt-0.5 block text-[11.5px] leading-5 text-[#98A4B6]">{area.note}</span>
                ) : null}
              </span>
              <span className="shrink-0 text-[11.5px] font-semibold text-[#7A889D]">
                {area.curricular_goals.length} goals
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <ChipCard
          title="Who assesses"
          items={definition.assessors.map((code) => ASSESSOR_LABELS[code] ?? code)}
        />
        {definition.abilities.length > 0 ? (
          <ChipCard title="Abilities per activity" items={definition.abilities.map((a) => a.label)} />
        ) : null}
      </div>

      {definition.notes ? (
        <div className="rounded-[18px] border border-[#E4E9F2] bg-white p-4">
          <h4 className="text-[14px] font-semibold text-[#172554]">Notes</h4>
          <p className="mt-1.5 whitespace-pre-line text-[12.5px] leading-6 text-[#5F7087]">
            {definition.notes}
          </p>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Assessor codes read back as words.
 *
 * A small local map rather than a lookup into `options.hpc.assessors`, because
 * the preview renders before a school has an options payload of its own and
 * "self" on a card is not a label anybody should have to decode.
 */
const ASSESSOR_LABELS: Record<string, string> = {
  self: 'Student (self-reflection)',
  peer: 'Peer',
  teacher: 'Teacher',
  parent: 'Parent / caregiver',
};

function ChipCard({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;

  return (
    <div className="rounded-[18px] border border-[#E4E9F2] bg-white p-4">
      <h4 className="text-[14px] font-semibold text-[#172554]">{title}</h4>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {items.map((item) => (
          <span
            key={item}
            className="rounded-full border border-[#E4E9F2] bg-[#F8FAFC] px-3 py-1 text-[12px] font-semibold text-[#334155]"
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function WeightCard({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ key: string; label: string; value: string; note: string }>;
}) {
  return (
    <div className="rounded-[18px] border border-[#E4E9F2] bg-white p-4">
      <h4 className="text-[14px] font-semibold text-[#172554]">{title}</h4>
      <div className="mt-2 flex flex-col gap-1.5">
        {rows.map((row) => (
          <div key={row.key} className="flex items-start justify-between gap-3 text-[12.5px]">
            <span className="min-w-0 text-[#334155]">
              {row.label}
              {row.note ? (
                <span className="mt-0.5 block text-[11.5px] text-[#98A4B6]">{row.note}</span>
              ) : null}
            </span>
            <span className="shrink-0 font-semibold text-[#172554]">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <span className="rounded-[10px] border border-[#E4E9F2] bg-[#F8FAFC] px-3 py-1.5 text-center">
      <span className="block text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[#7A889D]">
        {label}
      </span>
      <span className="block text-[13px] font-semibold text-[#172554]">{value}</span>
    </span>
  );
}

export { sectionMarks };
