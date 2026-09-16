'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BriefcaseBusiness, Loader2, Pencil, Plus, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react';

import { CapabilityShell } from '../_components/CapabilityShell';
import {
  createAiPolicy,
  fetchAiPolicyOptions,
  fetchAiPolicies,
  retireAiPolicy,
  updateAiPolicy,
  type AiPolicyIndex,
  type AiPolicyOptions,
  type AiPolicyRow,
} from '@/lib/intelligence/ai-policies';

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
  assignments: Array<{ scope_type: string; scope_id: string; status: number }>;
}

const EMPTY_FORM: FormState = {
  id: null,
  name: '',
  description: '',
  policy_type: 'ai_assisted',
  status: 1,
  require_disclosure: 0,
  require_acknowledgement: 0,
  ai_detection_required: 0,
  plagiarism_check_required: 0,
  detection_provider: '',
  detection_threshold: '',
  rules: {},
  assignments: [],
};

export default function AiPoliciesPage() {
  return (
    <CapabilityShell slug="policies">
      <PolicyManager />
    </CapabilityShell>
  );
}

function PolicyManager() {
  const [options, setOptions] = useState<AiPolicyOptions | null>(null);
  const [index, setIndex] = useState<AiPolicyIndex | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    setReloadToken((token) => token + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    Promise.all([fetchAiPolicyOptions(), fetchAiPolicies()])
      .then(([nextOptions, nextIndex]) => {
        if (cancelled) return;
        setOptions(nextOptions);
        setIndex(nextIndex);
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
  }, [reloadToken]);

  const openAdd = () => {
    setForm({
      ...EMPTY_FORM,
      rules: Object.fromEntries((options?.rule_catalogue ?? []).map((rule) => [rule.key, !!rule.default])),
      assignments: [],
    });
    setNotice(null);
  };

  const openEdit = (row: AiPolicyRow) => {
    setForm({
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
      assignments: row.assignments.map((assignment) => ({
        scope_type: assignment.scope_type,
        scope_id: assignment.scope_id?.toString() ?? '',
        status: assignment.status,
      })),
    });
    setNotice(null);
  };

  const closeForm = () => {
    setForm(null);
  };

  const addAssignment = () => {
    setForm((current) => {
      if (!current) return current;
      return {
        ...current,
        assignments: [...current.assignments, { scope_type: 'global', scope_id: '', status: 1 }],
      };
    });
  };

  const removeAssignment = (index: number) => {
    setForm((current) => {
      if (!current) return current;
      return {
        ...current,
        assignments: current.assignments.filter((_, itemIndex) => itemIndex !== index),
      };
    });
  };

  const updateAssignment = (index: number, field: 'scope_type' | 'scope_id' | 'status', value: string | number) => {
    setForm((current) => {
      if (!current) return current;
      const nextAssignments = [...current.assignments];
      nextAssignments[index] = {
        ...nextAssignments[index],
        [field]: value,
      };
      return { ...current, assignments: nextAssignments };
    });
  };

  const toggleRule = (key: string) => {
    setForm((current) => {
      if (!current) return current;
      return {
        ...current,
        rules: {
          ...current.rules,
          [key]: !(current.rules[key] ?? false),
        },
      };
    });
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form) return;

    setSaving(true);

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
      assignments: form.assignments
        .map((assignment) => ({
          scope_type: assignment.scope_type,
          scope_id: assignment.scope_id.trim() === '' ? null : Number(assignment.scope_id),
          status: assignment.status,
        }))
        .filter((assignment) => assignment.scope_type),
    };

    try {
      if (form.id === null) {
        await createAiPolicy(payload);
        setNotice('Policy saved.');
      } else {
        await updateAiPolicy(form.id, payload);
        setNotice('Policy updated.');
      }

      closeForm();
      load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The request failed.');
    } finally {
      setSaving(false);
    }
  };

  const retire = async (row: AiPolicyRow) => {
    if (!window.confirm(`Retire the ${row.name} policy?`)) return;

    try {
      await retireAiPolicy(row.id);
      setNotice('Policy retired.');
      load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The request failed.');
    }
  };

  const scopeOptions = useMemo(
    () => options?.scope_types ?? [],
    [options]
  );

  if (loading && !index) {
    return (
      <div className="mt-6 flex items-center gap-2 rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading AI policies…
      </div>
    );
  }

  if (error && !index) {
    return (
      <div className="mt-6 rounded-lg border border-destructive/30 bg-destructive/5 p-6">
        <p className="flex items-center gap-2 text-sm font-medium text-destructive">
          <AlertTriangle className="size-4" />
          {error}
        </p>
        <button
          type="button"
          onClick={load}
          className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
        >
          <RefreshCw className="size-3.5" />
          Try again
        </button>
      </div>
    );
  }

  return (
    <section className="mt-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">AI policy management</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Define what AI can be used for, where it applies, and what disclosure is required.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
          >
            <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={openAdd}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-95"
          >
            <Plus className="size-3.5" />
            Add policy
          </button>
        </div>
      </header>

      {notice && (
        <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {notice}
        </div>
      )}

      <div className="mt-4 overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full min-w-[56rem] border-collapse text-left text-sm">
          <thead>
            <tr>
              <th className="border-b border-border px-3 py-2 text-[11px] uppercase tracking-widest text-muted-foreground">Policy</th>
              <th className="border-b border-border px-3 py-2 text-[11px] uppercase tracking-widest text-muted-foreground">Type</th>
              <th className="border-b border-border px-3 py-2 text-[11px] uppercase tracking-widest text-muted-foreground">Scope</th>
              <th className="border-b border-border px-3 py-2 text-[11px] uppercase tracking-widest text-muted-foreground">Disclosure</th>
              <th className="border-b border-border px-3 py-2 text-[11px] uppercase tracking-widest text-muted-foreground">Status</th>
              <th className="border-b border-border px-3 py-2 text-[11px] uppercase tracking-widest text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(index?.policies ?? []).map((policy) => (
              <tr key={policy.id} className="align-top">
                <td className="px-3 py-3">
                  <div className="font-medium text-foreground">{policy.name}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{policy.description ?? 'No description provided.'}</div>
                </td>
                <td className="px-3 py-3 text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <span>{policy.policy_type}</span>
                    {policy.is_example ? (
                      <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-indigo-700">
                        Example
                      </span>
                    ) : null}
                  </div>
                </td>
                <td className="px-3 py-3 text-muted-foreground">{policy.assignments.length ? `${policy.assignments.length} assignments` : 'Global'}</td>
                <td className="px-3 py-3 text-muted-foreground">{policy.require_disclosure ? 'Required' : 'Not required'}</td>
                <td className="px-3 py-3">
                  <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-medium ${policy.status ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'}`}>
                    {policy.status ? 'Active' : 'Retired'}
                  </span>
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openEdit(policy)}
                      className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-xs font-medium text-foreground hover:bg-muted"
                    >
                      <Pencil className="size-3.5" />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => retire(policy)}
                      className="inline-flex items-center gap-1 rounded-md border border-destructive/30 bg-destructive/5 px-2 py-1 text-xs font-medium text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="size-3.5" />
                      Retire
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {form && (
        <div className="mt-6 rounded-lg border border-border bg-card p-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-foreground">{form.id === null ? 'Add policy' : 'Edit policy'}</h3>
            <button type="button" onClick={closeForm} className="text-sm text-muted-foreground hover:text-foreground">Close</button>
          </div>

          <form className="mt-4 space-y-5" onSubmit={submit}>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="font-medium text-foreground">Policy name</span>
                <input
                  value={form.name}
                  onChange={(event) => setForm((current) => current ? { ...current, name: event.target.value } : current)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-0 placeholder:text-muted-foreground focus:border-ring"
                  required
                />
              </label>

              <label className="space-y-1 text-sm">
                <span className="font-medium text-foreground">Policy type</span>
                <select
                  value={form.policy_type}
                  onChange={(event) => setForm((current) => current ? { ...current, policy_type: event.target.value } : current)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
                >
                  {(options?.policy_types ?? []).map((policyType) => (
                    <option key={policyType.value} value={policyType.value}>
                      {policyType.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="block space-y-1 text-sm">
              <span className="font-medium text-foreground">Description</span>
              <textarea
                value={form.description}
                onChange={(event) => setForm((current) => current ? { ...current, description: event.target.value } : current)}
                rows={4}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
              />
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="font-medium text-foreground">Detection provider</span>
                <input
                  value={form.detection_provider}
                  onChange={(event) => setForm((current) => current ? { ...current, detection_provider: event.target.value } : current)}
                  placeholder="Turnitin / Copyleaks"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
                />
              </label>

              <label className="space-y-1 text-sm">
                <span className="font-medium text-foreground">Detection threshold</span>
                <input
                  value={form.detection_threshold}
                  onChange={(event) => setForm((current) => current ? { ...current, detection_threshold: event.target.value } : current)}
                  placeholder="0.00"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
                />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.require_disclosure === 1}
                  onChange={(event) => setForm((current) => current ? { ...current, require_disclosure: event.target.checked ? 1 : 0 } : current)}
                />
                Require disclosure
              </label>

              <label className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.require_acknowledgement === 1}
                  onChange={(event) => setForm((current) => current ? { ...current, require_acknowledgement: event.target.checked ? 1 : 0 } : current)}
                />
                Require acknowledgement
              </label>

              <label className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.ai_detection_required === 1}
                  onChange={(event) => setForm((current) => current ? { ...current, ai_detection_required: event.target.checked ? 1 : 0 } : current)}
                />
                Require AI detection
              </label>

              <label className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.plagiarism_check_required === 1}
                  onChange={(event) => setForm((current) => current ? { ...current, plagiarism_check_required: event.target.checked ? 1 : 0 } : current)}
                />
                Require plagiarism check
              </label>
            </div>

            <div className="rounded-md border border-border bg-background p-4">
              <div className="flex items-center justify-between gap-3">
                <h4 className="text-sm font-semibold text-foreground">Rules</h4>
                <span className="text-xs text-muted-foreground">Toggle allowed AI use categories</span>
              </div>

              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {(options?.rule_catalogue ?? []).map((rule) => (
                  <label key={rule.key} className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={!!form.rules[rule.key]}
                      onChange={() => toggleRule(rule.key)}
                    />
                    {rule.label}
                  </label>
                ))}
              </div>
            </div>

            <div className="rounded-md border border-border bg-background p-4">
              <div className="flex items-center justify-between gap-3">
                <h4 className="text-sm font-semibold text-foreground">Assignments</h4>
                <button
                  type="button"
                  onClick={addAssignment}
                  className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-xs font-medium text-foreground hover:bg-muted"
                >
                  <Plus className="size-3.5" />
                  Add scope
                </button>
              </div>

              <div className="mt-3 space-y-3">
                {form.assignments.length === 0 && (
                  <div className="rounded-md border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
                    No scope-specific assignments yet. The policy will apply globally by default.
                  </div>
                )}

                {form.assignments.map((assignment, index) => (
                  <div key={`${assignment.scope_type}-${index}`} className="grid gap-3 rounded-md border border-border bg-card p-3 md:grid-cols-[1fr_1fr_auto_auto]">
                    <select
                      value={assignment.scope_type}
                      onChange={(event) => updateAssignment(index, 'scope_type', event.target.value)}
                      className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
                    >
                      {(scopeOptions ?? []).map((scope) => (
                        <option key={scope.value} value={scope.value}>
                          {scope.label}
                        </option>
                      ))}
                    </select>

                    <input
                      value={assignment.scope_id}
                      onChange={(event) => updateAssignment(index, 'scope_id', event.target.value)}
                      placeholder="Scope id"
                      className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
                    />

                    <select
                      value={assignment.status}
                      onChange={(event) => updateAssignment(index, 'status', Number(event.target.value))}
                      className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
                    >
                      <option value={1}>Active</option>
                      <option value={0}>Disabled</option>
                    </select>

                    <button
                      type="button"
                      onClick={() => removeAssignment(index)}
                      className="rounded-md border border-border bg-background px-2 py-2 text-xs font-medium text-muted-foreground hover:text-foreground"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button type="button" onClick={closeForm} className="rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-foreground">
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
              >
                {saving ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
                {saving ? 'Saving…' : form.id === null ? 'Save policy' : 'Update policy'}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
