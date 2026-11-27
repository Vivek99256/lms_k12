'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight, X } from 'lucide-react';

import { fetchFeesFamilyDetail, fetchFeesFamilyGroups, PlatformApiError } from '@/lib/platform/client';
import type { FamilyDetail, FamilyGroupRow, FeesSiblingAmbiguous } from '@/lib/platform/types';

import { Card, ErrorState, LoadingState, Pager, Pill, TabStrip } from '../../../_components/shell';

/**
 * Family & Sibling Groups, drilled down.
 *
 * THE "NEEDS CHECKING" TAB IS NOT AN AFTERTHOUGHT. On real tenant data,
 * `duplicate_name_groups` was 746 of 1285 groups — 58% of everything this
 * screen groups as "siblings" is actually "shares a guardian name with a
 * different phone number", which the matching logic cannot tell apart from a
 * real sibling pair without a person looking. That is the dominant case, not
 * the edge case, so it gets its own tab with the three flag types broken out
 * as one-click chips rather than buried in a combined filter.
 *
 * The API filters by at most one `flag` at a time, so "needs checking"
 * defaults to `duplicate_name` (the dominant one) and lets the operator
 * switch to the other two rather than trying to fake an OR client-side.
 */

type AppliedTab = 'every' | 'some' | 'none' | 'needs_checking';
type FlagKey = 'oversized' | 'mixed_guardian' | 'duplicate_name';

const APPLIED_PARAM: Record<AppliedTab, 'all' | 'every' | 'some' | 'none'> = {
  every: 'every',
  some: 'some',
  none: 'none',
  needs_checking: 'all',
};

function inr(amount: number): string {
  return '₹' + Math.round(amount).toLocaleString('en-IN');
}

export interface FamilyGroupsPanelProps {
  ambiguous: FeesSiblingAmbiguous;
  chainActiveConcession: boolean;
  refreshToken: number;
  onRequestConcession: (studentId: number, studentName: string) => void;
  /** Set by "View family" links elsewhere (e.g. the Arrears panel) to pin one family's detail regardless of the current page/filter. */
  focusAnchor?: number | null;
  onClearFocus?: () => void;
}

