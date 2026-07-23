'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ExternalLink, Eye, Pencil, Plus, Search, Trash2, Video } from 'lucide-react';
import {
  deleteVideo,
  fetchVideos,
  h5pContextQuery,
  hasH5pContext,
  isStudentProfile,
  readH5pContext,
  type H5pInteractiveVideo,
} from '../data/h5p';
import {
  EmptyState,
  H5pPageHeader,
  InlineBanner,
  LoadingState,
  MissingContextNotice,
} from '../components/shared';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

/**
 * Interactive video list — mirrors Laravel `GET /h5p/h5p_interactive_video`
 * (resources/views/lms/h5p/interactiveVideo/index.blade.php).
 */

function InteractiveVideoListContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const ctx = useMemo(() => readH5pContext(new URLSearchParams(searchParams.toString())), [searchParams]);
  const flash = searchParams.get('flash') ?? '';

  const [videos, setVideos] = useState<H5pInteractiveVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);
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

  // Show the flash message from create/edit and clear it from the URL.
  useEffect(() => {
    if (flash) {
      let cancelled = false;
      queueMicrotask(() => {
        if (!cancelled) setSuccess(flash);
      });
      router.replace(`/h5p/h5p_interactive_video?${h5pContextQuery(ctx)}`);
      return () => {
        cancelled = true;
      };
    }
  }, [flash, ctx, router]);

  const loadVideos = useCallback(() => {
    if (!hasH5pContext(ctx)) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    fetchVideos(ctx)
      .then((list) => setVideos(list))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load videos'))
      .finally(() => setLoading(false));
  }, [ctx]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) loadVideos();
    });
    return () => {
      cancelled = true;
    };
  }, [loadVideos]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return videos;
    return videos.filter((video) => (video.title ?? '').toLowerCase().includes(term));
  }, [videos, search]);

  const contextQuery = h5pContextQuery(ctx);

  const handleDelete = async (video: H5pInteractiveVideo) => {
    if (!window.confirm(`Delete "${video.title ?? 'this video'}"? This cannot be undone.`)) return;
    setDeletingId(video.id);
    setError('');
    setSuccess('');
    try {
      const result = await deleteVideo(video.id, ctx);
      setSuccess(result.message);
      loadVideos();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete video');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="flex-1 overflow-auto p-4 sm:p-6">
      <div className="mx-auto max-w-5xl">
        <H5pPageHeader
          title="Interactive videos"
          description="Videos with timed questions and info cards"
          ctx={ctx}
          backHref={`/h5p/html_contents?${contextQuery}`}
          actions={
            !isStudent && hasH5pContext(ctx) ? (
              <Link
                href={`/h5p/h5p_interactive_video/create?${contextQuery}`}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#4f46e5] px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-[#4338ca]"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Video
              </Link>
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
              <LoadingState label="Loading videos…" />
            ) : videos.length === 0 ? (
              <EmptyState
                title="No interactive videos yet"
                hint="Upload a video and add timed questions to make it interactive."
                action={
                  !isStudent ? (
                    <Link
                      href={`/h5p/h5p_interactive_video/create?${contextQuery}`}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#4f46e5] px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-[#4338ca]"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add Video
                    </Link>
                  ) : null
                }
              />
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4">
                  <p className="text-sm font-medium text-slate-700">
                    {filtered.length} of {videos.length} video{videos.length === 1 ? '' : 's'}
                  </p>
                  <div className="relative w-full max-w-xs">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search by title…"
                      className="pl-8"
                    />
                  </div>
                </div>

                {filtered.length === 0 ? (
                  <p className="px-4 py-10 text-center text-sm text-slate-500">No videos match “{search}”.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16 px-4 text-slate-500">SR No</TableHead>
                        <TableHead className="text-slate-500">Title</TableHead>
                        <TableHead className="text-slate-500">Video</TableHead>
                        <TableHead className="text-slate-500">Interactions</TableHead>
                        <TableHead className="px-4 text-right text-slate-500">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((video, index) => (
                        <TableRow key={video.id}>
                          <TableCell className="px-4 text-slate-500">{index + 1}</TableCell>
                          <TableCell className="max-w-[280px]">
                            <span className="flex items-center gap-2">
                              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-[#4f46e5]">
                                <Video className="h-4 w-4" />
                              </span>
                              <span className="truncate font-medium text-slate-800">{video.title || 'Untitled'}</span>
                            </span>
                          </TableCell>
                          <TableCell>
                            {video.video_path ? (
                              <a
                                href={video.video_path}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs font-semibold text-[#4f46e5] hover:underline"
                              >
                                Open video
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            ) : (
                              <span className="text-xs text-slate-400">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-slate-600">
                            {video.interactions_count ?? video.interactions?.length ?? '—'}
                          </TableCell>
                          <TableCell className="px-4">
                            <span className="flex items-center justify-end gap-1.5">
                              <Link
                                href={`/h5p/h5p_interactive_video/${video.id}?${contextQuery}`}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-[#4f46e5]"
                                title="View"
                                aria-label="View video"
                              >
                                <Eye className="h-4 w-4" />
                              </Link>
                              {!isStudent ? (
                                <>
                                  <Link
                                    href={`/h5p/h5p_interactive_video/${video.id}/edit?${contextQuery}`}
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-[#4f46e5]"
                                    title="Edit"
                                    aria-label="Edit video"
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Link>
                                  <button
                                    type="button"
                                    onClick={() => handleDelete(video)}
                                    disabled={deletingId === video.id}
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                                    title="Delete"
                                    aria-label="Delete video"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </>
                              ) : null}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function InteractiveVideoListPage() {
  return (
    <Suspense fallback={<LoadingState label="Loading interactive videos…" />}>
      <InteractiveVideoListContent />
    </Suspense>
  );
}
