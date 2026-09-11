"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ClipboardList,
  Download,
  Eye,
  LoaderCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listHomework, type HomeworkRecord } from "@/app/lms/homework/api";

/**
 * Student-facing "my homework" list — the missing entry point in front of
 * the already-working `/lms/homework/[id]` detail+submit page. No
 * `RequireStaff`: students must be able to reach this directly.
 *
 * Reuses `listHomework()` (already used by the staff `report/page.tsx`)
 * unmodified — the backend endpoint already scopes results to the calling
 * student's own homework when called from a student session, so no new API
 * or backend change is introduced here.
 */
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
          : "Your homework could not be loaded."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openHomework(id: number) {
    router.push(`/lms/homework/${id}`);
  }

  return (
    <main className="mx-auto space-y-5 p-4 sm:p-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">My homework</h1>
        <p className="mt-1 text-sm text-slate-500">
          View homework assigned to you and submit your completed work.
        </p>
      </header>

      {error ? (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          <span>{error}</span>
          <Button type="button" variant="outline" size="sm" onClick={load}>
            Retry
          </Button>
        </div>
      ) : null}

      <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="w-12">Sr No</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Homework title</TableHead>
                <TableHead>Assigned date</TableHead>
                <TableHead>Due date</TableHead>
                <TableHead>Homework file</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="h-24 text-center text-slate-500"
                  >
                    <LoaderCircle className="mx-auto size-6 animate-spin text-slate-300" />
                  </TableCell>
                </TableRow>
              ) : rows.length ? (
                rows.map((row, index) => (
                  <TableRow key={row.id}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>{row.subjectName || "-"}</TableCell>
                    <TableCell>
                      <button
                        type="button"
                        onClick={() => openHomework(row.id)}
                        className="text-left text-sm font-medium text-blue-600 hover:underline"
                      >
                        {row.title || "Untitled homework"}
                      </button>
                    </TableCell>
                    <TableCell>{row.date || "-"}</TableCell>
                    <TableCell>{row.submissionDate || "-"}</TableCell>
                    <TableCell>
                      {row.image ? (
                        <a
                          href={row.image}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline"
                        >
                          <Download className="size-4" /> Download
                        </a>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => openHomework(row.id)}
                      >
                        <Eye className="size-4" />
                        View homework
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="h-28 text-center text-slate-500"
                  >
                    <ClipboardList className="mx-auto mb-2 size-8 text-slate-300" />
                    No homework assigned yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </section>
    </main>
  );
}
