'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { IdCard, Printer } from 'lucide-react';

import { isStudentSession } from '@/app/pal/data/pal-lookups';
import { fetchMyIcard, getDashboardSession, type MyIcardSummary } from '@/app/dashboard/_lib/dashboard-api';
import { DashboardError, DashboardSkeleton, SectionPanel } from '@/app/dashboard/_components/DashboardPrimitives';

/**
 * Self-service "My ID card" — lets any signed-in staff member (teacher or
 * otherwise) view and print their own I-card, without needing an admin to
 * look them up via the admin teacher_icard tool.
 *
 * The card itself is not re-implemented here: `/api/dashboard/teacher-icard`
 * proxies to Laravel's TeacherIcardApiController::mine(), which reuses the
 * exact same template-filling helpers
 * (student\TeacherIcardApiController::buildTeacherCardHtml()) that the admin
 * tool's preview endpoint uses — see app/student/teacher_icard/TeacherIcardModule.tsx
 * for that admin flow. This page just renders the returned HTML and offers
 * the same print-in-a-new-window action the admin preview panel has.
 *
 * Role gate: this route lives outside the /lms/* tree, so the LMS-specific
 * <RequireStaff> guard (app/lms/_shared/RequireStaff.tsx, which redirects to
 * /lms/dashboard) isn't a great fit — it would couple this page to the LMS
 * module for a default that doesn't apply here. `isStudentSession()` itself
 * is generic (reads the same localStorage session data RequireStaff reads)
 * and is already used the same inline way outside /lms/* (e.g.
 * app/pal/page.tsx), so this page follows that precedent directly instead.
 */
export default function MyIcardPage() {
  const router = useRouter();
  const [access, setAccess] = useState<'checking' | 'allowed' | 'denied'>('checking');
  const [data, setData] = useState<MyIcardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      if (isStudentSession()) {
        setAccess('denied');
        router.replace('/dashboard');
        return;
      }
      setAccess('allowed');
    });
    return () => {
      cancelled = true;
    };
  }, [router]);

  const load = useCallback((signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    const session = getDashboardSession();
    fetchMyIcard(session, signal)
      .then((summary) => setData(summary))
      .catch((err: unknown) => {
        if (signal?.aborted) return;
        setError(err instanceof Error ? err.message : 'Unable to load your I-card.');
      })
      .finally(() => {
        if (!signal?.aborted) setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (access !== 'allowed') return undefined;
    const controller = new AbortController();
    queueMicrotask(() => load(controller.signal));
    return () => controller.abort();
  }, [access, load]);

  const handlePrint = () => {
    if (typeof window === 'undefined' || !data?.html) return;

    const printWindow = window.open('', '_blank', 'width=1300,height=900');
    if (!printWindow) return;

    printWindow.document.open();
    printWindow.document.write(`
      <html>
        <head>
          <title>My I-card</title>
          <style>
            body { margin: 0; padding: 16px; background: #ffffff; }
          </style>
        </head>
        <body onload="window.print()">${data.html}</body>
      </html>
    `);
    printWindow.document.close();
  };

  if (access !== 'allowed') return null;

  return (
    <div className="flex-1 overflow-auto p-8">
      <div className="mb-8 flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-[#4F46E5]">
          <IdCard size={20} strokeWidth={1.75} />
        </span>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">My ID card</h1>
          <p className="mt-1 text-slate-500">Your own staff I-card, generated from the same template the admin office uses.</p>
        </div>
      </div>

      {loading && <DashboardSkeleton />}
      {!loading && error && <DashboardError message={error} onRetry={() => load()} />}

      {!loading && !error && data && (
        <SectionPanel
          title="Your I-card"
          description={`Template: ${data.template || '—'}`}
          action={
            <button
              type="button"
              onClick={handlePrint}
              disabled={!data.html}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Printer className="size-3.5" />
              Print
            </button>
          }
        >
          {data.html ? (
            <div className="overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="mx-auto w-fit bg-white p-4 shadow-sm" dangerouslySetInnerHTML={{ __html: data.html }} />
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-12 text-center text-sm text-slate-600">
              Your I-card could not be generated.
            </div>
          )}
        </SectionPanel>
      )}
    </div>
  );
}
