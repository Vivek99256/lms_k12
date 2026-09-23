'use client';

import { useEffect, useState } from 'react';
import { Check, Copy, Pencil, RefreshCw, X } from 'lucide-react';

import type { GenerationOutcome } from '@/lib/intelligence/types';
import {
  generateForContext,
  type WorkspaceContext,
  type WorkspaceSession,
  type WorkspaceSuggestion,
} from '@/lib/intelligence/workspace';

import {
  GeneratedTag,
  SuggestionButton,
  TabEmptyState,
  TabError,
  TabSection,
} from './WorkspaceChrome';

/**
 * The "Create" tab — Generative AI, scoped to what makes sense here.
 *
 * The actions shown come from `ai_suggestions` for the resolved module, so a student
 * page offers "Generate intervention activity" and a fees page does not. Nothing is
 * hardcoded in this component; it renders whatever the backend says is valid.
 *
 * Everything produced is labelled as an AI draft and left on screen for the user to
 * copy. It is deliberately not written anywhere: content becomes part of a student's
 * record only through an approved workflow, never as a side effect of pressing
 * "generate".
 */
export function CreateTab({
  session,
  context,
  suggestions,
  route,
  onUse,
  presetTemplateKey,
}: {
  session: WorkspaceSession;
  context: WorkspaceContext | null;
  suggestions: WorkspaceSuggestion[];
  route: string;
  /** Hands the finished text back to the caller — see ActionsTab's draft slot. */
  onUse?: (text: string, outcome: GenerationOutcome) => void;
  /** Set when the user arrived here from "Generate intervention" on a finding. */
  presetTemplateKey?: string | null;
}) {
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [result, setResult] = useState<{ suggestion: WorkspaceSuggestion; outcome: GenerationOutcome } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Edited text is kept beside the original rather than replacing it, so
  // "what the model wrote" stays distinguishable from "what the teacher wrote".
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  async function run(suggestion: WorkspaceSuggestion) {
    if (!suggestion.action_ref) return;

    setBusyKey(suggestion.key);
    setError(null);
    setResult(null);
    setCopied(false);
    setEditing(false);
    setDraft('');

    try {
      const outcome = await generateForContext(session, {
        route,
        template_key: suggestion.action_ref,
        entity_type: context?.entity_type ?? null,
        entity_id: context?.entity_id ?? null,
      });

      setResult({ suggestion, outcome });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The content could not be generated.');
    } finally {
      setBusyKey(null);
    }
  }

  /**
   * Ask again with the same template and context.
   *
   * Every attempt is its own audited generation — the previous request and output
   * rows stay in place rather than being overwritten, so a run that was regenerated
   * three times shows three attempts.
   */
  function regenerate() {
    if (result) void run(result.suggestion);
  }

  /**
   * The text the user will actually use: their edit if they made one, otherwise the
   * model's output verbatim.
   */
  function currentText() {
    if (!result) return '';

    return editing && draft.trim() ? draft : result.outcome.content || '';
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      // Clipboard access can be refused; the text is on screen either way.
      setCopied(false);
    }
  }

  // Arriving from "Generate intervention" on an agent finding: run that template
  // straight away rather than making the user find the button they just pressed.
  useEffect(() => {
    if (!presetTemplateKey || result || busyKey) return;

    const preset = suggestions.find((item) => item.action_ref === presetTemplateKey);

    if (preset) void run(preset);
    // Deliberately keyed on the preset alone: this should fire once on arrival, not
    // again whenever the suggestion list is re-resolved.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetTemplateKey]);

  if (suggestions.length === 0) {
    return (
      <TabEmptyState message="There is nothing to generate on this page yet. Open a student or a course to see content options." />
    );
  }

  return (
    <div className="space-y-4">
      <TabSection title="Create">
        <div className="flex flex-col gap-1.5">
          {suggestions.map((suggestion) => (
            <SuggestionButton
              key={suggestion.key}
              label={suggestion.label}
              description={suggestion.description}
              busy={busyKey === suggestion.key}
              disabled={busyKey !== null}
              onClick={() => void run(suggestion)}
            />
          ))}
        </div>
      </TabSection>

      {error ? <TabError message={error} /> : null}

      {result ? (
        <TabSection title="Draft">
          <div className="rounded-2xl border border-gray-200/80 bg-white p-3.5">
            <div className="mb-2 flex items-start justify-between gap-2">
              <p className="text-xs font-semibold text-gray-900">{result.suggestion.label}</p>
              <GeneratedTag />
            </div>

            {editing ? (
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                rows={8}
                className="w-full rounded-xl border border-gray-200 bg-white p-2.5 text-xs leading-6 text-gray-800 outline-none focus-visible:border-[#0D6EFD]/40 focus-visible:ring-2 focus-visible:ring-[#0D6EFD]/15"
                aria-label="Edit generated content"
              />
            ) : (
              <ReadableOutput outcome={result.outcome} />
            )}

            <div className="mt-3 space-y-2 border-t border-gray-100 pt-2.5">
              <p className="text-[10px] text-gray-500">
                {editing
                  ? 'Your edits are yours — they are no longer AI output.'
                  : 'Review before use. Nothing has been saved to the record.'}
              </p>

              <div className="flex flex-wrap items-center gap-1">
                <ActionButton
                  icon={copied ? Check : Copy}
                  label={copied ? 'Copied' : 'Copy'}
                  onClick={() => void copy(currentText())}
                />

                <ActionButton
                  icon={RefreshCw}
                  label="Regenerate"
                  disabled={busyKey !== null}
                  onClick={regenerate}
                />

                {editing ? (
                  <ActionButton
                    icon={X}
                    label="Discard edits"
                    onClick={() => {
                      setEditing(false);
                      setDraft('');
                    }}
                  />
                ) : (
                  <ActionButton
                    icon={Pencil}
                    label="Edit"
                    onClick={() => {
                      setDraft(result.outcome.content || '');
                      setEditing(true);
                    }}
                  />
                )}

                {onUse ? (
                  <button
                    type="button"
                    onClick={() => onUse(currentText(), result.outcome)}
                    className="ml-auto rounded-xl bg-[#0D6EFD] px-3 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-[#0b5ed7]"
                  >
                    Use this
                  </button>
                ) : null}
              </div>

              {onUse ? (
                <p className="text-[10px] leading-4 text-gray-500">
                  &ldquo;Use this&rdquo; attaches the content to the proposed intervention. It still
                  needs approval before anything is created.
                </p>
              ) : null}
            </div>
          </div>
        </TabSection>
      ) : null}
    </div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
  disabled,
}: {
  icon: typeof Copy;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1 rounded-xl px-2 py-1 text-[11px] font-semibold text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Icon className="size-3" aria-hidden />
      {label}
    </button>
  );
}

/**
 * Renders structured output as a readable list where the template produced one, and
 * falls back to plain text otherwise — a teacher should not be shown raw JSON.
 */
function ReadableOutput({ outcome }: { outcome: GenerationOutcome }) {
  const activities = Array.isArray(
    (outcome.structured as { activities?: unknown } | null)?.activities
  )
    ? ((outcome.structured as { activities: Array<Record<string, unknown>> }).activities)
    : null;

  if (activities && activities.length > 0) {
    return (
      <ol className="space-y-2.5">
        {activities.map((activity, index) => (
          <li key={index} className="rounded-xl bg-gray-50/80 p-2.5">
            <p className="text-xs font-semibold text-gray-900">
              {String(activity.title ?? `Activity ${index + 1}`)}
            </p>
            {activity.instructions ? (
              <p className="mt-1 text-[11px] leading-5 text-gray-600">
                {String(activity.instructions)}
              </p>
            ) : null}
          </li>
        ))}
      </ol>
    );
  }

  return (
    <p className="whitespace-pre-wrap text-xs leading-6 text-gray-700">
      {outcome.content || 'The model returned no readable content.'}
    </p>
  );
}
