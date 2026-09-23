'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { ArrowLeft, ArrowRight, HelpCircle, Loader2, UserRound } from 'lucide-react';

import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { fetchConceptResult, type ConceptDiagnosticResult } from '@/app/pal/data/pal-diagnostic';
import { buildConceptFeedback } from '@/app/pal/data/pal-feedback';
import {
  TRIGGER_LABELS,
  fetchInterventions,
  interventionTriggers,
  openIntervention,
  updateIntervention,
  type InterventionQueue,
  type InterventionRecord,
} from '@/app/pal/data/pal-intervention';
import { defaultLearnerId } from '@/app/pal/data/pal-v4';
import { BandRow } from '@/app/pal/_components/BandMeter';
import { JourneyRail, stagesBefore } from '@/app/pal/_components/JourneyRail';
import { PalRailSection, PalRailStat, PalWorkspace } from '@/app/pal/_components/PalWorkspace';

/**
 * Stage 8 - Extra support, as the learner sees it.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS SCREEN IS FOR
 * ---------------------------------------------------------------------------
 * A learner who has been stuck long enough for a person to be brought in
 * should be told, in plain words, that somebody is looking - and told it
 * without being made to feel labelled. That is the whole job of this page.
 *
 * The staff word for this is "intervention" and the route says so, because the
 * queue, the SOP (6.13) and the audit trail all use it. The learner reads
 * "Extra support". Same record, two registers.
 *
 * ---------------------------------------------------------------------------
 * WHY IT IS READ-ONLY, AND THE ONE EXCEPTION
 * ---------------------------------------------------------------------------
 * A support case is the teacher's to open, assign, approve and close. None of
 * those controls exist here, which is the structural sense of read-only that
 * CompletionState.tsx documents: there is nothing on the screen to press that
 * would change the record's state.
 *
 * The exception is a note. A learner who can see a case opened about them and
 * cannot say a word into it is being talked about rather than talked to, and
 * their own account of what is hard is the single most useful thing in the
 * record.
 *
 * ---------------------------------------------------------------------------
 * AND WHY IT DOES NOT BLOCK ANYTHING
 * ---------------------------------------------------------------------------
 * No question set, no practice, no gate. An open case must never become a
 * reason the learner cannot get on with the rest of the chapter - every link
 * here goes onward, and the page says so out loud.
 */

export default function LearnerSupportPage() {
  return (
    <Suspense fallback={<Centered>Loading…</Centered>}>
      <LearnerSupportView />
    </Suspense>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center text-sm text-slate-500">
      <Loader2 aria-hidden className="mr-2 h-4 w-4 animate-spin" />
      {children}
    </div>
  );
}

