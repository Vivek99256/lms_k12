'use client';

// ---------------------------------------------------------------------------
// Exam evaluation > review one answer sheet.
//
// The scan on the left, the marks on the right. The AI's suggestion and the
// teacher's decision are kept visibly apart on every question, and nothing the AI
// produced becomes a result until the teacher approves the sheet here and the
// batch is published from the Operations tab.
//
// "Submit final result" is those two deliberate steps, not one: approving a sheet
// (this page, per student) and publishing the batch (Operations, once). Neither
// can be done by the AI, and publishing reads approved teacher marks only.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle2, Loader2, RefreshCw, RotateCcw, Save, ShieldCheck, UserCheck, X } from 'lucide-react';
import RequireStaff from '@/app/lms/_shared/RequireStaff';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { fetchBatch, fetchSheet, reprocessSheet, reviewSheet } from '@/app/lms/exam/_exam-evaluation/api';
import ConfirmActionDialog from '@/app/lms/exam/_exam-evaluation/ConfirmActionDialog';
import StudentPicker from '@/app/lms/exam/_exam-evaluation/StudentPicker';
import type { BatchDetail, EvaluationSheet, SheetDetail, SheetStatus } from '@/app/lms/exam/_exam-evaluation/types';
import {
  confidenceLabel,
  identityBlocker,
  identityIssueMessage,
  identityState,
  isUsableReason,
  matchMethodLabel,
  needsCorrectionReason,
} from '@/lib/exam-evaluation/identity';
import { canReprocess, stalledMessage } from '@/lib/exam-evaluation/recovery';
import {
  acceptAiMark,
  approvalBlocker,
  buildMarkEdits,
  computeTotals,
  formatMarks,
  isDirty,
  previewEdits,
  questionLabel,
  toInputs,
  type FeedbackInputs,
  type MarkInputs,
} from '@/lib/exam-evaluation/review-math';
import QuestionPanel from '../../_components/QuestionPanel';
import ReviewHeader from '../../_components/ReviewHeader';
import SheetPdfPane from '../../_components/SheetPdfPane';
import TotalsBar from '../../_components/TotalsBar';

const POLL_INTERVAL_MS = 4000;
const IN_FLIGHT: SheetStatus[] = ['Identifying', 'Pending', 'Processing'];
const REVIEWABLE: SheetStatus[] = ['Evaluated', 'Needs review', 'Approved'];
const FALLBACK_BACK = '/lms/exam';

type Busy = 'save' | 'approve' | 'reopen' | 'rerun' | 'confirm' | null;

type Dialog =
  | { kind: 'approve' }
  | { kind: 'reopen' }
  | { kind: 'rerun' }
  /** Moving a confirmed or marked sheet to another student: a correction, so it asks why. */
  | { kind: 'correction'; approve: boolean }
  | { kind: 'reset'; questionNo: number }
  | { kind: 'leave'; go: () => void };

/**
 * Where "Back" goes. Only an address on this site is followed: the value comes from
 * the query string, which anyone can edit, so it is checked rather than trusted.
 */
function safeBackTarget(raw: string | null): string {
  if (!raw || !raw.startsWith('/') || raw.includes('\\')) {
    return FALLBACK_BACK;
  }

  try {
    const url = new URL(raw, window.location.origin);

    return url.origin === window.location.origin ? url.pathname + url.search + url.hash : FALLBACK_BACK;
  } catch {
    return FALLBACK_BACK;
  }
}

/** The Operations screen reopens on the evaluation tab, with this batch open. */
function returnAddress(target: string, batchId: number): string {
  const url = new URL(target, window.location.origin);

  url.searchParams.set('examTab', 'evaluation');
  url.searchParams.set('examBatch', String(batchId));

  return url.pathname + url.search + url.hash;
}

/**
 * What the teacher is told about the student on the sheet. A suggestion and a
 * confirmation read differently on purpose: "matched on the GR number" is what the
 * software thought, "confirmed" is what a person decided.
 */
function identityNote(sheet: EvaluationSheet): string {
  const sure = confidenceLabel(sheet.identity_confidence);
  const method = matchMethodLabel(sheet.identity_source);

  switch (identityState(sheet)) {
    case 'selected_by_teacher':
      return 'Selected by a teacher.';
    case 'confirmed_match':
      return `Matched on: ${method.toLowerCase()}${sure ? ` (${sure})` : ''}. Confirmed by a teacher.`;
    case 'suggested':
      return `Suggested from the ${method.toLowerCase()}${sure ? ` (${sure})` : ''}. Not confirmed yet — confirm it is the right student${
        sheet.identity_source === 'name' ? ' (a handwritten name is the weakest kind of match)' : ''
      }.`;
    default:
      return 'No student could be matched from the sheet. Please pick one before approving.';
  }
}

