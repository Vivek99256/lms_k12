'use client';

/**
 * Fees → AI Stack → Activity.
 *
 * The ledger. What happened in Fees, which AI capability it used, which agent, prompt
 * or template ran, who did it, which student it was about, and how it ended.
 *
 * WHY THIS TAB EXISTS
 *
 * The other eight tabs each answer "what is configured". None of them answers "what
 * actually ran", and a stack you cannot audit is a stack nobody trusts with money. This
 * is the join: a row here names the Fees operation on one side and the AI Stack record
 * on the other, so a question like "which prompt drafted the remark on this receipt"
 * has an answer that is a lookup rather than an investigation.
 *
 * WHERE THE ROWS COME FROM
 *
 * `ai_audit_logs`, under an event type of `module.fees.<operation>` — the same table the
 * agent runs, generation requests and governance refusals already write to. No table was
 * added for this. Each row was written by a Fees screen at the moment it finished doing
 * something, and the template and prompt names in it were resolved by the backend out of
 * `ai_templates` rather than supplied by the browser, so a row cannot name an artefact
 * that does not exist.
 *
 * AN ENTRY WITH NO AI IS STILL AN ENTRY
 *
 * A plain fee collection uses no model. It is recorded anyway, with no artefact against
 * it, because the ledger's job is to show what happened in Fees — and "this operation
 * ran without AI" is an answer. Attaching a template that had nothing to do with it to
 * make the row look richer would be the one thing that makes the whole tab worthless.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bot, FileText, History, Terminal, Workflow, Wrench } from 'lucide-react';

import {
  fetchModuleActivity,
  type AiModuleActivity,
  type AiModuleActivityEntry,
} from '@/lib/intelligence/ai-module';
import { FEES_OPERATIONS, type FeesOperationKey } from '@/lib/fees/fees-ai-stack';

import {
  FeesAiCard,
  FeesAiCardHeading,
  FeesAiEmpty,
  FeesAiError,
  FeesAiHeader,
  FeesAiHint,
  FeesAiLoading,
  FeesAiMetrics,
  FeesAiPill,
  FeesAiTableHead,
  formatWhen,
} from './fees-ai-chrome';

const MODULE_KEY = 'fees';

/** How many entries a page of the ledger carries. The API caps this at 200. */
const PAGE = 100;

