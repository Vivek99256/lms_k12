"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BookOpen,
  Calendar,
  ClipboardList,
  Download,
  Eye,
  LoaderCircle,
  RefreshCw,
  Layers,
  AlertTriangle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { listHomework, type HomeworkRecord } from "@/app/lms/homework/api";

const SUBJECT_PALETTE = [
  { bg: "bg-violet-50", border: "border-violet-200", badge: "bg-violet-100 text-violet-700", icon: "text-violet-500", dot: "bg-violet-500", hover: "hover:border-violet-400" },
  { bg: "bg-blue-50", border: "border-blue-200", badge: "bg-blue-100 text-blue-700", icon: "text-blue-500", dot: "bg-blue-500", hover: "hover:border-blue-400" },
  { bg: "bg-emerald-50", border: "border-emerald-200", badge: "bg-emerald-100 text-emerald-700", icon: "text-emerald-500", dot: "bg-emerald-500", hover: "hover:border-emerald-400" },
  { bg: "bg-orange-50", border: "border-orange-200", badge: "bg-orange-100 text-orange-700", icon: "text-orange-500", dot: "bg-orange-500", hover: "hover:border-orange-400" },
  { bg: "bg-pink-50", border: "border-pink-200", badge: "bg-pink-100 text-pink-700", icon: "text-pink-500", dot: "bg-pink-500", hover: "hover:border-pink-400" },
  { bg: "bg-teal-50", border: "border-teal-200", badge: "bg-teal-100 text-teal-700", icon: "text-teal-500", dot: "bg-teal-500", hover: "hover:border-teal-400" },
  { bg: "bg-amber-50", border: "border-amber-200", badge: "bg-amber-100 text-amber-700", icon: "text-amber-500", dot: "bg-amber-500", hover: "hover:border-amber-400" },
  { bg: "bg-rose-50", border: "border-rose-200", badge: "bg-rose-100 text-rose-700", icon: "text-rose-500", dot: "bg-rose-500", hover: "hover:border-rose-400" },
];

function subjectColor(subjectId: number) {
  return SUBJECT_PALETTE[Math.abs(subjectId) % SUBJECT_PALETTE.length];
}

function isOverdue(dateStr: string) {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
}

function isDueSoon(dateStr: string) {
  if (!dateStr) return false;
  const due = new Date(dateStr);
  const now = new Date();
  const diff = due.getTime() - now.getTime();
  return diff > 0 && diff < 3 * 24 * 60 * 60 * 1000;
}

