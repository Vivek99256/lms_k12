'use client';

/**
 * Fees → AI Stack → Policies.
 *
 * What the AI is allowed to do in Fees, and what it must disclose when it does.
 *
 * DECENTRALISED, NOT DUPLICATED
 *
 * Every row here is an `ai_policies` row reached through the same
 * `lib/intelligence/ai-policies` client the central console uses. There is no second
 * policy store and no second set of endpoints. What makes it Fees is the scope: the
 * list is fetched with `module_key=fees`, so it only ever contains policies carrying a
 * `module` assignment for Fees, and every save from this screen writes that assignment
 * itself. A policy created here cannot come out filed against another module, because
 * the module is not a control the operator can reach.
 *
 * The scope is stored in `ai_policy_assignments` using the columns it already has —
 * `scope_type = 'module'` with `scope_id` set to the Fees row in `ai_modules`. Nothing
 * was added to the database to hold it. The ids come from `/policies/options`, never
 * from a constant here: they differ per estate, and a hardcoded 4 would silently scope
 * a policy to whatever module happened to be fourth.
 *
 * WHY THE FORM LOOKS LIKE THE CENTRAL ONE
 *
 * Because it is the same form over the same fields. The policy type, the rule
 * catalogue and the statuses are all read from `/policies/options` — this file contains
 * no list of rules and no list of policy types, so a rule added in Laravel appears here
 * without an edit. The one field the central screen has that this one does not is the
 * module selector, and that is the point.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, Save, ShieldCheck, SlidersHorizontal, Trash2, X, Loader2 } from 'lucide-react';

import {
  createAiPolicy,
  fetchAiPolicies,
  fetchAiPolicyOptions,
  retireAiPolicy,
  updateAiPolicy,
  type AiPolicyOptions,
  type AiPolicyRow,
} from '@/lib/intelligence/ai-policies';

import {
  FeesAiCard,
  FeesAiEmpty,
  FeesAiError,
  FeesAiHeader,
  FeesAiHint,
  FeesAiLoading,
  FeesAiNotice,
  FeesAiPill,
  FeesAiTableHead,
} from './fees-ai-chrome';

/** This screen is Fees and only Fees. The module is never a control the user can change. */
const MODULE_KEY = 'fees';

/** Scopes other than the module one, which this screen owns and never offers. */
const EXTRA_SCOPES_HINT = 'Narrow it further from the central AI console if it should only apply to one year or grade.';

interface FormState {
  id: number | null;
  name: string;
  description: string;
  policy_type: string;
  status: number;
  require_disclosure: number;
  require_acknowledgement: number;
  ai_detection_required: number;
  plagiarism_check_required: number;
  detection_provider: string;
  detection_threshold: string;
  rules: Record<string, boolean>;
  /** Scopes the operator did not set here — carried through a save untouched. */
  otherAssignments: Array<{ scope_type: string; scope_id: number | null; status: number }>;
}

function blankForm(options: AiPolicyOptions | null): FormState {
  return {
    id: null,
    name: '',
    description: '',
    policy_type: options?.policy_types[0]?.value ?? 'ai_assisted',
    status: 1,
    require_disclosure: 1,
    require_acknowledgement: 0,
    ai_detection_required: 0,
    plagiarism_check_required: 0,
    detection_provider: '',
    detection_threshold: '',
    rules: Object.fromEntries((options?.rule_catalogue ?? []).map((rule) => [rule.key, !!rule.default])),
    otherAssignments: [],
  };
}

function formFrom(row: AiPolicyRow): FormState {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? '',
    policy_type: row.policy_type,
    status: row.status,
    require_disclosure: row.require_disclosure,
    require_acknowledgement: row.require_acknowledgement,
    ai_detection_required: row.ai_detection_required,
    plagiarism_check_required: row.plagiarism_check_required,
    detection_provider: row.detection_provider ?? '',
    detection_threshold: row.detection_threshold?.toString() ?? '',
    rules: row.rules,
    // Saving replaces a policy's whole assignment set, so anything this screen does
    // not manage has to be handed back or editing a Fees policy here would quietly
    // drop the grade or year scope somebody set centrally.
    otherAssignments: row.assignments
      .filter((assignment) => assignment.scope_type !== 'module')
      .map((assignment) => ({
        scope_type: assignment.scope_type,
        scope_id: assignment.scope_id,
        status: assignment.status,
      })),
  };
}

