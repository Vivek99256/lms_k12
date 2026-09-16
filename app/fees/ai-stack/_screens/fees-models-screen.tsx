'use client';

/**
 * Fees → AI Stack → Models.
 *
 * Which provider and model the Fees module's AI actually runs on, and the credential
 * behind it.
 *
 * THERE IS NOTHING NEW UNDER HERE
 *
 * A row on this screen is an `ai_api_keys` row with `ai_module = 'fees'` — the
 * module → provider → model → key binding that column was added for. It is read and
 * written through the same `lib/intelligence/ai-configuration` client the central
 * Provider & Model Management screen uses, so the two cannot drift: a binding saved
 * here is the same record that screen would have written, and the resolver that picks a
 * provider on every Fees AI call reads it without knowing this screen exists.
 *
 * The model catalogue is `ai_models`, served by `/configuration/options`. This file
 * contains no provider names and no model ids — add a model in Model Management and it
 * appears in the dropdown here.
 *
 * WHY "WHAT FEES RESOLVES TO" IS THE FIRST THING ON THE SCREEN
 *
 * Because a module with no binding of its own is not broken — it falls back to the
 * unbound pool, and on an estate where no row names a module, every module quietly
 * shares one credential. That is invisible on a list of bindings and obvious on a line
 * that says which provider answered. `resolved` is computed by the backend
 * (`AiConfigurationResolver`), so what is shown is what a real Fees AI call would get,
 * not this screen's guess at it.
 *
 * Retiring is deliberately absent for pool rows: a row with `ai_module = NULL` serves
 * every module, and a Fees screen must not be able to switch off Admissions.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Cpu, KeyRound, Loader2, Pencil, Plus, Save, Trash2, X } from 'lucide-react';

import {
  AiConfigurationError,
  createAiConfiguration,
  fetchAiConfigurationOptions,
  fetchAiConfigurations,
  retireAiConfiguration,
  updateAiConfiguration,
  type AiConfigurationOptions,
  type AiConfigurationRow,
  type AiResolvedRow,
} from '@/lib/intelligence/ai-configuration';

import {
  FeesAiCard,
  FeesAiCardHeading,
  FeesAiEmpty,
  FeesAiError,
  FeesAiHeader,
  FeesAiHint,
  FeesAiLoading,
  FeesAiNotice,
  FeesAiPill,
  FeesAiTableHead,
  formatWhen,
} from './fees-ai-chrome';

const MODULE_KEY = 'fees';

/** How the backend describes where a resolved provider came from, in plain words. */
const SOURCE_WORDING: Record<AiResolvedRow['source'], string> = {
  module: 'Bound to Fees by this institute',
  module_platform: 'Bound to Fees at platform level',
  pool: "From this institute's unbound pool — shared with every module",
  pool_platform: 'From the platform unbound pool — shared with every module',
  env: 'From an environment variable, not the database',
  config: 'From config/ai.php, not the database',
};

interface FormState {
  id: number | null;
  provider: string;
  model: string;
  api_key: string;
  account_email: string;
  api_limit: string;
  status: number;
}

function blankForm(options: AiConfigurationOptions | null): FormState {
  const provider = options?.providers.find((candidate) => candidate.driveable)?.key ?? options?.providers[0]?.key ?? '';

  return {
    id: null,
    provider,
    model: options?.models[provider]?.[0]?.model_id ?? '',
    api_key: '',
    account_email: '',
    api_limit: '',
    status: 1,
  };
}

function formFrom(row: AiConfigurationRow): FormState {
  return {
    id: row.id,
    provider: row.provider,
    model: row.model ?? '',
    // Never pre-filled: the API returns a masked preview and no key. Left empty, the
    // save omits the field and the stored credential is untouched.
    api_key: '',
    account_email: row.account_email ?? '',
    api_limit: row.api_limit ?? '',
    status: row.status,
  };
}

