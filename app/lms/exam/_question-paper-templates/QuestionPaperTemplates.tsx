'use client';

// ---------------------------------------------------------------------------
// LMS > Exam > Question paper templates.
//
// Pick a layout, pick an exam, and the paper assembles itself: the school's own
// name and logo come from the signed-in session, the standard, subject, timing
// and questions come from the selected question paper, and the marks are summed
// from the questions the template placed. Nothing on the printed sheet is typed
// in here, which is what makes one template work for every school.
//
// The three built-in examples are starting points, not a menu — using one
// copies it into the school, where every part of it can be changed.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Copy,
  FileDown,
  FileText,
  Layers,
  Loader2,
  Pencil,
  Plus,
  Printer,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import QuestionPaperSheet from './QuestionPaperSheet';
import TemplateEditor from './TemplateEditor';
import { splitSectionsByContent } from '@/lib/question-paper/sections';
import { generateQuestionPaperPdf } from './pdf';
import { formatMarks, resolvePaper } from './resolve';
import {
  deleteTemplate,
  fetchExamPapers,
  fetchPaperContext,
  fetchTemplateIndex,
  readSchoolBranding,
  saveTemplate,
  type ExamPaperOption,
} from './api';
import type { Blueprint, PaperContext, QuestionPaperTemplate, TemplateIndex } from './types';

type Draft = {
  id: number | null;
  presetKey: string | null;
  name: string;
  description: string;
  blueprint: Blueprint;
};

/** Stable key for the list, since a preset has no id until it is saved. */
function templateKey(template: QuestionPaperTemplate): string {
  return template.is_preset ? `preset:${template.preset_key}` : `template:${template.id}`;
}

function toDraft(template: QuestionPaperTemplate): Draft {
  return {
    // A preset has no row of its own, so saving it writes the school a new
    // template rather than editing anything shared.
    id: template.is_preset ? null : template.id,
    presetKey: template.preset_key,
    name: template.name,
    description: template.description,
    blueprint: template.blueprint,
  };
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error) return error;
  return fallback;
}