export function FeesActivityScreen() {
  const [activity, setActivity] = useState<AiModuleActivity | null>(null);
  const [operation, setOperation] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [token, setToken] = useState(0);
  const [open, setOpen] = useState<AiModuleActivityEntry | null>(null);

  const reload = useCallback(() => {
    setLoading(true);
    setToken((value) => value + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    fetchModuleActivity(MODULE_KEY, { limit: PAGE, operation: operation || undefined })
      .then((next) => {
        if (cancelled) return;
        setActivity(next);
        setError('');
        setLoading(false);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : 'The request failed.');
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token, operation]);

  const entries = useMemo(() => activity?.entries ?? [], [activity]);

  const stats = useMemo(() => {
    const completed = entries.filter((entry) => entry.status === 'completed').length;
    const withAi = entries.filter((entry) => Object.keys(entry.used).length > 0).length;
    const people = new Set(entries.map((entry) => entry.actor_id ?? entry.actor_label ?? 'unknown'));

    return { completed, withAi, people: people.size };
  }, [entries]);

  /** Operations the ledger actually holds, so the filter never offers an empty one. */
  const operations = useMemo(() => {
    const seen = new Map<string, number>();

    for (const row of activity?.by_operation ?? []) {
      seen.set(row.operation, (seen.get(row.operation) ?? 0) + row.count);
    }

    return [...seen.entries()].sort((a, b) => b[1] - a[1]);
  }, [activity]);

  if (loading && !activity) {
    return <FeesAiLoading label="Loading the Fees AI activity ledger…" />;
  }

  return (
    <section className="space-y-5">
      <FeesAiHeader
        icon={History}
        title="Fees AI activity"
        summary="Every Fees operation the AI Stack recorded — what ran, which capability and record it used, who did it, and how it ended."
        loading={loading}
        onRefresh={reload}
        actions={
          operations.length > 0 ? (
            <select
              value={operation}
              onChange={(event) => setOperation(event.target.value)}
              className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="">All operations</option>
              {operations.map(([key, count]) => (
                <option key={key} value={key}>
                  {FEES_OPERATIONS[key as FeesOperationKey]?.label ?? key} ({count})
                </option>
              ))}
            </select>
          ) : undefined
        }
      />

      {error && <FeesAiError onRetry={reload}>{error}</FeesAiError>}

      {activity && !activity.available && (
        <FeesAiError>{activity.reason ?? 'The ledger is unavailable on this estate.'}</FeesAiError>
      )}

      <FeesAiMetrics
        metrics={[
          { key: 'total', label: 'Recorded', value: activity?.total ?? 0, hint: 'Fees operations' },
          { key: 'shown', label: 'Shown', value: entries.length, hint: `newest ${PAGE}` },
          { key: 'completed', label: 'Completed', value: stats.completed, hint: 'of those shown' },
          { key: 'with-ai', label: 'Used AI', value: stats.withAi, hint: 'named an AI record' },
          { key: 'people', label: 'People', value: stats.people, hint: 'performed them' },
        ]}
      />

      {entries.length === 0 && !loading ? (
        <FeesAiEmpty icon={History} title="Nothing recorded yet">
          The ledger fills as people use Fees. Collect a fee, export a fee report, or draft text with AI on a Fees
          screen, and the operation appears here with whatever AI Stack record it used.
        </FeesAiEmpty>
      ) : (
        <FeesAiCard className="overflow-hidden">
          <FeesAiCardHeading
            title="Execution history"
            hint="Newest first. Select a row to see everything recorded about it."
          />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[68rem] border-collapse text-left text-sm">
              <FeesAiTableHead
                columns={['When', 'Operation', 'Capability', 'AI Stack record used', 'By', 'About', 'Reference', 'Status']}
              />
              <tbody className="divide-y divide-slate-200">
                {entries.map((entry) => (
                  <tr
                    key={entry.id}
                    onClick={() => setOpen(entry)}
                    className="cursor-pointer align-top transition-colors hover:bg-slate-50"
                  >
                    <td className="whitespace-nowrap px-4 py-2.5 text-xs text-slate-500">{formatWhen(entry.created_at)}</td>
                    <td className="px-4 py-2.5">
                      <div className="text-xs font-medium text-slate-900">
                        {entry.operation_label ?? FEES_OPERATIONS[entry.operation as FeesOperationKey]?.label ?? entry.operation}
                      </div>
                      <div className="mt-0.5 font-mono text-[10px] text-slate-400">{entry.operation}</div>
                    </td>
                    <td className="px-4 py-2.5">
                      {entry.capability ? (
                        <FeesAiPill tone="blue">{entry.capability}</FeesAiPill>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <UsedCell entry={entry} />
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-700">
                      {entry.actor_label ?? (entry.actor_id ? `user ${entry.actor_id}` : '—')}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-700">
                      {entry.subject_label ?? (entry.subject_id ? `${entry.subject_entity_key ?? 'record'} ${entry.subject_id}` : '—')}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[11px] text-slate-600">{entry.reference ?? '—'}</td>
                    <td className="px-4 py-2.5">
                      <FeesAiPill
                        tone={
                          entry.status === 'completed'
                            ? 'green'
                            : entry.status === 'denied'
                              ? 'amber'
                              : entry.status === 'skipped'
                                ? 'gray'
                                : 'red'
                        }
                      >
                        {entry.status}
                      </FeesAiPill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </FeesAiCard>
      )}

      <FeesAiHint>
        These rows sit in the same audit table as the agent runs and governance refusals the rest of the AI layer
        writes, so one investigation reads them together. An operation that used no AI is recorded without an artefact
        rather than attributed to one it did not use.
      </FeesAiHint>

      {open && <EntryDetail entry={open} onClose={() => setOpen(null)} />}
    </section>
  );
}

/** The AI Stack records one entry names, or an honest dash. */
function UsedCell({ entry }: { entry: AiModuleActivityEntry }) {
  const { used } = entry;
  const parts: Array<{ icon: typeof Bot; label: string; title: string }> = [];

  if (used.agent) {
    parts.push({
      icon: Bot,
      label: used.agent.name ?? used.agent.id ?? 'agent',
      title: `Agent ${used.agent.id ?? ''}`.trim(),
    });
  }
  if (used.prompt) {
    parts.push({ icon: Terminal, label: used.prompt.name, title: `${used.prompt.key} v${used.prompt.version}` });
  }
  if (used.template) {
    parts.push({ icon: FileText, label: used.template.name, title: `${used.template.key} v${used.template.version}` });
  }
  if (used.workflow) {
    parts.push({ icon: Workflow, label: used.workflow, title: 'Workflow' });
  }
  if (used.tool) {
    parts.push({ icon: Wrench, label: used.tool, title: 'Tool' });
  }

  if (parts.length === 0) {
    return <span className="text-xs text-slate-400">no AI record — ran without one</span>;
  }

  return (
    <div className="flex flex-wrap gap-1">
      {parts.map((part) => (
        <span
          key={`${part.title}-${part.label}`}
          title={part.title}
          className="inline-flex max-w-[16rem] items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-700"
        >
          <part.icon className="size-3 shrink-0 text-slate-400" />
          <span className="truncate">{part.label}</span>
        </span>
      ))}
    </div>
  );
}

function EntryDetail({ entry, onClose }: { entry: AiModuleActivityEntry; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-slate-950">
              {entry.operation_label ?? entry.operation}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              <span className="font-mono">#{entry.id}</span> · {formatWhen(entry.created_at)} ·{' '}
              {entry.actor_label ?? `user ${entry.actor_id ?? 'unknown'}`}
              {entry.capability ? ` · ${entry.capability}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            Close
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          {entry.message && <p className="text-sm leading-6 text-slate-800">{entry.message}</p>}

          <dl className="grid gap-3 sm:grid-cols-2">
            <Detail label="Status" value={entry.status} />
            <Detail label="Audit outcome" value={entry.outcome ?? '—'} />
            <Detail
              label="About"
              value={
                entry.subject_label ??
                (entry.subject_id ? `${entry.subject_entity_key ?? 'record'} ${entry.subject_id}` : '—')
              }
            />
            <Detail label="Reference" value={entry.reference ?? '—'} />
          </dl>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">AI Stack records used</p>
            {Object.keys(entry.used).length === 0 ? (
              <p className="mt-1 text-sm text-slate-500">
                None. This operation ran without an AI capability, and is recorded that way.
              </p>
            ) : (
              <ul className="mt-2 space-y-2">
                {entry.used.agent && (
                  <UsedRow
                    icon={Bot}
                    title={entry.used.agent.name ?? 'Agent'}
                    lines={[
                      entry.used.agent.id ? `id ${entry.used.agent.id}` : null,
                      entry.used.agent.run_id ? `run ${entry.used.agent.run_id}` : null,
                      `from the ${entry.used.agent.source.replace(/_/g, ' ')}`,
                    ]}
                  />
                )}
                {entry.used.prompt && (
                  <UsedRow
                    icon={Terminal}
                    title={entry.used.prompt.name}
                    lines={[
                      `${entry.used.prompt.key} · v${entry.used.prompt.version} · ${entry.used.prompt.status}`,
                      'resolved from ai_templates by the backend',
                    ]}
                  />
                )}
                {entry.used.template && (
                  <UsedRow
                    icon={FileText}
                    title={entry.used.template.name}
                    lines={[
                      `${entry.used.template.key} · v${entry.used.template.version} · ${entry.used.template.status}`,
                      'resolved from ai_templates by the backend',
                    ]}
                  />
                )}
                {entry.used.workflow && <UsedRow icon={Workflow} title={entry.used.workflow} lines={['Workflow']} />}
                {entry.used.tool && <UsedRow icon={Wrench} title={entry.used.tool} lines={['Tool']} />}
              </ul>
            )}
          </div>

          {entry.result && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Result</p>
              <pre className="mt-1 max-h-72 overflow-auto whitespace-pre-wrap rounded-xl bg-slate-50 p-3 font-mono text-[11px] leading-5 text-slate-800">
                {JSON.stringify(entry.result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-900">{value}</dd>
    </div>
  );
}

function UsedRow({
  icon: Icon,
  title,
  lines,
}: {
  icon: typeof Bot;
  title: string;
  lines: Array<string | null>;
}) {
  return (
    <li className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
      <Icon className="mt-0.5 size-4 shrink-0 text-slate-400" />
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-900">{title}</p>
        {lines.filter(Boolean).map((line) => (
          <p key={line} className="text-[11px] leading-4 text-slate-500">
            {line}
          </p>
        ))}
      </div>
    </li>
  );
}
