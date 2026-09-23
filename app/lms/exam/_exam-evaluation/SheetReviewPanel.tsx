'use client';

// ---------------------------------------------------------------------------
// One answer sheet, open in front of a teacher.
//
// The scan on the left, the marks on the right, and the student's name at the
// top where it can be corrected — because a sheet with the wrong name on it is
// worse than a sheet with no name on it.
//
// Every mark box starts at what the AI proposed and is editable. Approving
// accepts whatever is in the boxes: the server copies any untouched proposal
// into the teacher's own column, so an approved sheet is entirely teacher-owned
// and stops moving if the model is ever re-run over it.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  FileWarning,
  Loader2,
  RotateCcw,
  Save,
  X,
} from 'lucide-react';
import { fetchSheet, fetchSheetFileUrl, reviewSheet } from './api';
import type { AnswerStatus, EvaluationAnswer, RosterStudent, SheetDetail } from './types';

type Props = {
  sheetId: number;
  roster: RosterStudent[];
  readOnly: boolean;
  onClose: () => void;
  /** Fired whenever the sheet changed, so the batch table can refresh. */
  onChanged: () => void;
};

const STATUS_STYLES: Record<AnswerStatus, { label: string; className: string }> = {
  correct: { label: 'Correct', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  partially_correct: { label: 'Partly correct', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  wrong: { label: 'Wrong', className: 'bg-red-50 text-red-700 border-red-200' },
  unattempted: { label: 'Not attempted', className: 'bg-slate-100 text-slate-600 border-slate-200' },
};

function formatMarks(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';

  return String(Math.round(value * 100) / 100);
}

export default function SheetReviewPanel({ sheetId, roster, readOnly, onClose, onChanged }: Props) {
  const [detail, setDetail] = useState<SheetDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Mark boxes are held as strings so a half-typed "1." does not snap to 1.
  const [marks, setMarks] = useState<Record<number, string>>({});
  const [studentId, setStudentId] = useState<number | null>(null);

  const [showAnnotated, setShowAnnotated] = useState(true);
  const [fileUrl, setFileUrl] = useState('');
  const [fileError, setFileError] = useState('');
  const [fileLoading, setFileLoading] = useState(false);
  const objectUrlRef = useRef('');

  const applyDetail = useCallback((next: SheetDetail) => {
    setDetail(next);
    setStudentId(next.sheet.student_id);
    setMarks(
      Object.fromEntries(
        next.answers.map((answer) => [
          answer.question_no,
          formatMarksInput(answer.teacher_marks ?? answer.ai_marks),
        ])
      )
    );
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      applyDetail(await fetchSheet(sheetId));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load this answer sheet.');
    } finally {
      setLoading(false);
    }
  }, [applyDetail, sheetId]);

  useEffect(() => {
    void load();
  }, [load]);

  // The scan is fetched with the session headers and shown from an object URL,
  // so the previous one is released whenever the source changes or the panel
  // closes — otherwise a teacher working through 40 sheets leaks 40 blobs.
  useEffect(() => {
    let cancelled = false;

    const release = () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = '';
      }
    };

    if (!detail) {
      return release;
    }

    const wantAnnotated = showAnnotated && detail.sheet.has_annotated;

    setFileLoading(true);
    setFileError('');

    fetchSheetFileUrl(sheetId, wantAnnotated)
      .then((nextUrl) => {
        if (cancelled) {
          URL.revokeObjectURL(nextUrl);

          return;
        }

        release();
        objectUrlRef.current = nextUrl;
        setFileUrl(nextUrl);
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setFileUrl('');
          setFileError(loadError instanceof Error ? loadError.message : 'That scan could not be opened.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setFileLoading(false);
        }
      });

    return () => {
      cancelled = true;
      release();
    };
  }, [detail, sheetId, showAnnotated]);

  const totals = useMemo(() => {
    if (!detail) return { given: 0, max: 0 };

    return detail.answers.reduce(
      (accumulator, answer) => {
        const typed = Number.parseFloat(marks[answer.question_no] ?? '');
        const given = Number.isFinite(typed) ? typed : (answer.ai_marks ?? 0);

        return { given: accumulator.given + given, max: accumulator.max + answer.max_marks };
      },
      { given: 0, max: 0 }
    );
  }, [detail, marks]);

  const attentionCount = useMemo(
    () => (detail?.answers ?? []).filter((answer) => answer.needs_attention).length,
    [detail]
  );

  const save = useCallback(
    async (approve: boolean) => {
      if (!detail) return;

      setSaving(true);
      setError('');

      try {
        const next = await reviewSheet(sheetId, {
          studentId,
          marks: detail.answers.map((answer) => ({
            question_no: answer.question_no,
            teacher_marks: parseMarkInput(marks[answer.question_no], answer.max_marks),
          })),
          approve,
        });

        applyDetail(next);
        onChanged();
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : 'Unable to save this review.');
      } finally {
        setSaving(false);
      }
    },
    [applyDetail, detail, marks, onChanged, sheetId, studentId]
  );

  const reopen = useCallback(async () => {
    setSaving(true);
    setError('');

    try {
      applyDetail(await reviewSheet(sheetId, { unapprove: true }));
      onChanged();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to re-open this sheet.');
    } finally {
      setSaving(false);
    }
  }, [applyDetail, onChanged, sheetId]);

  const approved = detail?.sheet.status === 'Approved';
  const locked = readOnly || approved;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/45 p-3">
      <div className="flex h-full max-h-[94vh] w-full max-w-[1180px] flex-col overflow-hidden rounded-[18px] border border-[#E4E9F2] bg-white shadow-xl">
        {/* ---- Header -------------------------------------------------- */}
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#EEF1F6] px-5 py-3.5">
          <div className="min-w-0">
            <h3 className="text-[15px] font-semibold text-[#172554]">
              {detail?.sheet.original_name || 'Answer sheet'}
            </h3>
            <p className="mt-0.5 text-[12px] text-[#5F7087]">
              Read from the scan {detail?.sheet.detected_roll_no ? `· Roll ${detail.sheet.detected_roll_no}` : ''}
              {detail?.sheet.detected_enrollment_no ? ` · GR ${detail.sheet.detected_enrollment_no}` : ''}
              {detail?.sheet.detected_student_name ? ` · "${detail.sheet.detected_student_name}"` : ''}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="rounded-full border border-[#E4E9F2] bg-[#F8FAFC] px-3 py-1 text-[12px] font-semibold text-[#334155]">
              {formatMarks(totals.given)} / {formatMarks(totals.max)}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="rounded-[9px] border border-[#E4E9F2] p-1.5 text-[#5F7087] transition hover:bg-[#F3F5F9]"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {error ? (
          <div className="mx-5 mt-3 rounded-[12px] border border-red-200 bg-red-50 px-3.5 py-2.5 text-[13px] text-[#B91C1C]">
            {error}
          </div>
        ) : null}

        {loading ? (
          <p className="flex flex-1 items-center justify-center gap-2 text-[13px] text-[#5F7087]">
            <Loader2 size={15} className="animate-spin" /> Loading the sheet…
          </p>
        ) : !detail ? null : (
          <div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
            {/* ---- The scan --------------------------------------------- */}
            <div className="flex min-h-0 flex-col border-b border-[#EEF1F6] lg:border-b-0 lg:border-r">
              <div className="flex items-center justify-between gap-2 px-4 py-2.5">
                <div className="inline-flex rounded-[9px] border border-[#E4E9F2] p-0.5">
                  {(['marked', 'original'] as const).map((mode) => {
                    const isAnnotated = mode === 'marked';
                    const disabled = isAnnotated && !detail.sheet.has_annotated;
                    const active = showAnnotated === isAnnotated && !disabled;

                    return (
                      <button
                        key={mode}
                        type="button"
                        disabled={disabled}
                        onClick={() => setShowAnnotated(isAnnotated)}
                        className={`rounded-[7px] px-3 py-1 text-[12px] font-semibold transition ${
                          active ? 'bg-[#5846EA] text-white' : 'text-[#5F7087] hover:bg-[#F3F5F9]'
                        } disabled:cursor-not-allowed disabled:opacity-40`}
                      >
                        {isAnnotated ? 'Marked up' : 'Original'}
                      </button>
                    );
                  })}
                </div>

                {attentionCount > 0 ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11.5px] font-semibold text-amber-700">
                    <AlertTriangle size={13} />
                    {attentionCount} to check
                  </span>
                ) : null}
              </div>

              <div className="min-h-0 flex-1 overflow-hidden bg-[#F3F5F9] px-4 pb-4">
                {fileLoading ? (
                  <p className="flex h-full items-center justify-center gap-2 text-[13px] text-[#5F7087]">
                    <Loader2 size={15} className="animate-spin" /> Opening the scan…
                  </p>
                ) : fileError ? (
                  <p className="flex h-full items-center justify-center gap-2 px-6 text-center text-[13px] text-[#B91C1C]">
                    <FileWarning size={15} /> {fileError}
                  </p>
                ) : fileUrl ? (
                  detail.sheet.file_type === 'pdf' || showAnnotated ? (
                    <iframe
                      src={fileUrl}
                      title="Answer sheet"
                      className="h-full w-full rounded-[12px] border border-[#E4E9F2] bg-white"
                    />
                  ) : (
                    <div className="h-full overflow-auto rounded-[12px] border border-[#E4E9F2] bg-white">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={fileUrl} alt="Answer sheet" className="w-full" />
                    </div>
                  )
                ) : null}
              </div>
            </div>

            {/* ---- Identity + marks -------------------------------------- */}
            <div className="flex min-h-0 flex-col">
              <div className="border-b border-[#EEF1F6] px-4 py-3">
                <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7A889D]">
                  This sheet belongs to
                </label>
                <select
                  value={studentId ?? ''}
                  disabled={locked}
                  onChange={(event) => setStudentId(event.target.value ? Number(event.target.value) : null)}
                  className="mt-1.5 h-10 w-full rounded-[10px] border border-[#E4E9F2] bg-white px-3 text-[13px] text-[#172554] disabled:bg-[#F8FAFC]"
                >
                  <option value="">— not assigned —</option>
                  {roster.map((student) => (
                    <option key={student.student_id} value={student.student_id}>
                      {student.roll_no ? `${student.roll_no}. ` : ''}
                      {student.name}
                      {student.enrollment_no ? ` (${student.enrollment_no})` : ''}
                    </option>
                  ))}
                </select>

                <p className="mt-1.5 text-[11.5px] leading-5 text-[#7A889D]">
                  {identityNote(detail.sheet.identity_source, detail.sheet.identity_confidence)}
                </p>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
                <div className="flex flex-col gap-2.5">
                  {detail.answers.map((answer) => (
                    <AnswerRow
                      key={answer.question_no}
                      answer={answer}
                      value={marks[answer.question_no] ?? ''}
                      disabled={locked}
                      onChange={(value) =>
                        setMarks((current) => ({ ...current, [answer.question_no]: value }))
                      }
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 border-t border-[#EEF1F6] px-4 py-3">
                {approved ? (
                  <>
                    <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-emerald-700">
                      <CheckCircle2 size={15} /> Approved
                    </span>
                    {readOnly ? null : (
                      <button
                        type="button"
                        onClick={() => void reopen()}
                        disabled={saving}
                        className="inline-flex items-center gap-1.5 rounded-[10px] border border-[#E4E9F2] px-3.5 py-2 text-[13px] font-semibold text-[#5F7087] transition hover:bg-[#F3F5F9] disabled:opacity-50"
                      >
                        <RotateCcw size={15} /> Re-open
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => void save(false)}
                      disabled={saving || readOnly}
                      className="inline-flex items-center gap-1.5 rounded-[10px] border border-[#E4E9F2] px-3.5 py-2 text-[13px] font-semibold text-[#334155] transition hover:bg-[#F3F5F9] disabled:opacity-50"
                    >
                      {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                      Save marks
                    </button>

                    <button
                      type="button"
                      onClick={() => void save(true)}
                      disabled={saving || readOnly || !studentId}
                      title={!studentId ? 'Assign this sheet to a student first' : undefined}
                      className="inline-flex items-center gap-1.5 rounded-[10px] bg-[#5846EA] px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-[#4738CE] disabled:opacity-50"
                    >
                      <Check size={15} /> Approve marks
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AnswerRow({
  answer,
  value,
  disabled,
  onChange,
}: {
  answer: EvaluationAnswer;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const status = STATUS_STYLES[answer.status] ?? STATUS_STYLES.unattempted;

  return (
    <div
      className={`rounded-[12px] border px-3 py-2.5 ${
        answer.needs_attention ? 'border-amber-300 bg-amber-50/40' : 'border-[#E4E9F2] bg-white'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[12.5px] font-semibold text-[#172554]">
            Q{answer.question_no}
            <span className="ml-2 font-normal text-[#7A889D]">
              {answer.is_objective ? 'Objective' : 'Written'} · {answer.max_marks} mark
              {answer.max_marks === 1 ? '' : 's'}
            </span>
          </p>
          {answer.question_title ? (
            <p className="mt-0.5 line-clamp-2 text-[12px] leading-5 text-[#5F7087]">{answer.question_title}</p>
          ) : null}
        </div>

        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${status.className}`}>
          {status.label}
        </span>
      </div>

      <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-[12px]">
        <dt className="text-[#7A889D]">Student</dt>
        <dd className="min-w-0 break-words text-[#334155]">
          {answer.selected_options.length > 0
            ? answer.selected_options.join(', ')
            : answer.detected_answer || <span className="italic text-[#98A4B6]">nothing written</span>}
        </dd>

        <dt className="text-[#7A889D]">Key</dt>
        <dd className="min-w-0 break-words text-[#334155]">
          {answer.expected_answer || <span className="italic text-[#98A4B6]">no model answer saved</span>}
        </dd>
      </dl>

      {answer.ai_remark ? (
        <p className="mt-1.5 text-[11.5px] leading-5 text-[#7A889D]">{answer.ai_remark}</p>
      ) : null}

      <div className="mt-2 flex items-center justify-between gap-3">
        <span className="text-[11.5px] text-[#7A889D]">
          AI proposed {formatMarks(answer.ai_marks)}
          {answer.is_objective
            ? ' (checked against the key)'
            : answer.ai_confidence !== null
              ? ` · ${Math.round(answer.ai_confidence)}% confident`
              : ''}
        </span>

        <label className="flex items-center gap-2 text-[12px] text-[#5F7087]">
          Final
          <input
            type="number"
            inputMode="decimal"
            min={0}
            max={answer.max_marks}
            step={0.5}
            value={value}
            disabled={disabled}
            onChange={(event) => onChange(event.target.value)}
            className="h-9 w-[72px] rounded-[9px] border border-[#E4E9F2] px-2 text-right text-[13px] font-semibold text-[#172554] disabled:bg-[#F8FAFC]"
          />
          <span className="text-[#98A4B6]">/ {answer.max_marks}</span>
        </label>
      </div>
    </div>
  );
}

/** Says how the sheet was matched, in the plainest terms available. */
function identityNote(source: string, confidence: number | null): string {
  const sure = confidence === null ? '' : ` (${Math.round(confidence)}% sure)`;

  switch (source) {
    case 'enrollment_no':
      return `Matched on the GR number read from the sheet${sure}.`;
    case 'roll_no':
      return `Matched on the roll number read from the sheet${sure}.`;
    case 'name':
      return `Matched on the handwritten name${sure}. Names are the weakest match — please confirm.`;
    case 'manual':
      return 'Assigned by a teacher.';
    default:
      return 'No student could be matched from the sheet. Please pick one before approving.';
  }
}

function formatMarksInput(value: number | null): string {
  return value === null || value === undefined ? '' : String(Math.round(value * 100) / 100);
}

/** Empty stays empty (meaning "fall back to the AI"); anything else is clamped. */
function parseMarkInput(raw: string | undefined, max: number): number | null {
  if (raw === undefined || raw.trim() === '') {
    return null;
  }

  const parsed = Number.parseFloat(raw);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.min(max, Math.max(0, parsed));
}
