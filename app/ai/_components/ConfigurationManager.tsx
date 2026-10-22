'use client';

/**
 * AI Provider & Model Management — the Add/Edit half of the providers screen.
 *
 * THE FLOW IS THE POINT
 *
 * Module → Provider → Model → Priority → API key → Save. Picking a module asks the backend which
 * providers can really serve it — judged on what each provider's client can do, what its model list
 * says, and whether its key is accepted — and the form shows them best first, with the ones that
 * cannot serve the module marked "Not capable" and unselectable. The model list is then that
 * provider's models that fit the module and nothing else, so the form cannot produce a pairing the
 * backend would refuse. Nothing here decides compatibility; it only renders the answer.
 *
 * WHAT THE TWO TABLES SAY, AND WHY BOTH
 *
 * `Saved configurations` is what someone typed. `What each module calls` is what the runtime will
 * actually do — including for modules nobody has configured, which still resolve to the shared pool.
 * It is re-resolved by the backend straight after every save and shown at once, so it always
 * describes the configuration the next request will use, not the one the form was sent.
 *
 * CREDENTIALS ARE ONE-WAY
 *
 * A saved key never comes back from the server, so the edit form starts with the key field blank and
 * a note that leaving it blank keeps the stored one. A credential's status is a verdict from the
 * provider ("Connected", "Invalid", ...) — never the key, and never merely "a row exists".
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Check,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  X,
} from 'lucide-react';

import {
  AiConfigurationError,
  createAiConfiguration,
  fetchAiCompatibility,
  fetchAiConfigurationOptions,
  fetchAiConfigurations,
  reorderAiConfigurations,
  retireAiConfiguration,
  updateAiConfiguration,
  verifyAiConfiguration,
  type AiCompatibleProvider,
  type AiConfigurationIndex,
  type AiConfigurationOptions,
  type AiConfigurationRow,
  type AiCredentialStatus,
  type AiModuleCompatibility,
} from '@/lib/intelligence/ai-configuration';

interface FormState {
  /** The row being edited, or null when adding. */
  id: number | null;
  ai_module: string;
  provider: string;
  model: string;
  priority: string;
  api_key: string;
  account_email: string;
  api_limit: string;
  status: number;
}

const EMPTY_FORM: FormState = {
  id: null,
  ai_module: '',
  provider: '',
  model: '',
  priority: '',
  api_key: '',
  account_email: '',
  api_limit: '',
  status: 1,
};

const ORDINALS = ['1st', '2nd', '3rd'];

/** "1st", "2nd", "3rd", "4th" … */
function ordinal(n: number): string {
  return ORDINALS[n - 1] ?? `${n}th`;
}

