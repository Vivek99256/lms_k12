'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  Loader2,
  RefreshCw,
  Save,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  bulkTransition,
  fetchContentVocabulary,
  fetchReviewQueue,
  saveMetadata,
  type ContentEntityType,
  type ContentVocabulary,
  type ReviewItem,
} from '@/app/pal/data/pal-content';

/**
 * PAL V4 Content Intelligence — review queue.
 *
 * The gate between machine-proposed tags and what learners actually get served.
 * Items arrive least-confident-first because that is where a reviewer's time is
 * worth spending; rubber-stamping a confident batch adds nothing, and approving
 * 500 items in ten minutes produces confident, wrong routing.
 *
 * The server enforces the rules — closed vocabularies, legal stage transitions,
 * machine actors barred from approving. This screen surfaces those refusals
 * verbatim rather than pre-empting them, so the UI can never drift from the
 * actual policy.
 */

/** The subset of the 30+ field schema this queue edits inline. */
type EditableField = 'bloom' | 'difficulty' | 'context' | 'language' | 'hpc';
type EditDraft = Partial<Record<EditableField, string>>;

function confidenceTone(confidence: number | null): string {
  if (confidence === null) return 'bg-slate-100 text-slate-600';
  if (confidence < 0.6) return 'bg-rose-50 text-rose-700';
  if (confidence < 0.75) return 'bg-amber-50 text-amber-700';
  return 'bg-emerald-50 text-emerald-700';
}