export function FeesModelsScreen() {
  const [options, setOptions] = useState<AiConfigurationOptions | null>(null);
  const [rows, setRows] = useState<AiConfigurationRow[]>([]);
  const [resolved, setResolved] = useState<AiResolvedRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState<FormState | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);
  const [token, setToken] = useState(0);

  const reload = useCallback(() => {
    setLoading(true);
    setToken((value) => value + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    Promise.all([fetchAiConfigurationOptions(), fetchAiConfigurations()])
      .then(([nextOptions, index]) => {
        if (cancelled) return;
        setOptions(nextOptions);
        // Only Fees bindings. A row for another module is not this screen's business
        // and is not shown even read-only.
        setRows(index.configurations.filter((row) => row.ai_module === MODULE_KEY));
        setResolved(index.resolved.find((row) => row.module === MODULE_KEY) ?? null);
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

  /** Models the chosen provider offers, from the catalogue. Never a hardcoded list. */
  const modelsForProvider = useMemo(
    () => (form ? (options?.models[form.provider] ?? []) : []),
    [options, form],
  );

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form) return;

    setSaving(true);
    setError('');
    setFieldErrors({});

    const payload = {
      // Fixed, not read from a control: this screen only ever writes Fees bindings.
      ai_module: MODULE_KEY,
      provider: form.provider,
      model: form.model.trim() === '' ? null : form.model.trim(),
      account_email: form.account_email.trim() === '' ? null : form.account_email.trim(),
      api_limit: form.api_limit.trim() === '' ? null : Number(form.api_limit),
      status: form.status,
      ...(form.api_key.trim() === '' ? {} : { api_key: form.api_key.trim() }),
    };

    try {
      if (form.id === null) {
        await createAiConfiguration(payload);
        setNotice('Fees is now bound to this provider and model.');
      } else {
        await updateAiConfiguration(form.id, payload);
        setNotice('Fees model configuration updated.');
      }

      setForm(null);
      reload();
    } catch (cause) {
      if (cause instanceof AiConfigurationError) {
        setError(cause.message);
        setFieldErrors(cause.fieldErrors);
      } else {
        setError(cause instanceof Error ? cause.message : 'The request failed.');
      }
    } finally {
      setSaving(false);
    }
  };

  const retire = async (row: AiConfigurationRow) => {
    if (!window.confirm(`Retire the ${row.provider_label} binding for Fees? Fees will fall back to the shared pool.`)) {
      return;
    }

    try {
      await retireAiConfiguration(row.id);
      setNotice('Binding retired. Fees now resolves through the shared pool.');
      reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The request failed.');
    }
  };

  if (loading && !options) {
    return <FeesAiLoading label="Loading the Fees model configuration…" />;
  }

  return (
    <section className="space-y-5">
      <FeesAiHeader
        icon={Cpu}
        title="Fees models and providers"
        summary="The provider, model and credential the Fees module's AI runs on. Bindings here serve Fees only."
        loading={loading}
        onRefresh={reload}
        actions={
          <button
            type="button"
            onClick={() => {
              setForm(blankForm(options));
              setNotice('');
              setFieldErrors({});
            }}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-slate-950 px-4 text-sm font-medium text-white hover:opacity-95"
          >
            <Plus className="size-4" />
            Bind a model to Fees
          </button>
        }
      />

      {notice && <FeesAiNotice>{notice}</FeesAiNotice>}
      {error && <FeesAiError onRetry={reload}>{error}</FeesAiError>}

      <ResolvedPanel resolved={resolved} />

      {rows.length === 0 && !loading ? (
        <FeesAiEmpty
          icon={KeyRound}
          title="Fees has no model binding of its own"
          action={
            <button
              type="button"
              onClick={() => setForm(blankForm(options))}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-slate-950 px-4 text-sm font-medium text-white hover:opacity-95"
            >
              <Plus className="size-4" />
              Bind a model to Fees
            </button>
          }
        >
          Until one exists, Fees AI uses whichever unbound credential the resolver picks — shared with every other
          module. Binding a model here gives Fees its own provider, model and quota.
        </FeesAiEmpty>
      ) : (
        <FeesAiCard className="overflow-hidden">
          <FeesAiCardHeading
            title="Fees bindings"
            hint="Each row is a credential that serves the Fees module and no other."
          />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[56rem] border-collapse text-left text-sm">
              <FeesAiTableHead columns={['Provider', 'Model', 'Credential', 'Quota', 'Scope', 'Status', 'Updated', 'Actions']} />
              <tbody className="divide-y divide-slate-200">
                {rows.map((row) => (
                  <tr key={row.id} className="align-top">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{row.provider_label}</div>
                      <div className="mt-0.5 font-mono text-[11px] text-slate-500">{row.api_type}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">
                      {row.model ?? <span className="font-sans text-slate-400">provider default</span>}
                    </td>
                    <td className="px-4 py-3">
                      {row.key_preview ? (
                        <span className="font-mono text-xs text-slate-600">{row.key_preview}</span>
                      ) : (
                        <span className="text-xs text-slate-400">no key stored</span>
                      )}
                      {row.account_email && <div className="mt-0.5 text-[11px] text-slate-500">{row.account_email}</div>}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">{row.api_limit ?? '—'}</td>
                    <td className="px-4 py-3">
                      <FeesAiPill tone={row.scope === 'platform' ? 'blue' : 'gray'}>{row.scope}</FeesAiPill>
                    </td>
                    <td className="px-4 py-3">
                      <FeesAiPill tone={row.status ? 'green' : 'gray'}>{row.status ? 'active' : 'retired'}</FeesAiPill>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">{formatWhen(row.updated_at)}</td>
                    <td className="px-4 py-3">
                      {row.editable ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setForm(formFrom(row));
                              setNotice('');
                              setFieldErrors({});
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-900 hover:bg-slate-50"
                          >
                            <Pencil className="size-3.5" />
                            Edit
                          </button>
                          {row.status ? (
                            <button
                              type="button"
                              onClick={() => void retire(row)}
                              className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
                            >
                              <Trash2 className="size-3.5" />
                              Retire
                            </button>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">Platform row — read only</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </FeesAiCard>
      )}

      <FeesAiHint>
        The model catalogue comes from Model Management in the central AI console. A model added there is selectable
        here immediately — there is one catalogue, not two.
      </FeesAiHint>

      {form && (
        <form onSubmit={submit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-slate-950">
              {form.id === null ? 'Bind a model to Fees' : 'Edit the Fees binding'}
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
              <span className="text-sm font-medium text-slate-900">AI module *</span>
              <input
                value="Fees"
                readOnly
                className="mt-1 h-10 w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-600"
              />
              <span className="mt-1 block text-xs text-slate-500">
                Fixed. A binding saved here serves Fees and nothing else.
              </span>
            </label>

            <Field label="AI provider *" errors={fieldErrors.provider}>
              <select
                value={form.provider}
                onChange={(event) =>
                  patch({
                    provider: event.target.value,
                    // The old model belongs to the old provider; keeping it would send
                    // a model the new provider has never heard of.
                    model: options?.models[event.target.value]?.[0]?.model_id ?? '',
                  })
                }
                required
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              >
                {(options?.providers ?? []).map((provider) => (
                  <option key={provider.key} value={provider.key} disabled={!provider.driveable}>
                    {provider.label}
                    {provider.driveable ? '' : ' — no client yet'}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Model" errors={fieldErrors.model}>
              <select
                value={form.model}
                onChange={(event) => patch({ model: event.target.value })}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="">Provider default</option>
                {modelsForProvider.map((model) => (
                  <option key={model.id} value={model.model_id}>
                    {model.label}
                    {model.max_output_tokens ? ` — ${model.max_output_tokens.toLocaleString('en-IN')} max output` : ''}
                  </option>
                ))}
              </select>
              {modelsForProvider.length === 0 && (
                <span className="mt-1 block text-xs text-slate-500">
                  This provider has no models in the catalogue yet. Add one in Model Management.
                </span>
              )}
            </Field>

            <Field label={form.id === null ? 'API key *' : 'API key'} errors={fieldErrors.api_key}>
              <input
                type="password"
                value={form.api_key}
                onChange={(event) => patch({ api_key: event.target.value })}
                required={form.id === null}
                autoComplete="off"
                placeholder={form.id === null ? '' : 'Leave blank to keep the stored key'}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
              <span className="mt-1 block text-xs text-slate-500">
                Sent once and never returned — the list shows a masked preview only.
              </span>
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Account email (optional)" errors={fieldErrors.account_email}>
              <input
                type="email"
                value={form.account_email}
                onChange={(event) => patch({ account_email: event.target.value })}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </Field>

            <Field label="Daily call quota (optional)" errors={fieldErrors.api_limit}>
              <input
                value={form.api_limit}
                onChange={(event) => patch({ api_limit: event.target.value })}
                inputMode="numeric"
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </Field>

            <Field label="Status">
              <select
                value={form.status}
                onChange={(event) => patch({ status: Number(event.target.value) })}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              >
                <option value={1}>Active</option>
                <option value={0}>Retired</option>
              </select>
            </Field>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={saving}
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
 * What a Fees AI call resolves to right now.
 *
 * The line that matters most on this screen, because a module can look configured and
 * still be answering from a shared pool credential — or from no credential at all.
 */
function ResolvedPanel({ resolved }: { resolved: AiResolvedRow | null }) {
  if (!resolved) {
    return (
      <FeesAiCard className="p-5">
        <p className="text-sm text-slate-500">
          The backend did not report a resolved provider for Fees. That means Fees is not registered as an AI module,
          so nothing here can route its calls yet.
        </p>
      </FeesAiCard>
    );
  }

  const bound = resolved.source === 'module' || resolved.source === 'module_platform';

  return (
    <FeesAiCard className="overflow-hidden">
      <FeesAiCardHeading
        title="What Fees resolves to now"
        hint="Computed by the backend resolver — this is what a real Fees AI call gets."
      />
      <div className="grid gap-4 px-5 py-4 sm:grid-cols-2 lg:grid-cols-4">
        <Detail label="Provider">
          <span className="font-medium text-slate-900">{resolved.provider_label || resolved.provider || '—'}</span>
          {!resolved.driveable && <div className="mt-0.5 text-xs text-amber-700">No client can drive this provider.</div>}
        </Detail>

        <Detail label="Model">
          <span className="font-mono text-xs text-slate-700">{resolved.model ?? 'provider default'}</span>
        </Detail>

        <Detail label="Credential">
          {resolved.has_key ? (
            <FeesAiPill tone="green">present</FeesAiPill>
          ) : (
            <FeesAiPill tone="red">missing</FeesAiPill>
          )}
        </Detail>

        <Detail label="Binding">
          <FeesAiPill tone={bound ? 'green' : 'amber'}>{bound ? 'Fees-specific' : 'shared'}</FeesAiPill>
          <div className="mt-1 text-xs leading-5 text-slate-500">{SOURCE_WORDING[resolved.source] ?? resolved.source}</div>
        </Detail>
      </div>

      {!resolved.has_key && (
        <p className="border-t border-slate-100 bg-amber-50 px-5 py-3 text-xs leading-5 text-amber-900">
          No usable credential resolves for Fees, so any Fees AI feature that needs a model will fail. Bind a provider
          and key to Fees above to fix it.
        </p>
      )}

      {resolved.has_key && !bound && (
        <p className="border-t border-slate-100 bg-blue-50 px-5 py-3 text-xs leading-5 text-blue-900">
          Fees is working, but on a credential shared with every other module — its usage, quota and spend cannot be
          separated from theirs. Bind a model to Fees to give it its own.
        </p>
      )}
    </FeesAiCard>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">{label}</p>
      <div className="mt-1 text-sm">{children}</div>
    </div>
  );
}

function Field({
  label,
  errors,
  children,
}: {
  label: string;
  errors?: string[];
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-900">{label}</span>
      <div className="mt-1">{children}</div>
      {errors?.length ? <span className="mt-1 block text-xs text-red-600">{errors[0]}</span> : null}
    </label>
  );
}
