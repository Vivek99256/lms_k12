'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Award,
  BookOpen,
  CheckCircle2,
  FileText,
  Filter,
  FolderPlus,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  Star,
  Upload,
  User,
  X,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import {
  createPortfolioItem,
  fetchPortfolioItems,
  type NewPortfolioItem,
  type PortfolioItem,
} from '@/app/lms/data/portfolio';

const TYPES = ['All', 'Project', 'Assignment', 'Lab Work', 'Art & Craft', 'Certificate'] as const;

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-slate-200/70', className)} aria-hidden />;
}

/* -------------------------------------------------------------------------- */
/* Modal: Add Portfolio Artifact                                              */
/* -------------------------------------------------------------------------- */

function AddPortfolioModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (item: PortfolioItem) => void;
}) {
  const [title, setTitle] = useState('');
  const [subjectName, setSubjectName] = useState('Science');
  const [type, setType] = useState<PortfolioItem['type']>('Project');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!title.trim()) {
      setError('Please enter a title for your portfolio artifact.');
      return;
    }
    if (!description.trim()) {
      setError('Please write a short description of your work.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const newItem: NewPortfolioItem = {
        title: title.trim(),
        description: description.trim(),
        type,
        subjectName,
        file,
      };
      const created = await createPortfolioItem(newItem);
      onCreated(created);
    } catch {
      setError('Failed to add portfolio artifact. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4 backdrop-blur-xs">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Add Portfolio Artifact"
        className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl border border-slate-100"
      >
        <header className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
              <FolderPlus className="size-4" />
            </span>
            <h2 className="text-base font-semibold text-slate-900">Add Portfolio Artifact</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-700">Artifact Title *</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Solar System 3D Model & Research Notes"
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </label>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-700">Subject</span>
              <select
                value={subjectName}
                onChange={(e) => setSubjectName(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="Science">Science & Physics</option>
                <option value="Mathematics">Mathematics</option>
                <option value="Chemistry">Chemistry</option>
                <option value="English Literature">English Literature</option>
                <option value="Environmental Studies">Environmental Studies</option>
                <option value="Computer Science">Computer Science</option>
                <option value="General Art">General Art</option>
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-700">Category / Type</span>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as PortfolioItem['type'])}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="Project">Project</option>
                <option value="Assignment">Assignment</option>
                <option value="Lab Work">Lab Work</option>
                <option value="Art & Craft">Art & Craft</option>
                <option value="Certificate">Certificate</option>
                <option value="Research">Research Paper</option>
              </select>
            </label>
          </div>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-700">Description & Key Highlights *</span>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what you built, learned, or solved in this work..."
              className="w-full resize-y rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </label>

          <div className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-700">Attach Document / Media</span>
            <div className="flex items-center justify-center rounded-xl border-2 border-dashed border-slate-300 p-4 text-center hover:bg-slate-50 transition">
              <label className="cursor-pointer flex flex-col items-center">
                <Upload className="size-6 text-slate-400 mb-1" />
                <span className="text-xs font-medium text-indigo-600">
                  {file ? file.name : 'Click to select PDF, Image, or DOC'}
                </span>
                <span className="text-[11px] text-slate-400 mt-0.5">Max file size 25MB</span>
                <input
                  type="file"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>
          </div>

          {error ? (
            <p role="alert" className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-xs text-rose-700 border border-rose-200">
              {error}
            </p>
          ) : null}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-slate-100 px-6 py-4 bg-slate-50/50">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-200/60 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60"
          >
            {saving ? 'Adding...' : 'Add to Portfolio'}
          </button>
        </footer>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Main Portfolio Page Component                                              */
/* -------------------------------------------------------------------------- */

export default function PortfolioPage() {
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState<string>('All');
  const [showModal, setShowModal] = useState(false);

  const load = useCallback((signal?: AbortSignal) => {
    setLoading(true);
    fetchPortfolioItems({ search, type: selectedType === 'All' ? undefined : selectedType }, signal)
      .then((res) => {
        if (signal?.aborted) return;
        setItems(res.items);
        setLoading(false);
      })
      .catch(() => {
        if (signal?.aborted) return;
        setItems([]);
        setLoading(false);
      });
  }, [search, selectedType]);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const stats = useMemo(() => {
    const total = items.length;
    const reviewed = items.filter((i) => i.feedback).length;
    const badges = items.filter((i) => i.badge).length;
    return { total, reviewed, badges };
  }, [items]);

  return (
    <div className="min-h-full  space-y-6 mx-auto">
      {/* Header Banner */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white shadow-md">
            <BookOpen className="size-6" />
          </span>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              Student Portfolio
            </h1>
            <p className="mt-0.5 text-xs sm:text-sm text-slate-500">
              Showcase of projects, lab works, certificates, and teacher reviews.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => load()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50"
          >
            <RefreshCw className={cn('size-3.5', loading && 'animate-spin')} />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white shadow-md transition hover:bg-indigo-700"
          >
            <Plus className="size-4" />
            Add Artifact
          </button>
        </div>
      </header>

      {/* Overview Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-4.5 shadow-xs transition hover:shadow-md">
          <span className="flex size-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            <FileText className="size-5" />
          </span>
          <div>
            <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
            <p className="text-xs font-medium text-slate-500">Total Artifacts</p>
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-4.5 shadow-xs transition hover:shadow-md">
          <span className="flex size-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="size-5" />
          </span>
          <div>
            <p className="text-2xl font-bold text-slate-900">{stats.reviewed}</p>
            <p className="text-xs font-medium text-slate-500">Teacher Reviewed</p>
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-4.5 shadow-xs transition hover:shadow-md">
          <span className="flex size-11 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
            <Award className="size-5" />
          </span>
          <div>
            <p className="text-2xl font-bold text-slate-900">{stats.badges}</p>
            <p className="text-xs font-medium text-slate-500">Badges & Merit Awards</p>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-xs">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search portfolio by title, subject or description..."
            className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-xs sm:text-sm text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* Type Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 mr-1">
            <Filter className="size-3.5" />
            Filter:
          </span>
          {TYPES.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setSelectedType(type)}
              className={cn(
                'rounded-xl px-3 py-1.5 text-xs font-semibold transition shrink-0',
                selectedType === type
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
              )}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Artifact Cards Grid */}
      {loading ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-16 w-full" />
            </div>
          ))}
        </div>
      ) : items.length > 0 ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {items.map((item) => (
            <article
              key={item.id}
              className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition hover:shadow-md hover:border-slate-300"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="inline-flex items-center rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">
                      {item.type}
                    </span>
                    {item.subjectName ? (
                      <span className="ml-2 text-xs font-medium text-slate-500">
                        {item.subjectName}
                      </span>
                    ) : null}
                  </div>
                  {item.badge ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-[11px] font-bold text-amber-700">
                      <Award className="size-3" />
                      {item.badge}
                    </span>
                  ) : null}
                </div>

                <h3 className="mt-3 text-base font-bold text-slate-900 leading-snug">
                  {item.title}
                </h3>
                <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed line-clamp-3">
                  {item.description}
                </p>

                {item.fileName ? (
                  <div className="mt-3.5 inline-flex items-center gap-2 rounded-xl bg-slate-50 border border-slate-200 px-3 py-1.5 text-xs text-indigo-600 font-medium">
                    <FileText className="size-3.5 text-slate-400" />
                    <span>{item.fileName}</span>
                  </div>
                ) : null}
              </div>

              {/* Feedback & Footer Section */}
              <div className="mt-5 pt-4 border-t border-slate-100 space-y-3">
                {item.feedback ? (
                  <div className="rounded-xl bg-emerald-50/70 border border-emerald-100 p-3">
                    <div className="flex items-center justify-between text-xs font-semibold text-emerald-800">
                      <span className="flex items-center gap-1.5">
                        <MessageSquare className="size-3.5 text-emerald-600" />
                        Teacher Feedback:
                      </span>
                      {item.rating ? (
                        <div className="flex items-center text-amber-500">
                          {Array.from({ length: item.rating }).map((_, r) => (
                            <Star key={r} className="size-3 fill-amber-400" />
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-slate-700 italic">
                      &quot;{item.feedback}&quot;
                    </p>
                    <p className="mt-1 text-[11px] font-medium text-slate-500 text-right">
                      — {item.feedbackBy || item.teacherName}
                    </p>
                  </div>
                ) : (
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="flex items-center gap-1">
                      <User className="size-3.5" />
                      Submitted by Student
                    </span>
                    <span>Pending Teacher Review</span>
                  </div>
                )}

                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                  <span>Uploaded: {item.createdAt}</span>
                  <button
                    type="button"
                    onClick={() => alert(`Opening portfolio artifact "${item.title}"`)}
                    className="font-semibold text-indigo-600 hover:underline"
                  >
                    View Details →
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
            <BookOpen className="size-6" />
          </span>
          <h3 className="mt-4 text-base font-bold text-slate-900">No Portfolio Artifacts Found</h3>
          <p className="mt-1 text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
            {search || selectedType !== 'All'
              ? 'No artifacts match your filter search. Try changing your filters.'
              : 'Add your projects, homework, art pieces, and certificates to build your academic showcase.'}
          </p>
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white shadow-xs transition hover:bg-indigo-700"
          >
            <Plus className="size-4" />
            Add First Artifact
          </button>
        </div>
      )}

      {showModal ? (
        <AddPortfolioModal
          onClose={() => setShowModal(false)}
          onCreated={(newItem) => {
            setShowModal(false);
            setItems((prev) => [newItem, ...prev]);
          }}
        />
      ) : null}
    </div>
  );
}
