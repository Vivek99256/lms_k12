'use client';

/**
 * Admission → AI Stack → Policies.
 *
 * What the AI is allowed to do in Admissions, who may operate it, and what it must
 * disclose when it does.
 *
 * DECENTRALISED, NOT DUPLICATED
 *
 * Every row here is an `ai_policies` row reached through the same
 * `lib/intelligence/ai-policies` client the central console and the Fees and Attendance
 * screens use. There is no second policy store and no second set of endpoints. What makes
 * it Admissions is the scope: the list is fetched with `module_key=admissions`, so it only
 * ever contains policies carrying a `module` assignment for Admissions, and every save
 * from this screen writes that assignment itself. A policy created here cannot come out
 * filed against another module, because the module is not a control the operator can
 * reach.
 *
 * The scope is stored in `ai_policy_assignments` using the columns it already has —
 * `scope_type = 'module'` with `scope_id` set to the Admissions row in `ai_modules`.
 * Nothing was added to the database to hold it. The ids come from `/policies/options` and
 * from the index's own `module_ids`, never from a constant here: they differ per estate,
 * and a hardcoded number would silently scope a policy to whatever module happened to be
 * at that id.
 *
 * WHY "WHO MAY OPERATE IT" IS SHOWN HERE AND NOT EDITED HERE
 *
 * A policy says what the AI may do. It does not say who may do it — that is RBAC, it lives
 * in `tblgroupwise_rights` against a menu row, and it is granted in Group-wise Rights like
 * every other right in this ERP. Building a second place to grant it would be a second
 * authorization system, and the one thing worse than a permission nobody holds is two
 * answers to who holds it.
 *
 * So the panel below reads the caller's own resolved rights and names the key, because the
 * failure this replaces was a screen that said "ask an administrator for rights" without
 * anywhere to see whether you had them or what the key even was. It shows; it does not
 * grant.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { KeyRound, Loader2, Pencil, Plus, Save, ShieldCheck, SlidersHorizontal, Trash2, X } from 'lucide-react';

import { AiFieldAssistant } from '@/components/ai/AiFieldAssistant';
import { usePermissions } from '@/app/hooks/usePermission';
import { rbacModuleKey } from '@/lib/agents/registry';

import {
  createAiPolicy,
  fetchAiPolicies,
  fetchAiPolicyOptions,
  retireAiPolicy,
  updateAiPolicy,
  type AiPolicyOptions,
  type AiPolicyRow,
} from '@/lib/intelligence/ai-policies';
import { ADMISSIONS_MODULE } from '@/lib/admissions/admissions-ai-stack';

import {
  AiStackCard,
  AiStackCardHeading,
  AiStackEmpty,
  AiStackError,
  AiStackHeader,
  AiStackHint,
  AiStackLoading,
  AiStackNotice,
  AiStackPill,
  AiStackTableHead,
} from './admissions-ai-chrome';

/** Scopes other than the module one, which this screen owns and never offers. */
const EXTRA_SCOPES_HINT =
  'Narrow it further from the central AI console if it should only apply to one year or grade.';

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
    // On by default, and it matters here as much as anywhere: a family reading a message
    // about their child's application should be told a machine drafted it.
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
    // Saving replaces a policy's whole assignment set, so anything this screen does not
    // manage has to be handed back or editing an Admission policy here would quietly drop
    // the grade or year scope somebody set centrally.
    otherAssignments: row.assignments
      .filter((assignment) => assignment.scope_type !== 'module')
      .map((assignment) => ({
        scope_type: assignment.scope_type,
        scope_id: assignment.scope_id,
        status: assignment.status,
      })),
  };
}