export default function PalContentReviewPage() {
  const [entityType, setEntityType] = useState<ContentEntityType>('question');
  const [status, setStatus] = useState('draft');
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [vocabulary, setVocabulary] = useState<ContentVocabulary | null>(null);

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [expanded, setExpanded] = useState<number | null>(null);
  const [drafts, setDrafts] = useState<Record<number, EditDraft>>({});

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError('');
      try {
        const [queue, vocab] = await Promise.all([
          fetchReviewQueue(entityType, { status, limit: 50 }, signal),
          vocabulary ? Promise.resolve(vocabulary) : fetchContentVocabulary(signal),
        ]);
        setItems(queue.items);
        setVocabulary(vocab);
        setSelected(new Set());
        setDrafts({});
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        setError((err as Error).message || 'Could not load the review queue.');
        setItems([]);
      } finally {
        setLoading(false);
      }
    },
    [entityType, status, vocabulary]
  );

  useEffect(() => {
    const controller = new AbortController();
    // Defined inside the effect so the state updates land in an async callback
    // rather than synchronously in the effect body.
    const run = async () => {
      await load(controller.signal);
    };
    void run();
    return () => controller.abort();
    // `load` closes over vocabulary, which would re-fire this the moment the
    // vocabulary arrives; the queue only needs to reload when the filters change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityType, status]);

  const nextStatuses = useMemo(
    () => vocabulary?.qualityTransitions[status] ?? [],
    [vocabulary, status]
  );

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected((prev) =>
      prev.size === items.length ? new Set() : new Set(items.map((i) => i.metadataId))
    );
  };

  const applyTransition = async (toStatus: string) => {
    if (selected.size === 0) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await bulkTransition(entityType, Array.from(selected), toStatus);
      if (result.failCount > 0) {
        // Surface the server's own reason — it names the row and the rule.
        setError(
          `${result.okCount} moved, ${result.failCount} refused: ` +
            result.failed
              .slice(0, 3)
              .map((f) => `#${f.id} ${f.error}`)
              .join(' · ')
        );
      } else {
        setMessage(`${result.okCount} item(s) moved to ${toStatus}.`);
      }
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const saveRow = async (item: ReviewItem) => {
    const draft = drafts[item.metadataId];
    if (!draft) return;

    setBusy(true);
    setError('');
    setMessage('');
    try {
      const bloomKey = entityType === 'question' ? 'bloom_level' : 'bloom_level_served';
      const payload: Record<string, unknown> = {};

      if (draft.bloom) payload[bloomKey] = draft.bloom;
      if (draft.difficulty) payload.difficulty_1_to_5 = Number(draft.difficulty);
      if (draft.context) payload.cultural_context = draft.context;
      if (draft.language) payload.language = draft.language;
      if (draft.hpc) payload.hpc_lens_primary = draft.hpc;

      // practice_level is derived from the Bloom level server-side, never typed
      // in — the two must not be able to disagree.
      if (draft.bloom && vocabulary) {
        const def = vocabulary.bloomLevels.find((b) => b.key === draft.bloom);
        if (def) payload.practice_level = def.practiceLevel;
      }

      if (Object.keys(payload).length === 0) {
        setMessage('Nothing changed.');
        return;
      }

      await saveMetadata(entityType, item.entityId, payload);
      setMessage(`Saved ${entityType} #${item.entityId}.`);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const setDraft = (id: number, field: EditableField, value: string) => {
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  };

  return (
    <div className="min-h-full px-4 py-5 sm:px-6">
      <div className="mx-auto w-full max-w-[1800px] space-y-5">
        {/* header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <Link href="/pal/content">
              <Button variant="outline" size="sm" className="mt-0.5">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-[22px] font-semibold text-[#1F2A44]">Review queue</h1>
              <p className="mt-0.5 text-sm text-slate-500">
                Least confident first. Nothing is served to a learner until it is approved here.
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading || busy}>
            <RefreshCw className={`mr-1.5 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* filters */}
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#DFE6F2] bg-white px-4 py-3 shadow-[0_8px_18px_rgba(15,23,42,0.05)]">
          <label className="text-xs font-medium text-slate-500">Estate</label>
          <select
            value={entityType}
            onChange={(e) => setEntityType(e.target.value as ContentEntityType)}
            className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm"
          >
            <option value="question">Questions</option>
            <option value="content">Content</option>
          </select>

          <label className="ml-2 text-xs font-medium text-slate-500">Stage</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm"
          >
            {(vocabulary?.qualityStatuses ?? ['draft']).map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, ' ')}
              </option>
            ))}
          </select>

          <span className="ml-auto text-xs text-slate-500">{items.length} shown</span>
        </div>

        {message ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {message}
          </div>
        ) : null}
        {error ? (
          <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        {/* bulk bar */}
        {items.length > 0 ? (
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#DFE6F2] bg-white px-4 py-3 shadow-[0_8px_18px_rgba(15,23,42,0.05)]">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={selected.size === items.length && items.length > 0}
                onChange={toggleAll}
                className="h-4 w-4 rounded border-slate-300"
              />
              Select all
            </label>
            <span className="text-xs text-slate-500">{selected.size} selected</span>

            <div className="ml-auto flex flex-wrap items-center gap-2">
              {nextStatuses.length === 0 ? (
                <span className="text-xs text-slate-400">No onward stage from “{status}”.</span>
              ) : (
                nextStatuses.map((next) => (
                  <Button
                    key={next}
                    size="sm"
                    variant={next === 'approved' ? 'default' : 'outline'}
                    disabled={selected.size === 0 || busy}
                    onClick={() => void applyTransition(next)}
                  >
                    {busy ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Check className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    Move to {next.replace(/_/g, ' ')}
                  </Button>
                ))
              )}
            </div>
          </div>
        ) : null}

        {/* list */}
        {loading ? (
          <div className="flex items-center justify-center rounded-2xl border border-[#DFE6F2] bg-white py-16">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
            <span className="ml-2 text-sm text-slate-500">Loading queue…</span>
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-[#DFE6F2] bg-white px-6 py-14 text-center">
            <p className="text-sm font-medium text-slate-700">
              Nothing in “{status}” for {entityType}s.
            </p>
            <p className="mx-auto mt-1 max-w-md text-xs text-slate-500">
              Run <code className="rounded bg-slate-100 px-1">php artisan pal:tag-content</code> on the
              server to generate proposals.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-[#DFE6F2] bg-white shadow-[0_8px_18px_rgba(15,23,42,0.05)]">
            <ul className="divide-y divide-slate-100">
              {items.map((item) => {
                const isOpen = expanded === item.metadataId;
                const draft = drafts[item.metadataId] ?? {};

                return (
                  <li key={item.metadataId}>
                    <div className="flex items-start gap-3 px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(item.metadataId)}
                        onChange={() => toggle(item.metadataId)}
                        className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300"
                      />

                      <button
                        type="button"
                        onClick={() => setExpanded(isOpen ? null : item.metadataId)}
                        className="mt-0.5 shrink-0 text-slate-400 hover:text-slate-600"
                        aria-label={isOpen ? 'Collapse' : 'Expand'}
                      >
                        {isOpen ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </button>

                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-slate-800">
                          <span className="font-mono text-xs text-slate-400">#{item.entityId}</span>{' '}
                          {item.title || '(no title)'}
                        </p>
                        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                          <span>{item.bloomLevel || 'no bloom level'}</span>
                          {item.practiceLevel ? <span>L{item.practiceLevel}</span> : null}
                          {item.difficulty ? <span>difficulty {item.difficulty}</span> : null}
                          {item.culturalContext ? (
                            <span>{item.culturalContext.replace(/_/g, ' ')}</span>
                          ) : null}
                          <span className="text-slate-400">tagged by {item.taggedBy}</span>
                          {item.bloomEvidence ? (
                            <span className="text-slate-400">matched “{item.bloomEvidence}”</span>
                          ) : null}
                        </p>
                        {item.missingMandatory.length > 0 ? (
                          <p className="mt-1 text-xs text-rose-600">
                            Blocking approval: {item.missingMandatory.slice(0, 4).join(', ')}
                            {item.missingMandatory.length > 4
                              ? ` +${item.missingMandatory.length - 4}`
                              : ''}
                          </p>
                        ) : null}
                      </div>

                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${confidenceTone(item.confidence)}`}
                      >
                        {item.confidence === null ? '—' : `${Math.round(item.confidence * 100)}%`}
                      </span>
                    </div>

                    {isOpen && vocabulary ? (
                      <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-4">
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                          <div>
                            <label className="text-xs font-medium text-slate-500">Bloom level</label>
                            <select
                              value={draft.bloom ?? item.bloomLevel}
                              onChange={(e) => setDraft(item.metadataId, 'bloom', e.target.value)}
                              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm"
                            >
                              <option value="">—</option>
                              {vocabulary.bloomLevels.map((b) => (
                                <option key={b.key} value={b.key}>
                                  L{b.practiceLevel} · {b.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="text-xs font-medium text-slate-500">Difficulty</label>
                            <select
                              value={draft.difficulty ?? (item.difficulty ? String(item.difficulty) : '')}
                              onChange={(e) => setDraft(item.metadataId, 'difficulty', e.target.value)}
                              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm"
                            >
                              <option value="">—</option>
                              {[1, 2, 3, 4, 5].map((d) => (
                                <option key={d} value={d}>
                                  {d}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="text-xs font-medium text-slate-500">
                              Cultural context
                            </label>
                            <select
                              value={draft.context ?? item.culturalContext}
                              onChange={(e) => setDraft(item.metadataId, 'context', e.target.value)}
                              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm"
                            >
                              <option value="">—</option>
                              {vocabulary.culturalContexts.map((c) => (
                                <option key={c} value={c}>
                                  {c.replace(/_/g, ' ')}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="text-xs font-medium text-slate-500">Language</label>
                            <select
                              value={draft.language ?? item.language}
                              onChange={(e) => setDraft(item.metadataId, 'language', e.target.value)}
                              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm"
                            >
                              <option value="">—</option>
                              {vocabulary.languages.map((l) => (
                                <option key={l} value={l}>
                                  {l}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="text-xs font-medium text-slate-500">HPC lens</label>
                            <select
                              value={draft.hpc ?? ''}
                              onChange={(e) => setDraft(item.metadataId, 'hpc', e.target.value)}
                              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm"
                            >
                              <option value="">—</option>
                              {vocabulary.hpcLenses.map((h) => (
                                <option key={h} value={h}>
                                  {h}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="mt-3 flex items-center gap-3">
                          <Button size="sm" onClick={() => void saveRow(item)} disabled={busy}>
                            {busy ? (
                              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Save className="mr-1.5 h-3.5 w-3.5" />
                            )}
                            Save
                          </Button>
                          <span className="text-xs text-slate-500">
                            Practice level is derived from the Bloom level — it is never entered by hand.
                          </span>
                        </div>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