function fmt(dateStr: string) {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export default function StudentHomeworkListPage() {
  const router = useRouter();
  const [rows, setRows] = useState<HomeworkRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setRows(await listHomework({}));
    } catch (loadError: unknown) {
      setRows([]);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Your homework couldn't be loaded."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const totalOverdue = rows.filter((r) => isOverdue(r.submissionDate)).length;
  const totalDueSoon = rows.filter((r) => !isOverdue(r.submissionDate) && isDueSoon(r.submissionDate)).length;
  const totalSubjects = new Set(rows.map((r) => r.subjectId)).size;

  return (
    <main className="mx-auto   space-y-6 p-4 sm:p-6">
      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My homework</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            View assignments and submit your completed work
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Summary tiles — shown once data loads */}
      {!loading && !error && rows.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
            <p className="text-2xl font-bold text-indigo-700">{rows.length}</p>
            <p className="mt-0.5 text-xs font-medium text-indigo-500">Total homework</p>
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
            <p className="text-2xl font-bold text-emerald-700">{totalSubjects}</p>
            <p className="mt-0.5 text-xs font-medium text-emerald-500">Subjects</p>
          </div>
          <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
            <p className="text-2xl font-bold text-amber-700">{totalDueSoon}</p>
            <p className="mt-0.5 text-xs font-medium text-amber-500">Due soon</p>
          </div>
          <div className="rounded-2xl border border-red-100 bg-red-50 p-4">
            <p className="text-2xl font-bold text-red-700">{totalOverdue}</p>
            <p className="mt-0.5 text-xs font-medium text-red-500">Overdue</p>
          </div>
        </div>
      )}

      {/* Error */}
      {error ? (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 shrink-0" />
            {error}
          </div>
          <Button type="button" variant="outline" size="sm" onClick={load}>
            Retry
          </Button>
        </div>
      ) : null}

      {/* Loading skeletons */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-48 animate-pulse rounded-2xl border border-slate-100 bg-slate-50"
            />
          ))}
        </div>
      ) : null}

      {/* Homework card grid */}
      {!loading && rows.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((row, index) => {
            const c = subjectColor(row.subjectId || index);
            const overdue = isOverdue(row.submissionDate);
            const dueSoon = !overdue && isDueSoon(row.submissionDate);

            return (
              <article
                key={row.id}
                className={`group flex flex-col rounded-2xl border-2 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md ${c.border} ${c.hover}`}
              >
                {/* Subject + urgency badges */}
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${c.badge}`}
                  >
                    <BookOpen className="size-3" />
                    {row.subjectName || "Subject"}
                  </span>
                  {overdue ? (
                    <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-600">
                      Overdue
                    </span>
                  ) : dueSoon ? (
                    <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-600">
                      Due soon
                    </span>
                  ) : null}
                </div>

                {/* Title */}
                <h3 className="mb-1 line-clamp-2 text-sm font-bold text-slate-800 transition-colors group-hover:text-indigo-700">
                  {row.title || "Untitled homework"}
                </h3>

                {/* Description preview */}
                {row.description ? (
                  <p className="mb-3 line-clamp-2 text-xs text-slate-500">
                    {row.description}
                  </p>
                ) : (
                  <div className="mb-3" />
                )}

                {/* Dates */}
                <div className="mt-auto space-y-1.5">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Calendar className={`size-3.5 shrink-0 ${c.icon}`} />
                    <span>
                      Assigned:{" "}
                      <span className="font-medium text-slate-700">
                        {fmt(row.date)}
                      </span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <Calendar
                      className={`size-3.5 shrink-0 ${
                        overdue
                          ? "text-red-500"
                          : dueSoon
                            ? "text-amber-500"
                            : c.icon
                      }`}
                    />
                    <span
                      className={
                        overdue
                          ? "font-semibold text-red-600"
                          : dueSoon
                            ? "font-semibold text-amber-600"
                            : "text-slate-500"
                      }
                    >
                      Due:{" "}
                      <span className="font-medium">{fmt(row.submissionDate)}</span>
                    </span>
                  </div>
                  {row.standardName ? (
                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                      <span className={`inline-block size-1.5 rounded-full ${c.dot}`} />
                      {row.standardName}
                      {row.divisionName ? ` · Div ${row.divisionName}` : ""}
                    </div>
                  ) : null}
                </div>

                {/* Actions */}
                <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-3">
                  <Button
                    type="button"
                    size="sm"
                    className="flex-1"
                    onClick={() => router.push(`/lms/homework/${row.id}`)}
                  >
                    <Eye className="size-3.5" />
                    View &amp; Submit
                  </Button>
                  {row.image ? (
                    <a
                      href={row.image}
                      target="_blank"
                      rel="noreferrer"
                      aria-label="Download homework file"
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                    >
                      <Download className="size-3.5" />
                    </a>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      ) : null}

      {/* Empty state */}
      {!loading && !error && rows.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed border-indigo-100 bg-gradient-to-b from-indigo-50/60 to-white px-6 py-16 text-center">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-indigo-100">
            <ClipboardList className="size-8 text-indigo-500" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-700">
              No homework assigned yet
            </h3>
            <p className="mt-1 max-w-xs text-sm text-slate-500">
              Your teacher hasn&apos;t assigned any homework yet. Check back later.
            </p>
          </div>
          <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
            <Layers className="size-3.5" />
            Homework will appear here once assigned
          </div>
        </div>
      ) : null}
    </main>
  );
}
