'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  Copy,
  Download,
  Eye,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  TEXT_ACTIVITY_DESCRIPTIONS,
  TEXT_ACTIVITY_LABELS,
  createTextActivity,
  deleteTextActivity,
  duplicateTextActivity,
  exportTextActivityPackage,
  fetchTextActivities,
  fetchTextActivity,
  h5pContextQuery,
  hasH5pContext,
  importTextActivityPackage,
  isStudentProfile,
  plainText,
  publishTextActivity,
  readH5pContext,
  textActivityRoute,
  updateTextActivity,
  type H5pTextActivity,
  type TextActivityType,
} from '../../data/h5p';
import {
  EmptyState,
  H5pPageHeader,
  InlineBanner,
  LoadingState,
  MissingContextNotice,
} from '../../components/shared';
import {
  TextActivityEditor,
  editorStateFrom,
  emptyEditorState,
  toSavePayload,
  validateEditorState,
  type TextActivityEditorState,
} from './editor';
import { TextActivityPlayer } from './player';

/**
 * The four screens each text-passage type needs -- list, create, edit, view --
 * written once and parametrised by type.
 *
 * The twelve files under `app/h5p/h5p_drag_text/`, `h5p_blanks/` and
 * `h5p_mark_the_words/` are each about five lines: they exist because Next.js
 * routes are directories, not because the screens differ. The alternative is
 * three copies of a list page with a draft/published rule in each, which is
 * three places for the next draft-leak bug to hide.
 */

function useH5pRouteContext() {
  const searchParams = useSearchParams();
  const ctx = useMemo(
    () => readH5pContext(new URLSearchParams(searchParams?.toString())),
    [searchParams]
  );

  return { ctx, contextQuery: h5pContextQuery(ctx), searchParams };
}

