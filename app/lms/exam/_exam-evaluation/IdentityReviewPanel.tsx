'use client';

// ---------------------------------------------------------------------------
// Exam evaluation > confirm whose sheet is whose, BEFORE anything is marked.
//
// Every uploaded scan is first read for the student's details only. What comes
// back is a suggestion, and it stays one until a teacher agrees with it here: the
// sheet is not marked, and no AI time is spent on it, until then. For each sheet
// the teacher sees what was written on it, who it was matched to and how sure the
// match is, and can confirm that student, pick another from the exam's class
// list, or leave the sheet unassigned until it is sorted out.
//
// Nothing here assigns an uncertain match silently. A handwritten-name match is
// called out as the weakest kind; a conflict, a duplicate or an unreadable block
// says so in words; and only clean GR / roll-number matches can be confirmed in
// bulk.
// ---------------------------------------------------------------------------

import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Eye, Loader2, RefreshCw, UserCheck, UserX } from 'lucide-react';
import {
  bulkConfirmableSheets,
  confidenceLabel,
  identityIssueMessage,
  identityStateLabel,
  isWeakMatch,
  matchMethodLabel,
  sheetsAwaitingIdentity,
} from '@/lib/exam-evaluation/identity';
import StudentPicker from './StudentPicker';
import type { EvaluationBatch, EvaluationSheet, RosterStudent } from './types';

type Props = {
  batch: EvaluationBatch;
  sheets: EvaluationSheet[];
  roster: RosterStudent[];
  busy: boolean;
  /** Confirm the suggested student (no id), or the student the teacher picked instead. */
  onConfirm: (sheet: EvaluationSheet, studentId?: number) => void;
  /** Withdraw a suggestion and leave the sheet unassigned. */
  onLeaveUnassigned: (sheet: EvaluationSheet) => void;
  onConfirmMany: (sheets: EvaluationSheet[]) => void;
  onViewScan: (sheet: EvaluationSheet) => void;
  onReadAgain: (sheet: EvaluationSheet) => void;
};

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <span className="block">
      <span className="text-[#7A889D]">{label} </span>
      {value ? (
        <span className="font-medium text-[#172554]">{value}</span>
      ) : (
        <span className="italic text-[#98A4B6]">not read</span>
      )}
    </span>
  );
}

