'use client';

/**
 * The one real action behind the `knowledge-rag` capability: ask a free-text
 * question and get back an answer grounded in this institute's own ingested
 * curriculum content (`ContentEmbeddingService` + `ContentKnowledgeAnswerer`
 * on the backend), or an honest refusal rather than a guess.
 *
 * Rendered only on the `knowledge-rag` capability page, alongside — not
 * instead of — `CapabilityLiveData`'s generic "what's configured" panel and
 * the registry description above it. Three answer shapes, matching the
 * backend's own vocabulary exactly: `ok` (an answer, with the passages it
 * came from), `insufficient_evidence` (nothing retrieved was relevant
 * enough — not an error), `model_unavailable` (no key configured, or the
 * provider failed). Never a fabricated fourth state.
 */

import { useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';

import { askKnowledgeRag, AiCapabilityError, type KnowledgeRagAnswer } from '@/lib/intelligence/ai-capabilities';

import { SectionCard } from './console-ui';

type AskState =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'answered'; result: KnowledgeRagAnswer }
  | { phase: 'error'; message: string };

export function KnowledgeRagAsk() {
  const [question, setQuestion] = useState('');
  const [state, setState] = useState<AskState>({ phase: 'idle' });

  const submit = async () => {
    const trimmed = question.trim();
    if (trimmed === '' || state.phase === 'loading') return;

    setState({ phase: 'loading' });

    try {
      const result = await askKnowledgeRag(trimmed);
      setState({ phase: 'answered', result });
    } catch (cause: unknown) {
      setState({
        phase: 'error',
        message: cause instanceof AiCapabilityError ? cause.message : 'The request failed.',
      });
    }
  };

  return (
    <SectionCard
      title="Ask your curriculum content"
      description="Answers come only from this school's own ingested curriculum documents — never a guess."
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') submit();
            }}
            placeholder="e.g. What does this chapter cover?"
            maxLength={500}
            className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <button
            type="button"
            onClick={submit}
            disabled={question.trim() === '' || state.phase === 'loading'}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted disabled:opacity-60"
          >
            {state.phase === 'loading' ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            Ask
          </button>
        </div>

        {state.phase === 'error' && (
          <p className="rounded-lg border border-dashed border-border bg-muted/40 px-4 py-3 text-sm leading-6 text-muted-foreground">
            {state.message}
          </p>
        )}

        {state.phase === 'answered' && <Answer result={state.result} />}
      </div>
    </SectionCard>
  );
}

function Answer({ result }: { result: KnowledgeRagAnswer }) {
  if (result.status === 'ok') {
    return (
      <div className="rounded-lg border border-border bg-background px-4 py-3">
        <p className="text-sm leading-6 whitespace-pre-wrap text-foreground">{result.answer}</p>
        {result.sources.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border pt-3">
            {result.sources.map((source) => (
              <span
                key={source.content_master_id}
                className="rounded-full border border-border bg-muted/40 px-2.5 py-0.5 text-[11px] text-muted-foreground"
                title={`Match score ${source.score}`}
              >
                {source.title || `Document #${source.content_master_id}`}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  }

  // insufficient_evidence and model_unavailable both render as an honest
  // refusal — the distinction is in the message itself, which the backend
  // already writes in plain language.
  return (
    <p className="rounded-lg border border-dashed border-border bg-muted/40 px-4 py-3 text-sm leading-6 text-muted-foreground">
      {result.message ?? 'No answer could be generated.'}
    </p>
  );
}