export function AdmissionsPoliciesScreen() {
  const [options, setOptions] = useState<AiPolicyOptions | null>(null);
  const [rows, setRows] = useState<AiPolicyRow[]>([]);
  /** The `ai_modules` ids Admissions resolves to. A save needs one; without any, it cannot. */
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

    Promise.all([fetchAiPolicyOptions(), fetchAiPolicies(ADMISSIONS_MODULE)])
      .then(([nextOptions, index]) => {
        if (cancelled) return;
        setOptions(nextOptions);
        setRows(index.policies);
        // The index reports the ids it filtered on; options carries the same list for
        // every module. Either answers "which id is Admissions", and neither is hardcoded.
        setModuleIds(
          index.module_ids?.length
            ? index.module_ids
            : (nextOptions.modules ?? [])
                .filter((module) => module.key === ADMISSIONS_MODULE)
                .map((module) => module.id),
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
   * The Admissions scope every save writes.
   *
   * Prefer the institute's own `ai_modules` row when it has one, which is the same
   * precedence the backend applies; fall back to the platform row.
   */
  const admissionsScopeId = moduleIds.length ? Math.max(...moduleIds) : null;

  const canSave = admissionsScopeId !== null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form || admissionsScopeId === null) return;

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
      // The Admissions assignment is added by this screen, not chosen by the operator —
      // it is what makes the policy an Admission policy at all.
      assignments: [
        { scope_type: 'module', scope_id: admissionsScopeId, status: 1 },
        ...form.otherAssignments,
      ],
    };

    try {
      if (form.id === null) {
        await createAiPolicy(payload);
        setNotice('Admission AI policy saved. It applies to the Admission module only.');
      } else {
        await updateAiPolicy(form.id, payload);
        setNotice('Admission AI policy updated.');
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
    if (!window.confirm(`Retire "${row.name}"? Admission AI will stop applying it.`)) return;

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
    return <AiStackLoading label="Loading Admission AI policies…" />;
  }

  return (
    <section className="space-y-5">
      <AiStackHeader
        icon={SlidersHorizontal}
        title="Admission AI policies"
        summary="What the AI may be used for inside Admissions, who may operate it, and what it has to disclose. These policies apply to the Admission module only."
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
            title={canSave ? undefined : 'Admissions is not registered in ai_modules on this estate.'}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-slate-950 px-4 text-sm font-medium text-white hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="size-4" />
            New policy
          </button>
        }
      />

      <AiStackHint>
        A policy saved here is scoped to Admissions — it is stored against the Admission module and no other module
        reads it. {EXTRA_SCOPES_HINT}
      </AiStackHint>

      {notice && <AiStackNotice>{notice}</AiStackNotice>}
      {error && <AiStackError onRetry={reload}>{error}</AiStackError>}

      <OperatorRightsPanel />

      {!canSave && !loading && (
        <AiStackError>
          Admissions has no row in <span className="font-mono">ai_modules</span> for this institute, so a policy cannot
          be scoped to it. An administrator needs to register the Admission module before policies can be saved here.
        </AiStackError>
      )}

      {rows.length === 0 && !loading ? (
        <AiStackEmpty
          icon={ShieldCheck}
          title="No Admission AI policies yet"
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
          Until one exists, Admission AI runs under whatever the estate-wide policies allow. A policy created here
          narrows that to Admissions.
        </AiStackEmpty>
      ) : (
        <AiStackCard className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[56rem] border-collapse text-left text-sm">
              <AiStackTableHead
                columns={['Policy', 'Type', 'Disclosure', 'Detection', 'Allowed uses', 'Status', 'Actions']}
              />
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
                          {policy.is_example ? <AiStackPill tone="blue">example</AiStackPill> : null}
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
                        <AiStackPill tone={policy.status ? 'green' : 'gray'}>
                          {policy.status ? 'active' : 'retired'}
                        </AiStackPill>
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
        </AiStackCard>
      )}

      {form && (
        <form onSubmit={submit} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-slate-950">
              {form.id === null ? 'New Admission AI policy' : 'Edit Admission AI policy'}
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
              <input
                value="Admission"
                readOnly
                className="mt-1 h-10 w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-600"
              />
              <span className="mt-1 block text-xs text-slate-500">This policy applies to Admissions only.</span>
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-900">Policy name *</span>
              <input
                value={form.name}
                onChange={(event) => patch({ name: event.target.value })}
                required
                maxLength={191}
                placeholder="Admission follow-up drafting policy"
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

          {/* A real <label htmlFor> rather than a wrapper: the assistant's trigger is a
              button, and a button inside a <label> also toggles the label's control. */}
          <div className="block">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="admissions-policy-description" className="text-sm font-medium text-slate-900">
                What it permits, in plain words
              </label>
              <AiFieldAssistant
                value={form.description}
                onApply={(next) => patch({ description: next })}
                fieldType="policy"
                label="What it permits, in plain words"
                module={ADMISSIONS_MODULE}
                page="AI Stack — Policies"
                entityType="admissions_ai_policy"
                maxLength={2000}
                related={{ Policy: form.name }}
              />
            </div>
            <textarea
              id="admissions-policy-description"
              value={form.description}
              onChange={(event) => patch({ description: event.target.value })}
              rows={3}
              maxLength={2000}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <fieldset className="rounded-xl border border-slate-200 p-4">
            <legend className="px-1 text-sm font-semibold text-slate-900">Disclosure</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              <Toggle
                label="Require disclosure"
                hint="An AI-assisted admission message says so."
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
            <legend className="px-1 text-sm font-semibold text-slate-900">Allowed AI uses in Admissions</legend>
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
              {form.otherAssignments.length === 1 ? '' : 's'} set in the central AI console (
              {form.otherAssignments.map((assignment) => assignment.scope_type).join(', ')}). Saving here keeps them.
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

/**
 * Your own rights over Admission AI, and the key they are granted against.
 *
 * Read-only by design — see the note at the top of this file. It answers the two questions
 * a person actually has when a control is disabled: what am I allowed to do, and what is
 * the thing an administrator has to grant me.
 *
 * `undefined` is rendered as "not known yet" rather than as "no", because a permission
 * lookup that has not answered and one that answered no are different states, and showing
 * a red cross for the first is how a working account is told it is locked out.
 */
function OperatorRightsPanel() {
  const moduleKey = rbacModuleKey(ADMISSIONS_MODULE);
  const modules = useMemo(() => [moduleKey], [moduleKey]);
  const { permissions, loading, authenticated, error } = usePermissions(modules);

  const flags = permissions?.[moduleKey];

  const cells: Array<{ action: 'view' | 'create' | 'update' | 'delete'; label: string; hint: string }> = [
    { action: 'view', label: 'See Admission agents', hint: 'Open Automations and read the run log.' },
    { action: 'create', label: 'Enable an agent', hint: 'Switch on an Admission agent for this school.' },
    { action: 'update', label: 'Run or pause an agent', hint: 'Run an agent, and pause or resume one.' },
    { action: 'delete', label: 'Remove an agent', hint: 'Archive an Admission agent.' },
  ];

  return (
    <AiStackCard>
      <AiStackCardHeading
        title="Who may operate Admission AI"
        hint={`Granted in Group-wise Rights against the "${moduleKey}" menu row, not here.`}
        actions={
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 font-mono text-[11px] text-slate-700">
            <KeyRound className="size-3.5" />
            {moduleKey}
          </span>
        }
      />

      <div className="p-5">
        {error && (
          <p className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            {error}
          </p>
        )}

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {cells.map((cell) => {
            const value = loading || !authenticated ? undefined : (flags?.[cell.action] ?? false);

            return (
              <div key={cell.action} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                <p className="text-sm font-medium text-slate-900">{cell.label}</p>
                <p className="mt-0.5 text-[11px] leading-4 text-slate-500">{cell.hint}</p>
                <p className="mt-1.5">
                  {value === undefined ? (
                    <AiStackPill tone="gray">not known yet</AiStackPill>
                  ) : value ? (
                    <AiStackPill tone="green">you may</AiStackPill>
                  ) : (
                    <AiStackPill tone="amber">you may not</AiStackPill>
                  )}
                </p>
              </div>
            );
          })}
        </div>

        <p className="mt-3 text-xs leading-5 text-slate-500">
          These flags decide what the Automations tab offers you. The backend checks the same key again on every create
          and every run, so a client that ignored them would gain nothing.
        </p>
      </div>
    </AiStackCard>
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
