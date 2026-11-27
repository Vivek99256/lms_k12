'use client';

import type { FeesEscalation, WorkflowStep } from '@/lib/platform/types';

import { Card, Pill } from '../../../_components/shell';
import { StepLadder } from '../StepLadder';

/**
 * The Escalation Rule card, in full: the ₹5,000 / ₹25,000 thresholds, every
 * chain configured on this point (reusing `StepLadder`, the same ladder the
 * workflow editor itself renders, with the chain the engine actually runs
 * called out), the current-step-tier × required-tier cross-tab, and the
 * findings list — each finding keeps the server's own `message` as the real
 * content; `FINDING_LABELS` only gives its `code` a short human title next
 * to that sentence, never instead of it.
 */

const FINDING_LABELS: Record<string, string> = {
  no_active_chain: 'No chain active',
  over_routed_pending: 'Routed past the required tier',
  required_tier_missing: 'Required tier missing from the chain',
  approved_without_required_tier: 'Approved without the required tier',
  auto_approved_steps: 'Steps auto-approved with no one looking',
  multiple_active_chains: 'More than one active chain',
};

function inr(amount: number): string {
  return '₹' + Math.round(amount).toLocaleString('en-IN');
}

export function EscalationReportPanel({ data }: { data: FeesEscalation }) {
  const tiers = Array.from(
    new Set(Object.entries(data.matrix ?? {}).flatMap(([row, cols]) => [row, ...Object.keys(cols)])),
  );

  return (
    <div className="space-y-4">
      <Card className="px-4 py-3">
        <p className="text-sm text-slate-700">
          Concessions &le; {inr(data.rule.accounts_max)} clear at Accounts; &gt; {inr(data.rule.principal_max)} require Trustee sign-off.
        </p>
        <p className="mt-1 text-xs text-slate-500">
          {data.rule.enforced ? 'Enforced by the approval engine.' : data.rule.basis ?? 'Display policy only — not yet enforced by the approval engine itself.'}
        </p>
      </Card>

      <section>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Chains on this point</h4>
        {data.chains.length === 0 ? (
          <p className="text-sm text-slate-600">No chains configured.</p>
        ) : (
          <div className="space-y-2">
            {data.chains.map((chain) => {
              const steps: WorkflowStep[] = chain.steps.map((step, index) => ({
                id: `${chain.id}_${index}`,
                order: step.order,
                name: step.name,
                approver_type: 'role',
                approver: step.approver || step.tier,
                sla_hours: 0,
                on_breach: 'none',
                allow_delegate: false,
                require_comment: false,
              }));

              return (
                <Card
                  key={chain.id}
                  className={`px-4 py-3 transition-shadow hover:shadow-md ${chain.engine_choice ? 'border-indigo-200 ring-1 ring-indigo-100' : ''}`}
                >
                  <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-slate-900">
                    {chain.name}
                    <Pill tone={chain.status === 'active' ? 'green' : chain.status === 'draft' ? 'amber' : 'gray'}>{chain.status}</Pill>
                    {chain.engine_choice && <Pill tone="blue">this is the one that actually runs</Pill>}
                  </p>
                  {chain.condition && <p className="mt-0.5 text-xs text-slate-500">when {chain.condition}</p>}
                  <StepLadder steps={steps} approverTypes={[]} />
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {tiers.length > 0 && (
        <section>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Where approvals actually land</h4>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">Current step tier</th>
                  {tiers.map((tier) => (
                    <th key={tier} className="px-3 py-2">
                      {tier}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(data.matrix).map(([row, cols]) => (
                  <tr key={row} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-medium text-slate-700">{row}</td>
                    {tiers.map((tier) => (
                      <td key={tier} className="px-3 py-2 tabular-nums">
                        {cols[tier] ?? 0}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Findings</h4>
        {data.findings.length === 0 ? (
          <p className="text-sm text-slate-600">No findings — the queue matches what the rule expects.</p>
        ) : (
          <ul className="space-y-2">
            {data.findings.map((finding, index) => (
              <li
                key={`${finding.code}_${index}`}
                className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900 shadow-xs transition-shadow hover:shadow-sm"
              >
                <p className="font-medium">
                  {FINDING_LABELS[finding.code] ?? finding.code} <span className="font-normal text-amber-700">({finding.count})</span>
                </p>
                <p className="mt-0.5 text-xs text-amber-800">{finding.message}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
