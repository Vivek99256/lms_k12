'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  LifeBuoy,
  Loader2,
  Lock,
  Sparkles,
} from 'lucide-react';

import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { isStudentSession } from '@/app/pal/data/pal-lookups';
import { getViewAsStudent, setViewAsStudent, useViewAsStudent } from '@/app/pal/data/pal-view-as';
import type { PalStudentSelection } from '@/app/pal/data/pal';
import {
  TRIGGER_LABELS,
  closeIntervention,
  fetchInterventions,
  isOpenStatus,
  updateIntervention,
  type InterventionOutcome,
  type InterventionQueue,
  type InterventionRecord,
} from '@/app/pal/data/pal-intervention';
import StudentPicker from '@/app/pal/_components/StudentPicker';
import ViewAsBanner from '@/app/pal/_components/ViewAsBanner';

/**
 * The support-case queue. Staff only.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS SCREEN HAD TO EXIST BEFORE THE STAGE DID
 * ---------------------------------------------------------------------------
 * A support case is the one thing in PAL that only a person can resolve, and
 * without a queue there is nowhere for a person to resolve it. BR-06 in
 * lib/process/sop-catalog.ts already requires escalation to the teacher after
 * two remediation cycles, and SOP 6.13 already specifies the lifecycle -
 * create, assign, monitor, close, escalate. All of it was specified and none
 * of it had a screen.
 *
 * ---------------------------------------------------------------------------
 * WHAT A STUDENT SEES HERE
 * ---------------------------------------------------------------------------
 * An explanation and a link, not a redirect. A silent bounce reads as a broken
 * link, and it is worth telling a learner plainly that their own case lives on
 * the concept it was opened against. Note that the roster request is never
 * fired for a student session - the branch returns before it.
 *
 * ---------------------------------------------------------------------------
 * READ-ONLY IS NOT AN ERROR
 * ---------------------------------------------------------------------------
 * The write routes are not deployed yet. That is reported once, in an amber
 * banner, and every control that would write is disabled with the same
 * sentence on its tooltip. Throwing a red failure at a teacher for a route
 * nobody has deployed would be telling them they did something wrong.
 */

type StatusFilter = 'open' | 'pending_approval' | 'closed' | 'all';
type RiskFilter = 'all' | 'high' | 'medium' | 'low';

export default function InterventionQueuePage() {
  return (
    <Suspense fallback={<Centered>Loading support cases…</Centered>}>
      <InterventionQueueView />
    </Suspense>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center text-sm text-slate-500">
      <Loader2 aria-hidden className="mr-2 h-4 w-4 animate-spin" />
      {children}
    </div>
  );
}