export default function IdentityReviewPanel({
  batch,
  sheets,
  roster,
  busy,
  onConfirm,
  onLeaveUnassigned,
  onConfirmMany,
  onViewScan,
  onReadAgain,
}: Props) {
  // A student picked in a row but not confirmed yet. Absent = leave the suggestion as it is.
  const [picked, setPicked] = useState<Record<number, number | null>>({});

  const waiting = useMemo(() => sheetsAwaitingIdentity(sheets), [sheets]);
  const reading = useMemo(() => sheets.filter((sheet) => sheet.status === 'Identifying').length, [sheets]);
  const clean = useMemo(() => bulkConfirmableSheets(sheets), [sheets]);
  const byId = useMemo(() => new Map(roster.map((student) => [student.student_id, student])), [roster]);

  // Students already on another sheet: shown in the picker but not choosable.
  const claimedBy = (sheetId: number): Record<number, string> => {
    const claimed: Record<number, string> = {};

    for (const other of sheets) {
      if (other.id !== sheetId && other.student_id) {
        claimed[other.student_id] = `Already on another sheet: ${other.original_name}`;
      }
    }

    return claimed;
  };

  if (waiting.length === 0 && reading === 0) {
    return null;
  }

  const exam = [batch.paper_name, batch.standard_name, batch.subject_name].filter(Boolean).join(' · ');

  return (
    <section
      aria-labelledby="identity-review-title"
      className="flex flex-col gap-3 rounded-[18px] border border-amber-200 bg-amber-50/40 px-4 py-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id="identity-review-title" className="text-[15px] font-semibold text-[#172554]">
            Confirm the student on each sheet
          </h3>
          <p className="mt-1 max-w-3xl text-[12.5px] leading-6 text-[#5B6B82]">
            {waiting.length > 0
              ? `${waiting.length} ${waiting.length === 1 ? 'sheet is' : 'sheets are'} waiting for you. `
              : ''}
            A sheet is only marked once you have confirmed whose it is. What’s shown is a suggestion read from the sheet,
            not a decision.
          </p>
          {exam ? (
            <p className="mt-1 text-[12px] text-[#7A889D]">
              Exam: <span className="font-semibold text-[#334155]">{exam}</span> — students on this exam’s class list
              only.
            </p>
          ) : null}
          {reading > 0 ? (
            <p className="mt-1.5 inline-flex items-center gap-1.5 text-[12px] font-semibold text-sky-700">
              <Loader2 size={12} className="animate-spin" /> Reading {reading} more…
            </p>
          ) : null}
        </div>

        {clean.length > 0 ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => onConfirmMany(clean)}
            className="inline-flex items-center gap-2 rounded-[10px] bg-[#5846EA] px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-[#4738CE] disabled:opacity-50"
            title="Only clean GR-number and roll-number matches with nothing flagged are included."
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
            Confirm {clean.length} exact {clean.length === 1 ? 'match' : 'matches'}
          </button>
        ) : null}
      </div>

      {waiting.length > 0 ? (
        <div className="overflow-x-auto rounded-[14px] border border-[#E4E9F2] bg-white">
          <table className="w-full min-w-[960px] border-collapse text-left">
            <caption className="sr-only">Answer sheets waiting for their student to be confirmed</caption>
            <thead>
              <tr className="border-b border-[#EEF1F6] text-[11px] font-semibold uppercase tracking-[0.12em] text-[#7A889D]">
                <th scope="col" className="px-4 py-2.5">Sheet</th>
                <th scope="col" className="px-4 py-2.5">Read from the sheet</th>
                <th scope="col" className="px-4 py-2.5">Matched student</th>
                <th scope="col" className="px-4 py-2.5">Confirm</th>
              </tr>
            </thead>
            <tbody>
              {waiting.map((sheet) => {
                const choice = picked[sheet.id];
                const chosen = choice === undefined ? sheet.student_id : choice;
                const changed = choice !== undefined && choice !== sheet.student_id;
                const suggested = sheet.student_id ? byId.get(sheet.student_id) : undefined;
                const issue = identityIssueMessage(sheet.identity_issue);
                const confidence = confidenceLabel(sheet.identity_confidence);
                const preferred = [...sheet.identity_candidates, ...(sheet.student_id ? [sheet.student_id] : [])];

                return (
                  <tr key={sheet.id} className="border-b border-[#F3F5F9] align-top text-[13px] last:border-b-0">
                    <td className="px-4 py-3">
                      <span className="block max-w-[220px] truncate font-semibold text-[#172554]" title={sheet.original_name}>
                        {sheet.original_name}
                      </span>
                      <button
                        type="button"
                        onClick={() => onViewScan(sheet)}
                        className="mt-1 inline-flex items-center gap-1 text-[12px] font-semibold text-[#5846EA] hover:underline"
                        aria-label={`View the scan ${sheet.original_name}`}
                      >
                        <Eye size={13} /> View scan{sheet.identity_page ? ` (page ${sheet.identity_page})` : ''}
                      </button>
                    </td>

                    <td className="px-4 py-3 text-[12.5px] leading-5">
                      <Detail label="GR no." value={sheet.detected_enrollment_no} />
                      <Detail label="Roll no." value={sheet.detected_roll_no} />
                      <Detail label="Name" value={sheet.detected_student_name} />
                    </td>

                    <td className="px-4 py-3">
                      {suggested ? (
                        <>
                          <span className="block font-semibold text-[#172554]">
                            {suggested.roll_no ? `${suggested.roll_no}. ` : ''}
                            {suggested.name}
                          </span>
                          <span className="block text-[12px] text-[#5F7087]">
                            {[
                              suggested.enrollment_no ? `GR ${suggested.enrollment_no}` : '',
                              suggested.section_name ? `Division ${suggested.section_name}` : '',
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </span>
                          <span className="mt-1 block text-[12px] text-[#5F7087]">
                            Matched on: <strong>{matchMethodLabel(sheet.identity_source)}</strong>
                            {confidence ? ` · ${confidence}` : ''}
                          </span>
                        </>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-amber-700">
                          <AlertTriangle size={13} /> Not matched
                        </span>
                      )}

                      {suggested ? (
                        <span className="mt-1.5 inline-block rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                          {identityStateLabel(sheet)}
                        </span>
                      ) : null}

                      {isWeakMatch(sheet) ? (
                        <span className="mt-1.5 block max-w-[260px] text-[12px] leading-4 text-amber-800">
                          This is a handwritten-name match, the weakest kind. Check the scan before you confirm.
                        </span>
                      ) : null}
                      {issue ? (
                        <span className="mt-1.5 block max-w-[260px] text-[12px] leading-4 text-[#B45309]">{issue}</span>
                      ) : null}
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex min-w-[260px] max-w-[320px] flex-col gap-2">
                        <StudentPicker
                          students={roster}
                          value={chosen}
                          preferred={preferred}
                          unavailable={claimedBy(sheet.id)}
                          disabled={busy}
                          ariaLabel={`Student for ${sheet.original_name}`}
                          placeholder="Choose a student"
                          onChange={(studentId) => setPicked((current) => ({ ...current, [sheet.id]: studentId }))}
                        />

                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            disabled={busy || !chosen}
                            onClick={() => onConfirm(sheet, changed ? (chosen ?? undefined) : undefined)}
                            className="inline-flex items-center gap-1.5 rounded-[9px] bg-[#0F766E] px-3 py-1.5 text-[12px] font-semibold text-white transition hover:bg-[#115E59] disabled:opacity-40"
                            aria-label={`${changed ? 'Confirm the selected student' : 'Confirm the matched student'} for ${sheet.original_name}`}
                          >
                            <UserCheck size={14} />
                            {changed ? 'Confirm selection' : 'Confirm student'}
                          </button>

                          {sheet.student_id ? (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => {
                                setPicked((current) => {
                                  const next = { ...current };

                                  delete next[sheet.id];

                                  return next;
                                });
                                onLeaveUnassigned(sheet);
                              }}
                              className="inline-flex items-center gap-1.5 rounded-[9px] border border-[#E4E9F2] px-2.5 py-1.5 text-[12px] font-semibold text-[#5F7087] transition hover:bg-[#F3F5F9] disabled:opacity-40"
                              title="Remove the suggested student and leave this sheet unassigned for now."
                            >
                              <UserX size={14} /> Leave unassigned
                            </button>
                          ) : null}

                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => onReadAgain(sheet)}
                            className="rounded-[9px] border border-[#E4E9F2] p-1.5 text-[#5F7087] transition hover:bg-[#F3F5F9] disabled:opacity-40"
                            aria-label={`Read ${sheet.original_name} again`}
                            title="Read the student’s details from this sheet again"
                          >
                            <RefreshCw size={14} />
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