export function FeesPoliciesScreen() {
  const [options, setOptions] = useState<AiPolicyOptions | null>(null);
  const [rows, setRows] = useState<AiPolicyRow[]>([]);
  /** The `ai_modules` ids Fees resolves to. A save needs one; without any, it cannot. */
  const [moduleIds, setModuleIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [token, setToken] = useState(0);

  const reload = useCallback(() => {
    setLoading(true);
    setToken((value) => value + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    Promise.all([fetchAiPolicyOptions(), fetchAiPolicies(MODULE_KEY)])
      .then(([nextOptions, index]) => {
        if (cancelled) return;
        setOptions(nextOptions);
        setRows(index.policies);
        // The index reports the ids it filtered on; options carries the same list for
        // every module. Either answers "which id is Fees", and neither is hardcoded.
        setModuleIds(
          index.module_ids?.length
            ? index.module_ids
            : (nextOptions.modules ?? []).filter((module) => module.key === MODULE_KEY).map((module) => module.id),
        );
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
  }, [token]);

  const patch = (changes: Partial<FormState>) =>
    setForm((current) => (current ? { ...current, ...changes } : current));

  const toggleRule = (key: string) =>
    setForm((current) =>
      current ? { ...current, rules: { ...current.rules, [key]: !(current.rules[key] ?? false) } } : current,
    );

  /**
   * The Fees scope every save writes.
   *
   * Prefer the institute's own `ai_modules` row when it has one, which is the same
   * precedence the backend applies; fall back to the platform row.
   */
  const feesScopeId = moduleIds.length ? Math.max(...moduleIds) : null;

  const canSave = feesScopeId !== null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form || feesScopeId === null) return;

    setSaving(true);
    setError('');

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() === '' ? null : form.description.trim(),
      policy_type: form.policy_type,
      status: form.status,
      require_disclosure: form.require_disclosure,
      require_acknowledgement: form.require_acknowledgement,
      ai_detection_required: form.ai_detection_required,
      plagiarism_check_required: form.plagiarism_check_required,
      detection_provider: form.detection_provider.trim() === '' ? null : form.detection_provider.trim(),
      detection_threshold: form.detection_threshold.trim() === '' ? null : Number(form.detection_threshold),
      rules: form.rules,
      // The Fees assignment is added by this screen, not chosen by the operator — it
      // is what makes the policy a Fees policy at all.
      assignments: [
        { scope_type: 'module', scope_id: feesScopeId, status: 1 },
        ...form.otherAssignments,
      ],
    };

    try {
      if (form.id === null) {
        await createAiPolicy(payload);
        setNotice('Fees AI policy saved. It applies to the Fees module only.');
      } else {
        await updateAiPolicy(form.id, payload);
        setNotice('Fees AI policy updated.');
      }

      setForm(null);
      reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The request failed.');
    } finally {
      setSaving(false);
    }
  };

  const retire = async (row: AiPolicyRow) => {
    if (!window.confirm(`Retire "${row.name}"? Fees AI will stop applying it.`)) return;

    try {
      await retireAiPolicy(row.id);
      setNotice('Policy retired.');
      reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The request failed.');
    }
  };

  const ruleCatalogue = useMemo(() => options?.rule_catalogue ?? [], [options]);

  if (loading && !options) {
    return <FeesAiLoading label="Loading Fees AI policies…" />;
  }

  return (
    <section className="space-y-5">
      <FeesAiHeader
        icon={SlidersHorizontal}
        title="Fees AI policies"
        summary="What the AI may be used for inside Fees, and what it has to disclose. These policies apply to the Fees module only."
        loading={loading}
        onRefresh={reload}
        actions={
          <button
            type="button"
            onClick={() => {
              setForm(blankForm(options));
              setNotice('');
            }}
            disabled={!canSave}
            title={canSave ? undefined : 'Fees is not registered in ai_modules on this estate.'}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-slate-950 px-4 text-sm font-medium text-white hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="size-4" />
            New policy
          </button>
        }
      />

      <FeesAiHint>
        A policy saved here is scoped to Fees — it is stored against the Fees module and no other module reads it.{' '}
        {EXTRA_SCOPES_HINT}
      </FeesAiHint>

      {notice && <FeesAiNotice>{notice}</FeesAiNotice>}
      {error && <FeesAiError onRetry={reload}>{error}</FeesAiError>}

      {!canSave && !loading && (
        <FeesAiError>
          Fees has no row in <span className="font-mono">ai_modules</span> for this institute, so a policy cannot be
          scoped to it. An administrator needs to register the Fees module before policies can be saved here.
        </FeesAiError>
      )}

      {rows.length === 0 && !loading ? (
        <FeesAiEmpty
          icon={ShieldCheck}
          title="No Fees AI policies yet"
          action={
            canSave ? (
              <button
                type="button"
                onClick={() => setForm(blankForm(options))}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-slate-950 px-4 text-sm font-medium text-white hover:opacity-95"
              >
                <Plus className="size-4" />
                New policy
              </button>
            ) : undefined
          }
        >
          Until one exists, Fees AI runs under whatever the estate-wide policies allow. A policy created here narrows
          that to Fees.
        </FeesAiEmpty>
      ) : (
        <FeesAiCard className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[56rem] border-collapse text-left text-sm">
              <FeesAiTableHead columns={['Policy', 'Type', 'Disclosure', 'Detection', 'Allowed uses', 'Status', 'Actions']} />
              <tbody className="divide-y divide-slate-200">
                {rows.map((policy) => {
                  const allowed = Object.entries(policy.rules).filter(([, enabled]) => enabled);

                  return (
                    <tr key={policy.id} className="align-top">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{policy.name}</div>
                        {policy.description && (
                          <div className="mt-1 max-w-md text-xs leading-5 text-slate-500">{policy.description}</div>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600">
                        <div className="flex flex-col gap-1">
                          <span>{policy.policy_type}</span>
                          {policy.is_example ? <FeesAiPill tone="blue">example</FeesAiPill> : null}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {policy.require_disclosure ? 'Required' : 'Not required'}
                        {policy.require_acknowledgement ? <div className="text-slate-400">+ acknowledgement</div> : null}
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
                          <span className="text-slate-400">Not required</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {allowed.length ? (
                          <div className="flex max-w-sm flex-wrap gap-1">
                            {allowed.map(([key]) => (
                              <span
                                key={key}
                                className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-700"
                              >
                                {ruleCatalogue.find((rule) => rule.key === key)?.label ?? key}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">None permitted</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <FeesAiPill tone={policy.status ? 'green' : 'gray'}>
                          {policy.status ? 'active' : 'retired'}
                        </FeesAiPill>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setForm(formFrom(policy));
                              setNotice('');
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-900 hover:bg-slate-50"
                          >
                            <Pencil className="size-3.5" />
                            Edit
                          </button>
                          {policy.status ? (
                            <button
                              type="button"
                              onClick={() => void retire(policy)}
                              className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
                            >
                              <Trash2 className="size-3.5" />
                              Retire
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </FeesAiCard>
      )}

      {form && (
        <form onSubmit={submit} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-slate-950">
              {form.id === null ? 'New Fees AI policy' : 'Edit Fees AI policy'}
            </h3>
            <button
              type="button"
              onClick={() => setForm(null)}
              className="rounded-lg p-1 text-slate-500 hover:text-slate-900"
              aria-label="Close"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-slate-900">Module Name *</span>
              {/* Fixed, and shown rather than hidden — the same choice the Fees
                  Templates screen makes, for the same reason. */}
              <input
                value="Fees"
                readOnly
                className="mt-1 h-10 w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-600"
              />
              <span className="mt-1 block text-xs text-slate-500">This policy applies to Fees only.</span>
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-900">Policy name *</span>
              <input
                value={form.name}
                onChange={(event) => patch({ name: event.target.value })}
                required
                maxLength={191}
                placeholder="Fee reminder drafting policy"
                className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-slate-900">Policy type *</span>
              <select
                value={form.policy_type}
                onChange={(event) => patch({ policy_type: event.target.value })}
                className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              >
                {(options?.policy_types ?? []).map((policyType) => (
                  <option key={policyType.value} value={policyType.value}>
                    {policyType.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-900">Status</span>
              <select
                value={form.status}
                onChange={(event) => patch({ status: Number(event.target.value) })}
                className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              >
                <option value={1}>Active</option>
                <option value={0}>Retired</option>
              </select>
              <span className="mt-1 block text-xs text-slate-500">Only an active policy is applied.</span>
            </label>
          </div>

          <label className="block">
            <span className="text-sm font-medium text-slate-900">What it permits, in plain words</span>
            <textarea
              value={form.description}
              onChange={(event) => patch({ description: event.target.value })}
              rows={3}
              maxLength={2000}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
          </label>

          <fieldset className="rounded-xl border border-slate-200 p-4">
            <legend className="px-1 text-sm font-semibold text-slate-900">Disclosure</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              <Toggle
                label="Require disclosure"
                hint="An AI-assisted fee message says so."
                checked={form.require_disclosure === 1}
                onChange={(next) => patch({ require_disclosure: next ? 1 : 0 })}
              />
              <Toggle
                label="Require acknowledgement"
                hint="A person confirms they have read the disclosure."
                checked={form.require_acknowledgement === 1}
                onChange={(next) => patch({ require_acknowledgement: next ? 1 : 0 })}
              />
              <Toggle
                label="Require AI detection"
                checked={form.ai_detection_required === 1}
                onChange={(next) => patch({ ai_detection_required: next ? 1 : 0 })}
              />
              <Toggle
                label="Require plagiarism check"
                checked={form.plagiarism_check_required === 1}
                onChange={(next) => patch({ plagiarism_check_required: next ? 1 : 0 })}
              />
            </div>

            {(form.ai_detection_required === 1 || form.plagiarism_check_required === 1) && (
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-medium text-slate-900">Detection provider</span>
                  <input
                    value={form.detection_provider}
                    onChange={(event) => patch({ detection_provider: event.target.value })}
                    maxLength={120}
                    className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-slate-900">Detection threshold</span>
                  <input
                    value={form.detection_threshold}
                    onChange={(event) => patch({ detection_threshold: event.target.value })}
                    inputMode="decimal"
                    placeholder="0 – 100"
                    className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  />
                </label>
              </div>
            )}
          </fieldset>

          <fieldset className="rounded-xl border border-slate-200 p-4">
            <legend className="px-1 text-sm font-semibold text-slate-900">Allowed AI uses in Fees</legend>
            {ruleCatalogue.length === 0 ? (
              <p className="text-sm text-slate-500">
                The rule catalogue came back empty, so there is nothing to permit or refuse yet.
              </p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {ruleCatalogue.map((rule) => (
                  <Toggle
                    key={rule.key}
                    label={rule.label}
                    checked={!!form.rules[rule.key]}
                    onChange={() => toggleRule(rule.key)}
                  />
                ))}
              </div>
            )}
          </fieldset>

          {form.otherAssignments.length > 0 && (
            <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600">
              This policy also carries {form.otherAssignments.length} scope
              {form.otherAssignments.length === 1 ? '' : 's'} set in the central AI console
              {' '}({form.otherAssignments.map((assignment) => assignment.scope_type).join(', ')}). Saving here keeps
              them.
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={saving || !canSave}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-medium text-white disabled:opacity-60"
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Save
            </button>
            <button
              type="button"
              onClick={() => setForm(null)}
              className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-medium text-slate-900 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 size-4 shrink-0 accent-blue-600"
      />
      <span className="min-w-0">
        {label}
        {hint && <span className="mt-0.5 block text-xs text-slate-500">{hint}</span>}
      </span>
    </label>
  );
}