export function FamilyGroupsPanel({
  ambiguous,
  chainActiveConcession,
  refreshToken,
  onRequestConcession,
  focusAnchor,
  onClearFocus,
}: FamilyGroupsPanelProps) {
  const [tab, setTab] = useState<AppliedTab>('needs_checking');
  const [flag, setFlag] = useState<FlagKey>('duplicate_name');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<FamilyGroupRow[]>([]);
  const [meta, setMeta] = useState({ page: 1, per_page: 20, total: 0, last_page: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [detail, setDetail] = useState<FamilyDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [pinnedDetail, setPinnedDetail] = useState<FamilyDetail | null>(null);
  const [pinnedLoading, setPinnedLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchFeesFamilyGroups({
      page,
      per_page: 20,
      applied: APPLIED_PARAM[tab],
      flag: tab === 'needs_checking' ? flag : undefined,
    })
      .then((result) => {
        setRows(result.rows);
        setMeta(result.meta);
      })
      .catch((cause: unknown) => {
        setError(cause instanceof PlatformApiError ? cause.message : "Couldn't load family groups. Try again.");
      })
      .finally(() => setLoading(false));
  }, [tab, flag, page, refreshToken]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!focusAnchor) {
      setPinnedDetail(null);
      return;
    }
    setPinnedLoading(true);
    setPinnedDetail(null);
    fetchFeesFamilyDetail(focusAnchor)
      .then(setPinnedDetail)
      .catch(() => setPinnedDetail(null))
      .finally(() => setPinnedLoading(false));
  }, [focusAnchor, refreshToken]);

  const toggleExpand = (anchor: number) => {
    if (expanded === anchor) {
      setExpanded(null);
      setDetail(null);
      return;
    }
    setExpanded(anchor);
    setDetail(null);
    setDetailLoading(true);
    fetchFeesFamilyDetail(anchor)
      .then(setDetail)
      .catch(() => setDetail(null))
      .finally(() => setDetailLoading(false));
  };

  const renderMembers = (members: FamilyDetail['members']) => (
    <ul className="space-y-1.5">
      {members.map((member) => (
        <li
          key={member.student_id}
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2 text-sm"
        >
          <div>
            <p className="font-medium text-slate-900">
              {member.name} <span className="text-xs text-slate-500">{member.enrollment_no} · {member.standard}</span>
            </p>
            <p className="text-xs text-slate-500">
              {member.outstanding === null ? 'Outstanding: not checked' : `Outstanding: ${inr(member.outstanding)}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Pill tone={member.applied ? 'green' : 'gray'}>{member.applied ? 'Applied' : 'Not applied'}</Pill>
            {!member.applied &&
              (member.open_request ? (
                <span className="text-xs text-slate-500">Request pending (#{member.open_request.run_id})</span>
              ) : (
                <button
                  type="button"
                  disabled={!chainActiveConcession}
                  title={chainActiveConcession ? undefined : 'Activate a Fee concession chain in Approval Workflows first'}
                  onClick={() => onRequestConcession(member.student_id, member.name)}
                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Request concession
                </button>
              ))}
          </div>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900 shadow-xs">
        <p className="flex items-center gap-1.5 font-semibold">
          <AlertTriangle size={13} className="shrink-0" />
          Why groups need checking before a sibling discount applies
        </p>
        <ul className="mt-1.5 space-y-1 pl-[19px]">
          <li>
            Duplicate guardian name, different number: <strong>{ambiguous.duplicate_name_groups}</strong> groups,{' '}
            {ambiguous.duplicate_name_students} students
          </li>
          <li>
            Mixed guardians sharing a group: <strong>{ambiguous.mixed_guardian_groups}</strong> groups,{' '}
            {ambiguous.mixed_guardian_students} students
          </li>
          <li>
            Oversized groups (&gt;{ambiguous.oversized_threshold}): <strong>{ambiguous.oversized_groups}</strong> groups,{' '}
            {ambiguous.oversized_students} students
          </li>
        </ul>
      </div>

      {focusAnchor != null && (
        <Card className="overflow-hidden border-indigo-200">
          <div className="flex items-center justify-between gap-2 bg-indigo-50 px-4 py-2">
            <p className="text-xs font-semibold text-indigo-800">Family pinned from the arrears ranking</p>
            <button type="button" onClick={onClearFocus} className="rounded p-0.5 text-indigo-700 hover:bg-indigo-100" aria-label="Clear pinned family">
              <X size={13} />
            </button>
          </div>
          <div className="px-4 py-3">
            {pinnedLoading ? (
              <LoadingState label="Loading this family" />
            ) : !pinnedDetail ? (
              <p className="text-sm text-slate-500">Couldn&apos;t load this family.</p>
            ) : (
              renderMembers(pinnedDetail.members)
            )}
          </div>
        </Card>
      )}

      <TabStrip
        tabs={[
          { key: 'every', label: 'Every applied' },
          { key: 'some', label: 'Some applied' },
          { key: 'none', label: 'None applied' },
          { key: 'needs_checking', label: 'Needs checking' },
        ]}
        active={tab}
        onChange={(next) => {
          setTab(next);
          setPage(1);
        }}
      />

      {tab === 'needs_checking' && (
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ['duplicate_name', `Duplicate name (${ambiguous.duplicate_name_groups})`],
              ['mixed_guardian', `Mixed guardian (${ambiguous.mixed_guardian_groups})`],
              ['oversized', `Oversized (${ambiguous.oversized_groups})`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setFlag(key);
                setPage(1);
              }}
              className={`rounded-full border px-3 py-1 text-xs font-medium ${
                flag === key ? 'border-indigo-300 bg-indigo-50 text-indigo-800' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <LoadingState label="Loading family groups" />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : rows.length === 0 ? (
        <Card className="px-4 py-8 text-center text-sm text-slate-600">No family groups match this filter.</Card>
      ) : (
        <div className="space-y-2">
          {rows.map((row, index) => (
            <div
              key={row.anchor_student_id}
              className="animate-in fade-in-0 slide-in-from-left-1 [--tw-animation-duration:300ms]"
              style={{ animationDelay: `${Math.min(index * 30, 300)}ms`, animationFillMode: 'backwards' }}
            >
            <Card className="overflow-hidden transition-shadow hover:shadow-md">
              <button
                type="button"
                onClick={() => toggleExpand(row.anchor_student_id)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50"
              >
                <div className="flex items-center gap-2">
                  {expanded === row.anchor_student_id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {row.masked_mobile} · {row.member_count} members
                    </p>
                    <p className="text-xs text-slate-500">{row.applied_count} of {row.member_count} have a discount applied</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {row.flags.map((flagName) => (
                    <Pill key={flagName} tone="amber">
                      {flagName.replace(/_/g, ' ')}
                    </Pill>
                  ))}
                  <Pill tone={row.applied_state === 'every' ? 'green' : row.applied_state === 'some' ? 'blue' : 'gray'}>{row.applied_state}</Pill>
                </div>
              </button>

              {expanded === row.anchor_student_id && (
                <div className="border-t border-slate-100 px-4 py-3">
                  {detailLoading ? (
                    <LoadingState label="Loading members" />
                  ) : !detail ? (
                    <p className="text-sm text-slate-500">Couldn&apos;t load this family&apos;s members.</p>
                  ) : (
                    renderMembers(detail.members)
                  )}
                </div>
              )}
            </Card>
            </div>
          ))}
        </div>
      )}

      {!loading && !error && rows.length > 0 && <Pager page={meta.page} perPage={meta.per_page} total={meta.total} onPage={setPage} />}
    </div>
  );
}
