"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, LoaderCircle, RefreshCw, Repeat2, UserRoundCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { loadTransferTeachers, transferTeacher, type TransferTeacher } from "./api";

const selectClass =
  "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60";

export default function TeacherTransferPage() {
  const [teachers, setTeachers] = useState<TransferTeacher[]>([]);
  const [leftTeacherId, setLeftTeacherId] = useState("");
  const [newTeacherId, setNewTeacherId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setTeachers(await loadTransferTeachers());
    } catch (value: unknown) {
      setError(value instanceof Error ? value.message : "Teachers could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Authenticated browser storage supplies the ERP API session.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const leftTeacher = useMemo(
    () => teachers.find((teacher) => teacher.id === Number(leftTeacherId)),
    [leftTeacherId, teachers]
  );
  const newTeacher = useMemo(
    () => teachers.find((teacher) => teacher.id === Number(newTeacherId)),
    [newTeacherId, teachers]
  );

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setNotice("");
    if (!leftTeacherId || !newTeacherId) {
      setError("Left teacher and new teacher are required.");
      return;
    }
    if (leftTeacherId === newTeacherId) {
      setError("Left teacher and new teacher must be different.");
      return;
    }
    if (
      !window.confirm(
        `Transfer all ${leftTeacher?.timetableCount ?? 0} current-year timetable entries from ${leftTeacher?.name} to ${newTeacher?.name}?`
      )
    ) {
      return;
    }

    setSaving(true);
    try {
      const result = await transferTeacher(Number(leftTeacherId), Number(newTeacherId));
      setNotice(`${result.message} ${result.affectedRows} timetable entries were updated.`);
      setLeftTeacherId("");
      setNewTeacherId("");
      await load();
    } catch (value: unknown) {
      setError(value instanceof Error ? value.message : "The teacher transfer could not be completed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto space-y-5 p-4 sm:p-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Teacher Transfer Utility</h1>
          <p className="mt-1 text-sm text-slate-500">
            Reassign all timetable entries for the current academic year.
          </p>
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={loading || saving}>
          <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </header>

      {error ? (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {notice}
        </div>
      ) : null}

      <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-5 flex items-start gap-3">
          <div className="rounded-xl bg-blue-50 p-2 text-blue-600">
            <Repeat2 className="size-5" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-900">Transfer timetable ownership</h2>
            <p className="text-sm text-slate-500">
              This updates timetable records only, matching the existing ERP workflow.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex h-32 items-center justify-center text-slate-500">
            <LoaderCircle className="mr-2 size-5 animate-spin" />
            Loading active teachers…
          </div>
        ) : teachers.length < 2 ? (
          <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center">
            <UserRoundCheck className="mx-auto mb-2 size-7 text-slate-400" />
            <p className="font-medium text-slate-700">At least two active teachers are required.</p>
            <p className="mt-1 text-sm text-slate-500">No transfer can be created with the current teacher list.</p>
          </div>
        ) : (
          <>
            <div className="grid items-end gap-4 md:grid-cols-[1fr_auto_1fr]">
              <div className="space-y-2">
                <Label htmlFor="left-teacher">Left teacher *</Label>
                <select
                  id="left-teacher"
                  className={selectClass}
                  value={leftTeacherId}
                  onChange={(event) => {
                    setLeftTeacherId(event.target.value);
                    if (event.target.value === newTeacherId) setNewTeacherId("");
                  }}
                  required
                >
                  <option value="">Select left teacher</option>
                  {teachers.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.name} ({teacher.timetableCount} timetable entries)
                    </option>
                  ))}
                </select>
              </div>
              <div className="hidden pb-3 text-slate-400 md:block">
                <ArrowRight className="size-5" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-teacher">New teacher *</Label>
                <select
                  id="new-teacher"
                  className={selectClass}
                  value={newTeacherId}
                  onChange={(event) => setNewTeacherId(event.target.value)}
                  required
                >
                  <option value="">Select new teacher</option>
                  {teachers
                    .filter((teacher) => teacher.id !== Number(leftTeacherId))
                    .map((teacher) => (
                      <option key={teacher.id} value={teacher.id}>{teacher.name}</option>
                    ))}
                </select>
              </div>
            </div>

            {leftTeacher && newTeacher ? (
              <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <strong>{leftTeacher.timetableCount}</strong> timetable entries will move from{" "}
                <strong>{leftTeacher.name}</strong> to <strong>{newTeacher.name}</strong>.
              </div>
            ) : null}

            <div className="mt-6 flex justify-end">
              <Button type="submit" disabled={saving || !leftTeacherId || !newTeacherId}>
                {saving ? <LoaderCircle className="size-4 animate-spin" /> : <Repeat2 className="size-4" />}
                {saving ? "Transferring…" : "Transfer teacher"}
              </Button>
            </div>
          </>
        )}
      </form>
    </main>
  );
}