function statusChip(activity: H5pTextActivity) {
  const published = activity.status === 'published';
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
        published ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
      }`}
    >
      {published ? 'Published' : 'Draft'}
    </span>
  );
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

function ListContent({ type }: { type: TextActivityType }) {
  const router = useRouter();
  const { ctx, contextQuery, searchParams } = useH5pRouteContext();
  const base = textActivityRoute(type);
  const importInputRef = useRef<HTMLInputElement>(null);

  const [activities, setActivities] = useState<H5pTextActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [isStudent, setIsStudent] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setIsStudent(isStudentProfile());
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const load = useCallback(async () => {
    if (!hasH5pContext(ctx)) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setActivities(await fetchTextActivities(type, ctx));
      setError('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load activities');
    } finally {
      setLoading(false);
    }
  }, [ctx, type]);

  // Deferred out of the effect body, the way the drag-and-drop list does it:
  // `load` sets state synchronously on its first line, and doing that inside
  // an effect body is a cascading render.
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void load();
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  // A flash forwarded from create/edit; show it, then strip it from the URL so
  // a reload or a back does not show the same message a second time.
  const flash = searchParams?.get('flash');
  useEffect(() => {
    if (!flash) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setSuccess(flash);
    });
    router.replace(`${base}?${h5pContextQuery(ctx)}`);
    return () => {
      cancelled = true;
    };
  }, [flash, ctx, router, base]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (term === '') return activities;
    return activities.filter(
      (activity) =>
        (activity.title ?? '').toLowerCase().includes(term) ||
        plainText(activity.passage).toLowerCase().includes(term)
    );
  }, [activities, search]);

  const run = async (id: number, action: () => Promise<string>) => {
    setBusyId(id);
    setError('');
    try {
      setSuccess(await action());
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'That did not work');
    } finally {
      setBusyId(null);
    }
  };

  const importPackage = async (file: File) => {
    setImporting(true);
    setError('');
    try {
      const result = await importTextActivityPackage(type, ctx, file);
      setSuccess(
        result.warnings.length > 0
          ? `${result.message} ${result.warnings.join(' ')}`
          : result.message
      );
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to import package');
    } finally {
      setImporting(false);
      if (importInputRef.current) importInputRef.current.value = '';
    }
  };

  return (
    <div className="flex-1 overflow-auto p-4 sm:p-6">
      <div className="mx-auto max-w-6xl">
        <H5pPageHeader
          title={TEXT_ACTIVITY_LABELS[type]}
          description={TEXT_ACTIVITY_DESCRIPTIONS[type]}
          ctx={ctx}
          backHref={`/h5p/html_contents?${contextQuery}`}
          actions={
            isStudent ? null : (
              <>
                <button
                  type="button"
                  onClick={() => importInputRef.current?.click()}
                  disabled={importing || !hasH5pContext(ctx)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {importing ? 'Importing…' : 'Import .h5p'}
                </button>
                <Link
                  href={`${base}/create?${contextQuery}`}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#4f46e5] px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-[#4338ca]"
                >
                  <Plus className="h-4 w-4" />
                  New activity
                </Link>
              </>
            )
          }
        />

        <input
          ref={importInputRef}
          type="file"
          accept=".h5p,application/zip"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void importPackage(file);
          }}
        />

        {!hasH5pContext(ctx) ? (
          <MissingContextNotice />
        ) : (
          <>
            <InlineBanner kind="error" message={error} onDismiss={() => setError('')} />
            <InlineBanner kind="success" message={success} onDismiss={() => setSuccess('')} />

            <div className="mb-4 flex items-center gap-2">
              <div className="relative max-w-sm flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by title or passage"
                  className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#4f46e5] focus:ring-2 focus:ring-indigo-100"
                />
              </div>
              <span className="text-xs text-slate-400">
                {filtered.length} of {activities.length}
              </span>
            </div>

            {loading ? (
              <LoadingState label="Loading activities…" />
            ) : filtered.length === 0 ? (
              <EmptyState
                title={
                  activities.length === 0
                    ? `No ${TEXT_ACTIVITY_LABELS[type].toLowerCase()} activities in this chapter yet`
                    : 'Nothing matches that search'
                }
                hint={
                  activities.length === 0 && !isStudent
                    ? 'Create one, or import a .h5p package authored elsewhere.'
                    : undefined
                }
                action={
                  activities.length === 0 && !isStudent ? (
                    <Link
                      href={`${base}/create?${contextQuery}`}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#4f46e5] px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-[#4338ca]"
                    >
                      <Plus className="h-4 w-4" />
                      New activity
                    </Link>
                  ) : undefined
                }
              />
            ) : (
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50">
                    <tr className="text-[11px] uppercase tracking-wide text-slate-500">
                      <th className="px-4 py-2.5 font-semibold">Title</th>
                      <th className="px-4 py-2.5 font-semibold">Answers</th>
                      {isStudent ? null : <th className="px-4 py-2.5 font-semibold">Status</th>}
                      <th className="px-4 py-2.5 text-right font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filtered.map((activity) => (
                      <tr key={activity.id} className="transition hover:bg-slate-50/60">
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-900">{activity.title || 'Untitled'}</p>
                          <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">
                            {plainText(activity.passage) || '—'}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600">
                          {activity.blank_count ?? 0}
                          {activity.distractor_count ? (
                            <span className="text-slate-400"> · {activity.distractor_count} spare</span>
                          ) : null}
                        </td>
                        {isStudent ? null : <td className="px-4 py-3">{statusChip(activity)}</td>}
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <Link
                              href={`${base}/${activity.id}?${contextQuery}`}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                              aria-label="Open"
                            >
                              <Eye className="h-4 w-4" />
                            </Link>

                            {isStudent ? null : (
                              <>
                                <Link
                                  href={`${base}/${activity.id}/edit?${contextQuery}`}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                                  aria-label="Edit"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Link>

                                <button
                                  type="button"
                                  disabled={busyId === activity.id}
                                  onClick={() =>
                                    void run(activity.id, async () => {
                                      const copy = await duplicateTextActivity(type, activity.id, ctx);
                                      return copy.message;
                                    })
                                  }
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40"
                                  aria-label="Duplicate"
                                >
                                  <Copy className="h-4 w-4" />
                                </button>

                                <button
                                  type="button"
                                  disabled={busyId === activity.id}
                                  onClick={() =>
                                    void run(activity.id, async () => {
                                      const { warningCount } = await exportTextActivityPackage(
                                        type,
                                        activity.id,
                                        ctx
                                      );
                                      return warningCount > 0
                                        ? `Package downloaded, with ${warningCount} ${
                                            warningCount === 1 ? 'warning' : 'warnings'
                                          } — some detail could not be carried into ${
                                            TEXT_ACTIVITY_LABELS[type]
                                          }.`
                                        : 'Package downloaded.';
                                    })
                                  }
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40"
                                  aria-label="Export as .h5p"
                                >
                                  <Download className="h-4 w-4" />
                                </button>

                                <button
                                  type="button"
                                  disabled={busyId === activity.id}
                                  onClick={() =>
                                    void run(activity.id, async () => {
                                      const result = await publishTextActivity(
                                        type,
                                        activity.id,
                                        ctx,
                                        activity.status !== 'published'
                                      );
                                      return result.message;
                                    })
                                  }
                                  className="rounded-lg px-2 py-1.5 text-[11px] font-semibold text-indigo-600 transition hover:bg-indigo-50 disabled:opacity-40"
                                >
                                  {activity.status === 'published' ? 'Unpublish' : 'Publish'}
                                </button>

                                <button
                                  type="button"
                                  disabled={busyId === activity.id}
                                  onClick={() => {
                                    if (
                                      !window.confirm(
                                        `Delete “${activity.title || 'Untitled'}”? This cannot be undone from here.`
                                      )
                                    ) {
                                      return;
                                    }
                                    void run(activity.id, async () => {
                                      const result = await deleteTextActivity(type, activity.id, ctx);
                                      return result.message;
                                    });
                                  }}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                                  aria-label="Delete"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export function TextActivityListPage({ type }: { type: TextActivityType }) {
  return (
    <Suspense fallback={<LoadingState label="Loading activities…" />}>
      <ListContent type={type} />
    </Suspense>
  );
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

function CreateContent({ type }: { type: TextActivityType }) {
  const router = useRouter();
  const { ctx, contextQuery } = useH5pRouteContext();
  const base = textActivityRoute(type);

  const [state, setState] = useState<TextActivityEditorState>(emptyEditorState);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const canPublish = validateEditorState(type, state).length === 0;

  /**
   * Save and publish are one control with two outcomes rather than two
   * buttons: "Save as draft" always works, "Save and publish" is offered only
   * once the activity is actually publishable. Publishing is a second request
   * because it is a second decision the server independently re-checks -- the
   * activity exists either way, and a refused publish leaves a saved draft,
   * not a lost one.
   */
  const save = async (publish: boolean) => {
    setSaving(true);
    setError('');
    try {
      const result = await createTextActivity(type, ctx, toSavePayload(type, state));

      if (publish && result.id) {
        try {
          await publishTextActivity(type, result.id, ctx, true);
        } catch (err: unknown) {
          const reason = err instanceof Error ? err.message : 'Could not publish';
          router.push(`${base}?${h5pContextQuery(ctx, { flash: `Saved as a draft. ${reason}` })}`);
          return;
        }
      }

      router.push(
        `${base}?${h5pContextQuery(ctx, {
          flash: publish ? 'Activity published.' : result.message,
        })}`
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create activity');
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 overflow-auto p-4 sm:p-6">
      <div className="mx-auto max-w-6xl">
        <H5pPageHeader
          title={`New ${TEXT_ACTIVITY_LABELS[type].toLowerCase()} activity`}
          description={TEXT_ACTIVITY_DESCRIPTIONS[type]}
          ctx={ctx}
          backHref={`${base}?${contextQuery}`}
        />

        {!hasH5pContext(ctx) ? (
          <MissingContextNotice />
        ) : (
          <>
            <InlineBanner kind="error" message={error} onDismiss={() => setError('')} />
            <TextActivityEditor
              type={type}
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

export function TextActivityCreatePage({ type }: { type: TextActivityType }) {
  return (
    <Suspense fallback={<LoadingState label="Loading editor…" />}>
      <CreateContent type={type} />
    </Suspense>
  );
}

// ---------------------------------------------------------------------------
// Edit
// ---------------------------------------------------------------------------

function EditContent({ type }: { type: TextActivityType }) {
  const router = useRouter();
  const params = useParams();
  const id = String(params?.id ?? '');
  const { ctx, contextQuery } = useH5pRouteContext();
  const base = textActivityRoute(type);

  const [state, setState] = useState<TextActivityEditorState | null>(null);
  const [activity, setActivity] = useState<H5pTextActivity | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const row = await fetchTextActivity(type, id, ctx);
        if (cancelled) return;
        setActivity(row);
        setState(editorStateFrom(row));
      } catch (err: unknown) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load activity');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ctx, id, type]);

  const canPublish = state !== null && validateEditorState(type, state).length === 0;

  const save = async (publish: boolean) => {
    if (!state) return;
    setSaving(true);
    setError('');
    try {
      const result = await updateTextActivity(type, id, ctx, toSavePayload(type, state));

      if (publish) {
        try {
          await publishTextActivity(type, id, ctx, true);
        } catch (err: unknown) {
          const reason = err instanceof Error ? err.message : 'Could not publish';
          router.push(`${base}?${h5pContextQuery(ctx, { flash: `Changes saved. ${reason}` })}`);
          return;
        }
      }

      router.push(
        `${base}?${h5pContextQuery(ctx, {
          flash: publish ? 'Activity published.' : result.message,
        })}`
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save changes');
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 overflow-auto p-4 sm:p-6">
      <div className="mx-auto max-w-6xl">
        <H5pPageHeader
          title={activity?.title ? `Edit — ${activity.title}` : 'Edit activity'}
          description={TEXT_ACTIVITY_DESCRIPTIONS[type]}
          ctx={ctx}
          backHref={`${base}?${contextQuery}`}
        />

        <InlineBanner kind="error" message={error} onDismiss={() => setError('')} />

        {loading ? (
          <LoadingState label="Loading activity…" />
        ) : state === null ? (
          <EmptyState title="That activity could not be opened" />
        ) : (
          <TextActivityEditor
            type={type}
            state={state}
            onChange={setState}
            onSave={() => void save(false)}
            saving={saving}
            saveLabel="Save changes"
            secondaryAction={
              canPublish && activity?.status !== 'published' ? (
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
        )}
      </div>
    </div>
  );
}

export function TextActivityEditPage({ type }: { type: TextActivityType }) {
  return (
    <Suspense fallback={<LoadingState label="Loading editor…" />}>
      <EditContent type={type} />
    </Suspense>
  );
}

// ---------------------------------------------------------------------------
// View / play
// ---------------------------------------------------------------------------

function ViewContent({ type }: { type: TextActivityType }) {
  const params = useParams();
  const id = String(params?.id ?? '');
  const { ctx, contextQuery } = useH5pRouteContext();
  const base = textActivityRoute(type);

  const [activity, setActivity] = useState<H5pTextActivity | null>(null);
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
    (async () => {
      try {
        const row = await fetchTextActivity(type, id, ctx);
        if (!cancelled) setActivity(row);
      } catch (err: unknown) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load activity');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ctx, id, type]);

  return (
    <div className="flex-1 overflow-auto p-4 sm:p-6">
      <div className="mx-auto max-w-3xl">
        <H5pPageHeader
          title={activity?.title || TEXT_ACTIVITY_LABELS[type]}
          ctx={ctx}
          backHref={`${base}?${contextQuery}`}
          actions={
            !isStudent && activity ? (
              <Link
                href={`${base}/${activity.id}/edit?${contextQuery}`}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                <Pencil className="h-4 w-4" />
                Edit
              </Link>
            ) : null
          }
        />

        <InlineBanner kind="error" message={error} onDismiss={() => setError('')} />

        {loading ? (
          <LoadingState label="Loading activity…" />
        ) : activity === null ? (
          <EmptyState title="That activity could not be opened" />
        ) : (
          <>
            {/* A teacher previewing a draft should be in no doubt that this is
                not what a class can see. */}
            {activity.status !== 'published' && !isStudent ? (
              <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
                This is a draft. Students cannot see it until it is published.
              </div>
            ) : null}

            <TextActivityPlayer type={type} activity={activity} ctx={ctx} />
          </>
        )}
      </div>
    </div>
  );
}

export function TextActivityViewPage({ type }: { type: TextActivityType }) {
  return (
    <Suspense fallback={<LoadingState label="Loading activity…" />}>
      <ViewContent type={type} />
    </Suspense>
  );
}
