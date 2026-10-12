'use client';

import { friendlyError } from '@/lib/user-messages';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { Pencil } from 'lucide-react';
import { h5pContextQuery, hasH5pContext, isStudentProfile, readH5pContext } from '../../data/h5p';
import { branchingScenarioApi, type H5pBranchingScenario } from '../../data/h5p-branching';
import { normalizeScenario, type RawScenario } from '@/lib/h5p/branching-scenario';
import { H5pPageHeader, InlineBanner, LoadingState, MissingContextNotice } from '../../components/shared';
import { BranchingScenarioPlayer } from '../components/player';

/**
 * Branching scenario — player route.
 *
 * Loads the saved row by id and hands it to the player. The player itself lives
 * in `components/player.tsx` so the generator's preview can play a draft that
 * has not been saved, with the same code.
 *
 * A student is never shown a draft: the server answers 403 for one, and the
 * message below says so in plain words rather than showing a blank page.
 */
function PlayerContent() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';
  const searchParams = useSearchParams();
  const ctx = useMemo(() => readH5pContext(new URLSearchParams(searchParams?.toString())), [searchParams]);
  const contextQuery = h5pContextQuery(ctx);

  const [row, setRow] = useState<H5pBranchingScenario | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isStudent, setIsStudent] = useState(false);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setIsStudent(isStudentProfile());
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!hasH5pContext(ctx) || !id) {
      queueMicrotask(() => {
        if (!cancelled) setLoading(false);
      });
      return () => {
        cancelled = true;
      };
    }

    branchingScenarioApi
      .get(id, ctx)
      .then((data) => {
        if (!cancelled) setRow(data);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        // A draft is refused with a deliberate sentence; "try again" would be the wrong advice for that.
        const refused = err instanceof Error && /not been published/i.test(err.message);
        setError(
          refused
            ? 'This scenario has not been published yet. It will be available once your teacher publishes it.'
            : friendlyError(err, 'We couldn’t load this scenario. Please try again.')
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [ctx, id]);

  const scenario = useMemo(() => (row ? normalizeScenario(row as unknown as RawScenario) : null), [row]);

  return (
    <div className="p-4 sm:p-6">
      <div className="mx-auto max-w-6xl">
        <H5pPageHeader
          title={row?.title || 'Branching scenario'}
          description={row?.description ? undefined : 'Decide, see what follows, and find where each path leads'}
          ctx={ctx}
          backHref={`/h5p/h5p_branching_scenario?${contextQuery}`}
          actions={
            row && !isStudent ? (
              <Link
                href={`/h5p/h5p_branching_scenario/${id}/edit?${contextQuery}`}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </Link>
            ) : null
          }
        />

        {!hasH5pContext(ctx) ? (
          <MissingContextNotice />
        ) : loading ? (
          <LoadingState label="Loading scenario…" />
        ) : error ? (
          <InlineBanner kind="error" message={error} />
        ) : scenario ? (
          <>
            {row?.status !== 'published' ? (
              <p className="mx-auto mb-4 max-w-3xl rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800" role="note">
                This scenario is a draft. Students cannot see it until you publish it.
              </p>
            ) : null}
            <BranchingScenarioPlayer scenario={scenario} contentId={row ? Number(row.id) : null} ctx={ctx} preview={row?.status !== 'published' && !isStudent} />
          </>
        ) : null}
      </div>
    </div>
  );
}

export default function BranchingScenarioPlayerPage() {
  return (
    <Suspense fallback={<LoadingState label="Loading scenario…" />}>
      <PlayerContent />
    </Suspense>
  );
}
