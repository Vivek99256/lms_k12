'use client';

// ---------------------------------------------------------------------------
// LMS > Exam > Exam Evaluation.
//
// Scan a class set of answer sheets, let them be read and scored against the
// paper's own marking key, then go through them. It handles both shapes of
// paper the module produces:
//
//   - an OMR/MCQ sheet, where an answer is a darkened bubble, checked against
//     `answer_master` in PHP — deterministic, instant, and safe to total; and
//   - a written answer book, where an answer is a paragraph, graded against
//     the model answer the teacher saved on the question.
//
// The one rule this screen is built around: the AI proposes, a teacher
// disposes. Every number on a sheet is a proposal until somebody approves it,
// and Publish — the only thing here that writes to the gradebook — reads
// approved teacher marks and nothing else.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  FileUp,
  Loader2,
  Plus,
  RefreshCw,
  ScanLine,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import SheetReviewPanel from './SheetReviewPanel';
import {
  createBatch,
  deleteBatch,
  deleteSheet,
  fetchAnswerKey,
  fetchBatch,
  fetchBatches,
  fetchExamPapers,
  publishBatch,
  reprocessSheet,
  uploadSheets,
  type ExamPaperOption,
} from './api';
import type { AnswerKeySummary, BatchDetail, EvaluationBatch, EvaluationSheet, SheetStatus } from './types';

/** While any sheet is still being read, the table refreshes itself. */
const POLL_INTERVAL_MS = 4000;
const IN_FLIGHT: SheetStatus[] = ['Pending', 'Processing'];

const SHEET_STATUS_STYLES: Record<SheetStatus, string> = {
  Pending: 'bg-slate-100 text-slate-600 border-slate-200',
  Processing: 'bg-sky-50 text-sky-700 border-sky-200',
  Evaluated: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  'Needs review': 'bg-amber-50 text-amber-700 border-amber-200',
  Approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Failed: 'bg-red-50 text-red-700 border-red-200',
};

