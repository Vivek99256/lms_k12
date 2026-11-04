"use client";

import { useEffect, useState } from "react";
import { LoaderCircle, X } from "lucide-react";
import { appendCommonParams, buildSessionContext, createAuthHeaders } from "@/lib/erp-client";
import { parseStaffCompetency, type StaffCompetency } from "@/lib/staff-competency";

async function loadStaffCompetency(userId: number): Promise<StaffCompetency> {
  const session = buildSessionContext();
  if (!session.token || !session.subInstituteId) throw new Error("Your login session is incomplete.");
  const params = new URLSearchParams();
  appendCommonParams(params, session);
  const response = await fetch(
    `/api/proxy?path=${encodeURIComponent(`api/competency/employee-profiles/${userId}`)}&${params}`,
    { cache: "no-store", headers: createAuthHeaders(session, "application/json") },
  );
  const payload: unknown = await response.json().catch(() => ({}));
  const body = (payload && typeof payload === "object" ? payload : {}) as { status?: unknown; message?: unknown; data?: unknown };
  if (response.status === 403) throw new Error("You can only view competency data for staff when you have an HR or administrator role.");
  if (!response.ok || ["0", "2"].includes(String(body.status ?? ""))) {
    throw new Error(typeof body.message === "string" && body.message ? body.message : "We couldn't load competency data.");
  }
  return parseStaffCompetency(body.data);
}

export function StaffCompetencyDrawer({ userId, userName, onClose }: { userId: number; userName: string; onClose: () => void }) {
  const [data, setData] = useState<StaffCompetency | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    loadStaffCompetency(userId)
      .then((value) => { if (!cancelled) setData(value); })
      .catch((reason: unknown) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "We couldn't load competency data."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [userId]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <aside role="dialog" aria-label={`${userName} detail`} className="relative flex h-full w-full max-w-xl flex-col bg-white shadow-xl">
        <div className="flex items-center justify-between border-b p-4">
          <div><h2 className="font-semibold text-slate-900">{userName}</h2><p className="text-sm text-slate-500">Staff detail</p></div>
          <button type="button" aria-label="Close" onClick={onClose} className="rounded p-1 hover:bg-slate-100"><X className="size-4" /></button>
        </div>
        <div className="border-b px-4"><span className="inline-block border-b-2 border-indigo-600 py-2 text-sm font-medium text-indigo-600">Competency</span></div>
        <div className="flex-1 space-y-5 overflow-y-auto p-4 text-sm">
          {loading ? <LoaderCircle className="mx-auto mt-8 size-5 animate-spin" /> : error ? <p role="alert" className="text-red-600">{error}</p> : data ? <>
            <section className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border p-3"><p className="text-xs text-slate-500">Job role</p><p className="font-medium">{data.jobRole ?? "Not assigned"}</p></div>
              <div className="rounded-lg border p-3"><p className="text-xs text-slate-500">Average skill level</p><p className="font-medium">{data.skills.length ? data.overallScore : "No skills rated"}</p></div>
            </section>
            <section>
              <h3 className="mb-2 font-semibold">Skill gaps</h3>
              {data.gaps.length ? <ul className="space-y-2">{data.gaps.map((s) => <li key={s.skillId} className="flex justify-between rounded border border-red-200 bg-red-50 p-2"><span>{s.name}</span><span className="text-red-700">{s.current} of {s.required} required ({s.gap})</span></li>)}</ul>
                : <p className="text-slate-500">{data.jobRole ? "No gaps against the required skill levels for this role." : "No job role is assigned, so there are no required levels to compare against."}</p>}
            </section>
            <section>
              <h3 className="mb-2 font-semibold">Skills</h3>
              {data.skills.length ? <ul className="divide-y rounded border">{data.skills.map((s) => <li key={s.skillId} className="flex justify-between p-2"><span>{s.name}<span className="ml-2 text-xs text-slate-500">{s.category}</span></span><span>Level {s.current}</span></li>)}</ul>
                : <p className="text-slate-500">No skills have been rated for this staff member yet.</p>}
            </section>
          </> : null}
        </div>
      </aside>
    </div>
  );
}
