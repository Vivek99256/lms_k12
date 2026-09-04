'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Globe,
  Lock,
  MessageSquare,
  Paperclip,
  Plus,
  RefreshCw,
  Search,
  Send,
  Users,
  X,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import {
  createComment,
  createPost,
  fetchChapters,
  fetchFeed,
  fetchSubjects,
  fetchThread,
  fetchTopics,
  type ScComment,
  type ScNewPost,
  type ScOption,
  type ScPost,
} from '@/app/lms/data/socialCollaborative';

const PER_PAGE = 10;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

/** "2 days ago" style label, from the API's own day count where possible. */
function timeAgo(createdAt: string, totalDays?: number): string {
  if (typeof totalDays === 'number' && totalDays > 0) {
    if (totalDays === 1) return 'Yesterday';
    if (totalDays < 30) return `${totalDays} days ago`;
    if (totalDays < 365) return `${Math.round(totalDays / 30)} months ago`;
    return `${Math.round(totalDays / 365)} years ago`;
  }

  const date = new Date(createdAt.replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) return createdAt;

  const minutes = Math.round((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 1440) return `${Math.round(minutes / 60)} hours ago`;
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** The description is stored as editor HTML; render it as plain text safely. */
function toPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/* -------------------------------------------------------------------------- */
/* Building blocks                                                            */
/* -------------------------------------------------------------------------- */

function Avatar({ name, src, className }: { name: string; src?: string; className?: string }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <span
        className={cn(
          'flex shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700',
          className
        )}
        aria-hidden
      >
        {initials(name) || '?'}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      onError={() => setFailed(true)}
      className={cn('shrink-0 rounded-full object-cover', className)}
    />
  );
}

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-slate-200/70', className)} aria-hidden />;
}

function VisibilityBadge({ visibility }: { visibility: string }) {
  const isPrivate = visibility === 'private';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
        isPrivate ? 'bg-slate-100 text-slate-600' : 'bg-emerald-50 text-emerald-700'
      )}
    >
      {isPrivate ? <Lock className="size-3" /> : <Globe className="size-3" />}
      {isPrivate ? 'Class only' : 'Public'}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Compose                                                                    */
/* -------------------------------------------------------------------------- */

function ComposeDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (post: ScPost) => void }) {
  const [subjects, setSubjects] = useState<ScOption[]>([]);
  const [chapters, setChapters] = useState<ScOption[]>([]);
  const [topics, setTopics] = useState<ScOption[]>([]);

  const [subjectId, setSubjectId] = useState('');
  const [chapterId, setChapterId] = useState('');
  const [topicId, setTopicId] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<ScNewPost['visibility']>('public');
  const [file, setFile] = useState<File | null>(null);

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    fetchSubjects(controller.signal)
      .then(setSubjects)
      .catch(() => setSubjects([]));
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      if (!subjectId) {
        setChapters([]);
        return;
      }
      fetchChapters(subjectId, controller.signal)
        .then(setChapters)
        .catch(() => setChapters([]));
    });
    return () => controller.abort();
  }, [subjectId]);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      if (!chapterId) {
        setTopics([]);
        return;
      }
      fetchTopics(chapterId, controller.signal)
        .then(setTopics)
        .catch(() => setTopics([]));
    });
    return () => controller.abort();
  }, [chapterId]);

  // The ERP composes the title as "Subject / Chapter / Topic" — same rule here.
  const title = useMemo(() => {
    const parts = [
      subjects.find((option) => String(option.id) === subjectId)?.name,
      chapters.find((option) => String(option.id) === chapterId)?.name,
      topics.find((option) => String(option.id) === topicId)?.name,
    ].filter(Boolean);
    return parts.join(' / ');
  }, [subjects, chapters, topics, subjectId, chapterId, topicId]);

  const submit = async () => {
    if (!title) {
      setFormError('Choose at least a subject so the discussion has a title.');
      return;
    }
    if (!description.trim()) {
      setFormError('Write your question before posting.');
      return;
    }

    setSaving(true);
    setFormError('');
    try {
      const post = await createPost({ subjectId, chapterId, topicId, title, description, visibility, file });
      onCreated(post);
    } catch (error) {
      setFormError(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Start a discussion"
        className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl"
      >
        <header className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
          <h2 className="text-sm font-semibold text-slate-900">Start a discussion</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">Subject</span>
              <select
                value={subjectId}
                onChange={(event) => {
                  setSubjectId(event.target.value);
                  setChapterId('');
                  setTopicId('');
                }}
                className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">Select</option>
                {subjects.map((option) => (
                  <option key={option.id} value={String(option.id)}>
                    {option.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">Chapter</span>
              <select
                value={chapterId}
                disabled={!subjectId}
                onChange={(event) => {
                  setChapterId(event.target.value);
                  setTopicId('');
                }}
                className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50"
              >
                <option value="">Select</option>
                {chapters.map((option) => (
                  <option key={option.id} value={String(option.id)}>
                    {option.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">Topic</span>
              <select
                value={topicId}
                disabled={!chapterId}
                onChange={(event) => setTopicId(event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50"
              >
                <option value="">Select</option>
                {topics.map((option) => (
                  <option key={option.id} value={String(option.id)}>
                    {option.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {title ? (
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
              Title: <span className="font-medium text-slate-800">{title}</span>
            </p>
          ) : null}

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Your question</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={5}
              placeholder="Describe what you would like help with…"
              className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </label>

          <div className="flex flex-wrap items-center gap-4">
            <fieldset className="flex items-center gap-3">
              <legend className="sr-only">Who can see this</legend>
              {(['public', 'private'] as const).map((option) => (
                <label key={option} className="flex items-center gap-1.5 text-sm text-slate-700">
                  <input
                    type="radio"
                    name="visibility"
                    value={option}
                    checked={visibility === option}
                    onChange={() => setVisibility(option)}
                    className="size-3.5 accent-indigo-600"
                  />
                  {option === 'public' ? 'Everyone' : 'My class only'}
                </label>
              ))}
            </fieldset>

            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50">
              <Paperclip className="size-3.5" />
              {file ? file.name.slice(0, 24) : 'Attach a file'}
              <input
                type="file"
                className="hidden"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            </label>
            {file ? (
              <button
                type="button"
                onClick={() => setFile(null)}
                className="text-xs font-medium text-slate-500 underline underline-offset-2"
              >
                Remove
              </button>
            ) : null}
          </div>

          {formError ? (
            <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {formError}
            </p>
          ) : null}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60"
          >
            {saving ? 'Posting…' : 'Post discussion'}
          </button>
        </footer>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Feed card                                                                  */
/* -------------------------------------------------------------------------- */

function PostCard({ post, onUpdated }: { post: ScPost; onUpdated: (post: ScPost) => void }) {
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState<ScComment[] | null>(post.comments ?? null);
  const [loading, setLoading] = useState(false);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [threadError, setThreadError] = useState('');

  const toggle = async () => {
    const next = !open;
    setOpen(next);

    if (next && comments === null) {
      setLoading(true);
      setThreadError('');
      try {
        const thread = await fetchThread(post.id);
        setComments(thread.comments ?? []);
      } catch (error) {
        setThreadError(errorMessage(error));
      } finally {
        setLoading(false);
      }
    }
  };

  const send = async () => {
    if (!reply.trim()) return;
    setSending(true);
    setThreadError('');
    try {
      const comment = await createComment(post.id, reply.trim());
      setComments((current) => [...(current ?? []), comment]);
      setReply('');
      onUpdated({ ...post, commentCount: post.commentCount + 1 });
    } catch (error) {
      setThreadError(errorMessage(error));
    } finally {
      setSending(false);
    }
  };

  const body = toPlainText(post.description);

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="p-4 sm:p-5">
        <header className="flex items-start gap-3">
          <Avatar name={post.author.name} src={post.author.avatarUrl} className="size-10" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-sm font-semibold text-slate-900">{post.author.name}</span>
              {post.author.className ? (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                  {post.author.className}
                </span>
              ) : (
                <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700">
                  Staff
                </span>
              )}
              <span className="text-xs text-slate-400">{timeAgo(post.createdAt, post.totalDays)}</span>
            </div>
            <p className="mt-0.5 truncate text-xs text-slate-500">{post.title}</p>
          </div>
          <VisibilityBadge visibility={post.visibility} />
        </header>

        <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-700">{body || 'No details added.'}</p>

        {post.attachmentUrl ? (
          <a
            href={post.attachmentUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-indigo-600 transition hover:bg-indigo-50"
          >
            <Paperclip className="size-3.5" />
            View attachment
          </a>
        ) : null}
      </div>

      <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-2 sm:px-5">
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 transition hover:text-indigo-600"
        >
          <MessageSquare className="size-3.5" />
          {post.commentCount === 0
            ? 'Be the first to reply'
            : `${post.commentCount} ${post.commentCount === 1 ? 'reply' : 'replies'}`}
        </button>
      </div>

      {open ? (
        <div className="border-t border-slate-100 px-4 py-3 sm:px-5">
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>
          ) : threadError ? (
            <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {threadError}
            </p>
          ) : comments && comments.length > 0 ? (
            <ul className="space-y-3">
              {comments.map((comment) => (
                <li key={comment.id} className="flex gap-2.5">
                  <Avatar name={comment.author.name} src={comment.author.avatarUrl} className="size-8" />
                  <div className="min-w-0 flex-1 rounded-xl bg-slate-50 px-3 py-2">
                    <div className="flex flex-wrap items-center gap-x-2">
                      <span className="text-xs font-semibold text-slate-800">{comment.author.name}</span>
                      {comment.author.className ? (
                        <span className="text-[11px] text-slate-500">{comment.author.className}</span>
                      ) : null}
                      <span className="text-[11px] text-slate-400">{timeAgo(comment.createdAt)}</span>
                    </div>
                    <p className="mt-0.5 whitespace-pre-line text-sm text-slate-700">{comment.message}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-2 text-center text-xs text-slate-500">No replies yet. Start the conversation.</p>
          )}

          <div className="mt-3 flex items-end gap-2">
            <textarea
              value={reply}
              onChange={(event) => setReply(event.target.value)}
              rows={2}
              placeholder="Write a reply…"
              aria-label="Write a reply"
              className="min-h-[42px] flex-1 resize-y rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <button
              type="button"
              onClick={send}
              disabled={sending || !reply.trim()}
              className="inline-flex h-[42px] items-center gap-1.5 rounded-xl bg-indigo-600 px-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
            >
              <Send className="size-4" />
              <span className="hidden sm:inline">{sending ? 'Sending…' : 'Reply'}</span>
            </button>
          </div>
        </div>
      ) : null}
    </article>
  );
}

/* -------------------------------------------------------------------------- */
/* Page                                                                        */
/* -------------------------------------------------------------------------- */

export default function SocialCollaborativePage() {
  const [posts, setPosts] = useState<ScPost[]>([]);
  const [total, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(1);
  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [errorText, setErrorText] = useState('');

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [visibility, setVisibility] = useState('');
  const [mine, setMine] = useState(false);

  const [composing, setComposing] = useState(false);

  // Debounce the search box so typing does not hammer the API.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const load = useCallback(
    (targetPage: number, signal?: AbortSignal) => {
      if (targetPage === 1) {
        setLoading(true);
        setErrorText('');
      } else {
        setLoadingMore(true);
      }

      fetchFeed({ search, visibility, mine, page: targetPage, perPage: PER_PAGE }, signal)
        .then((result) => {
          if (signal?.aborted) return;
          setPosts((current) => (targetPage === 1 ? result.items : [...current, ...result.items]));
          setTotal(result.total);
          setLastPage(result.lastPage);
          setLoading(false);
          setLoadingMore(false);
        })
        .catch((error: unknown) => {
          if (signal?.aborted) return;
          if (targetPage === 1) setPosts([]);
          setErrorText(errorMessage(error));
          setLoading(false);
          setLoadingMore(false);
        });
    },
    [search, visibility, mine]
  );

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      setPage(1);
      load(1, controller.signal);
    });
    return () => controller.abort();
  }, [load]);

  const loadMore = () => {
    const next = page + 1;
    setPage(next);
    load(next);
  };

  const replacePost = (updated: ScPost) => {
    setPosts((current) => current.map((post) => (post.id === updated.id ? { ...post, ...updated } : post)));
  };

  return (
    <div className="min-h-full px-4 py-5 sm:px-6">
      <div className="mx-auto w-full  space-y-5">
        {/* Header ---------------------------------------------------------- */}
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
              <Users className="size-5" />
            </span>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
                Social &amp; collaborative
              </h1>
              <p className="mt-0.5 text-sm text-slate-500">
                Ask a question about any chapter and get answers from classmates and teachers.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => load(1)}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
            >
              <RefreshCw className={cn('size-3.5', loading && 'animate-spin')} />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => setComposing(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700"
            >
              <Plus className="size-3.5" />
              Start a discussion
            </button>
          </div>
        </header>

        {/* Filters --------------------------------------------------------- */}
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2.5 shadow-sm">
          <div className="relative min-w-[180px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search discussions"
              aria-label="Search discussions"
              className="w-full rounded-lg border border-slate-300 py-2 pl-8 pr-3 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <select
            aria-label="Visibility"
            value={visibility}
            onChange={(event) => setVisibility(event.target.value)}
            className="rounded-lg border border-slate-300 px-2.5 py-2 text-xs text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">All discussions</option>
            <option value="public">Public</option>
            <option value="private">Class only</option>
          </select>

          <label className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 py-2 text-xs font-medium text-slate-700">
            <input
              type="checkbox"
              checked={mine}
              onChange={(event) => setMine(event.target.checked)}
              className="size-3.5 accent-indigo-600"
            />
            Only mine
          </label>
        </div>

        {/* Error ----------------------------------------------------------- */}
        {errorText ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-700"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <div className="min-w-0 flex-1">
              {errorText}
              <button
                type="button"
                onClick={() => load(1)}
                className="ml-2 font-semibold underline underline-offset-2"
              >
                Try again
              </button>
            </div>
          </div>
        ) : null}

        {/* Feed ------------------------------------------------------------ */}
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="flex items-center gap-3">
                  <Skeleton className="size-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3 w-40" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
                <Skeleton className="mt-4 h-3 w-full" />
                <Skeleton className="mt-2 h-3 w-4/5" />
              </div>
            ))}
          </div>
        ) : posts.length > 0 ? (
          <>
            <p className="text-xs text-slate-500">
              {total} discussion{total === 1 ? '' : 's'} in this academic year
            </p>

            <div className="space-y-4">
              {posts.map((post) => (
                <PostCard key={post.id} post={post} onUpdated={replacePost} />
              ))}
            </div>

            {page < lastPage ? (
              <div className="flex justify-center pt-1">
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
                >
                  {loadingMore ? 'Loading…' : 'Load more discussions'}
                </button>
              </div>
            ) : null}
          </>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
            <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-indigo-50 text-indigo-500">
              <MessageSquare className="size-5" />
            </span>
            <p className="mt-3 text-sm font-medium text-slate-700">No collaborative activity yet</p>
            <p className="mx-auto mt-1 max-w-sm text-xs text-slate-500">
              {search || visibility || mine
                ? 'No discussion matches these filters. Clear them to see everything from this academic year.'
                : 'Be the first to ask a question about a chapter — classmates and teachers can reply here.'}
            </p>
            <button
              type="button"
              onClick={() => setComposing(true)}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-indigo-700"
            >
              <Plus className="size-3.5" />
              Start a discussion
            </button>
          </div>
        )}
      </div>

      {composing ? (
        <ComposeDialog
          onClose={() => setComposing(false)}
          onCreated={(post) => {
            setComposing(false);
            setPosts((current) => [post, ...current]);
            setTotal((current) => current + 1);
          }}
        />
      ) : null}
    </div>
  );
}