const BATCH_STATUS_STYLES: Record<string, string> = {
  Draft: 'bg-slate-100 text-slate-600 border-slate-200',
  Processing: 'bg-sky-50 text-sky-700 border-sky-200',
  Review: 'bg-amber-50 text-amber-700 border-amber-200',
  Published: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

const ACCEPTED_TYPES = 'application/pdf,image/jpeg,image/png';

function formatMarks(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';

  return String(Math.round(value * 100) / 100);
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export default function ExamEvaluation() {
  const [batches, setBatches] = useState<EvaluationBatch[]>([]);
  const [batchesLoading, setBatchesLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<BatchDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [reviewSheetId, setReviewSheetId] = useState<number | null>(null);

  // -- New evaluation ------------------------------------------------------
  const [creating, setCreating] = useState(false);
  const [papers, setPapers] = useState<ExamPaperOption[]>([]);
  const [papersLoading, setPapersLoading] = useState(false);
  const [paperSearch, setPaperSearch] = useState('');
  const [paperId, setPaperId] = useState<number | null>(null);
  const [batchName, setBatchName] = useState('');
  const [answerKey, setAnswerKey] = useState<AnswerKeySummary | null>(null);
  const [answerKeyError, setAnswerKeyError] = useState('');
  const [answerKeyLoading, setAnswerKeyLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadBatches = useCallback(async () => {
    setBatchesLoading(true);

    try {
      setBatches(await fetchBatches());
    } catch (loadError) {
      setError(errorMessage(loadError, 'Unable to load evaluations.'));
    } finally {
      setBatchesLoading(false);
    }
  }, []);

  const loadDetail = useCallback(async (batchId: number, quiet = false) => {
    if (!quiet) {
      setDetailLoading(true);
    }

    try {
      setDetail(await fetchBatch(batchId));
    } catch (loadError) {
      if (!quiet) {
        setError(errorMessage(loadError, 'Unable to load this evaluation.'));
      }
    } finally {
      if (!quiet) {
        setDetailLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadBatches();
  }, [loadBatches]);

  useEffect(() => {
    if (selectedId === null) {
      setDetail(null);

      return;
    }

    void loadDetail(selectedId);
  }, [loadDetail, selectedId]);

  const pendingCount = useMemo(
    () => (detail?.sheets ?? []).filter((sheet) => IN_FLIGHT.includes(sheet.status)).length,
    [detail]
  );

  // A sheet left in Pending/Processing is one the queue has not finished with,
  // so the table polls until the batch settles — and stops the moment it does,
  // rather than running a timer for the life of the tab.
  useEffect(() => {
    if (selectedId === null || pendingCount === 0) {
      return;
    }

    const timer = window.setInterval(() => {
      void loadDetail(selectedId, true);
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [loadDetail, pendingCount, selectedId]);

  // -- New evaluation ------------------------------------------------------

  const startCreating = useCallback(async () => {
    setCreating(true);
    setSelectedId(null);
    setPaperId(null);
    setAnswerKey(null);
    setAnswerKeyError('');
    setBatchName('');
    setError('');

    if (papers.length > 0) {
      return;
    }

    setPapersLoading(true);

    try {
      setPapers(await fetchExamPapers());
    } catch (loadError) {
      setError(errorMessage(loadError, 'Unable to load your exams.'));
    } finally {
      setPapersLoading(false);
    }
  }, [papers.length]);

  useEffect(() => {
    if (paperId === null) {
      setAnswerKey(null);

      return;
    }

    let cancelled = false;

    setAnswerKeyLoading(true);
    setAnswerKeyError('');

    fetchAnswerKey(paperId)
      .then((key) => {
        if (cancelled) return;

        setAnswerKey(key);
        setBatchName((current) =>
          current.trim() === ''
            ? [key.paper.paper_name, key.paper.standard_name, key.paper.grade_name]
                .filter(Boolean)
                .join(' — ')
            : current
        );
      })
      .catch((keyError: unknown) => {
        if (cancelled) return;

        setAnswerKey(null);
        setAnswerKeyError(errorMessage(keyError, 'This paper could not be read as a marking key.'));
      })
      .finally(() => {
        if (!cancelled) {
          setAnswerKeyLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [paperId]);

  const filteredPapers = useMemo(() => {
    const needle = paperSearch.trim().toLowerCase();

    if (needle === '') return papers;

    return papers.filter((paper) =>
      [paper.paperName, paper.subjectName, paper.standardName, paper.gradeName]
        .join(' ')
        .toLowerCase()
        .includes(needle)
    );
  }, [paperSearch, papers]);

  const create = useCallback(async () => {
    if (paperId === null) return;

    setBusy(true);
    setError('');

    try {
      const created = await createBatch(paperId, batchName.trim());

      setDetail(created);
      setSelectedId(created.batch.id);
      setCreating(false);
      setNotice('Evaluation started. Upload the scanned answer sheets to begin.');
      await loadBatches();
    } catch (createError) {
      setError(errorMessage(createError, 'Unable to start this evaluation.'));
    } finally {
      setBusy(false);
    }
  }, [batchName, loadBatches, paperId]);

  // -- Sheets --------------------------------------------------------------

  const upload = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0 || selectedId === null) return;

      setBusy(true);
      setError('');
      setNotice('');

      try {
        const next = await uploadSheets(selectedId, Array.from(files));

        setDetail(next);
        await loadBatches();

        const rejected = next.rejected ?? [];

        if (rejected.length > 0) {
          setError(
            `${rejected.length} file(s) could not be used: ` +
              rejected.map((row) => `${row.file} — ${row.reason}`).join('; ')
          );
        }

        if ((next.uploaded ?? 0) > 0) {
          setNotice(`${next.uploaded} sheet(s) uploaded. Reading and scoring them now…`);
        }
      } catch (uploadError) {
        setError(errorMessage(uploadError, 'Unable to upload these answer sheets.'));
      } finally {
        setBusy(false);

        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    },
    [loadBatches, selectedId]
  );

  const rerun = useCallback(
    async (sheetId: number) => {
      setBusy(true);
      setError('');

      try {
        await reprocessSheet(sheetId);

        if (selectedId !== null) {
          await loadDetail(selectedId, true);
        }
      } catch (rerunError) {
        setError(errorMessage(rerunError, 'Unable to re-run this sheet.'));
      } finally {
        setBusy(false);
      }
    },
    [loadDetail, selectedId]
  );

  const removeSheet = useCallback(
    async (sheet: EvaluationSheet) => {
      if (!window.confirm(`Remove "${sheet.original_name}" from this evaluation? The scan is deleted too.`)) {
        return;
      }

      setBusy(true);
      setError('');

      try {
        await deleteSheet(sheet.id);

        if (selectedId !== null) {
          await loadDetail(selectedId, true);
        }

        await loadBatches();
      } catch (removeError) {
        setError(errorMessage(removeError, 'Unable to remove this sheet.'));
      } finally {
        setBusy(false);
      }
    },
    [loadBatches, loadDetail, selectedId]
  );

  const removeBatch = useCallback(
    async (batch: EvaluationBatch) => {
      if (!window.confirm(`Remove "${batch.name}" and all ${batch.total_sheets} of its scans?`)) {
        return;
      }

      setBusy(true);
      setError('');

      try {
        await deleteBatch(batch.id);
        setSelectedId(null);
        setDetail(null);
        await loadBatches();
        setNotice('Evaluation removed.');
      } catch (removeError) {
        setError(errorMessage(removeError, 'Unable to remove this evaluation.'));
      } finally {
        setBusy(false);
      }
    },
    [loadBatches]
  );

  const publish = useCallback(async () => {
    if (!detail) return;

    const unapproved = detail.batch.total_sheets - detail.batch.approved_sheets;
    const warning =
      unapproved > 0
        ? `\n\n${unapproved} sheet(s) have not been approved and will NOT be published.`
        : '';

    if (
      !window.confirm(
        `Publish ${detail.batch.approved_sheets} approved sheet(s) to the gradebook?` +
          `${warning}\n\nThis cannot be undone from here.`
      )
    ) {
      return;
    }

    setBusy(true);
    setError('');

    try {
      const result = await publishBatch(detail.batch.id);

      setNotice(result.message || `${result.published} sheet(s) published.`);
      await loadDetail(detail.batch.id);
      await loadBatches();
    } catch (publishError) {
      setError(errorMessage(publishError, 'Unable to publish this evaluation.'));
    } finally {
      setBusy(false);
    }
  }, [detail, loadBatches, loadDetail]);

  const published = detail?.batch.status === 'Published';

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[18px] font-semibold text-[#172554]">Exam evaluation</h2>
          <p className="mt-1 max-w-3xl text-[13px] leading-6 text-[#5B6B82]">
            Scan and check answer sheets against the paper they were set from. OMR and MCQ sheets are
            marked against the answer key; written answers are marked against the model answer saved
            on each question. Every mark is a suggestion until you approve it.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void startCreating()}
          className="inline-flex items-center gap-2 rounded-[10px] bg-[#5846EA] px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-[#4738CE]"
        >
          <Plus size={16} />
          New evaluation
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
        {/* ---- Evaluations list ------------------------------------------ */}
        <aside className="flex flex-col gap-2.5 rounded-[18px] border border-[#E4E9F2] bg-white p-3">
          <p className="px-2 pt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7A889D]">
            Your evaluations
          </p>

          {batchesLoading ? (
            <p className="flex items-center gap-2 px-2 py-6 text-[13px] text-[#5F7087]">
              <Loader2 size={15} className="animate-spin" /> Loading…
            </p>
          ) : batches.length === 0 ? (
            <p className="px-2 pb-2 text-[12px] leading-5 text-[#7A889D]">
              None yet. Start one from an exam you have already set.
            </p>
          ) : (
            batches.map((batch) => (
              <div
                key={batch.id}
                className={`group flex items-start gap-2 rounded-[12px] border px-3 py-2.5 transition ${
                  selectedId === batch.id
                    ? 'border-[#5846EA] bg-[#F5F4FF]'
                    : 'border-[#E4E9F2] bg-white hover:border-[#C3CDE0]'
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    setCreating(false);
                    setSelectedId(batch.id);
                  }}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="flex items-start gap-2 text-[13px] font-semibold text-[#172554]">
                    <ScanLine size={14} className="mt-0.5 shrink-0 text-[#5846EA]" />
                    <span className="min-w-0 break-words">{batch.name}</span>
                  </span>
                  <span className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10.5px] font-semibold ${
                        BATCH_STATUS_STYLES[batch.status] ?? BATCH_STATUS_STYLES.Draft
                      }`}
                    >
                      {batch.status}
                    </span>
                    <span className="text-[11.5px] text-[#7A889D]">
                      {batch.approved_sheets}/{batch.total_sheets} approved
                    </span>
                  </span>
                </button>

                {batch.status === 'Published' ? null : (
                  <button
                    type="button"
                    onClick={() => void removeBatch(batch)}
                    className="shrink-0 rounded-[8px] p-1 text-[#98A4B6] opacity-0 transition hover:bg-red-50 hover:text-[#B91C1C] group-hover:opacity-100"
                    aria-label="Remove evaluation"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))
          )}
        </aside>

        {/* ---- Panel ------------------------------------------------------ */}
        <section className="min-w-0">
          {creating ? (
            <NewEvaluationPanel
              papers={filteredPapers}
              papersLoading={papersLoading}
              search={paperSearch}
              onSearch={setPaperSearch}
              paperId={paperId}
              onPaperId={setPaperId}
              name={batchName}
              onName={setBatchName}
              answerKey={answerKey}
              answerKeyError={answerKeyError}
              answerKeyLoading={answerKeyLoading}
              busy={busy}
              onCancel={() => setCreating(false)}
              onCreate={() => void create()}
            />
          ) : detailLoading ? (
            <p className="flex items-center gap-2 rounded-[18px] border border-[#E4E9F2] bg-white px-4 py-10 text-[13px] text-[#5F7087]">
              <Loader2 size={15} className="animate-spin" /> Loading the evaluation…
            </p>
          ) : !detail ? (
            <div className="flex flex-col items-center gap-2 rounded-[18px] border border-dashed border-[#D7DEEA] bg-white px-6 py-14 text-center">
              <ScanLine size={22} className="text-[#98A4B6]" />
              <p className="text-[14px] font-semibold text-[#334155]">Nothing open</p>
              <p className="max-w-md text-[12.5px] leading-6 text-[#7A889D]">
                Pick an evaluation on the left, or start a new one from an exam you have already set.
                You will need the marking key on that paper — the correct options for MCQs, and a
                model answer on each written question.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <BatchHeader batch={detail.batch} pendingCount={pendingCount} />

              {published ? (
                <div className="flex items-center gap-2 rounded-[14px] border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[13px] text-[#047857]">
                  <CheckCircle2 size={15} />
                  These marks have been published to the gradebook. The sheets are read-only now.
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-3 rounded-[18px] border border-dashed border-[#C7CFDD] bg-[#FAFBFE] px-4 py-3.5">
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept={ACCEPTED_TYPES}
                    onChange={(event) => void upload(event.target.files)}
                    className="hidden"
                    id="exam-evaluation-upload"
                  />
                  <label
                    htmlFor="exam-evaluation-upload"
                    className={`inline-flex cursor-pointer items-center gap-2 rounded-[10px] bg-[#5846EA] px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-[#4738CE] ${
                      busy ? 'pointer-events-none opacity-50' : ''
                    }`}
                  >
                    {busy ? <Loader2 size={16} className="animate-spin" /> : <FileUp size={16} />}
                    Upload scanned sheets
                  </label>
                  <p className="text-[12.5px] leading-5 text-[#5F7087]">
                    PDF, JPG or PNG, up to 20 MB each. Select the whole class at once — each file is
                    read on its own, and the student is identified from the roll number, GR number or
                    name on the sheet.
                  </p>
                </div>
              )}

              <SheetTable
                sheets={detail.sheets}
                readOnly={published}
                busy={busy}
                onReview={setReviewSheetId}
                onRerun={(id) => void rerun(id)}
                onRemove={(sheet) => void removeSheet(sheet)}
              />

              {published ? null : (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-[#E4E9F2] bg-white px-4 py-3.5">
                  <p className="text-[12.5px] leading-5 text-[#5F7087]">
                    Publishing writes the <strong>approved</strong> sheets into the offline exam
                    results the rest of the ERP reports on. Unapproved sheets are left out.
                  </p>
                  <button
                    type="button"
                    onClick={() => void publish()}
                    disabled={busy || detail.batch.approved_sheets === 0}
                    className="inline-flex items-center gap-2 rounded-[10px] bg-[#0F766E] px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-[#115E59] disabled:opacity-50"
                  >
                    <Send size={15} />
                    Publish {detail.batch.approved_sheets} approved
                  </button>
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {reviewSheetId !== null && detail ? (
        <SheetReviewPanel
          sheetId={reviewSheetId}
          roster={detail.roster}
          readOnly={published}
          onClose={() => setReviewSheetId(null)}
          onChanged={() => {
            void loadDetail(detail.batch.id, true);
            void loadBatches();
          }}
        />
      ) : null}
    </div>
  );
}

function BatchHeader({ batch, pendingCount }: { batch: EvaluationBatch; pendingCount: number }) {
  const subtitle = [batch.paper_name, batch.standard_name, batch.subject_name].filter(Boolean).join(' · ');

  return (
    <div className="flex flex-wrap items-start justify-between gap-3 rounded-[18px] border border-[#E4E9F2] bg-white px-4 py-3.5">
      <div className="min-w-0">
        <h3 className="text-[15px] font-semibold text-[#172554]">{batch.name}</h3>
        {subtitle ? <p className="mt-0.5 text-[12.5px] text-[#5F7087]">{subtitle}</p> : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {pendingCount > 0 ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11.5px] font-semibold text-sky-700">
            <Loader2 size={12} className="animate-spin" />
            Reading {pendingCount}
          </span>
        ) : null}
        <Stat label="Sheets" value={String(batch.total_sheets)} />
        <Stat label="Checked" value={`${batch.evaluated_sheets}/${batch.total_sheets}`} />
        <Stat label="Approved" value={`${batch.approved_sheets}/${batch.total_sheets}`} />
        <Stat label="Out of" value={formatMarks(batch.total_marks)} />
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

function SheetTable({
  sheets,
  readOnly,
  busy,
  onReview,
  onRerun,
  onRemove,
}: {
  sheets: EvaluationSheet[];
  readOnly: boolean;
  busy: boolean;
  onReview: (id: number) => void;
  onRerun: (id: number) => void;
  onRemove: (sheet: EvaluationSheet) => void;
}) {
  if (sheets.length === 0) {
    return (
      <div className="rounded-[18px] border border-[#E4E9F2] bg-white px-4 py-10 text-center text-[13px] text-[#7A889D]">
        No answer sheets uploaded yet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-[18px] border border-[#E4E9F2] bg-white">
      <table className="w-full min-w-[840px] border-collapse text-left">
        <thead>
          <tr className="border-b border-[#EEF1F6] text-[11px] font-semibold uppercase tracking-[0.12em] text-[#7A889D]">
            <th className="px-4 py-2.5">Student</th>
            <th className="px-4 py-2.5">Read from sheet</th>
            <th className="px-4 py-2.5">Status</th>
            <th className="px-4 py-2.5 text-right">AI</th>
            <th className="px-4 py-2.5 text-right">Final</th>
            <th className="px-4 py-2.5 text-right">%</th>
            <th className="px-4 py-2.5" />
          </tr>
        </thead>
        <tbody>
          {sheets.map((sheet) => {
            const unmatched = sheet.student_id === null;

            return (
              <tr key={sheet.id} className="border-b border-[#F3F5F9] last:border-b-0 text-[13px]">
                <td className="px-4 py-2.5">
                  {unmatched ? (
                    <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-amber-700">
                      <AlertTriangle size={13} /> Not assigned
                    </span>
                  ) : (
                    <span className="font-semibold text-[#172554]">
                      {sheet.student_roll_no ? `${sheet.student_roll_no}. ` : ''}
                      {sheet.student_name}
                    </span>
                  )}
                  <span className="mt-0.5 block truncate text-[11.5px] text-[#98A4B6]" title={sheet.original_name}>
                    {sheet.original_name}
                  </span>
                </td>

                <td className="px-4 py-2.5 text-[12px] text-[#5F7087]">
                  {[
                    sheet.detected_roll_no ? `Roll ${sheet.detected_roll_no}` : '',
                    sheet.detected_enrollment_no ? `GR ${sheet.detected_enrollment_no}` : '',
                    sheet.detected_student_name,
                  ]
                    .filter(Boolean)
                    .join(' · ') || <span className="italic text-[#98A4B6]">nothing readable</span>}
                </td>

                <td className="px-4 py-2.5">
                  <span
                    className={`inline-block rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
                      SHEET_STATUS_STYLES[sheet.status] ?? SHEET_STATUS_STYLES.Pending
                    }`}
                  >
                    {sheet.status}
                  </span>
                  {sheet.failure_reason ? (
                    <span className="mt-1 block max-w-[240px] text-[11px] leading-4 text-[#B91C1C]">
                      {sheet.failure_reason}
                    </span>
                  ) : null}
                </td>

                <td className="px-4 py-2.5 text-right text-[#5F7087]">{formatMarks(sheet.ai_total)}</td>
                <td className="px-4 py-2.5 text-right font-semibold text-[#172554]">
                  {sheet.status === 'Approved' ? formatMarks(sheet.teacher_total) : '—'}
                </td>
                <td className="px-4 py-2.5 text-right text-[#5F7087]">
                  {sheet.percentage === null ? '—' : `${Math.round(sheet.percentage)}%`}
                </td>

                <td className="px-4 py-2.5">
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      disabled={sheet.status === 'Pending' || sheet.status === 'Processing' || sheet.status === 'Failed'}
                      onClick={() => onReview(sheet.id)}
                      className="inline-flex items-center gap-1.5 rounded-[9px] border border-[#E4E9F2] px-2.5 py-1.5 text-[12px] font-semibold text-[#334155] transition hover:bg-[#F3F5F9] disabled:opacity-40"
                    >
                      <ClipboardCheck size={14} />
                      {readOnly ? 'View' : 'Review'}
                    </button>

                    {readOnly ? null : (
                      <>
                        <button
                          type="button"
                          disabled={busy || sheet.status === 'Processing'}
                          onClick={() => onRerun(sheet.id)}
                          className="rounded-[9px] border border-[#E4E9F2] p-1.5 text-[#5F7087] transition hover:bg-[#F3F5F9] disabled:opacity-40"
                          aria-label="Re-run evaluation"
                          title="Read and score this sheet again"
                        >
                          <RefreshCw size={14} />
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => onRemove(sheet)}
                          className="rounded-[9px] border border-[#E4E9F2] p-1.5 text-[#98A4B6] transition hover:bg-red-50 hover:text-[#B91C1C] disabled:opacity-40"
                          aria-label="Remove sheet"
                        >
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function NewEvaluationPanel({
  papers,
  papersLoading,
  search,
  onSearch,
  paperId,
  onPaperId,
  name,
  onName,
  answerKey,
  answerKeyError,
  answerKeyLoading,
  busy,
  onCancel,
  onCreate,
}: {
  papers: ExamPaperOption[];
  papersLoading: boolean;
  search: string;
  onSearch: (value: string) => void;
  paperId: number | null;
  onPaperId: (value: number | null) => void;
  name: string;
  onName: (value: string) => void;
  answerKey: AnswerKeySummary | null;
  answerKeyError: string;
  answerKeyLoading: boolean;
  busy: boolean;
  onCancel: () => void;
  onCreate: () => void;
}) {
  const missing = answerKey?.missing_model_answers ?? [];

  return (
    <div className="flex flex-col gap-4 rounded-[18px] border border-[#E4E9F2] bg-white p-4">
      <div>
        <h3 className="text-[15px] font-semibold text-[#172554]">New evaluation</h3>
        <p className="mt-1 text-[12.5px] leading-6 text-[#5B6B82]">
          Pick the exam these answer sheets were written for. Its questions and marking key are what
          the sheets get checked against.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7A889D]">
            Search exams
          </span>
          <input
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Name, subject or standard"
            className="h-10 rounded-[10px] border border-[#E4E9F2] px-3 text-[13px] text-[#172554]"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7A889D]">Exam</span>
          <select
            value={paperId ?? ''}
            onChange={(event) => onPaperId(event.target.value ? Number(event.target.value) : null)}
            disabled={papersLoading}
            className="h-10 rounded-[10px] border border-[#E4E9F2] bg-white px-3 text-[13px] text-[#172554] disabled:bg-[#F8FAFC]"
          >
            <option value="">{papersLoading ? 'Loading exams…' : 'Select an exam'}</option>
            {papers.map((paper) => (
              <option key={paper.id} value={paper.id}>
                {paper.paperName}
                {paper.standardName ? ` — ${paper.standardName}` : ''}
                {paper.subjectName ? ` · ${paper.subjectName}` : ''}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7A889D]">
          Name this evaluation
        </span>
        <input
          value={name}
          onChange={(event) => onName(event.target.value)}
          placeholder="e.g. Class 7B Science — Term 1"
          className="h-10 rounded-[10px] border border-[#E4E9F2] px-3 text-[13px] text-[#172554]"
        />
      </label>

      {answerKeyLoading ? (
        <p className="flex items-center gap-2 text-[13px] text-[#5F7087]">
          <Loader2 size={15} className="animate-spin" /> Reading the marking key…
        </p>
      ) : answerKeyError ? (
        <p className="rounded-[12px] border border-red-200 bg-red-50 px-3.5 py-2.5 text-[13px] text-[#B91C1C]">
          {answerKeyError}
        </p>
      ) : answerKey ? (
        <div className="flex flex-col gap-2.5 rounded-[14px] border border-[#E4E9F2] bg-[#FAFBFE] px-4 py-3.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7A889D]">
            Marking key
          </p>
          <div className="flex flex-wrap gap-2">
            <Stat label="Questions" value={String(answerKey.question_count)} />
            <Stat label="Total marks" value={formatMarks(answerKey.total_marks)} />
            <Stat label="Objective" value={String(answerKey.objective_count)} />
            <Stat label="Written" value={String(answerKey.subjective_count)} />
          </div>

          <p className="text-[12.5px] leading-6 text-[#5F7087]">
            {answerKey.objective_count} question(s) will be checked against the answer key exactly.{' '}
            {answerKey.subjective_count > 0
              ? `${answerKey.subjective_count} written answer(s) will be marked against their model answers and will need your eye before approval.`
              : 'There are no written answers on this paper.'}
          </p>

          {missing.length > 0 ? (
            <p className="flex items-start gap-2 rounded-[10px] border border-amber-200 bg-amber-50 px-3 py-2 text-[12.5px] leading-5 text-amber-800">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" />
              <span>
                No model answer is saved on question{missing.length === 1 ? '' : 's'}{' '}
                {missing.join(', ')}. Those will be marked on subject correctness alone, which is far
                less reliable — add a model answer on the question first if you can.
              </span>
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-[10px] border border-[#E4E9F2] px-4 py-2.5 text-[13px] font-semibold text-[#5F7087] transition hover:bg-[#F3F5F9]"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onCreate}
          disabled={busy || paperId === null || !!answerKeyError}
          className="inline-flex items-center gap-2 rounded-[10px] bg-[#5846EA] px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-[#4738CE] disabled:opacity-50"
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <ScanLine size={16} />}
          Start evaluation
        </button>
      </div>
    </div>
  );
}
