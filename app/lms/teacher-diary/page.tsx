'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BookOpen, Loader2, RefreshCw } from 'lucide-react';

import { cn } from '@/lib/utils';
import { RecordTable, type RecordColumn } from '@/components/erp/RecordTable';
import { fetchTeacherDiary, type DiaryEntry } from '@/app/lms/data/teacherDiary';
<<<<<<< HEAD
=======
import RequireStaff from '@/app/lms/_shared/RequireStaff';
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

export default function TeacherDiaryPage() {
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState('');

  const load = useCallback((signal?: AbortSignal) => {
    setLoading(true);
    setErrorText('');
    fetchTeacherDiary(signal)
      .then((rows) => {
        setEntries(rows);
        setLoading(false);
      })
      .catch((error: unknown) => {
        if (signal?.aborted) return;
        setEntries([]);
        setErrorText(errorMessage(error));
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => load(controller.signal));
    return () => controller.abort();
  }, [load]);

  const columns = useMemo<RecordColumn<DiaryEntry>[]>(
    () => [
      { key: 'title', label: 'Title', value: (r) => r.title || '-', sortable: true },
      { key: 'description', label: 'Description', value: (r) => r.description || '-' },
      { key: 'standard', label: 'Standard', value: (r) => r.standard || '-', sortable: true },
      { key: 'division', label: 'Division', value: (r) => r.division || '-', sortable: true },
      { key: 'subject', label: 'Subject', value: (r) => r.subject || '-', sortable: true },
      { key: 'schoolDate', label: 'Planned Date', value: (r) => r.schoolDate || '-', sortable: true },
      {
        key: 'status',
        label: 'Status',
        align: 'center',
        value: (r) => r.status || '—',
        render: (r) =>
          r.status ? (
            <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
              {r.status}
            </span>
          ) : (
            <span className="text-slate-300">—</span>
          ),
      },
      { key: 'reason', label: 'Reason', value: (r) => r.reason || '-' },
      { key: 'executionDate', label: 'Execution Date', value: (r) => r.executionDate || '-', sortable: true },
    ],
    []
  );

  return (
<<<<<<< HEAD
=======
    <RequireStaff>
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
    <div className="min-h-full px-4 py-5 sm:px-6">
      <div className="mx-auto w-full max-w-[1600px] space-y-5">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <BookOpen className="size-5" />
            </span>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">Teacher Diary</h1>
              <p className="mt-0.5 text-sm text-slate-500">
                Lesson-planning diary across your classes, with planned vs. execution status.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => load()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw className={cn('size-3.5', loading && 'animate-spin')} />
            Refresh
          </button>
        </header>

        {errorText ? (
          <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-700">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <div className="min-w-0 flex-1">{errorText}</div>
          </div>
        ) : null}

        {loading ? (
          <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 px-3 py-16 text-sm text-slate-500">
            <Loader2 className="size-4 animate-spin" /> Loading diary…
          </div>
        ) : (
          <RecordTable
            rows={entries}
            columns={columns}
            getRowKey={(row, i) => row.id || String(i)}
            serialColumn
            searchPlaceholder="Search diary…"
            exportFilename="teacher-diary"
            exportTitle="Teacher Diary"
            emptyTitle="No lesson-plan entries found"
            emptyHint="Lesson plans created by teachers will appear here."
          />
        )}
      </div>
    </div>
<<<<<<< HEAD
=======
    </RequireStaff>
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
  );
}
