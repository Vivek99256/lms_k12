'use client';

import { Suspense, useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Eye, Loader2 } from 'lucide-react';
import { h5pContextQuery, hasH5pContext, readH5pContext, type H5pContext } from '../data/h5p';
import type { H5pContentRow, H5pContentTypeApi } from '../data/h5p-content-types';
import { H5pPageHeader, InlineBanner, LoadingState, MissingContextNotice } from './shared';

/**
 * The create and edit shells every H5P content type in the 2026-09-21 vertical
 * uses.
 *
 * WHAT IS SHARED AND WHY IT HAS TO BE.
 *
 * Two behaviours here are easy to get subtly wrong and expensive when they are:
 *
 *  1. SAVE AND PUBLISH ARE TWO REQUESTS. Publishing is a second decision the
 *     server independently re-checks, so a refused publish must leave a SAVED
 *     DRAFT and say why — not lose the author's work and show a red banner.
 *     Four copies of that would be four chances to lose a teacher's afternoon.
 *
 *  2. EDITING A PUBLISHED ITEM SAVES IN PLACE. It does not quietly return the
 *     item to draft. A teacher fixing a typo mid-term must not have their
 *     class lose access because of it; taking it down is an explicit action,
 *     the publish toggle in the header.
 *
 * What a type supplies is its editor body, how its state becomes a payload,
 * and what is stopping it from being publishable.
 *
 * THE PAGE ROOT DOES NOT SCROLL. `DashboardShell` owns the one scroll region
 * in the app — its `<main>` — and every H5P screen renders inside it as an
 * auto-height block. A page root carrying `flex-1 overflow-auto` (the shape
 * these screens used to copy) declares a second, nested scroll container. It
 * is inert only for as long as the shell keeps `<main>` a plain block: give
 * the root a definite height by any route and it clips the form instead of
 * growing with it. Inert or not, it is the nearest scrollable ancestor, so it
 * is the box `scrollIntoView` and focus scrolling move — which is how growing
 * a form (adding a feedback band, a statement, a hotspot) can scroll the wrong
 * box and leave the new row off screen. Keep page roots height-auto and
 * overflow-visible; the shell scrolls.
 */

export interface ContentTypeFormSpec<TRow extends H5pContentRow, TState, TPayload> {
  /** Route segment under /h5p, e.g. `h5p_memory_game`. */
  path: string;
  /** "memory game" — used in titles and messages. */
  noun: string;
  createTitle: string;
  createDescription: string;
  editTitle: string;
  editDescription: string;
  api: H5pContentTypeApi<TRow, TPayload>;
  /** A blank editor state for a new item. */
  emptyState: () => TState;
  /** An editor state for an existing row. */
  stateFromRow: (row: TRow) => TState;
  toPayload: (state: TState) => TPayload;
  /**
   * Everything stopping this item from being published, in the author's words.
   *
   * An empty list offers "Save and publish". This is a HINT, not the rule: the
   * server re-checks and is the authority, because it can see things the
   * editor cannot — an embedded activity that was unpublished this morning,
   * for instance.
   */
  validate: (state: TState) => string[];
  /** The editor body. */
  renderEditor: (props: { state: TState; onChange: (next: TState) => void; disabled: boolean }) => ReactNode;
}

const secondaryButton =
  'inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3.5 py-2 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100 disabled:opacity-50';
const primaryButton =
  'inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50';
const plainButton =
  'inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50';

/**
 * Why the item cannot be published yet.
 *
 * Shown as a list rather than a single line because an unfinished activity
 * usually has several things outstanding, and telling an author about them one
 * save at a time is the slowest possible way to finish one.
 */