function errorText(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

/** The sheet and its batch (for the roster and the previous / next sheets), loaded together. */
async function fetchPair(batchId: number, sheetId: number): Promise<{ sheet: SheetDetail; batch: BatchDetail }> {
  const [sheet, batch] = await Promise.all([fetchSheet(sheetId), fetchBatch(batchId)]);

  if (sheet.sheet.batch_id !== batchId) {
    throw new Error('That answer sheet isn’t part of this evaluation.');
  }

  return { sheet, batch };
}

export default function ExamSheetReviewPage() {
  const params = useParams<{ batchId: string; sheetId: string }>();
  const batchId = Number(params?.batchId);
  const sheetId = Number(params?.sheetId);

  return (
    <RequireStaff>
      {/* Keyed by sheet: stepping to the next one starts from a clean slate. */}
      <ExamSheetReview key={`${batchId}-${sheetId}`} batchId={batchId} sheetId={sheetId} />
    </RequireStaff>
  );
}

function ExamSheetReview({ batchId, sheetId }: { batchId: number; sheetId: number }) {
  const router = useRouter();
  const validIds = Number.isInteger(batchId) && batchId > 0 && Number.isInteger(sheetId) && sheetId > 0;

  const [detail, setDetail] = useState<SheetDetail | null>(null);
  const [batch, setBatch] = useState<BatchDetail | null>(null);
  const [loading, setLoading] = useState(validIds);
  const [loadError, setLoadError] = useState(validIds ? '' : 'This evaluation link isn’t valid. Go back and try again.');
  const [reloadToken, setReloadToken] = useState(0);

  const [marks, setMarks] = useState<MarkInputs>({});
  const [feedback, setFeedback] = useState<FeedbackInputs>({});
  const [studentId, setStudentId] = useState<number | null>(null);
  // Bumped each time the sheet is (re)loaded from the server, so the saved marked-up copy is fetched again.
  const [loadVersion, setLoadVersion] = useState(0);

  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [dialog, setDialog] = useState<Dialog | null>(null);
  // Why a confirmed or marked sheet is being moved to another student (a correction).
  const [reason, setReason] = useState('');

  const [jump, setJump] = useState<{ page: number; nonce: number } | null>(null);
  const [activeQuestion, setActiveQuestion] = useState<number | null>(null);
  // Safe to read the address here: this only renders on the client, after RequireStaff has mounted.
  const [backTarget] = useState(() =>
    typeof window === 'undefined' ? FALLBACK_BACK : safeBackTarget(new URLSearchParams(window.location.search).get('back'))
  );
  const pdfRef = useRef<HTMLDivElement | null>(null);

  const applyDetail = useCallback((next: SheetDetail) => {
    const inputs = toInputs(next.answers);

    setDetail(next);
    setLoadVersion((value) => value + 1);
    setMarks(inputs.marks);
    setFeedback(inputs.feedback);
    setStudentId(next.sheet.student_id);
  }, []);

  // Load on arrival, and again when "Try again" is pressed. State is only set in the
  // promise callbacks, never synchronously in the effect.
  useEffect(() => {
    if (!validIds) return;

    let cancelled = false;

    fetchPair(batchId, sheetId)
      .then(({ sheet, batch: batchDetail }) => {
        if (cancelled) return;

        applyDetail(sheet);
        setBatch(batchDetail);
        setLoading(false);
      })
      .catch((error_: unknown) => {
        if (cancelled) return;

        setLoadError(errorText(error_, 'Couldn’t load this answer sheet.'));
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [applyDetail, batchId, reloadToken, sheetId, validIds]);

  const retryLoad = useCallback(() => {
    setLoading(true);
    setLoadError('');
    setReloadToken((value) => value + 1);
  }, []);

  // A sheet opened while still being read refreshes itself, and stops the moment it settles.
  const inFlight = detail ? IN_FLIGHT.includes(detail.sheet.status) : false;

  useEffect(() => {
    if (!inFlight) return;

    let cancelled = false;

    const timer = window.setInterval(() => {
      fetchPair(batchId, sheetId)
        .then(({ sheet, batch: batchDetail }) => {
          if (cancelled) return;

          applyDetail(sheet);
          setBatch(batchDetail);
        })
        .catch(() => {
          // Quiet: the next tick tries again, and the page already says it is still working.
        });
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [applyDetail, batchId, inFlight, sheetId]);

  const answers = useMemo(() => detail?.answers ?? [], [detail]);
  const totals = useMemo(() => computeTotals(answers, marks), [answers, marks]);
  // Marks typed since the last save that are valid: what the marked-up preview is redrawn from.
  const livePreviewEdits = useMemo(() => previewEdits(answers, marks), [answers, marks]);
  // A question as the teacher knows it from the scan (Q.1(B)), by its paper position as the key.
  const questionName = (questionNo: number) => {
    const found = answers.find((answer) => answer.question_no === questionNo);

    return found ? questionLabel(found) : `Q${questionNo}`;
  };
  const savedStudentId = detail?.sheet.student_id ?? null;
  const dirty = detail ? isDirty(answers, marks, feedback, studentId, savedStudentId) : false;
  const approved = detail?.sheet.status === 'Approved';
  const published = detail?.context?.batch_status === 'Published' || batch?.batch.status === 'Published';
  const locked = approved || published;
  const savedConfirmed = detail?.sheet.identity_confirmed ?? false;
  // The student comes first: a sheet nobody has vouched for the owner of is not approved
  // on the strength of its marks.
  const blocker =
    identityBlocker({ studentId, savedStudentId, savedConfirmed }) ?? approvalBlocker(answers, marks, studentId);

  // Only an unconfirmed suggestion can be confirmed from here; a different student chosen in
  // the picker is confirmed by saving.
  const canConfirm = Boolean(detail && savedStudentId && !savedConfirmed && studentId === savedStudentId && !locked);

  // Moving the sheet off a confirmed (or already-marked) student is a correction.
  const correction = Boolean(
    detail &&
      needsCorrectionReason({
        currentStudentId: savedStudentId,
        nextStudentId: studentId,
        confirmed: savedConfirmed,
        hasTeacherWork: answers.some((answer) => answer.reviewed || answer.teacher_feedback.trim() !== ''),
      })
  );

  // Don't let a closed tab or a stray refresh throw away typed work.
  useEffect(() => {
    if (!dirty) return;

    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', warn);

    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  // -- Navigation ----------------------------------------------------------

  const guarded = useCallback(
    (go: () => void) => {
      if (dirty) {
        setDialog({ kind: 'leave', go });
      } else {
        go();
      }
    },
    [dirty]
  );

  const goBack = useCallback(() => {
    guarded(() => router.push(returnAddress(backTarget, batchId)));
  }, [backTarget, batchId, guarded, router]);

  const siblings = useMemo(
    () => (batch?.sheets ?? []).filter((sheet) => REVIEWABLE.includes(sheet.status) || sheet.id === sheetId),
    [batch, sheetId]
  );
  const position = useMemo(() => {
    const index = siblings.findIndex((sheet) => sheet.id === sheetId);

    return index === -1 ? null : { index, total: siblings.length };
  }, [sheetId, siblings]);

  const goToSheet = useCallback(
    (targetId: number) => {
      guarded(() => router.push(`/lms/exam/evaluation/${batchId}/${targetId}${window.location.search}`));
    },
    [batchId, guarded, router]
  );

  const previousId = position && position.index > 0 ? siblings[position.index - 1].id : null;
  const nextId = position && position.index < position.total - 1 ? siblings[position.index + 1].id : null;

  // -- Editing -------------------------------------------------------------

  const setMark = useCallback((questionNo: number, value: string) => {
    setMarks((current) => ({ ...current, [questionNo]: value }));
    setNotice('');
  }, []);

  const setNote = useCallback((questionNo: number, value: string) => {
    setFeedback((current) => ({ ...current, [questionNo]: value }));
    setNotice('');
  }, []);

  const accept = useCallback(
    (questionNo: number) => {
      const answer = answers.find((item) => item.question_no === questionNo);

      if (answer) setMark(questionNo, acceptAiMark(answer));
    },
    [answers, setMark]
  );

  const jumpTo = useCallback((questionNo: number, page: number) => {
    setActiveQuestion(questionNo);
    setJump((current) => ({ page: Math.max(1, page), nonce: (current?.nonce ?? 0) + 1 }));

    // On a narrow screen the scan sits above the marks; bring it into view.
    if (!window.matchMedia('(min-width: 1280px)').matches) {
      pdfRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  // -- Saving --------------------------------------------------------------

  const refreshBatch = useCallback(async () => {
    try {
      setBatch(await fetchBatch(batchId));
    } catch {
      // The sheet itself saved; a stale sibling list is not worth an error.
    }
  }, [batchId]);

  const save = useCallback(
    async (approve: boolean, correctionReason?: string) => {
      if (!detail) return;

      const problem = approve
        ? blocker
        : totals.invalidCount > 0
          ? 'Fix the marks marked in red before saving.'
          : null;

      if (problem) {
        setDialog(null);
        setError(problem);

        return;
      }

      // A correction is never made silently: ask why first, and send the reason with it.
      if (correction && correctionReason === undefined) {
        setReason('');
        setDialog({ kind: 'correction', approve });

        return;
      }

      setBusy(approve ? 'approve' : 'save');
      setError('');
      setNotice('');

      try {
        const next = await reviewSheet(sheetId, {
          // Only when it changed: sending it marks the sheet "assigned by hand".
          ...(studentId !== savedStudentId ? { studentId } : {}),
          ...(correction && correctionReason ? { reason: correctionReason } : {}),
          marks: buildMarkEdits(answers, marks, feedback),
          approve,
        });

        applyDetail(next);
        setNotice(
          approve
            ? 'Sheet approved. It reaches the gradebook when this evaluation is published from Operations.'
            : 'Draft saved.'
        );
        void refreshBatch();
      } catch (error_) {
        setError(errorText(error_, approve ? 'Couldn’t approve this sheet.' : 'Couldn’t save this draft.'));
      } finally {
        setBusy(null);
        setDialog(null);
      }
    },
    [answers, applyDetail, blocker, correction, detail, feedback, marks, refreshBatch, savedStudentId, sheetId, studentId, totals.invalidCount]
  );

  /** The teacher agreeing that the suggested student is the right one. */
  const confirmStudent = useCallback(async () => {
    setBusy('confirm');
    setError('');
    setNotice('');

    try {
      applyDetail(await reviewSheet(sheetId, { confirmIdentity: true }));
      setNotice('Student confirmed.');
      void refreshBatch();
    } catch (error_) {
      setError(errorText(error_, 'Couldn’t confirm this student.'));
    } finally {
      setBusy(null);
    }
  }, [applyDetail, refreshBatch, sheetId]);

  const reopen = useCallback(async () => {
    setBusy('reopen');
    setError('');
    setNotice('');

    try {
      applyDetail(await reviewSheet(sheetId, { unapprove: true }));
      setNotice('Sheet re-opened. You can change its marks again.');
      void refreshBatch();
    } catch (error_) {
      setError(errorText(error_, 'Couldn’t re-open this sheet.'));
    } finally {
      setBusy(null);
      setDialog(null);
    }
  }, [applyDetail, refreshBatch, sheetId]);

  const rerun = useCallback(async () => {
    setBusy('rerun');
    setError('');
    setNotice('');

    try {
      applyDetail(await reprocessSheet(sheetId));
      setNotice('Re-reading this sheet. Your marks and feedback are kept; the AI suggestions will refresh.');
      void refreshBatch();
    } catch (error_) {
      setError(errorText(error_, 'Couldn’t re-run this sheet.'));
    } finally {
      setBusy(null);
      setDialog(null);
    }
  }, [applyDetail, refreshBatch, sheetId]);

  // -- Rendering -----------------------------------------------------------

  const working = busy !== null;

  return (
    <main className="mx-auto w-full max-w-[1680px] space-y-4 p-4 sm:p-6">
      {loading ? (
        <div className="flex h-60 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-500">
          <Loader2 className="size-5 animate-spin" /> Loading the answer sheet…
        </div>
      ) : loadError || !detail ? (
        <div role="alert" className="space-y-3 rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          <p className="flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0" /> {loadError || 'Couldn’t load this answer sheet.'}
          </p>
          <div className="flex gap-2">
            {validIds ? (
              <Button type="button" variant="outline" size="sm" onClick={retryLoad}>
                Try again
              </Button>
            ) : null}
            <Button type="button" variant="outline" size="sm" onClick={() => router.push(returnAddress(backTarget, batchId || 0))}>
              Back to evaluations
            </Button>
          </div>
        </div>
      ) : (
        <>
          <ReviewHeader
            sheet={detail.sheet}
            context={detail.context}
            position={position}
            busy={working}
            onBack={goBack}
            onPrevious={previousId ? () => goToSheet(previousId) : null}
            onNext={nextId ? () => goToSheet(nextId) : null}
          />

          {error ? (
            <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span className="flex-1">{error}</span>
              <button type="button" onClick={() => setError('')} aria-label="Dismiss this message">
                <X className="size-4" />
              </button>
            </div>
          ) : null}

          {notice ? (
            <div role="status" className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
              <span className="flex-1">{notice}</span>
              <button type="button" onClick={() => setNotice('')} aria-label="Dismiss this message">
                <X className="size-4" />
              </button>
            </div>
          ) : null}

          {inFlight && stalledMessage(detail.sheet) ? (
            // The job seems lost (no change for a long time): say so calmly and offer the way out.
            <div role="alert" className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
              <p className="font-semibold">This is taking longer than it should.</p>
              <p>{stalledMessage(detail.sheet)}</p>
              {published || !canReprocess(detail.sheet) ? null : (
                <Button type="button" variant="outline" size="sm" onClick={() => void rerun()} disabled={working}>
                  {busy === 'rerun' ? <Loader2 className="animate-spin" /> : <RefreshCw />} Try again
                </Button>
              )}
            </div>
          ) : inFlight ? (
            <div role="status" className="flex items-center gap-3 rounded-xl border border-sky-200 bg-sky-50 p-5 text-sm text-sky-800">
              <Loader2 className="size-5 animate-spin" />
              <span>
                {detail.sheet.status === 'Identifying'
                  ? 'The student’s details are being read from this sheet. You’ll confirm whose it is before it is marked.'
                  : 'This sheet is still being read and scored. The marks will appear here as soon as it’s done — you don’t need to refresh.'}
              </span>
            </div>
          ) : detail.sheet.status === 'Awaiting identity' ? (
            <div role="status" className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
              <p className="font-semibold">This sheet hasn’t been marked yet.</p>
              <p>
                It is marked only after a teacher confirms which student it belongs to. Confirm the student from the
                evaluation screen, where every sheet waiting for this is listed together.
              </p>
              <Button type="button" variant="outline" size="sm" onClick={goBack}>
                Go to the evaluation
              </Button>
            </div>
          ) : detail.sheet.status === 'Failed' ? (
            <div role="alert" className="space-y-3 rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">
              <p className="font-semibold">This sheet couldn’t be evaluated.</p>
              <p>{detail.sheet.failure_reason || 'No reason was recorded.'}</p>
              {published ? null : (
                <Button type="button" variant="outline" size="sm" onClick={() => void rerun()} disabled={working}>
                  {busy === 'rerun' ? <Loader2 className="animate-spin" /> : <RefreshCw />} Re-run evaluation
                </Button>
              )}
            </div>
          ) : (
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
              <div ref={pdfRef} className="flex min-h-[460px] scroll-mt-4 flex-col xl:sticky xl:top-4 xl:h-[calc(100vh-2rem)]">
                <SheetPdfPane
                  key={sheetId}
                  sheetId={sheetId}
                  originalName={detail.sheet.original_name}
                  fileType={detail.sheet.file_type}
                  hasAnnotated={detail.sheet.has_annotated}
                  jump={jump}
                  edits={locked ? [] : livePreviewEdits}
                  version={loadVersion}
                />
              </div>

              <div className="min-w-0 space-y-4">
                {/* First, and sticky: the total and percentage follow every mark typed, and stay in view while
                    the questions scroll. Solid, so the marks passing under it stay legible. */}
                <div className="sticky top-0 z-20 -mx-1 bg-slate-50/95 px-1 pb-1 pt-1">
                  <TotalsBar totals={totals} approved={approved} unsaved={dirty && livePreviewEdits.length > 0} />
                </div>

                <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <label htmlFor="sheet-student" className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    This sheet belongs to
                  </label>
                  <StudentPicker
                    id="sheet-student"
                    students={batch?.roster ?? []}
                    value={studentId}
                    disabled={locked}
                    allowClear
                    preferred={detail.sheet.identity_candidates}
                    unavailable={Object.fromEntries(
                      (batch?.sheets ?? [])
                        .filter((other) => other.id !== sheetId && other.student_id)
                        .map((other) => [other.student_id as number, `Already on another sheet: ${other.original_name}`])
                    )}
                    onChange={(next) => {
                      setStudentId(next);
                      setNotice('');
                    }}
                    className="mt-1.5"
                  />
                  <p className="mt-1.5 text-xs leading-5 text-slate-500">
                    {studentId !== savedStudentId
                      ? correction
                        ? 'You’ll be asked why when you save: this sheet is already confirmed or marked, so changing its student is a correction.'
                        : 'Save to confirm this change.'
                      : identityNote(detail.sheet)}
                    {detail.sheet.detected_student_name || detail.sheet.detected_roll_no || detail.sheet.detected_enrollment_no
                      ? ` Read from the scan: ${[
                          detail.sheet.detected_roll_no ? `roll ${detail.sheet.detected_roll_no}` : '',
                          detail.sheet.detected_enrollment_no ? `GR ${detail.sheet.detected_enrollment_no}` : '',
                          detail.sheet.detected_student_name ? `“${detail.sheet.detected_student_name}”` : '',
                        ]
                          .filter(Boolean)
                          .join(', ')}.`
                      : ''}
                  </p>
                  {identityIssueMessage(detail.sheet.identity_issue) ? (
                    <p className="mt-1 text-xs leading-5 text-amber-700">{identityIssueMessage(detail.sheet.identity_issue)}</p>
                  ) : null}
                  {canConfirm ? (
                    <Button type="button" size="sm" className="mt-2" onClick={() => void confirmStudent()} disabled={working}>
                      {busy === 'confirm' ? <Loader2 className="animate-spin" /> : <UserCheck />} Confirm this student
                    </Button>
                  ) : null}
                </section>

                {locked ? (
                  <div role="status" className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                    <ShieldCheck className="mt-0.5 size-4 shrink-0" />
                    <span>
                      {published
                        ? 'This evaluation has been published, so its marks can no longer be changed here.'
                        : `Approved${detail.sheet.approved_at ? ` on ${new Date(detail.sheet.approved_at).toLocaleString()}` : ''}. Re-open the sheet to change its marks.`}
                    </span>
                  </div>
                ) : null}

                <QuestionPanel
                  answers={answers}
                  marks={marks}
                  feedback={feedback}
                  locked={locked}
                  activeQuestion={activeQuestion}
                  onMark={setMark}
                  onFeedback={setNote}
                  onAccept={accept}
                  onRequestReset={(questionNo) => setDialog({ kind: 'reset', questionNo })}
                  onJump={jumpTo}
                />

                {/* Solid, not translucent: this sits over the marks while scrolling. Only sticky from
                    tablet width up; on a phone it would cover a quarter of the screen. */}
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-md sm:sticky sm:bottom-0 sm:z-10">
                  <div className="min-w-0 text-xs text-slate-600">
                    {dirty ? (
                      <span className="font-semibold text-amber-700">Unsaved changes</span>
                    ) : (
                      <span>All changes saved</span>
                    )}
                    {!locked && blocker ? <span className="mt-0.5 block text-slate-500">{blocker}</span> : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {published ? null : approved ? (
                      <Button type="button" variant="outline" onClick={() => setDialog({ kind: 'reopen' })} disabled={working}>
                        {busy === 'reopen' ? <Loader2 className="animate-spin" /> : <RotateCcw />} Re-open
                      </Button>
                    ) : (
                      <>
                        <Button type="button" variant="ghost" onClick={() => setDialog({ kind: 'rerun' })} disabled={working}>
                          <RefreshCw /> Re-run AI
                        </Button>
                        <Button type="button" variant="outline" onClick={() => void save(false)} disabled={working || !dirty}>
                          {busy === 'save' ? <Loader2 className="animate-spin" /> : <Save />} Save draft
                        </Button>
                        <Button
                          type="button"
                          onClick={() => setDialog({ kind: 'approve' })}
                          disabled={working || blocker !== null}
                          title={blocker ?? undefined}
                        >
                          <ShieldCheck /> Approve evaluation
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ---- Confirmations ------------------------------------------------ */}

      <ConfirmActionDialog
        open={dialog?.kind === 'approve'}
        title="Approve this evaluation?"
        confirmLabel="Approve evaluation"
        busy={busy === 'approve'}
        onCancel={() => setDialog(null)}
        onConfirm={() => void save(true)}
        description={
          <>
            <p>
              <strong>{detail?.sheet.student_name || 'This student'}</strong> will be marked{' '}
              <strong>
                {formatMarks(totals.teacherTotal)} out of {formatMarks(totals.maxTotal)}
              </strong>
              {totals.percentage === null ? '' : ` (${totals.percentage}%)`}.
            </p>
            {totals.unreviewedCount > 0 ? (
              <p className="mt-2">
                {totals.unreviewedCount} {totals.unreviewedCount === 1 ? 'question' : 'questions'} you haven’t marked will
                take the AI’s suggestion.
              </p>
            ) : null}
            <p className="mt-2">
              Marks are locked once approved; you can re-open the sheet to change them. The result only reaches the
              gradebook when this evaluation is published from Operations.
            </p>
          </>
        }
      />

      <ConfirmActionDialog
        open={dialog?.kind === 'correction'}
        title="Why is this sheet moving to another student?"
        confirmLabel={dialog?.kind === 'correction' && dialog.approve ? 'Record correction and approve' : 'Record correction'}
        busy={busy === 'save' || busy === 'approve'}
        confirmDisabled={!isUsableReason(reason)}
        onCancel={() => setDialog(null)}
        onConfirm={() => {
          if (dialog?.kind === 'correction' && isUsableReason(reason)) {
            void save(dialog.approve, reason.trim());
          }
        }}
        description={
          <>
            <p>
              This sheet is already confirmed or has marks on it. Moving it to a different student is a correction, and
              it is kept on record with who made it and why. The marks stay with this scan; they are not copied to
              anyone.
            </p>
            <label htmlFor="correction-reason" className="mt-3 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Reason
            </label>
            <Textarea
              id="correction-reason"
              value={reason}
              maxLength={500}
              rows={3}
              onChange={(event) => setReason(event.target.value)}
              placeholder="For example: the scans were filed in the wrong order."
              className="mt-1.5"
            />
            {reason !== '' && !isUsableReason(reason) ? (
              <p className="mt-1 text-xs text-amber-700">Please say a little more.</p>
            ) : null}
          </>
        }
      />

      <ConfirmActionDialog
        open={dialog?.kind === 'reopen'}
        title="Re-open this sheet?"
        confirmLabel="Re-open"
        busy={busy === 'reopen'}
        onCancel={() => setDialog(null)}
        onConfirm={() => void reopen()}
        description="It goes back to “Needs review” and its marks can be changed again. It won’t be published until you approve it again."
      />

      <ConfirmActionDialog
        open={dialog?.kind === 'rerun'}
        title="Re-run the AI on this sheet?"
        confirmLabel="Re-run"
        busy={busy === 'rerun'}
        onCancel={() => setDialog(null)}
        onConfirm={() => void rerun()}
        description={
          dirty
            ? 'You have unsaved changes on this page. Save the draft first — re-running reloads the sheet and unsaved edits would be lost. Marks and feedback you have already saved are kept.'
            : 'The scan is read and scored again and the AI suggestions are refreshed. The marks and feedback you have already saved are kept.'
        }
      />

      <ConfirmActionDialog
        open={dialog?.kind === 'reset'}
        title="Reset to the AI suggestion?"
        confirmLabel="Reset mark"
        tone="destructive"
        onCancel={() => setDialog(null)}
        onConfirm={() => {
          if (dialog?.kind === 'reset') {
            setMark(dialog.questionNo, '');
          }
          setDialog(null);
        }}
        description={
          dialog?.kind === 'reset'
            ? `Your mark for ${questionName(dialog.questionNo)} is cleared, so it goes back to the AI’s suggestion of ${formatMarks(
                answers.find((answer) => answer.question_no === dialog.questionNo)?.ai_marks
              )}. Your feedback is kept. Save the draft to make this permanent.`
            : ''
        }
      />

      <ConfirmActionDialog
        open={dialog?.kind === 'leave'}
        title="Leave without saving?"
        confirmLabel="Leave without saving"
        cancelLabel="Keep editing"
        tone="destructive"
        onCancel={() => setDialog(null)}
        onConfirm={() => {
          const go = dialog?.kind === 'leave' ? dialog.go : null;

          setDialog(null);
          go?.();
        }}
        description="You have changes that haven’t been saved. They’ll be lost if you leave this sheet."
      />
    </main>
  );
}
