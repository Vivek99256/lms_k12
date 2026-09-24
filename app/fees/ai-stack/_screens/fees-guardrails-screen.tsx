'use client';

/**
 * Fees → AI Stack → Guardrails.
 *
 * The limits the Fees module's AI operates within, and what they actually stopped.
 *
 * WHY THIS SCREEN READS RATHER THAN OWNS
 *
 * Every guardrail shown here is already configured in the place it is enforced:
 *
 *   · which capabilities Fees may use at all → `ai_modules.capabilities` for Fees
 *   · whether a person must read what a model wrote → `requires_review` on each Fees
 *     template, edited on the Prompts and Templates tabs
 *   · what may be sent to a model, and what must be disclosed → the Fees AI policies
 *     on the Policies tab
 *   · what a Fees agent may call → the module's tool catalogue, where every Fees tool
 *     is annotated `read` or `draft` and no `write` tool exists to select
 *
 * A second place to edit any of those would be a second source of truth, and the first
 * time the two disagreed the one nobody was looking at would be the one being enforced.
 * So this tab gathers them into one view and sends the operator to the tab that owns
 * each. It is the only honest arrangement given the rule that these tabs must not
 * duplicate each other's function.
 *
 * WHAT IT ADDS THAT NOTHING ELSE HAS
 *
 * The refusals. A guardrails screen listing only configuration is a screen of good
 * intentions; the rows at the bottom are the requests a rule actually stopped, with the
 * verdict the governance layer recorded and the reason it gave. Those come from
 * `ai_generation_requests` for Fees templates, whose `status` is that verdict — so the
 * list needs no hardcoded catalogue of failure names to stay accurate.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, CircleSlash, ShieldAlert, ShieldCheck, Wrench } from 'lucide-react';

import { fetchModuleGuardrails, type AiModuleGuardrails } from '@/lib/intelligence/ai-module';
import { fetchAiPolicies, type AiPolicyRow } from '@/lib/intelligence/ai-policies';
import { toolsForModule } from '@/lib/agents/registry';

import {
  FeesAiCard,
  FeesAiCardHeading,
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

/**
 * What each capability flag actually permits, in the operator's terms.
 *
 * The keys are the ones `ai_modules.capabilities` carries. An unknown key is still
 * rendered — with its raw name — so a capability added in Laravel shows up here as
 * something rather than being silently dropped.
 */
const CAPABILITY_WORDING: Record<string, { label: string; allows: string }> = {
  conversational: { label: 'Conversational', allows: 'Somebody may ask the assistant a fee question from a Fees page.' },
  generative: { label: 'Generative', allows: 'A model may write text and fill Fees report templates.' },
  agent: { label: 'Agents', allows: 'A backend domain agent may run for Fees.' },
  workflow: { label: 'Workflows', allows: 'A multi-step Fees workflow may be started and may pause for approval.' },
  ontology: { label: 'Knowledge graph', allows: 'Fees records may be traversed through the entity graph.' },
};

