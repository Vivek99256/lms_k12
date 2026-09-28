'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, Sparkles, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { fetchChapterConcepts, type EsoChapterConcept } from '@/app/pal/data/pal-eso';
import { fetchAdaptiveConcepts } from '@/app/pal/data/pal-diagnostic';

/**
 * "Concept practice" — the student entry point into the node-level Adaptive
 * Learning Engine (/pal/eso), replacing the manually-typed-URL-only path that
 * existed before. Mirrors DiagnosticButton's shape (a button that opens a
 * small modal) rather than introducing a new UI pattern.
 *
 * Deliberately NOT labelled "Adaptive Learning" even though that is this
 * engine's own name internally (EsoPolicyService docblock: "Adaptive
 * Learning Engine Developer Brief v1") — that label is reserved for the
 * chapter-level, diagnostic-driven 5-question stage
 * (/pal/adaptive/chapter/[chapterId]), which is a DIFFERENT system this
 * button does not open. Two things sharing one internal name is exactly what
 * caused both to render as "Concept diagnostic" on this row before; giving
 * this one its own label is the fix, not a stylistic choice.
 *
 * Aware of the chapter diagnostic (fetchAdaptiveConcepts().hasDiagnostic),
 * same as /pal/adaptive/chapter/[chapterId] (Stage 3): both surface a note
 * rather than a hard lock when it hasn't been taken, because a chapter thin
 * enough on MCQs to fail its 15-question 5/5/5 paper would otherwise strand a
 * learner who CAN still practise concept-by-concept. This used to show no
 * signal about the diagnostic at all, not even a note.
 *
 * Renders nothing when the chapter has no ESO-ready concepts yet (Phase 0
 * tagging scope) — no dead-end link is ever shown.
 *
 * Student-only: the caller (ChapterRow, app/pal/page.tsx) does not render
 * this component at all for a staff/admin session, so it never needs — and
 * never accepts — a learner id. The `/pal/eso` link it builds carries only
 * `conceptId`; the backend independently derives and enforces the learner
 * from the authenticated student's own JWT (EsoStudentOnlyAuth /
 * routes/pal_eso_api.php), never from anything this file could pass.
 */
export function AdaptiveLearningButton({ chapterId }: { chapterId: string }) {
  const [concepts, setConcepts] = useState<EsoChapterConcept[] | null>(null);
  // Whether the chapter diagnostic has been taken — this used to be
  // unchecked entirely, letting a learner reach the engine straight from the
  // subject list without ever sitting the 15-question baseline. null while
  // loading, so the button stays hidden rather than flashing unlocked.
  const [hasDiagnostic, setHasDiagnostic] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!chapterId) return;
    const controller = new AbortController();
    const numericChapterId = Number(chapterId);
    if (!Number.isFinite(numericChapterId)) return;
    Promise.all([
      fetchChapterConcepts(numericChapterId, controller.signal),
      // Same chapter-level flag the canonical /pal/adaptive/chapter and
      // /pal/plan/chapter screens already gate on — reused here rather than
      // adding a new endpoint.
      fetchAdaptiveConcepts(numericChapterId, controller.signal)
        .then((data) => data.hasDiagnostic)
        .catch(() => false),
    ])
      .then(([conceptList, diagnosticTaken]) => {
        if (controller.signal.aborted) return;
        setConcepts(conceptList);
        setHasDiagnostic(diagnosticTaken);
      })
      .catch(() => {
        // Chapter-readiness check failing shouldn't break the rest of the row — just hide the entry point.
        if (!controller.signal.aborted) {
          setConcepts([]);
          setHasDiagnostic(false);
        }
      });
    return () => controller.abort();
  }, [chapterId]);

  if (!concepts || concepts.length === 0) {
    return null;
  }

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
        title={
          hasDiagnostic === false
            ? 'You have not taken the chapter diagnostic yet — practice will start at an easier level.'
            : undefined
        }
        className="border-violet-200 text-violet-700 hover:bg-violet-50"
      >
        <Sparkles className="h-3.5 w-3.5" />
        Concept practice
      </Button>
      {open && (
        <ConceptPickerModal
          concepts={concepts}
          hasDiagnostic={hasDiagnostic}
          chapterId={chapterId}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function ConceptPickerModal({
  concepts,
  hasDiagnostic,
  chapterId,
  onClose,
}: {
  concepts: EsoChapterConcept[];
  hasDiagnostic: boolean | null;
  chapterId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [navigating, setNavigating] = useState<number | null>(null);

  // No learnerId in the URL — the backend derives the learner from the
  // authenticated student's own JWT (see EsoStudentOnlyAuth /
  // routes/pal_eso_api.php), never from a client-supplied value. This
  // component only ever renders for a genuine student session (the entry
  // point hides it entirely for staff — see ChapterRow in app/pal/page.tsx),
  // so there is no learner identity to pass here at all.
  const start = (conceptId: number) => {
    setNavigating(conceptId);
    router.push(`/pal/eso?conceptId=${conceptId}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/45" onClick={onClose} />
      <div className="relative flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Start concept practice</h2>
              <p className="text-xs text-slate-500">Pick a concept to work on</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {hasDiagnostic === false && (
          <div className="mx-5 mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <span>You have not taken the chapter diagnostic yet, so practice will open at easy.</span>
            <Link
              href={`/pal/diagnostic/chapter/${chapterId}`}
              className="font-medium underline underline-offset-2 hover:text-amber-950"
            >
              Take it first
            </Link>
          </div>
        )}
        <div className="overflow-y-auto p-2">
          {concepts.map((concept) => (
            <button
              key={concept.id}
              type="button"
              onClick={() => start(concept.id)}
              disabled={navigating !== null}
              className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-slate-800 transition-colors hover:bg-violet-50 disabled:opacity-60"
            >
              <span>{concept.name}</span>
              {navigating === concept.id && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-violet-500" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
