'use client';

/**
 * Generative AI for a Fees text field.
 *
 * The affordance that makes the Fees AI Stack usable where a person is actually typing:
 * a remark on a receipt, a fee circular, a message to a parent. Drop it beside a
 * textarea and that field can draft itself.
 *
 * WHAT IT IS NOT
 *
 * It is not a model call. It asks `/api/ai/generate`, and everything that makes the
 * result trustworthy happens on the other side of that call — the school's AI policy is
 * resolved and may refuse outright, the prompt used is the `ai_templates` row an
 * administrator published for Fees, and the request and output are written to
 * `ai_generation_requests` / `ai_generation_outputs`. That is why using this field
 * shows up on the Fees AI Stack's Usage & Cost and Guardrails tabs without this
 * component knowing those tabs exist.
 *
 * THE PROMPT IS NEVER IN THIS FILE
 *
 * `feesPromptFor()` resolves the published Fees prompt at the moment of use. Publish a
 * better one and the next draft uses it; retire them all and the button disables itself
 * and says why, rather than falling back to wording baked into a component.
 *
 * NOTHING IS APPLIED WITHOUT A PERSON
 *
 * A draft appears in a panel with Insert and Discard. It never writes into the field on
 * its own, and where the template is marked `requires_review` the panel says so. The
 * operator is the one who decides the text is good enough to keep — which is the whole
 * of the review guardrail, enforced at the only point it can be.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Loader2, ShieldAlert, Sparkles, X } from 'lucide-react';

import { generateContent, AiGenerationError, type AiGenerationResult } from '@/lib/intelligence/ai-generate';
import {
  FEES_OPERATIONS,
  feesPromptFor,
  logFeesOperation,
  type FeesOperationKey,
} from '@/lib/fees/fees-ai-stack';
import type { AiTemplateRow } from '@/lib/intelligence/ai-templates';

interface FeesAiAssistProps {
  /** Which Fees operation this field belongs to. Decides the prompt and the ledger entry. */
  operation: Extract<
    FeesOperationKey,
    'remarks_drafted' | 'circular_drafted' | 'communication_drafted'
  >;
  /** Values handed to the prompt. Real Fees data from the screen — never placeholders. */
  variables: Record<string, unknown>;
  /** Who the text is about, for the ledger and the generation record. */
  student?: { id?: number | null; name?: string | null };
  /** Called when the operator accepts the draft. */
  onInsert: (text: string) => void;
  /** Shown on the button. Defaults to the operation's own label. */
  label?: string;
  /** Disable when the screen has nothing worth drafting from yet. */
  disabled?: boolean;
  className?: string;
}

export function FeesAiAssist({
  operation,
  variables,
  student,
  onInsert,
  label,
  disabled = false,
  className = '',
}: FeesAiAssistProps) {
  const [prompt, setPrompt] = useState<AiTemplateRow | null>(null);
  /** null while still looking; false once we know Fees has published nothing usable. */
  const [promptReady, setPromptReady] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<AiGenerationResult | null>(null);
  const [error, setError] = useState('');
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    feesPromptFor(operation)
      .then((row) => {
        if (cancelled) return;
        setPrompt(row);
        setPromptReady(row !== null);
      })
      .catch(() => {
        if (!cancelled) setPromptReady(false);
      });

    return () => {
      cancelled = true;
    };
  }, [operation]);

  const spec = FEES_OPERATIONS[operation];

  const generate = useCallback(async () => {
    if (!prompt) return;

    setBusy(true);
    setError('');
    setDraft(null);

    try {
      const result = await generateContent({
        template_key: prompt.template_key,
        purpose: operation,
        variables,
        subject_entity_key: student?.id ? 'student' : null,
        subject_id: student?.id ?? null,
      });

      if (!mounted.current) return;
      setDraft(result);

      // Recorded at the moment it happened, whether or not the operator keeps the text.
      // A draft that was generated and discarded still consumed a model call and still
      // belongs in the ledger; hiding it would make the usage figures wrong.
      logFeesOperation(operation, {
        status: 'completed',
        message: `Drafted with "${prompt.name}".`,
        studentId: student?.id ?? null,
        studentName: student?.name ?? null,
        promptId: prompt.id,
        result: {
          request_id: result.request_id,
          output_id: result.output_id,
          provider: result.provider,
          model: result.model,
          latency_ms: result.latency_ms,
          requires_review: result.requires_review,
          characters: result.content?.length ?? 0,
        },
      });
    } catch (cause) {
      if (!mounted.current) return;

      const refused = cause instanceof AiGenerationError && cause.refusedByPolicy;
      const message = cause instanceof Error ? cause.message : 'The draft could not be generated.';
      setError(message);

      // A refusal is the guardrail working, and is recorded as such — `denied` rather
      // than `failed`, so the ledger distinguishes "a rule stopped this" from "it broke".
      logFeesOperation(operation, {
        status: refused ? 'denied' : 'failed',
        message,
        studentId: student?.id ?? null,
        studentName: student?.name ?? null,
        promptId: prompt.id,
      });
    } finally {
      if (mounted.current) setBusy(false);
    }
  }, [prompt, operation, variables, student]);

  // Fees has published no prompt this field can use. Say so rather than showing a
  // button that can only fail, and name the tab where one is created.
  if (promptReady === false) {
    return (
      <p className={`text-xs text-slate-400 ${className}`}>
        No Fees prompt is published for this, so AI drafting is unavailable. Publish one under Fees → AI Stack →
        Prompts.
      </p>
    );
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => void generate()}
        disabled={disabled || busy || promptReady !== true}
        title={prompt ? `Uses the published Fees prompt "${prompt.name}"` : undefined}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 text-xs font-medium text-indigo-700 transition-colors hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
        {busy ? 'Drafting…' : (label ?? `Draft with AI`)}
      </button>

      {prompt && (
        <p className="mt-1 text-[11px] leading-4 text-slate-400">
          {spec?.label} · prompt <span className="font-mono">{prompt.template_key}</span> v{prompt.version}
        </p>
      )}

      {error && (
        <p className="mt-2 flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
          <ShieldAlert className="mt-0.5 size-3.5 shrink-0" />
          {error}
        </p>
      )}

      {draft?.content && (
        <div className="mt-2 rounded-xl border border-slate-200 bg-white p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
              AI draft — not yet applied
            </p>
            <p className="text-[11px] text-slate-400">
              {draft.provider}
              {draft.model ? ` · ${draft.model}` : ''}
              {draft.latency_ms ? ` · ${(draft.latency_ms / 1000).toFixed(1)}s` : ''}
            </p>
          </div>

          <p className="mt-2 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-800">
            {draft.content}
          </p>

          {draft.requires_review && (
            <p className="mt-2 text-[11px] leading-4 text-amber-700">
              This prompt is marked as requiring review. Read it before you keep it.
            </p>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                onInsert(draft.content ?? '');
                setDraft(null);
              }}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-slate-950 px-3 text-xs font-medium text-white hover:opacity-95"
            >
              <Check className="size-3.5" />
              Insert
            </button>
            <button
              type="button"
              onClick={() => setDraft(null)}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <X className="size-3.5" />
              Discard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
