"use client";

import { useMemo, useState } from "react";
import { CalendarClock, LoaderCircle, Search } from "lucide-react";
import SearchDropdown from "@/components/search-dropdown/SearchDropdown";
import type { SearchDropdownValues } from "@/components/search-dropdown/types";
import { Button } from "@/components/ui/button";
import PageHeader from "@/components/result/PageHeader";
import { getClasswiseTimetable, getTimetableSession, type ClasswiseTimetable, type TimetableEntry } from "./api";

const emptyClassValues: SearchDropdownValues = { section: "", standard: "", division: "", subject: "" };

function valueOf(value: SearchDropdownValues[keyof SearchDropdownValues]) {
  return Array.isArray(value) ? value[0] ?? "" : value;
}

function cellEntries(entries: TimetableEntry[], day: string, periodId: number) {
  return entries.filter((entry) => entry.weekDay === day && entry.periodId === periodId);
}

export default function ClasswiseTimetablePage() {
  const [filters, setFilters] = useState<SearchDropdownValues>(emptyClassValues);
  const [timetable, setTimetable] = useState<ClasswiseTimetable | null>(null);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const hasEntries = Boolean(timetable?.entries.length);
  const hasPeriods = Boolean(timetable?.periods.length);
  const classLabel = useMemo(() => timetable ? [timetable.className.section, timetable.className.standard, timetable.className.division].filter(Boolean).join(" / ") : "", [timetable]);

  async function search() {
    const sectionId = valueOf(filters.section);
    const standardId = valueOf(filters.standard);
    const divisionId = valueOf(filters.division);
    if (!sectionId || !standardId || !divisionId) {
      setError("Select section, standard and division first.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await getClasswiseTimetable(getTimetableSession(), {
        academicSectionId: Number(sectionId), standardId: Number(standardId), divisionId: Number(divisionId),
      });
      setTimetable(result);
      setSearched(true);
    } catch (loadError) {
      setTimetable(null);
      setSearched(true);
      setError(loadError instanceof Error ? loadError.message : "Timetable could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-[1600px] space-y-5">
        <PageHeader icon={CalendarClock} title="View classwise timetable" subtitle="Select a class to view its timetable. This screen is read-only." breadcrumbs={[{ label: "Front desk", href: "/dashboard" }, { label: "View classwise timetable" }]} />
        <form onSubmit={(event) => { event.preventDefault(); void search(); }} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <SearchDropdown fields={["section", "standard", "division"]} values={filters} required={{ section: true, standard: true, division: true }} onChange={(values) => { setFilters(values); setTimetable(null); setSearched(false); setError(""); }} />
          <div className="mt-5 flex justify-end"><Button type="submit" disabled={loading}>{loading ? <LoaderCircle className="size-4 animate-spin" /> : <Search className="size-4" />}View timetable</Button></div>
        </form>
        {error ? <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          {loading ? <div className="flex min-h-64 items-center justify-center gap-2 text-sm text-slate-500"><LoaderCircle className="size-5 animate-spin" />Loading timetable...</div> : !searched ? <div className="flex min-h-64 flex-col items-center justify-center px-4 text-center"><CalendarClock className="mb-3 size-9 text-slate-300" /><p className="font-medium text-slate-700">Choose a class to view its timetable.</p></div> : !hasEntries || !hasPeriods ? <div className="flex min-h-64 flex-col items-center justify-center px-4 text-center"><CalendarClock className="mb-3 size-9 text-slate-300" /><p className="font-medium text-slate-700">No timetable found for the selected class.</p></div> : <div className="overflow-x-auto"><div className="border-b border-slate-200 px-4 py-3 text-sm font-medium text-slate-700">{classLabel}</div><table className="w-full min-w-max border-collapse text-sm"><thead><tr><th className="border border-slate-200 bg-white p-2 text-left"><span className="inline-block rounded bg-sky-500 px-2 py-1 text-xs font-medium text-white">Days / Lectures</span></th>{timetable!.periods.map((period) => <th key={period.id} className="min-w-[190px] border border-slate-200 bg-white p-2 text-left"><span className="inline-block rounded bg-sky-500 px-2 py-1 text-xs font-medium text-white">{period.title}{period.startTime && period.endTime ? <><br />({period.startTime}–{period.endTime})</> : null}</span></th>)}</tr></thead><tbody>{timetable!.weekdays.map((day) => <tr key={day.key}><td className="border border-slate-200 p-2 align-top"><span className="inline-block rounded bg-amber-500 px-2 py-1 text-xs font-medium text-white">{day.label}</span></td>{timetable!.periods.map((period) => { const entries = cellEntries(timetable!.entries, day.key, period.id); return <td key={period.id} className="border border-slate-200 p-3 align-top">{entries.length ? <div className="space-y-3">{entries.map((entry, index) => <div key={entry.id || index} className={index ? "border-t border-slate-200 pt-3" : ""}><p className="font-medium text-slate-800">{entry.subjectName}{entry.batchName ? ` / ${entry.batchName}` : ""}</p><p className="mt-1 text-xs text-slate-500">{entry.teacherName}</p></div>)}</div> : <span className="text-xs text-slate-400">— No period —</span>}</td>; })}</tr>)}</tbody></table></div>}
        </section>
      </div>
    </main>
  );
}