export function FeesGuardrailsScreen() {
  const [guardrails, setGuardrails] = useState<AiModuleGuardrails | null>(null);
  const [policies, setPolicies] = useState<AiPolicyRow[] | null>(null);
  /** Non-fatal: policies are a separate endpoint and a separate right. */
  const [policiesError, setPoliciesError] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [token, setToken] = useState(0);

  const reload = useCallback(() => {
    setLoading(true);
    setToken((value) => value + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    fetchModuleGuardrails(MODULE_KEY)
      .then((next) => {
        if (cancelled) return;
        setGuardrails(next);
        setError('');
        setLoading(false);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : 'The request failed.');
        setLoading(false);
      });

    fetchAiPolicies(MODULE_KEY)
      .then((index) => {
        if (!cancelled) setPolicies(index.policies.filter((policy) => policy.status === 1));
      })
      .catch((cause: unknown) => {
        if (!cancelled) setPoliciesError(cause instanceof Error ? cause.message : 'Policies unavailable.');
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  /** The Fees agent tool catalogue, and the ceiling it implies. */
  const tools = useMemo(() => toolsForModule(MODULE_KEY), []);
  const writeTools = useMemo(() => tools.filter((tool) => tool.risk === 'write' && tool.available), [tools]);

  const review = guardrails?.review;
  // Memoised together: `?? {}` is a fresh object each render, so deriving the key list
  // from it directly would rebuild that list on every render.
  const capabilities = useMemo(() => guardrails?.capabilities ?? {}, [guardrails]);
  const capabilityKeys = useMemo(() => Object.keys(capabilities), [capabilities]);

  if (loading && !guardrails) {
    return <FeesAiLoading label="Loading Fees guardrails…" />;
  }

  return (
    <section className="space-y-5">
      <FeesAiHeader
        icon={ShieldAlert}
        title="Fees AI guardrails"
        summary="What the Fees module's AI is allowed to do, what a person has to approve, and which requests a rule refused."
        loading={loading}
        onRefresh={reload}
      />

      {error && <FeesAiError onRetry={reload}>{error}</FeesAiError>}

      <FeesAiMetrics
        metrics={[
          {
            key: 'capabilities',
            label: 'Capabilities on',
            value: capabilityKeys.filter((key) => capabilities[key]).length,
            hint: `of ${capabilityKeys.length || '—'} for Fees`,
          },
          {
            key: 'review',
            label: 'Need review',
            value: review?.available ? review.requires_review : '—',
            hint: review?.available ? `of ${review.templates} Fees templates` : 'unavailable',
          },
          {
            key: 'policies',
            label: 'Active policies',
            value: policies ? policies.length : '—',
            hint: policiesError ? 'not readable' : 'scoped to Fees',
          },
          {
            key: 'write-tools',
            label: 'Write tools',
            value: writeTools.length,
            hint: 'agents that change records',
          },
          {
            key: 'refusals',
            label: 'Refusals',
            value: guardrails ? guardrails.refusals.length : '—',
            hint: 'requests a rule stopped',
          },
        ]}
      />

      <FeesAiCard className="overflow-hidden">
        <FeesAiCardHeading
          title="What Fees AI may do at all"
          hint="From the Fees row in ai_modules. A capability that is off cannot be reached, whatever a policy allows."
        />
        {capabilityKeys.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-500">
            {guardrails?.module.registered === false
              ? 'Fees is not registered as an AI module, so no capability is enabled for it.'
              : 'No capability flags are recorded for Fees.'}
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {capabilityKeys.map((key) => {
              const enabled = capabilities[key];
              const wording = CAPABILITY_WORDING[key];

              return (
                <li key={key} className="flex items-start gap-3 px-5 py-3">
                  {enabled ? (
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                  ) : (
                    <CircleSlash className="mt-0.5 size-4 shrink-0 text-slate-300" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={enabled ? 'text-sm font-medium text-slate-900' : 'text-sm font-medium text-slate-400'}>
                        {wording?.label ?? key}
                      </span>
                      <FeesAiPill tone={enabled ? 'green' : 'gray'}>{enabled ? 'allowed' : 'blocked'}</FeesAiPill>
                    </div>
                    <p className={enabled ? 'mt-0.5 text-xs leading-5 text-slate-500' : 'mt-0.5 text-xs leading-5 text-slate-400'}>
                      {wording?.allows ?? `Capability "${key}", as recorded for Fees.`}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </FeesAiCard>

      <div className="grid gap-5 lg:grid-cols-2">
        <FeesAiCard className="overflow-hidden">
          <FeesAiCardHeading
            title="Human review"
            hint="Whether a person must read what a model wrote before it is used. Set per template."
          />
          {!review?.available ? (
            <p className="px-5 py-6 text-sm text-slate-500">{review?.reason ?? 'Unavailable.'}</p>
          ) : review.templates === 0 ? (
            <p className="px-5 py-6 text-sm text-slate-500">
              Fees has no templates, so there is nothing to review and nothing a model can produce through them.
            </p>
          ) : (
            <>
              <dl className="divide-y divide-slate-100">
                <GuardRow label="Fees templates" value={`${review.templates}`} />
                <GuardRow label="Published, so in use" value={`${review.published}`} />
                <GuardRow
                  label="Require a person to review"
                  value={`${review.requires_review} of ${review.templates}`}
                  tone={review.requires_review === review.templates ? 'green' : 'amber'}
                />
                <GuardRow
                  label="May be cited as evidence"
                  value={`${review.allowed_as_evidence}`}
                  tone={review.allowed_as_evidence > 0 ? 'amber' : 'green'}
                />
              </dl>
              {review.requires_review < review.published && (
                <p className="border-t border-slate-100 bg-amber-50 px-5 py-3 text-xs leading-5 text-amber-900">
                  {review.published - review.requires_review} published Fees template(s) can produce output nobody has
                  to read. Turn on review for one on the <strong>Prompts</strong> or <strong>Templates</strong> tab.
                </p>
              )}
            </>
          )}
        </FeesAiCard>

        <FeesAiCard className="overflow-hidden">
          <FeesAiCardHeading
            title="What a Fees agent may call"
            hint="The module's tool catalogue. A tool absent from it cannot be put on an agent's allow-list."
          />
          <ul className="divide-y divide-slate-100">
            {tools.map((tool) => (
              <li key={tool.key} className="flex items-start gap-3 px-5 py-2.5">
                <Wrench className="mt-0.5 size-3.5 shrink-0 text-slate-400" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[11px] text-slate-700">{tool.key}</span>
                    <FeesAiPill tone={tool.risk === 'write' ? 'red' : tool.risk === 'draft' ? 'blue' : 'green'}>
                      {tool.risk}
                    </FeesAiPill>
                    {!tool.available && <FeesAiPill tone="gray">not selectable</FeesAiPill>}
                  </div>
                  <p className="mt-0.5 text-xs leading-5 text-slate-500">{tool.description}</p>
                </div>
              </li>
            ))}
          </ul>
          <p className="border-t border-slate-100 px-5 py-3 text-xs leading-5 text-slate-600">
            {writeTools.length === 0 ? (
              <>
                No Fees agent tool can change a record. Reads return what the fee rows say and drafts produce text a
                person still has to send — so the worst a Fees agent can do is be wrong on screen.
              </>
            ) : (
              <>
                {writeTools.length} Fees tool(s) can change records. Any agent allowed one should require confirmation
                before it runs.
              </>
            )}
          </p>
        </FeesAiCard>
      </div>

      <FeesAiCard className="overflow-hidden">
        <FeesAiCardHeading
          title="Disclosure and detection"
          hint="From the Fees AI policies. Edited on the Policies tab, which is where they are enforced from."
        />
        {policiesError ? (
          <p className="px-5 py-6 text-sm text-slate-500">{policiesError}</p>
        ) : !policies ? (
          <p className="px-5 py-6 text-sm text-slate-500">Loading Fees policies…</p>
        ) : policies.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-500">
            No active policy is scoped to Fees, so Fees AI runs under whatever the estate-wide policies allow. Create
            one on the <strong>Policies</strong> tab to narrow it.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[44rem] border-collapse text-left text-sm">
              <FeesAiTableHead columns={['Policy', 'Disclosure', 'Acknowledgement', 'Detection', 'Refused uses']} />
              <tbody className="divide-y divide-slate-200">
                {policies.map((policy) => {
                  const refused = Object.entries(policy.rules).filter(([, enabled]) => !enabled);

                  return (
                    <tr key={policy.id} className="align-top">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{policy.name}</div>
                        <div className="mt-0.5 text-xs text-slate-500">{policy.policy_type}</div>
                      </td>
                      <td className="px-4 py-3">
                        <FeesAiPill tone={policy.require_disclosure ? 'green' : 'amber'}>
                          {policy.require_disclosure ? 'required' : 'not required'}
                        </FeesAiPill>
                      </td>
                      <td className="px-4 py-3">
                        <FeesAiPill tone={policy.require_acknowledgement ? 'green' : 'gray'}>
                          {policy.require_acknowledgement ? 'required' : 'not required'}
                        </FeesAiPill>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {policy.ai_detection_required || policy.plagiarism_check_required ? (
                          <>
                            <div>{policy.detection_provider ?? 'provider not set'}</div>
                            {policy.detection_threshold !== null && (
                              <div className="text-slate-400">threshold {policy.detection_threshold}</div>
                            )}
                          </>
                        ) : (
                          <span className="text-slate-400">not required</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {refused.length ? (
                          <div className="flex max-w-sm flex-wrap gap-1">
                            {refused.map(([key]) => (
                              <span
                                key={key}
                                className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] text-red-700"
                              >
                                {key}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">nothing refused</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </FeesAiCard>

      <FeesAiCard className="overflow-hidden">
        <FeesAiCardHeading
          title="Requests a rule refused"
          hint="Fees generations that did not complete, with the verdict the governance layer recorded."
        />

        {guardrails && guardrails.refusal_counts.length > 0 && (
          <div className="flex flex-wrap gap-1.5 border-b border-slate-100 px-5 py-3">
            {guardrails.refusal_counts.map((row) => (
              <FeesAiPill key={row.status} tone={row.status === 'completed' ? 'green' : 'amber'}>
                {row.status} {row.count}
              </FeesAiPill>
            ))}
          </div>
        )}

        {!guardrails || guardrails.refusals.length === 0 ? (
          <p className="flex items-start gap-2 px-5 py-6 text-sm text-slate-500">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" />
            <span>
              Nothing has been refused for Fees. That is either a clean record or an unused one — the{' '}
              <strong>Usage &amp; Cost</strong> tab says which, by showing how much has been asked of Fees AI at all.
            </span>
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[52rem] border-collapse text-left text-sm">
              <FeesAiTableHead columns={['Request', 'Template', 'Verdict', 'Reason recorded', 'Model', 'When']} />
              <tbody className="divide-y divide-slate-200">
                {guardrails.refusals.map((refusal) => (
                  <tr key={refusal.id} className="align-top">
                    <td className="px-4 py-2.5">
                      <div className="font-mono text-[11px] text-slate-600">{refusal.reference}</div>
                      {refusal.purpose && <div className="mt-0.5 text-xs text-slate-500">{refusal.purpose}</div>}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[11px] text-slate-600">{refusal.template_key ?? '—'}</td>
                    <td className="px-4 py-2.5">
                      <FeesAiPill tone="amber">{refusal.status}</FeesAiPill>
                    </td>
                    <td className="max-w-sm px-4 py-2.5 text-xs leading-5 text-slate-600">
                      {refusal.reason ?? <span className="text-slate-400">none recorded</span>}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-600">
                      {refusal.provider ? `${refusal.provider}${refusal.model ? ` · ${refusal.model}` : ''}` : '—'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-xs text-slate-500">{formatWhen(refusal.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </FeesAiCard>

      <FeesAiHint>
        Each guardrail is edited where it is enforced — capabilities in the AI module registry, review on a template,
        disclosure on a policy, tool reach in the agent catalogue. This tab reads all four so they can be checked
        together, and deliberately does not offer a second place to change them.
      </FeesAiHint>
    </section>
  );
}

function GuardRow({ label, value, tone }: { label: string; value: string; tone?: 'green' | 'amber' }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 py-2.5">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="flex items-center gap-2 text-sm tabular-nums text-slate-900">
        {value}
        {tone && <FeesAiPill tone={tone}>{tone === 'green' ? 'all' : 'partial'}</FeesAiPill>}
      </dd>
    </div>
  );
}