export default function QuestionPaperTemplates() {
  const [index, setIndex] = useState<TemplateIndex | null>(null);
  const [indexError, setIndexError] = useState('');
  const [indexLoading, setIndexLoading] = useState(true);

  const [selectedKey, setSelectedKey] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [saveError, setSaveError] = useState('');
  const [pdfBusy, setPdfBusy] = useState(false);

  const [papers, setPapers] = useState<ExamPaperOption[]>([]);
  const [papersError, setPapersError] = useState('');
  const [papersLoading, setPapersLoading] = useState(true);
  const [paperSearch, setPaperSearch] = useState('');
  const [selectedPaperId, setSelectedPaperId] = useState('');

  const [paperContext, setPaperContext] = useState<PaperContext | null>(null);
  const [paperLoading, setPaperLoading] = useState(false);
  const [paperError, setPaperError] = useState('');

  const loadIndex = useCallback(async (keepSelection = false) => {
    setIndexLoading(true);
    setIndexError('');

    try {
      const data = await fetchTemplateIndex();
      setIndex(data);

      if (!keepSelection) {
        const first = data.templates[0] ?? data.presets[0];

        if (first) {
          setSelectedKey(templateKey(first));
          setDraft(toDraft(first));
        }
      }
    } catch (error) {
      setIndexError(errorMessage(error, 'Unable to load question paper templates.'));
    } finally {
      setIndexLoading(false);
    }
  }, []);

  // queueMicrotask keeps the first synchronous setState out of the effect
  // body, which is how the rest of this module kicks off its loads.
  useEffect(() => {
    queueMicrotask(() => void loadIndex());
  }, [loadIndex]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setPapersLoading(true);
      setPapersError('');

      try {
        const rows = await fetchExamPapers();
        if (cancelled) return;
        setPapers(rows);
      } catch (error) {
        if (cancelled) return;
        setPapersError(errorMessage(error, 'Unable to load exams.'));
      } finally {
        if (!cancelled) setPapersLoading(false);
      }
    };

    queueMicrotask(() => void load());

    return () => {
      cancelled = true;
    };
  }, []);

  // Pull the questions whenever the chosen exam changes. The template can then
  // be re-shaped freely without re-fetching -- placement is pure client work.
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!selectedPaperId) {
        setPaperContext(null);
        setPaperError('');
        return;
      }

      setPaperLoading(true);
      setPaperError('');

      try {
        const context = await fetchPaperContext(Number(selectedPaperId));
        if (cancelled) return;
        setPaperContext(context);
      } catch (error) {
        if (cancelled) return;
        setPaperContext(null);
        setPaperError(errorMessage(error, 'Unable to load the question paper.'));
      } finally {
        if (!cancelled) setPaperLoading(false);
      }
    };

    queueMicrotask(() => void load());

    return () => {
      cancelled = true;
    };
  }, [selectedPaperId]);

  const selectTemplate = (template: QuestionPaperTemplate) => {
    setSelectedKey(templateKey(template));
    setDraft(toDraft(template));
    setEditing(false);
    setSaveError('');
    setNotice('');
  };

  const filteredPapers = useMemo(() => {
    const term = paperSearch.trim().toLowerCase();

    if (!term) return papers;

    return papers.filter((paper) =>
      [paper.paperName, paper.subjectName, paper.standardName, paper.examType]
        .join(' ')
        .toLowerCase()
        .includes(term)
    );
  }, [papers, paperSearch]);

  const resolved = useMemo(() => {
    if (!draft || !paperContext) return null;

    // Read the school here rather than into state: nothing renders before an
    // exam is chosen, so there is no server/client mismatch to hydrate, and
    // the branding always reflects the session as it stands now.
    return resolvePaper(draft.blueprint, paperContext, readSchoolBranding());
  }, [draft, paperContext]);

  const handleSave = async (asCopy: boolean) => {
    if (!draft) return;

    const name = draft.name.trim();

    if (!name) {
      setSaveError('Give the template a name before saving.');
      return;
    }

    setSaving(true);
    setSaveError('');
    setNotice('');

    try {
      const saved = await saveTemplate({
        id: asCopy ? null : draft.id,
        name,
        description: draft.description.trim(),
        presetKey: draft.presetKey,
        blueprint: draft.blueprint,
      });

      await loadIndex(true);
      setSelectedKey(templateKey(saved));
      setDraft(toDraft(saved));
      setEditing(false);
      setNotice(asCopy || !draft.id ? 'Template saved to your school.' : 'Template updated.');
    } catch (error) {
      setSaveError(errorMessage(error, 'Unable to save the template.'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (template: QuestionPaperTemplate) => {
    if (template.is_preset || !template.id) return;

    const confirmed = window.confirm(
      `Remove "${template.name}"? Papers already printed from it are unaffected.`
    );

    if (!confirmed) return;

    try {
      await deleteTemplate(template.id);
      setNotice('Template removed.');

      if (selectedKey === templateKey(template)) {
        setSelectedKey('');
        setDraft(null);
      }

      await loadIndex(true);
    } catch (error) {
      setSaveError(errorMessage(error, 'Unable to remove the template.'));
    }
  };

  // The same rule the sheet prints by, so the notice and the paper agree.
  const emptySections = useMemo(
    () => (resolved ? splitSectionsByContent(resolved.sections).empty : []),
    [resolved]
  );

  const handleDownloadPdf = async () => {
    if (!draft || !paperContext) return;

    setPdfBusy(true);
    setSaveError('');

    try {
      await generateQuestionPaperPdf({
        blueprint: draft.blueprint,
        context: paperContext,
        branding: readSchoolBranding(),
        fileName: paperContext.paper.paper_name || draft.name,
      });
    } catch (error) {
      setSaveError(errorMessage(error, 'Unable to generate the PDF.'));
    } finally {
      setPdfBusy(false);
    }
  };

  const startBlank = () => {
    if (!index) return;

    setSelectedKey('');
    setDraft({
      id: null,
      presetKey: null,
      name: '',
      description: '',
      blueprint: index.options.defaults,
    });
    setEditing(true);
    setNotice('');
    setSaveError('');
  };

  const page = draft?.blueprint.page;

  return (
    <div className="flex flex-col gap-4">
      <style jsx global>{`
        @media print {
          @page {
            size: ${page?.size ?? 'A4'} ${page?.orientation ?? 'portrait'};
            margin: ${page?.margin ?? '16mm'};
          }

          /* Class selectors outrank the page-level \`body *\` reset, so the
             sheet stays visible whichever stylesheet the browser applies
             first, and the surrounding app does not print. */
          .question-paper-sheet,
          .question-paper-sheet * {
            visibility: visible !important;
          }

          .question-paper-sheet {
            position: absolute !important;
            inset: 0 !important;
            width: 100% !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: 0 !important;
            border-radius: 0 !important;
            background: #fff !important;
          }

          .question-paper-sheet .question-block,
          .question-paper-sheet tr {
            break-inside: avoid;
            page-break-inside: avoid;
          }
        }
      `}</style>

      <div className="no-print flex flex-col gap-1">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[18px] font-semibold text-[#172554]">Question paper templates</h2>
            <p className="mt-1 max-w-3xl text-[13px] leading-6 text-[#5B6B82]">
              Reusable layouts for printed papers. Choose a template and an exam — the school name,
              logo, standard, subject, timing, questions and marks are filled in from your existing
              exam data.
            </p>
          </div>

          <button
            type="button"
            onClick={startBlank}
            disabled={!index}
            className="inline-flex items-center gap-2 rounded-[10px] bg-[#5846EA] px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-[#4738CE] disabled:opacity-50"
          >
            <Plus size={16} />
            New template
          </button>
        </div>
      </div>

      {indexError ? (
        <div className="no-print rounded-[14px] border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-[#B91C1C]">
          {indexError}
        </div>
      ) : null}

      {notice ? (
        <div className="no-print rounded-[14px] border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[13px] text-[#047857]">
          {notice}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
        {/* ---- Template list ------------------------------------------- */}
        <aside className="no-print flex flex-col gap-3 rounded-[18px] border border-[#E4E9F2] bg-white p-3">
          {indexLoading ? (
            <p className="flex items-center gap-2 px-2 py-6 text-[13px] text-[#5F7087]">
              <Loader2 size={15} className="animate-spin" /> Loading templates…
            </p>
          ) : (
            <>
              <p className="px-2 pt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7A889D]">
                Your school&apos;s templates
              </p>

              {(index?.templates.length ?? 0) === 0 ? (
                <p className="px-2 pb-1 text-[12px] leading-5 text-[#7A889D]">
                  None yet. Start from an example below, or build one from scratch.
                </p>
              ) : (
                index?.templates.map((template) => (
                  <div
                    key={templateKey(template)}
                    className={`group flex items-start gap-2 rounded-[12px] border px-3 py-2.5 transition ${
                      selectedKey === templateKey(template)
                        ? 'border-[#5846EA] bg-[#F5F4FF]'
                        : 'border-[#E4E9F2] bg-white hover:border-[#C3CDE0]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => selectTemplate(template)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <span className="flex items-center gap-2 text-[13px] font-semibold text-[#172554]">
                        <Layers size={14} className="shrink-0 text-[#5846EA]" />
                        <span className="truncate">{template.name}</span>
                      </span>
                      {template.description ? (
                        <span className="mt-0.5 block text-[12px] leading-5 text-[#5F7087]">
                          {template.description}
                        </span>
                      ) : null}
                      <span className="mt-1 block text-[11px] text-[#94A3B8]">
                        {template.blueprint.sections.length}{' '}
                        {template.blueprint.sections.length === 1 ? 'section' : 'sections'}
                      </span>
                    </button>

                    <button
                      type="button"
                      aria-label={`Remove ${template.name}`}
                      onClick={() => handleDelete(template)}
                      className="shrink-0 rounded-[8px] p-1.5 text-[#B6C0D0] hover:text-[#DC2626]"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              )}

              <p className="mt-2 px-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7A889D]">
                Examples to start from
              </p>

              {index?.presets.map((preset) => (
                <button
                  key={templateKey(preset)}
                  type="button"
                  onClick={() => selectTemplate(preset)}
                  className={`rounded-[12px] border px-3 py-2.5 text-left transition ${
                    selectedKey === templateKey(preset)
                      ? 'border-[#5846EA] bg-[#F5F4FF]'
                      : 'border-dashed border-[#D9E3F0] bg-[#FBFCFE] hover:border-[#B9C6DC]'
                  }`}
                >
                  <span className="flex items-center gap-2 text-[13px] font-semibold text-[#172554]">
                    <FileText size={14} className="shrink-0 text-[#7A889D]" />
                    <span className="truncate">{preset.name}</span>
                  </span>
                  <span className="mt-0.5 block text-[12px] leading-5 text-[#5F7087]">
                    {preset.description}
                  </span>
                </button>
              ))}
            </>
          )}
        </aside>

        {/* ---- Working area -------------------------------------------- */}
        <div className="flex min-w-0 flex-col gap-4">
          <div className="no-print rounded-[18px] border border-[#E4E9F2] bg-white p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-end">
                <label className="flex flex-1 flex-col gap-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-[#5F7087]">
                    Search exams
                  </span>
                  <input
                    value={paperSearch}
                    onChange={(event) => setPaperSearch(event.target.value)}
                    placeholder="Name, subject or standard"
                    className="h-10 w-full rounded-[10px] border border-[#CFD9E6] bg-white px-3.5 text-[14px] text-[#172554] outline-none placeholder:text-[#94A3B8] focus:border-[#7C6CF4]"
                  />
                </label>

                <label className="flex flex-1 flex-col gap-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-[#5F7087]">
                    Exam
                  </span>
                  <select
                    value={selectedPaperId}
                    onChange={(event) => setSelectedPaperId(event.target.value)}
                    disabled={papersLoading}
                    className="h-10 w-full appearance-none rounded-[10px] border border-[#CFD9E6] bg-white px-3.5 text-[14px] text-[#24324A] outline-none focus:border-[#7C6CF4] disabled:opacity-60"
                  >
                    <option value="">
                      {papersLoading ? 'Loading exams…' : 'Select an exam to populate'}
                    </option>
                    {filteredPapers.map((paper) => (
                      <option key={paper.id} value={paper.id}>
                        {paper.paperName}
                        {paper.subjectName ? ` — ${paper.subjectName}` : ''}
                        {paper.standardName ? ` (${paper.standardName})` : ''}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditing((value) => !value)}
                  disabled={!draft}
                  className="inline-flex items-center gap-2 rounded-[10px] border border-[#CFD9E6] bg-white px-4 py-2.5 text-[13px] font-semibold text-[#334155] transition hover:border-[#B9C6DC] disabled:opacity-50"
                >
                  {editing ? <X size={15} /> : <Pencil size={15} />}
                  {editing ? 'Close editor' : 'Customise'}
                </button>

                <button
                  type="button"
                  onClick={() => window.print()}
                  disabled={!resolved}
                  className="inline-flex items-center gap-2 rounded-[10px] border border-[#CFD9E6] bg-white px-4 py-2.5 text-[13px] font-semibold text-[#334155] transition hover:border-[#B9C6DC] disabled:opacity-50"
                >
                  <Printer size={15} />
                  Print
                </button>

                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  disabled={!resolved || pdfBusy}
                  className="inline-flex items-center gap-2 rounded-[10px] bg-[#5846EA] px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-[#4738CE] disabled:opacity-50"
                >
                  {pdfBusy ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <FileDown size={15} />
                  )}
                  PDF
                </button>
              </div>
            </div>

            {papersError ? (
              <p className="mt-3 rounded-[10px] border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-[#B91C1C]">
                {papersError}
              </p>
            ) : null}

            {!papersLoading && !papersError && papers.length === 0 ? (
              <p className="mt-3 text-[12px] text-[#7A889D]">
                No exams found for this academic year yet. Create one on the Exams tab and it will
                appear here.
              </p>
            ) : null}
          </div>

          {editing && draft && index ? (
            <div className="no-print rounded-[18px] border border-[#E4E9F2] bg-white p-4">
              <TemplateEditor
                name={draft.name}
                description={draft.description}
                blueprint={draft.blueprint}
                options={index.options}
                onNameChange={(name) => setDraft({ ...draft, name })}
                onDescriptionChange={(description) => setDraft({ ...draft, description })}
                onBlueprintChange={(blueprint) => setDraft({ ...draft, blueprint })}
              />

              {saveError ? (
                <p className="mt-4 rounded-[10px] border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-[#B91C1C]">
                  {saveError}
                </p>
              ) : null}

              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[#EEF1F6] pt-4">
                <button
                  type="button"
                  onClick={() => handleSave(false)}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-[10px] bg-[#5846EA] px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-[#4738CE] disabled:opacity-50"
                >
                  {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                  {draft.id ? 'Save changes' : 'Save to my school'}
                </button>

                {draft.id ? (
                  <button
                    type="button"
                    onClick={() => handleSave(true)}
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-[10px] border border-[#CFD9E6] bg-white px-4 py-2.5 text-[13px] font-semibold text-[#334155] disabled:opacity-50"
                  >
                    <Copy size={15} />
                    Save as a copy
                  </button>
                ) : null}

                <p className="text-[12px] text-[#7A889D]">
                  Examples are never changed — saving always writes a template of your own.
                </p>
              </div>
            </div>
          ) : null}

          {/* ---- Preview ---------------------------------------------- */}
          <div className="rounded-[18px] border border-[#E4E9F2] bg-[#F7F9FC] p-4 print:border-0 print:bg-white print:p-0">
            {!draft ? (
              <p className="no-print py-12 text-center text-[13px] text-[#5F7087]">
                Choose a template on the left to begin.
              </p>
            ) : paperLoading ? (
              <p className="no-print flex items-center justify-center gap-2 py-12 text-[13px] text-[#5F7087]">
                <Loader2 size={15} className="animate-spin" /> Loading the question paper…
              </p>
            ) : paperError ? (
              <p className="no-print rounded-[10px] border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-[#B91C1C]">
                {paperError}
              </p>
            ) : !resolved ? (
              <p className="no-print py-12 text-center text-[13px] text-[#5F7087]">
                Select an exam above to see <strong>{draft.name || 'this template'}</strong> filled
                in with its questions and marks.
              </p>
            ) : (
              <>
                <div className="no-print mb-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-[12px] text-[#5F7087]">
                  <span>
                    <strong className="text-[#172554]">{resolved.totalQuestions}</strong> questions
                    placed
                  </span>
                  <span>
                    <strong className="text-[#172554]">{formatMarks(resolved.totalMarks)}</strong>{' '}
                    total marks
                  </span>
                  <span>
                    {resolved.sections.length}{' '}
                    {resolved.sections.length === 1 ? 'section' : 'sections'}
                  </span>
                </div>

                {emptySections.length > 0 ? (
                  <div className="no-print mb-3 flex items-start gap-2 rounded-[12px] border border-[#D8E5FF] bg-[#F5F8FF] px-4 py-3 text-[12px] leading-5 text-[#3C4E86]">
                    <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                    <span>
                      No question matched{' '}
                      {emptySections
                        .map((section) => `“${section.title || section.section.id}”`)
                        .join(', ')}
                      , so {emptySections.length === 1 ? 'that section is' : 'those sections are'}{' '}
                      left off the paper entirely — no empty heading is printed.
                    </span>
                  </div>
                ) : null}

                {resolved.unplaced.length > 0 ? (
                  <div className="no-print mb-3 flex items-start gap-2 rounded-[12px] border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] leading-5 text-[#92400E]">
                    <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                    <span>
                      {resolved.unplaced.length}{' '}
                      {resolved.unplaced.length === 1 ? 'question in this exam was' : 'questions in this exam were'}{' '}
                      not claimed by any section, so {resolved.unplaced.length === 1 ? 'it is' : 'they are'}{' '}
                      not on the paper. Add a section that takes “everything not yet placed”, or
                      widen a section&apos;s rule.
                    </span>
                  </div>
                ) : null}

                <div className="overflow-x-auto">
                  <div
                    className="mx-auto w-full max-w-[820px] bg-white p-8 shadow-[0_2px_10px_rgba(15,23,42,0.06)] print:max-w-none print:p-0 print:shadow-none"
                  >
                    <QuestionPaperSheet paper={resolved} page={draft.blueprint.page} />
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