function PublishBlockers({ problems }: { problems: string[] }) {
  if (problems.length === 0) return null;

  return (
    <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      <p className="font-medium">Not ready to publish yet</p>
      <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs">
        {problems.map((problem) => (
          <li key={problem}>{problem}</li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

function CreateInner<TRow extends H5pContentRow, TState, TPayload>(spec: ContentTypeFormSpec<TRow, TState, TPayload>) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const ctx: H5pContext = useMemo(
    () => readH5pContext(new URLSearchParams(searchParams?.toString())),
    [searchParams]
  );
  const contextQuery = h5pContextQuery(ctx);

  const [state, setState] = useState<TState>(spec.emptyState);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const problems = spec.validate(state);

  const save = async (publish: boolean) => {
    setSaving(true);
    setError('');
    try {
      const result = await spec.api.create(ctx, spec.toPayload(state));

      if (publish && result.id) {
        try {
          await spec.api.publish(result.id, ctx, true);
        } catch (err: unknown) {
          // A refused publish is not a failed save. The draft is already
          // stored, so the author lands on the list with it there and the
          // server's specific reason shown.
          const reason = err instanceof Error ? err.message : 'Could not publish';
          router.push(`/h5p/${spec.path}?${h5pContextQuery(ctx, { flash: `Saved as a draft. ${reason}` })}`);
          return;
        }
      }

      router.push(
        `/h5p/${spec.path}?${h5pContextQuery(ctx, {
          flash: publish ? `${spec.noun} published.` : result.message,
        })}`
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : `Failed to create ${spec.noun}`);
      setSaving(false);
    }
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="mx-auto max-w-6xl">
        <H5pPageHeader
          title={spec.createTitle}
          description={spec.createDescription}
          ctx={ctx}
          backHref={`/h5p/${spec.path}?${contextQuery}`}
        />

        {!hasH5pContext(ctx) ? (
          <MissingContextNotice />
        ) : (
          <>
            <InlineBanner kind="error" message={error} onDismiss={() => setError('')} />
            <PublishBlockers problems={problems} />

            {spec.renderEditor({ state, onChange: setState, disabled: saving })}

            <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
              <button type="button" onClick={() => void save(false)} disabled={saving} className={primaryButton}>
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Save as draft
              </button>

              {problems.length === 0 ? (
                <button type="button" onClick={() => void save(true)} disabled={saving} className={secondaryButton}>
                  Save and publish
                </button>
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function ContentTypeCreatePage<TRow extends H5pContentRow, TState, TPayload>(
  spec: ContentTypeFormSpec<TRow, TState, TPayload>
) {
  return (
    <Suspense fallback={<LoadingState label="Loading editor…" />}>
      <CreateInner {...spec} />
    </Suspense>
  );
}

// ---------------------------------------------------------------------------
// Edit
// ---------------------------------------------------------------------------

function EditInner<TRow extends H5pContentRow, TState, TPayload>(spec: ContentTypeFormSpec<TRow, TState, TPayload>) {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';
  const searchParams = useSearchParams();
  const ctx: H5pContext = useMemo(
    () => readH5pContext(new URLSearchParams(searchParams?.toString())),
    [searchParams]
  );
  const contextQuery = h5pContextQuery(ctx);

  const [row, setRow] = useState<TRow | null>(null);
  const [state, setState] = useState<TState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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

    queueMicrotask(() => {
      if (!cancelled) {
        setLoading(true);
        setError('');
      }
    });

    spec.api
      .get(id, ctx)
      .then((data) => {
        if (cancelled) return;
        setRow(data);
        setState(spec.stateFromRow(data));
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : `Failed to load ${spec.noun}`);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // `spec` is a fresh object every render, so only the values that actually
    // address a row belong in the dependency list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, id, spec.path]);

  const problems = state ? spec.validate(state) : [];

  const save = async () => {
    if (!state) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const result = await spec.api.update(id, ctx, spec.toPayload(state));
      setSuccess(result.message);
      // Re-read rather than trusting local state: the server assigns child ids
      // on every save, and an editor holding the previous ones would send
      // stale references on the next one.
      const fresh = await spec.api.get(id, ctx);
      setRow(fresh);
      setState(spec.stateFromRow(fresh));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : `Failed to save ${spec.noun}`);
    } finally {
      setSaving(false);
    }
  };

  const togglePublish = async () => {
    if (!row) return;
    setPublishing(true);
    setError('');
    setSuccess('');
    try {
      const next = row.status !== 'published';
      const result = await spec.api.publish(id, ctx, next);
      setSuccess(result.message);
      setRow({ ...row, status: next ? 'published' : 'draft' });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to change publish state');
    } finally {
      setPublishing(false);
    }
  };

  const published = row?.status === 'published';

  return (
    <div className="p-4 sm:p-6">
      <div className="mx-auto max-w-6xl">
        <H5pPageHeader
          title={spec.editTitle}
          description={spec.editDescription}
          ctx={ctx}
          backHref={`/h5p/${spec.path}?${contextQuery}`}
          actions={
            row ? (
              <>
                <Link href={`/h5p/${spec.path}/${id}?${contextQuery}`} className={plainButton}>
                  <Eye className="h-3.5 w-3.5" />
                  Preview
                </Link>
                <button type="button" onClick={() => void togglePublish()} disabled={publishing} className={plainButton}>
                  {publishing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  {published ? 'Unpublish' : 'Publish'}
                </button>
              </>
            ) : null
          }
        />

        {!hasH5pContext(ctx) ? (
          <MissingContextNotice />
        ) : loading ? (
          <LoadingState label={`Loading ${spec.noun}…`} />
        ) : !state ? (
          <InlineBanner kind="error" message={error || `This ${spec.noun} could not be loaded.`} />
        ) : (
          <>
            <InlineBanner kind="success" message={success} onDismiss={() => setSuccess('')} />
            <InlineBanner kind="error" message={error} onDismiss={() => setError('')} />

            {published && problems.length > 0 ? (
              // Worth saying plainly: this item is live and no longer
              // publishable as edited. Saving is still allowed — the author is
              // mid-edit — but they should know before they walk away.
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                This activity is published, and the changes below would stop it being publishable. Students see the
                last saved version.
              </div>
            ) : null}

            <PublishBlockers problems={problems} />

            {spec.renderEditor({ state, onChange: setState, disabled: saving })}

            <div className="mt-5 flex items-center justify-end gap-2">
              <button type="button" onClick={() => void save()} disabled={saving} className={primaryButton}>
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Save changes
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function ContentTypeEditPage<TRow extends H5pContentRow, TState, TPayload>(
  spec: ContentTypeFormSpec<TRow, TState, TPayload>
) {
  return (
    <Suspense fallback={<LoadingState label="Loading editor…" />}>
      <EditInner {...spec} />
    </Suspense>
  );
}