export function ConfigurationManager() {
  const [options, setOptions] = useState<AiConfigurationOptions | null>(null);
  const [index, setIndex] = useState<AiConfigurationIndex | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [notice, setNotice] = useState<string | null>(null);

  // What the backend says can serve the module picked in the form, best first.
  const [compat, setCompat] = useState<AiModuleCompatibility | null>(null);
  const [compatLoading, setCompatLoading] = useState(false);
  const [compatError, setCompatError] = useState<string | null>(null);

  // The module whose row was just saved, flagged in the table so the change is easy to find.
  const [highlight, setHighlight] = useState<string | null>(null);

  // Bumping this re-runs the effect below. The alternative — a load() the effect calls — sets state
  // synchronously inside the effect body, which React flags as a cascading render. Only the promise
  // callbacks touch state, matching the pattern CapabilityLiveData already uses on this screen.
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    // Both in flight together: the form is useless without the options and the table is useless
    // without the rows, so there is nothing to show until both land.
    Promise.all([fetchAiConfigurationOptions(), fetchAiConfigurations()])
      .then(([nextOptions, nextIndex]) => {
        if (cancelled) return;
        setOptions(nextOptions);
        setIndex(nextIndex);
        setError(null);
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

  /** An event handler, so setting state here is not the effect problem above. */
  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    setReloadToken((token) => token + 1);
  }, []);

  const formModule = form?.ai_module ?? '';

  // Compatibility is asked per module, when the module changes. The response of an earlier module
  // arriving late must not overwrite a later one, hence the token.
  const compatRequest = useRef(0);

  useEffect(() => {
    if (!formModule) return;

    const mine = ++compatRequest.current;
    let cancelled = false;

    fetchAiCompatibility(formModule)
      .then((result) => {
        if (cancelled || mine !== compatRequest.current) return;
        setCompat(result);
        setCompatError(null);
        setCompatLoading(false);
      })
      .catch((cause: unknown) => {
        if (cancelled || mine !== compatRequest.current) return;
        setCompat(null);
        setCompatError(cause instanceof Error ? cause.message : 'Could not check which providers fit this module.');
        setCompatLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [formModule]);

  const selectModule = (module: string) => {
    if (!form) return;
    setCompat(null);
    setCompatError(null);
    setCompatLoading(module !== '');
    // Changing module clears provider and model: what fits one module need not fit another.
    setForm({ ...form, ai_module: module, provider: '', model: '' });
  };

  const selectedCompat: AiCompatibleProvider | null = useMemo(
    () => compat?.providers.find((p) => p.provider === form?.provider) ?? null,
    [compat, form?.provider]
  );

  const openAdd = () => {
    setForm({ ...EMPTY_FORM });
    setCompat(null);
    setCompatError(null);
    setFormError(null);
    setFieldErrors({});
    setNotice(null);
  };

  const openEdit = (row: AiConfigurationRow) => {
    setCompatLoading(Boolean(row.ai_module));
    setForm({
      id: row.id,
      ai_module: row.ai_module ?? '',
      provider: row.provider,
      model: row.model ?? '',
      priority: row.priority === null ? '' : String(row.priority),
      // Deliberately blank — see the file note. Blank on save means "keep the stored key".
      api_key: '',
      account_email: row.account_email ?? '',
      api_limit: row.api_limit ?? '',
      status: row.status,
    });
    setFormError(null);
    setFieldErrors({});
    setNotice(null);
  };

  const closeForm = () => {
    setForm(null);
    setCompat(null);
    setFormError(null);
    setFieldErrors({});
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form) return;

    setSaving(true);
    setFormError(null);
    setFieldErrors({});

    const payload = {
      ai_module: form.ai_module,
      provider: form.provider,
      model: form.model.trim() === '' ? null : form.model.trim(),
      account_email: form.account_email.trim() === '' ? null : form.account_email.trim(),
      api_limit: form.api_limit.trim() === '' ? null : Number(form.api_limit),
      status: form.status,
      ...(form.priority.trim() === '' ? {} : { priority: Number(form.priority) }),
      // Omitted entirely on an edit with no new key, so the server leaves the stored
      // credential alone rather than being sent an empty string to store.
      ...(form.api_key.trim() === '' ? {} : { api_key: form.api_key.trim() }),
    };

    try {
      const saved = form.id === null ? await createAiConfiguration(payload) : await updateAiConfiguration(form.id, payload);
      const savedModule = form.ai_module;

      // The backend has already re-resolved every module against what it just wrote: show that at
      // once, then reload for the full picture (live credential checks, the saved-rows table).
      setIndex((current) => (current ? { ...current, resolved: saved.resolved } : current));
      setHighlight(savedModule);
      setNotice(
        saved.credential && saved.credential.status === 'ready'
          ? `${form.id === null ? 'Configuration saved' : 'Configuration updated'} — the provider accepted the key.`
          : saved.credential && saved.credential.status === 'present'
            ? `${form.id === null ? 'Configuration saved' : 'Configuration updated'}. ${saved.credential.detail ?? 'The key could not be verified right now.'}`
            : form.id === null
              ? 'Configuration saved.'
              : 'Configuration updated.'
      );

      closeForm();
      load();
    } catch (cause) {
      if (cause instanceof AiConfigurationError) {
        setFormError(cause.message);
        setFieldErrors(cause.fieldErrors);
      } else {
        setFormError(cause instanceof Error ? cause.message : 'The request failed.');
      }
    } finally {
      setSaving(false);
    }
  };

  // Clear the highlight a few seconds after it appears.
  useEffect(() => {
    if (!highlight) return;
    const timer = window.setTimeout(() => setHighlight(null), 6000);
    return () => window.clearTimeout(timer);
  }, [highlight]);

  const retire = async (row: AiConfigurationRow) => {
    if (!window.confirm(`Retire the ${row.provider_label} configuration for ${row.module_label}?`)) {
      return;
    }

    try {
      await retireAiConfiguration(row.id);
      setNotice('Configuration retired.');
      load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The request failed.');
    }
  };

  const verify = async (row: AiConfigurationRow) => {
    try {
      const result = await verifyAiConfiguration(row.id);
      setIndex((current) =>
        current
          ? {
              ...current,
              configurations: current.configurations.map((c) =>
                c.id === row.id ? { ...c, credential: result.credential } : c
              ),
            }
          : current
      );
      setNotice(`${row.provider_label} key for ${row.module_label}: ${result.credential.label}.`);
      load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The request failed.');
    }
  };

  /** Move a configuration one place earlier or later within its module. */
  const move = async (row: AiConfigurationRow, direction: -1 | 1) => {
    if (!index || !row.ai_module) return;

    const siblings = index.configurations
      .filter((c) => c.ai_module === row.ai_module && c.editable && c.status === 1)
      .sort(sortByPriority);
    const at = siblings.findIndex((c) => c.id === row.id);
    const to = at + direction;

    if (at < 0 || to < 0 || to >= siblings.length) return;

    const next = [...siblings];
    [next[at], next[to]] = [next[to], next[at]];

    try {
      const result = await reorderAiConfigurations(row.ai_module, next.map((c) => c.id));
      setIndex((current) => (current ? { ...current, ...result } : current));
      setHighlight(row.ai_module);
      setNotice(`Provider order saved for ${row.module_label}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The request failed.');
    }
  };

  if (loading && !index) {
    return (
      <div className="mt-6 flex items-center gap-2 rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading AI configuration…
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
          <h2 className="text-base font-semibold text-foreground">Provider &amp; model configuration</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Point each AI module at the provider, model and credential it should use. A module tries its
            providers in priority order and falls back to the next if one fails or runs out of quota.
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
            className="inline-flex items-center gap-1.5 rounded-md bg-[#0D6EFD] px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-[#0b5ed7]"
          >
            <Plus className="size-3.5" />
            Add configuration
          </button>
        </div>
      </header>

      {notice && (
        <p className="mt-3 flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs font-medium text-emerald-700 dark:text-emerald-400">
          <Check className="size-3.5" />
          {notice}
        </p>
      )}

      {error && index && (
        <p className="mt-3 flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs font-medium text-destructive">
          <AlertTriangle className="size-3.5" />
          {error}
        </p>
      )}

      {form && options && (
        <ConfigurationForm
          form={form}
          setForm={setForm}
          onModule={selectModule}
          options={options}
          compat={compat}
          compatLoading={compatLoading}
          compatError={compatError}
          provider={selectedCompat}
          saving={saving}
          error={formError}
          fieldErrors={fieldErrors}
          onSubmit={submit}
          onCancel={closeForm}
        />
      )}

      <SavedConfigurations
        rows={index?.configurations ?? []}
        prioritySupported={index?.priority_supported ?? false}
        highlight={highlight}
        onEdit={openEdit}
        onRetire={retire}
        onVerify={verify}
        onMove={move}
      />
      <ResolvedModules rows={index?.resolved ?? []} highlight={highlight} />
    </section>
  );
}

function sortByPriority(a: AiConfigurationRow, b: AiConfigurationRow): number {
  return (a.priority ?? Number.MAX_SAFE_INTEGER) - (b.priority ?? Number.MAX_SAFE_INTEGER) || b.id - a.id;
}

function ConfigurationForm({
  form,
  setForm,
  onModule,
  options,
  compat,
  compatLoading,
  compatError,
  provider,
  saving,
  error,
  fieldErrors,
  onSubmit,
  onCancel,
}: {
  form: FormState;
  setForm: (next: FormState) => void;
  onModule: (module: string) => void;
  options: AiConfigurationOptions;
  compat: AiModuleCompatibility | null;
  compatLoading: boolean;
  compatError: string | null;
  provider: AiCompatibleProvider | null;
  saving: boolean;
  error: string | null;
  fieldErrors: Record<string, string[]>;
  onSubmit: (event: React.FormEvent) => void;
  onCancel: () => void;
}) {
  // Not named `module`: Next refuses that identifier in a client bundle, where it
  // collides with the module wrapper.
  const selectedModule = options.modules.find((m) => m.key === form.ai_module) ?? null;
  const isEdit = form.id !== null;

  const models = provider?.models ?? [];
  const chosenModel = models.find((m) => m.model_id === form.model) ?? null;

  return (
    <form onSubmit={onSubmit} className="mt-4 rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">{isEdit ? 'Edit configuration' : 'Add configuration'}</h3>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Close"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="AI module" error={fieldErrors.ai_module}>
          <select
            required
            value={form.ai_module}
            onChange={(e) => onModule(e.target.value)}
            disabled={isEdit}
            className={selectClass}
          >
            <option value="">Select a module…</option>
            {options.modules.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>
          {selectedModule && <p className="mt-1.5 text-xs text-muted-foreground">{selectedModule.description}</p>}
          {compat && compat.requires.length > 0 && (
            <p className="mt-1.5 text-xs text-muted-foreground">
              Needs: {compat.requires.map((r) => r.label).join(', ')}
              {compat.min_output_tokens ? ` · at least ${compat.min_output_tokens.toLocaleString()} output tokens` : ''}
            </p>
          )}
          {selectedModule && selectedModule.runtime === 'none' && (
            // Said before Save, not after. A settings screen that accepts a value it does not yet
            // control has to say so at the moment of choosing.
            <p className="mt-1.5 flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
              <ShieldAlert className="mt-0.5 size-3.5 shrink-0" />
              {selectedModule.gap}
            </p>
          )}
          {selectedModule && selectedModule.runtime === 'model' && !selectedModule.wired && (
            <p className="mt-1.5 flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
              <ShieldAlert className="mt-0.5 size-3.5 shrink-0" />
              {selectedModule.gap ??
                'This module still reaches its provider directly, so a setting saved here is stored but does not change what it calls yet.'}
            </p>
          )}
        </Field>

        <Field label="AI provider" error={fieldErrors.provider}>
          <select
            required
            value={form.provider}
            // Changing provider clears the model: a model belongs to one provider, and
            // carrying it across is how an invalid pairing reaches Save.
            onChange={(e) => setForm({ ...form, provider: e.target.value, model: '' })}
            disabled={!form.ai_module || compatLoading || !compat}
            className={selectClass}
          >
            <option value="">
              {!form.ai_module
                ? 'Select a module first'
                : compatLoading
                  ? 'Checking which providers fit…'
                  : 'Select a provider…'}
            </option>
            {(compat?.providers ?? [])
              .filter((p) => p.selectable)
              .map((p) => (
                <option key={p.provider} value={p.provider}>
                  {providerOptionLabel(p)}
                </option>
              ))}
            {(compat?.providers ?? []).some((p) => !p.selectable) && (
              <optgroup label="Not capable for this module — cannot be selected">
                {(compat?.providers ?? [])
                  .filter((p) => !p.selectable)
                  .map((p) => (
                    <option key={p.provider} value={p.provider} disabled>
                      {p.label} — {p.reasons[0] ?? 'cannot serve this module'}
                    </option>
                  ))}
              </optgroup>
            )}
          </select>
          {compatLoading && (
            <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin" />
              Reading each provider’s model list…
            </p>
          )}
          {compatError && <p className="mt-1.5 text-xs text-destructive">{compatError}</p>}
          {provider && provider.fit && <p className="mt-1.5 text-xs text-muted-foreground">{provider.fit}</p>}
          {provider && provider.capable && !provider.ready && (
            <p className="mt-1.5 text-xs text-amber-700 dark:text-amber-400">
              {provider.credential.status === 'absent'
                ? 'Missing credential: not ready to run until an API key is saved for it.'
                : provider.credential.detail}
            </p>
          )}
          {provider && !provider.capable && (
            <p className="mt-1.5 text-xs text-destructive">{provider.reasons.join(' ')}</p>
          )}
        </Field>

        <Field label="Model" error={fieldErrors.model}>
          <select
            value={form.model}
            onChange={(e) => setForm({ ...form, model: e.target.value })}
            disabled={!form.provider || !provider}
            className={selectClass}
          >
            <option value="">{form.provider ? 'Provider default (best fit)' : 'Select a provider first'}</option>
            {models.map((m) => (
              <option key={m.id} value={m.model_id} disabled={!m.compatible}>
                {m.label} ({m.model_id}){m.compatible ? (m.verified ? ' — confirmed by provider' : '') : ' — does not fit'}
              </option>
            ))}
          </select>
          {chosenModel && (
            <p className="mt-1.5 text-xs text-muted-foreground">
              {chosenModel.max_output_tokens ? `Up to ${chosenModel.max_output_tokens.toLocaleString()} output tokens` : 'Output limit not published'}
              {chosenModel.context_tokens ? ` · ${chosenModel.context_tokens.toLocaleString()}-token context` : ''}
              {chosenModel.verified ? '' : ' · not yet confirmed with the provider'}
            </p>
          )}
          {provider && models.some((m) => !m.compatible) && (
            <ul className="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
              {models
                .filter((m) => !m.compatible)
                .map((m) => (
                  <li key={m.id}>
                    <span className="font-mono">{m.model_id}</span>: {m.reasons.join(' ')}
                  </li>
                ))}
            </ul>
          )}
          {provider && provider.capable && models.length === 0 && (
            <p className="mt-1.5 text-xs text-muted-foreground">
              No models in the catalogue for this provider. Add one in Model Management, or leave this
              blank to use the provider default.
            </p>
          )}
        </Field>

        {options.priority_supported ? (
          <Field label="Priority (1 = tried first)" error={fieldErrors.priority}>
            <input
              type="number"
              min={1}
              max={99}
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value })}
              placeholder="Next after the existing providers"
              className={inputClass}
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              If this provider fails or its quota runs out, the module tries the next priority.
            </p>
          </Field>
        ) : (
          <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            Provider priority cannot be saved yet — the priority column has not been added to this
            installation. Until then a module tries its providers newest first.
          </div>
        )}

        <Field
          label={isEdit ? 'API key (leave blank to keep the stored key)' : 'API key'}
          error={fieldErrors.api_key}
        >
          <input
            type="password"
            autoComplete="off"
            required={!isEdit}
            value={form.api_key}
            onChange={(e) => setForm({ ...form, api_key: e.target.value })}
            placeholder={isEdit ? '••••••••' : 'Paste the provider API key'}
            className={inputClass}
          />
          {provider?.docs && (
            <p className="mt-1.5 text-xs text-muted-foreground">
              The provider checks the key when you save.{' '}
              <a href={provider.docs} target="_blank" rel="noreferrer" className="text-[#0D6EFD] hover:underline">
                Get a key
              </a>
            </p>
          )}
        </Field>

        <Field label="Account email (optional)" error={fieldErrors.account_email}>
          <input
            type="email"
            value={form.account_email}
            onChange={(e) => setForm({ ...form, account_email: e.target.value })}
            placeholder="Which account this key belongs to"
            className={inputClass}
          />
        </Field>

        <Field label="Max output tokens (optional)" error={fieldErrors.api_limit}>
          <input
            type="number"
            min={1}
            value={form.api_limit}
            onChange={(e) => setForm({ ...form, api_limit: e.target.value })}
            placeholder="Provider default"
            className={inputClass}
          />
        </Field>
      </div>

      <Relationship form={form} compat={compat} provider={provider} moduleLabel={selectedModule?.label ?? null} />

      <label className="mt-4 flex items-center gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          checked={form.status === 1}
          onChange={(e) => setForm({ ...form, status: e.target.checked ? 1 : 0 })}
          className="size-4 rounded border-border"
        />
        Active
      </label>

      {error && (
        <p className="mt-4 flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs font-medium text-destructive">
          <AlertTriangle className="size-3.5" />
          {error}
        </p>
      )}

      <div className="mt-5 flex items-center gap-2">
        <button
          type="submit"
          disabled={saving || !form.provider || (provider !== null && !provider.capable)}
          className="inline-flex items-center gap-1.5 rounded-md bg-[#0D6EFD] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#0b5ed7] disabled:opacity-60"
        >
          {saving && <Loader2 className="size-3.5 animate-spin" />}
          {isEdit ? 'Update' : 'Save'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

/** The label of one provider in the dropdown: its place in the order, or why it is not offered. */
function providerOptionLabel(p: AiCompatibleProvider): string {
  const place = p.rank ? `${ordinal(p.rank)} priority · ` : '';
  const role =
    p.status === 'configured' ? 'saved for this module' : p.status === 'best_fit' ? 'best fit' : p.proven ? 'proven' : 'capable';
  // A stored key never moves a provider up; it only says whether the provider is ready to run.
  const credential =
    p.credential.status === 'ready'
      ? 'key connected'
      : p.credential.status === 'invalid'
        ? 'key rejected'
        : p.credential.status === 'present'
          ? 'key not verified'
          : 'missing credential';

  return `${place}${p.label} — ${role} · ${credential}`;
}

/**
 * The actual relationship the form will save: module → provider → model → priority → credential.
 * It replaces the old "credentials stored as …" line, which named a storage tag rather than anything
 * an administrator chose.
 */
function Relationship({
  form,
  compat,
  provider,
  moduleLabel,
}: {
  form: FormState;
  compat: AiModuleCompatibility | null;
  provider: AiCompatibleProvider | null;
  moduleLabel: string | null;
}) {
  if (!form.ai_module) return null;

  const model = provider?.models.find((m) => m.model_id === form.model);
  const priority = form.priority.trim() !== '' ? ordinal(Number(form.priority)) : provider?.rank ? ordinal(provider.rank) : '—';

  const steps: { label: string; value: string }[] = [
    { label: 'Module', value: moduleLabel ?? form.ai_module },
    { label: 'Provider', value: provider?.label ?? '—' },
    { label: 'Model', value: form.model ? (model?.label ?? form.model) : provider ? 'provider default' : '—' },
    { label: 'Priority', value: priority },
    {
      label: 'Credential',
      value: form.api_key.trim() !== '' ? 'new key — checked on save' : (provider?.credential.label ?? '—'),
    },
  ];

  return (
    <div className="mt-4 rounded-lg border border-border bg-muted/30 p-3" aria-label="What this configuration will do">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">This configuration</p>
      <ol className="mt-2 flex flex-wrap items-stretch gap-1.5 text-xs">
        {steps.map((step, i) => (
          <li key={step.label} className="flex items-center gap-1.5">
            <span className="rounded-md border border-border bg-card px-2 py-1">
              <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">{step.label}</span>
              <span className="font-medium text-foreground">{step.value}</span>
            </span>
            {i < steps.length - 1 && <span className="text-muted-foreground">→</span>}
          </li>
        ))}
      </ol>
      {compat && provider && provider.capable && provider.credential.status === 'invalid' && (
        <p className="mt-2 text-xs text-destructive">
          The key currently stored for {provider.label} was rejected by the provider. Paste a working key to replace it.
        </p>
      )}
    </div>
  );
}

function SavedConfigurations({
  rows,
  prioritySupported,
  highlight,
  onEdit,
  onRetire,
  onVerify,
  onMove,
}: {
  rows: AiConfigurationRow[];
  prioritySupported: boolean;
  highlight: string | null;
  onEdit: (row: AiConfigurationRow) => void;
  onRetire: (row: AiConfigurationRow) => void;
  onVerify: (row: AiConfigurationRow) => void;
  onMove: (row: AiConfigurationRow, direction: -1 | 1) => void;
}) {
  // Rows of one module, in the order the module tries them — to know which can move up or down.
  const siblings = (row: AiConfigurationRow) =>
    rows.filter((c) => c.ai_module === row.ai_module && c.editable && c.status === 1).sort(sortByPriority);

  return (
    <div className="mt-6">
      <h3 className="text-sm font-semibold text-foreground">Saved configurations</h3>

      <div className="mt-2 overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <Th>Module</Th>
              <Th>Provider</Th>
              <Th>Model</Th>
              <Th>Priority</Th>
              <Th>Key</Th>
              <Th>Credential</Th>
              <Th>Scope</Th>
              <Th>Status</Th>
              <Th> </Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-sm text-muted-foreground">
                  No credentials are stored for this school yet.
                </td>
              </tr>
            )}
            {rows.map((row) => {
              const group = siblings(row);
              const at = group.findIndex((c) => c.id === row.id);

              return (
                <tr
                  key={row.id}
                  className={`text-foreground ${row.ai_module && row.ai_module === highlight ? 'bg-emerald-500/5' : ''}`}
                >
                  <Td>
                    <span className="font-medium">{row.module_label}</span>
                    {row.ai_module && row.module_runtime === 'none' && (
                      <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                        no model call
                      </span>
                    )}
                  </Td>
                  <Td>{row.provider_label}</Td>
                  <Td className="font-mono text-xs">{row.model ?? 'provider default'}</Td>
                  <Td>
                    {row.ai_module && row.status === 1 ? (
                      <span className="inline-flex items-center gap-1 text-xs">
                        {row.priority !== null ? ordinal(row.priority) : at >= 0 ? `${ordinal(at + 1)}*` : '—'}
                        {prioritySupported && row.editable && group.length > 1 && (
                          <>
                            <button
                              type="button"
                              onClick={() => onMove(row, -1)}
                              disabled={at <= 0}
                              aria-label="Try earlier"
                              className="rounded p-0.5 text-muted-foreground hover:bg-muted disabled:opacity-30"
                            >
                              <ArrowUp className="size-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onMove(row, 1)}
                              disabled={at < 0 || at >= group.length - 1}
                              aria-label="Try later"
                              className="rounded p-0.5 text-muted-foreground hover:bg-muted disabled:opacity-30"
                            >
                              <ArrowDown className="size-3" />
                            </button>
                          </>
                        )}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">{row.ai_module ? '—' : 'shared'}</span>
                    )}
                  </Td>
                  <Td className="font-mono text-xs">{row.key_preview ?? '—'}</Td>
                  <Td>
                    <CredentialBadge status={row.credential} />
                  </Td>
                  <Td>
                    <span className="text-xs text-muted-foreground">
                      {row.scope === 'platform' ? 'Platform (shared)' : 'This school'}
                    </span>
                  </Td>
                  <Td>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        row.status === 1
                          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {row.status === 1 ? 'Active' : 'Retired'}
                    </span>
                  </Td>
                  <Td>
                    <div className="flex items-center gap-1">
                      {row.key_preview && (
                        <button
                          type="button"
                          onClick={() => onVerify(row)}
                          className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium hover:bg-muted"
                        >
                          <ShieldCheck className="size-3" />
                          Verify
                        </button>
                      )}
                      {row.editable ? (
                        <>
                          <button
                            type="button"
                            onClick={() => onEdit(row)}
                            className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium hover:bg-muted"
                          >
                            <Pencil className="size-3" />
                            Edit
                          </button>
                          {row.status === 1 && (
                            <button
                              type="button"
                              onClick={() => onRetire(row)}
                              className="rounded-md border border-border px-2 py-1 text-xs font-medium text-destructive hover:bg-destructive/5"
                            >
                              Retire
                            </button>
                          )}
                        </>
                      ) : (
                        // Platform rows are shared by every school on the estate. The API refuses
                        // them too — this is the explanation, not the control.
                        <span className="text-xs text-muted-foreground">Shared — read only</span>
                      )}
                    </div>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!prioritySupported && (
        <p className="mt-2 text-xs text-muted-foreground">
          * Priority cannot be saved on this installation yet, so a module tries its providers newest first.
        </p>
      )}
    </div>
  );
}

const SOURCE_LABELS: Record<string, string> = {
  module: 'This school’s configuration',
  module_platform: 'Platform configuration',
  pool: 'This school’s shared key',
  pool_platform: 'Platform shared key',
  config: 'Nothing configured',
};

/** A credential's verdict as a badge — green only when the provider accepted the key. */
function CredentialBadge({ status }: { status: AiCredentialStatus }) {
  const tone =
    status.status === 'ready'
      ? 'text-emerald-700 dark:text-emerald-400'
      : status.status === 'present'
        ? 'text-amber-700 dark:text-amber-400'
        : status.status === 'not_required'
          ? 'text-muted-foreground'
          : 'text-destructive';

  return (
    <span className={`text-xs font-medium ${tone}`} title={status.detail ?? undefined}>
      {status.label}
    </span>
  );
}

function ResolvedModules({ rows, highlight }: { rows: AiConfigurationIndex['resolved']; highlight: string | null }) {
  return (
    <div className="mt-8">
      <h3 className="text-sm font-semibold text-foreground">What each module calls right now</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Resolved live from the saved configuration. A module with nothing saved of its own uses the shared
        pool; a module with no usable provider says so instead of naming one.
      </p>

      <div className="mt-2 overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <Th>Module</Th>
              <Th>Provider</Th>
              <Th>Model</Th>
              <Th>Then falls back to</Th>
              <Th>Resolved from</Th>
              <Th>Credential</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => {
              const fallbacks = row.chain.slice(1);

              return (
                <tr
                  key={row.module}
                  className={`align-top text-foreground ${row.module === highlight ? 'bg-emerald-500/5' : ''}`}
                >
                  <Td className="whitespace-normal">
                    <span className="font-medium">{row.module_label}</span>
                    {row.runtime === 'none' && (
                      <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                        no model call
                      </span>
                    )}
                    {row.runtime === 'model' && !row.wired && (
                      <span className="ml-2 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">
                        not connected
                      </span>
                    )}
                    {row.gap && <p className="mt-1 max-w-sm text-xs font-normal text-muted-foreground">{row.gap}</p>}
                    {row.inherited_from && (
                      <p className="mt-1 text-xs font-normal text-muted-foreground">
                        Using the {row.inherited_from.replace(/_/g, ' ')} configuration.
                      </p>
                    )}
                  </Td>
                  <Td>
                    {row.provider_label ?? (
                      <span className="text-xs text-destructive">
                        {row.runtime === 'none' ? '—' : 'Not configured'}
                      </span>
                    )}
                  </Td>
                  <Td className="font-mono text-xs">{row.model ?? '—'}</Td>
                  <Td className="whitespace-normal text-xs text-muted-foreground">
                    {fallbacks.length === 0
                      ? '—'
                      : fallbacks.map((leg) => (
                          <span key={`${leg.provider}-${leg.order}`} className="mr-2 inline-block">
                            {ordinal(leg.order)}: {leg.provider_label}
                            {leg.credential && leg.credential.status !== 'ready' ? ` (${leg.credential.label.toLowerCase()})` : ''}
                          </span>
                        ))}
                  </Td>
                  <Td className="text-xs text-muted-foreground">
                    {row.runtime === 'none' ? '—' : (SOURCE_LABELS[row.source] ?? row.source)}
                  </Td>
                  <Td>
                    <CredentialBadge status={row.credential} />
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---- Small shared bits ----------------------------------------------------

const inputClass =
  'w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-[#0D6EFD] focus:ring-1 focus:ring-[#0D6EFD] disabled:opacity-60';

const selectClass = inputClass;

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string[];
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-foreground">{label}</span>
      {children}
      {error?.length ? <p className="mt-1.5 text-xs text-destructive">{error[0]}</p> : null}
    </label>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="whitespace-nowrap px-3 py-2 font-medium">{children}</th>;
}

function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`whitespace-nowrap px-3 py-2.5 ${className}`}>{children}</td>;
}
