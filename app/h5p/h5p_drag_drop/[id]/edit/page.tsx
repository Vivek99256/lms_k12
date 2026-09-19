'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Eye, Loader2 } from 'lucide-react';
import Link from 'next/link';
import {
  fetchDragDrop,
  h5pContextQuery,
  hasH5pContext,
  publishDragDrop,
  readH5pContext,
  updateDragDrop,
  type H5pDragDrop,
} from '../../../data/h5p';
import {
  H5pPageHeader,
  InlineBanner,
  LoadingState,
  MissingContextNotice,
} from '../../../components/shared';
import {
  DragDropEditor,
  editorStateFromTask,
  toSavePayload,
  validateEditorState,
  type DragDropEditorState,
} from '../../components/editor';

/**
 * Drag and drop — edit page.
 *
 * Editing a published activity saves in place; it does not silently return it
 * to draft. A teacher fixing a typo mid-term should not have their class lose
 * access to the activity because of it. Taking it down is an explicit action —
 * the publish toggle in the header.
 */
function DragDropEditContent() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';
  const searchParams = useSearchParams();
  const ctx = useMemo(
    () => readH5pContext(new URLSearchParams(searchParams?.toString())),
    [searchParams]
  );
  const contextQuery = h5pContextQuery(ctx);

  const [task, setTask] = useState<H5pDragDrop | null>(null);
  const [state, setState] = useState<DragDropEditorState | null>(null);
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

    fetchDragDrop(id, ctx)
      .then((data) => {
        if (cancelled) return;
        setTask(data);
        setState(editorStateFromTask(data));
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load activity');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [ctx, id]);

  const save = async () => {
    if (!state) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const result = await updateDragDrop(id, ctx, toSavePayload(state));
      router.push(`/h5p/h5p_drag_drop?${h5pContextQuery(ctx, { flash: result.message })}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update activity');
      setSaving(false);
    }
  };

  /**
   * Publish from the editor saves first.
   *
   * The server checks the STORED task, not the one on screen, so publishing
   * unsaved edits would either publish the old version or refuse for a problem
   * the author has already fixed.
   */
  const togglePublish = async () => {
    if (!state || !task) return;
    const next = task.status !== 'published';

    setPublishing(true);
    setError('');
    setSuccess('');
    try {
      await updateDragDrop(id, ctx, toSavePayload(state));
      const result = await publishDragDrop(id, ctx, next);
      setTask({ ...task, status: next ? 'published' : 'draft' });
      setSuccess(result.message);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to change publish state');
    } finally {
      setPublishing(false);
    }
  };

  const problems = state ? validateEditorState(state) : [];
  const published = task?.status === 'published';

  return (
    <div className="flex-1 overflow-auto p-4 sm:p-6">
      <div className="mx-auto max-w-6xl">
        <H5pPageHeader
          title={task?.title ? `Edit — ${task.title}` : 'Edit activity'}
          description="Change the background, zones, draggables or scoring"
          ctx={ctx}
          backHref={`/h5p/h5p_drag_drop?${contextQuery}`}
          actions={
            task ? (
              <>
                <Link
                  href={`/h5p/h5p_drag_drop/${id}?${contextQuery}`}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  <Eye className="h-3.5 w-3.5" />
                  Preview
                </Link>
                <button
                  type="button"
                  onClick={() => void togglePublish()}
                  disabled={publishing || (!published && problems.length > 0)}
                  title={
                    !published && problems.length > 0
                      ? 'Fix the items listed at the bottom of the page first.'
                      : undefined
                  }
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition disabled:opacity-50 ${
                    published
                      ? 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                      : 'border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                  }`}
                >
                  {publishing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  {published ? 'Move to draft' : 'Save and publish'}
                </button>
              </>
            ) : null
          }
        />

        {!hasH5pContext(ctx) ? (
          <MissingContextNotice />
        ) : (
          <>
            <InlineBanner kind="success" message={success} onDismiss={() => setSuccess('')} />
            <InlineBanner kind="error" message={error} onDismiss={() => setError('')} />

            {loading ? (
              <LoadingState label="Loading activity…" />
            ) : state ? (
              <DragDropEditor
                state={state}
                onChange={setState}
                onSave={() => void save()}
                saving={saving}
                saveLabel="Save changes"
              />
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

export default function DragDropEditPage() {
  return (
    <Suspense fallback={<LoadingState label="Loading editor…" />}>
      <DragDropEditContent />
    </Suspense>
  );
}