function LearnerSupportView() {
  const params = useParams();
  const searchParams = useSearchParams();
  const conceptId = String(params?.conceptId ?? '');
  const chapterHint = searchParams.get('chapterId') ?? '';

  const [queue, setQueue] = useState<InterventionQueue | null>(null);
  const [result, setResult] = useState<ConceptDiagnosticResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [note, setNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [raising, setRaising] = useState(false);

  const load = useCallback(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      setLoading(true);
      setError(null);
      Promise.all([
        fetchInterventions({ conceptId }, controller.signal),
        // Swallowed: the concept record is context for the case, not the
        // reason the page exists. A learner must still be able to read who is
        // helping them when the practice endpoint is having a bad day.
        fetchConceptResult(conceptId, controller.signal).catch(() => null),
      ])
        .then(([cases, concept]) => {
          setQueue(cases);
          setResult(concept);
        })
        .catch((reason: unknown) => {
          if (controller.signal.aborted) return;
          setError(reason instanceof Error ? reason.message : 'This could not be loaded.');
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    });

    return () => controller.abort();
  }, [conceptId]);

  useEffect(() => load(), [load]);

  const record = queue?.records[0] ?? null;
  const readOnly = queue?.access.readOnly === true;

  const addNote = useCallback(async () => {
    if (!record || !note.trim()) return;

    setSavingNote(true);
    setNoteError(null);
    try {
      const updated = await updateIntervention(record.id, { note: note.trim() });
      if (!updated) {
        setNoteError(queue?.access.message ?? 'Notes cannot be saved on this server yet.');
        return;
      }
      setNote('');
      load();
    } catch (reason: unknown) {
      setNoteError(reason instanceof Error ? reason.message : 'That note could not be saved.');
    } finally {
      setSavingNote(false);
    }
  }, [record, note, queue, load]);

  const raiseSupport = useCallback(async () => {
    setRaising(true);
    setNoteError(null);
    try {
      const opened = await openIntervention({
        learnerId: defaultLearnerId(),
        conceptId,
        chapterId: result?.chapterId || chapterHint,
        triggerKind: 'learner_raised',
        title: `Stuck on ${result?.conceptName || 'this concept'}`,
        riskLevel: 'medium',
      });
      if (!opened) {
        setNoteError(queue?.access.message ?? 'Support cases cannot be raised on this server yet.');
        return;
      }
      load();
    } catch (reason: unknown) {
      setNoteError(reason instanceof Error ? reason.message : 'That could not be sent.');
    } finally {
      setRaising(false);
    }
  }, [conceptId, result, chapterHint, queue, load]);

  if (loading) return <Centered>Loading…</Centered>;

  if (error) {
    return (
      <div className="mx-auto w-full space-y-5 p-4 sm:p-6">
        <Card className="border-rose-200 bg-rose-50">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-5">
            <p className="text-sm text-rose-800">{error}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={load}>
                Try again
              </Button>
              <Link href="/pal" className={buttonVariants({ size: 'sm' })}>
                Back to subjects
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const chapterId = result?.chapterId || chapterHint;
  const feedback = buildConceptFeedback(result);
  const derived = interventionTriggers({ conceptId, result });

  const rail = (
    <>
      {feedback && !feedback.isEmpty && (
        <PalRailSection title="Where you stand">
          <PalRailStat label="Accuracy" value={`${feedback.accuracy}%`} />
          <PalRailStat label="Progress to mastery" value={`${feedback.ladder.progressPct}%`} />
        </PalRailSection>
      )}

      <PalRailSection title="Your journey">
        <JourneyRail
          current="intervention"
          completed={stagesBefore('intervention')}
          orientation="vertical"
        />
      </PalRailSection>

      <PalRailSection title="Go to">
        <div className="space-y-2">
          <Link
            href={`/pal/learn/concept/${conceptId}${chapterId ? `?chapterId=${chapterId}` : ''}`}
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'w-full justify-start')}
          >
            Learn this again
          </Link>
          {chapterId && (
            <Link
              href={`/pal/plan/chapter/${chapterId}`}
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'w-full justify-start')}
            >
              My plan
            </Link>
          )}
        </div>
      </PalRailSection>
    </>
  );

  return (
    <PalWorkspace
      eyebrow={result?.conceptName || 'This concept'}
      title="Extra support"
      description="Somebody is looking at this with you."
      backHref={chapterId ? `/pal/plan/chapter/${chapterId}` : '/pal'}
      backLabel="Back to my plan"
      rail={rail}
    >
      {record ? (
        <SupportCase record={record} derivedSummaries={derived.map((trigger) => trigger.summary)} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">You have no support case open</CardTitle>
            <CardDescription>
              Nothing has been raised on this concept. If you are stuck, say so and your teacher
              will see it.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => void raiseSupport()}
              disabled={raising || readOnly}
              title={queue?.access.message ?? undefined}
            >
              {raising ? (
                <Loader2 aria-hidden className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <HelpCircle aria-hidden className="mr-1.5 h-4 w-4" />
              )}
              I&apos;m still stuck
            </Button>
          </CardContent>
        </Card>
      )}

      {feedback && !feedback.isEmpty && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Where you are on this concept</CardTitle>
            <CardDescription>
              The same picture your teacher is looking at. There is nothing to answer here.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {feedback.bands.map((band) => (
              <BandRow
                key={band.band}
                band={band.band}
                correct={band.correct}
                served={band.attempted}
                percentage={band.accuracy}
              />
            ))}
            {feedback.ladder.reason && (
              <p className="text-sm text-slate-600">{feedback.ladder.reason}</p>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">You are not blocked</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-slate-700">
            Having a support case open does not stop you doing anything. Carry on with the rest of
            the chapter while this is sorted out.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/pal/learn/concept/${conceptId}${chapterId ? `?chapterId=${chapterId}` : ''}`}
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              Go over the material
            </Link>
            {chapterId && (
              <>
                <Link
                  href={`/pal/plan/chapter/${chapterId}`}
                  className={buttonVariants({ variant: 'outline', size: 'sm' })}
                >
                  My plan
                </Link>
                <Link
                  href={`/pal/recall?chapterId=${chapterId}`}
                  className={buttonVariants({ variant: 'outline', size: 'sm' })}
                >
                  Recall reviews
                </Link>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {record && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notes</CardTitle>
            <CardDescription>
              Anything you add here is seen by whoever is helping you. Notes are never edited or
              removed once added.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {record.notes.length === 0 ? (
              <p className="text-sm text-slate-600">No notes yet.</p>
            ) : (
              <ul className="space-y-3">
                {record.notes.map((entry) => (
                  <li key={entry.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                    <p className="text-sm text-slate-800">{entry.body}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {entry.author_name || (entry.author_role === 'learner' ? 'You' : 'Staff')}
                      {entry.created_at ? ` · ${formatWhen(entry.created_at)}` : ''}
                    </p>
                  </li>
                ))}
              </ul>
            )}

            <div className="space-y-2">
              <label htmlFor="support-note" className="text-sm font-medium text-slate-700">
                Add a note
              </label>
              <textarea
                id="support-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                disabled={readOnly || savingNote}
                rows={3}
                placeholder="What is making this hard?"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:bg-slate-50 disabled:text-slate-400"
              />
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  size="sm"
                  onClick={() => void addNote()}
                  disabled={readOnly || savingNote || !note.trim()}
                  title={queue?.access.message ?? undefined}
                >
                  {savingNote && <Loader2 aria-hidden className="mr-1.5 h-4 w-4 animate-spin" />}
                  Add note
                </Button>
                {(noteError || queue?.access.message) && (
                  <p className="text-sm text-slate-500">{noteError ?? queue?.access.message}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5">
        <Link
          href={chapterId ? `/pal/plan/chapter/${chapterId}` : '/pal'}
          className={buttonVariants({ variant: 'outline' })}
        >
          <ArrowLeft aria-hidden className="mr-1.5 h-4 w-4" />
          Back to my plan
        </Link>
        <Link href={`/pal/feedback/concept/${conceptId}`} className={buttonVariants()}>
          What that set showed
          <ArrowRight aria-hidden className="ml-1.5 h-4 w-4" />
        </Link>
      </div>
    </PalWorkspace>
  );
}

/**
 * The case itself. Leads with reassurance rather than with the finding,
 * because the finding is the part the learner already knows.
 */
function SupportCase({
  record,
  derivedSummaries,
}: {
  record: InterventionRecord;
  derivedSummaries: string[];
}) {
  const owner = record.assigned_to_name;

  return (
    <>
      <Card className="border-indigo-200 bg-indigo-50">
        <CardContent className="pt-6">
          <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <UserRound aria-hidden className="h-4 w-4" />
            {owner ? `${owner} is going over this with you` : 'This is waiting to be picked up'}
          </p>
          <p className="mt-1 max-w-[60ch] text-sm text-slate-700">
            {owner
              ? 'They can see the same information you can, and will go over this with you.'
              : 'Your teacher has been told. Nothing you have done so far is lost.'}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <StatusChip status={record.status} />
            <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600">
              {TRIGGER_LABELS[record.trigger_kind] ?? 'Support'}
            </span>
            {record.opened_at && (
              <span className="text-xs text-slate-500">Opened {formatWhen(record.opened_at)}</span>
            )}
            {record.reference && (
              <span className="font-mono text-xs text-slate-500">{record.reference}</span>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Why this opened</CardTitle>
          <CardDescription>The same reason your teacher is reading.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm font-medium text-slate-900">{record.title}</p>
          {record.rationale && <p className="text-sm text-slate-700">{record.rationale}</p>}
          {derivedSummaries.length > 0 && (
            <ul className="mt-2 space-y-1">
              {derivedSummaries.map((summary, index) => (
                <li key={index} className="text-sm text-slate-600">
                  · {summary}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}

/** Status as a word plus a shape, never a coloured dot on its own. */
function StatusChip({ status }: { status: string }) {
  const copy: Record<string, { label: string; className: string }> = {
    draft: { label: 'Being prepared', className: 'border-slate-200 bg-white text-slate-600' },
    pending_approval: { label: 'Waiting on a teacher', className: 'border-amber-200 bg-amber-50 text-amber-800' },
    approved: { label: 'Open', className: 'border-indigo-200 bg-indigo-50 text-indigo-800' },
    executed: { label: 'Closed', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
    rejected: { label: 'Closed', className: 'border-slate-200 bg-slate-50 text-slate-600' },
    superseded: { label: 'Replaced', className: 'border-slate-200 bg-slate-50 text-slate-600' },
    expired: { label: 'Closed', className: 'border-slate-200 bg-slate-50 text-slate-600' },
  };

  const chip = copy[status] ?? { label: status, className: 'border-slate-200 bg-white text-slate-600' };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold',
        chip.className
      )}
    >
      {chip.label}
    </span>
  );
}

/** Laravel sends 'YYYY-MM-DD HH:MM:SS'; Safari will not parse that as-is. */
function formatWhen(value: string): string {
  const date = new Date(value.replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}
