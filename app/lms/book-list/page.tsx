'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookMarked,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Paperclip,
  Plus,
  Trash2,
  X,
} from 'lucide-react';

import { SearchDropdown, type DropdownValue } from '@/components/search-dropdown';
import { buildSessionContext } from '@/lib/erp-client';
import { RecordTable, type RecordColumn } from '@/components/erp/RecordTable';
import {
  BOOK_TITLE_OPTIONS,
  createBookList,
  deleteBookList,
  fetchBookList,
  fetchChapters,
  fetchTopics,
  type BookListRow,
  type Option,
} from '@/app/lms/book-list/api';
import RequireStaff from '@/app/lms/_shared/RequireStaff';

function singleValue(value: DropdownValue): string {
  return Array.isArray(value) ? value[0] ?? '' : value;
}
function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

const inputClass =
  'h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none focus:border-indigo-400 disabled:cursor-not-allowed disabled:bg-slate-50';

export default function BookListPage() {
  const session = useMemo(() => buildSessionContext(), []);

  const [rows, setRows] = useState<BookListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState('');
  const [successText, setSuccessText] = useState('');

  // Create form
  const [showForm, setShowForm] = useState(false);
  const [gradeId, setGradeId] = useState('');
  const [standardId, setStandardId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [chapterId, setChapterId] = useState('');
  const [topicId, setTopicId] = useState('');
  const [date, setDate] = useState('');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [link, setLink] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const [chapters, setChapters] = useState<Option[]>([]);
  const [topics, setTopics] = useState<Option[]>([]);
  const [saving, setSaving] = useState(false);

  const loadList = () => {
    setLoading(true);
    setErrorText('');
    fetchBookList()
      .then((data) => {
        setRows(data);
        setLoading(false);
      })
      .catch((error: unknown) => {
        setRows([]);
        setErrorText(errorMessage(error));
        setLoading(false);
      });
  };

  useEffect(() => {
    const controller = new AbortController();
    // `loading` starts true; the .then/.catch below flip it (async, not in-body).
    fetchBookList(controller.signal)
      .then((data) => {
        setRows(data);
        setLoading(false);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setRows([]);
        setErrorText(errorMessage(error));
        setLoading(false);
      });
    return () => controller.abort();
  }, []);

  // Chapters when subject chosen
  useEffect(() => {
    let cancelled = false;
    if (!standardId || !subjectId) {
      queueMicrotask(() => {
        if (!cancelled) {
          setChapters([]);
          setChapterId('');
        }
      });
      return () => {
        cancelled = true;
      };
    }
    const controller = new AbortController();
    fetchChapters(standardId, subjectId, controller.signal)
      .then((data) => {
        if (!cancelled) {
          setChapters(data);
          setChapterId('');
        }
      })
      .catch(() => {
        if (!cancelled) setChapters([]);
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [standardId, subjectId]);

  // Topics when chapter chosen
  useEffect(() => {
    let cancelled = false;
    if (!chapterId) {
      queueMicrotask(() => {
        if (!cancelled) {
          setTopics([]);
          setTopicId('');
        }
      });
      return () => {
        cancelled = true;
      };
    }
    const controller = new AbortController();
    fetchTopics(chapterId, controller.signal)
      .then((data) => {
        if (!cancelled) {
          setTopics(data);
          setTopicId('');
        }
      })
      .catch(() => {
        if (!cancelled) setTopics([]);
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [chapterId]);

  const canSave = !!standardId && !!subjectId && !!title && !saving;

  const resetForm = () => {
    setGradeId('');
    setStandardId('');
    setSubjectId('');
    setChapterId('');
    setTopicId('');
    setDate('');
    setTitle('');
    setMessage('');
    setLink('');
    setFile(null);
  };

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setErrorText('');
    setSuccessText('');
    try {
      const msg = await createBookList({
        gradeId,
        standardId,
        subjectId,
        chapterId,
        topicId,
        date,
        title,
        message,
        link,
        file,
      });
      setSuccessText(msg);
      resetForm();
      setShowForm(false);
      loadList();
    } catch (error) {
      setErrorText(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row: BookListRow) => {
    if (!window.confirm(`Delete "${row.title}"? This cannot be undone.`)) return;
    setErrorText('');
    setSuccessText('');
    try {
      const msg = await deleteBookList(row.id);
      setSuccessText(msg);
      setRows((prev) => prev.filter((r) => r.id !== row.id));
    } catch (error) {
      setErrorText(errorMessage(error));
    }
  };

  const columns = useMemo<RecordColumn<BookListRow>[]>(
    () => [
      { key: 'standard', label: 'Standard', value: (r) => r.standard || '-', sortable: true },
      { key: 'subject', label: 'Subject', value: (r) => r.subject || '-', sortable: true },
      { key: 'chapter', label: 'Chapter', value: (r) => r.chapter || '-' },
      { key: 'topic', label: 'Topic', value: (r) => r.topic || '-' },
      { key: 'title', label: 'Title', value: (r) => r.title || '-', sortable: true },
      { key: 'message', label: 'Message', value: (r) => r.message || '-' },
      {
        key: 'file',
        label: 'File',
        value: (r) => r.fileName || '',
        render: (r) =>
          r.filePath ? (
            <a
              href={r.filePath}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-700"
            >
              <Paperclip className="size-3.5" /> File
            </a>
          ) : (
            <span className="text-slate-300">—</span>
          ),
      },
      {
        key: 'link',
        label: 'Link',
        value: (r) => r.link || '',
        render: (r) =>
          r.link ? (
            <a
              href={r.link}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-700"
            >
              <ExternalLink className="size-3.5" /> Link
            </a>
          ) : (
            <span className="text-slate-300">—</span>
          ),
      },
      { key: 'date', label: 'Date', value: (r) => r.date || '-', sortable: true },
    ],
    []
  );

  return (
    <RequireStaff>
    <div className="min-h-full px-4 py-5 sm:px-6">
      <div className="mx-auto w-full max-w-[1600px] space-y-5">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <BookMarked className="size-5" />
            </span>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">Book List</h1>
              <p className="mt-0.5 text-sm text-slate-500">
                Recommended books, worksheets and resources per class and subject.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setShowForm((v) => !v);
              setSuccessText('');
            }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#4f46e5] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#4338ca]"
          >
            {showForm ? <X className="size-4" /> : <Plus className="size-4" />}
            {showForm ? 'Close' : 'Add Book'}
          </button>
        </header>

        {errorText ? (
          <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-700">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <div className="min-w-0 flex-1">{errorText}</div>
          </div>
        ) : null}
        {successText ? (
          <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm text-emerald-700">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
            <div className="min-w-0 flex-1">{successText}</div>
          </div>
        ) : null}

        {/* Create form */}
        {showForm ? (
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-base font-semibold text-slate-900">Add Book / Resource</h2>
            <SearchDropdown
              fields={['section', 'standard', 'subject']}
              subInstituteId={session.subInstituteId}
              token={session.token}
              labels={{ section: 'Grade', standard: 'Standard', subject: 'Subject' }}
              required={{ standard: true, subject: true }}
              className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
              onSectionChange={(value) => {
                setGradeId(singleValue(value));
                setStandardId('');
                setSubjectId('');
              }}
              onStandardChange={(value) => {
                setStandardId(singleValue(value));
                setSubjectId('');
              }}
              onSubjectChange={(value) => setSubjectId(singleValue(value))}
            />

            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Chapter</label>
                <select
                  value={chapterId}
                  onChange={(e) => setChapterId(e.target.value)}
                  disabled={!subjectId || chapters.length === 0}
                  className={inputClass}
                >
                  <option value="">{!subjectId ? 'Select subject first' : chapters.length === 0 ? 'No chapters' : 'Select chapter'}</option>
                  {chapters.map((c) => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Topic</label>
                <select
                  value={topicId}
                  onChange={(e) => setTopicId(e.target.value)}
                  disabled={!chapterId || topics.length === 0}
                  className={inputClass}
                >
                  <option value="">{!chapterId ? 'Select chapter first' : topics.length === 0 ? 'No topics' : 'Select topic'}</option>
                  {topics.map((t) => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Date</label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Title <span className="text-rose-500">*</span>
                </label>
                <select value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass}>
                  <option value="">Select title</option>
                  {BOOK_TITLE_OPTIONS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Link</label>
                <input
                  type="text"
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  placeholder="https://…"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Attachment</label>
                <input
                  type="file"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-indigo-700 hover:file:bg-indigo-100"
                />
              </div>
            </div>

            <div className="mt-3">
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Message</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-indigo-400"
              />
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  resetForm();
                  setShowForm(false);
                }}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!canSave}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#4f46e5] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#4338ca] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                Save
              </button>
            </div>
          </section>
        ) : null}

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 px-3 py-16 text-sm text-slate-500">
            <Loader2 className="size-4 animate-spin" /> Loading book list…
          </div>
        ) : (
          <RecordTable
            rows={rows}
            columns={columns}
            getRowKey={(row, i) => row.id || String(i)}
            serialColumn
            searchPlaceholder="Search book list…"
            exportFilename="book-list"
            exportTitle="Book List"
            emptyTitle="No book list entries"
            emptyHint="Use “Add Book” to create the first entry."
            actions={(row) => (
              <button
                type="button"
                onClick={() => handleDelete(row)}
                className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
              >
                <Trash2 className="size-3.5" /> Delete
              </button>
            )}
          />
        )}
      </div>
    </div>
    </RequireStaff>
  );
}