function InterventionQueueView() {
  const [isStaff, setIsStaff] = useState<boolean | null>(null);
  const [queue, setQueue] = useState<InterventionQueue | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [status, setStatus] = useState<StatusFilter>('open');
  const [risk, setRisk] = useState<RiskFilter>('all');
  const [expanded, setExpanded] = useState<number | null>(null);

  const viewing = useViewAsStudent();

  // Role first, and the roster behind the picker is never requested for a
  // student session - see the note at the top of the file.
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setIsStaff(!isStudentSession());
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const load = useCallback(() => {
    if (isStaff !== true) return;

    const controller = new AbortController();
    queueMicrotask(() => {
      setLoading(true);
      setError(null);
      fetchInterventions(
        {
          learnerId: getViewAsStudent()?.studentId || undefined,
          status: status === 'all' || status === 'closed' ? undefined : status,
        },
        controller.signal
      )
        .then(setQueue)
        .catch((reason: unknown) => {
          if (controller.signal.aborted) return;
          setError(reason instanceof Error ? reason.message : 'Support cases could not be loaded.');
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    });

    return () => controller.abort();
  }, [isStaff, status]);

  useEffect(() => load(), [load, viewing]);

  const records = useMemo(() => {
    const rows = queue?.records ?? [];
    const rank: Record<string, number> = { high: 0, medium: 1, low: 2 };

    return rows
      .filter((row) => (risk === 'all' ? true : row.risk_level === risk))
      .filter((row) => {
        if (status === 'all') return true;
        if (status === 'closed') return !isOpenStatus(row.status) || row.closed_at != null;
        if (status === 'pending_approval') return row.status === 'pending_approval';
        return isOpenStatus(row.status) && row.closed_at == null;
      })
      .sort((a, b) => {
        const byRisk = (rank[a.risk_level] ?? 3) - (rank[b.risk_level] ?? 3);
        if (byRisk !== 0) return byRisk;
        return (a.opened_at ?? '').localeCompare(b.opened_at ?? '');
      });
  }, [queue, risk, status]);

  const counts = useMemo(() => {
    const rows = queue?.records ?? [];
    return {
      open: rows.filter((row) => isOpenStatus(row.status) && row.closed_at == null).length,
      awaiting: rows.filter((row) => row.status === 'pending_approval').length,
      high: rows.filter((row) => row.risk_level === 'high').length,
      closed: rows.filter((row) => row.closed_at != null).length,
    };
  }, [queue]);

  if (isStaff === null) return <Centered>Loading…</Centered>;

  if (!isStaff) {
    return (
      <div className="px-4 py-5 sm:px-6">
        <div className="mx-auto w-full max-w-[720px]">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Support cases are managed by your teacher</CardTitle>
              <CardDescription>
                If a support case has been opened for you, it is on the concept it was opened
                against - open that concept from your plan and you will see it.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/pal" className={buttonVariants()}>
                Back to subjects
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-5 sm:px-6">
      <div className="mx-auto w-full max-w-[1800px] space-y-5">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <LifeBuoy aria-hidden className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Support cases</h1>
              <p className="mt-1 text-sm text-slate-500">
                Learners the engine has stopped being able to help on its own.
              </p>
            </div>
          </div>

          <Link href="/pal/intelligence" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            <Sparkles aria-hidden className="mr-1.5 h-4 w-4" />
            Intelligence
          </Link>
        </header>

        {queue?.access.readOnly && (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="flex items-start gap-3 pt-5">
              <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <p className="text-sm text-amber-900">{queue.access.message}</p>
            </CardContent>
          </Card>
        )}

        {viewing ? (
          <ViewAsBanner
            student={viewing}
            audience="Teacher"
            onExit={() => setViewAsStudent(null)}
          />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pick a learner</CardTitle>
              <CardDescription>
                Or leave this and read the whole caseload below.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <StudentPicker
                audience="Teacher"
                onSelect={(student: PalStudentSelection) => setViewAsStudent(student)}
              />
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Tally label="Open" value={counts.open} />
          <Tally label="Awaiting approval" value={counts.awaiting} tone="warn" />
          <Tally label="High risk" value={counts.high} tone="warn" />
          <Tally label="Closed" value={counts.closed} tone="good" />
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <Filter
            id="status-filter"
            label="Status"
            value={status}
            onChange={(value) => setStatus(value as StatusFilter)}
            options={[
              ['open', 'Open'],
              ['pending_approval', 'Awaiting approval'],
              ['closed', 'Closed'],
              ['all', 'All'],
            ]}
          />
          <Filter
            id="risk-filter"
            label="Risk"
            value={risk}
            onChange={(value) => setRisk(value as RiskFilter)}
            options={[
              ['all', 'All'],
              ['high', 'High'],
              ['medium', 'Medium'],
              ['low', 'Low'],
            ]}
          />
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            {loading && <Loader2 aria-hidden className="mr-1.5 h-4 w-4 animate-spin" />}
            Refresh
          </Button>
        </div>

        {error ? (
          <Card className="border-rose-200 bg-rose-50">
            <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-5">
              <p className="text-sm text-rose-800">{error}</p>
              <Button variant="outline" size="sm" onClick={load}>
                Try again
              </Button>
            </CardContent>
          </Card>
        ) : loading ? (
          <Centered>Loading support cases…</Centered>
        ) : records.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm font-medium text-slate-900">No support cases open.</p>
              <p className="mt-1 text-sm text-slate-600">
                That is the result you want - the engine is managing everyone it can on its own.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <ul className="divide-y divide-slate-100">
                {records.map((record) => (
                  <CaseRow
                    key={record.id}
                    record={record}
                    expanded={expanded === record.id}
                    onToggle={() => setExpanded(expanded === record.id ? null : record.id)}
                    readOnly={queue?.access.readOnly === true}
                    readOnlyMessage={queue?.access.message ?? undefined}
                    onChanged={load}
                  />
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function Tally({ label, value, tone }: { label: string; value: number; tone?: 'warn' | 'good' }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p
        className={cn(
          'mt-1 text-2xl font-semibold tabular-nums',
          tone === 'warn' && 'text-amber-700',
          tone === 'good' && 'text-emerald-700',
          !tone && 'text-slate-900'
        )}
      >
        {value}
      </p>
    </div>
  );
}

function Filter({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
}) {
  return (
    <div>
      <label htmlFor={id} className="text-xs font-medium text-slate-600">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 block rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
      >
        {options.map(([key, text]) => (
          <option key={key} value={key}>
            {text}
          </option>
        ))}
      </select>
    </div>
  );
}

function CaseRow({
  record,
  expanded,
  onToggle,
  readOnly,
  readOnlyMessage,
  onChanged,
}: {
  record: InterventionRecord;
  expanded: boolean;
  onToggle: () => void;
  readOnly: boolean;
  readOnlyMessage?: string;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [closingNote, setClosingNote] = useState('');
  const [outcome, setOutcome] = useState<InterventionOutcome>('resolved');

  const run = useCallback(
    async (work: () => Promise<InterventionRecord | null>) => {
      setBusy(true);
      setActionError(null);
      try {
        const updated = await work();
        // Null means the route is not deployed. Reporting success here would
        // tell a teacher they had acted when nothing was written.
        if (!updated) {
          setActionError(readOnlyMessage ?? 'Nothing was saved - the API is not deployed.');
          return;
        }
        onChanged();
      } catch (reason: unknown) {
        setActionError(reason instanceof Error ? reason.message : 'That could not be saved.');
      } finally {
        setBusy(false);
      }
    },
    [onChanged, readOnlyMessage]
  );

  const age = record.opened_at ? daysSince(record.opened_at) : null;

  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-indigo-600"
      >
        {expanded ? (
          <ChevronDown aria-hidden className="h-4 w-4 shrink-0 text-slate-400" />
        ) : (
          <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-slate-400" />
        )}

        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-slate-900">
            {record.learner_name || record.learner_id}
          </span>
          <span className="block truncate text-xs text-slate-500">
            {record.concept_name || record.title}
          </span>
        </span>

        <RiskChip level={record.risk_level} />

        <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600">
          {TRIGGER_LABELS[record.trigger_kind] ?? 'Support'}
        </span>

        {record.requires_approval && !record.governance_passed && (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
            <Lock aria-hidden className="h-3 w-3" />
            Needs approval
          </span>
        )}

        {age != null && (
          <span className="text-xs tabular-nums text-slate-500">
            {age === 0 ? 'today' : `${age}d`}
          </span>
        )}
      </button>

      {expanded && (
        <div className="space-y-4 border-t border-slate-100 bg-slate-50 px-4 py-4">
          {record.rationale && <p className="text-sm text-slate-700">{record.rationale}</p>}

          {record.notes.length > 0 && (
            <ul className="space-y-2">
              {record.notes.map((entry) => (
                <li key={entry.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                  <p className="text-sm text-slate-800">{entry.body}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {entry.author_name || entry.author_role}
                    {entry.created_at ? ` · ${formatWhen(entry.created_at)}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={readOnly || busy}
              title={readOnlyMessage}
              onClick={() => void run(() => updateIntervention(record.id, { status: 'approved' }))}
            >
              Take this
            </Button>

            {record.requires_approval && !record.governance_passed && (
              <Button
                size="sm"
                variant="outline"
                disabled={readOnly || busy}
                title={readOnlyMessage}
                onClick={() => void run(() => updateIntervention(record.id, { status: 'approved' }))}
              >
                Approve
              </Button>
            )}

            {record.concept_id != null && (
              <Link
                href={`/pal/intervention/concept/${record.concept_id}`}
                className={buttonVariants({ variant: 'outline', size: 'sm' })}
              >
                Open the concept
              </Link>
            )}
          </div>

          {/* Closing needs a reason. A case closed with nothing recorded is
              not auditable, and the reason is the only part of this that a
              parent meeting can actually be shown. */}
          <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
            <p className="text-sm font-medium text-slate-900">Close this case</p>
            <div className="flex flex-wrap items-end gap-3">
              <Filter
                id={`outcome-${record.id}`}
                label="Outcome"
                value={outcome}
                onChange={(value) => setOutcome(value as InterventionOutcome)}
                options={[
                  ['resolved', 'Resolved'],
                  ['escalated', 'Escalated'],
                  ['dismissed', 'Not needed'],
                ]}
              />
            </div>
            <textarea
              value={closingNote}
              onChange={(event) => setClosingNote(event.target.value)}
              rows={2}
              placeholder="What was done, and what happens next."
              disabled={readOnly || busy}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:bg-slate-50"
            />
            <Button
              size="sm"
              disabled={readOnly || busy || !closingNote.trim()}
              title={readOnlyMessage}
              onClick={() =>
                void run(() => closeIntervention(record.id, { outcome, note: closingNote.trim() }))
              }
            >
              {busy && <Loader2 aria-hidden className="mr-1.5 h-4 w-4 animate-spin" />}
              Close case
            </Button>
          </div>

          {actionError && <p className="text-sm text-rose-700">{actionError}</p>}
        </div>
      )}
    </li>
  );
}

/** Risk as a word, not a coloured dot. */
function RiskChip({ level }: { level: 'low' | 'medium' | 'high' }) {
  const style =
    level === 'high'
      ? 'border-rose-200 bg-rose-50 text-rose-800'
      : level === 'medium'
        ? 'border-amber-200 bg-amber-50 text-amber-800'
        : 'border-slate-200 bg-white text-slate-600';

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold capitalize',
        style
      )}
    >
      {level} risk
    </span>
  );
}

/** Laravel sends 'YYYY-MM-DD HH:MM:SS'; Safari will not parse that as-is. */
function formatWhen(value: string): string {
  const date = new Date(value.replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function daysSince(value: string): number | null {
  const date = new Date(value.replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) return null;
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 86_400_000));
}
