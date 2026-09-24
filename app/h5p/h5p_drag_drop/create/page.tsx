'use client';

import { Suspense, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  createDragDrop,
  h5pContextQuery,
  hasH5pContext,
  publishDragDrop,
  readH5pContext,
} from '../../data/h5p';
import {
  H5pPageHeader,
  InlineBanner,
  LoadingState,
  MissingContextNotice,
} from '../../components/shared';
import {
  DragDropEditor,
  emptyEditorState,
  toSavePayload,
  validateEditorState,
  type DragDropEditorState,
} from '../components/editor';

/**
 * Drag and drop — create page.
 *
 * Save and publish are one control with two outcomes rather than two buttons:
 * "Save as draft" always works, "Save and publish" is offered only once the
 * task is actually publishable. Publishing is a second request because it is a
 * second decision the server independently re-checks — the activity exists
 * either way, and a refused publish leaves a saved draft, not a lost one.
 */
function DragDropCreateContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const ctx = useMemo(
    () => readH5pContext(new URLSearchParams(searchParams?.toString())),
    [searchParams]
  );
  const contextQuery = h5pContextQuery(ctx);
  const returnTo = searchParams?.get('return_to') || null;

  const [state, setState] = useState<DragDropEditorState>(emptyEditorState);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const problems = validateEditorState(state);
  const canPublish = problems.length === 0;

  const save = async (publish: boolean) => {
    setSaving(true);
    setError('');
    try {
      const result = await createDragDrop(ctx, toSavePayload(state));

      if (publish && result.id) {
        // A refused publish is not a failed save. The draft is already stored,
        // so the author lands on the list with it there and the reason shown.
        try {
          await publishDragDrop(result.id, ctx, true);
        } catch (err: unknown) {
          const reason = err instanceof Error ? err.message : 'Could not publish';
          router.push(
            `/h5p/h5p_drag_drop?${h5pContextQuery(ctx, { flash: `Saved as a draft. ${reason}` })}`
          );
          return;
        }
      }

      router.push(
        `/h5p/h5p_drag_drop?${h5pContextQuery(ctx, {
          flash: publish ? 'Activity published.' : result.message,
        })}`
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create activity');
      setSaving(false);
    }
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="mx-auto max-w-6xl">
        <H5pPageHeader
          title="New drag and drop activity"
          description="Learners drag text or images into the correct drop zones"
          ctx={ctx}
          backHref={returnTo ?? `/h5p/h5p_drag_drop?${contextQuery}`}
        />

        {!hasH5pContext(ctx) ? (
          <MissingContextNotice />
        ) : (
          <>
            <InlineBanner kind="error" message={error} onDismiss={() => setError('')} />

            <DragDropEditor
              state={state}
              onChange={setState}
              onSave={() => void save(false)}
              saving={saving}
              saveLabel="Save as draft"
              secondaryAction={
                canPublish ? (
                  <button
                    type="button"
                    onClick={() => void save(true)}
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3.5 py-2 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100 disabled:opacity-50"
                  >
                    Save and publish
                  </button>
                ) : null
              }
            />
          </>
        )}
      </div>
    </div>
  );
}

export default function DragDropCreatePage() {
  return (
    <Suspense fallback={<LoadingState label="Loading editor…" />}>
      <DragDropCreateContent />
    </Suspense>
  );
}
