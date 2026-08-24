'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Loader2,
  Trophy,
} from 'lucide-react';

import { buildSessionContext, createAuthHeaders, readString } from '@/lib/erp-client';
import { isStudentSession } from '@/app/pal/data/pal-lookups';
import type { PalClassStudent } from '@/app/pal/data/pal-lookups';

interface TeacherChallengeEntry {
  user_id: string;
  display_name: string;
  challenge_id: number;
  challenge_title: string;
  score: number;
  accuracy: number;
  speed_ratio: number;
  is_qualified: boolean;
  completed_at: string | null;
}

interface TeacherState {
  loading: boolean;
  error: string | null;
  challenges: { id: number; title: string }[];
  selectedChallengeId: number | null;
  students: PalClassStudent[];
  selectedStudentIds: string[];
  results: TeacherChallengeEntry[];
  resultsLoading: boolean;
  classResults: TeacherChallengeEntry[];
  classResultsLoading: boolean;
}

function getMonday(d: Date): Date {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = date.getUTCDay();
  const diff = date.getUTCDate() - day + (day === 0 ? -6 : 1);
  date.setUTCDate(diff);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

function formatWeekLabel(d: Date): string {
  const monday = getMonday(d);
  const sunday = new Date(monday);
  sunday.setUTCDate(sunday.getUTCDate() + 6);
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  return `${monday.toLocaleDateString('en-US', opts)} – ${sunday.toLocaleDateString('en-US', opts)}`;
}

export default function TeacherChallengeModePage() {
  const router = useRouter();
  const isStaff = !isStudentSession();
  const [state, setState] = useState<TeacherState>({
    loading: true,
    error: null,
    challenges: [],
    selectedChallengeId: null,
    students: [],
    selectedStudentIds: [],
    results: [],
    resultsLoading: false,
    classResults: [],
    classResultsLoading: false,
  });

  const loadChallenges = useCallback(async () => {
    try {
      const session = buildSessionContext();
      const res = await fetch(
        `/api/pal/gamification/challenge-mode/challenges?user_id=${session.userId}&sub_institute_id=${session.subInstituteId}&syear=${session.syear}`,
        { headers: createAuthHeaders(session), cache: 'no-store' }
      );
      const payload = await res.json();
      if (payload.status === '1' && Array.isArray(payload.data?.challenges)) {
        setState((s) => ({
          ...s,
          challenges: payload.data.challenges.map((c: { id: number; title: string }) => ({ id: c.id, title: c.title })),
          selectedChallengeId: s.selectedChallengeId || (payload.data.challenges[0]?.id ?? null),
        }));
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!isStaff) {
      router.replace('/pal/challenge-mode');
      return;
    }
    void loadChallenges();
    setState((s) => ({ ...s, loading: false }));
  }, [isStaff, loadChallenges, router]);

  const loadStudents = useCallback(async () => {
    try {
      const session = buildSessionContext();
      const res = await fetch(
        `${session.baseUrl}/get_adminStudentList`,
        {
          method: 'POST',
          headers: { ...createAuthHeaders(session, 'application/x-www-form-urlencoded'), 'X-Requested-With': 'XMLHttpRequest' },
          body: new URLSearchParams({ type: 'API', sub_institute_id: session.subInstituteId, syear: session.syear }).toString(),
        }
      );
      const payload = await res.json();
      const rows = Array.isArray(payload?.data) ? payload.data : [];
      const students: PalClassStudent[] = rows.map((r: Record<string, unknown>) => ({
        id: String(r.id ?? ''),
        name: String(r.student_name ?? '').trim(),
        gradeId: String(r.grade_id ?? ''),
        standardId: String(r.standard_id ?? ''),
        divisionId: String(r.division_id ?? ''),
        standardName: String(r.standard_name ?? ''),
        divisionName: String(r.division_name ?? ''),
        enrollmentNo: String(r.enrollment_no ?? ''),
        rollNo: String(r.roll_no ?? ''),
      }));
      setState((s) => ({ ...s, students }));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (isStaff) void loadStudents();
  }, [isStaff, loadStudents]);

  const loadStudentResults = useCallback(async () => {
    if (!state.selectedChallengeId || state.selectedStudentIds.length === 0) return;
    setState((s) => ({ ...s, resultsLoading: true, error: null }));
    try {
      const session = buildSessionContext();
      const ids = state.selectedStudentIds.join(',');
      const weekStart = getMonday(new Date()).toISOString().slice(0, 10);
      const res = await fetch(
        `/api/pal/gamification/challenge-mode/teacher?challenge_id=${state.selectedChallengeId}&week_start=${weekStart}&student_ids=${encodeURIComponent(ids)}&user_id=${session.userId}&sub_institute_id=${session.subInstituteId}&syear=${session.syear}`,
        { headers: createAuthHeaders(session), cache: 'no-store' }
      );
      const payload = await res.json();
      if (payload.status === '1') {
        const entries: TeacherChallengeEntry[] = (Array.isArray(payload.data?.entries) ? payload.data.entries : []).map(
          (e: Record<string, unknown>) => ({
            user_id: String(e.user_id ?? ''),
            display_name: String(e.display_name ?? 'Student'),
            challenge_id: Number(e.challenge_id),
            challenge_title: '',
            score: Number(e.score ?? 0),
            accuracy: Number(e.accuracy ?? 0),
            speed_ratio: Number(e.speed_ratio ?? 0),
            is_qualified: Boolean(e.is_qualified),
            completed_at: e.completed_at ? String(e.completed_at) : null,
          })
        );
        const challengeTitle = state.challenges.find((c) => c.id === state.selectedChallengeId)?.title || '';
        setState((s) => ({
          ...s,
          results: entries.map((e) => ({ ...e, challenge_title: challengeTitle })),
          resultsLoading: false,
        }));
      } else {
        setState((s) => ({ ...s, resultsLoading: false, error: readString(payload.message) || 'Unable to load results.' }));
      }
    } catch (err) {
      setState((s) => ({ ...s, resultsLoading: false, error: err instanceof Error ? err.message : 'Unable to load results.' }));
    }
  }, [state.selectedChallengeId, state.selectedStudentIds, state.challenges]);

  const loadClassResults = useCallback(async () => {
    if (!state.selectedChallengeId) return;
    setState((s) => ({ ...s, classResultsLoading: true, error: null }));
    try {
      const session = buildSessionContext();
      const weekStart = getMonday(new Date()).toISOString().slice(0, 10);
      const res = await fetch(
        `/api/pal/gamification/challenge-mode/teacher?challenge_id=${state.selectedChallengeId}&week_start=${weekStart}&student_ids=all&user_id=${session.userId}&sub_institute_id=${session.subInstituteId}&syear=${session.syear}`,
        { headers: createAuthHeaders(session), cache: 'no-store' }
      );
      const payload = await res.json();
      if (payload.status === '1') {
        const entries: TeacherChallengeEntry[] = (Array.isArray(payload.data?.entries) ? payload.data.entries : []).map(
          (e: Record<string, unknown>) => ({
            user_id: String(e.user_id ?? ''),
            display_name: String(e.display_name ?? 'Student'),
            challenge_id: Number(e.challenge_id),
            challenge_title: '',
            score: Number(e.score ?? 0),
            accuracy: Number(e.accuracy ?? 0),
            speed_ratio: Number(e.speed_ratio ?? 0),
            is_qualified: Boolean(e.is_qualified),
            completed_at: e.completed_at ? String(e.completed_at) : null,
          })
        );
        const challengeTitle = state.challenges.find((c) => c.id === state.selectedChallengeId)?.title || '';
        setState((s) => ({
          ...s,
          classResults: entries.map((e) => ({ ...e, challenge_title: challengeTitle })),
          classResultsLoading: false,
        }));
      } else {
        setState((s) => ({ ...s, classResultsLoading: false }));
      }
    } catch {
      setState((s) => ({ ...s, classResultsLoading: false }));
    }
  }, [state.selectedChallengeId, state.challenges]);

  useEffect(() => {
    if (state.selectedChallengeId && state.selectedStudentIds.length > 0) {
      void loadStudentResults();
    }
  }, [state.selectedChallengeId, state.selectedStudentIds, loadStudentResults]);

  useEffect(() => {
    if (state.selectedChallengeId) {
      void loadClassResults();
    }
  }, [state.selectedChallengeId, loadClassResults]);

  if (state.loading) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-white py-16 text-sm text-slate-500">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading Challenge Mode...
      </div>
    );
  }

  if (!isStaff) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
        Unauthorized. Only teachers can access this page.
      </div>
    );
  }

  return (
    <div className="min-h-full px-4 py-5 sm:px-6">
      <div className="mx-auto w-full max-w-[1200px] space-y-5">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            <Trophy className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Challenge Mode — Teacher View</h1>
            <p className="text-sm text-slate-500">
              View Challenge Mode participation, scores, and leaderboard for your authorized students.
            </p>
          </div>
        </div>

        {state.error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {state.error}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-slate-700">Challenge:</label>
            <select
              value={state.selectedChallengeId ?? ''}
              onChange={(e) => setState((s) => ({ ...s, selectedChallengeId: Number(e.target.value) || null, selectedStudentIds: [] }))}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <option value="">Select challenge</option>
              {state.challenges.map((c) => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-1 items-center gap-2">
            <label className="text-sm font-medium text-slate-700">Students:</label>
            <select
              multiple
              value={state.selectedStudentIds}
              onChange={(e) => {
                const values = Array.from(e.target.selectedOptions, (opt) => opt.value);
                setState((s) => ({ ...s, selectedStudentIds: values }));
              }}
              className="min-h-[36px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              {state.students.map((s) => (
                <option key={s.id} value={s.id}>{s.name || `Student #${s.id}`}</option>
              ))}
            </select>
          </div>
        </div>

        {state.selectedStudentIds.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="text-sm font-semibold text-slate-900">Selected Student Results</h2>
              <p className="text-xs text-slate-500">
                {formatWeekLabel(new Date())} · {state.selectedStudentIds.length} student{state.selectedStudentIds.length === 1 ? '' : 's'} selected
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500">Student</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500">Challenge</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500">Score</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500">Accuracy</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500">Speed Ratio</th>
                    <th className="px-5 py-3 text-center text-xs font-semibold text-slate-500">Qualified</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {state.resultsLoading ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-8 text-center text-sm text-slate-500">
                        <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                      </td>
                    </tr>
                  ) : state.results.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-8 text-center text-sm text-slate-500">
                        No results for selected students.
                      </td>
                    </tr>
                  ) : (
                    state.results.map((entry) => (
                      <tr key={`${entry.user_id}-${entry.challenge_id}`} className="hover:bg-slate-50">
                        <td className="px-5 py-3 text-sm font-medium text-slate-900">{entry.display_name}</td>
                        <td className="px-5 py-3 text-sm text-slate-600">{entry.challenge_title}</td>
                        <td className="px-5 py-3 text-right text-sm font-semibold text-indigo-700">{entry.score}</td>
                        <td className="px-5 py-3 text-right text-sm text-slate-600">{entry.accuracy.toFixed(2)}</td>
                        <td className="px-5 py-3 text-right text-sm text-slate-600">{entry.speed_ratio.toFixed(2)}</td>
                        <td className="px-5 py-3 text-center">
                          {entry.is_qualified ? (
                            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">Yes</span>
                          ) : (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">No</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {state.classResults.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="text-sm font-semibold text-slate-900">Class Leaderboard</h2>
              <p className="text-xs text-slate-500">
                {formatWeekLabel(new Date())} · All authorized students
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500">#</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500">Student</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500">Score</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500">Accuracy</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500">Speed Ratio</th>
                    <th className="px-5 py-3 text-center text-xs font-semibold text-slate-500">Qualified</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {state.classResultsLoading ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-8 text-center text-sm text-slate-500">
                        <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                      </td>
                    </tr>
                  ) : (
                    state.classResults
                      .sort((a, b) => b.score - a.score)
                      .map((entry, idx) => (
                        <tr key={`${entry.user_id}-${entry.challenge_id}`} className="hover:bg-slate-50">
                          <td className="px-5 py-3 text-sm font-semibold text-slate-500">{idx + 1}</td>
                          <td className="px-5 py-3 text-sm font-medium text-slate-900">{entry.display_name}</td>
                          <td className="px-5 py-3 text-right text-sm font-semibold text-indigo-700">{entry.score}</td>
                          <td className="px-5 py-3 text-right text-sm text-slate-600">{entry.accuracy.toFixed(2)}</td>
                          <td className="px-5 py-3 text-right text-sm text-slate-600">{entry.speed_ratio.toFixed(2)}</td>
                          <td className="px-5 py-3 text-center">
                            {entry.is_qualified ? (
                              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">Yes</span>
                            ) : (
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">No</span>
                            )}
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
