'use client';

/**
 * The template editor — one form, used by both the Add and the Edit page.
 *
 * LAID OUT LIKE THE ERP TEMPLATE EDITOR
 *
 * Module Name and Template Title sit side by side, the content block runs full width
 * below them with a toolbar strip along its top, and Save/Cancel sit under it. That is
 * the shape of `/general/template_management`, and matching it means an administrator
 * who already maintains fee-receipt templates does not have to learn a second layout
 * to maintain AI templates.
 *
 * WHY THE TOOLBAR HAS NO BOLD, FONT OR COLOUR BUTTONS
 *
 * The ERP editor produces an HTML document that gets printed. This one produces the
 * text of a prompt that gets sent to a model. Bold there is `<b>`, and `<b>` here is
 * two tokens of markup the model reads as content — formatting controls would not make
 * the prompt prettier, they would make the answers worse. So the strip keeps the two
 * controls that do apply — the variable picker and Preview — in the same place the ERP
 * editor puts them, and the surface underneath is plain monospace text.
 *
 * WHY THE PROMPT IS TWO FIELDS AND THE ERP TEMPLATE IS ONE
 *
 * A prompt has a standing instruction (who the model is, what it must never do) and a
 * per-request ask. They are stored separately and sent to the model in different roles,
 * so a single box would have to be split again on save by guessing where one ends. Both
 * live inside the one content block, under the one toolbar, so the screen still reads
 * as the single "content" section the design has.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, LoaderCircle, Sparkles, X } from 'lucide-react';

import {
  createTemplate,
  fetchTemplateOptions,
  previewTemplate,
  updateTemplate,
  SHARED_MODULE_KEY,
  type AiTemplateOptions,
  type AiTemplateRow,
  type TemplateKind,
  type TemplatePreview,
} from '@/lib/intelligence/ai-templates';
import { TemplateHtmlEditor } from '@/app/general/_components/TemplateHtmlEditor';

export interface TemplateFormState {
  name: string;
  description: string;
  template_key: string;
  module_key: string;
  kind: TemplateKind;
  html_layout: string;
  data_source: string;
  category: string;
  status: string;
  system_prompt: string;
  user_prompt: string;
  output_format: string;
  safety_rules: string[];
  allow_as_evidence: boolean;
  requires_review: boolean;
  offer_in_module: boolean;
  suggestion_label: string;
  requires_entity: boolean;
  new_version: boolean;
}

export function blankForm(moduleKey: string): TemplateFormState {
  return {
    name: '',
    description: '',
    template_key: '',
    // A new template lands in the module the administrator was looking at. Defaulting
    // to shared instead would file most templates where they are hardest to find.
    module_key: moduleKey || SHARED_MODULE_KEY,
    kind: 'prompt',
    html_layout: '',
    data_source: '',
    category: 'report',
    status: 'draft',
    system_prompt: '',
    user_prompt: '',
    output_format: 'text',
    safety_rules: [],
    allow_as_evidence: false,
    requires_review: false,
    offer_in_module: true,
    suggestion_label: '',
    requires_entity: false,
    new_version: false,
  };
}

export function formFromRow(row: AiTemplateRow): TemplateFormState {
  return {
    name: row.name,
    description: row.description ?? '',
    template_key: row.template_key,
    module_key: row.module_key,
    kind: row.kind ?? 'prompt',
    html_layout: row.html_layout ?? '',
    data_source: row.data_source ?? '',
    category: row.category ?? '',
    status: row.status,
    system_prompt: row.system_prompt ?? '',
    user_prompt: row.user_prompt,
    output_format: row.output_format,
    safety_rules: Array.isArray(row.safety_rules) ? row.safety_rules : [],
    allow_as_evidence: row.allow_as_evidence,
    requires_review: row.requires_review,
    offer_in_module: row.offered_in_module,
    suggestion_label: row.offer_label ?? '',
    requires_entity: false,
    new_version: false,
  };
}

export function TemplateForm({
  options,
  initial,
  templateId,
  editableInPlace = true,
  isPlatform = false,
  returnTo,
}: {
  options: AiTemplateOptions | null;
  initial: TemplateFormState;
  /** Null on the Add page; the row's id on the Edit page. */
  templateId: number | null;
  editableInPlace?: boolean;
  isPlatform?: boolean;
  /** Where Cancel and a successful Save go back to. */
  returnTo: string;
}) {
  const router = useRouter();

  const [form, setForm] = useState<TemplateFormState>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<TemplatePreview | null>(null);
  const [previewing, setPreviewing] = useState(false);

  const systemRef = useRef<HTMLTextAreaElement>(null);
  const userRef = useRef<HTMLTextAreaElement>(null);
  /**
   * Which box the variable picker inserts into.
   *
   * Tracked on focus rather than read from `document.activeElement`, because opening
   * the picker moves focus to the picker — by the time the change event fires, the
   * textarea the administrator was typing in is no longer the active element.
   */
  const lastFocused = useRef<'system' | 'user'>('user');

  const patch = (changes: Partial<TemplateFormState>) =>
    setForm((current) => ({ ...current, ...changes }));

  const insertVariable = (key: string) => {
    if (!key) return;

    const target = lastFocused.current === 'system' ? systemRef.current : userRef.current;
    const token = `{{${key}}}`;
    const field = lastFocused.current === 'system' ? 'system_prompt' : 'user_prompt';

    if (!target) {
      patch({ [field]: `${form[field]}${token}` } as Partial<TemplateFormState>);
      return;
    }

    const start = target.selectionStart ?? target.value.length;
    const end = target.selectionEnd ?? start;
    const next = target.value.slice(0, start) + token + target.value.slice(end);

    patch({ [field]: next } as Partial<TemplateFormState>);

    requestAnimationFrame(() => {
      target.focus();
      target.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const runPreview = async () => {
    setPreviewing(true);
    setError('');

    try {
      setPreview(
        await previewTemplate({
          system_prompt: form.system_prompt || null,
          user_prompt: form.user_prompt,
        })
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The request failed.');
    } finally {
      setPreviewing(false);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      template_key: form.template_key.trim() || null,
      module_key: form.module_key,
      kind: form.kind,
      html_layout: form.kind === 'report' ? form.html_layout : null,
      data_source: form.kind === 'report' ? form.data_source : null,
      category: form.category.trim() || null,
      status: form.status,
      system_prompt: form.system_prompt.trim() || null,
      user_prompt: form.user_prompt,
      output_format: form.output_format,
      safety_rules: form.safety_rules.filter((rule) => rule.trim() !== ''),
      allow_as_evidence: form.allow_as_evidence,
      requires_review: form.requires_review,
      offer_in_module: form.offer_in_module,
      suggestion_label: form.suggestion_label.trim() || null,
      requires_entity: form.requires_entity,
    };

    try {
      if (templateId === null) {
        await createTemplate(payload);
      } else {
        await updateTemplate(templateId, { ...payload, new_version: form.new_version });
      }

      // `refresh()` before `push()` so the listing renders the saved row rather than
      // the copy the router cached on the way in.
      router.refresh();
      router.push(returnTo);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The request failed.');
      setSaving(false);
    }
  };

  const groundingUsed = useMemo(() => {
    const both = `${form.system_prompt} ${form.user_prompt}`;

    return (options?.grounding_variables ?? []).filter((key) => both.includes(`{{${key}}}`));
  }, [form.system_prompt, form.user_prompt, options]);

  const sharedModule = form.module_key === SHARED_MODULE_KEY;

  return (
    <form onSubmit={submit} className="space-y-5">
      {error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {isPlatform && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm leading-6 text-indigo-900">
          This is a platform template every school on the estate uses. Saving writes a copy owned by
          this school, which takes precedence here and leaves the shared one untouched.
        </div>
      )}

      {/* What this template is. First, because it decides what the rest of the form
          asks for — a prompt has prompts, a report has a layout and a data source. */}
      <div className="flex flex-wrap gap-2">
        {(options?.kinds ?? ['prompt', 'report']).map((kind) => (
          <button
            key={kind}
            type="button"
            onClick={() => patch({ kind })}
            aria-pressed={form.kind === kind}
            className={`rounded-xl border px-4 py-2 text-left text-sm transition-colors ${
              form.kind === kind
                ? 'border-slate-900 bg-slate-900 text-white'
                : 'border-slate-200 bg-white text-slate-900 hover:bg-slate-50'
            }`}
          >
            <span className="font-medium">{kind === 'report' ? 'Report template' : 'Prompt template'}</span>
            <span
              className={`mt-0.5 block text-xs ${form.kind === kind ? 'text-slate-300' : 'text-slate-500'}`}
            >
              {kind === 'report'
                ? 'An HTML layout filled with real records. Nothing is written by a model.'
                : 'Instructions sent to a model, which writes the answer in prose.'}
            </span>
          </button>
        ))}
      </div>

      {/* The two identifying fields, side by side, exactly as the ERP template editor
          places Module Name and Template Title. */}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium text-slate-900">Module Name *</span>
          <select
            value={form.module_key}
            onChange={(event) => patch({ module_key: event.target.value })}
            className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          >
            {(options?.modules ?? []).map((module) => (
              <option key={module.key} value={module.key}>
                {module.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-medium text-slate-900">Template Title *</span>
          <input
            value={form.name}
            onChange={(event) => patch({ name: event.target.value })}
            required
            placeholder="Pending fees summary"
            className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          />
        </label>
      </div>

      <label className="block">
        <span className="text-sm font-medium text-slate-900">What it is for</span>
        <input
          value={form.description}
          onChange={(event) => patch({ description: event.target.value })}
          placeholder="A short summary of unpaid fees for a class or student."
          className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
        />
      </label>

      {/* Prompt kind: the two-pane prompt editor. Report kind: the HTML layout
          editor below. One or the other — a template is one thing or the other, and
          showing both would invite an author to fill in the half that is ignored. */}
      {form.kind === 'prompt' ? (
        // The content block: label, then a bordered box whose first row is the toolbar.
        // Same anatomy as the HTML editor on the ERP screen.
        <div>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-slate-900">Prompt Content *</span>
          <Sparkles className="size-4 text-indigo-400" />
        </div>

        <div className="mt-1 overflow-hidden rounded-none border border-slate-300 bg-white focus-within:border-slate-500">
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-300 bg-white p-2">
            <select
              aria-label="Category"
              value={form.category}
              onChange={(event) => patch({ category: event.target.value })}
              className="h-8 rounded border bg-white px-2 text-xs"
            >
              <option value="">Category</option>
              {(options?.categories ?? []).map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>

            <select
              aria-label="Status"
              value={form.status}
              onChange={(event) => patch({ status: event.target.value })}
              className="h-8 rounded border bg-white px-2 text-xs"
            >
              {(options?.statuses ?? ['draft', 'published', 'archived']).map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>

            <select
              aria-label="Output format"
              value={form.output_format}
              onChange={(event) => patch({ output_format: event.target.value })}
              className="h-8 rounded border bg-white px-2 text-xs"
            >
              {(options?.output_formats ?? ['text', 'markdown', 'json']).map((format) => (
                <option key={format} value={format}>
                  {format}
                </option>
              ))}
            </select>

            <span className="mx-1 h-5 w-px bg-slate-200" />

            <select
              aria-label="Insert template variable"
              defaultValue=""
              onChange={(event) => {
                insertVariable(event.target.value);
                event.target.value = '';
              }}
              className="h-8 max-w-64 rounded border bg-white px-2 text-xs"
            >
              <option value="">Insert template variable...</option>
              {(options?.variables ?? []).map((variable) => (
                <option key={variable.key} value={variable.key}>
                  {variable.key} - {variable.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => void runPreview()}
              disabled={previewing || form.user_prompt.trim() === ''}
              className="inline-flex h-8 items-center gap-1.5 rounded border border-slate-200 bg-white px-3 text-xs font-medium text-slate-900 hover:bg-slate-50 disabled:opacity-50"
            >
              {previewing ? <LoaderCircle className="size-3.5 animate-spin" /> : <Eye className="size-3.5" />}
              Preview
            </button>
          </div>

          <div className="divide-y divide-slate-200">
            <div className="p-3">
              <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                System instruction
              </span>
              <textarea
                ref={systemRef}
                value={form.system_prompt}
                onFocus={() => {
                  lastFocused.current = 'system';
                }}
                onChange={(event) => patch({ system_prompt: event.target.value })}
                rows={5}
                placeholder="You summarise school fees for administrators. Work only from the data given below…"
                className="mt-1 w-full resize-y border-0 p-0 font-mono text-xs leading-6 outline-none placeholder:font-sans placeholder:text-slate-400"
              />
            </div>

            <div className="p-3">
              <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                User prompt
              </span>
              <textarea
                ref={userRef}
                value={form.user_prompt}
                onFocus={() => {
                  lastFocused.current = 'user';
                }}
                onChange={(event) => patch({ user_prompt: event.target.value })}
                rows={12}
                required
                placeholder={'Summarise the pending fees on this page.\n\nPage: {{page_title}}\nRows:\n{{records}}'}
                className="mt-1 w-full resize-y border-0 p-0 font-mono text-xs leading-6 outline-none placeholder:font-sans placeholder:text-slate-400"
              />
            </div>
          </div>
        </div>

        <p className="mt-2 text-xs leading-6 text-slate-500">
          Placeholders such as <code className="font-mono">{'{{records}}'}</code> are filled in by the
          system when the template runs. A published template must use at least one of the data
          variables — {(options?.grounding_variables ?? []).map((key) => `{{${key}}}`).join(' or ')} —
          or the model has nothing to work from and answers from general knowledge.{' '}
          {groundingUsed.length > 0 ? (
            <span className="font-medium text-emerald-700">
              Using {groundingUsed.map((key) => `{{${key}}}`).join(', ')}.
            </span>
          ) : (
            <span className="font-medium text-amber-700">None used yet.</span>
          )}
        </p>
      </div>
      ) : (
        <ReportLayoutBlock form={form} patch={patch} options={options} />
      )}

      <details className="rounded-xl border border-slate-200 bg-white">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-slate-900">
          Publishing, safety and where it appears
        </summary>

        <div className="space-y-5 border-t px-4 py-4">
          <label className="block">
            <span className="text-sm font-medium text-slate-900">Template key</span>
            <input
              value={form.template_key}
              onChange={(event) => patch({ template_key: event.target.value })}
              placeholder="Left blank, one is generated from the module and title"
              className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 font-mono text-xs outline-none placeholder:font-sans placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
            <span className="mt-1 block text-xs text-slate-500">
              The stable identifier the runtime and the audit trail use. Changing it on an existing
              template moves what the module offers.
            </span>
          </label>

          <div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-medium text-slate-900">Safety rules</h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  Things the model must never do — checked against the output, not only asked for.
                </p>
              </div>
              <button
                type="button"
                onClick={() => patch({ safety_rules: [...form.safety_rules, ''] })}
                className="shrink-0 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-900 hover:bg-slate-50"
              >
                Add rule
              </button>
            </div>

            <div className="mt-3 space-y-2">
              {form.safety_rules.length === 0 && (
                <p className="rounded-xl border border-dashed border-slate-200 px-3 py-3 text-xs text-slate-500">
                  No rules yet. &ldquo;Do not invent a name, amount or date&rdquo; is the one almost
                  every template wants.
                </p>
              )}

              {form.safety_rules.map((rule, position) => (
                <div key={position} className="flex items-center gap-2">
                  <input
                    value={rule}
                    onChange={(event) => {
                      const next = [...form.safety_rules];
                      next[position] = event.target.value;
                      patch({ safety_rules: next });
                    }}
                    placeholder="Do not invent a fee amount, student name or date."
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      patch({ safety_rules: form.safety_rules.filter((_, index) => index !== position) })
                    }
                    className="shrink-0 rounded-lg border border-slate-200 p-2 text-slate-500 hover:text-slate-900"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-slate-900">Where it appears</h3>
            <p className="mt-0.5 text-xs leading-5 text-slate-500">
              A published template bound to a module is offered by that module&rsquo;s AI panel. Turn
              this off to keep it stored centrally without putting it in front of users.
            </p>

            <label className="mt-3 flex items-center gap-2 text-sm text-slate-900">
              <input
                type="checkbox"
                checked={form.offer_in_module}
                disabled={sharedModule}
                onChange={(event) => patch({ offer_in_module: event.target.checked })}
                className="size-4 accent-blue-600"
              />
              <span className={sharedModule ? 'text-slate-400' : ''}>
                Offer this in the module&rsquo;s AI panel
              </span>
            </label>

            {sharedModule && (
              <p className="mt-1 text-xs text-slate-500">
                Shared templates are resolved from the page type rather than offered as a button, so
                there is no single module to offer them in.
              </p>
            )}

            {form.offer_in_module && !sharedModule && (
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-medium text-slate-900">Button label</span>
                  <input
                    value={form.suggestion_label}
                    onChange={(event) => patch({ suggestion_label: event.target.value })}
                    placeholder={form.name || 'Summarise pending fees'}
                    className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  />
                  <span className="mt-1 block text-xs text-slate-500">Defaults to the template title.</span>
                </label>

                <label className="mt-6 flex items-start gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.requires_entity}
                    onChange={(event) => patch({ requires_entity: event.target.checked })}
                    className="mt-0.5 size-4 accent-blue-600"
                  />
                  <span>
                    Only when a record is selected
                    <span className="mt-0.5 block text-xs text-slate-500">
                      For templates about one student or invoice rather than the list.
                    </span>
                  </span>
                </label>
              </div>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex items-start gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={form.requires_review}
                onChange={(event) => patch({ requires_review: event.target.checked })}
                className="mt-0.5 size-4 accent-blue-600"
              />
              <span>
                Requires human review
                <span className="mt-0.5 block text-xs text-slate-500">
                  Output is held for a person to approve before it is used.
                </span>
              </span>
            </label>

            <label className="flex items-start gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={form.allow_as_evidence}
                onChange={(event) => patch({ allow_as_evidence: event.target.checked })}
                className="mt-0.5 size-4 accent-blue-600"
              />
              <span>
                May be used as evidence
                <span className="mt-0.5 block text-xs text-slate-500">
                  Output can be cited in a case. Leave off unless the template is verifiable.
                </span>
              </span>
            </label>
          </div>

          {templateId !== null && editableInPlace && form.status === 'published' && (
            <label className="flex items-start gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={form.new_version}
                onChange={(event) => patch({ new_version: event.target.checked })}
                className="mt-0.5 size-4 accent-blue-600"
              />
              <span>
                Publish as a new version
                <span className="mt-0.5 block text-xs text-slate-500">
                  Keeps the current text as an archived version, so a change that reads worse can be
                  rolled back by republishing it.
                </span>
              </span>
            </label>
          )}
        </div>
      </details>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-medium text-white disabled:opacity-60"
        >
          {saving && <LoaderCircle className="size-4 animate-spin" />}
          Save
        </button>
        <button
          type="button"
          onClick={() => router.push(returnTo)}
          className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-medium text-slate-900 hover:bg-slate-50"
        >
          Cancel
        </button>
      </div>

      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="flex h-[min(85vh,900px)] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h2 className="font-semibold">What the model receives, with sample data</h2>
              <button
                type="button"
                onClick={() => setPreview(null)}
                className="rounded-lg px-3 py-1 text-sm text-slate-500 hover:text-slate-900"
              >
                Close
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-auto p-4">
              {preview.unresolved.length > 0 && (
                <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  Nothing fills {preview.unresolved.map((key) => `{{${key}}}`).join(', ')} — the model
                  receives that text literally.
                </p>
              )}

              {preview.system && (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                    System instruction
                  </h3>
                  <pre className="mt-1 whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-6 text-slate-600">
                    {preview.system}
                  </pre>
                </div>
              )}

              <div>
                <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                  User prompt
                </h3>
                <pre className="mt-1 whitespace-pre-wrap rounded-xl border border-slate-200 bg-white p-3 text-xs leading-6 text-slate-900">
                  {preview.user}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}

/**
 * The report half of the editor: where the rows come from, and how they are laid out.
 *
 * WHY IT REUSES `TemplateHtmlEditor`
 *
 * That is the editor administrators already design fee receipts and admission letters
 * in — same toolbar, same `<<placeholder>>` spelling, same Preview. A report layout is
 * the same kind of document, so giving it a second editor would mean two ways to write
 * one thing and two sets of habits. It takes its placeholder list as `tags`, which is
 * how the "Insert template variable…" picker is populated, so the report placeholders
 * appear there exactly as receipt tokens do on the ERP screen.
 */
function ReportLayoutBlock({
  form,
  patch,
  options,
}: {
  form: TemplateFormState;
  patch: (changes: Partial<TemplateFormState>) => void;
  options: AiTemplateOptions | null;
}) {
  // Tools whose name matches the chosen module first, everything else after — a
  // fees report is almost always fed by a fees tool, but nothing stops an author
  // binding one to something else if that is what answers the question.
  const sources = useMemo(() => {
    const all = options?.data_sources ?? [];

    if (form.module_key === SHARED_MODULE_KEY) return all;

    const normalise = (value: string) => value.replace(/[-_]/g, '').replace(/s$/, '').toLowerCase();
    const wanted = normalise(form.module_key);

    return [
      ...all.filter((source) => normalise(source.module) === wanted),
      ...all.filter((source) => normalise(source.module) !== wanted),
    ];
  }, [options, form.module_key]);

  const selected = sources.find((source) => source.name === form.data_source) ?? null;

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="text-sm font-medium text-slate-900">Data source *</span>
        <select
          value={form.data_source}
          onChange={(event) => patch({ data_source: event.target.value })}
          required
          className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
        >
          <option value="">Select where the records come from…</option>
          {sources.map((source) => (
            <option key={source.name} value={source.name}>
              {source.module} — {source.name}
            </option>
          ))}
        </select>
        <span className="mt-1 block text-xs text-slate-500">
          {selected
            ? selected.description
            : 'The tool that reads this module’s live records. Only read-only tools are listed, so generating or refreshing a report can never change your data.'}
        </span>
      </label>

      {selected && selected.arguments.length > 0 && (
        <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">
          <span className="font-medium text-slate-900">Filters the chatbot can pass:</span>{' '}
          {selected.arguments.map((argument) => argument.key).join(', ')}. It fills these from the
          question — which is how one template answers both &ldquo;all students with pending
          fees&rdquo; and &ldquo;pending fees for one student&rdquo;.
        </p>
      )}

      <div>
        <span className="text-sm font-medium text-slate-900">Report layout *</span>
        <TemplateHtmlEditor
          value={form.html_layout}
          onChange={(html) => patch({ html_layout: html })}
          tags={(options?.report_placeholders ?? []).map((placeholder) => ({
            key: placeholder.key,
            label: placeholder.label,
          }))}
        />
        <p className="mt-2 text-xs leading-6 text-slate-500">
          Design the report as it should print. <code className="font-mono">{'<<rows_table>>'}</code>{' '}
          drops in every record as a table; wrap a section in{' '}
          <code className="font-mono">{'<<#rows>>'}</code> …{' '}
          <code className="font-mono">{'<</rows>>'}</code> to repeat it once per record. A
          placeholder outside a rows block uses the first record, so the same layout prints a whole
          class or one student.
        </p>
      </div>
    </div>
  );
}

/**
 * Shared page frame for the Add, View and Edit screens.
 *
 * Kept here rather than repeated three times for the same reason `CapabilityShell`
 * exists: three copies of a header is three chances for one to drift, and the first
 * one that does is the one nobody notices.
 */
export function TemplatePageShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen p-4 sm:p-6">
      <div className="mx-auto max-w-[1100px] space-y-5">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-slate-950">{title}</h1>
            <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
          </div>
          {actions}
        </div>
        {children}
      </div>
    </main>
  );
}

/** The load/error states every one of the three pages needs. */
export function TemplatePageState({ loading, error }: { loading: boolean; error: string }) {
  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center rounded-xl border border-slate-200 bg-white">
        <LoaderCircle className="size-6 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {error}
    </div>
  );
}

/** Loads the option lists every page needs, with its own loading and error state. */
export function useTemplateOptions() {
  const [options, setOptions] = useState<AiTemplateOptions | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    fetchTemplateOptions()
      .then((next) => {
        if (!cancelled) setOptions(next);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'The request failed.');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { options, optionsError: error };
}
